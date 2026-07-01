/* NVIDIA AI Desktop - service worker
 * Network-first for the app shell (HTML/JS/CSS/manifest) so a GitHub Pages
 * deploy shows up immediately. Cache is only a fallback for offline use.
 * Bump CACHE_NAME whenever you want to force-drop old caches.
 */
const CACHE_NAME = 'nvidia-ai-desktop-v3-0-1';
const APP_SHELL = ['./', './index.html', './styles.css', './app.js', './manifest.webmanifest', './icon.svg'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', event => {
  if (event.data === 'CLEAR_CACHES') {
    event.waitUntil(caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k)))));
  }
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.origin !== location.origin || event.request.method !== 'GET') return;

  const isShell = /\.(html|js|css|webmanifest)$/.test(url.pathname) || url.pathname.endsWith('/');

  if (isShell) {
    // Network-first: always try the network, fall back to cache (and finally to index.html offline).
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy)).catch(() => {});
          return response;
        })
        .catch(() => caches.match(event.request).then(cached => cached || caches.match('./index.html')))
    );
    return;
  }

  // Everything else (icons, etc.): cache-first with a network fill.
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy)).catch(() => {});
      return response;
    }).catch(() => cached))
  );
});
