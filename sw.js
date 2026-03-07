self.addEventListener('install', (e) => {
  console.log('Service Worker: Asennettu');
});

self.addEventListener('fetch', (e) => {
  e.respondWith(fetch(e.request));
});
