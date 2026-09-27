/* Indoor events (group rides, races, time trials) the rider asked to be reminded of: kept on the device, dropped once
   they have started. lib/reminders.ts turns them into a notification ten minutes before. */
import { scheduled, type GameEvent } from "./indoor/forgeRide";
import { tr } from "./i18n";

const KEY = "forge.remindEvents";
const slotOf = (id: string) => Number(id.replace("forge-", ""));

function load(): string[] { try { return JSON.parse(localStorage.getItem(KEY) ?? "[]") as string[]; } catch { return []; } }
function save(ids: string[]) { try { localStorage.setItem(KEY, JSON.stringify(ids)); } catch { /* private mode */ } }

export function isReminded(id: string) { return load().includes(id); }

export function toggleReminder(e: GameEvent): boolean {
  const ids = load(); const on = !ids.includes(e.id);
  save(on ? [...ids, e.id] : ids.filter((x) => x !== e.id));
  return on;
}

export function remindedEvents(now = Date.now()) {
  const keep = load().filter((id) => scheduled(slotOf(id)).start.getTime() > now);
  save(keep);
  return keep.map((id) => { const e = scheduled(slotOf(id)); return { id, title: tr(e.title.fr, e.title.en), route: tr(e.route.name.fr, e.route.name.en), start: e.start }; });
}

/** "Remind me" on an event: asks for notifications the first time (and switches the app's reminders on), then
 *  reschedules. Returns whether it is now on, or "denied" when the phone refuses notifications. */
export async function remindMe(e: GameEvent): Promise<boolean | "denied"> {
  const on = toggleReminder(e);
  if (on) {
    const { ensureNotificationPermission } = await import("./notify");
    if (await ensureNotificationPermission() !== "granted") { toggleReminder(e); return "denied"; }
    const { db, getProfile } = await import("./db");
    const p = await getProfile();
    if (p && !p.notifications) await db.profile.update(p.id, { notifications: true, dirty: 1, updatedAt: new Date().toISOString() });
  }
  const { syncReminders } = await import("./remindersSync");
  await syncReminders();
  return on;
}
