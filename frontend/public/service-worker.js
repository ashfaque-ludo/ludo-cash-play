// Kill switch: immediately clear all caches and unregister this service worker.
// Deployed to fix Safari iOS "FetchEvent.respondWith received an error: Returned response is null".
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(() => self.registration.unregister())
      .catch(() => {})
  );
  self.clients.claim();
});
