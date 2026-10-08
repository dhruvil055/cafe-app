import { clearClientCache } from './menuCache';

/**
 * Safely extracts tenantId from a signed table QR token's payload (base64url JSON)
 * without validating the cryptographic signature (the server validates the signature).
 */
export function extractTenantFromTableToken(token) {
  if (!token || typeof token !== 'string') return null;
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const base64 = parts[0].replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const parsed = JSON.parse(json);
    return parsed.tenantId || null;
  } catch {
    return null;
  }
}

/**
 * Client-side tenant slug / ID resolver.
 * Priority order:
 * 1. URL search params (?cafe=..., ?cafeId=..., ?tenant=..., ?slug=...)
 * 2. URL tableToken payload claims (if present)
 * 3. Subdomain (e.g. velvet.localhost or velvet.cafe.domain.com)
 * 4. Session storage cache from current active tab session
 *
 * If a URL parameter points to a new/different café, this immediately busts
 * the client-side cache and resets session state for complete tenant isolation.
 */
export function getResolvedTenantSlug() {
  if (typeof window === 'undefined') return '';

  try {
    const params = new URLSearchParams(window.location.search);
    let urlTenant = (
      params.get('cafe') ||
      params.get('cafeId') ||
      params.get('tenant') ||
      params.get('slug') ||
      ''
    ).trim();

    if (!urlTenant) {
      const token = params.get('tableToken');
      if (token) {
        const extracted = extractTenantFromTableToken(token);
        if (extracted) urlTenant = extracted;
      }
    }

    if (urlTenant) {
      const normalized = urlTenant.toLowerCase();
      const currentCached = (sessionStorage.getItem('cafe_tenant_slug') || '').toLowerCase();

      // If opening a QR code / URL for a DIFFERENT café, bust all stale client cache
      if (currentCached && currentCached !== normalized) {
        clearClientCache();
        try {
          sessionStorage.removeItem('cafe_table_token');
          sessionStorage.removeItem('cafe_table_number');
          sessionStorage.removeItem('cafe_tenant_id');
        } catch { /* ignore */ }
      }

      sessionStorage.setItem('cafe_tenant_slug', normalized);
      return normalized;
    }

    const host = window.location.hostname.toLowerCase();
    if (host.endsWith('.localhost')) {
      const prefix = host.slice(0, -'.localhost'.length);
      if (prefix && prefix !== 'admin' && prefix !== 'www' && prefix !== 'cafe' && !prefix.includes('.')) {
        sessionStorage.setItem('cafe_tenant_slug', prefix);
        return prefix;
      }
    }

    // Check custom multi-tenant subdomain
    const parts = host.split('.');
    if (parts.length > 2 && parts[0] !== 'www' && parts[0] !== 'admin' && parts[0] !== 'cafe') {
      const sub = parts[0];
      sessionStorage.setItem('cafe_tenant_slug', sub);
      return sub;
    }

    // Retain tenant context across page navigation within the same tab session only
    const cached = sessionStorage.getItem('cafe_tenant_slug');
    if (cached) return cached;
  } catch {
    // ignore
  }

  return '';
}

export function setResolvedTenantSlug(slug) {
  if (!slug || typeof window === 'undefined') return;
  try {
    sessionStorage.setItem('cafe_tenant_slug', String(slug).toLowerCase().trim());
  } catch {
    // ignore
  }
}

export function getResolvedTenantId() {
  if (typeof window === 'undefined') return '';
  try {
    return sessionStorage.getItem('cafe_tenant_id') || '';
  } catch {
    return '';
  }
}

export function setResolvedTenantId(id) {
  if (!id || typeof window === 'undefined') return;
  try {
    sessionStorage.setItem('cafe_tenant_id', String(id).trim());
  } catch {
    // ignore
  }
}

export const getTenantSlug = getResolvedTenantSlug;

