// IslePlace Converter service worker — hand-written, no dependencies.
//  • offline: pages are network-first (fresh when online, cached copy when offline);
//    hashed build assets in /_astro/ (JS, WASM decoders) are cache-first — they never change.
//  • Android share target: the system "Share" sheet POSTs files to /share-target/;
//    we keep them in a cache for a moment and redirect to /share/ where the user picks a tool.
// Files never leave the device: everything here runs inside the browser.
const VERSION = 'v1';
const PAGES = `pages-${VERSION}`;
const ASSETS = `assets-${VERSION}`;
const SHARED = 'shared-files';
const CORE = ['/', '/en/', '/es/', '/pt/', '/ru/', '/id/', '/share/', '/favicon.svg', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(PAGES).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => ![PAGES, ASSETS, SHARED].includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function receiveShare(request) {
  const form = await request.formData();
  const files = form.getAll('files').filter((f) => typeof f !== 'string');
  await caches.delete(SHARED);
  const cache = await caches.open(SHARED);
  await Promise.all(
    files.map((f, i) =>
      cache.put(`/shared/${i}`, new Response(f, { headers: { 'Content-Type': f.type || 'application/octet-stream', 'X-Name': encodeURIComponent(f.name) } })),
    ),
  );
  return Response.redirect(`/share/?n=${files.length}`, 303);
}

async function networkFirst(request) {
  const cache = await caches.open(PAGES);
  try {
    const res = await fetch(request);
    if (res.ok) cache.put(request, res.clone());
    return res;
  } catch {
    return (await cache.match(request)) || (await cache.match('/')) || Response.error();
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(ASSETS);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) cache.put(request, res.clone());
  return res;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (url.origin !== location.origin) return;
  if (request.method === 'POST' && url.pathname === '/share-target/') return event.respondWith(receiveShare(request));
  if (request.method !== 'GET') return;
  if (url.pathname.startsWith('/_astro/')) return event.respondWith(cacheFirst(request));
  if (request.mode === 'navigate') return event.respondWith(networkFirst(request));
});
