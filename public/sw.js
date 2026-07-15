// Service Worker Caddr. — cache des assets pour un fonctionnement hors-ligne.
const CACHE = 'caddr-v1';
const OFFLINE_URL = '/index.html';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['/', OFFLINE_URL])));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // Ne jamais intercepter : API IA, Firebase, requêtes non-GET
  if (e.request.method !== 'GET') return;
  if (url.pathname.startsWith('/.netlify/')) return;
  if (url.origin !== self.location.origin) return;

  // Navigation : réseau d'abord, repli hors-ligne
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).catch(() => caches.match(OFFLINE_URL))
    );
    return;
  }

  // Assets : cache d'abord, puis réseau (et mise en cache)
  e.respondWith(
    caches.match(e.request).then((cached) =>
      cached ||
      fetch(e.request).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
    )
  );
});
