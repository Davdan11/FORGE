import type { Activity, LoggedSet, Session, WeighIn } from "./types";
import { e1rm } from "./units";

/* ─────────────────────────────────────────────────────────────
   The journey: everything since day one, week by week.

   Built from rows the app already keeps — weigh-ins, sessions,
   logged sets, activities — so it is there for anyone who comes
   back after a break, on any device they sign in on. Pure, so the
   arithmetic is tested and the page only draws it.
   ───────────────────────────────────────────────────────────── */

export interface JourneyWeek {
  /** Monday of the week, ISO date. */
  monday: string;
  sessionsDone: number;
  sessionsPlanned: number;
  activities: number;
  distanceM: number;
  /** Last weigh-in of the week, kg, and its change from the one before. */
  weightKg?: number;
  weightDeltaKg?: number;
  /** Exercises whose estimated max beat every earlier set this week. */
  records: string[];
}

const mondayOf = (iso: string) => {
  const d = new Date(iso.slice(0, 10) + "T00:00:00");
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
};

export function buildJourney(input: {
  start: string; today: string; startWeightKg?: number;
  weights: WeighIn[]; sessions: Session[]; sets: LoggedSet[]; activities: Activity[];
}) {
  const weeks = new Map<string, JourneyWeek>();
  const week = (iso: string) => {
    const m = mondayOf(iso);
    let w = weeks.get(m);
    if (!w) { w = { monday: m, sessionsDone: 0, sessionsPlanned: 0, activities: 0, distanceM: 0, records: [] }; weeks.set(m, w); }
    return w;
  };
  // Every week from the start to today exists, even an empty one: a gap is part of the story.
  for (let d = mondayOf(input.start); d <= input.today; ) {
    week(d);
    const n = new Date(d + "T00:00:00"); n.setDate(n.getDate() + 7);
    d = new Date(n.getTime() - n.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }

  for (const s of input.sessions) {
    // Today's session is not missed until today is over.
    if (s.date > input.today || s.kind === "rest" || (s.date === input.today && s.status !== "done")) continue;
    const w = week(s.date);
    w.sessionsPlanned++;
    if (s.status === "done") w.sessionsDone++;
  }
  for (const a of input.activities) {
    const w = week(a.startedAt);
    w.activities++;
    w.distanceM += a.distanceM ?? 0;
  }

  const byDate = [...input.weights].sort((a, b) => a.date.localeCompare(b.date));
  for (const wi of byDate) week(wi.date).weightKg = wi.kg;   // the week's last weigh-in wins
  // Per week, the change is from the last weigh-in of the previous weighed week.
  let last: number | undefined = input.startWeightKg;
  for (const w of [...weeks.values()].sort((a, b) => a.monday.localeCompare(b.monday))) {
    if (w.weightKg == null) continue;
    w.weightDeltaKg = last != null ? Math.round((w.weightKg - last) * 10) / 10 : undefined;
    last = w.weightKg;
  }

  // Records: a set whose estimated max beats every earlier set of that exercise.
  const best = new Map<string, number>();
  for (const set of [...input.sets].sort((a, b) => a.at.localeCompare(b.at))) {
    if (!set.loadKg || !set.reps) continue;
    const v = e1rm(set.loadKg, set.reps);
    const was = best.get(set.slug);
    if (was != null && v > was + 0.01) { const w = week(set.at); if (!w.records.includes(set.slug)) w.records.push(set.slug); }
    if (was == null || v > was) best.set(set.slug, v);
  }

  const list = [...weeks.values()].sort((a, b) => b.monday.localeCompare(a.monday));
  const current = byDate.at(-1)?.kg;
  return {
    weeks: list,
    totals: {
      sessionsDone: list.reduce((a, w) => a + w.sessionsDone, 0),
      activeWeeks: list.filter((w) => w.sessionsDone + w.activities > 0).length,
      records: list.reduce((a, w) => a + w.records.length, 0),
      distanceM: list.reduce((a, w) => a + w.distanceM, 0),
      startKg: input.startWeightKg ?? byDate[0]?.kg,
      currentKg: current,
      changeKg: current != null && (input.startWeightKg ?? byDate[0]?.kg) != null ? Math.round((current - (input.startWeightKg ?? byDate[0].kg)) * 10) / 10 : undefined,
    },
  };
}
