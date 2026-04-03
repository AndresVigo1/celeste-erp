/* Celeste ERP - Service Worker */
'use strict';

const CACHE_NAME   = 'celeste-erp-v1';
const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/css/app.css',
  '/js/api.js',
  '/js/app.js',
  '/js/components/toast.js',
  '/js/components/modal.js',
  '/js/components/bottom-nav.js',
  '/js/views/dashboard.js',
  '/js/views/ventas.js',
  '/js/views/nueva-venta.js',
  '/js/views/gastos.js',
  '/js/views/inventario.js',
  '/js/views/clientes.js',
  '/js/views/pedidos.js',
  '/manifest.json'
];

// ── Install: cache app shell ──────────────────────────────────────────────────

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: clean old caches ────────────────────────────────────────────────

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch strategy ────────────────────────────────────────────────────────────

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Network-first for API calls
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .catch(() => new Response(
          JSON.stringify({ error: 'Sin conexión. Verifica tu red.' }),
          { status: 503, headers: { 'Content-Type': 'application/json' } }
        ))
    );
    return;
  }

  // Cache-first for static assets (images, fonts, icons)
  if (
    request.destination === 'image' ||
    request.destination === 'font' ||
    url.pathname.startsWith('/icons/')
  ) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Network-first with cache fallback for HTML/CSS/JS
  event.respondWith(
    fetch(request)
      .then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => caches.match(request).then(cached => {
        if (cached) return cached;
        // Fallback to index.html for navigation requests
        if (request.mode === 'navigate') {
          return caches.match('/index.html');
        }
        return new Response('Sin conexión', { status: 503 });
      }))
  );
});
