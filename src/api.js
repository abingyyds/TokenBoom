import axios from 'axios';
import toast from 'react-hot-toast';

export const Q = 500000; // QuotaPerUnit — single source of truth

const previewModels = [
  { id: 'preview-1', model_name: 'gpt-4o-mini', display_name: 'GPT-4o Mini', input_price: 0.00015, output_price: 0.0006, cache_read_price: 0.000075, cache_creation_price: 0.00015, status: 'healthy', enabled: true },
  { id: 'preview-2', model_name: 'claude-sonnet-4-5', display_name: 'Claude Sonnet 4.5', input_price: 0.003, output_price: 0.015, cache_read_price: 0.0003, cache_creation_price: 0.00375, cache_creation_price_1h: 0.006, status: 'healthy', enabled: true },
  { id: 'preview-3', model_name: 'gemini-2.5-pro', display_name: 'Gemini 2.5 Pro', input_price: 0.00125, output_price: 0.005, cache_read_price: 0.00031, cache_creation_price: 0.00125, status: 'healthy', enabled: true },
  { id: 'preview-4', model_name: 'deepseek-chat', display_name: 'DeepSeek Chat', input_price: 0.00014, output_price: 0.00028, cache_read_price: 0.000014, cache_creation_price: 0.00014, status: 'healthy', enabled: true },
  { id: 'preview-5', model_name: 'qwen-max', display_name: 'Qwen Max', input_price: 0.0016, output_price: 0.0064, cache_read_price: 0.00016, cache_creation_price: 0.0016, status: 'healthy', enabled: true },
  { id: 'preview-6', model_name: 'grok-4', display_name: 'Grok 4', input_price: 0.003, output_price: 0.015, cache_read_price: 0.00075, cache_creation_price: 0.003, status: 'healthy', enabled: true },
  { id: 'preview-7', model_name: 'claude-haiku-4-5', display_name: 'Claude Haiku 4.5', input_price: 0.0008, output_price: 0.004, cache_read_price: 0.00008, cache_creation_price: 0.001, cache_creation_price_1h: 0.0016, status: 'healthy', enabled: true },
  { id: 'preview-8', model_name: 'gpt-5-mini', display_name: 'GPT-5 Mini', input_price: 0.00025, output_price: 0.002, cache_read_price: 0.000025, cache_creation_price: 0.00025, status: 'healthy', enabled: true },
];

const previewMarketplaceModels = previewModels.map((model, index) => ({
  ...model,
  rank: index + 1,
  category: index === 2 ? 'multimodal' : 'chat',
  request_count: [1842000, 1295000, 981000, 812000, 620000, 451000, 389000, 335000][index],
  token_usage: [8200000000, 6700000000, 4400000000, 3100000000, 2800000000, 1900000000, 1400000000, 1200000000][index],
  probe_score: [99.1, 98.4, 97.8, 96.3, 95.2, 94.1, 93.7, 92.9][index],
  rating: [4.9, 4.8, 4.7, 4.6, 4.5, 4.4, 4.4, 4.3][index],
  availability: 'online',
}));

const previewPackages = [
  {
    id: 'preview-basic',
    name: 'Launch',
    description: 'For solo builders shipping AI features with predictable monthly usage.',
    price: 29,
    original_price: 39,
    currency: 'USD',
    billing_interval: 'month',
    creem_product_id: 'prod_launch_monthly',
    duration: 30,
    quota_amount: Q * 35,
    quota_reset_period: 'monthly',
    enabled: true,
  },
  {
    id: 'preview-pro',
    name: 'Scale',
    description: 'For production teams that need higher throughput, priority access, and renewal-safe credits.',
    price: 99,
    original_price: 129,
    currency: 'USD',
    billing_interval: 'month',
    creem_product_id: 'prod_scale_monthly',
    duration: 30,
    quota_amount: Q * 140,
    quota_reset_period: 'monthly',
    enabled: true,
  },
  {
    id: 'preview-team',
    name: 'Enterprise',
    description: 'For high-volume workspaces with governance, dedicated onboarding, and custom limits.',
    price: 299,
    original_price: 399,
    currency: 'USD',
    billing_interval: 'month',
    creem_product_id: 'prod_enterprise_monthly',
    duration: 30,
    quota_amount: Q * 500,
    quota_reset_period: 'monthly',
    enabled: true,
  },
];

const getPreviewTheme = () => {
  if (!import.meta.env.DEV || typeof window === 'undefined') return '';
  return new URLSearchParams(window.location.search).get('preview_theme') || '';
};

const shouldUseDevMock = () =>
  import.meta.env.DEV && import.meta.env.VITE_USE_BACKEND !== 'true';

const previewResponse = (data) => Promise.resolve({ data: { success: true, data } });

const previewSite = (theme = 'saas') => ({
  name: 'AstraLayer',
  theme_template: theme || 'saas',
  enable_topup: true,
  top_up_link: 'https://example.com/redeem-codes',
  allow_sub_dist: false,
  currency: {
    code: 'USD',
    symbol: '$',
    exchange_rate: 1,
    usd_exchange_rate: 7,
  },
});

const devPublicResponse = (requestFn, data) =>
  shouldUseDevMock() ? previewResponse(data) : requestFn();

const PUBLIC_CACHE_TTL_MS = 5 * 60 * 1000;
const publicRequestCache = new Map();
const PUBLIC_REQUEST_TIMEOUT_MS = 6000;
export const AUTH_RESTORE_TIMEOUT_MS = 8000;
const DIST_USER_ID_KEY = 'dist_user_id';

const isHeaderSafeValue = (value) => {
  const text = String(value ?? '').trim();
  if (!text || /[\r\n]/.test(text)) return false;
  for (let i = 0; i < text.length; i += 1) {
    if (text.charCodeAt(i) > 255) return false;
  }
  return true;
};

const isAllowedEmptyHeaderValue = (value) =>
  value === undefined || value === null || value === false;

const isHeaderValueSafe = (value) => {
  if (isAllowedEmptyHeaderValue(value)) return true;
  const values = Array.isArray(value) ? value : [value];
  return values.every(isHeaderSafeValue);
};

const deleteHeader = (headers, key) => {
  if (!headers) return;
  if (typeof headers.delete === 'function') {
    headers.delete(key);
    return;
  }
  delete headers[key];
};

const setHeader = (headers, key, value) => {
  if (!headers) return;
  if (typeof headers.set === 'function') {
    headers.set(key, value);
    return;
  }
  headers[key] = value;
};

const sanitizeHeaders = (headers) => {
  if (!headers) return headers;
  const snapshot = typeof headers.toJSON === 'function' ? headers.toJSON() : headers;
  Object.entries(snapshot).forEach(([key, value]) => {
    if (!isHeaderValueSafe(value)) {
      deleteHeader(headers, key);
    }
  });
  return headers;
};

const readStoredUserId = () => {
  const userId = localStorage.getItem(DIST_USER_ID_KEY);
  if (!userId) return '';
  const trimmed = userId.trim();
  if (!isHeaderSafeValue(trimmed)) {
    localStorage.removeItem(DIST_USER_ID_KEY);
    return '';
  }
  return trimmed;
};

export const syncStoredUserId = (user) => {
  const id = user?.id ?? user?.user_id;
  if (id === undefined || id === null || id === '') return;
  const normalizedId = String(id).trim();
  if (isHeaderSafeValue(normalizedId)) {
    localStorage.setItem(DIST_USER_ID_KEY, normalizedId);
  } else {
    localStorage.removeItem(DIST_USER_ID_KEY);
  }
};

export const clearStoredUserId = () => {
  localStorage.removeItem(DIST_USER_ID_KEY);
};

const normalizeUserId = (value) => {
  const normalizedId = String(value ?? '').trim();
  return isHeaderSafeValue(normalizedId) ? normalizedId : '';
};

export const userRequestConfig = (user, config = {}) => {
  const userId = normalizeUserId(user?.id ?? user?.user_id) || readStoredUserId();
  const headers = { ...(config.headers || {}) };
  if (userId) {
    headers['New-Api-User'] = userId;
  }
  return {
    ...config,
    headers,
  };
};

const stableCacheKey = (value) => {
  if (Array.isArray(value)) {
    return `[${value.map(stableCacheKey).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${key}:${stableCacheKey(value[key])}`).join(',')}}`;
  }
  return String(value);
};

const cachedPublicRequest = (key, requestFn, ttlMs = PUBLIC_CACHE_TTL_MS) => {
  const now = Date.now();
  const cached = publicRequestCache.get(key);
  if (cached?.result && cached.expiresAt > now) {
    return Promise.resolve(cached.result);
  }
  if (cached?.promise) {
    return cached.promise;
  }

  const promise = requestFn()
    .then((result) => {
      publicRequestCache.set(key, {
        result,
        expiresAt: Date.now() + ttlMs,
      });
      return result;
    })
    .catch((error) => {
      publicRequestCache.delete(key);
      throw error;
    });

  publicRequestCache.set(key, { promise });
  return promise;
};

const api = axios.create({
  baseURL: '',
  timeout: 30000,
  withCredentials: true, // CRITICAL: send session cookies on every request
  withXSRFToken: false,
  xsrfCookieName: null,
  xsrfHeaderName: null,
  headers: { 'Content-Type': 'application/json' },
});

// Attach New-Api-User header (required by backend auth middleware)
api.interceptors.request.use((config) => {
  const userId = readStoredUserId();
  if (userId) {
    setHeader(config.headers, 'New-Api-User', userId);
  }
  sanitizeHeaders(config.headers);
  return config;
});

const shouldSkipErrorHandler = (config) => Boolean(config?.skipErrorHandler);

// Global error handler
api.interceptors.response.use(
  (res) => {
    // Handle success:false responses with user-visible errors
    if (
      res.data &&
      res.data.success === false &&
      res.data.message &&
      !shouldSkipErrorHandler(res.config)
    ) {
      toast.error(res.data.message);
    }
    return res;
  },
  (err) => {
    const msg = err.response?.data?.message || err.message || 'Request failed';
    if (err.response?.status === 401) {
      clearStoredUserId();
      // Emit event so AuthContext can clear React state
      window.dispatchEvent(new Event('auth:logout'));
      if (!shouldSkipErrorHandler(err.config)) {
        toast.error('Session expired, please log in again');
      }
    } else if (!shouldSkipErrorHandler(err.config)) {
      toast.error(msg);
    }
    return Promise.reject(err);
  }
);

// ===== Public =====
export const getSiteInfo = () => {
  const theme = getPreviewTheme();
  if (theme) {
    return previewResponse(previewSite(theme));
  }
  return cachedPublicRequest('site-info', () => devPublicResponse(
    () => api.get('/api/dist/site/info', {
      timeout: PUBLIC_REQUEST_TIMEOUT_MS,
      skipErrorHandler: true,
    }),
    previewSite('saas'),
  ));
};
export const getSitePublicConfig = () => (shouldUseDevMock()
  ? previewResponse({})
  : api.get('/api/site/saas/public-config', {
    timeout: PUBLIC_REQUEST_TIMEOUT_MS,
    skipErrorHandler: true,
  }));
export const getSiteModels = () => {
  const theme = getPreviewTheme();
  return cachedPublicRequest(`site-models:${theme || 'default'}:${shouldUseDevMock()}`, () => (
    theme
      ? previewResponse(previewModels)
      : devPublicResponse(
        () => api.get('/api/dist/site/models', {
          timeout: PUBLIC_REQUEST_TIMEOUT_MS,
          skipErrorHandler: true,
        }),
        previewModels,
      )
  ));
};
export const getMarketplaceModels = (params = {}) => cachedPublicRequest(
  `marketplace-models:${shouldUseDevMock()}:${stableCacheKey(params)}`,
  () => (shouldUseDevMock()
    ? previewResponse(previewMarketplaceModels)
    : api.get('/api/marketplace/models', {
      params,
      timeout: PUBLIC_REQUEST_TIMEOUT_MS,
      skipErrorHandler: true,
    })),
);
export const getPublicPricing = () => cachedPublicRequest(
  'public-pricing',
  () => (shouldUseDevMock()
    ? previewResponse([])
    : api.get('/api/pricing', {
      timeout: PUBLIC_REQUEST_TIMEOUT_MS,
      skipErrorHandler: true,
    })),
);
export const getSitePricing = () => cachedPublicRequest('site-pricing', () => (shouldUseDevMock()
  ? previewResponse([])
  : api.get('/api/dist/site/pricing', {
    timeout: PUBLIC_REQUEST_TIMEOUT_MS,
    skipErrorHandler: true,
  })));
export const getSitePackages = () => {
  const theme = getPreviewTheme();
  return cachedPublicRequest(`site-packages:${theme || 'default'}:${shouldUseDevMock()}`, () => (
    theme
      ? previewResponse(previewPackages)
      : devPublicResponse(
        () => api.get('/api/dist/site/packages', {
          timeout: PUBLIC_REQUEST_TIMEOUT_MS,
          skipErrorHandler: true,
        }),
        previewPackages,
      )
  ));
};
export const getSiteKeyGroups = () => (shouldUseDevMock()
  ? previewResponse([])
  : api.get('/api/dist/site/key-groups'));
export const getSiteKeyGroupPricing = (id) => api.get(`/api/dist/site/key-groups/${id}/pricing`);
export const getSubDistributorInfo = () => (shouldUseDevMock()
  ? previewResponse({})
  : api.get('/api/dist/site/sub-distributor/info'));

// ===== Auth =====
export const register = (data) => api.post('/api/dist/user/register', data);
export const login = (data) => api.post('/api/dist/user/login', data);
export const logout = () => api.post('/api/dist/user/logout');

// ===== User =====
export const getUserSelf = (config) => api.get('/api/dist/user/self', config);
export const getUserUsage = () => api.get('/api/dist/user/usage');
export const getUserLogs = (params) => api.get('/api/dist/user/logs', { params });
export const getUserLogsStat = (params) => api.get('/api/dist/user/logs/stat', { params });
export const getUserTasks = (params) => api.get('/api/dist/user/tasks', { params });
export const getUserMjTasks = (params) => api.get('/api/dist/user/mj', { params });

// ===== Tokens =====
export const getTokens = () => api.get('/api/dist/token/list');
export const getTokenSupportedModels = (id) => api.get(`/api/dist/token/${id}/models`);
export const createToken = (data) => api.post('/api/dist/token/create', data);
export const updateToken = (id, data) => api.put(`/api/dist/token/${id}`, data);
export const deleteToken = (id) => api.delete(`/api/dist/token/${id}`);

// ===== Purchase =====
export const redeemCode = (key) => api.post('/api/dist/topup/redeem', { key }); // backend field is "key"
export const subscribePackage = (packageId, config) => api.post('/api/dist/package/subscribe', { package_id: packageId }, config);
export const getActiveSubscriptions = (config) =>
  api.get('/api/dist/package/subscriptions', config);
// ===== Online Topup =====
export const getTopupInfo = () => api.get('/api/dist/topup/info');
export const calculateAmount = (data) => api.post('/api/dist/topup/amount', data);
export const createEpayOrder = (data) => api.post('/api/dist/topup/pay', data);
export const createStripeOrder = (data) => api.post('/api/dist/topup/stripe/pay', data);
export const createCreemOrder = (data) => api.post('/api/dist/topup/creem/pay', data);
export const createCryptoOrder = (data) => api.post('/api/dist/topup/crypto/pay', data);
export const getCryptoOrderStatus = (tradeNo) => api.get(`/api/dist/topup/crypto/status?trade_no=${tradeNo}`);
export const getTopupHistory = (params) => api.get('/api/dist/topup/history', { params });

// ===== Site-owned SaaS billing =====
// These endpoints belong to this distributor site, not to SubRouter.
// The site SaaS backend owns Creem checkout, webhook handling, and redemption code pools.
export const getSiteSaasSubscriptions = (config) =>
  api.get('/api/site/saas/subscriptions', config);
export const createSiteSaasCheckout = (data, config) =>
  api.post('/api/site/saas/checkout', data, config);
export const getSiteSaasAdminState = (token) =>
  api.get('/api/site/admin/saas/state', {
    skipErrorHandler: true,
    headers: { 'X-Site-Admin-Token': token },
  });
export const updateSiteSaasAdminConfig = (token, data) =>
  api.put('/api/site/admin/saas/config', data, {
    skipErrorHandler: true,
    headers: { 'X-Site-Admin-Token': token },
  });
export const importSiteSaasCodes = (token, data) =>
  api.post('/api/site/admin/saas/codes/import', data, {
    skipErrorHandler: true,
    headers: { 'X-Site-Admin-Token': token },
  });

// ===== Affiliate / Invitation =====
export const getAffCode = () => api.get('/api/dist/aff');
export const transferAffQuota = (data) => api.post('/api/dist/aff_transfer', data);
export const getAffEarnings = (params) => api.get('/api/dist/aff_earnings', { params });
export const getAffPayouts = (params) => api.get('/api/dist/aff_payouts', { params });
export const requestAffWithdraw = (data) => api.post('/api/dist/aff_withdraw', data);
export const submitDistKolApply = (data) => api.post('/api/dist/kol_apply', data);
export const getDistKolStatus = () => api.get('/api/dist/kol_status');
export const createSubDistributorOrder = (data) => api.post('/api/dist/site/sub-distributor/pay', data);

// ===== Helpers =====
export const quotaToDollar = (quota) => (quota / Q).toFixed(4);
export const quotaToDollar6 = (quota) => (quota / Q).toFixed(6);

export default api;
