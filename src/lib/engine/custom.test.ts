import { describe, expect, it } from "vitest";
import { generatePlan, getExercise, prescribeAdded } from "./plan";
import { carryAdded, insertAdded } from "./custom";
import { advance } from "./progression";
import { autoRegulate } from "./readiness";
import { addDays } from "../db";
import type { Profile, Readiness, Session } from "../types";

/* A movement the athlete adds is their decision. The engine may rewrite the
   day around it as often as it likes; it may not quietly drop it. */

const profile: Profile = {
  id: "p1", name: "Test", sex: "male", age: 30, heightCm: 175, weightKg: 78,
  units: { weight: "kg", distance: "km" }, goal: "build", level: "intermediate", daysPerWeek: 4, sessionMinutes: 60,
  equipment: ["barbell", "rack", "bench", "dumbbell", "cable", "pullup_bar", "machine"], pain: [],
  baselines: {}, dietary: [], mealsPerDay: 4, wakeTime: "07:00", trainTime: "18:00",
  notifications: false, createdAt: "2026-01-01T00:00:00.000Z",
};
const START = "2026-01-05";

function withCurl(s: Session): Session {
  return { ...s, exercises: insertAdded(s.exercises, [prescribeAdded(getExercise("hammer-curl")!, profile, s.week, s.minutes)]) };
}

describe("adding a library movement", () => {
  it("is prescribed like an accessory, with load, and marked as the athlete's", () => {
    const e = prescribeAdded(getExercise("hammer-curl")!, profile, 1, 60);
    expect(e.added).toBe(true);
    expect(e.sets.length).toBe(3);
    expect(e.sets.every((s) => (s.loadKg ?? 0) > 0 && (s.reps ?? 0) > 0)).toBe(true);
  });

  it("goes after the accessories and before the finisher", () => {
    const s = withCurl(generatePlan(profile, START).sessions[0]);
    const blocks = s.exercises.map((e) => (e.added ? "added" : e.block));
    const at = blocks.indexOf("added");
    expect(blocks.slice(0, at)).not.toContain("finisher");
    expect(blocks.slice(at + 1).every((b) => b === "finisher" || b === "cooldown")).toBe(true);
  });

  it("is not added twice", () => {
    const s = withCurl(generatePlan(profile, START).sessions[0]);
    expect(withCurl(s).exercises.filter((e) => e.slug === "hammer-curl")).toHaveLength(1);
  });
});

describe("surviving a rewrite", () => {
  it("stays on its day when the plan is regenerated (a settings change)", () => {
    const before = generatePlan(profile, START).sessions;
    const edited = before.map((s, i) => (i === 5 ? withCurl(s) : s));
    const rebuilt = carryAdded(generatePlan({ ...profile, goal: "strength" }, START).sessions, edited);
    const day = rebuilt.find((s) => s.date === edited[5].date)!;
    expect(day.exercises.some((e) => e.slug === "hammer-curl" && e.added)).toBe(true);
  });

  it("stays when a new block rewrites the rest of the programme", () => {
    const { plan, sessions } = generatePlan(profile, START);
    const target = sessions.find((s) => s.week === 6)!;
    const edited = sessions.map((s) => (s.id === target.id ? withCurl(s) : s));
    const next = advance(plan, edited, [], profile, addDays(START, 4 * 7))!;
    const day = next.add.find((s) => s.date === target.date)!;
    expect(day.exercises.some((e) => e.slug === "hammer-curl" && e.added)).toBe(true);
  });

  it("stays through a morning check-in rewrite, unless today's pain rules it out", () => {
    const s = withCurl(generatePlan(profile, START).sessions[0]);
    const r = (painToday: Readiness["painToday"]): Readiness => ({ id: START, date: START, sleepHours: 7, sleepQuality: 3, soreness: 2, stress: 2, mood: 3, score: 70, equipmentToday: "dumbbells", painToday });
    expect(autoRegulate(profile, s, r([])).session.exercises.some((e) => e.slug === "hammer-curl")).toBe(true);
    // The dumbbell fly loads the shoulder: a sore shoulder today takes it out.
    const fly = { ...s, exercises: insertAdded(s.exercises, [prescribeAdded(getExercise("dumbbell-fly")!, profile, s.week, s.minutes)]) };
    expect(getExercise("dumbbell-fly")!.painFlags).toContain("shoulder");
    expect(autoRegulate(profile, fly, r(["shoulder"])).session.exercises.some((e) => e.slug === "dumbbell-fly")).toBe(false);
    expect(autoRegulate(profile, fly, r([])).session.exercises.some((e) => e.slug === "dumbbell-fly")).toBe(true);
  });
});
