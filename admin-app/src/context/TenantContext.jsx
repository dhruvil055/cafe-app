import { createContext, useContext, useEffect, useState } from 'react';
import api from '../services/api';

const Context = createContext(null);
const fallback = { name: 'Café', logoUrl: '', primaryColor: '#c96b18', accentColor: '#1a0f08' };

export function TenantProvider({ children }) {
  const [tenant, setTenant] = useState(fallback);
  const [tenantError, setTenantError] = useState(null);

  useEffect(() => {
    let active = true;
    api.get('/tenant/public').then(({ data }) => {
      if (!active) return;
      setTenant(data.tenant);
      setTenantError(null);
      document.title = `${data.tenant.name} · Admin`;
      document.documentElement.style.setProperty('--tenant-primary', data.tenant.primaryColor || '#c96b18');
      document.documentElement.style.setProperty('--tenant-accent', data.tenant.accentColor || '#1a0f08');
    }).catch((error) => {
      if (!active) return;
      const status = error.response?.status;
      const message = error.response?.data?.error || 'Café not found.';
      if (status === 423) {
        setTenantError({ status: 423, title: 'Café Account Suspended', message });
      } else if (status === 404) {
        // When on localhost or generic admin domain, fallback cleanly without blocking the login screen
        setTenant(fallback);
        setTenantError(null);
      }
    });
    return () => { active = false; };
  }, []);

  if (tenantError) {
    return (
      <main id="admin-tenant-error" role="main" className="flex min-h-screen flex-col items-center justify-center bg-stone-900 px-6 text-center text-stone-100">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/20 text-2xl text-amber-400">
          ⚠️
        </div>
        <h1 className="font-serif text-2xl font-bold">{tenantError.title}</h1>
        <p className="mt-2 max-w-sm text-sm text-stone-400">{tenantError.message}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-6 rounded-full bg-amber-500 px-5 py-2 text-xs font-semibold text-stone-900 transition hover:bg-amber-400"
        >
          Reload
        </button>
      </main>
    );
  }

  return <Context.Provider value={tenant}>{children}</Context.Provider>;
}

export const useTenant = () => useContext(Context) || fallback;
