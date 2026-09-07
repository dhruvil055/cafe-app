import axios from 'axios';
import { env } from '../config/env';

const api = axios.create({
  baseURL: env.apiUrl,
  timeout: 35000,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const legacyToken = localStorage.getItem('brewhaus_admin_token');
  if (legacyToken && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${legacyToken}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.error || error.message || 'Request failed';
    return Promise.reject(new Error(message));
  }
);

export default api;
