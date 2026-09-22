import { describe, expect, it } from "vitest";
import { generatePlan, getExercise, type MeasuredE1rm } from "./plan";
import type { Profile } from "../types";

/* The feedback loop: what the athlete actually lifted must decide what comes
   next, not the numbers typed during an eight-minute assessment months ago. */

const profile: Profile = {
  id: "p1", name: "Test", sex: "male", age: 30, heightCm: 175, weightKg: 78,
  units: { weight: "kg", distance: "km" }, goal: "build", level: "intermediate", daysPerWeek: 4, sessionMinutes: 60,
  equipment: ["barbell", "rack", "bench", "dumbbell", "cable", "pullup_bar"], pain: [],
  baselines: { squatE1rm: 100, hingeE1rm: 120, pushE1rm: 75 },
  dietary: [], mealsPerDay: 4, wakeTime: "07:00", trainTime: "18:00",
  notifications: false, createdAt: "2026-01-01T00:00:00.000Z",
};

/** Heaviest prescribed set for one movement across a whole block. */
const topLoad = (measured: MeasuredE1rm, slug: string) => {
  const { sessions } = generatePlan(profile, "2026-01-05", measured);
  const loads = sessions.flatMap((s) => s.exercises.filter((e) => e.slug === slug).flatMap((e) => e.sets.map((x) => x.loadKg ?? 0)));
  return Math.max(0, ...loads);
};

/** A loadable barbell movement of the given pattern that the block actually uses. */
function slugFor(pattern: string) {
  const { sessions } = generatePlan(profile, "2026-01-05");
  for (const s of sessions)
    for (const e of s.exercises) {
      const meta = getExercise(e.slug);
      if (meta?.pattern === pattern && meta.loadable && meta.ratio) return e.slug;
    }
  throw new Error(`fixture: the block never programmes a loadable ${pattern}`);
}

describe("prescription from logged sets", () => {
  it("falls back to the assessment when nothing has been logged", () => {
    const slug = slugFor("squat");
    expect(topLoad({}, slug)).toBeGreaterThan(0);
  });

  it("prescribes heavier once the athlete has logged a heavier lift", () => {
    const slug = slugFor("squat");
    const fromAssessment = topLoad({}, slug);
    const afterProgress = topLoad({ [slug]: 150 }, slug);   // assessment said ~100
    expect(afterProgress).toBeGreaterThan(fromAssessment);
  });

  it("prescribes lighter when the logged truth is below the assessment", () => {
    const slug = slugFor("squat");
    expect(topLoad({ [slug]: 60 }, slug)).toBeLessThan(topLoad({}, slug));
  });

  it("uses the logged lift itself, not a ratio of it", () => {
    const slug = slugFor("squat");
    const measured = 140;
    const { sessions } = generatePlan(profile, "2026-01-05", { [slug]: measured });
    const sets = sessions.flatMap((s) => s.exercises.filter((e) => e.slug === slug).flatMap((e) => e.sets.filter((x) => x.loadKg && x.pct)));
    expect(sets.length).toBeGreaterThan(0);
    for (const s of sets) {
      // Every load is that measured max times the prescribed percentage,
      // to within the 2.5 kg the bar can actually hold.
      expect(Math.abs(s.loadKg! - measured * s.pct!)).toBeLessThanOrEqual(1.25);
    }
  });

  it("lets a measured squat raise other quad movements, not just that one lift", () => {
    const squat = slugFor("squat");
    const { sessions: before } = generatePlan(profile, "2026-01-05");
    const { sessions: after } = generatePlan(profile, "2026-01-05", { [squat]: 180 });

    const others = (ss: typeof before) => ss.flatMap((s) => s.exercises)
      .filter((e) => e.slug !== squat && getExercise(e.slug)?.pattern === "squat" && getExercise(e.slug)?.loadable)
      .flatMap((e) => e.sets.map((x) => x.loadKg ?? 0));

    const a = others(before), b = others(after);
    if (a.length === 0) return;  // this block only programmes one squat variant
    expect(Math.max(...b)).toBeGreaterThan(Math.max(...a));
  });

  it("ignores logged bodyweight rep counts, which are not kilograms", () => {
    const slug = slugFor("squat");
    // A pull-up logged as 12 reps must never be read as a 12 kg max.
    const withReps = topLoad({ "pull-up": 12 }, slug);
    expect(withReps).toBe(topLoad({}, slug));
  });

  it("still rounds every prescribed load to what exists on the bar", () => {
    const slug = slugFor("squat");
    const { sessions } = generatePlan(profile, "2026-01-05", { [slug]: 137.3 });
    for (const s of sessions)
      for (const e of s.exercises)
        for (const set of e.sets)
          if (set.loadKg) expect(Math.round(set.loadKg * 100) % 250).toBe(0);
  });

  it("keeps the intensity ramp: later weeks stay heavier than the first", () => {
    const slug = slugFor("squat");
    const { sessions } = generatePlan(profile, "2026-01-05", { [slug]: 150 });
    const top = (week: number) => Math.max(0, ...sessions.filter((s) => s.week === week)
      .flatMap((s) => s.exercises.filter((e) => e.slug === slug).flatMap((e) => e.sets.map((x) => x.loadKg ?? 0))));
    const w1 = top(1), w7 = top(7);
    if (w1 && w7) expect(w7).toBeGreaterThan(w1);
  });
});
