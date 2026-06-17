export const trimTrailingSlash = (value) => String(value || '').replace(/\/+$/, '');

export const normalizePublicApiBaseUrl = (value) => {
  const text = trimTrailingSlash(value).trim();
  if (!text) return '';
  return text;
};

const getBrowserOrigin = () => (
  typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin
    : ''
);

const configuredApiBaseUrl = normalizePublicApiBaseUrl(import.meta.env.VITE_PUBLIC_API_BASE_URL);

const getDefaultApiBaseUrl = () => {
  if (configuredApiBaseUrl) return configuredApiBaseUrl;
  const origin = getBrowserOrigin();
  if (origin) return `${origin}/v1`;
  return `https://${['api', 'subrouter', 'com'].join('.')}/v1`;
};

export const PUBLIC_API_BASE_URL = getDefaultApiBaseUrl();
export const PUBLIC_API_ORIGIN = (() => {
  try {
    return new URL(PUBLIC_API_BASE_URL).origin;
  } catch {
    return trimTrailingSlash(PUBLIC_API_BASE_URL.replace(/\/v1(?:\/.*)?$/, ''));
  }
})();
export const PUBLIC_API_HOST = (() => {
  try {
    return new URL(PUBLIC_API_BASE_URL).host;
  } catch {
    return '';
  }
})();
export const INVALID_WEBSITE_API_BASE_URL = trimTrailingSlash(getBrowserOrigin() || `https://${['subrouter', 'com'].join('.')}`);
