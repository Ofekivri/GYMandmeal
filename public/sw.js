// Keeps the app shell available offline so the app opens at the gym with no
// signal (Firestore's own cache handles the data). Deliberately tiny:
// - pages: network first, cached copy only when offline, so deploys show up
//   on the next open
// - /assets/*: Vite hashes these filenames, so a cached copy is never stale
// Everything else (Firebase, Google Fonts) passes straight through.
const CACHE = 'gym-shell-v1';
const SHELL = '/index.html';

const assetsIn = html => [...html.matchAll(/\/assets\/[^"'\s)]+/g)].map(m => m[0]);

async function cacheShell(response) {
  const cache = await caches.open(CACHE);
  const html = await response.clone().text();
  await cache.put(SHELL, response);
  const keep = new Set(assetsIn(html));
  await Promise.all([...keep].map(async path => {
    if (!(await cache.match(path))) await cache.add(path).catch(() => {});
  }));
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
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok) event.waitUntil(cacheShell(response.clone()));
        return response;
      } catch {
        return (await caches.match(SHELL)) || Response.error();
      }
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
