import axios from 'axios';

const apiUrl = import.meta.env.VITE_API_URL || (import.meta.env.PROD
  ? 'https://cafe-app-n8mn.onrender.com/api'
  : '/api');

const api = axios.create({
  baseURL: apiUrl,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Response interceptor — normalize errors, preserve backend error code
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const data = error.response?.data;
    const msg = data?.error || error.message || 'Network error. Please try again.';
    const err = new Error(msg);
    // Preserve backend session error codes (SESSION_EXPIRED, SESSION_INVALID, etc.)
    if (data?.code) err.code = data.code;
    err.status = error.response?.status;
    return Promise.reject(err);
  }
);

export default api;
