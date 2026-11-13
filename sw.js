/* Tooz eReader offline cache.
   - The app's own files: network first, so updates arrive right away; cached copy when offline.
   - The EPUB/PDF readers, fonts and the natural-voice engine: cached after first download, so they work offline.
   - Everything else (articles you load by link) is left alone. */
const CACHE = 'tooz-v3';
const CORE = ['./', 'index.html', 'manifest.json', 'icon-180.png', 'icon-512.png', 'piper-worker.js'];
const LIBS = [
  'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
];
const CACHE_HOSTS = ['cdnjs.cloudflare.com', 'fonts.googleapis.com', 'fonts.gstatic.com', 'cdn.jsdelivr.net'];

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
  /* starter-shelf books are saved inside the app once downloaded, so they aren't kept twice */
  if (url.origin === self.location.origin && url.pathname.includes('/books/')) return;
  if (url.origin === self.location.origin) {
    /* Network first so updates show up, but on a weak signal fall back to the saved copy after 3 seconds
       (the network answer still refreshes the cache for next time). */
    /* A server error counts as a failure, so the saved copy is used instead of an error page.
       Every app address (with or without ?query) is stored as one copy. */
    const key = req.mode === 'navigate' ? new URL('./', self.location).href : req;
    const net = fetch(req).then(async r => {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const c = await caches.open(CACHE); await c.put(key, r.clone());
      return r;
    });
    e.waitUntil(net.catch(() => {}));
    e.respondWith((async () => {
      const fallback = async () => (await caches.match(req, { ignoreSearch: true })) || (req.mode === 'navigate' ? await caches.match('index.html') : undefined);
      const cached = await fallback();
      if (!cached) return net.catch(() => fetch(req).catch(() => Response.error())); /* nothing saved: pass the server's own answer through */
      const slow = new Promise(r => setTimeout(() => r(null), 3000));
      try { return (await Promise.race([net, slow])) || cached; } catch (err) { return cached; }
    })());
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
