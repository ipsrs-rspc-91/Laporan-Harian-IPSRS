const CACHE_NAME = "lhi-static-v20260928-audittotal2";

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

function isSameOrigin(request) {
  try {
    return new URL(request.url).origin === self.location.origin;
  } catch (_) {
    return false;
  }
}

function isVersionedStatic(request) {
  if (!isSameOrigin(request)) return false;
  const url = new URL(request.url);
  const path = url.pathname.toLowerCase();
  const hasVersion = url.searchParams.has("v");
  return hasVersion && (path.endsWith(".js") || path.endsWith(".css"));
}

function isImageOrManifest(request) {
  if (!isSameOrigin(request)) return false;
  const path = new URL(request.url).pathname.toLowerCase();
  return /\.(png|jpg|jpeg|webp|svg|ico)$/.test(path) || path.endsWith("manifest.json");
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) {
    await cache.put(request, response.clone());
  }
  return response;
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw error;
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  // PERF STAGE 24:
  // - Hanya aset statis same-origin yang boleh masuk cache.
  // - JS/CSS harus memakai query versi (?v=...) agar update aplikasi
  //   otomatis mendapatkan cache key baru.
  // - API, Supabase, auth, report data, dan HTML fragment tetap live.
  if (isVersionedStatic(request)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (isImageOrManifest(request)) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Semua request lain tetap network-only.
  event.respondWith(fetch(request));
});
