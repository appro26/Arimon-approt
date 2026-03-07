self.addEventListener('install', (e) => {
  console.log('Service Worker asennettu');
});

self.addEventListener('fetch', (event) => {
  // Tämä tyhjä kuuntelija riittää Androidille sovellustunnistukseen
  event.respondWith(fetch(event.request));
});
