// Service worker: (1) app-shell caching so the app opens instantly instead of
// re-downloading its whole bundle over the network on every launch, and
// (2) web-push notification handling.

const SHELL_CACHE = 'toky-shell-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Drop stale shell caches from previous versions. Leave other caches
      // (e.g. the decrypted-media cache "toky-media-v1") untouched.
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k.startsWith('toky-shell-') && k !== SHELL_CACHE).map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

// Immutable, content-hashed build assets — safe to serve from cache forever.
function isStaticAsset(url) {
  return (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.startsWith('/fonts/') ||
    /\.(?:js|css|woff2?|ttf|otf|png|jpe?g|gif|svg|webp|ico)$/.test(url.pathname)
  );
}

async function cacheFirst(request) {
  const cache = await caches.open(SHELL_CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res && res.status === 200) cache.put(request, res.clone());
  return res;
}

// For page navigations: try the network briefly (so a fresh deploy is picked
// up), but fall back to the cached shell fast on a slow/no connection.
async function navigate(event) {
  const request = event.request;
  const cache = await caches.open(SHELL_CACHE);
  const network = fetch(request)
    .then((res) => {
      if (res && res.status === 200) cache.put(request, res.clone());
      return res;
    })
    .catch(() => null);

  const timeout = new Promise((resolve) => setTimeout(() => resolve(null), 2500));
  const raced = await Promise.race([network, timeout]);
  if (raced) return raced;

  // Network slow/failed — serve the cached shell if we have it, keeping the
  // real network request alive so the cache updates for next time.
  event.waitUntil(network);
  const cached = await cache.match(request);
  return cached || (await network) || Response.error();
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  // Only ever touch our own origin — never Supabase, storage, or other hosts.
  if (url.origin !== self.location.origin) return;
  // Never cache API/auth/data routes.
  if (url.pathname.startsWith('/api/')) return;
  // Don't cache the service worker itself or the web manifest.
  if (url.pathname === '/sw.js') return;

  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request).catch(() => fetch(request)));
    return;
  }
  if (request.mode === 'navigate') {
    event.respondWith(navigate(event).catch(() => fetch(request)));
    return;
  }
  // Everything else falls through to the network.
});

// ---------------------------------------------------------------------------
// Web push (unchanged behavior)

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
    }),
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
    })(),
  );
});
