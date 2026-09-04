const defaultApiUrl = import.meta.env.PROD
  ? 'https://cafe-app-n8mn.onrender.com/api'
  : 'http://localhost:5000/api';

export const env = {
  apiUrl: import.meta.env.VITE_API_URL || defaultApiUrl,
  customerUrl: import.meta.env.VITE_CUSTOMER_APP_URL || 'https://client-seven-sigma-26.vercel.app',
  adminUrl: import.meta.env.VITE_ADMIN_APP_URL || 'https://admin-app-delta-eight.vercel.app',
};
