import { addDays, db, getProfile, todayISO } from "./db";
import { remindersFor, type Day } from "./reminders";
import { scheduleReminders } from "./notify";

/** Rebuild the scheduled reminders from today and tomorrow as they are now.
 *  Cheap and idempotent: call it whenever something they depend on changes. */
export async function syncReminders() {
  const profile = await getProfile();
  if (!profile) return;
  const today = todayISO();
  const days: Day[] = await Promise.all([today, addDays(today, 1)].map(async (date) => ({
    date,
    session: (await db.sessions.where("date").equals(date).first()) ?? null,
    nutrition: (await db.nutrition.get(date)) ?? null,
    readiness: (await db.readiness.get(date)) ?? null,
  })));
  await scheduleReminders(remindersFor(profile, days, new Date()));
}
