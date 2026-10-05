import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import { TenantNotFoundScreen, TenantSuspendedScreen } from '../components/ui/TenantErrorState';

const TenantContext = createContext(null);
const fallback = { name: 'Café', currency: 'INR', taxRate: 5, primaryColor: '#c96b18', accentColor: '#1a0f08' };

export function TenantProvider({ children }) {
  const [tenant, setTenant] = useState(fallback);
  const [tenantState, setTenantState] = useState({ status: 'loading', message: '' });

  useEffect(() => {
    let active = true;
    api.get('/tenant/public')
      .then(({ data }) => {
        if (!active) return;
        const settings = data.tenant;
        setTenant(settings);
        setTenantState({ status: 'active', message: '' });
        document.title = `${settings.name} | Order Online`;
        if (settings.primaryColor) {
          document.documentElement.style.setProperty('--tenant-primary', settings.primaryColor);
        }
        if (settings.accentColor) {
          document.documentElement.style.setProperty('--tenant-accent', settings.accentColor);
        }
      })
      .catch((error) => {
        if (!active) return;
        const statusCode = error.response?.status;
        const errorCode = error.response?.data?.code;
        const errorMessage = error.response?.data?.error;

        if (statusCode === 423 || errorCode === 'TENANT_SUSPENDED') {
          setTenantState({ status: 'suspended', message: errorMessage || 'This café account is suspended.' });
          document.title = 'Café Suspended | Online Ordering Paused';
        } else if (statusCode === 404 || errorCode === 'TENANT_NOT_FOUND') {
          setTenantState({ status: 'not_found', message: errorMessage || 'Café not found.' });
          document.title = 'Café Not Found';
        } else {
          // Network hiccup or dev environment fallback
          setTenantState({ status: 'active', message: '' });
        }
      });
    return () => { active = false; };
  }, []);

  const value = useMemo(() => tenant, [tenant]);

  if (tenantState.status === 'suspended') {
    return <TenantSuspendedScreen message={tenantState.message} />;
  }

  if (tenantState.status === 'not_found') {
    return <TenantNotFoundScreen message={tenantState.message} />;
  }

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export const useTenant = () => useContext(TenantContext) || fallback;
