const HEADER_NAME_RE = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;
const installedKey = '__sassai_header_safety_installed__';

function isByteString(value) {
  const text = String(value ?? '');
  if (/[\r\n]/.test(text)) return false;
  for (let index = 0; index < text.length; index += 1) {
    if (text.charCodeAt(index) > 255) return false;
  }
  return true;
}

function isHeaderNameSafe(name) {
  return isByteString(name) && HEADER_NAME_RE.test(String(name || ''));
}

function isHeaderValueSafe(value) {
  if (value === undefined || value === null || value === false) return true;
  const values = Array.isArray(value) ? value : [value];
  return values.every(isByteString);
}

function safeHeaderPair(name, value) {
  return isHeaderNameSafe(name) && isHeaderValueSafe(value);
}

function sanitizeHeaderInit(init) {
  if (!init) return init;
  const entries = [];

  try {
    if (typeof Headers !== 'undefined' && init instanceof Headers) {
      init.forEach((value, name) => {
        if (safeHeaderPair(name, value)) entries.push([name, value]);
      });
      return entries;
    }

    if (Array.isArray(init)) {
      init.forEach((entry) => {
        if (!Array.isArray(entry)) return;
        const [name, value] = entry;
        if (safeHeaderPair(name, value)) entries.push([name, value]);
      });
      return entries;
    }

    if (typeof init[Symbol.iterator] === 'function') {
      Array.from(init).forEach((entry) => {
        if (!Array.isArray(entry)) return;
        const [name, value] = entry;
        if (safeHeaderPair(name, value)) entries.push([name, value]);
      });
      return entries;
    }

    if (typeof init === 'object') {
      Object.entries(init).forEach(([name, value]) => {
        if (safeHeaderPair(name, value)) entries.push([name, value]);
      });
      return entries;
    }
  } catch {
    return [];
  }

  return init;
}

function patchHeaders() {
  if (typeof window === 'undefined' || typeof window.Headers !== 'function') return;
  const NativeHeaders = window.Headers;

  class SafeHeaders extends NativeHeaders {
    constructor(init) {
      super();
      const safeInit = sanitizeHeaderInit(init);
      if (!safeInit) return;
      try {
        safeInit.forEach(([name, value]) => super.append(name, value));
      } catch {
        // Ignore malformed header input so browser ByteString conversion never aborts the request path.
      }
    }

    append(name, value) {
      if (!safeHeaderPair(name, value)) return;
      super.append(name, value);
    }

    set(name, value) {
      if (!safeHeaderPair(name, value)) return;
      super.set(name, value);
    }
  }

  window.Headers = SafeHeaders;
}

function sanitizeRequestInit(init) {
  if (!init || typeof init !== 'object' || !init.headers) return init;
  return {
    ...init,
    headers: sanitizeHeaderInit(init.headers),
  };
}

function patchFetch() {
  if (typeof window === 'undefined' || typeof window.fetch !== 'function') return;
  const nativeFetch = window.fetch.bind(window);
  window.fetch = (input, init) => nativeFetch(input, sanitizeRequestInit(init));
}

function patchRequest() {
  if (typeof window === 'undefined' || typeof window.Request !== 'function') return;
  const NativeRequest = window.Request;
  window.Request = class SafeRequest extends NativeRequest {
    constructor(input, init) {
      super(input, sanitizeRequestInit(init));
    }
  };
}

function patchXhr() {
  if (typeof XMLHttpRequest === 'undefined') return;
  const nativeSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
  if (typeof nativeSetRequestHeader !== 'function') return;

  XMLHttpRequest.prototype.setRequestHeader = function setSafeRequestHeader(name, value) {
    if (!safeHeaderPair(name, value)) return;
    return nativeSetRequestHeader.call(this, name, value);
  };
}

function cookieDomainCandidates() {
  if (typeof window === 'undefined') return [''];
  const hostname = window.location.hostname;
  const candidates = ['', hostname, `.${hostname}`];
  const parts = hostname.split('.').filter(Boolean);
  if (parts.length > 2) {
    const root = parts.slice(-2).join('.');
    candidates.push(root, `.${root}`);
  }
  return [...new Set(candidates)].filter(Boolean);
}

function expireCookie(name) {
  if (typeof document === 'undefined') return;
  const paths = ['/', window.location.pathname || '/'];
  const domains = ['', ...cookieDomainCandidates()];
  domains.forEach((domain) => {
    paths.forEach((path) => {
      document.cookie = `${name}=; Max-Age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=${path}${domain ? `; domain=${domain}` : ''}`;
    });
  });
}

function decodedCookieValue(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function clearUnsafeHeaderState() {
  try {
    const userId = window.localStorage?.getItem('dist_user_id');
    if (userId && !isHeaderValueSafe(userId)) {
      window.localStorage.removeItem('dist_user_id');
    }
  } catch {}

  if (typeof document === 'undefined' || !document.cookie) return;
  document.cookie.split(';').forEach((part) => {
    const [rawName, ...rawValueParts] = part.split('=');
    const name = rawName.trim();
    const value = decodedCookieValue(rawValueParts.join('='));
    if (!name) return;
    if (/xsrf|csrf|token|new-api-user|subrouter/i.test(name) && !isHeaderValueSafe(value)) {
      expireCookie(name);
    }
  });
}

export function installHeaderSafety() {
  if (typeof window === 'undefined' || window[installedKey]) return;
  window[installedKey] = true;
  clearUnsafeHeaderState();
  patchHeaders();
  patchRequest();
  patchFetch();
  patchXhr();
}

installHeaderSafety();
