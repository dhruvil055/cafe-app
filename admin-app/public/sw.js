const SHELL_CACHE = 'brewhaus-admin-shell-v1';
const SHELL_FILES = ['/', '/offline.html', '/manifest.webmanifest', '/app-icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_FILES)).catch(() => {}));
  self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith('brewhaus-admin-shell-') && key !== SHELL_CACHE).map((key) => caches.delete(key)))));
  self.clients.claim();
});
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then((response) => {
      if (response.ok) caches.open(SHELL_CACHE).then((cache) => cache.put('/', response.clone()));
      return response;
    }).catch(async () => (await caches.match(request)) || (await caches.match('/')) || caches.match('/offline.html')));
    return;
  }
  if (/\.(?:js|css|svg|webmanifest|woff2?)$/i.test(url.pathname)) {
    event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      if (response.ok) caches.open(SHELL_CACHE).then((cache) => cache.put(request, response.clone()));
      return response;
    })));
  }
});
