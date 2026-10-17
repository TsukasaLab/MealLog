const CACHE_NAME = 'meallog-v017-shell';
const FALLBACK_PAGE = './index.html';

const PRECACHE = [
  './',
  './index.html',
  './styles.css',
  './v003.css',
  './v004.css',
  './v005.css',
  './v006.css',
  './v009.css',
  './v011.css',
  './assets/night-festival-bg.jpg',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE))
      .catch(() => Promise.resolve())
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(key => key === CACHE_NAME ? Promise.resolve() : caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  const destination = event.request.destination;
  const isAppFile =
    event.request.mode === 'navigate' ||
    destination === 'document' ||
    destination === 'script' ||
    destination === 'style' ||
    url.pathname.endsWith('/config.js') ||
    url.pathname.endsWith('/manifest.webmanifest');

  if (isAppFile) {
    // HTML / JS / CSS はネット優先。
    // 更新があれば通常のF5でも最新版が表示される。
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy)).catch(() => {});
          return response;
        })
        .catch(async () => {
          return (await caches.match(event.request)) ||
                 (event.request.mode === 'navigate' ? await caches.match(FALLBACK_PAGE) : Response.error());
        })
    );
    return;
  }

  // アイコン等はキャッシュ優先
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy)).catch(() => {});
        return response;
      });
    })
  );
});
