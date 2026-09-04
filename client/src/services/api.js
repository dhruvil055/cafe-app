import axios from 'axios';

const apiUrl = import.meta.env.VITE_API_URL || (import.meta.env.PROD
  ? 'https://cafe-app-n8mn.onrender.com/api'
  : '/api');

const api = axios.create({
  baseURL: apiUrl,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Response interceptor — normalize errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const msg = error.response?.data?.error || error.message || 'Network error. Please try again.';
    return Promise.reject(new Error(msg));
  }
);

export default api;
