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

/* PUSH NOTIFICATIONS */

self.addEventListener("push", event => {
  let data = {};

  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {
      title: "Campusora",
      body: event.data?.text() || "You have a new update."
    };
  }

  event.waitUntil(
    self.registration.showNotification(
      data.title || "Campusora",
      {
        body: data.body || "You have a new update.",
        icon: data.icon || "/icon-192-1.png",
        badge: data.badge || "/icon-192-1.png",
        tag: data.tag || "campusora-notification",
        data: data.data || {
          url: "/notifications.html"
        },
        vibrate: [200, 100, 200]
      }
    )
  );
});

/* OPEN CAMPUSORA WHEN NOTIFICATION IS TAPPED */

self.addEventListener("notificationclick", event => {
  event.notification.close();

  const target = new URL(
    event.notification.data?.url || "/notifications.html",
    self.location.origin
  ).href;

  event.waitUntil(
    (async () => {
      const windows = await clients.matchAll({
        type: "window",
        includeUncontrolled: true
      });

      for (const client of windows) {
        if (client.url.startsWith(self.location.origin)) {
          await client.navigate(target);
          return client.focus();
        }
      }

      return clients.openWindow(target);
    })()
  );
});

/* CAMPUSORA USES LIVE SUPABASE DATA */

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  event.respondWith(fetch(event.request));
});
