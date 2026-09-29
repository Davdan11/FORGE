import type { Adherence, CoachCheckIn, CoachState, Profile, WeighIn } from "../types";
import { explainTargets, goalReached, intendedRate, KCAL_PER_KG, MAX_COACH_ADJUST, bmi, bmr } from "./science";

/* ─────────────────────────────────────────────────────────────
   THE WEEKLY COACH.

   A formula knows the average body. Any one body burns 10–15 %
   more or less than it predicts, which on a 500 kcal deficit is
   the difference between losing on schedule and not losing at
   all. A good coach does not argue with the formula: they read
   the scale for a few weeks and move the food until the body does
   what the plan says. This is that, in four parts.

   1. The trend. One weigh-in says little: water and food swing it
      by a kilo from one morning to the next. The trend is an
      exponentially smoothed weight (a tenth of each new reading,
      per day), the way the serious apps and the Hacker's Diet do.
   2. The real rate. A straight line through the weigh-ins of the
      last three weeks gives kg per week. The first ten days are
      left out: the first drop is water and stored carbs, not fat,
      and reading it as fat would feed people more than they need.
   3. The correction. Measured rate against the rate the plan was
      built for; the gap, in kcal a day, is 7,700 kcal per kg. Half
      of it is applied each week (a coach does not overreact to one
      week), never more than 200 kcal at a time, and the standing
      correction stays inside ±500 kcal. Under 0.15 kg a week of
      gap, nothing moves: that is the scale's own noise.
   4. Honesty about the food. A correction only means something if
      the plan was eaten. The check-in asks, the way a coach does:
      followed all week, most of it, or not really. "Not really"
      changes nothing and says so; "most" moves at half strength.

   The finish line: with a target weight, the weeks to it are
   simulated one at a time at the plan's rate on the weight of that
   week (the deficit shrinks as the body does), with a 10 % allowance
   for adaptation. Targets under a BMI of 18.5 are not offered.
   ───────────────────────────────────────────────────────────── */

const DAY = 86_400_000;
const days = (a: string, b: string) => Math.round((Date.parse(b.slice(0, 10)) - Date.parse(a.slice(0, 10))) / DAY);
const addDaysIso = (iso: string, n: number) => new Date(Date.parse(iso.slice(0, 10)) + n * DAY).toISOString().slice(0, 10);

/** Share of each new day that moves the trend. */
export const TREND_ALPHA = 0.1;
/** Weigh-ins this close to the start are water, not fat. */
export const SETTLE_DAYS = 10;
/** Gaps smaller than this, kg a week, are the scale's noise. */
export const DEADBAND_KG = 0.15;
/** The most one check-in moves the food, kcal a day. */
export const MAX_STEP_KCAL = 200;

/** The smoothed weight, day by day at each weigh-in. Gaps count as the days they span. */
export function trendSeries(weighIns: Pick<WeighIn, "date" | "kg">[]): { date: string; kg: number; trend: number }[] {
  const sorted = [...weighIns].filter((w) => w.kg > 0).sort((a, b) => a.date.localeCompare(b.date));
  const out: { date: string; kg: number; trend: number }[] = [];
  let trend: number | null = null, last: string | null = null;
  for (const w of sorted) {
    if (trend == null || last == null) trend = w.kg;
    else {
      const gap = Math.max(1, days(last, w.date));
      const a = 1 - (1 - TREND_ALPHA) ** gap;
      trend += a * (w.kg - trend);
    }
    last = w.date;
    out.push({ date: w.date, kg: w.kg, trend: Math.round(trend * 100) / 100 });
  }
  return out;
}

/** Least-squares slope through the weigh-ins, kg a week; null with fewer than 3 points or under 10 days. */
export function ratePerWeek(weighIns: Pick<WeighIn, "date" | "kg">[]): number | null {
  if (weighIns.length < 3) return null;
  const t0 = weighIns.reduce((m, w) => (w.date < m ? w.date : m), weighIns[0].date);
  const xs = weighIns.map((w) => days(t0, w.date)), ys = weighIns.map((w) => w.kg);
  const span = Math.max(...xs) - Math.min(...xs);
  if (span < 10) return null;
  const n = xs.length, mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) ** 2; }
  return den ? Math.round((num / den) * 7 * 1000) / 1000 : null;
}

/** The weekly average of a profile's daily targets and of its maintenance, without the coach's correction. */
function weekAverages(p: Profile) {
  const bare: Profile = { ...p, coach: undefined };
  const train = explainTargets(bare, "train"), rest = explainTargets(bare, "rest");
  const d = p.daysPerWeek;
  return { kcal: (train.kcal * d + rest.kcal * (7 - d)) / 7, maintenance: (train.maintenance * d + rest.maintenance * (7 - d)) / 7 };
}

/** What the plan is built to do, kg a week (the formula's rate after its safety bounds). */
export function expectedPerWeek(p: Profile): number {
  const w = weekAverages(p);
  return Math.round((((w.kcal - w.maintenance) * 7) / KCAL_PER_KG) * 1000) / 1000;
}

/** The lightest target offered: a BMI of 18.5. */
export const lowestHealthyKg = (heightCm: number) => Math.round(18.5 * (heightCm / 100) ** 2 * 10) / 10;

export interface Timeline {
  /** Weeks from today to the target at the plan's pace. */
  weeks: number;
  /** ISO date of arrival. */
  date: string;
  /** Kg to go (signed: negative = to lose). */
  toGoKg: number;
  /** Share of the way done since the start weight, 0–1. */
  done: number;
  /** Pace this week, kg (signed). */
  perWeekKg: number;
  /** Weight at each of the next checkpoints (4-weekly), for the chart. */
  checkpoints: { week: number; date: string; kg: number }[];
  /** The target is too slow to reach at this goal's pace (e.g. recomposition over many kilos). */
  slow: boolean;
}

/**
 * The road to the target weight, one week at a time: each week's change is the
 * plan's rate on that week's weight, less 10 % for adaptation. Null without a
 * target, once it is reached, or when the goal does not move the scale.
 */
export function goalTimeline(p: Profile, today: string, fromKg = p.weightKg): Timeline | null {
  const target = p.targetWeightKg;
  if (!target || goalReached({ ...p, weightKg: fromKg })) return null;
  const losing = target < fromKg;
  if (losing && p.goal !== "cut" && p.goal !== "recomp") return null;
  if (!losing && p.goal !== "build") return null;
  let w = fromKg, weeks = 0, first = 0;
  const checkpoints: Timeline["checkpoints"] = [];
  while (weeks < 260) {
    const step = expectedPerWeek({ ...p, weightKg: w }) * 0.9;
    if (weeks === 0) first = step;
    if (Math.abs(step) < 0.02) break;
    w += step; weeks++;
    if (weeks % 4 === 0) checkpoints.push({ week: weeks, date: addDaysIso(today, weeks * 7), kg: Math.round(w * 10) / 10 });
    if (losing ? w <= target : w >= target) break;
  }
  const reached = losing ? w <= target + 0.05 : w >= target - 0.05;
  const start = p.startWeightKg ?? fromKg;
  const span = start - target;
  const done = span ? Math.max(0, Math.min(1, (start - fromKg) / span)) : 0;
  return { weeks, date: addDaysIso(today, weeks * 7), toGoKg: Math.round((target - fromKg) * 10) / 10, done, perWeekKg: Math.round(first * 100) / 100, checkpoints, slow: !reached || weeks > 104 };
}

/** Whether a target makes sense for this goal and body; a sentence when it does not. */
export function checkTarget(p: Pick<Profile, "goal" | "weightKg" | "heightCm">, targetKg: number): { ok: true } | { ok: false; fr: string; en: string } {
  const floor = lowestHealthyKg(p.heightCm);
  if (targetKg < floor) return { ok: false, fr: `Sous un IMC de 18,5 (${floor} kg pour ta taille), ce n’est plus un objectif santé. Choisis au moins ce poids.`, en: `Below a BMI of 18.5 (${floor} kg at your height) is no longer a healthy target. Pick at least that.` };
  if ((p.goal === "cut" || p.goal === "recomp") && targetKg >= p.weightKg) return { ok: false, fr: "Pour perdre, le poids visé doit être sous ton poids actuel.", en: "To lose, the target must be under your current weight." };
  if (p.goal === "build" && targetKg <= p.weightKg) return { ok: false, fr: "Pour prendre du muscle, le poids visé doit être au-dessus de ton poids actuel.", en: "To build, the target must be above your current weight." };
  if (p.goal === "build" && bmi({ weightKg: targetKg, heightCm: p.heightCm }) > 30) return { ok: false, fr: "Ce poids demanderait surtout de prendre du gras. Vise plus près de ton poids actuel.", en: "That weight would mostly mean gaining fat. Aim closer to where you are." };
  return { ok: true };
}

export interface CheckInInput {
  profile: Profile;
  today: string;
  weighIns: Pick<WeighIn, "date" | "kg">[];
  /** When the plan (and its first weigh-in) started. */
  startDate: string;
  adherence: Adherence;
  sessions: { planned: number; done: number };
  meals: { planned: number; done: number };
}

/** The check-in's verdict and the new standing correction. Pure. */
export function checkIn(input: CheckInInput): CoachCheckIn {
  const { profile: p, today, adherence } = input;
  const adjust = p.coach?.adjustKcal ?? 0;
  const settled = addDaysIso(input.startDate, SETTLE_DAYS);
  const window = input.weighIns.filter((w) => w.date >= addDaysIso(today, -21) && w.date <= today && w.date >= settled);
  const series = trendSeries(input.weighIns.filter((w) => w.date <= today));
  const trendKg = series.length ? series[series.length - 1].trend : null;
  const actual = ratePerWeek(window);
  const expected = expectedPerWeek(p);
  const base: Omit<CoachCheckIn, "verdict" | "deltaKcal" | "adjustKcal"> = {
    date: today, trendKg, actualPerWeekKg: actual, expectedPerWeekKg: expected, adherence,
    sessionsDone: input.sessions.done, sessionsPlanned: input.sessions.planned, mealsDone: input.meals.done, mealsPlanned: input.meals.planned,
  };
  if (goalReached(p) && intendedRate(p) === 0 && p.targetWeightKg) {
    // At the finish line: hold the weight. Drift of more than the noise moves the food back to maintenance.
    if (actual == null || Math.abs(actual) < DEADBAND_KG || adherence === "some") return { ...base, verdict: "reached", deltaKcal: 0, adjustKcal: adjust };
  }
  if (actual == null) return { ...base, verdict: "no_data", deltaKcal: 0, adjustKcal: adjust };
  if (adherence === "some") return { ...base, verdict: "off_plan", deltaKcal: 0, adjustKcal: adjust };
  const gap = actual - expected; // + = heavier than planned (losing too slowly / gaining too fast)
  if (Math.abs(gap) < DEADBAND_KG) return { ...base, verdict: "on_track", deltaKcal: 0, adjustKcal: adjust };
  const strength = adherence === "all" ? 0.5 : 0.25;
  const raw = (-gap * KCAL_PER_KG) / 7 * strength;
  const step = Math.round(Math.max(-MAX_STEP_KCAL, Math.min(MAX_STEP_KCAL, raw)) / 10) * 10;
  // Never under the safe floor on any kind of day: past it, less food costs muscle.
  const room = floorRoom(p);
  const lowest = Math.max(-MAX_COACH_ADJUST, -room);
  const next = Math.max(lowest, Math.min(MAX_COACH_ADJUST, adjust + step));
  const atFloor = step < 0 && adjust + step < lowest;
  // Which way the body is off the plan: for a loss, losing faster than planned is "too fast"; for a gain, gaining faster is.
  const losing = expected < -0.02 || (expected <= 0.02 && actual < 0);
  const verdict: CoachCheckIn["verdict"] = losing ? (gap < 0 ? "too_fast" : "too_slow") : (gap > 0 ? "too_fast" : "too_slow");
  return { ...base, verdict, deltaKcal: next - adjust, adjustKcal: next, ...(atFloor ? { atFloor: true } : {}) };
}

/** How many kcal the food can come down before the lightest day hits the safe floor. */
export function floorRoom(p: Profile): number {
  const bare: Profile = { ...p, coach: undefined };
  const floor = Math.max(bmr(p), p.sex === "female" ? 1200 : 1500);
  const lightest = Math.min(explainTargets(bare, "rest").kcal, explainTargets(bare, "train").kcal);
  return Math.max(0, Math.floor((lightest - floor) / 10) * 10);
}

/** The profile's coach state after a check-in (last 26 kept). */
export function withCheckIn(state: CoachState | undefined, c: CoachCheckIn): CoachState {
  const checkIns = [...(state?.checkIns ?? []).filter((x) => x.date !== c.date), c].slice(-26);
  return { adjustKcal: c.adjustKcal, checkIns };
}

/** Days until the next check-in is due; 0 when due now. A week after the plan's start, then weekly. */
export function checkInDueIn(p: Profile, startDate: string, today: string): number {
  const last = p.coach?.checkIns.at(-1)?.date;
  const from = last ?? startDate;
  return Math.max(0, 7 - days(from, today));
}
