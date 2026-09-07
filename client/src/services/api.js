import axios from 'axios';

const apiUrl = import.meta.env.VITE_API_URL || (import.meta.env.PROD
  ? 'https://cafe-app-n8mn.onrender.com/api'
  : '/api');

const api = axios.create({
  baseURL: apiUrl,
  timeout: 35000,
  headers: { 'Content-Type': 'application/json' },
});

// Retry config — retry idempotent GET requests on transient 5xx or network/timeout errors (NOT on 429)
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

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

    const isTimeoutOrNetwork =
      !error.response ||
      error.code === 'ECONNABORTED' ||
      error.message?.toLowerCase().includes('timeout');

    const is5xx = status >= 500 && status < 600;

    // Only retry GET requests on 5xx or network/timeout (NOT 429 — retrying rate-limit makes it worse)
    const shouldRetry =
      config &&
      config.method?.toLowerCase() === 'get' &&
      (is5xx || isTimeoutOrNetwork) &&
      config._retryCount < MAX_RETRIES;

    if (shouldRetry) {
      config._retryCount += 1;
      const delay = RETRY_DELAY_MS * config._retryCount;
      await sleep(delay);
      return api(config);
    }

    // Normalize error message
    const data = error.response?.data;
    let msg = data?.error || error.message || 'Network error. Please try again.';
    if (error.code === 'ECONNABORTED' || error.message?.toLowerCase().includes('timeout')) {
      msg = 'The server took too long to respond. Please check your connection or try again.';
    }

    const err = new Error(msg);
    if (data?.code) err.code = data.code;
    err.status = status;
    return Promise.reject(err);
  }
);

export default api;
