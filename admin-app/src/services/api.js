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
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      const config = error.config;
      const requestUrl = String(config?.url || '');
      const isAuthRequest = ['/auth/login', '/auth/refresh', '/auth/logout'].some((path) => requestUrl.includes(path));
      if (config && !config._refreshAttempted && !isAuthRequest) {
        config._refreshAttempted = true;
        try {
          refreshPromise ||= api.post('/auth/refresh').then(({ data }) => {
            setAccessToken(data.token);
            return data.token;
          }).finally(() => { refreshPromise = null; });
          const token = await refreshPromise;
          config.headers.Authorization = `Bearer ${token}`;
          return api(config);
        } catch {
          setAccessToken(null);
        }
      }
      const publicPaths = ['/login', '/signup', '/super-admin'];
      if (typeof window !== 'undefined' && !publicPaths.some((p) => window.location.pathname.startsWith(p))) {
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

export default api;
