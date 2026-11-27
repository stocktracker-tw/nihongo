// 離線快取（stale-while-revalidate）：
// 先用快取立刻顯示，同時在背景抓新版存起來，下次開啟就是最新版。
const CACHE = 'nihongo-v19';
const ASSETS = ['./', 'index.html', 'css/style.css', 'js/data.js', 'js/course.js', 'js/lesson.js', 'js/words.js', 'js/home.js', 'data/jlpt/index.json', 'js/app.js', 'manifest.json',
  'img/favicon-64.png', 'img/icon-192.png', 'img/apple-touch-icon.png', 'img/kuro.webp', 'img/glassmap.png', 'audio/index.json'];
// 發音 mp3 不預先下載，播放過一次就會存進快取，之後離線也能播

self.addEventListener('install', e => {
  // cache: 'reload' 繞過瀏覽器的 HTTP 快取，避免新版快取裡混到舊的 index.html
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
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
    // App 本身（資料夾根目錄或 index.html）共用同一份快取；其他頁面照原網址
    const appPage = req.mode === 'navigate' && /\/(index\.html)?$/.test(url.pathname);
    const key = appPage ? 'index.html' : req;
    const hit = await cache.match(key, { ignoreSearch: same });
    const net = fetch(same ? new Request(req, { cache: 'no-cache' }) : req)
      .then(res => { if (res.ok || res.type === 'opaque') cache.put(key, res.clone()); return res; })
      .catch(() => hit);
    if (hit) { e.waitUntil(net); return hit; }
    return net;
  }));
});
