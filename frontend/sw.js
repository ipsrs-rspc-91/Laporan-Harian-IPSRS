const CACHE_NAME = "lhi-shell-v2";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Never cache cross-origin requests. This keeps Supabase/API/CDN traffic live.
  if (url.origin !== self.location.origin) return;

  // HTML/fragments must be network-first so deployments and permissions never
  // get trapped behind an old cached document.
  const isDocument =
    request.mode === "navigate" ||
    request.destination === "document" ||
    url.pathname.endsWith(".html");

  if (isDocument) {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(request, response.clone());
        }
        return response;
      } catch (error) {
        const cached = await caches.match(request);
        if (cached) return cached;
        throw error;
      }
    })());
    return;
  }

  // Static application assets use cache-first. Versioned ?v=... URLs in the
  // HTML already invalidate changed JS/CSS without requiring a full cache wipe.
  const isStatic =
    ["script", "style", "image", "font", "manifest"].includes(request.destination) ||
    /\.(?:js|css|png|jpg|jpeg|webp|svg|ico|woff2?|ttf|json)$/i.test(url.pathname);

  if (!isStatic) return;

  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;

    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response.clone());
    }
    return response;
  })());
});