import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { TenantProvider } from './context/TenantContext';
import { ThemeProvider } from './context/ThemeContext';
import './index.css';

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }, { once: true });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      {/* ThemeProvider for Super Admin routes */}
      <ThemeProvider>
        <AuthProvider>
          <TenantProvider><App /></TenantProvider>
          <Toaster
            position="top-center"
            toastOptions={{
              duration: 3000,
              style: {
                background: 'var(--popover-bg)',
                color: 'var(--text-primary)',
                borderRadius: '12px',
                fontSize: '14px',
                border: '1px solid var(--border-primary)',
              },
              success: { iconTheme: { primary: 'var(--success)', secondary: 'var(--text-inverse)' } },
              error: { iconTheme: { primary: 'var(--danger)', secondary: 'var(--text-inverse)' } },
            }}
          />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
);