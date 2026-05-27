import { createServer } from 'node:http';
import http from 'node:http';
import https from 'node:https';
import crypto from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const port = Number(process.env.PORT || process.env.SITE_SAAS_PORT || 8787);
const storePath = process.env.SITE_SAAS_STORE || path.join(rootDir, 'data', 'site-saas-store.json');
const activatingOrders = new Set();

const defaultStore = {
  config: {
    creem_api_key: '',
    creem_api_base_url: 'https://api.creem.io',
    creem_checkout_path: '/v1/checkouts',
    creem_webhook_secret: '',
    subrouter_base_url: 'http://localhost:3000',
    public_api_base_url: '',
    subrouter_internal_token: '',
    site_public_url: '',
    package_mappings: {},
  },
  codes: [],
  orders: [],
  subscriptions: [],
  events: [],
};

const playgroundApiPaths = new Set([
  'chat/completions',
  'images/generations',
  'videos/generations',
  'audio/speech',
]);
const playgroundProxyTimeoutMs = Number(process.env.PLAYGROUND_PROXY_TIMEOUT_MS || 600000);

function now() {
  return new Date().toISOString();
}

function id(prefix) {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
}

async function loadStore() {
  if (!existsSync(storePath)) {
    await mkdir(path.dirname(storePath), { recursive: true });
    await writeFile(storePath, JSON.stringify(defaultStore, null, 2));
    return structuredClone(defaultStore);
  }
  const raw = await readFile(storePath, 'utf8');
  return { ...structuredClone(defaultStore), ...JSON.parse(raw || '{}') };
}

async function saveStore(store) {
  await mkdir(path.dirname(storePath), { recursive: true });
  await writeFile(storePath, JSON.stringify(store, null, 2));
}

function getConfig(store) {
  const creemApiKeyEnv = String(process.env.CREEM_API_KEY || '').trim();
  const creemApiKeyConfig = String(store.config.creem_api_key || '').trim();
  const hasValidCreemApiKeyEnv = Boolean(creemApiKeyEnv) && !invalidHeaderValueDetail(creemApiKeyEnv);
  const creemApiKey = hasValidCreemApiKeyEnv ? creemApiKeyEnv : creemApiKeyConfig;
  const creemApiKeySource = hasValidCreemApiKeyEnv
    ? 'environment variable CREEM_API_KEY'
    : (
      creemApiKeyConfig
        ? (creemApiKeyEnv ? 'site admin config (ignored invalid CREEM_API_KEY environment variable)' : 'site admin config')
        : (creemApiKeyEnv ? 'invalid environment variable CREEM_API_KEY' : 'unset')
    );
  return {
    ...store.config,
    creem_api_key: creemApiKey,
    creem_api_base_url: process.env.CREEM_API_BASE_URL || store.config.creem_api_base_url || 'https://api.creem.io',
    creem_checkout_path: process.env.CREEM_CHECKOUT_PATH || store.config.creem_checkout_path || '/v1/checkouts',
    creem_webhook_secret: process.env.CREEM_WEBHOOK_SECRET || store.config.creem_webhook_secret || '',
    subrouter_base_url: process.env.SUBROUTER_API_BASE || store.config.subrouter_base_url || 'http://localhost:3000',
    public_api_base_url: process.env.PUBLIC_API_BASE_URL || process.env.VITE_PUBLIC_API_BASE_URL || store.config.public_api_base_url || '',
    subrouter_internal_token: process.env.SUBROUTER_INTERNAL_TOKEN || store.config.subrouter_internal_token || '',
    site_public_url: process.env.PUBLIC_SITE_URL || process.env.SITE_PUBLIC_URL || store.config.site_public_url || '',
    subrouter_site_host: process.env.SUBROUTER_SITE_HOST || store.config.subrouter_site_host || '',
    _sources: {
      creem_api_key: creemApiKeySource,
    },
  };
}

function adminToken() {
  return String(process.env.SITE_ADMIN_TOKEN || '').trim();
}

function requireAdmin(req) {
  const token = adminToken();
  if (!token) return true;
  const got = String(req.headers['x-site-admin-token'] || req.headers.authorization?.replace(/^Bearer\s+/i, '') || '').trim();
  return got === token;
}

function userIdFromRequest(req) {
  return String(req.headers['new-api-user'] || req.headers['x-subrouter-user'] || '').trim();
}

function isHeaderSafeValue(value) {
  const text = String(value ?? '').trim();
  if (!text || /[\r\n]/.test(text)) return false;
  for (let index = 0; index < text.length; index += 1) {
    if (text.charCodeAt(index) > 255) return false;
  }
  return true;
}

function invalidHeaderValueDetail(value) {
  const text = String(value ?? '').trim();
  if (!text) return { reason: 'empty' };
  const newlineIndex = text.search(/[\r\n]/);
  if (newlineIndex >= 0) {
    return { reason: 'newline', index: newlineIndex, code: text.charCodeAt(newlineIndex) };
  }
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    if (code > 255) return { reason: 'unsupported', index, code };
  }
  return null;
}

function sanitizeOutgoingHeaders(headers = {}) {
  const safe = {};
  for (const [key, value] of Object.entries(headers)) {
    if (value === undefined || value === null || value === false) continue;
    const values = Array.isArray(value) ? value : [value];
    if (values.every(isHeaderSafeValue)) {
      safe[key] = value;
    }
  }
  return safe;
}

function requireHeaderSafeSecret(label, value, source = 'configuration') {
  const text = String(value || '').trim();
  const invalid = invalidHeaderValueDetail(text);
  if (invalid?.reason === 'empty') {
    throw new Error(`Site SaaS backend is missing ${label} in ${source}`);
  }
  if (invalid) {
    const code = invalid.code == null ? '' : ` (U+${invalid.code.toString(16).toUpperCase().padStart(4, '0')})`;
    throw new Error(`${label} from ${source} contains an unsupported character at index ${invalid.index}${code}. Paste the raw ASCII token/key, not a label, placeholder, or formatted text.`);
  }
  if (!isHeaderSafeValue(text)) throw new Error(`${label} from ${source} is not a valid HTTP header value.`);
  return text;
}

function siteForwardHeaders(config) {
  const explicitHost = String(config.subrouter_site_host || '').trim();
  if (explicitHost) {
    return {
      Host: explicitHost,
      'X-Forwarded-Host': explicitHost,
      'X-Forwarded-Proto': 'https',
    };
  }
  if (!config.site_public_url) return {};
  try {
    const publicUrl = new URL(config.site_public_url);
    return {
      Host: publicUrl.host,
      'X-Forwarded-Host': publicUrl.host,
      'X-Forwarded-Proto': publicUrl.protocol.replace(':', '') || 'https',
    };
  } catch {
    return {};
  }
}

function normalizeHost(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  try {
    return new URL(text.includes('://') ? text : `https://${text}`).host;
  } catch {
    return text.replace(/^https?:\/\//i, '').split('/')[0].trim();
  }
}

function shouldConnectViaSiteHost(baseUrl, siteHost) {
  const baseHostname = baseUrl.hostname.toLowerCase();
  return Boolean(siteHost) && ['subrouter.ai', 'subrouter.com'].includes(baseHostname);
}

function subRouterRequestUrl(pathname, config) {
  const baseUrl = new URL(config.subrouter_base_url);
  const siteHost = normalizeHost(config.subrouter_site_host || '');
  if (shouldConnectViaSiteHost(baseUrl, siteHost)) {
    baseUrl.host = siteHost;
  }
  return new URL(pathname, baseUrl).toString();
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Site-Admin-Token, New-Api-User, X-SubRouter-User',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  });
  res.end(JSON.stringify(payload));
}

function sendRaw(res, status, headers, body) {
  res.writeHead(status, {
    ...headers,
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Site-Admin-Token, New-Api-User, X-SubRouter-User',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  });
  res.end(body);
}

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

function parseJson(raw) {
  if (!raw?.length) return {};
  return JSON.parse(raw.toString('utf8'));
}

function requestJson(url, { method = 'GET', headers = {}, body = '' } = {}) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const transport = target.protocol === 'https:' ? https : http;
    const req = transport.request(
      {
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port || undefined,
        path: `${target.pathname}${target.search}`,
        method,
        headers: sanitizeOutgoingHeaders(headers),
      },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let json = {};
          try {
            json = text ? JSON.parse(text) : {};
          } catch {
            json = { raw: text };
          }
          resolve({
            ok: Number(res.statusCode) >= 200 && Number(res.statusCode) < 300,
            status: res.statusCode || 0,
            data: json,
          });
        });
      },
    );
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function normalizePlaygroundPath(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  let pathname = text;
  try {
    if (/^https?:\/\//i.test(text)) {
      pathname = new URL(text).pathname;
    }
  } catch {
    pathname = text;
  }
  const clean = pathname
    .replace(/^\/+/, '')
    .replace(/^v1\/+/i, '')
    .replace(/\/+$/, '');
  return playgroundApiPaths.has(clean) ? clean : '';
}

function isExternalPlaygroundApiBase(value) {
  const text = String(value || '').trim();
  if (!text) return false;
  if (/^https?:\/\//i.test(text)) return true;
  return !text.startsWith('/') && !/^v1(?:\/|$)/i.test(text);
}

function getPlaygroundProxyBaseUrl(config) {
  const configured = String(config.public_api_base_url || '').trim();
  if (/^https?:\/\//i.test(configured)) return new URL(configured);
  if (isExternalPlaygroundApiBase(configured)) {
    return new URL(`https://${configured}`);
  }
  const upstream = new URL(config.subrouter_base_url || 'http://localhost:3000');
  const siteHost = normalizeHost(config.subrouter_site_host || '');
  if (shouldConnectViaSiteHost(upstream, siteHost)) {
    upstream.host = siteHost;
  }
  if (configured) {
    upstream.pathname = configured.startsWith('/') ? configured : `/${configured}`;
  } else {
    upstream.pathname = `${upstream.pathname.replace(/\/+$/, '')}/v1`;
  }
  return upstream;
}

function buildPlaygroundProxyUrl(config, apiPath) {
  const baseUrl = getPlaygroundProxyBaseUrl(config);
  const basePath = baseUrl.pathname.replace(/\/+$/, '');
  baseUrl.pathname = `${basePath}/${apiPath}`.replace(/\/{2,}/g, '/');
  baseUrl.search = '';
  return baseUrl.toString();
}

function requestRaw(url, { method = 'POST', headers = {}, body = '' } = {}) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const transport = target.protocol === 'https:' ? https : http;
    const req = transport.request(
      {
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port || undefined,
        path: `${target.pathname}${target.search}`,
        method,
        headers: sanitizeOutgoingHeaders({
          ...headers,
          'Accept-Encoding': 'identity',
        }),
      },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          resolve({
            status: res.statusCode || 0,
            contentType: res.headers['content-type'] || 'application/octet-stream',
            contentDisposition: res.headers['content-disposition'] || '',
            buffer: Buffer.concat(chunks),
          });
        });
      },
    );
    req.setTimeout(playgroundProxyTimeoutMs, () => {
      const error = new Error('Playground proxy timed out while waiting for the API response');
      error.name = 'AbortError';
      req.destroy(error);
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function publicState(store) {
  const config = getConfig(store);
  const statsByPackage = new Map();
  for (const code of store.codes) {
    const pkg = code.package_id || 'unassigned';
    const stat = statsByPackage.get(pkg) || { package_id: pkg, total: 0, available: 0, reserved: 0, balance_redeemed: 0, subscribed: 0, failed: 0 };
    stat.total += 1;
    if (code.status === 'available') stat.available += 1;
    if (code.status === 'reserved') stat.reserved += 1;
    if (code.status === 'balance_redeemed') stat.balance_redeemed += 1;
    if (code.status === 'subscribed') stat.subscribed += 1;
    if (code.status === 'redeem_failed' || code.status === 'subscribe_failed') stat.failed += 1;
    statsByPackage.set(pkg, stat);
  }

  return {
    config: {
      creem_api_key_configured: Boolean(config.creem_api_key),
      creem_webhook_secret_configured: Boolean(config.creem_webhook_secret),
      subrouter_internal_token_configured: Boolean(config.subrouter_internal_token),
      creem_api_key_source: config._sources?.creem_api_key || 'unset',
      creem_api_base_url: config.creem_api_base_url,
      creem_checkout_path: config.creem_checkout_path,
      subrouter_base_url: config.subrouter_base_url,
      public_api_base_url: config.public_api_base_url,
      package_mappings: store.config.package_mappings || {},
    },
    code_stats: [...statsByPackage.values()],
    orders: store.orders.slice(-25).reverse(),
    subscriptions: store.subscriptions.slice(-25).reverse(),
    events: store.events.slice(-50).reverse(),
  };
}

function pushEvent(store, type, detail) {
  store.events.push({ id: id('evt'), type, detail, created_at: now() });
  if (store.events.length > 500) store.events = store.events.slice(-500);
}

function normalizeCodes(input) {
  if (Array.isArray(input)) return input;
  return String(input || '')
    .split(/\r?\n|,|\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function productIdFromPackage(body, mapping) {
  const mappedProductId = String(mapping.creem_product_id || '').trim();
  if (mappedProductId) return mappedProductId;
  return String(
    body.creem_product_id ||
    body.product_id ||
    body.creemProductId ||
    body.creem_product ||
    '',
  ).trim();
}

function stringId(value) {
  if (value && typeof value === 'object') {
    return String(value.id || value.checkout_id || value.order_id || value.product_id || '').trim();
  }
  return String(value || '').trim();
}

function checkoutPayload({ order, productId, returnUrl }) {
  return {
    product_id: productId,
    request_id: order.id,
    units: 1,
    success_url: returnUrl,
    metadata: {
      order_id: order.id,
      package_id: order.package_id,
      subrouter_user_id: order.user_id,
    },
  };
}

function checkoutReturnUrl(rawReturnUrl, order, req) {
  const fallback = `${req.headers.origin || ''}/packages?checkout_status=success`;
  const value = rawReturnUrl || fallback;
  try {
    const parsed = new URL(value, `http://${req.headers.host || 'localhost'}`);
    if (!parsed.searchParams.get('checkout_status') && !parsed.searchParams.get('status') && !parsed.searchParams.get('payment')) {
      parsed.searchParams.set('checkout_status', 'success');
    }
    parsed.searchParams.set('order_id', order.id);
    parsed.searchParams.set('request_id', order.id);
    return parsed.toString();
  } catch {
    const separator = String(value).includes('?') ? '&' : '?';
    return `${value}${separator}checkout_status=success&order_id=${encodeURIComponent(order.id)}&request_id=${encodeURIComponent(order.id)}`;
  }
}

async function createCreemCheckout(store, { order, productId, returnUrl }) {
  const config = getConfig(store);
  const creemApiKey = requireHeaderSafeSecret(
    'Creem API key',
    config.creem_api_key,
    config._sources?.creem_api_key || 'configuration',
  );
  const url = new URL(config.creem_checkout_path, config.creem_api_base_url).toString();
  const payload = checkoutPayload({ order, productId, returnUrl });
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': creemApiKey,
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  let json = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }
  if (!response.ok) {
    const message = json.message || json.error || json.raw || response.statusText || 'unknown error';
    throw new Error(`Creem checkout failed with HTTP ${response.status}: ${String(message).slice(0, 300)}`);
  }
  const data = json.data || json;
  const checkoutUrl = data.checkout_url || data.url || data.pay_link;
  if (!checkoutUrl) throw new Error('Creem response did not include checkout_url');
  return { raw: json, checkout_url: checkoutUrl, checkout_id: data.id || data.checkout_id || '' };
}

async function retrieveCreemCheckout(store, checkoutId) {
  const cleanCheckoutId = String(checkoutId || '').trim();
  if (!cleanCheckoutId) return null;
  const config = getConfig(store);
  const creemApiKey = requireHeaderSafeSecret(
    'Creem API key',
    config.creem_api_key,
    config._sources?.creem_api_key || 'configuration',
  );
  const url = new URL(config.creem_checkout_path, config.creem_api_base_url);
  url.searchParams.set('checkout_id', cleanCheckoutId);
  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'x-api-key': creemApiKey,
    },
  });

  const text = await response.text();
  let json = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }
  if (!response.ok) {
    const message = json.message || json.error || json.raw || response.statusText || 'unknown error';
    throw new Error(`Creem checkout lookup failed with HTTP ${response.status}: ${String(message).slice(0, 300)}`);
  }
  return json.data || json;
}

function verifyCreemRedirectSignature(params, apiKey) {
  const signature = String(params.signature || '').trim();
  if (!signature) return false;
  const signedKeys = ['checkout_id', 'order_id', 'customer_id', 'subscription_id', 'product_id', 'request_id'];
  const payload = signedKeys
    .map((key) => [key, String(params[key] || '').trim()])
    .filter(([, value]) => value)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('&');
  if (!payload) return false;
  const expected = crypto.createHmac('sha256', apiKey).update(payload).digest('hex');
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function verifyWebhook(rawBody, req, secret) {
  if (!secret) return true;
  const header = String(
    req.headers['creem-signature'] ||
    req.headers['x-creem-signature'] ||
    req.headers['webhook-signature'] ||
    req.headers['x-signature'] ||
    '',
  );
  if (!header) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const candidates = header
    .split(',')
    .map((part) => part.trim().replace(/^sha256=/i, '').replace(/^v1=/i, ''))
    .filter(Boolean);
  return candidates.some((candidate) => {
    const a = Buffer.from(candidate);
    const b = Buffer.from(expected);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  });
}

function getMetadata(event) {
  return {
    ...(event.metadata || {}),
    ...(event.data?.metadata || {}),
    ...(event.object?.metadata || {}),
    ...(event.data?.object?.metadata || {}),
    ...(event.order?.metadata || {}),
    ...(event.data?.order?.metadata || {}),
    ...(event.data?.object?.order?.metadata || {}),
    ...(event.checkout?.metadata || {}),
    ...(event.data?.checkout?.metadata || {}),
    ...(event.data?.object?.checkout?.metadata || {}),
  };
}

function isPaidEvent(event) {
  const type = String(event.eventType || event.event_type || event.type || '').toLowerCase();
  const object = event.data?.object || event.object || {};
  const order = event.order || event.data?.order || object.order || {};
  const checkout = event.checkout || event.data?.checkout || object.checkout || {};
  const subscription = event.subscription || event.data?.subscription || object.subscription || {};
  const status = String(
    event.status ||
    event.payment_status ||
    order.status ||
    order.payment_status ||
    checkout.status ||
    checkout.payment_status ||
    subscription.status ||
    event.data?.status ||
    event.data?.payment_status ||
    object.status ||
    object.payment_status ||
    '',
  ).toLowerCase();
  return type.includes('paid') ||
    type.includes('completed') ||
    type.includes('succeeded') ||
    type.includes('success') ||
    type === 'subscription.active' ||
    status === 'paid' ||
    status === 'completed' ||
    status === 'succeeded' ||
    status === 'active' ||
    status === 'confirmed' ||
    status === 'complete' ||
    status === 'success';
}

function webhookOrderCandidates(event) {
  const metadata = getMetadata(event);
  return [
    metadata.order_id,
    event.request_id,
    event.data?.request_id,
    event.object?.request_id,
    event.checkout?.request_id,
    event.data?.checkout?.request_id,
    event.data?.object?.request_id,
    event.data?.object?.checkout?.request_id,
    event.order?.request_id,
    event.data?.order?.request_id,
    event.data?.object?.order?.request_id,
    event.checkout_id,
    event.data?.checkout_id,
    event.object?.checkout_id,
    event.data?.object?.checkout_id,
    event.checkout?.id,
    event.data?.checkout?.id,
    event.data?.object?.checkout?.id,
    event.data?.object?.id,
  ].filter(Boolean).map((value) => String(value));
}

function getWebhookOrder(store, event) {
  const candidates = webhookOrderCandidates(event);
  return store.orders.find((order) => (
    candidates.includes(order.id) ||
    (order.checkout_id && candidates.includes(String(order.checkout_id)))
  )) || null;
}

function orderActivationEvent(order) {
  return {
    type: 'checkout_return_sync',
    request_id: order.id,
    checkout_id: order.checkout_id,
    status: 'completed',
    metadata: {
      order_id: order.id,
      package_id: order.package_id,
      subrouter_user_id: order.user_id,
    },
  };
}

function findSyncOrder(store, { orderId, checkoutId, requestId, userId }) {
  const candidates = [orderId, requestId, checkoutId].filter(Boolean).map(String);
  if (candidates.length) {
    const exact = store.orders.find((order) => (
      (!userId || String(order.user_id) === String(userId)) &&
      (
        candidates.includes(String(order.id)) ||
        (order.checkout_id && candidates.includes(String(order.checkout_id)))
      )
    ));
    if (exact) return exact;
  }

  return store.orders
    .filter((order) => (
      (!userId || String(order.user_id) === String(userId)) &&
      ['pending', 'checkout_created', 'needs_code'].includes(String(order.status || '').toLowerCase())
    ))
    .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())[0] || null;
}

async function syncCheckoutActivation(store, { userId, orderId, checkoutId, requestId, params = {}, requirePaid = true, source = 'checkout_return' }) {
  const order = findSyncOrder(store, { orderId, checkoutId, requestId, userId });
  if (!order) {
    pushEvent(store, 'checkout_sync_order_missing', { user_id: userId, order_id: orderId || '', checkout_id: checkoutId || '', request_id: requestId || '', source });
    return { status: 'not_found', message: 'No matching checkout order found' };
  }

  if (String(order.status || '').toLowerCase() === 'activated') {
    return { status: 'activated', success: true, order_id: order.id, already_activated: true };
  }

  const config = getConfig(store);
  const cleanCheckoutId = checkoutId || order.checkout_id || '';
  const cleanRequestId = requestId || order.id;
  let paymentConfirmed = false;
  let confirmationSource = '';
  let checkout = null;

  const creemApiKey = String(config.creem_api_key || '').trim();
  if (creemApiKey && verifyCreemRedirectSignature({ ...params, checkout_id: cleanCheckoutId, request_id: cleanRequestId }, creemApiKey)) {
    paymentConfirmed = true;
    confirmationSource = 'redirect_signature';
  }

  if (!paymentConfirmed && cleanCheckoutId) {
    checkout = await retrieveCreemCheckout(store, cleanCheckoutId);
    if (checkout && isPaidEvent({ ...checkout, checkout })) {
      paymentConfirmed = true;
      confirmationSource = 'checkout_lookup';
    }
  }

  if (!paymentConfirmed && !requirePaid) {
    paymentConfirmed = true;
    confirmationSource = 'trusted_event';
  }

  if (!paymentConfirmed) {
    pushEvent(store, 'checkout_sync_pending', { order_id: order.id, checkout_id: cleanCheckoutId, user_id: userId, source });
    return {
      status: 'pending',
      order_id: order.id,
      message: 'Payment is not confirmed yet',
    };
  }

  if (cleanCheckoutId && !order.checkout_id) order.checkout_id = cleanCheckoutId;
  order.payment_confirmed_at = order.payment_confirmed_at || now();
  order.payment_confirmation_source = confirmationSource;
  order.updated_at = now();

  const event = checkout
    ? {
      ...checkout,
      type: source,
      checkout_id: cleanCheckoutId,
      request_id: cleanRequestId,
      metadata: {
        ...getMetadata(checkout),
        order_id: order.id,
        package_id: order.package_id,
        subrouter_user_id: order.user_id,
      },
    }
    : orderActivationEvent(order);
  const result = await activateSubscriptionCycle(store, { order, event });
  pushEvent(store, 'checkout_sync_processed', {
    order_id: order.id,
    checkout_id: cleanCheckoutId,
    user_id: userId,
    source,
    confirmation_source: confirmationSource,
    success: result.success,
    message: result.message || '',
  });

  return {
    ...result,
    status: result.success ? 'activated' : (result.pending ? 'pending' : order.status || 'failed'),
    order_id: order.id,
    checkout_id: cleanCheckoutId,
  };
}

async function syncPendingPaidCheckouts(store, userId) {
  const candidates = store.orders
    .filter((order) => (
      String(order.user_id) === String(userId) &&
      String(order.checkout_id || '').trim() &&
      ['pending', 'checkout_created', 'needs_code'].includes(String(order.status || '').toLowerCase())
    ))
    .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
    .slice(0, 3);

  for (const order of candidates) {
    const result = await syncCheckoutActivation(store, {
      userId,
      orderId: order.id,
      checkoutId: order.checkout_id,
      requestId: order.id,
      params: {},
      requirePaid: true,
      source: 'checkout_background_sync',
    });
    if (result.success) return result;
  }

  return { status: 'pending', message: 'No paid checkout is ready to activate' };
}

function getSubscriptionId(event, order) {
  const subscription = stringId(event.subscription || event.object?.subscription || event.data?.subscription || event.data?.object?.subscription);
  return String(
    event.subscription_id ||
    event.data?.subscription_id ||
    event.object?.subscription_id ||
    event.data?.object?.subscription_id ||
    subscription ||
    order?.checkout_id ||
    order?.id ||
    '',
  );
}

function periodEndFromEvent(event) {
  const value = event.current_period_end ||
    event.data?.current_period_end ||
    event.object?.current_period_end ||
    event.data?.object?.current_period_end ||
    event.period_end ||
    event.data?.period_end;
  if (value) return value;
  const subscription = event.subscription || event.data?.subscription || event.object?.subscription || event.data?.object?.subscription || {};
  const subscriptionPeriodEnd = subscription.current_period_end_date ||
    subscription.current_period_end ||
    subscription.period_end ||
    subscription.next_renewal_time;
  if (subscriptionPeriodEnd) return subscriptionPeriodEnd;
  return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
}

async function redeemSubRouterCode(store, { userId, code }) {
  const config = getConfig(store);
  const url = subRouterRequestUrl('/api/dist/topup/redeem', config);
  const headers = {
    'Content-Type': 'application/json',
    'New-Api-User': String(userId),
    ...siteForwardHeaders(config),
  };
  if (config.subrouter_internal_token) {
    headers.Authorization = `Bearer ${config.subrouter_internal_token}`;
  }
  const response = await requestJson(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ key: code }),
  });
  const success = response.ok && (response.data.success === true || response.data.message === 'success');
  return { success, status: response.status, data: response.data };
}

async function subscribeSubRouterPackage(store, { userId, packageId }) {
  const config = getConfig(store);
  const url = subRouterRequestUrl('/api/dist/package/subscribe', config);
  const headers = {
    'Content-Type': 'application/json',
    'New-Api-User': String(userId),
    ...siteForwardHeaders(config),
  };
  if (config.subrouter_internal_token) {
    headers.Authorization = `Bearer ${config.subrouter_internal_token}`;
  }
  const response = await requestJson(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ package_id: packageId }),
  });
  const success = response.ok && (response.data.success === true || response.data.message === 'success');
  return { success, status: response.status, data: response.data };
}

async function activateSubscriptionCycle(store, { order, event }) {
  if (!order) return { success: false, message: 'Order not found' };
  if (String(order.status || '').toLowerCase() === 'activated') {
    return { success: true, already_activated: true };
  }
  if (activatingOrders.has(order.id)) {
    return { success: false, pending: true, message: 'Order activation is already in progress' };
  }
  activatingOrders.add(order.id);
  try {
    const metadata = getMetadata(event);
    const packageId = metadata.package_id || order.package_id;
    const userId = metadata.subrouter_user_id || order.user_id;
    const subscriptionId = getSubscriptionId(event, order) || `${userId}:${packageId}`;

    const code = store.codes.find((item) => item.package_id === packageId && item.status === 'available');
    if (!code) {
      pushEvent(store, 'code_pool_empty', { package_id: packageId, user_id: userId, order_id: order.id });
      order.status = 'needs_code';
      order.error = 'No available internal code for package';
      order.updated_at = now();
      upsertSubscription(store, {
        user_id: userId,
        package_id: packageId,
        subscription_id: subscriptionId,
        status: 'needs_code',
        order_id: order.id,
      });
      return { success: false, message: 'No available internal code for package' };
    }

    code.status = 'reserved';
    code.assigned_to = userId;
    code.subscription_id = subscriptionId;
    code.reserved_at = now();

    const redeemResult = await redeemSubRouterCode(store, { userId, code: code.code });
    if (redeemResult.success) {
      code.status = 'balance_redeemed';
      code.redeemed_at = now();
      pushEvent(store, 'balance_code_redeemed', { package_id: packageId, user_id: userId, order_id: order.id, code_id: code.id });

      const subscribeResult = await subscribeSubRouterPackage(store, { userId, packageId });
      if (!subscribeResult.success) {
        code.status = 'subscribe_failed';
        code.subscribe_error = subscribeResult.data?.message || subscribeResult.data?.error || `HTTP ${subscribeResult.status}`;
        upsertSubscription(store, {
          user_id: userId,
          package_id: packageId,
          subscription_id: subscriptionId,
          status: 'package_subscribe_failed',
          order_id: order.id,
          last_code_id: code.id,
          current_period_end: periodEndFromEvent(event),
          next_renewal_time: periodEndFromEvent(event),
        });
        order.status = 'package_subscribe_failed';
        order.error = code.subscribe_error;
        order.updated_at = now();
        pushEvent(store, 'package_subscribe_failed', { package_id: packageId, user_id: userId, order_id: order.id, code_id: code.id, error: code.subscribe_error });
        return { success: false, message: code.subscribe_error, balance_redeemed: true };
      }

      code.status = 'subscribed';
      code.subscribed_at = now();
      upsertSubscription(store, {
        user_id: userId,
        package_id: packageId,
        subscription_id: subscriptionId,
        status: 'active',
        order_id: order.id,
        last_code_id: code.id,
        current_period_end: periodEndFromEvent(event),
        next_renewal_time: periodEndFromEvent(event),
      });
      order.status = 'activated';
      order.error = '';
      order.updated_at = now();
      pushEvent(store, 'package_subscribed', { package_id: packageId, user_id: userId, order_id: order.id, code_id: code.id });
      return { success: true };
    }

    code.status = 'redeem_failed';
    code.redeem_error = redeemResult.data?.message || redeemResult.data?.error || `HTTP ${redeemResult.status}`;
    upsertSubscription(store, {
      user_id: userId,
      package_id: packageId,
      subscription_id: subscriptionId,
      status: 'redeem_failed',
      order_id: order.id,
      last_code_id: code.id,
      current_period_end: periodEndFromEvent(event),
      next_renewal_time: periodEndFromEvent(event),
    });
    order.status = 'redeem_failed';
    order.error = code.redeem_error;
    order.updated_at = now();
    pushEvent(store, 'redeem_failed', { package_id: packageId, user_id: userId, order_id: order.id, code_id: code.id, error: code.redeem_error });
    return { success: false, message: code.redeem_error };
  } finally {
    activatingOrders.delete(order.id);
  }
}

function upsertSubscription(store, input) {
  let sub = store.subscriptions.find((item) => item.subscription_id === input.subscription_id);
  if (!sub) {
    sub = {
      id: id('sub'),
      created_at: now(),
      current_period_start: now(),
    };
    store.subscriptions.push(sub);
  }
  Object.assign(sub, input, {
    updated_at: now(),
    current_period_end: input.current_period_end || sub.current_period_end || null,
    next_renewal_time: input.next_renewal_time || sub.next_renewal_time || null,
  });
  return sub;
}

function orderCanBeManuallyActivated(order) {
  return order && !['activated'].includes(String(order.status || '').toLowerCase());
}

export async function handleSiteSaasRequest(req, res) {
  if (req.method === 'OPTIONS') return sendJson(res, 204, {});

  const url = new URL(req.url, `http://${req.headers.host}`);
  const raw = await readRawBody(req);
  let body = {};
  if (raw.length) {
    try {
      body = parseJson(raw);
    } catch {
      return sendJson(res, 400, { success: false, message: 'Invalid JSON body' });
    }
  }

  const store = await loadStore();

  try {
    if (url.pathname === '/api/site/saas/health') {
      return sendJson(res, 200, { success: true, data: { ok: true, time: now() } });
    }

    if (url.pathname === '/api/site/saas/public-config' && req.method === 'GET') {
      const config = getConfig(store);
      return sendJson(res, 200, {
        success: true,
        data: {
          public_api_base_url: config.public_api_base_url,
        },
      });
    }

    if (url.pathname === '/api/site/saas/playground-proxy' && req.method === 'POST') {
      const apiPath = normalizePlaygroundPath(body.path || body.endpoint);
      if (!apiPath) return sendJson(res, 400, { success: false, message: 'Unsupported Playground API path' });
      const auth = String(req.headers.authorization || '').trim();
      if (!/^Bearer\s+\S+/i.test(auth)) {
        return sendJson(res, 401, { success: false, message: 'Missing Playground API key' });
      }
      const payload = body.body && typeof body.body === 'object' ? body.body : {};
      const config = getConfig(store);
      const targetUrl = buildPlaygroundProxyUrl(config, apiPath);
      const useSiteHeaders = !isExternalPlaygroundApiBase(config.public_api_base_url);
      try {
        const upstream = await requestRaw(targetUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: auth,
            ...(useSiteHeaders ? siteForwardHeaders(config) : {}),
          },
          body: JSON.stringify(payload),
        });
        const responseHeaders = {
          'Content-Type': upstream.contentType,
          'Cache-Control': 'no-store',
        };
        if (upstream.contentDisposition) responseHeaders['Content-Disposition'] = upstream.contentDisposition;
        return sendRaw(res, upstream.status, responseHeaders, upstream.buffer);
      } catch (error) {
        return sendJson(res, 502, {
          success: false,
          message: error?.name === 'AbortError'
            ? 'Playground proxy timed out while waiting for the API response'
            : `Playground proxy failed: ${error.message || 'network error'}`,
        });
      }
    }

    if (url.pathname === '/api/site/admin/saas/state' && req.method === 'GET') {
      if (!requireAdmin(req)) return sendJson(res, 401, { success: false, message: 'Invalid site admin token' });
      return sendJson(res, 200, { success: true, data: publicState(store) });
    }

    if (url.pathname === '/api/site/admin/saas/config' && req.method === 'PUT') {
      if (!requireAdmin(req)) return sendJson(res, 401, { success: false, message: 'Invalid site admin token' });
      const keys = [
        'creem_api_key',
        'creem_api_base_url',
        'creem_checkout_path',
        'creem_webhook_secret',
        'subrouter_base_url',
        'public_api_base_url',
        'subrouter_internal_token',
        'site_public_url',
        'subrouter_site_host',
      ];
      for (const key of keys) {
        if (Object.prototype.hasOwnProperty.call(body, key)) {
          store.config[key] = String(body[key] || '').trim();
        }
      }
      if (body.package_mappings && typeof body.package_mappings === 'object') {
        store.config.package_mappings = body.package_mappings;
      }
      pushEvent(store, 'config_updated', { keys: Object.keys(body) });
      await saveStore(store);
      return sendJson(res, 200, { success: true, data: publicState(store) });
    }

    if (url.pathname === '/api/site/admin/saas/codes/import' && req.method === 'POST') {
      if (!requireAdmin(req)) return sendJson(res, 401, { success: false, message: 'Invalid site admin token' });
      const packageId = String(body.package_id || '').trim();
      if (!packageId) return sendJson(res, 400, { success: false, message: 'package_id is required' });
      const codes = normalizeCodes(body.codes);
      const existing = new Set(store.codes.map((item) => item.code));
      let imported = 0;
      for (const code of codes) {
        if (existing.has(code)) continue;
        store.codes.push({
          id: id('code'),
          package_id: packageId,
          code,
          status: 'available',
          created_at: now(),
        });
        existing.add(code);
        imported += 1;
      }
      pushEvent(store, 'codes_imported', { package_id: packageId, imported });
      await saveStore(store);
      return sendJson(res, 200, { success: true, data: { imported, state: publicState(store) } });
    }

    if (url.pathname === '/api/site/admin/saas/orders/activate' && req.method === 'POST') {
      if (!requireAdmin(req)) return sendJson(res, 401, { success: false, message: 'Invalid site admin token' });
      const orderId = String(body.order_id || '').trim();
      if (!orderId) return sendJson(res, 400, { success: false, message: 'order_id is required' });
      const order = store.orders.find((item) => item.id === orderId);
      if (!order) return sendJson(res, 404, { success: false, message: 'Order not found' });
      if (!orderCanBeManuallyActivated(order)) {
        return sendJson(res, 400, { success: false, message: `Order ${orderId} is already activated` });
      }

      const result = await activateSubscriptionCycle(store, {
        order,
        event: {
          type: 'manual_activation',
          metadata: {
            order_id: order.id,
            package_id: order.package_id,
            subrouter_user_id: order.user_id,
          },
        },
      });
      pushEvent(store, 'manual_activation_processed', { order_id: order.id, package_id: order.package_id, success: result.success, message: result.message || '' });
      await saveStore(store);
      return sendJson(res, result.success ? 200 : 202, { success: result.success, data: result, state: publicState(store) });
    }

    if (url.pathname === '/api/site/saas/subscriptions' && req.method === 'GET') {
      const userId = userIdFromRequest(req);
      if (!userId) return sendJson(res, 401, { success: false, message: 'Missing SubRouter user id' });
      const subscriptions = store.subscriptions.filter((item) => String(item.user_id) === userId);
      return sendJson(res, 200, { success: true, data: subscriptions });
    }

    if (url.pathname === '/api/site/saas/checkout/sync' && req.method === 'POST') {
      const userId = userIdFromRequest(req);
      if (!userId) return sendJson(res, 401, { success: false, message: 'Missing SubRouter user id' });
      const params = body.params && typeof body.params === 'object' ? body.params : body;
      const checkoutId = String(body.checkout_id || params.checkout_id || url.searchParams.get('checkout_id') || '').trim();
      const orderId = String(body.order_id || params.order_id || url.searchParams.get('order_id') || '').trim();
      const requestId = String(body.request_id || params.request_id || url.searchParams.get('request_id') || '').trim();
      try {
        const result = orderId || checkoutId || requestId
          ? await syncCheckoutActivation(store, {
            userId,
            orderId,
            checkoutId,
            requestId,
            params,
            requirePaid: true,
            source: 'checkout_return_sync',
          })
          : await syncPendingPaidCheckouts(store, userId);
        await saveStore(store);
        return sendJson(res, result.success ? 200 : 202, { success: Boolean(result.success), data: result, message: result.message });
      } catch (error) {
        pushEvent(store, 'checkout_sync_failed', { user_id: userId, order_id: orderId, checkout_id: checkoutId, request_id: requestId, error: error.message });
        await saveStore(store);
        return sendJson(res, 202, { success: false, message: error.message, data: { status: 'sync_failed' } });
      }
    }

    if (url.pathname === '/api/site/saas/checkout' && req.method === 'POST') {
      const userId = userIdFromRequest(req);
      if (!userId) return sendJson(res, 401, { success: false, message: 'Please sign in before subscribing' });
      const packageId = String(body.package_id || '').trim();
      if (!packageId) return sendJson(res, 400, { success: false, message: 'package_id is required' });
      const mapping = store.config.package_mappings?.[packageId] || {};
      const productId = productIdFromPackage(body, mapping);
      if (!productId) {
        return sendJson(res, 400, {
          success: false,
          message: `Creem product id is not configured for package ${packageId}. Add the matching prod_... value in /site-admin/saas.`,
        });
      }

      const order = {
        id: id('ord'),
        user_id: userId,
        package_id: packageId,
        package_name: body.package_name || '',
        creem_product_id: productId,
        status: 'pending',
        created_at: now(),
      };
      store.orders.push(order);
      await saveStore(store);

      const returnUrl = checkoutReturnUrl(body.return_url, order, req);
      try {
        const checkout = await createCreemCheckout(store, {
          order,
          productId,
          returnUrl,
        });
        order.status = 'checkout_created';
        order.checkout_id = checkout.checkout_id;
        order.checkout_url = checkout.checkout_url;
        order.updated_at = now();
        pushEvent(store, 'checkout_created', { order_id: order.id, package_id: packageId, user_id: userId });
        await saveStore(store);
        return sendJson(res, 200, { success: true, data: { checkout_url: checkout.checkout_url, order_id: order.id } });
      } catch (error) {
        order.status = 'checkout_failed';
        order.error = error.message;
        order.updated_at = now();
        pushEvent(store, 'checkout_failed', { order_id: order.id, package_id: packageId, error: error.message });
        await saveStore(store);
        return sendJson(res, 500, { success: false, message: error.message });
      }
    }

    if (url.pathname === '/api/site/saas/webhooks/creem' && req.method === 'POST') {
      const config = getConfig(store);
      if (!verifyWebhook(raw, req, config.creem_webhook_secret)) {
        pushEvent(store, 'webhook_signature_failed', {
          type: body.type || body.eventType || body.event_type,
          headers: {
            creem_signature: Boolean(req.headers['creem-signature']),
            x_creem_signature: Boolean(req.headers['x-creem-signature']),
            webhook_signature: Boolean(req.headers['webhook-signature']),
            x_signature: Boolean(req.headers['x-signature']),
          },
        });
        await saveStore(store);
        return sendJson(res, 401, { success: false, message: 'Invalid webhook signature' });
      }
      const eventId = body.id || body.event_id || body.data?.id || id('wh');
      if (store.events.some((event) => event.type === 'webhook_processed' && event.detail?.event_id === eventId)) {
        return sendJson(res, 200, { success: true, data: { duplicate: true } });
      }
      if (!isPaidEvent(body)) {
        pushEvent(store, 'webhook_ignored', { event_id: eventId, type: body.type || body.eventType || body.event_type });
        await saveStore(store);
        return sendJson(res, 200, { success: true, data: { ignored: true } });
      }
      let order = getWebhookOrder(store, body);
      if (!order) {
        const metadata = getMetadata(body);
        const orderUserId = metadata.subrouter_user_id || metadata.user_id || body.user_id || body.data?.user_id || '';
        const checkoutId = String(webhookOrderCandidates(body).find((candidate) => store.orders.some((item) => (
          String(item.checkout_id) === candidate &&
          (!orderUserId || String(item.user_id) === String(orderUserId))
        ))) || '').trim();
        order = findSyncOrder(store, {
          orderId: metadata.order_id || '',
          checkoutId,
          requestId: body.request_id || body.data?.request_id || body.object?.request_id || '',
          userId: orderUserId,
        });
      }
      if (!order) {
        pushEvent(store, 'webhook_order_missing', {
          event_id: eventId,
          type: body.type || body.eventType || body.event_type,
          candidates: webhookOrderCandidates(body),
        });
        await saveStore(store);
        return sendJson(res, 202, { success: false, message: 'Order not found for webhook metadata' });
      }
      const result = await activateSubscriptionCycle(store, { order, event: body });
      pushEvent(store, 'webhook_processed', { event_id: eventId, order_id: order.id, success: result.success });
      await saveStore(store);
      return sendJson(res, result.success ? 200 : 202, { success: result.success, data: result });
    }

    return sendJson(res, 404, { success: false, message: 'Not found' });
  } catch (error) {
    pushEvent(store, 'server_error', { message: error.message, path: url.pathname });
    await saveStore(store);
    return sendJson(res, 500, { success: false, message: error.message });
  }
}

export function startSiteSaasServer() {
  return createServer(handleSiteSaasRequest).listen(port, '0.0.0.0', () => {
    console.log(`Site SaaS backend listening on http://127.0.0.1:${port}`);
    console.log(`Store: ${storePath}`);
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  startSiteSaasServer();
}
