// Production service worker for the Brewhaus customer PWA and push notifications.
const SHELL_CACHE = 'brewhaus-customer-shell-v1';
const SHELL_FILES = ['/', '/offline.html', '/manifest.webmanifest', '/app-icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_FILES)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith('brewhaus-customer-shell-') && key !== SHELL_CACHE).map((key) => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin || new URL(request.url).pathname.startsWith('/api/')) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then((response) => {
      if (response.ok) caches.open(SHELL_CACHE).then((cache) => cache.put('/', response.clone()));
      return response;
    }).catch(async () => (await caches.match(request)) || (await caches.match('/')) || caches.match('/offline.html')));
    return;
  }
  if (/\.(?:js|css|svg|webmanifest|webp|png|woff2?)$/i.test(new URL(request.url).pathname)) {
    event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      if (response.ok) caches.open(SHELL_CACHE).then((cache) => cache.put(request, response.clone()));
      return response;
    })));
  }
});

self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const title = data.title || '☕ Brewhaus Café';
    const actionUrl = data.data?.actionUrl || data.data?.url || data.actionUrl || data.url || '/menu';

    const options = {
      body: data.body || data.message || 'New exclusive special offer at Brewhaus Café!',
      icon: data.icon || '/favicon.svg',
      badge: data.badge || '/favicon.svg',
      image: data.image || undefined,
      vibrate: [150, 50, 150],
      tag: data.tag || `brewhaus-notice-${Date.now()}`,
      renotify: true,
      data: {
        url: actionUrl,
        actionUrl,
        offerCode: data.data?.offerCode || data.offerCode || '',
        sentAt: data.data?.sentAt || new Date().toISOString(),
      },
      actions: [
        { action: 'open', title: 'View Offer' },
        { action: 'dismiss', title: 'Dismiss' },
      ],
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (err) {
    const text = event.data.text();
    event.waitUntil(
      self.registration.showNotification('☕ Brewhaus Café', {
        body: text || 'You have a new update from Brewhaus Café',
        icon: '/favicon.svg',
        data: { url: '/menu' },
      })
    );
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const rawTarget = event.notification.data?.url || event.notification.data?.actionUrl || '/menu';
  // Resolve against the service worker origin so relative paths open the
  // correct website page regardless of the client's current scope.
  let targetUrl = '/menu';
  try {
    targetUrl = new URL(rawTarget, self.location.origin).href;
  } catch {
    targetUrl = new URL('/menu', self.location.origin).href;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Check if there is already a window open with this application
      for (const client of windowClients) {
        if ('focus' in client) {
          if (client.url && client.navigate) {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

self.addEventListener('notificationclose', (event) => {
  // Graceful notification close handling
  console.log('Brewhaus notification closed by user:', event.notification.tag);
});
