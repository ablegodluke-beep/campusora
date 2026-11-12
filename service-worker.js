const CACHE_NAME = "campusora-pwa-v1";

self.addEventListener("install", event => {
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    (async () => {
      await self.clients.claim();

      const keys = await caches.keys();

      await Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      );
    })()
  );
});

/*
  Campusora uses live Supabase data.
  We deliberately do not cache private pages,
  messages, profiles, payments or API responses.
*/
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  event.respondWith(fetch(event.request));
});
