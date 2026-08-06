const CACHE_NAME = 'grey-corner-hub-v6';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/pwa-icon.png',
  '/LOGO.png'
];

// Install Event - skip waiting immediately to activate new SW
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

// Activate Event - purge all old caches and claim clients immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('Purging old cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event - Network First for HTML/Navigation, Stale-While-Revalidate for Assets
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  const isHtmlNavigation = event.request.mode === 'navigate' || 
                           event.request.headers.get('accept')?.includes('text/html') ||
                           url.pathname === '/' ||
                           url.pathname === '/index.html';

  if (isHtmlNavigation) {
    // Network First strategy for HTML so the user always gets the latest version online
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
          }
          return networkResponse;
        })
        .catch(() => {
          // Fallback to cache if offline
          return caches.match(event.request).then((cachedResponse) => {
            return cachedResponse || caches.match('/index.html') || caches.match('/');
          });
        })
    );
  } else {
    // Cache First with background revalidation for images/static assets
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        const fetchPromise = fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && url.origin === self.location.origin) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
          }
          return networkResponse;
        }).catch(() => {});

        return cachedResponse || fetchPromise;
      })
    );
  }
});
