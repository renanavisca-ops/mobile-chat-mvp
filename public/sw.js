// Minimal service worker: shows a notification for incoming web push events
// and focuses/opens the app on click. No caching/offline behavior — that's a
// separate concern from push delivery.

self.addEventListener('push', (event) => {
  let data = { title: 'Toky Chat', body: 'New message', url: '/chats' };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    // ignore malformed payloads
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon',
      badge: '/icon',
      data: { url: data.url || '/chats' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/chats';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
