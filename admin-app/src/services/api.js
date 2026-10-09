import axios from 'axios';
import { env } from '../config/env';
import { getAccessToken, setAccessToken } from './accessToken';

const api = axios.create({
  baseURL: env.apiUrl,
  timeout: 35000,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

let refreshPromise = null;

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  const activeBranchId = localStorage.getItem('activeBranchId');
  if (activeBranchId && !config.headers['X-Branch-Id'] && !config.headers['x-branch-id']) {
    config.headers['X-Branch-Id'] = activeBranchId;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    // 429 Rate Limit Interceptor: extract Retry-After and provide a friendly countdown message
    if (error.response?.status === 429) {
      const retryAfterHeader = error.response.headers?.['retry-after'];
      const retryAfterSec =
        Number(retryAfterHeader) ||
        Number(error.response.data?.retryAfterSeconds) ||
        Number(error.response.data?.retryAfter) ||
        60;

      const friendlyMsg =
        error.response.data?.message ||
        error.response.data?.error ||
        `Too many attempts. Please try again in ${retryAfterSec} seconds.`;

      const normalized = new Error(friendlyMsg);
      normalized.code = 'RATE_LIMITED';
      normalized.status = 429;
      normalized.retryAfter = retryAfterSec;
      normalized.response = error.response;
      return Promise.reject(normalized);
    }

    if (error.response?.status === 401) {
      const config = error.config;
      const requestUrl = String(config?.url || '');
      const isAuthRequest = ['/auth/login', '/auth/refresh', '/auth/logout', '/auth/me', '/platform/auth'].some((path) =>
        requestUrl.includes(path)
      );

      if (config && !config._refreshAttempted && !isAuthRequest) {
        config._refreshAttempted = true;
        try {
          refreshPromise ||= api.post('/auth/refresh').then(({ data }) => {
            setAccessToken(data.token);
            return data.token;
          }).finally(() => {
            refreshPromise = null;
          });
          const token = await refreshPromise;
          config.headers.Authorization = `Bearer ${token}`;
          return api(config);
        } catch {
          setAccessToken(null);
        }
      }

      const publicPaths = ['/login', '/signup', '/super-admin'];
      // Avoid redirecting or hard-reloading when already on a public route, or when checking /auth/me on initial boot
      if (
        typeof window !== 'undefined' &&
        !publicPaths.some((p) => window.location.pathname.startsWith(p)) &&
        !requestUrl.includes('/auth/me')
      ) {
        window.location.href = '/login';
      }
    }

    const message = error.response?.data?.error || error.message || 'Request failed';
    const normalized = new Error(message);
    normalized.code = error.response?.data?.code;
    normalized.status = error.response?.status;
    normalized.response = error.response;
    return Promise.reject(normalized);
  }
);

// Share one in-flight GET per URL, and cache responses when ttlMs > 0 to eliminate duplicate bootstrap fetches
const inflight = new Map();
const cache = new Map();

export const getOnce = (url, ttlMs = 0) => {
  const now = Date.now();
  if (ttlMs > 0 && cache.has(url)) {
    const entry = cache.get(url);
    if (entry.expiresAt > now) {
      return Promise.resolve(entry.data);
    }
    cache.delete(url);
  }

  if (!inflight.has(url)) {
    const promise = api.get(url).then((res) => {
      if (ttlMs > 0) {
        cache.set(url, { data: res, expiresAt: Date.now() + ttlMs });
      }
      return res;
    }).finally(() => {
      inflight.delete(url);
    });
    inflight.set(url, promise);
  }
  return inflight.get(url);
};

export const clearApiCache = (url) => {
  if (url) cache.delete(url);
  else cache.clear();
};

export default api;
