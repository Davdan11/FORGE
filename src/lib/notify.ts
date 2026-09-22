/* Local notifications: permission, and in-page scheduling that hands the
   actual notification to the service worker (works while the PWA is open
   or recently backgrounded). Server push comes with the Supabase layer. */

export async function ensureNotificationPermission() {
  if (typeof Notification === "undefined") return "unsupported" as const;
  if (Notification.permission === "granted") return "granted" as const;
  if (Notification.permission === "denied") return "denied" as const;
  const res = await Notification.requestPermission();
  return res === "granted" ? ("granted" as const) : ("denied" as const);
}

const timers = new Map<string, number>();

export async function scheduleLocal(id: string, at: Date, title: string, body: string, url = "/food") {
  if (typeof window === "undefined") return;
  const delay = at.getTime() - Date.now();
  if (delay <= 0 || delay > 36 * 3600 * 1000) return;
  clearLocal(id);
  const t = window.setTimeout(async () => {
    const reg = await navigator.serviceWorker?.ready.catch(() => null);
    if (reg?.active) reg.active.postMessage({ type: "notify", title, body, tag: id, url });
    else if (typeof Notification !== "undefined" && Notification.permission === "granted") new Notification(title, { body });
    timers.delete(id);
  }, delay);
  timers.set(id, t);
}

export function clearLocal(id: string) {
  const t = timers.get(id);
  if (t) { clearTimeout(t); timers.delete(id); }
}

export function atTime(dateISO: string, hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(dateISO + "T00:00:00");
  d.setHours(h, m, 0, 0);
  return d;
}
