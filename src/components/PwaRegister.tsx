"use client";

import { useEffect } from "react";

/** Registers the service worker once the page is idle, and asks the browser to
 *  keep our data. Without the second call IndexedDB is "best-effort" storage:
 *  Safari evicts it after ~7 days without a visit, and every browser may clear
 *  it under disk pressure. A 12-week block cannot live on best-effort. */
export function PwaRegister() {
  useEffect(() => {
    if ("storage" in navigator && "persist" in navigator.storage) {
      navigator.storage.persisted()
        .then((already) => (already ? true : navigator.storage.persist()))
        .catch(() => {});
    }
    if (!("serviceWorker" in navigator)) return;

    // Inside the native shell the worker is worse than useless. Capacitor
    // already serves every asset from the device, so there is nothing for it
    // to make available offline — and it breaks the app outright: it
    // intercepts navigation on a capacitor:// URL its precache never matched,
    // so the second launch after install renders nothing at all. The first
    // launch works, which is what makes it so easy to ship.
    const native = typeof window !== "undefined"
      && (("Capacitor" in window) || location.protocol === "capacitor:" || location.protocol === "ionic:");
    if (native) {
      navigator.serviceWorker.getRegistrations()
        .then((regs) => Promise.all(regs.map((r) => r.unregister())))
        .then(() => caches.keys())
        .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
        .catch(() => {});
      return;
    }

    // In development the worker caches dev chunks and serves them back the
    // moment a fetch hiccups — a restarted server, a saved file — so the app
    // keeps rendering code that is no longer on disk. That looks exactly like
    // "my change did nothing", which is the most expensive bug there is. It
    // also tears down a worker left behind by an earlier dev session.
    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker.getRegistrations()
        .then((regs) => Promise.all(regs.map((r) => r.unregister())))
        .then(() => caches.keys())
        .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
        .catch(() => {});
      return;
    }

    const register = () => navigator.serviceWorker.register("/sw.js").catch(() => {});
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);
  return null;
}
