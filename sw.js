// 離線快取（stale-while-revalidate）：
// 先用快取立刻顯示，同時在背景抓新版存起來，下次開啟就是最新版。
const CACHE = 'nihongo-v8';
const ASSETS = ['./', 'index.html', 'css/style.css', 'js/data.js', 'js/course.js', 'js/lesson.js', 'js/app.js', 'manifest.json',
  'img/favicon-64.png', 'img/icon-192.png', 'img/apple-touch-icon.png', 'img/kuro.webp', 'img/glassmap.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const same = url.origin === self.location.origin;
  const font = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (!same && !font) return;
  e.respondWith(caches.open(CACHE).then(async cache => {
    const key = req.mode === 'navigate' ? 'index.html' : req;
    const hit = await cache.match(key, { ignoreSearch: same });
    const net = fetch(same ? new Request(req, { cache: 'no-cache' }) : req)
      .then(res => { if (res.ok || res.type === 'opaque') cache.put(key, res.clone()); return res; })
      .catch(() => hit);
    if (hit) { e.waitUntil(net); return hit; }
    return net;
  }));
});
