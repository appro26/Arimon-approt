const CACHE_NAME = 'arimon-approt-offline-v1';

// Asennusvaihe: Pakotetaan uusi Service Worker heti käyttöön
self.addEventListener('install', (event) => {
    self.skipWaiting();
});

// Aktivointivaihe: Siivotaan vanhat välimuistit
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// HAKULOGIIKKA: Verkko ensin, sitten varalla välimuisti
self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;
    if (!event.request.url.startsWith('http')) return;

    event.respondWith(
        fetch(event.request)
            .then((networkResponse) => {
                // Tallennetaan laitteen muistiin kun ollaan netissä
                return caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, networkResponse.clone());
                    return networkResponse;
                });
            })
            .catch(() => {
                // KUN LAITE ON OFFLINE: Haetaan suoraan muistista!
                return caches.match(event.request);
            })
    );
});
