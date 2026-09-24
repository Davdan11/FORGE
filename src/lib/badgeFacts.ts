import type { Activity, BadgeContext, NutritionDay, Profile, Session } from "./types";

/* ─────────────────────────────────────────────────────────────
   What the badges look at, derived from saved rows.

   The award path (lib/progress.ts finalize) and the badge list
   (progress page) both build their context here, so a progress
   bar and the unlock it leads to always read the same numbers.
   Pure: tested without a database.
   ───────────────────────────────────────────────────────────── */

/** The FORGE Ride trophy case, as the game writes it (RidePalmares.cs). */
export interface Palmares {
  /** kind: 0 climb, 1 sprint. medal: 0 none, 1 bronze, 2 silver, 3 gold (real efforts only). */
  segments: { route: number; start: number; name: string; kind: number; medal: number }[];
  routes: { route: number; finishes: number }[];
  workouts: { id: string; done: number }[];
}

const EMPTY: Palmares = { segments: [], routes: [], workouts: [] };
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const rows = (v: unknown): Record<string, unknown>[] =>
  Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => !!x && typeof x === "object") : [];

/**
 * The palmarès saved on the profile (a JSON string, bare or wrapped as
 * `{data: …}` like the game's envelope). Anything unreadable is an empty case,
 * never an error: a corrupt trophy case must not stop a session from saving.
 */
export function parsePalmares(raw: unknown): Palmares {
  let v: unknown = raw;
  if (typeof v === "string") {
    if (!v.trim()) return EMPTY;
    try { v = JSON.parse(v); } catch { return EMPTY; }
  }
  if (!v || typeof v !== "object") return EMPTY;
  const o = v as Record<string, unknown>;
  const d = (o.data && typeof o.data === "object" && !Array.isArray(o.data) ? o.data : o) as Record<string, unknown>;
  return {
    segments: rows(d.segments).map((s) => ({ route: num(s.route), start: num(s.start), name: typeof s.name === "string" ? s.name : "", kind: num(s.kind), medal: num(s.medal) })),
    routes: rows(d.routes).map((r) => ({ route: num(r.route), finishes: num(r.finishes) })),
    workouts: rows(d.workouts).map((w) => ({ id: typeof w.id === "string" ? w.id : "", done: num(w.done) })),
  };
}

export function medalFacts(p: Palmares): NonNullable<BadgeContext["medals"]> {
  const gold = p.segments.filter((s) => s.medal === 3);
  return {
    gold: gold.length,
    climbGold: gold.filter((s) => s.kind === 0).length,
    sprintGold: gold.filter((s) => s.kind === 1).length,
    any: p.segments.filter((s) => s.medal > 0).length,
  };
}

/** The game's FTP tests are "Test FTP 20 min" / "FTP test 20 min" and "Test rampe" / "Ramp test". */
export const isFtpTest = (workout?: string) => !!workout && /\bftp\b|\bramp(e)?\b/i.test(workout);

type Act = Pick<Activity, "type" | "startedAt" | "distanceM" | "durationSec" | "elevGainM"> & Partial<Pick<Activity, "movingSec" | "meta">>;

export function indoorFacts(acts: Act[]): NonNullable<BadgeContext["indoor"]> {
  const rides = acts.filter((a) => a.type === "ride" && a.meta?.indoor);
  // Effort typed on a slider moves the avatar, not the totals (the XP rule too).
  const counted = rides.filter((a) => a.meta!.indoor!.quality !== "declared");
  return {
    rides: rides.length,
    km: counted.reduce((s, a) => s + a.distanceM, 0) / 1000,
    climbM: counted.reduce((s, a) => s + a.elevGainM, 0),
    hours: counted.reduce((s, a) => s + (a.movingSec ?? a.durationSec), 0) / 3600,
    workouts: counted.filter((a) => a.meta!.indoor!.workoutDone).length,
    ftpTests: counted.filter((a) => a.meta!.indoor!.workoutDone && isFtpTest(a.meta!.indoor!.workout)).length,
    groupRides: counted.filter((a) => (a.meta!.indoor!.with ?? 0) > 0).length,
    powerRides: rides.filter((a) => a.meta!.indoor!.quality === "measured").length,
  };
}

/** A run whose average is faster than 2:30 /km was not run. */
const plausibleRun = (a: Act) => { const sec = a.movingSec ?? a.durationSec; return sec > 0 && a.distanceM / sec < 6.7; };
/** Started between 4:00 and 6:59, local time. */
const early = (iso: string) => { const d = new Date(iso); const h = d.getHours(); return !Number.isNaN(h) && h >= 4 && h < 7; };

export function outdoorFacts(acts: Act[]): NonNullable<BadgeContext["outdoor"]> {
  const out = acts.filter((a) => !a.meta?.indoor && a.meta?.discipline !== "indoor");
  const runs = out.filter((a) => a.type === "run" && plausibleRun(a));
  return {
    longestRunM: runs.reduce((m, a) => Math.max(m, a.distanceM), 0),
    runKm: runs.reduce((s, a) => s + a.distanceM, 0) / 1000,
    climbM: out.reduce((s, a) => s + (a.elevGainM || 0), 0),
    earlyStarts: acts.filter((a) => early(a.startedAt)).length,
    sports: new Set(acts.map((a) => a.type)).size,
  };
}

/** Weeks where every planned session was done (at least two planned). */
export function fullWeeksOf(sessions: Pick<Session, "kind" | "planId" | "week" | "status">[]) {
  const byWeek = new Map<string, { planned: number; done: number }>();
  for (const s of sessions) {
    if (s.kind === "rest") continue;
    const k = `${s.planId}:${s.week}`;
    const w = byWeek.get(k) ?? { planned: 0, done: 0 };
    w.planned++; if (s.status === "done") w.done++;
    byWeek.set(k, w);
  }
  return [...byWeek.values()].filter((w) => w.planned >= 2 && w.done === w.planned).length;
}

export const isFullDay = (n: Pick<NutritionDay, "meals">) => n.meals.length > 0 && n.meals.every((m) => m.done);

export function badgeContext(input: {
  best: Record<string, number>;
  profile?: Pick<Profile, "weightKg" | "startWeightKg" | "goal" | "indoorGame">;
  activities: Act[];
  /** Weigh-ins in date order. */
  weighIns: { kg: number }[];
  sessions: Pick<Session, "kind" | "planId" | "week" | "status">[];
  readinessCount: number;
  nutrition: Pick<NutritionDay, "meals">[];
}): BadgeContext {
  const { best, profile, activities: acts, weighIns } = input;
  const best5kSec = acts.filter((a) => a.type === "run" && a.distanceM >= 5000).map((a) => (a.durationSec * 5000) / a.distanceM).sort((a, b) => a - b)[0];
  // Body change since day one: the profile's start weight, or the first weigh-in.
  const start = profile?.startWeightKg ?? weighIns[0]?.kg;
  const latest = weighIns.length ? weighIns[weighIns.length - 1].kg : profile?.weightKg;
  return {
    bestE1rm: best,
    bodyweightKg: profile?.weightKg ?? 80,
    best5kSec,
    zone2Min: acts.reduce((a, b) => a + b.durationSec / 60, 0),
    weightChangeKg: start != null && latest != null ? latest - start : undefined,
    goal: profile?.goal,
    fullWeeks: fullWeeksOf(input.sessions),
    indoor: indoorFacts(acts),
    medals: medalFacts(parsePalmares(profile?.indoorGame?.palmares)),
    outdoor: outdoorFacts(acts),
    checkIns: input.readinessCount,
    weighIns: weighIns.length,
    fullDays: input.nutrition.filter(isFullDay).length,
  };
}
