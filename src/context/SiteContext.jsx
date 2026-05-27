import React, { createContext, useContext, useState, useEffect } from 'react';
import { getSiteInfo, getSitePublicConfig } from '../api';
import { PUBLIC_API_BASE_URL, normalizePublicApiBaseUrl } from '../constants/api';

const SiteContext = createContext(null);

const DEFAULT_SITE = {
  name: 'SubRouter',
  logo: '/sassai-logo.svg',
  favicon: '/favicon.png',
  theme_template: 'saas',
  enable_topup: true,
  top_up_link: '',
  allow_sub_dist: false,
  public_api_base_url: PUBLIC_API_BASE_URL,
  currency: {
    code: 'USD',
    symbol: '$',
    exchange_rate: 1,
    usd_exchange_rate: 7,
  },
};

const siteCacheKey = 'dist-site-info-cache-v1';

// Map theme template name → CSS class(es) to apply on <body>
const themeClassMap = {
  saas: 'theme-light theme-saas',
  starter: 'theme-light theme-starter',
  default: 'theme-light theme-starter',
  dark: 'theme-dark',
  minimal: 'theme-minimal',
  clean: 'theme-light',
  corporate: 'theme-light',
  claude: 'theme-light theme-claude',
  aurora: 'theme-light theme-aurora',
  terminal: 'theme-terminal',
  market: 'theme-light theme-market',
  maoqiu: 'theme-light theme-maoqiu',
};

function applyThemeClass(themeName) {
  const cls = themeClassMap[themeName] || '';
  document.body.className = cls + (cls ? ' ' : '') + 'antialiased';
  try { localStorage.setItem('dist-theme-class', cls); } catch(e) {}
}

function getDevPreviewTheme() {
  if (!import.meta.env.DEV || typeof window === 'undefined') return '';
  return new URLSearchParams(window.location.search).get('preview_theme') || '';
}

function upsertMeta(name, content) {
  if (!content) return;
  let meta = document.querySelector(`meta[name="${name}"]`);
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = name;
    document.head.appendChild(meta);
  }
  meta.content = content;
}

function upsertLink(rel, href, attrs = {}) {
  if (!href) return;
  const sizesSelector = attrs.sizes ? `[sizes="${attrs.sizes}"]` : ':not([sizes])';
  let link = document.querySelector(`link[rel="${rel}"]${sizesSelector}`);
  if (!link) {
    link = document.createElement('link');
    document.head.appendChild(link);
  }
  link.rel = rel;
  link.href = href;
  Object.entries(attrs).forEach(([key, value]) => {
    if (value) link.setAttribute(key, value);
  });
}

function applySiteDocumentMeta(site) {
  const siteName = site?.name;
  const iconUrl = site?.favicon || site?.logo;

  if (siteName) {
    document.title = siteName;
    upsertMeta('application-name', siteName);
    upsertMeta('apple-mobile-web-app-title', siteName);
  }

  if (iconUrl) {
    upsertLink('icon', iconUrl);
    upsertLink('shortcut icon', iconUrl);
    upsertLink('apple-touch-icon', iconUrl);
    upsertLink('apple-touch-icon', iconUrl, { sizes: '180x180' });
  }

  upsertLink('manifest', '/site.webmanifest');
}

function getCachedSite() {
  try {
    const cached = JSON.parse(localStorage.getItem(siteCacheKey) || 'null');
    return cached && typeof cached === 'object' ? cached : null;
  } catch (e) {
    return null;
  }
}

function cacheSite(site) {
  try {
    localStorage.setItem(siteCacheKey, JSON.stringify(site));
  } catch (e) {}
}

function normalizeSite(data) {
  const publicDomain = typeof window !== 'undefined' ? window.location.origin : data?.domain;
  const publicApiBaseUrl = resolvePublicApiBaseUrl(data);
  return {
    ...DEFAULT_SITE,
    ...data,
    domain: publicDomain,
    public_api_base_url: publicApiBaseUrl,
    api_base_url: publicApiBaseUrl,
    logo: data?.logo || DEFAULT_SITE.logo,
    favicon: data?.favicon || DEFAULT_SITE.favicon,
    theme_template: data?.theme_template || DEFAULT_SITE.theme_template,
    currency: {
      ...DEFAULT_SITE.currency,
      ...(data?.currency || {}),
    },
  };
}

function parseCustomConfig(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function resolvePublicApiBaseUrl(data) {
  const config = parseCustomConfig(data?.custom_config);
  return normalizePublicApiBaseUrl(
    data?.public_api_base_url ||
    data?.api_base_url ||
    data?.apiBaseUrl ||
    data?.api_base ||
    data?.base_url ||
    config.public_api_base_url ||
    config.api_base_url ||
    config.apiBaseUrl ||
    config.apiBaseURL ||
    config.api_base ||
    config.base_url ||
    config.api?.base_url ||
    config.api?.baseUrl ||
    PUBLIC_API_BASE_URL,
  ) || PUBLIC_API_BASE_URL;
}

export function SiteProvider({ children }) {
  const [site, setSite] = useState(() => normalizeSite({
    ...(getCachedSite() || DEFAULT_SITE),
    theme_template: DEFAULT_SITE.theme_template,
  }));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const previewTheme = getDevPreviewTheme();
    if (previewTheme) {
      const previewSite = normalizeSite({
        ...DEFAULT_SITE,
        name: 'AstraLayer',
        theme_template: previewTheme,
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
      setSite(previewSite);
      applyThemeClass(previewTheme);
      applySiteDocumentMeta({ ...previewSite, name: `${previewSite.name} · ${previewTheme}` });
      return;
    }

    applyThemeClass(site.theme_template || DEFAULT_SITE.theme_template);
    applySiteDocumentMeta(site);

    Promise.all([
      getSiteInfo(),
      getSitePublicConfig().catch(() => null),
    ])
      .then(([res, publicConfigRes]) => {
        if (res.data.success) {
          const siteData = normalizeSite({
            ...res.data.data,
            ...(publicConfigRes?.data?.success ? publicConfigRes.data.data : {}),
            theme_template: DEFAULT_SITE.theme_template,
          });
          setSite(siteData);
          cacheSite(siteData);
          applyThemeClass(siteData.theme_template || DEFAULT_SITE.theme_template);
          applySiteDocumentMeta(siteData);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <SiteContext.Provider value={{ site, loading }}>
      {children}
    </SiteContext.Provider>
  );
}

export function useSite() {
  const ctx = useContext(SiteContext);
  if (!ctx) throw new Error('useSite must be used within SiteProvider');
  return ctx;
}

export function usePublicApiBaseUrl() {
  const { site } = useSite();
  return normalizePublicApiBaseUrl(site?.public_api_base_url || site?.api_base_url) || PUBLIC_API_BASE_URL;
}

/**
 * useCurrency - read site currency settings.
 * Returns { symbol, rate, code, fmt(usdValue) }.
 * fmt() converts a USD value into the display currency and formats it.
 */
export function useCurrency() {
  const { site } = useSite();
  const apiBaseUrl = normalizePublicApiBaseUrl(site?.public_api_base_url || site?.api_base_url) || PUBLIC_API_BASE_URL;
  const currency = site?.currency;
  const symbol = currency?.symbol || '$';
  const rate = currency?.exchange_rate || 1;
  const code = currency?.code || 'USD';
  const usdRate = currency?.usd_exchange_rate || 7;

  const fmt = (usdValue, decimals = 4) => {
    if (usdValue == null || isNaN(usdValue)) return '-';
    const converted = Number(usdValue) * rate;
    return symbol + converted.toFixed(decimals);
  };

  const fmtCNY = (cnyValue, decimals = 2) => {
    if (cnyValue == null || isNaN(cnyValue)) return '-';
    const v = Number(cnyValue);
    const converted = code === 'CNY' ? v : v / usdRate;
    return symbol + converted.toFixed(decimals);
  };

  const fmtPlanPrice = (value, packageCurrency, decimals = 2) => {
    if (value == null || isNaN(value)) return '-';
    const v = Number(value);
    if ((packageCurrency || '').toUpperCase() === 'USD') {
      return '$' + v.toFixed(decimals);
    }
    if (code === 'USD') {
      return '$' + (v / usdRate).toFixed(decimals);
    }
    return fmtCNY(v, decimals);
  };

  return { symbol, rate, code, fmt, fmtCNY, fmtPlanPrice, usdRate, apiBaseUrl };
}
