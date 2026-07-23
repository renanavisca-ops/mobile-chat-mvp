// Minimal service worker: shows a notification for incoming web push events
// and focuses/opens the app on click. No caching/offline behavior — that's a
// separate concern from push delivery.

// Take over as soon as a new version is deployed, instead of waiting for every
// tab to close. Without this the browser keeps running the OLD service worker
// (whose click handler reloaded the page and hung up in-progress calls).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

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
      // Carry the type through so the click handler can treat calls specially.
      data: { url: data.url || '/chats', type: data.type || 'message' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const info = event.notification.data || {};
  const raw = info.url || '/chats';
  const target = new URL(raw, self.location.origin).href;

  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });

      // If an app tab is already open, FOCUS it and ask the SPA to route in
      // place. We must NOT call client.navigate() here: a full navigation
      // reloads the page and tears down any in-progress call — the incoming
      // call UI and its realtime signaling live in React state — which is what
      // made clicking an incoming-call notification hang up the call.
      for (const client of clients) {
        try {
          await client.focus();
          client.postMessage({ type: 'notification-click', url: raw, kind: info.type || 'message' });
          return;
        } catch {
          // fall through to opening a new window
        }
      }

      // No app tab open: open one at the target (nothing to tear down).
      if (self.clients.openWindow) await self.clients.openWindow(target);
    })()
  );
});
