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
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: data.url || '/chats' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  // Resolve to an absolute, same-origin URL so navigate()/openWindow() don't
  // land on a blank context.
  const raw = event.notification.data && event.notification.data.url ? event.notification.data.url : '/chats';
  const target = new URL(raw, self.location.origin).href;

  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      // Reuse an already-open app tab: focus it first, then navigate.
      for (const client of clients) {
        try {
          await client.focus();
          if ('navigate' in client) await client.navigate(target);
          return;
        } catch {
          // fall through to opening a new window
        }
      }
      if (self.clients.openWindow) await self.clients.openWindow(target);
    })()
  );
});
