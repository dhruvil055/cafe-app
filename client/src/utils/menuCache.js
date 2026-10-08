import { getTenantSlug } from './tenantHelper';

// Lightweight in-memory + sessionStorage cache for client-side API requests
const memoryCache = new Map();

export const DEFAULT_TTL_MS = 60 * 1000; // 1 minute default for menu queries
export const CATEGORIES_TTL_MS = 5 * 60 * 1000; // 5 minutes for categories

function getTenantPrefix() {
  const slug = getTenantSlug() || 'default';
  return `cafe_cache_${slug}_`;
}

export function getCached(key) {
  const now = Date.now();
  const slug = getTenantSlug() || 'default';
  const memKey = `${slug}:${key}`;

  // 1. Check in-memory cache
  const mem = memoryCache.get(memKey);
  if (mem && now - mem.timestamp < mem.ttl) {
    return mem.data;
  }

  // 2. Check sessionStorage
  try {
    const storageKey = `${getTenantPrefix()}${key}`;
    const raw = sessionStorage.getItem(storageKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && now - parsed.timestamp < parsed.ttl) {
        // Hydrate memory cache
        memoryCache.set(memKey, parsed);
        return parsed.data;
      } else {
        sessionStorage.removeItem(storageKey);
      }
    }
  } catch (e) {
    // Ignore sessionStorage errors (e.g. private browsing quota)
  }

  return null;
}

export function setCached(key, data, ttl = DEFAULT_TTL_MS) {
  const slug = getTenantSlug() || 'default';
  const memKey = `${slug}:${key}`;
  const entry = {
    timestamp: Date.now(),
    ttl,
    data,
  };

  memoryCache.set(memKey, entry);

  try {
    sessionStorage.setItem(`${getTenantPrefix()}${key}`, JSON.stringify(entry));
  } catch (e) {
    // Ignore quota errors
  }
}

export function clearClientCache() {
  memoryCache.clear();
  try {
    Object.keys(sessionStorage).forEach((k) => {
      if (k.startsWith('cafe_cache_') || k.startsWith('brewhaus_cache_')) {
        sessionStorage.removeItem(k);
      }
    });
  } catch { /* Session storage is optional when browser storage is disabled. */ }
}


