import type { Activity, ActivityType, DistanceUnit } from "./types";
import { sportSpec } from "./data/sports";
import { verifyActivity } from "./verify";
import { addDays, isoWeek } from "./db";
import { getLang, locale, tr } from "./i18n";

/* ─────────────────────────────────────────────────────────────
   Sport challenges.

   One for today and three for the week, for whichever sport the
   athlete has picked. Each is measured the way that sport is
   measured — kilometres for a run, vertical for alpine, minutes
   on the ice for hockey — and sized from that athlete's own last
   four weeks in it: about ten percent past what they usually do.
   A first-timer gets a sensible default instead.

   Progress counts only what the track supports (see ./verify.ts),
   so a challenge cannot be finished from a car. The targets come
   from the four weeks BEFORE the period, so the activity that
   completes a challenge can never move its goalposts.
   ───────────────────────────────────────────────────────────── */

export type ChallengeKind =
  | "distance" | "moving" | "climb" | "descent" | "negative_split"                // one outing
  | "distance_total" | "moving_total" | "climb_total" | "descent_total" | "sessions"; // the whole week

export interface Challenge {
  /** `<scope>:<period>:<sport>:<kind>` — stable, so completion is paid once. */
  id: string;
  sport: ActivityType;
  scope: "day" | "week";
  /** ISO date for a day, ISO week ("2026-W39") for a week. */
  period: string;
  kind: ChallengeKind;
  title: string;
  detail: string;
  target: number;
  progress: number;
  unit: "m" | "min" | "count" | "done";
  done: boolean;
  xp: number;
}

export const CHALLENGE_XP = { day: 80, week: 200, sessions: 150 } as const;

/* Sports that climb enough for a climbing challenge to mean something. */
const CLIMBY = new Set<ActivityType>(["trail", "hike", "ruck", "ride", "mtb", "gravel"]);

/* First-timer targets, per outing. Weekly targets are two outings' worth. */
const DEFAULT_DISTANCE: Partial<Record<ActivityType, number>> = {
  run: 3000, trail: 4000, walk: 3000, hike: 5000, ruck: 3000,
  ride: 15000, mtb: 10000, gravel: 20000, skate: 8000,
  ski: 5000, ice_skate: 4000, swim: 800, row: 3000, kayak: 3000,
};
const DEFAULT_CLIMB: Partial<Record<ActivityType, number>> = { trail: 150, hike: 300, ruck: 100, ride: 200, mtb: 250, gravel: 200 };
const DEFAULT_DESCENT = 1500;
const defaultMinutes = (t: ActivityType) => (sportSpec(t).group === "field" || t === "surf" || t === "climb" || t === "boulder" ? 45 : t === "skydive" ? 15 : 30);

/** What one activity counts for, after verification. */
export function measure(a: Activity) {
  const v = verifyActivity(a.points ?? [], a.type, a.durationSec);
  const credit = v.credit;
  return {
    distanceM: v.verifiedDistanceM || (credit > 0 ? a.distanceM : 0),
    movingMin: v.movingSec / 60,
    climbM: a.elevGainM * credit,
    descentM: (a.elevLossM ?? 0) * credit,
    negativeSplit: credit > 0 && negativeSplit(a),
  };
}

/** Second half faster than the first, over at least four full splits. */
export function negativeSplit(a: Pick<Activity, "splits">) {
  const s = a.splits ?? [];
  if (s.length < 4) return false;
  const half = Math.floor(s.length / 2);
  const avg = (xs: { sec: number }[]) => xs.reduce((t, x) => t + x.sec, 0) / xs.length;
  return avg(s.slice(s.length - half)) < avg(s.slice(0, half));
}

/** Which challenges a sport has, by how the sport is measured. */
function kindsFor(t: ActivityType): { day: ChallengeKind[]; week: ChallengeKind[] } {
  const spec = sportSpec(t);
  if ((spec.metric === "vertical" && spec.gps) || t === "ski_alpine" || t === "snowboard")
    return { day: ["descent", "moving"], week: ["descent_total", "sessions", "moving_total"] };
  if (spec.metric === "distance") {
    const climby = CLIMBY.has(t);
    return {
      day: ["distance", "moving", ...(climby ? ["climb" as const] : []), ...(t === "run" || t === "trail" ? ["negative_split" as const] : [])],
      week: ["distance_total", "sessions", climby ? "climb_total" : "moving_total"],
    };
  }
  return { day: ["moving"], week: ["moving_total", "sessions"] };
}

/* A small stable hash, so the day's challenge is the same on every screen
   and every reload, and still changes from one day to the next. */
function hash(s: string) { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }

const nice = (n: number, step: number) => Math.max(step, Math.round(n / step) * step);
const distStep = (m: number) => (m < 2000 ? 100 : 500);

/** Usual effort in a sport over the 28 days before `before`. */
export function baseline(activities: Activity[], sport: ActivityType, before: string) {
  const from = addDays(before, -28);
  const past = activities.filter((a) => a.type === sport && a.startedAt.slice(0, 10) >= from && a.startedAt.slice(0, 10) < before).map(measure);
  const n = past.length;
  const sum = (k: keyof ReturnType<typeof measure>) => past.reduce((t, m) => t + Number(m[k]), 0);
  return n === 0 ? null : {
    count: n,
    distanceM: sum("distanceM") / n, movingMin: sum("movingMin") / n, climbM: sum("climbM") / n, descentM: sum("descentM") / n,
    weekDistanceM: sum("distanceM") / 4, weekMovingMin: sum("movingMin") / 4, weekClimbM: sum("climbM") / 4, weekDescentM: sum("descentM") / 4, weekCount: n / 4,
  };
}

function target(kind: ChallengeKind, sport: ActivityType, b: ReturnType<typeof baseline>): number {
  const up = 1.1;
  const dist = DEFAULT_DISTANCE[sport] ?? 3000, climb = DEFAULT_CLIMB[sport] ?? 150, mins = defaultMinutes(sport);
  switch (kind) {
    case "distance": { const m = b?.distanceM ? b.distanceM * up : dist; return nice(m, distStep(m)); }
    case "moving": return nice(b?.movingMin ? b.movingMin * up : mins, 5);
    case "climb": return nice(b?.climbM ? b.climbM * up : climb, 50);
    case "descent": return nice(b?.descentM ? b.descentM * up : DEFAULT_DESCENT, 100);
    case "negative_split": return 1;
    case "distance_total": { const m = b?.weekDistanceM ? b.weekDistanceM * up : dist * 2; return nice(m, distStep(m)); }
    case "moving_total": return nice(b?.weekMovingMin ? b.weekMovingMin * up : mins * 2, 5);
    case "climb_total": return nice(b?.weekClimbM ? b.weekClimbM * up : climb * 2, 50);
    case "descent_total": return nice(b?.weekDescentM ? b.weekDescentM * up : DEFAULT_DESCENT * 2, 100);
    case "sessions": return Math.min(5, Math.max(2, Math.round(b?.weekCount ?? 1) + 1));
  }
}

export function fmtTarget(kind: ChallengeKind, n: number, units: DistanceUnit) {
  if (kind === "distance" || kind === "distance_total") {
    if (units === "mi") return `${(Math.round((n / 1609.344) * 10) / 10).toLocaleString(locale())} mi`;
    return n < 2000 ? `${n.toLocaleString(locale())} m` : `${(n / 1000).toLocaleString(locale())} km`;
  }
  if (kind === "climb" || kind === "climb_total" || kind === "descent" || kind === "descent_total") return `${n.toLocaleString(locale())} m`;
  return n.toLocaleString(locale());
}

function words(kind: ChallengeKind, sport: ActivityType, t: string, usual: string | null): { title: string; detail: string } {
  if (getLang() === "fr") return wordsFr(kind, t, usual);
  const noun = sportSpec(sport).label.toLowerCase();
  const said = usual ? `Your usual is ${usual}.` : "Your first one sets your baseline.";
  switch (kind) {
    case "distance": return { title: `${t} in one go`, detail: `One ${noun}, ${t} or more. ${said}` };
    case "moving": return { title: `${t} minutes moving`, detail: `One ${noun}, counting moving time only: stops don't count. ${said}` };
    case "climb": return { title: `Climb ${t}`, detail: `${t} of elevation gain in a single outing. ${said}` };
    case "descent": return { title: `${t} of vertical`, detail: `Ride down ${t} today, lifts excluded. ${said}` };
    case "negative_split": return { title: "Negative split", detail: "At least 4 km, with the second half faster than the first. Start easy on purpose." };
    case "distance_total": return { title: `${t} this week`, detail: `Every ${noun} outing this week adds up. ${said}` };
    case "moving_total": return { title: `${t} minutes this week`, detail: `Total moving time across the week. ${said}` };
    case "climb_total": return { title: `${t} of climbing this week`, detail: `Every outing's elevation gain adds up. ${said}` };
    case "descent_total": return { title: `${t} of vertical this week`, detail: `Across every day on the hill. ${said}` };
    case "sessions": return { title: `${t} outings this week`, detail: `Consistency beats one big day. ${said}` };
  }
}

/* French: the sport's name is left out ("une sortie"), which reads naturally and needs no gendered noun. */
function wordsFr(kind: ChallengeKind, t: string, usual: string | null): { title: string; detail: string } {
  const said = usual ? `D’habitude, tu fais ${usual}.` : "Ta première sortie fixe ta référence.";
  switch (kind) {
    case "distance": return { title: `${t} d’un coup`, detail: `Une sortie, ${t} ou plus. ${said}` };
    case "moving": return { title: `${t} minutes en mouvement`, detail: `Une sortie, seul le temps en mouvement compte : les arrêts comptent pas. ${said}` };
    case "climb": return { title: `Grimpe ${t}`, detail: `${t} de dénivelé positif en une seule sortie. ${said}` };
    case "descent": return { title: `${t} de dénivelé`, detail: `Descends ${t} aujourd’hui, remontées mécaniques exclues. ${said}` };
    case "negative_split": return { title: "Split négatif", detail: "Au moins 4 km, avec la deuxième moitié plus rapide que la première. Pars lentement exprès." };
    case "distance_total": return { title: `${t} cette semaine`, detail: `Chaque sortie de la semaine s’additionne. ${said}` };
    case "moving_total": return { title: `${t} minutes cette semaine`, detail: `Temps total en mouvement sur la semaine. ${said}` };
    case "climb_total": return { title: `${t} de montée cette semaine`, detail: `Le dénivelé de chaque sortie s’additionne. ${said}` };
    case "descent_total": return { title: `${t} de dénivelé cette semaine`, detail: `Sur toutes tes journées sur la pente. ${said}` };
    case "sessions": return { title: `${t} sorties cette semaine`, detail: `La régularité bat une grosse journée. ${said}` };
  }
}

function usualFor(kind: ChallengeKind, b: ReturnType<typeof baseline>, units: DistanceUnit): string | null {
  if (!b) return null;
  const round = (k: ChallengeKind, n: number) => fmtTarget(k, k.startsWith("distance") ? nice(n, distStep(n)) : k === "sessions" ? Math.round(n) : nice(n, k.includes("moving") ? 5 : 50), units);
  switch (kind) {
    case "distance": return round(kind, b.distanceM);
    case "moving": return `${round(kind, b.movingMin)} min`;
    case "climb": return round(kind, b.climbM);
    case "descent": return round(kind, b.descentM);
    case "distance_total": return `${round(kind, b.weekDistanceM)} ${tr("par semaine", "a week")}`;
    case "moving_total": return `${round(kind, b.weekMovingMin)} ${tr("min par semaine", "min a week")}`;
    case "climb_total": return `${round(kind, b.weekClimbM)} ${tr("par semaine", "a week")}`;
    case "descent_total": return `${round(kind, b.weekDescentM)} ${tr("par semaine", "a week")}`;
    case "sessions": return `${Math.max(1, Math.round(b.weekCount))} ${tr("par semaine", "a week")}`;
    default: return null;
  }
}

function progressOf(kind: ChallengeKind, done: ReturnType<typeof measure>[]): number {
  const best = (k: "distanceM" | "movingMin" | "climbM") => Math.max(0, ...done.map((m) => m[k]));
  const total = (k: "distanceM" | "movingMin" | "climbM" | "descentM") => done.reduce((t, m) => t + m[k], 0);
  switch (kind) {
    case "distance": return best("distanceM");
    case "moving": return best("movingMin");
    case "climb": return best("climbM");
    case "descent": return total("descentM");                 // a ski day is many runs
    case "negative_split": return done.some((m) => m.negativeSplit) ? 1 : 0;
    case "distance_total": return total("distanceM");
    case "moving_total": return total("movingMin");
    case "climb_total": return total("climbM");
    case "descent_total": return total("descentM");
    case "sessions": return done.length;
  }
}

function build(scope: "day" | "week", period: string, periodStart: string, periodEnd: string, kind: ChallengeKind, sport: ActivityType, activities: Activity[], units: DistanceUnit): Challenge {
  const b = baseline(activities, sport, periodStart);
  const goal = target(kind, sport, b);
  const inPeriod = activities.filter((a) => a.type === sport && a.startedAt.slice(0, 10) >= periodStart && a.startedAt.slice(0, 10) <= periodEnd).map(measure);
  const progress = progressOf(kind, inPeriod);
  const { title, detail } = words(kind, sport, fmtTarget(kind, goal, units), usualFor(kind, b, units));
  return {
    id: `${scope}:${period}:${sport}:${kind}`, sport, scope, period, kind, title, detail, target: goal, progress,
    unit: kind === "negative_split" ? "done" : kind === "sessions" ? "count" : kind.startsWith("moving") ? "min" : "m",
    done: progress >= goal, xp: scope === "day" ? CHALLENGE_XP.day : kind === "sessions" ? CHALLENGE_XP.sessions : CHALLENGE_XP.week,
  };
}

/** Monday of the ISO week containing `date`. */
export function mondayOf(date: string) {
  const d = new Date(date + "T00:00:00");
  return addDays(date, -((d.getDay() + 6) % 7));
}

/** Today's challenge and this week's three for one sport, with progress. */
export function challengesFor(sport: ActivityType, today: string, all: Activity[], units: DistanceUnit): { daily: Challenge; weekly: Challenge[] } {
  // An indoor session moved by a slider measured nothing; it cannot finish a challenge.
  const activities = all.filter((a) => a.meta?.indoor?.quality !== "declared");
  const kinds = kindsFor(sport);
  const dayKind = kinds.day[hash(`${today}:${sport}`) % kinds.day.length];
  const week = isoWeek(today), monday = mondayOf(today);
  const weekKinds = kinds.week.length <= 3 ? kinds.week : [...kinds.week].sort((a, b) => hash(`${week}:${a}`) - hash(`${week}:${b}`)).slice(0, 3);
  return {
    daily: build("day", today, today, today, dayKind, sport, activities, units),
    weekly: weekKinds.map((k) => build("week", week, monday, addDays(monday, 6), k, sport, activities, units)),
  };
}

/** Completed challenges not yet paid for. */
export function unpaid(c: { daily: Challenge; weekly: Challenge[] }, paid: string[]) {
  const seen = new Set(paid);
  return [c.daily, ...c.weekly].filter((x) => x.done && !seen.has(x.id));
}
