import type { Activity, NutritionDay } from "../types";
import { db, getProfile, todayISO } from "../db";
import { dailyTargets, retuneDay, withActivityFuel } from "./engine";

/* ─────────────────────────────────────────────────────────────
   Fuel for the training the plan did not count on.

   The day's targets already feed a planned session: a training day
   sits ~10 % above a rest day, which is the fuel for about an hour
   of work. A watch run on a rest day, or a 2-hour ride on top of the
   plan, is energy the formula never saw — and a coach would put
   some of it back on the plate the same day, mostly as carbs.

   How much: what the day's workouts burned (the watch's figure, or
   FORGE's own estimate), times 0.75 because wrist estimates run
   high, less what the plan already allows for the day type
   (training 300 kcal, a hard day 450, rest 0). Under 80 kcal is
   noise; the top-up is capped at 1,000. Protein does not move.

   The weekly check-in stays honest: it measures the scale against
   everything eaten, this included.
   ───────────────────────────────────────────────────────────── */

export const WRIST_FACTOR = 0.75;
export const PLAN_ALLOWANCE: Record<NutritionDay["dayType"], number> = { rest: 0, train: 300, hard: 450 };

const localDay = (iso: string) => { const d = new Date(iso); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

/** The day's extra fuel, kcal, and what it came from. Pure. */
export function fuelFor(activities: Pick<Activity, "kcal">[], dayType: NutritionDay["dayType"]) {
  const burned = Math.round(activities.reduce((s, a) => s + (a.kcal ?? 0), 0));
  const raw = burned * WRIST_FACTOR - PLAN_ALLOWANCE[dayType];
  const extra = raw < 80 ? 0 : Math.min(1000, Math.round(raw / 10) * 10);
  return { burned, extra };
}

/** Put today's extra fuel into today's menu (eaten meals stay as they are). Returns the extra, kcal. */
export async function applyActivityFuel(date = todayISO()): Promise<number> {
  const [day, profile] = await Promise.all([db.nutrition.get(date), getProfile()]);
  if (!day || !profile) return 0;
  const acts = (await db.activities.toArray()).filter((a) => localDay(a.startedAt) === date);
  const { extra } = fuelFor(acts, day.dayType);
  if (extra === (day.activityKcal ?? 0)) return extra;
  const t = withActivityFuel(dailyTargets(profile, day.dayType), extra);
  const tuned = retuneDay(profile, { ...day, activityKcal: extra });
  await db.nutrition.put({ ...tuned, activityKcal: extra, targets: { kcal: t.kcal, protein: t.protein, carbs: t.carbs, fat: t.fat }, dirty: 1, updatedAt: new Date().toISOString() });
  return extra;
}
