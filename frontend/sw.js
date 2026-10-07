const CACHE_NAME = "lhi-shell-v20261008-dashboard-refresh1";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil((async()=>{\n    const keys=await caches.keys();\n    await Promise.all(keys.map(k=>caches.delete(k)));\n    await self.clients.claim();\n  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  // Network-only by design: Supabase/auth/API data must stay live.
  // The service worker exists to make the site installable as a PWA
  // without introducing stale application data.
  event.respondWith(fetch(request));
});