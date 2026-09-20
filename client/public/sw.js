// Service Worker for Brewhaus Café Web Push Notifications

self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const title = data.title || '☕ Brewhaus Café';
    const options = {
      body: data.body || 'New exclusive offer available at Brewhaus Café!',
      icon: data.icon || '/favicon.ico',
      badge: data.badge || '/favicon.ico',
      vibrate: [100, 50, 100],
      data: {
        url: data.data?.url || '/offers',
        offerCode: data.data?.offerCode || '',
      },
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (err) {
    const text = event.data.text();
    event.waitUntil(
      self.registration.showNotification('☕ Brewhaus Café', {
        body: text,
        icon: '/favicon.ico',
      })
    );
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/offers';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
