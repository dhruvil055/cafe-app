import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import { TenantNotFoundScreen, TenantSuspendedScreen } from '../components/ui/TenantErrorState';
import { getResolvedTenantSlug, setResolvedTenantSlug, setResolvedTenantId } from '../utils/tenantHelper';
import { clearClientCache } from '../utils/menuCache';

const TenantContext = createContext(null);
const fallback = { name: 'Café', currency: 'INR', taxRate: 5, primaryColor: '#c96b18', accentColor: '#1a0f08' };

export function TenantProvider({ children }) {
  const [tenant, setTenant] = useState(fallback);
  const [tenantState, setTenantState] = useState({ status: 'loading', message: '' });

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token') || params.get('tableToken');
    const cafeSlug = params.get('cafeSlug') || params.get('cafe') || params.get('cafeId');
    const tableSlug = params.get('tableSlug') || params.get('table') || params.get('tableId');

    const resolveEndpoint = () => {
      if (token) {
        return api.get('/public/cafes/resolve', { params: { token } });
      }
      if (cafeSlug && tableSlug) {
        return api.get('/public/cafes/resolve', { params: { cafeSlug, tableSlug } });
      }
      if (cafeSlug) {
        return api.get(`/public/cafes/${encodeURIComponent(cafeSlug)}`);
      }
      const cachedSlug = getResolvedTenantSlug();
      if (cachedSlug) {
        return api.get(`/public/cafes/${encodeURIComponent(cachedSlug)}`);
      }
      // Direct URL manipulation with no params or invalid params: do NOT load default cafe!
      return Promise.reject({
        response: {
          status: 404,
          data: {
            success: false,
            error: {
              code: 'QR_NOT_FOUND',
              message: 'QR code was not found or is no longer valid.',
            },
          },
        },
      });
    };

    resolveEndpoint()
      .then(({ data }) => {
        if (!active) return;
        const cafeData = data.data?.cafe || data.data || data.tenant;
        const tableData = data.data?.table;
        const qrData = data.data?.qr;

        if (!cafeData) {
          setTenantState({ status: 'not_found', message: 'Café not found.' });
          return;
        }

        const prevSlug = getResolvedTenantSlug();
        if (prevSlug && prevSlug !== cafeData.slug) {
          clearClientCache();
        }

        const normalizedTenant = {
          id: cafeData.id || cafeData._id,
          name: cafeData.name,
          slug: cafeData.slug,
          logo: cafeData.logo || cafeData.settings?.logoUrl || '',
          logoUrl: cafeData.logoUrl || cafeData.logo || cafeData.settings?.logoUrl || '',
          tagline: cafeData.description || cafeData.settings?.tagline || '',
          primaryColor: cafeData.branding?.primaryColor || cafeData.settings?.primaryColor || '#c96b18',
          accentColor: cafeData.branding?.secondaryColor || cafeData.settings?.accentColor || '#1a0f08',
          currency: cafeData.settings?.currency || 'INR',
          taxRate: cafeData.settings?.taxRate ?? 5,
          address: cafeData.settings?.address || '',
          contactPhone: cafeData.settings?.contactPhone || '',
          contactEmail: cafeData.settings?.contactEmail || '',
          openingHours: cafeData.settings?.openingHours || {},
        };

        setTenant(normalizedTenant);
        setResolvedTenantSlug(cafeData.slug);
        setResolvedTenantId(cafeData.id || cafeData._id);

        if (tableData) {
          try {
            sessionStorage.setItem('cafe_table_number', String(tableData.number));
            sessionStorage.setItem('cafe_table_id', String(tableData.id));
            if (qrData?.token) {
              sessionStorage.setItem('cafe_table_token', String(qrData.token));
            }
          } catch {
            // Ignore sessionStorage access errors
          }
        }

        setTenantState({ status: 'active', message: '' });
        document.title = `${normalizedTenant.name} | Order Online`;
        if (normalizedTenant.primaryColor) {
          document.documentElement.style.setProperty('--tenant-primary', normalizedTenant.primaryColor);
        }
        if (normalizedTenant.accentColor) {
          document.documentElement.style.setProperty('--tenant-accent', normalizedTenant.accentColor);
        }
      })
      .catch((error) => {
        if (!active) return;
        clearClientCache();
        const statusCode = error.response?.status;
        const errObj = error.response?.data?.error;
        const errorCode = typeof errObj === 'object' ? errObj?.code : error.response?.data?.code;
        const errorMessage =
          typeof errObj === 'object'
            ? errObj?.message
            : error.response?.data?.error || 'QR code was not found or is no longer valid.';

        if (statusCode === 410 || errorCode === 'QR_EXPIRED' || statusCode === 423 || errorCode === 'TENANT_SUSPENDED') {
          setTenantState({ status: 'suspended', message: errorMessage });
          document.title = 'Café Suspended | Online Ordering Paused';
        } else {
          setTenantState({ status: 'not_found', message: errorMessage });
          document.title = 'Café Not Found';
        }
      });

    return () => {
      active = false;
    };
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
