import axios from 'axios';

const apiUrl = import.meta.env.VITE_API_URL || (import.meta.env.PROD
  ? 'https://cafe-app-n8mn.onrender.com/api'
  : '/api');

const api = axios.create({
  baseURL: apiUrl,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Retry config — only retry on transient 5xx server errors, NOT on 429
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 500;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

api.interceptors.request.use((config) => {
  config._retryCount = config._retryCount ?? 0;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;
    const status = error.response?.status;

    // Only retry GET requests on 5xx server errors (NOT 429 — retrying rate-limit makes it worse)
    const shouldRetry =
      config &&
      config.method === 'get' &&
      status >= 500 &&
      status < 600 &&
      config._retryCount < MAX_RETRIES;

    if (shouldRetry) {
      config._retryCount += 1;
      const delay = RETRY_DELAY_MS * config._retryCount;
      await sleep(delay);
      return api(config);
    }

    // Normalize error message
    const data = error.response?.data;
    const msg = data?.error || error.message || 'Network error. Please try again.';
    const err = new Error(msg);
    if (data?.code) err.code = data.code;
    err.status = status;
    return Promise.reject(err);
  }
);

export default api;
