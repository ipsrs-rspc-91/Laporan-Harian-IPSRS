const CACHE_NAME = "lhi-shell-v1";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  // Network-only by design: Supabase/auth/API data must stay live.
  // The service worker exists to make the site installable as a PWA
  // without introducing stale application data.
  event.respondWith(fetch(request));
});