import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Auto-recover when a new deployment updates chunk hashes
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault();
  const reloadKey = 'vite_preload_retry';
  const lastReload = sessionStorage.getItem(reloadKey);
  const now = Date.now();

  // Prevent infinite loops: reload at most once every 10 seconds
  if (!lastReload || now - parseInt(lastReload, 10) > 10000) {
    sessionStorage.setItem(reloadKey, now.toString());
    window.location.reload();
  }
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

