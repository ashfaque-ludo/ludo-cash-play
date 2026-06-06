const CACHE_NAME = 'ludo-cash-play-v2';
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)).catch(() => {})
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Network-first strategy — always try network, fall back to cache for navigation only
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Skip non-GET, cross-origin API calls, and chrome-extension requests
  if (e.request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  // For navigation requests, serve from network with cache fallback
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

  // For other same-origin requests, network-first
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});
