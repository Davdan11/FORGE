import { describe, expect, it } from "vitest";
import { autoRegulate, readinessScore } from "./readiness";
import { generatePlan } from "./plan";
import { getExercise } from "../data/exercises";
import type { Profile, Readiness } from "../types";

/* The readiness score decides how much weight goes on the bar. The thresholds
   at 40 and 65 are the difference between "train as planned" and "back off",
   so they are pinned here rather than left to drift. */

type Inputs = Pick<Readiness, "sleepHours" | "sleepQuality" | "soreness" | "stress" | "mood">;
const base: Inputs = { sleepHours: 7, sleepQuality: 3, soreness: 2, stress: 2, mood: 4 };
const score = (over: Partial<Inputs> = {}) => readinessScore({ ...base, ...over });

const profile: Profile = {
  id: "p1", name: "Test", sex: "male", age: 30, heightCm: 175, weightKg: 78,
  units: { weight: "kg", distance: "km" }, goal: "build", level: "intermediate", daysPerWeek: 4, sessionMinutes: 60,
  equipment: ["barbell", "rack", "bench", "dumbbell", "cable", "pullup_bar"], pain: [],
  baselines: { squatE1rm: 120, hingeE1rm: 140, pushE1rm: 90 },
  dietary: [], mealsPerDay: 4, wakeTime: "07:00", trainTime: "18:00",
  notifications: false, createdAt: "2026-01-01T00:00:00.000Z",
};

const readiness = (over: Partial<Readiness>): Readiness => ({
  id: "2026-01-05", date: "2026-01-05", ...base, score: 80, ...over,
});

/** First planned strength session of a freshly generated block. */
function plannedSession() {
  const { sessions } = generatePlan(profile, "2026-01-05");
  const s = sessions.find((x) => x.exercises.some((e) => e.block === "main" && e.sets.some((st) => st.loadKg)));
  if (!s) throw new Error("fixture: no loaded session in a generated block");
  return s;
}

describe("readinessScore", () => {
  it("stays inside 0–100 at both extremes", () => {
    const worst = score({ sleepHours: 0, sleepQuality: 1, soreness: 5, stress: 5, mood: 1 });
    const best = score({ sleepHours: 10, sleepQuality: 5, soreness: 1, stress: 1, mood: 5 });
    expect(worst).toBe(0);
    expect(best).toBe(100);
    expect(Number.isInteger(worst) && Number.isInteger(best)).toBe(true);
  });

  it("weights sleep most heavily of the five inputs", () => {
    const drop = (k: keyof Inputs, v: number) => score() - score({ [k]: v } as Partial<Inputs>);
    // Each input moved from its base to the floor; sleep must cost the most.
    const bySleep = score() - score({ sleepHours: 4 });
    expect(bySleep).toBeGreaterThan(drop("soreness", 5));
    expect(bySleep).toBeGreaterThan(drop("stress", 5));
    expect(bySleep).toBeGreaterThan(drop("mood", 1));
  });

  it("moves monotonically with every input", () => {
    expect(score({ sleepHours: 8 })).toBeGreaterThan(score({ sleepHours: 6 }));
    expect(score({ soreness: 1 })).toBeGreaterThan(score({ soreness: 4 }));
    expect(score({ stress: 1 })).toBeGreaterThan(score({ stress: 4 }));
    expect(score({ mood: 5 })).toBeGreaterThan(score({ mood: 2 }));
    expect(score({ sleepQuality: 5 })).toBeGreaterThan(score({ sleepQuality: 2 }));
  });

  it("treats sleep beyond 8.5 h as no better than 8.5 h", () => {
    expect(score({ sleepHours: 12 })).toBe(score({ sleepHours: 8.5 }));
  });

  it("only applies HRV when a baseline exists to compare against", () => {
    const withHrv = { ...base, hrv: 40 };
    expect(readinessScore(withHrv)).toBe(score());
    expect(readinessScore(withHrv, 60)).toBeLessThan(score());  // well under baseline
    expect(readinessScore({ ...base, hrv: 80 }, 60)).toBeGreaterThan(score());
  });

  it("reads a raised resting heart rate as a cost", () => {
    expect(readinessScore({ ...base, restingHr: 70 }, undefined, 55)).toBeLessThan(score());
  });
});

describe("autoRegulate", () => {
  it("leaves a green day alone", () => {
    const planned = plannedSession();
    const { session, level, changes } = autoRegulate(profile, planned, readiness({ score: 80 }));
    expect(level).toBe("green");
    expect(changes).toEqual([]);
    expect(session.status).toBe(planned.status);
    const before = planned.exercises.flatMap((e) => e.sets.map((s) => s.loadKg ?? 0));
    const after = session.exercises.flatMap((e) => e.sets.map((s) => s.loadKg ?? 0));
    expect(after).toEqual(before);
  });

  it("cuts load on an amber day but keeps every set", () => {
    const planned = plannedSession();
    const { session, level } = autoRegulate(profile, planned, readiness({ score: 50 }));
    expect(level).toBe("amber");
    expect(session.status).toBe("adjusted");
    expect(session.exercises.map((e) => e.sets.length)).toEqual(planned.exercises.map((e) => e.sets.length));

    const loadedBefore = planned.exercises.flatMap((e) => e.sets.filter((s) => s.loadKg && getExercise(e.slug)?.loadable));
    const loadedAfter = session.exercises.flatMap((e) => e.sets.filter((s) => s.loadKg && getExercise(e.slug)?.loadable));
    expect(loadedBefore.length).toBeGreaterThan(0);
    const totalBefore = loadedBefore.reduce((a, s) => a + s.loadKg!, 0);
    const totalAfter = loadedAfter.reduce((a, s) => a + s.loadKg!, 0);
    expect(totalAfter).toBeLessThan(totalBefore);
  });

  it("drops a set as well as load on a red day", () => {
    const planned = plannedSession();
    const { session, level } = autoRegulate(profile, planned, readiness({ score: 25 }));
    expect(level).toBe("red");
    const mainBefore = planned.exercises.find((e) => e.block === "main")!;
    const mainAfter = session.exercises.find((e) => e.id === mainBefore.id)!;
    expect(mainAfter.sets.length).toBe(Math.max(1, mainBefore.sets.length - 1));
  });

  it("never prescribes a load that is not on the bar", () => {
    const planned = plannedSession();
    const { session } = autoRegulate(profile, planned, readiness({ score: 50 }));
    for (const ex of session.exercises)
      for (const set of ex.sets)
        if (set.loadKg) expect(Math.round(set.loadKg * 100) % 250).toBe(0);  // multiple of 2.5 kg
  });

  it("never scales a set below one rep or a session to zero exercises", () => {
    const planned = plannedSession();
    const { session } = autoRegulate(profile, planned, readiness({ score: 0 }));
    expect(session.exercises.length).toBeGreaterThan(0);
    for (const ex of session.exercises) expect(ex.sets.length).toBeGreaterThanOrEqual(1);
  });

  it("records the readiness it acted on, so the session explains itself later", () => {
    const planned = plannedSession();
    const { session } = autoRegulate(profile, planned, readiness({ score: 33 }));
    expect(session.readinessAtStart).toBe(33);
    expect(session.adjustment?.reason).toContain("33");
  });

  it("honours a shorter day by trimming, not by cancelling", () => {
    const planned = plannedSession();
    const { session } = autoRegulate(profile, planned, readiness({ score: 80, minutesAvailable: 25 }));
    expect(session.minutes).toBeLessThanOrEqual(planned.minutes);
    expect(session.exercises.length).toBeGreaterThan(0);
  });
});
