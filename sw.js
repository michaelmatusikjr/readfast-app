/* ReadFast offline cache.
   - The app's own files: network first, so updates arrive right away; cached copy when offline.
   - The EPUB/PDF readers and fonts: cached after first download, so files open offline.
   - Everything else (articles you load by link) is left alone. */
const CACHE = 'readfast-v1';
const CORE = ['./', 'index.html', 'manifest.json', 'icon-180.png', 'icon-512.png'];
const LIBS = [
  'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
];
const CACHE_HOSTS = ['cdnjs.cloudflare.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(CORE).catch(() => {});
    await Promise.all(LIBS.map(u => fetch(u, { mode: 'cors' }).then(r => r.ok && c.put(u, r)).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    e.respondWith(
      fetch(req).then(r => {
        if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
        return r;
      }).catch(async () => (await caches.match(req, { ignoreSearch: true })) || (await caches.match('index.html')) || Response.error())
    );
    return;
  }
  if (CACHE_HOSTS.includes(url.hostname)) {
    e.respondWith((async () => {
      const hit = await caches.match(req.url);
      if (hit) return hit;
      const r = await fetch(req);
      if (r.ok || r.type === 'opaque') { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req.url, copy)); }
      return r;
    })());
  }
});
