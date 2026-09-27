/* FORGE service worker — offline shell + scheduled nutrition nudges.
   App data lives in IndexedDB (Dexie); this only caches the shell and
   handles notification clicks. */
const VERSION = "forge-v2";
const SHELL = ["/", "/today/", "/move/", "/food/", "/progress/", "/indoor/", "/manifest.json", "/icon.svg", "/brand/forge-logo.svg", "/brand/forge-mark.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

/* What works offline: every page once visited (network first, the saved copy when there is none), and the files
   that never change (hashed code, images, icons) straight from the cache. Not the 3D game (hundreds of MB, it has
   its own browser cache) nor other sites (map tiles, Supabase). */
const STATIC = /^\/(_next\/static|art|brand|indoor|badges|models)\/|\.(png|jpg|jpeg|webp|svg|woff2?)$/;
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/unity/")) return;
  if (STATIC.test(url.pathname)) {
    event.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
      return res;
    })));
    return;
  }
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok && (req.mode === "navigate" || SHELL.includes(url.pathname) || url.pathname.endsWith(".txt"))) {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || (req.mode === "navigate" ? caches.match("/today/") : Response.error())))
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/food";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ("focus" in c) { c.navigate(target); return c.focus(); }
      }
      return self.clients.openWindow(target);
    })
  );
});

// Page → SW: schedule a local notification (best-effort while SW is alive).
self.addEventListener("message", (event) => {
  const msg = event.data || {};
  if (msg.type === "notify") {
    self.registration.showNotification(msg.title || "FORGE", {
      body: msg.body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: msg.tag || "forge",
      data: { url: msg.url || "/food" },
    });
  }
});
