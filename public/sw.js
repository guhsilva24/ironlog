/**
 * IronLog Service Worker
 * Suporte PWA offline:
 * - Cache de arquivos estáticos para abrir Treino, Nutrição e Água offline.
 * - NUNCA armazena em cache chamadas para /api/.
 * - Se /api/ falhar por falta de rede, retorna resposta estruturada de offline.
 */

const CACHE_NAME = 'ironlog-cache-v1';

const STATIC_PRECACHE = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-192.png',
  '/icon-maskable-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Pré-cache de arquivos estáticos instalado.');
      return cache.addAll(STATIC_PRECACHE);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Removendo cache antigo:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // REGRA ESTRITA: NUNCA armazenar em cache chamadas para /api/
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(
          JSON.stringify({
            error: 'sem conexão',
            message: 'Você está offline. O assistente de IA necessita de conexão ativa com a internet.',
            offline: true
          }),
          {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      })
    );
    return;
  }

  // Não interceptar requisições que não sejam GET (ou de esquemas não-http)
  if (event.request.method !== 'GET' || !url.protocol.startsWith('http')) {
    return;
  }

  // Para navegações (carregar a página SPA)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(event.request);
          if (cached) return cached;
          const indexFallback = await caches.match('/index.html');
          if (indexFallback) return indexFallback;
          return caches.match('/');
        })
    );
    return;
  }

  // Stale-While-Revalidate para outros arquivos estáticos (scripts, estilos, fontes, imagens)
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});
