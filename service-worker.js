importScripts("./app-version.js");
const CACHE_NAME = TINY_WEEK_VERSION;
const STATIC_FILES = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./app-version.js",
  "./app-updates.js",
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
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      // 오래된 HTTP 캐시를 건너뛰고 이번 배포의 파일을 모두 받는다.
      await cache.addAll(STATIC_FILES.map((file) => new Request(file, { cache: "reload" })));
      const versionFile = await cache.match("./app-version.js");
      const cachedVersion = (await versionFile.text()).match(/\bconst TINY_WEEK_VERSION\s*=\s*["']([^"']+)["']/)?.[1];
      if (cachedVersion !== CACHE_NAME) throw new Error("App version changed during installation");
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key.startsWith("tiny-week-") && key !== CACHE_NAME).map((key) => caches.delete(key)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "GET_APP_VERSION") {
    event.ports[0]?.postMessage({ version: CACHE_NAME });
  }
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || !url.href.startsWith(self.registration.scope)) {
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(event.request);
      if (cached) {
        return cached;
      }

      return fetch(event.request).then((response) => {
        if (response.ok) {
          event.waitUntil(cache.put(event.request, response.clone()));
        }
        return response;
      });
    })
  );
});
