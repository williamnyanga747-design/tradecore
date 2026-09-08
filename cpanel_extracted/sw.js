const CACHE_NAME = 'tanzaniatradecore-v4';
const APP_SHELL = ['/', '/offline.html', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then((c) => c.addAll(APP_SHELL).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((k) => Promise.all(k.filter((x) => x !== CACHE_NAME).map((x) => caches.delete(x))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  try {
    const u = new URL(e.request.url);
    // 1. Never intercept cross-origin requests (CDN images, analytics, third-party).
    //    Not calling respondWith() lets the browser handle it normally — no TypeError.
    if (u.origin !== self.location.origin) return;
    // 2. Never intercept API / mutation / auth routes — always go to the network.
    if (
      u.pathname.includes('/api/') ||
      u.pathname.includes('/cpanel/') ||
      u.pathname.includes('/login') ||
      u.pathname.includes('php_sync') ||
      u.pathname.includes('/api.php')
    ) return;
    // 3. Non-GET requests (POST, PUT, DELETE) bypass the cache entirely.
    if (e.request.method !== 'GET') return;

    // Cache-first strategy: serve from cache, update in background.
    e.respondWith(
      caches.match(e.request).then((cached) => {
        const fetched = fetch(e.request)
          .then((r) => {
            // Only cache successful opaque/basic same-origin responses.
            // r.type === 'opaque' happens for cross-origin no-cors (shouldn't
            // reach here due to the origin guard above, but defensive).
            if (r && r.status === 200 && (r.type === 'basic' || r.type === 'opaque')) {
              const copy = r.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(e.request, copy));
            }
            return r;
          })
          .catch(() => {
            // Network failed. Return the cached version, or a synthetic offline page.
            if (cached) return cached;
            if (e.request.mode === 'navigate') {
              return caches.match('/offline.html').then((page) => {
                // Guarantee a Response: if offline.html also missing, produce a 503.
                return page || new Response('<h1>Offline</h1>', {
                  status: 503,
                  headers: { 'Content-Type': 'text/html' },
                });
              });
            }
            // Non-navigate requests (images, fonts, scripts) with no cache: 408.
            return new Response('', { status: 408, statusText: 'Offline' });
          });
        // Serve cached immediately if available; otherwise wait for network.
        return cached || fetched;
      })
    );
  } catch (err) {
    // Defensive: if anything above throws (e.g. URL constructor on invalid URL),
    // do NOT let the FetchEvent propagate without a response — that causes the
    // exact TypeError the browser logs. Return a network error.
    e.respondWith(new Response('', { status: 500, statusText: 'SW Error' }));
  }
});
