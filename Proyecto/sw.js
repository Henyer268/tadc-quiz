// ═══════════════════════════════════════════════════════════
//  SERVICE WORKER — GALA TADC PWA
//  Cambia CACHE_NAME cuando actualices la app para forzar
//  que los usuarios reciban la versión nueva.
// ═══════════════════════════════════════════════════════════

const CACHE_NAME = 'gala-tadc-v1';

// Archivos que se guardan en caché al instalar (shell de la app)
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

// ── INSTALL: guarda el shell en caché ──────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS);
    })
  );
  // Activa el nuevo SW de inmediato sin esperar a que se cierren las pestañas
  self.skipWaiting();
});

// ── ACTIVATE: limpia cachés viejas ────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ── FETCH: Network-first para Supabase, Cache-first para assets ──
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Peticiones a Supabase → siempre red (datos en vivo)
  if (url.hostname.includes('supabase.co') || url.hostname.includes('googleapis.com')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Assets (fuentes, íconos, HTML, manifest) → Cache-first con fallback a red
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request).then((response) => {
        // Solo guardamos en caché respuestas válidas y de mismo origen o CDN conocidos
        if (
          response.ok &&
          (url.origin === self.location.origin ||
            url.hostname === 'fonts.googleapis.com' ||
            url.hostname === 'fonts.gstatic.com')
        ) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      }).catch(() => {
        // Sin red y sin caché → devuelve la página principal como fallback
        if (event.request.mode === 'navigate') {
          return caches.match('/');
        }
      });
    })
  );
});