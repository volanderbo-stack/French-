/* Службовий воркер Écoute.
   - Зберігає файли застосунку, щоб він відкривався навіть без інтернету.
   - videos.json завжди спершу береться з мережі (щоб нові відео з'являлися одразу).
   Якщо змінили app.js / styles.css і зміни не видно — збільшіть номер версії нижче. */
const CACHE = 'ecoute-v2';
const SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './videos.json',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  // YouTube, картинки-прев'ю тощо — не чіпаємо, хай іде напряму в мережу
  if (req.method !== 'GET' || url.origin !== location.origin) return;

  // videos.json: спершу мережа, якщо офлайн — збережена копія
  if (url.pathname.endsWith('/videos.json')) {
    e.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put('./videos.json', copy));
        return res;
      }).catch(() => caches.match('./videos.json'))
    );
    return;
  }

  // Решта файлів: віддаємо збережене одразу, а в фоні оновлюємо з мережі
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((cached) => {
      const fresh = fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      }).catch(() => cached || caches.match('./index.html'));
      return cached || fresh;
    })
  );
});
