/**
 * IndexedDB Client Storage for InfiniGrow POS
 * Supports zero-downtime offline counter ordering and automatic background sync.
 */

const DB_NAME = 'infinigrow_pos_db';
const DB_VERSION = 1;
const STORE_OFFLINE_ORDERS = 'offline_orders';
const STORE_CATALOG = 'cached_catalog';

const openDb = () => {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB is not supported in this environment.'));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_OFFLINE_ORDERS)) {
        db.createObjectStore(STORE_OFFLINE_ORDERS, { keyPath: 'syncId' });
      }
      if (!db.objectStoreNames.contains(STORE_CATALOG)) {
        db.createObjectStore(STORE_CATALOG, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const saveOfflineOrder = async (order) => {
  const db = await openDb();
  const syncId = order.syncId || `offline_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const record = {
    ...order,
    syncId,
    timestamp: Date.now(),
    status: 'pending_sync',
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_OFFLINE_ORDERS, 'readwrite');
    const store = tx.objectStore(STORE_OFFLINE_ORDERS);
    const req = store.put(record);
    req.onsuccess = () => resolve(record);
    req.onerror = () => reject(req.error);
  });
};

export const getPendingOfflineOrders = async () => {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_OFFLINE_ORDERS, 'readonly');
    const store = tx.objectStore(STORE_OFFLINE_ORDERS);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
};

export const removeOfflineOrder = async (syncId) => {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_OFFLINE_ORDERS, 'readwrite');
    const store = tx.objectStore(STORE_OFFLINE_ORDERS);
    const req = store.delete(syncId);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
};

export const cacheCatalog = async (categories = [], products = []) => {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CATALOG, 'readwrite');
    const store = tx.objectStore(STORE_CATALOG);
    store.put({ key: 'categories', data: categories, cachedAt: Date.now() });
    store.put({ key: 'products', data: products, cachedAt: Date.now() });
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
};

export const getCachedCatalog = async () => {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CATALOG, 'readonly');
    const store = tx.objectStore(STORE_CATALOG);
    const pReq = store.get('products');
    const cReq = store.get('categories');

    tx.oncomplete = () => {
      resolve({
        products: pReq.result?.data || [],
        categories: cReq.result?.data || [],
        cachedAt: pReq.result?.cachedAt || null,
      });
    };
    tx.onerror = () => reject(tx.error);
  });
};
