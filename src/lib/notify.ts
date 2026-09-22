import { isNativeShell, documentUrl } from "./native";
import type { Reminder } from "./reminders";

/* ─────────────────────────────────────────────────────────────
   Notifications.

   In the app, reminders are handed to the phone
   (@capacitor/local-notifications): Android and iOS deliver them
   at their time with FORGE closed. They are not "exact" alarms —
   those need a permission Google Play polices — so one can land a
   few minutes late while the phone sleeps, which is fine for a
   meal or a check-in.

   In a browser there is no such thing: the page keeps timers and
   hands them to the service worker, which only works while the
   tab is open or recently backgrounded.

   Server push (a like, a reply) needs Firebase and APNs and comes
   with the account layer.
   ───────────────────────────────────────────────────────────── */

type Perm = "granted" | "denied" | "unsupported";

/* Wrapped in an object on purpose: a Capacitor plugin is a proxy that answers
   every property, `.then` included, so returning it bare from an async function
   makes `await` treat it as a promise and throw "then() is not implemented". */
async function plugin() {
  const { LocalNotifications } = await import("@capacitor/local-notifications");
  return { ln: LocalNotifications };
}

export async function ensureNotificationPermission(): Promise<Perm> {
  if (isNativeShell()) {
    const { ln } = await plugin();
    const cur = await ln.checkPermissions();
    if (cur.display === "granted") return "granted";
    const res = await ln.requestPermissions();
    return res.display === "granted" ? "granted" : "denied";
  }
  if (typeof Notification === "undefined") return "unsupported";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  const res = await Notification.requestPermission();
  return res === "granted" ? "granted" : "denied";
}

/** A stable positive 31-bit id from a reminder key (Android wants an int). */
export function notificationId(key: string) {
  let h = 2166136261;
  for (const c of key) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 1) || 1;
}

const timers = new Map<string, number>();

/**
 * Make the scheduled reminders exactly `list`: anything FORGE scheduled that
 * is no longer in it is cancelled, the rest (re)scheduled.
 */
export async function scheduleReminders(list: Reminder[]) {
  if (typeof window === "undefined") return;
  if (isNativeShell()) {
    const { ln } = await plugin();
    if ((await ln.checkPermissions()).display !== "granted") return;
    const pending = await ln.getPending();
    const ours = pending.notifications.filter((n) => (n.extra as { forge?: boolean } | undefined)?.forge);
    if (ours.length) await ln.cancel({ notifications: ours.map((n) => ({ id: n.id })) });
    if (!list.length) return;
    await ln.schedule({
      notifications: list.map((r) => ({
        id: notificationId(r.key), title: r.title, body: r.body,
        // Inexact, deliberately. By default the plugin wants exact alarms and,
        // on Android 12+, opens the system "Alarms & reminders" screen to ask
        // for them — on every reschedule, i.e. every time the app opens. A
        // plain alarm may land a few minutes late in deep sleep, which a
        // check-in or a meal can afford.
        schedule: { at: r.at },
        isExactNotification: false,
        smallIcon: "ic_stat_forge", iconColor: "#1FC76F",
        extra: { forge: true, url: r.url },
      })),
    });
    return;
  }
  // Browser: in-page timers, only within the next 36 hours.
  for (const t of timers.values()) clearTimeout(t);
  timers.clear();
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  for (const r of list) {
    const delay = r.at.getTime() - Date.now();
    if (delay <= 0 || delay > 36 * 3600 * 1000) continue;
    timers.set(r.key, window.setTimeout(async () => {
      const reg = await navigator.serviceWorker?.ready.catch(() => null);
      if (reg?.active) reg.active.postMessage({ type: "notify", title: r.title, body: r.body, tag: r.key, url: r.url });
      else new Notification(r.title, { body: r.body });
      timers.delete(r.key);
    }, delay));
  }
}

/** Where a tapped reminder should open. Hard navigation, so documentUrl. */
export function reminderTarget(url: string) {
  const [path, query] = url.split("?");
  const dir = path.endsWith("/") ? path : `${path}/`;
  return documentUrl(dir) + (query ? `?${query}` : "");
}

let listening = false;
/** In the app, a tapped reminder opens the screen it is about. */
export async function listenForReminderTaps() {
  if (listening || !isNativeShell()) return;
  listening = true;
  const { ln } = await plugin();
  await ln.addListener("localNotificationActionPerformed", ({ notification }) => {
    const url = (notification.extra as { url?: string } | undefined)?.url;
    if (url) window.location.href = reminderTarget(url);
  });
}
