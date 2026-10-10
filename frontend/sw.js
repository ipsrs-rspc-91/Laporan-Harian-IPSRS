const CACHE_NAME = "lhi-shell-v20261011-kat-gap8";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  // Network-only by design: Supabase/auth/API data must stay live.
  // The service worker exists to make the site installable as a PWA
  // without introducing stale application data.
  event.respondWith(fetch(request));
});