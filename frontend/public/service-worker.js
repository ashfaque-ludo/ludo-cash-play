const CACHE_NAME = 'myakadda-v3';
const STATIC_PRECACHE = [
  '/',
  '/manifest.json',
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_PRECACHE)).catch(() => {})
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Never intercept non-GET or cross-origin requests
  if (e.request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;

  // Never intercept API calls — always fresh from server
  if (url.pathname.startsWith('/api/')) return;

  // Static assets (JS/CSS/fonts/images under /static/) — cache-first.
  // CRA gives these content-hashed filenames so they can be cached indefinitely.
  if (url.pathname.startsWith('/static/')) {
    e.respondWith(
      caches.match(e.request).then((cached) => {
        if (cached) return cached;
        return fetch(e.request).then((res) => {
          if (res.ok) {
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, res.clone()));
          }
          return res;
        });
      })
    );
    return;
  }

  // Navigation requests (HTML) — network-first, cache as fallback
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
          }
          return res;
        })
        .catch(() => caches.match('/') || caches.match(e.request))
    );
    return;
  }

  // Everything else — network-first, cache as offline fallback
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});
