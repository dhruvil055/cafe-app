export const env = {
  apiUrl: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  customerUrl: import.meta.env.VITE_CUSTOMER_APP_URL || 'https://client-seven-sigma-26.vercel.app',
  adminUrl: import.meta.env.VITE_ADMIN_APP_URL || 'http://localhost:5174',
};
