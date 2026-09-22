import type { Activity, Goal, LoggedSet, Readiness, SessionLog, WeighIn } from "./types";
import { e1rm } from "./units";

/* ─────────────────────────────────────────────────────────────
   Turning the log into something worth reading.

   The app already knows the athlete is getting stronger. Until
   now it never said so. Everything here is a pure function over
   rows, so it can be tested without a browser and reused by any
   screen that wants to show a trend.
   ───────────────────────────────────────────────────────────── */

export const ISO_WEEK_MS = 7 * 86400000;

/** Monday of the week a date falls in. */
export function weekStart(iso: string) {
  const d = new Date(iso.slice(0, 10) + "T00:00:00");
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

/** The last `n` Monday keys, oldest first, including the current week. */
export function recentWeeks(todayISO: string, n: number) {
  const out: string[] = [];
  const start = new Date(weekStart(todayISO) + "T00:00:00");
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(start.getTime() - i * ISO_WEEK_MS);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

export interface Series { label: string; value: number }

/** Sum a numeric field per week, with empty weeks kept at zero so a gap in
 *  training reads as a gap rather than silently closing up. */
export function weekly<T>(rows: T[], dateOf: (r: T) => string, valueOf: (r: T) => number, weeks: string[]): Series[] {
  const totals = new Map(weeks.map((w) => [w, 0]));
  for (const r of rows) {
    const w = weekStart(dateOf(r));
    if (totals.has(w)) totals.set(w, totals.get(w)! + valueOf(r));
  }
  return weeks.map((w) => ({ label: w.slice(5), value: totals.get(w)! }));
}

export interface LiftTrend {
  slug: string;
  /** Best e1RM per session date, oldest first. */
  points: { date: string; e1rm: number }[];
  first: number;
  best: number;
  latest: number;
  /** Percent change from the first logged set to the best one. */
  gainPct: number;
}

/** Strength per movement, from the sets actually logged. */
export function liftTrends(sets: LoggedSet[], minPoints = 2): LiftTrend[] {
  const bySlug = new Map<string, Map<string, number>>();
  for (const s of sets) {
    if (!s.loadKg || !s.reps) continue;
    const date = s.at.slice(0, 10);
    const day = bySlug.get(s.slug) ?? new Map<string, number>();
    day.set(date, Math.max(day.get(date) ?? 0, e1rm(s.loadKg, s.reps)));
    bySlug.set(s.slug, day);
  }
  const out: LiftTrend[] = [];
  for (const [slug, day] of bySlug) {
    const points = [...day.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, v]) => ({ date, e1rm: Math.round(v * 10) / 10 }));
    if (points.length < minPoints) continue;
    const first = points[0].e1rm;
    const best = Math.max(...points.map((p) => p.e1rm));
    out.push({ slug, points, first, best, latest: points[points.length - 1].e1rm, gainPct: first > 0 ? Math.round(((best - first) / first) * 1000) / 10 : 0 });
  }
  return out.sort((a, b) => b.gainPct - a.gainPct);
}

export interface Consistency {
  /** Sessions completed per week. */
  sessions: Series[];
  weeksTrained: number;
  weeksTotal: number;
  /** Longest run of consecutive weeks with at least one session. */
  longestRun: number;
}

export function consistency(logs: SessionLog[], activities: Activity[], weeks: string[]): Consistency {
  const counts = new Map(weeks.map((w) => [w, 0]));
  for (const l of logs) { const w = weekStart(l.startedAt); if (counts.has(w)) counts.set(w, counts.get(w)! + 1); }
  for (const a of activities) { const w = weekStart(a.startedAt); if (counts.has(w)) counts.set(w, counts.get(w)! + 1); }
  const series = weeks.map((w) => ({ label: w.slice(5), value: counts.get(w)! }));
  let run = 0, longest = 0;
  for (const s of series) { run = s.value > 0 ? run + 1 : 0; longest = Math.max(longest, run); }
  return { sessions: series, weeksTrained: series.filter((s) => s.value > 0).length, weeksTotal: series.length, longestRun: longest };
}

/**
 * Slope over completed weeks only.
 *
 * The final bucket is the week in progress. On a Tuesday it holds one session
 * out of four, so including it drags every trend downwards and tells someone
 * their volume is collapsing when they are simply mid-week. Judge them on
 * weeks that have actually finished.
 */
export const trendOfCompleted = (series: Series[]) => trendPerWeek(series.slice(0, -1).map((s) => s.value));

/** Least-squares slope per week — the direction a series is actually heading. */
export function trendPerWeek(values: number[]) {
  const n = values.length;
  if (n < 2) return 0;
  const mx = (n - 1) / 2;
  const my = values.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { num += (i - mx) * (values[i] - my); den += (i - mx) ** 2; }
  return den === 0 ? 0 : num / den;
}

export interface GoalRead {
  headline: string;
  detail: string;
  /** 0–1, how well the last few weeks match what the goal needs. */
  onTrack: number;
  /** The single thing most worth fixing, when there is one. */
  missing?: string;
}

/**
 * Read the log against the goal the athlete chose, and say one useful thing.
 * Deliberately blunt about what is missing and never scolding about it — the
 * point is to keep someone training, not to grade them.
 */
export function readGoal(input: {
  goal: Goal;
  weights: WeighIn[];
  lifts: LiftTrend[];
  tonnage: Series[];
  distance: Series[];
  consistency: Consistency;
  readiness: Readiness[];
}): GoalRead {
  const { goal, weights, lifts, tonnage, distance, consistency: c } = input;
  const consistencyScore = c.weeksTotal ? c.weeksTrained / c.weeksTotal : 0;
  const wSeries = [...weights].sort((a, b) => a.date.localeCompare(b.date)).map((w) => w.kg);
  const weightSlope = trendPerWeek(wSeries);
  const strengthGain = lifts.length ? Math.max(...lifts.map((l) => l.gainPct)) : 0;
  const tonnageSlope = trendOfCompleted(tonnage);
  const distanceSlope = trendOfCompleted(distance);

  const thin = c.weeksTrained < 3;
  if (thin) {
    return {
      headline: "Too early to call",
      detail: `${c.weeksTrained} week${c.weeksTrained === 1 ? "" : "s"} logged so far. Trends need about three before they mean anything — keep going and this page fills in.`,
      onTrack: consistencyScore,
    };
  }

  const consistencyMiss = consistencyScore < 0.6
    ? `You trained ${c.weeksTrained} of the last ${c.weeksTotal} weeks. Everything below moves faster at four.`
    : undefined;

  switch (goal) {
    case "cut": {
      const perWeek = Math.round(weightSlope * 10) / 10;
      const good = perWeek < 0 && perWeek > -1.2;
      return {
        headline: good ? "Losing at a sustainable rate" : perWeek >= 0 ? "Weight is not moving down" : "Coming off faster than ideal",
        detail: wSeries.length < 2
          ? "Log your weight a couple of times a week — without it there is no way to tell a cut from maintenance."
          : `${perWeek > 0 ? "+" : ""}${perWeek} kg a week over ${wSeries.length} weigh-ins. Strength is holding at ${strengthGain >= 0 ? "+" : ""}${strengthGain}% on your best lift, which is what matters in a deficit.`,
        onTrack: good ? 0.85 : 0.45,
        missing: consistencyMiss ?? (perWeek >= 0 ? "Calories, most likely. The training side is doing its job." : undefined),
      };
    }
    case "build": {
      const good = strengthGain > 2 && tonnageSlope >= 0;
      return {
        headline: good ? "Building" : "Volume is flat",
        detail: `Your best lift is up ${strengthGain}% since you started logging it, and weekly tonnage is ${tonnageSlope >= 0 ? "climbing" : "falling"}. Muscle follows load that keeps going up.`,
        onTrack: good ? 0.85 : 0.5,
        missing: consistencyMiss ?? (tonnageSlope < 0 ? "Sets, not intensity. Add a set to your main lifts before adding weight." : undefined),
      };
    }
    case "strength": {
      const good = strengthGain > 3;
      return {
        headline: good ? "Getting stronger" : "Strength has stalled",
        detail: `${lifts.length} movement${lifts.length === 1 ? "" : "s"} tracked. Best gain: ${strengthGain}%.`,
        onTrack: good ? 0.9 : 0.45,
        missing: consistencyMiss ?? (good ? undefined : "A deload. Stalls at this point are usually fatigue, not a missing exercise."),
      };
    }
    case "endurance": case "perform": {
      const km = Math.round(distance.reduce((a, d) => a + d.value, 0) / 1000);
      const good = distanceSlope >= 0 && km > 0;
      return {
        headline: good ? "Base is growing" : "Mileage is drifting down",
        detail: `${km} km over the last ${distance.length} weeks, ${distanceSlope >= 0 ? "trending up" : "trending down"}.`,
        onTrack: good ? 0.85 : 0.45,
        missing: consistencyMiss ?? (distanceSlope < 0 ? "Easy minutes. Most of the base is built well below the pace that feels productive." : undefined),
      };
    }
    default: {
      const good = strengthGain > 1 && weightSlope <= 0.1;
      return {
        headline: good ? "Recomposition is working" : "Mixed signals",
        detail: `Strength ${strengthGain >= 0 ? "up" : "down"} ${Math.abs(strengthGain)}%, body weight ${weightSlope > 0.05 ? "rising" : weightSlope < -0.05 ? "falling" : "steady"}. Holding weight while lifting more is exactly the shape of a recomp.`,
        onTrack: good ? 0.8 : 0.5,
        missing: consistencyMiss,
      };
    }
  }
}
