// Lightweight in-memory + sessionStorage cache for client-side API requests
const memoryCache = new Map();

const DEFAULT_TTL_MS = 60 * 1000; // 1 minute default for menu queries
const CATEGORIES_TTL_MS = 5 * 60 * 1000; // 5 minutes for categories

export function getCached(key) {
  const now = Date.now();

  // 1. Check in-memory cache
  const mem = memoryCache.get(key);
  if (mem && now - mem.timestamp < mem.ttl) {
    return mem.data;
  }

  // 2. Check sessionStorage
  try {
    const raw = sessionStorage.getItem(`brewhaus_cache_${key}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && now - parsed.timestamp < parsed.ttl) {
        // Hydrate memory cache
        memoryCache.set(key, parsed);
        return parsed.data;
      } else {
        sessionStorage.removeItem(`brewhaus_cache_${key}`);
      }
    }
  } catch (e) {
    // Ignore sessionStorage errors (e.g. private browsing quota)
  }

  return null;
}

export function setCached(key, data, ttl = DEFAULT_TTL_MS) {
  const entry = {
    timestamp: Date.now(),
    ttl,
    data,
  };

  memoryCache.set(key, entry);

  try {
    sessionStorage.setItem(`brewhaus_cache_${key}`, JSON.stringify(entry));
  } catch (e) {
    // Ignore quota errors
  }
}

export function clearClientCache() {
  memoryCache.clear();
  try {
    Object.keys(sessionStorage).forEach((k) => {
      if (k.startsWith('brewhaus_cache_')) {
        sessionStorage.removeItem(k);
      }
    });
  } catch (e) {}
}

export { CATEGORIES_TTL_MS, DEFAULT_TTL_MS };
