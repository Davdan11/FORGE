import type {
  Equipment, Exercise, Goal, Level, PainArea, Pillar, Plan, PrescribedExercise, PrescribedSet, Profile, Session, SessionKind,
} from "../types";
import { EXERCISES, getExercise } from "../data/exercises";
import { addDays, uid } from "../db";
import { roundLoad } from "../units";
import { limitFor, protectedAreas, type InjuryAdaptation } from "./injury";

/* ─────────────────────────────────────────────────────────────
   THE ENGINE — plan generation.
   A 12-week block = 3 mesocycles of 4 weeks (3 loading + 1 deload).
   Sessions are built from pattern templates, then filled with
   exercises the athlete can actually do (equipment, pain, level),
   then loaded from assessment baselines.
   ───────────────────────────────────────────────────────────── */

type Slot = { pattern: Exercise["pattern"]; block: PrescribedExercise["block"]; sets: number; reps: [number, number]; rpe: number; rest: number; timedSec?: number; why: string };

const MESO = (week: number) => {
  const w = ((week - 1) % 4) + 1;          // 1..4 inside a mesocycle
  const meso = Math.ceil(week / 4);        // 1..3
  return { w, meso, deload: w === 4 };
};

/* Intensity ramps across the block: %e1RM for the main lift. */
function mainPct(goal: Goal, week: number) {
  const { w, meso, deload } = MESO(week);
  if (deload) return 0.6;
  const base = goal === "strength" ? 0.74 : goal === "endurance" ? 0.62 : 0.68;
  return Math.min(0.9, base + (meso - 1) * 0.04 + (w - 1) * 0.025);
}
function mainReps(goal: Goal, week: number): [number, number] {
  const { w, deload } = MESO(week);
  if (deload) return [5, 6];
  if (goal === "strength") return w === 1 ? [5, 5] : w === 2 ? [4, 5] : [3, 4];
  if (goal === "endurance" || goal === "cut") return [8, 10];
  return w === 1 ? [8, 10] : w === 2 ? [6, 8] : [5, 6];
}

/* Session templates by days/week. Every week touches every pillar. */
function weekTemplate(days: number, goal: Goal): SessionKind[] {
  const cardioHeavy = goal === "endurance" || goal === "cut";
  switch (days) {
    case 2: return ["full", "full"];
    case 3: return cardioHeavy ? ["full", "cardio_intervals", "full"] : ["full", "full", "full"];
    case 4: return cardioHeavy ? ["lower", "cardio_z2", "upper", "cardio_intervals"] : ["upper", "lower", "upper", "lower"];
    case 5: return cardioHeavy ? ["lower", "cardio_z2", "upper", "cardio_intervals", "full"] : ["push", "pull", "legs", "cardio_z2", "full"];
    default: return ["push", "pull", "legs", "cardio_z2", "upper", "lower"];
  }
}

/* Which weekdays to train, spreading days out. */
function trainingDays(days: number): number[] {
  return ({ 2: [1, 4], 3: [1, 3, 5], 4: [1, 2, 4, 5], 5: [1, 2, 3, 5, 6], 6: [1, 2, 3, 4, 5, 6] } as Record<number, number[]>)[days] ?? [1, 3, 5];
}

function slotsFor(kind: SessionKind, goal: Goal, week: number, minutes: number): Slot[] {
  const reps = mainReps(goal, week);
  const { deload } = MESO(week);
  const rpe = deload ? 6 : goal === "strength" ? 8 : 7.5;
  const accSets = minutes >= 60 ? 3 : 2;
  const mainSets = deload ? 3 : minutes >= 60 ? 4 : 3;
  const prep: Slot[] = [{ pattern: "mobility", block: "prep", sets: 1, reps: [1, 1], rpe: 4, rest: 0, timedSec: 60, why: "Two minutes of targeted mobility before load — cheaper than a warm-up set you don't need." }];
  const core: Slot = { pattern: "core", block: "finisher", sets: 2, reps: [8, 12], rpe: 7, rest: 45, timedSec: 40, why: "Trunk work at the end, when it can't compromise the main lifts." };
  const acc = (pattern: Exercise["pattern"], why: string): Slot => ({ pattern, block: "accessory", sets: accSets, reps: [8, 12], rpe: 7.5, rest: 75, why });
  const main = (pattern: Exercise["pattern"], why: string): Slot => ({ pattern, block: "main", sets: mainSets, reps, rpe, rest: goal === "strength" ? 180 : 120, why });

  const byKind: Record<SessionKind, Slot[]> = {
    full: [...prep, main("squat", "Squat first: the biggest driver of the block, done fresh."), main("push_h", "Horizontal press to balance the pull volume."), acc("hinge", "Posterior chain after the squat — hamstrings and glutes need their own stimulus."), acc("pull_h", "Rowing keeps the shoulders healthy and the back strong."), core],
    lower: [...prep, main("squat", "Squat first: the biggest driver of the block, done fresh."), acc("hinge", "Hinge after squat to load the posterior chain."), acc("lunge", "Single-leg work fixes the asymmetries bilateral lifts hide."), core],
    upper: [...prep, main("push_h", "Press first while the shoulders are fresh."), acc("pull_v", "Vertical pull to balance every press."), acc("push_v", "Overhead work for shoulder strength and health."), acc("pull_h", "Row volume: 1:1 with pressing, minimum."), core],
    push: [...prep, main("push_h", "Main press of the week."), acc("push_v", "Overhead second: lighter, more careful."), acc("push_h", "A second pressing angle for volume."), core],
    pull: [...prep, main("hinge", "Deadlift or hinge leads the pull day."), acc("pull_v", "Pull-ups or pulldowns: lats."), acc("pull_h", "Rows: mid-back."), core],
    legs: [...prep, main("squat", "Squat leads leg day."), acc("lunge", "Unilateral after the bilateral lift."), acc("hinge", "Hamstrings get their own slot."), core],
    cardio_z2: [{ pattern: "cardio", block: "main", sets: 1, reps: [1, 1], rpe: 4, rest: 0, timedSec: Math.max(25, minutes - 10) * 60, why: "Zone 2 builds the aerobic base everything else sits on. Conversational pace — genuinely easy." }],
    cardio_intervals: [...prep, { pattern: "cardio", block: "main", sets: deload ? 4 : 6, reps: [1, 1], rpe: 8.5, rest: 120, timedSec: 120, why: "Intervals at threshold raise the ceiling. Hard, but you should finish the last one at the same pace as the first." }, core],
    mobility: [{ pattern: "mobility", block: "main", sets: 4, reps: [1, 1], rpe: 4, rest: 0, timedSec: 90, why: "Twelve minutes to keep the hips, shoulders and ankles moving. This is what keeps you training at fifty." }],
    rest: [],
  };
  return byKind[kind];
}

/* Exercise selection: honour equipment, pain flags, level. */
function pick(pattern: Exercise["pattern"], profile: Profile, used: Set<string>, painToday: PainArea[] = [], protect: PainArea[] = []): Exercise | null {
  const pain = new Set([...profile.pain, ...painToday, ...protect]);
  const has = (eq: Equipment[]) => eq.some((e) => profile.equipment.includes(e) || e === "bodyweight" || (e === "outdoor" && profile.equipment.includes("outdoor")));
  const rank = (e: Exercise) => (e.level === "new" ? 0 : e.level === "intermediate" ? 1 : 2);
  const lvl = (profile.level === "new" ? 0 : profile.level === "intermediate" ? 1 : 2);
  const candidates = EXERCISES.filter((e) =>
    e.pattern === pattern && !used.has(e.slug) && has(e.equipment) && rank(e) <= lvl && !(e.painFlags ?? []).some((p) => pain.has(p))
  );
  // Prefer the most "canonical" (loadable, higher level fitting) first.
  candidates.sort((a, b) => rank(b) - rank(a) || Number(b.loadable) - Number(a.loadable));
  return candidates[0] ?? null;
}

/** Best e1RM actually logged, per exercise slug. Empty on day one; after that
 *  it is the only honest picture of what the athlete can lift. */
export type MeasuredE1rm = Record<string, number>;

/**
 * Turn logged sets into the three anchor lifts the prescription is built on.
 * A measured back squat should raise every quad movement, not just back squat,
 * so each measured lift is divided back through its own ratio to recover the
 * squat-equivalent it implies, and the strongest evidence wins.
 */
function anchorsFrom(measured: MeasuredE1rm): { squat?: number; hinge?: number; push?: number } {
  const out: { squat?: number; hinge?: number; push?: number } = {};
  for (const [slug, e1] of Object.entries(measured)) {
    const ex = getExercise(slug);
    if (!ex?.loadable || !ex.ratio || !e1) continue;
    const key = ex.pattern === "hinge" ? "hinge" : ex.pattern === "push_h" ? "push" : ex.pattern === "squat" ? "squat" : undefined;
    if (!key) continue;
    const equivalent = key === "squat" ? e1 / ex.ratio : e1 / ex.ratio * (key === "hinge" ? 1.2 : 0.75);
    out[key] = Math.max(out[key] ?? 0, equivalent);
  }
  return out;
}

/* Load estimate: what the athlete has actually lifted first, the onboarding
   assessment only until there is real evidence to replace it. */
function estimateE1rm(ex: Exercise, profile: Profile, measured: MeasuredE1rm = {}): number | undefined {
  // Most specific evidence: this exact movement, logged.
  const direct = measured[ex.slug];
  if (direct && ex.loadable) return direct;

  const a = anchorsFrom(measured);
  const b = profile.baselines;
  const squatE1rm = a.squat ?? b.squatE1rm;
  const hingeE1rm = a.hinge ?? b.hingeE1rm;
  const pushE1rm = a.push ?? b.pushE1rm;

  const squat = squatE1rm ?? (hingeE1rm ? hingeE1rm / 1.2 : undefined) ?? (pushE1rm ? pushE1rm / 0.75 : undefined) ?? profile.weightKg * (profile.level === "new" ? 0.6 : profile.level === "intermediate" ? 1.0 : 1.4);
  if (ex.pattern === "hinge" && hingeE1rm) return hingeE1rm * ((ex.ratio ?? 1) / 1.2);
  if ((ex.pattern === "push_h") && pushE1rm) return pushE1rm * ((ex.ratio ?? 0.75) / 0.75);
  return ex.ratio ? squat * ex.ratio : undefined;
}

function buildSets(slot: Slot, ex: Exercise, profile: Profile, week: number, goal: Goal, measured: MeasuredE1rm = {}): PrescribedSet[] {
  const sets: PrescribedSet[] = [];
  const isMain = slot.block === "main";
  const pct = isMain ? mainPct(goal, week) : 0.62;
  const e1 = ex.loadable ? estimateE1rm(ex, profile, measured) : undefined;
  for (let i = 0; i < slot.sets; i++) {
    const reps = slot.reps[0] === slot.reps[1] ? slot.reps[0] : Math.round((slot.reps[0] + slot.reps[1]) / 2);
    const set: PrescribedSet = { rpe: slot.rpe, restSec: slot.rest };
    if (slot.timedSec && (ex.timed || ex.pattern === "cardio" || ex.pattern === "mobility")) set.seconds = slot.timedSec;
    else set.reps = ex.pattern === "mobility" ? 8 : reps;
    if (e1 && set.reps) {
      const repAdj = 1 - Math.max(0, set.reps - 5) * 0.025;  // more reps → lower % of e1RM
      set.pct = Math.round(pct * repAdj * 100) / 100;
      set.loadKg = roundLoad(e1 * set.pct, profile.units);
    }
    sets.push(set);
  }
  return sets;
}

export function buildSession(profile: Profile, planId: string, week: number, day: number, date: string, kind: SessionKind, minutes: number, painToday: PainArea[] = [], measured: MeasuredE1rm = {}, injuries: InjuryAdaptation[] = []): Session {
  const used = new Set<string>();
  const slots = slotsFor(kind, profile.goal, week, minutes);
  const exercises: PrescribedExercise[] = [];
  const protect = protectedAreas(injuries);
  for (const slot of slots) {
    const ex = pick(slot.pattern, profile, used, painToday, protect);
    if (!ex) continue;
    used.add(ex.slug);

    // Injury caps apply to the affected patterns only. Everything the injury
    // does not touch keeps its full prescription — that is the whole point.
    const limit = limitFor(ex, injuries);
    if (limit.blocked) continue;
    let sets = buildSets(slot, ex, profile, week, profile.goal, measured);
    if (limit.loadCap < 1 || limit.volumeCap < 1) {
      const keep = Math.max(1, Math.round(sets.length * limit.volumeCap));
      sets = sets.slice(0, keep).map((s) => (s.loadKg ? { ...s, loadKg: roundLoad(s.loadKg * limit.loadCap, profile.units) } : s));
    }
    const why = limit.because
      ? `${slot.why} Held at ${Math.round(limit.loadCap * 100)}% while your ${limit.because} settles.`
      : slot.why;
    exercises.push({ id: uid(), slug: ex.slug, block: slot.block, sets, why });
  }
  const { deload, meso, w } = MESO(week);
  const focus: Pillar = kind.startsWith("cardio") ? "endurance" : kind === "mobility" ? "mobility" : "strength";
  const titles: Record<SessionKind, string> = { full: "Full body", lower: "Lower", upper: "Upper", push: "Push", pull: "Pull", legs: "Legs", cardio_z2: "Zone 2", cardio_intervals: "Intervals", mobility: "Mobility", rest: "Rest" };
  const why = deload
    ? "Deload week: same movements, 60% of the load, fewer sets. This is where the last three weeks turn into strength."
    : `Mesocycle ${meso}, week ${w}: intensity climbs a notch from last week. Finish every main set with the target RPE, not a grind.`;
  return {
    id: uid(), planId, week, day, date, kind, title: titles[kind], minutes, focus, exercises, why, status: "planned",
    cardio: kind === "cardio_z2" ? { zone: 2, minutes: Math.max(25, minutes - 10) } : kind === "cardio_intervals" ? { zone: 4, minutes, structure: `${deload ? 4 : 6} × 2 min hard / 2 min easy` } : undefined,
  };
}

export function generatePlan(profile: Profile, startDate: string, measured: MeasuredE1rm = {}, injuries: InjuryAdaptation[] = []): { plan: Plan; sessions: Session[] } {
  const planId = uid();
  const kinds = weekTemplate(profile.daysPerWeek, profile.goal);
  const days = trainingDays(profile.daysPerWeek);
  const sessions: Session[] = [];
  // Align the start to the next Monday so "day 1" means something.
  const start = new Date(startDate + "T00:00:00");
  const offset = (8 - start.getDay()) % 7;
  const monday = addDays(startDate, offset === 0 ? 0 : offset);

  for (let week = 1; week <= 12; week++) {
    kinds.forEach((kind, i) => {
      const day = days[i];
      const date = addDays(monday, (week - 1) * 7 + (day - 1));
      sessions.push(buildSession(profile, planId, week, day, date, kind, profile.sessionMinutes, [], measured, injuries));
    });
    // Daily 12-minute mobility on off days (not logged as full sessions).
  }

  const plan: Plan = {
    id: planId, profileId: profile.id, goal: profile.goal, startDate: monday, weeks: 12, createdAt: new Date().toISOString(),
    blocks: [
      { name: "Base", weeks: [1, 2, 3, 4], intent: "Technique, volume, aerobic base", intensity: "65–75%" },
      { name: "Build", weeks: [5, 6, 7, 8], intent: "Load climbs, cardio gets sharper", intensity: "72–82%" },
      { name: "Peak", weeks: [9, 10, 11, 12], intent: "Heaviest work of the block, then test", intensity: "78–90%" },
    ],
    season: profile.eventDate && profile.eventName ? {
      eventName: profile.eventName, eventDate: profile.eventDate,
      phases: seasonPhases(monday, profile.eventDate),
    } : undefined,
  };
  return { plan, sessions };
}

/* Periodisation backwards from the event date. */
function seasonPhases(start: string, eventDate: string) {
  const total = Math.max(4, Math.round((new Date(eventDate).getTime() - new Date(start).getTime()) / 86400000 / 7));
  const cut = (a: number, b: number) => ({ from: addDays(start, Math.round(total * a) * 7), to: addDays(start, Math.round(total * b) * 7 - 1) });
  return [
    { name: "General preparation", ...cut(0, 0.4) },
    { name: "Specific preparation", ...cut(0.4, 0.75) },
    { name: "Pre-competition", ...cut(0.75, 0.93) },
    { name: "Taper", ...cut(0.93, 1) },
  ];
}

export const levelLabel = (l: Level) => ({ new: "New to training", intermediate: "1–3 years", advanced: "3+ years" }[l]);
export const goalLabel = (g: Goal) => ({ strength: "Get strong", build: "Build muscle", recomp: "Recomposition", cut: "Lose fat", endurance: "Endurance", perform: "Perform for a date" }[g]);
export { getExercise };
