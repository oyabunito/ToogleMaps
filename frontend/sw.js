// Service worker : cache l'app shell pour un fonctionnement hors-ligne.
// Seuls le géocodage et l'optimisation ont besoin du réseau ; une fois la
// tournée calculée (stockée en IndexedDB), tout le reste marche offline.

const CACHE_NAME = "tooglemaps-shell-v1";
const APP_SHELL = [
  ".",
  "index.html",
  "manifest.json",
  "css/style.css?v=1",
  "js/config.js",
  "js/storage.js",
  "js/api.js",
  "js/speech.js",
  "js/ocr.js",
  "js/addAddress.js",
  "js/stopList.js",
  "js/map.js",
  "js/app.js",
  "icons/icon.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// App shell : cache d'abord, réseau en secours. Le reste (API, tuiles
// carte, CDN OCR) passe simplement au réseau — pas critique en offline.
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => cached);
    })
  );
});
