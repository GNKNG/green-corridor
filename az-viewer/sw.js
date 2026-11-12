/**
 * Service Worker for Swindon Green Corridors PWA (az-viewer).
 * Provides offline caching for application shell, vector datasets, and viewed map tiles.
 */
var CACHE_NAME = 'gc-viewer-v9';
var DATA_CACHE_NAME = 'gc-data-v7';

var STATIC_ASSETS = [
  './',
  './index.html',
  './style.css?v=37',
  './app.js?v=37',
  './data/library.json',
  './data/planning-swindon.geojson',
  './manifest.json',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://unpkg.com/@geoman-io/leaflet-geoman-free@2.16.0/dist/leaflet-geoman.css',
  'https://unpkg.com/@geoman-io/leaflet-geoman-free@2.16.0/dist/leaflet-geoman.min.js'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(STATIC_ASSETS);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keyList) {
      return Promise.all(keyList.map(function (key) {
        if (key !== CACHE_NAME && key !== DATA_CACHE_NAME) {
          return caches.delete(key);
        }
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function (event) {
  var request = event.request;
  var url = new URL(request.url);

  // Ignore non-GET requests (e.g. POST returns)
  if (request.method !== 'GET') {
    return;
  }

  // Handle GeoJSON data files with Network-First (falling back to cache when offline)
  if (url.pathname.includes('/data/') && (url.pathname.endsWith('.geojson') || url.pathname.endsWith('.json'))) {
    event.respondWith(
      fetch(request).then(function (networkResponse) {
        if (networkResponse && networkResponse.status === 200) {
          var copy = networkResponse.clone();
          caches.open(DATA_CACHE_NAME).then(function (cache) {
            cache.put(request, copy);
          });
        }
        return networkResponse;
      }).catch(function () {
        return caches.match(request);
      })
    );
    return;
  }

  // Handle OSM Map Tiles (Cache-First with network fallback)
  if (url.hostname.includes('tile.openstreetmap.org') || url.pathname.includes('/tiles/')) {
    event.respondWith(
      caches.open(DATA_CACHE_NAME).then(function (cache) {
        return cache.match(request).then(function (cachedResponse) {
          if (cachedResponse) return cachedResponse;
          return fetch(request).then(function (networkResponse) {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(request, networkResponse.clone());
            }
            return networkResponse;
          }).catch(function () {
            return new Response('', { status: 408, headers: { 'Content-Type': 'text/plain' } });
          });
        });
      })
    );
    return;
  }

  // App shell & static assets: Stale-While-Revalidate
  event.respondWith(
    caches.match(request).then(function (cachedResponse) {
      var fetchPromise = fetch(request).then(function (networkResponse) {
        if (networkResponse && networkResponse.status === 200) {
          var copy = networkResponse.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(request, copy);
          });
        }
        return networkResponse;
      }).catch(function () {
        return cachedResponse;
      });
      return cachedResponse || fetchPromise;
    })
  );
});
