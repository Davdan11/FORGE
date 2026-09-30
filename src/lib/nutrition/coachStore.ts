import type { Adherence, CoachCheckIn } from "../types";
import { db, addDays, getProfile, todayISO } from "../db";
import { checkIn, checkInDueIn, goalTimeline, trendSeries, withCheckIn } from "./coach";
import { dailyTargets, eatenTotals, retuneDay } from "./engine";
import { suggestAdherence } from "./foodlog";

/* The weekly coach against the local database: what the week held, the
   check-in itself, and the menus it re-tunes. The logic is in ./coach.ts. */

/** The day the plan started: the first plan's start, else the profile's creation. */
export async function planStart(): Promise<string> {
  const plans = await db.plans.toArray();
  const first = plans.map((p) => p.startDate).filter(Boolean).sort()[0];
  const p = await getProfile();
  return first ?? p?.createdAt.slice(0, 10) ?? todayISO();
}

/** The last seven days (today excluded): sessions and meals planned and done. */
export async function lastWeek(today = todayISO()) {
  const from = addDays(today, -7), to = addDays(today, -1);
  const sessions = await db.sessions.where("date").between(from, to, true, true).toArray();
  const days = await db.nutrition.where("date").between(from, to, true, true).toArray();
  const meals = days.flatMap((d) => d.meals);
  // Real intake against the plan, on the days something was logged (ticked
  // meals or food eaten off the plan): an unlogged day is unknown, not zero.
  const logged = days.filter((d) => d.meals.some((m) => m.done && !m.skipped) || (d.extras?.length ?? 0) > 0);
  const eatenKcal = logged.reduce((a, d) => a + eatenTotals(d).kcal, 0);
  const plannedKcal = logged.reduce((a, d) => a + d.targets.kcal, 0);
  return {
    sessions: { planned: sessions.length, done: sessions.filter((s) => s.status === "done").length },
    meals: { planned: meals.length, done: meals.filter((m) => m.done && !m.skipped).length },
    intake: logged.length ? { days: logged.length, eatenKcal: Math.round(eatenKcal), plannedKcal: Math.round(plannedKcal) } : null,
  };
}

/** Everything the goal and check-in cards need, in one read. */
export async function coachSnapshot(today = todayISO()) {
  const profile = await getProfile();
  if (!profile) return null;
  const [start, weighIns, week] = await Promise.all([planStart(), db.weights.orderBy("date").toArray(), lastWeek(today)]);
  const series = trendSeries(weighIns);
  const trendKg = series.at(-1)?.trend ?? null;
  return {
    profile, start, weighIns, series, trendKg, week,
    dueIn: checkInDueIn(profile, start, today),
    timeline: goalTimeline(profile, today, trendKg ?? profile.weightKg),
    last: profile.coach?.checkIns.at(-1) ?? null,
    /** The adherence answer the week's own log points to; the athlete can change it. */
    suggested: suggestAdherence({ mealsDone: week.meals.done, mealsPlanned: week.meals.planned, eatenKcal: week.intake?.eatenKcal, plannedKcal: week.intake?.plannedKcal }),
  };
}

/** What a check-in would say, without saving it (the card shows it before "Apply"). */
export async function previewCheckIn(adherence: Adherence, today = todayISO()): Promise<CoachCheckIn | null> {
  const s = await coachSnapshot(today);
  if (!s) return null;
  const c = checkIn({ profile: s.profile, today, weighIns: s.weighIns, startDate: s.start, adherence, sessions: s.week.sessions, meals: s.week.meals });
  const i = s.week.intake;
  return i ? { ...c, eatenKcalAvg: Math.round(i.eatenKcal / i.days), plannedKcalAvg: Math.round(i.plannedKcal / i.days) } : c;
}

/** Save the check-in, then re-tune today's and later menus to the new targets (eaten meals are left as they are). */
export async function applyCheckIn(adherence: Adherence, today = todayISO()): Promise<CoachCheckIn | null> {
  const c = await previewCheckIn(adherence, today);
  const profile = await getProfile();
  if (!c || !profile) return null;
  const coach = withCheckIn(profile.coach, c);
  const next = { ...profile, coach };
  await db.profile.update(profile.id, { coach, dirty: 1, updatedAt: new Date().toISOString() });
  if (c.deltaKcal !== 0) {
    const days = await db.nutrition.where("date").aboveOrEqual(today).toArray();
    for (const d of days) {
      const t = dailyTargets(next, d.dayType);
      const tuned = retuneDay(next, { ...d, targets: { kcal: t.kcal, protein: t.protein, carbs: t.carbs, fat: t.fat } });
      await db.nutrition.put({ ...tuned, dirty: 1, updatedAt: new Date().toISOString() });
    }
  }
  return c;
}
