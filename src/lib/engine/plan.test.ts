import { describe, expect, it } from "vitest";
import { generatePlan, getExercise } from "./plan";
import type { PainArea, Profile } from "../types";

/* A block is a twelve-week promise. These pin the shape of that promise:
   the right number of sessions, on the right days, never loading a joint
   the athlete flagged, never prescribing kit they do not have. */

const make = (over: Partial<Profile> = {}): Profile => ({
  id: "p1", name: "Test", sex: "male", age: 30, heightCm: 175, weightKg: 78,
  units: { weight: "kg", distance: "km" }, goal: "build", level: "intermediate", daysPerWeek: 4, sessionMinutes: 60,
  equipment: ["barbell", "rack", "bench", "dumbbell", "cable", "pullup_bar"], pain: [],
  baselines: { squatE1rm: 120, hingeE1rm: 140, pushE1rm: 90 },
  dietary: [], mealsPerDay: 4, wakeTime: "07:00", trainTime: "18:00",
  notifications: false, createdAt: "2026-01-01T00:00:00.000Z", ...over,
});

describe("generatePlan", () => {
  it("builds twelve weeks at the chosen frequency", () => {
    for (const days of [2, 3, 4, 5, 6] as const) {
      const { plan, sessions } = generatePlan(make({ daysPerWeek: days }), "2026-01-05");
      expect(plan.weeks).toBe(12);
      expect(sessions).toHaveLength(days * 12);
      expect(new Set(sessions.map((s) => s.week))).toEqual(new Set(Array.from({ length: 12 }, (_, i) => i + 1)));
    }
  });

  it("describes three mesocycles covering all twelve weeks with no gap or overlap", () => {
    const { plan } = generatePlan(make(), "2026-01-05");
    expect(plan.blocks).toHaveLength(3);
    const covered = plan.blocks.flatMap((b) => b.weeks);
    expect([...covered].sort((a, b) => a - b)).toEqual(Array.from({ length: 12 }, (_, i) => i + 1));
  });

  it("starts on a Monday whatever day you sign up", () => {
    // 2026-01-05 is itself a Monday; 2026-01-08 is a Thursday.
    for (const start of ["2026-01-05", "2026-01-08", "2026-01-11"]) {
      const { plan } = generatePlan(make(), start);
      expect(new Date(plan.startDate + "T00:00:00").getDay()).toBe(1);
      expect(plan.startDate >= start).toBe(true);
    }
  });

  it("gives every session a unique id and a distinct date slot", () => {
    const { sessions } = generatePlan(make(), "2026-01-05");
    expect(new Set(sessions.map((s) => s.id)).size).toBe(sessions.length);
    // One session per calendar day: two sessions must never collide on a date.
    expect(new Set(sessions.map((s) => s.date)).size).toBe(sessions.length);
  });

  it("keeps sessions in chronological order across week boundaries", () => {
    const { sessions } = generatePlan(make(), "2026-01-05");
    const dates = sessions.map((s) => s.date);
    expect([...dates].sort()).toEqual(dates);
  });

  it("never prescribes a movement that loads a flagged joint", () => {
    const pains: PainArea[] = ["knee", "shoulder"];
    const { sessions } = generatePlan(make({ pain: pains }), "2026-01-05");
    for (const s of sessions)
      for (const ex of s.exercises) {
        const flags = getExercise(ex.slug)?.painFlags ?? [];
        for (const p of pains) expect(flags).not.toContain(p);
      }
  });

  it("never prescribes equipment the athlete does not have", () => {
    const { sessions } = generatePlan(make({ equipment: ["bodyweight", "band"] }), "2026-01-05");
    const owned = new Set(["bodyweight", "band"]);
    for (const s of sessions)
      for (const ex of s.exercises) {
        const needs = getExercise(ex.slug)?.equipment ?? [];
        expect(needs.some((e) => owned.has(e)) || needs.length === 0).toBe(true);
      }
  });

  it("gives every session at least one exercise and every exercise at least one set", () => {
    const { sessions } = generatePlan(make({ sessionMinutes: 25 }), "2026-01-05");
    for (const s of sessions) {
      expect(s.exercises.length).toBeGreaterThan(0);
      for (const ex of s.exercises) expect(ex.sets.length).toBeGreaterThan(0);
    }
  });

  it("only attaches a season plan when there is an event to peak for", () => {
    expect(generatePlan(make(), "2026-01-05").plan.season).toBeUndefined();
    const withEvent = generatePlan(make({ eventName: "Marathon", eventDate: "2026-06-01" }), "2026-01-05").plan;
    expect(withEvent.season?.phases).toHaveLength(4);
    // Phases run forward and finish no earlier than they start.
    const phases = withEvent.season!.phases;
    for (const p of phases) expect(p.to >= p.from).toBe(true);
    for (let i = 1; i < phases.length; i++) expect(phases[i].from >= phases[i - 1].from).toBe(true);
  });

  it("is deterministic for the same profile and start date", () => {
    const p = make();
    const a = generatePlan(p, "2026-01-05").sessions.map((s) => `${s.date}:${s.exercises.map((e) => e.slug).join(",")}`);
    const b = generatePlan(p, "2026-01-05").sessions.map((s) => `${s.date}:${s.exercises.map((e) => e.slug).join(",")}`);
    expect(a).toEqual(b);
  });
});

describe("exercise choice", () => {
  it("never makes a single-joint movement the main lift", () => {
    for (const equipment of [["machine", "cable", "dumbbell", "bench"], ["dumbbell"], ["machine"]] as const)
      for (const s of generatePlan(make({ equipment: [...equipment] }), "2026-01-05").sessions)
        for (const ex of s.exercises.filter((e) => e.block === "main")) expect(getExercise(ex.slug)?.isolation).not.toBe(true);
  });
});
