// Spotify Web Player - Mobile Audio Background Service Worker
const CACHE_NAME = "spotify-web-player-v1";
const STATIC_ASSETS = [
  "/",
  "/manifest.json",
  "https://open.spotifycdn.com/cdn/images/favicon32.b64ecc03.png"
];

// Install: Cache essential shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {});
    })
  );
  self.skipWaiting();
});

// Activate: Clean old caches and claim clients immediately
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Pass-through streaming audio directly (bypass cache for range requests & streaming API)
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Never intercept or cache audio streams or API stream endpoints
  if (
    url.pathname.startsWith("/api/stream") ||
    url.hostname.includes("saavncdn.com") ||
    url.hostname.includes("googlevideo.com") ||
    url.hostname.includes("youtube.com") ||
    event.request.headers.get("range")
  ) {
    return;
  }

  // Stale-while-revalidate for static UI assets
  if (
    event.request.method === "GET" &&
    (url.origin === self.location.origin || url.hostname.includes("spotifycdn.com"))
  ) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        const fetchPromise = fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200 && networkResponse.type === "basic") {
              const responseToCache = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, responseToCache).catch(() => {});
              });
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      })
    );
  }
});
