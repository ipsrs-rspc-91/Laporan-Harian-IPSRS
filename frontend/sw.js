const CACHE_NAME = "lhi-shell-v3";
const PINNED_CROSS_ORIGIN_ASSETS = new Set([
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.116.0/dist/umd/supabase.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.0/chart.umd.min.js"
]);

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Only these exact, version-pinned third-party libraries are cacheable.
  // Supabase API/auth endpoints are NOT in this allowlist.
  if (PINNED_CROSS_ORIGIN_ASSETS.has(url.href)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // All other cross-origin traffic stays network-only.
  if (url.origin !== self.location.origin) return;

  // HTML/fragments stay network-first so deployments and permissions are live.
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

  // Same-origin versioned static assets use cache-first.
  const isStatic =
    ["script", "style", "image", "font", "manifest"].includes(request.destination) ||
    /\.(?:js|css|png|jpg|jpeg|webp|svg|ico|woff2?|ttf|json)$/i.test(url.pathname);

  if (!isStatic) return;

  event.respondWith(cacheFirst(request));
});