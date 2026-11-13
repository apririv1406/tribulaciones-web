'use strict';

const CACHE = 'lts-pwa-v2';
const SHELL = ['/', '/zona/', '/logo.png', '/estilos.css'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)));
  // No activamos automáticamente una versión nueva: la persona decide cuándo actualizar.
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key.startsWith('lts-pwa-') && key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Nunca almacenar respuestas de API, archivos privados ni recursos de otros dominios.
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/') || url.pathname.startsWith('/media/')) return;

  const isAppResource = request.mode === 'navigate' ||
    ['script', 'style', 'image', 'font'].includes(request.destination);
  if (!isAppResource) return;

  event.respondWith(
    fetch(request).then(response => {
      if (response && response.ok && response.status === 200 && response.type === 'basic') {
        const cacheControl = (response.headers.get('Cache-Control') || '').toLowerCase();
        const hasCookie = response.headers.has('Set-Cookie');
        const isPrivate = /private|no-store|no-cache/.test(cacheControl);
        if (!hasCookie && !isPrivate) {
          const copy = response.clone();
          event.waitUntil(caches.open(CACHE).then(cache => cache.put(request, copy)));
        }
      }
      return response;
    }).catch(() => caches.match(request).then(cached => {
      if (cached) return cached;
      if (request.mode === 'navigate') return caches.match('/zona/') || caches.match('/');
      return Response.error();
    }))
  );
});
