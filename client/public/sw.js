// Production Service Worker for Brewhaus Café Web Push Notifications (Phase 5)

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

  const targetUrl = event.notification.data?.url || event.notification.data?.actionUrl || '/menu';

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
