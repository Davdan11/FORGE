import { addDays, db, getProfile, getStats, todayISO } from "./db";
import { remindedEvents } from "./eventReminders";
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
  // The streak: has anything counted since Monday?
  const monday = new Date(); monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7)); monday.setHours(0, 0, 0, 0);
  const since = monday.toISOString();
  const [stats, doneSessions, activities] = await Promise.all([
    getStats(),
    db.sessions.filter((x) => x.status === "done" && x.date >= since.slice(0, 10)).count(),
    db.activities.filter((a) => a.startedAt >= since).count(),
  ]);
  await scheduleReminders(remindersFor(profile, days, new Date(), {
    events: remindedEvents(),
    streak: stats ? { weeks: stats.streakWeeks ?? 0, thisWeekDone: doneSessions + activities > 0 } : undefined,
  }));
}
