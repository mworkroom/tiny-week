const CACHE_NAME = "tiny-week-v8";
const STATIC_FILES = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.json",
  "./assets/apple-touch-icon.png",
  "./assets/beefstew.png",
  "./assets/chickencurry.png",
  "./assets/dakgalbi.png",
  "./assets/dwaejigukbap.png",
  "./assets/galbitang.png",
  "./assets/miyeokguk.png",
  "./assets/random.png",
  "./assets/samgyeop.png",
  "./assets/tteokbokki.png",
  "./assets/tteokguk.png",
  "./data/voidmoon/2026.json",
  "./data/voidmoon/2027.json"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_FILES))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        return cached;
      }

      return fetch(event.request).then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      });
    })
  );
});
