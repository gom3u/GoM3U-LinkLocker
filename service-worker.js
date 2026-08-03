/**
 * GoM3U Link Locker — service-worker.js
 * Caches the static app shell so the site loads instantly on repeat
 * visits and shows something even when offline. Live data (playlist,
 * ads, stats) always comes fresh from Firestore, never from cache.
 */

const CACHE_NAME = "gom3u-shell-v1";
const APP_SHELL = [
  "./",
  "./index.html",
  "./css/style.css",
  "./js/config.js",
  "./js/firebase.js",
  "./js/app.js",
  "./manifest.json",
  "./assets/favicon.png",
  "./assets/logo.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Never cache Firebase/API calls — always go to network for live data.
  if (request.url.includes("firestore") || request.url.includes("googleapis")) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).catch(() => cached))
  );
});
