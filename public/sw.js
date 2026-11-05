// Keeps the app shell available offline so the app opens at the gym with no
// signal (Firestore's own cache handles the data). Deliberately tiny:
// - pages: network first, so deploys show up on the next open; the cached
//   copy when offline, or when the network hasn't answered in NETWORK_WAIT_MS
//   (a weak signal), and the late network copy is cached for next time
// - /assets/*: Vite hashes these filenames, so a cached copy is never stale
// Everything else (Firebase, Google Fonts) passes straight through.
const CACHE = 'gym-shell-v1';
const SHELL = '/index.html';
const NETWORK_WAIT_MS = 3000;

const assetsIn = html => [...html.matchAll(/\/assets\/[^"'\s)]+/g)].map(m => m[0]);

// A new page replaces the cached one only once every asset it needs is
// cached, so the cached page always opens offline. If an asset fails, this
// throws and the older page and its assets stay.
async function cacheShell(response) {
  const cache = await caches.open(CACHE);
  const html = await response.clone().text();
  const keep = new Set(assetsIn(html));
  await Promise.all([...keep].map(async path => {
    if (!(await cache.match(path))) await cache.add(path);
  }));
  await cache.put(SHELL, response);
  // Drop assets from older deploys.
  for (const req of await cache.keys()) {
    const path = new URL(req.url).pathname;
    if (path.startsWith('/assets/') && !keep.has(path)) await cache.delete(req);
  }
}

self.addEventListener('install', event => {
  event.waitUntil(fetch('/', { cache: 'no-store' }).then(res => res.ok && cacheShell(res)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    const network = fetch(request);
    // Cache the fresh page even if it arrives after the cached one was shown.
    event.waitUntil(network.then(res => res.ok && cacheShell(res.clone())).catch(() => {}));
    event.respondWith((async () => {
      const wait = new Promise(resolve => setTimeout(resolve, NETWORK_WAIT_MS));
      const response = await Promise.race([network.catch(() => null), wait]);
      if (response) return response;
      // Offline, or no answer yet: the cached page if there is one, otherwise
      // keep waiting for the network.
      return (await caches.match(SHELL)) || network.catch(() => Response.error());
    })());
    return;
  }

  if (url.pathname.startsWith('/assets/')) {
    event.respondWith((async () => {
      const hit = await caches.match(request);
      if (hit) return hit;
      const response = await fetch(request);
      if (response.ok) {
        const cache = await caches.open(CACHE);
        event.waitUntil(cache.put(request, response.clone()));
      }
      return response;
    })());
  }
});
