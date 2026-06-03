// PWA shell cache — disabled entirely on localhost (dev uses Express + Vite).
const isLocalHost = (hostname) =>
  hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';

self.addEventListener('install', (event) => {
  if (isLocalHost(self.location.hostname)) {
    self.skipWaiting();
    return;
  }
  const CACHE_NAME = 'stemverse-shell-v1';
  const APP_SHELL_ASSETS = ['/', '/index.html', '/manifest.json'];
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  if (isLocalHost(self.location.hostname)) {
    event.waitUntil(
      caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key)))).then(() =>
        self.registration.unregister()
      )
    );
    return;
  }
  const CACHE_NAME = 'stemverse-shell-v1';
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (isLocalHost(url.hostname)) return;

  const request = event.request;
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;
  if (url.pathname.startsWith('/@') || url.pathname.startsWith('/src/')) return;

  const CACHE_NAME = 'stemverse-shell-v1';

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', copy));
          return response;
        })
        .catch(async () => {
          const cached = await caches.match('/index.html');
          if (cached) return cached;
          return new Response(
            '<!DOCTYPE html><html><body><p>STEMverse is offline or waking up. Refresh in a moment.</p></body></html>',
            { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
          );
        })
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') return response;
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        return response;
      });
    })
  );
});
