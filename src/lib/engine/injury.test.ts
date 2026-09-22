import { describe, expect, it } from "vitest";
import { RED_FLAGS, adaptationFor, adaptationsFor, limitFor, protectedAreas } from "./injury";
import { generatePlan, getExercise } from "./plan";
import type { Injury, Profile } from "../types";

const profile: Profile = {
  id: "p1", name: "Test", sex: "male", age: 30, heightCm: 175, weightKg: 78,
  units: { weight: "kg", distance: "km" }, goal: "build", level: "intermediate", daysPerWeek: 4, sessionMinutes: 60,
  equipment: ["barbell", "rack", "bench", "dumbbell", "cable", "pullup_bar"], pain: [],
  baselines: { squatE1rm: 120, hingeE1rm: 140, pushE1rm: 90 },
  dietary: [], mealsPerDay: 4, wakeTime: "07:00", trainTime: "18:00",
  notifications: false, createdAt: "2026-01-01T00:00:00.000Z",
};

const injury = (over: Partial<Injury> = {}): Injury =>
  ({ id: "i1", area: "knee", severity: 2, since: "2026-01-01", ...over });

describe("the return ladder", () => {
  it("protects the area on day one", () => {
    const a = adaptationFor(injury(), "2026-01-01");
    expect(a.phase).toBe("protect");
    expect(a.loadCap).toBe(0);
  });

  it("climbs as quiet days accumulate", () => {
    expect(adaptationFor(injury({ severity: 1 }), "2026-01-05").phase).toBe("reload");
    expect(adaptationFor(injury({ severity: 1 }), "2026-01-15").phase).toBe("return");
    expect(adaptationFor(injury({ severity: 1 }), "2026-02-01").phase).toBe("clear");
  });

  it("never lets load go backwards as the athlete heals", () => {
    const days = ["2026-01-01", "2026-01-05", "2026-01-15", "2026-02-01"];
    const caps = days.map((d) => adaptationFor(injury({ severity: 1 }), d).loadCap);
    for (let i = 1; i < caps.length; i++) expect(caps[i]).toBeGreaterThanOrEqual(caps[i - 1]);
  });

  it("steps back down when a flare-up is reported", () => {
    const healed = injury({ severity: 1, since: "2026-01-01" });
    expect(adaptationFor(healed, "2026-01-20").phase).toBe("return");
    const flared = { ...healed, lastFlareAt: "2026-01-19" };
    expect(adaptationFor(flared, "2026-01-20").phase).toBe("protect");
  });

  it("holds a severity-3 injury at protect however long it stays quiet", () => {
    const a = adaptationFor(injury({ severity: 3 }), "2026-06-01");
    expect(a.phase).toBe("protect");
    expect(a.loadCap).toBe(0);
    expect(a.nextStepInDays).toBeNull();
    expect(a.guidance.join(" ")).toMatch(/professional/i);
  });

  it("stops a severity-2 injury short of clearing itself", () => {
    expect(adaptationFor(injury({ severity: 2 }), "2026-06-01").phase).toBe("return");
  });

  it("always carries the red flags, unsoftened", () => {
    for (const sev of [1, 2, 3] as const)
      expect(adaptationFor(injury({ severity: sev }), "2026-03-01").redFlags).toEqual(RED_FLAGS);
  });

  it("tells the athlete what they can still train, not only what they cannot", () => {
    const text = adaptationFor(injury({ area: "knee" }), "2026-01-01").guidance.join(" ");
    expect(text).toMatch(/press|pull|carry|above the waist/i);
  });
});

describe("limitFor", () => {
  const protectKnee = adaptationsFor([injury({ area: "knee", severity: 2 })], "2026-01-01");

  it("blocks a movement flagged for the injured joint", () => {
    const squat = getExercise("back-squat")!;
    expect(limitFor(squat, protectKnee).blocked).toBe(true);
  });

  it("leaves an unrelated movement completely alone", () => {
    const bench = getExercise("bench-press")!;
    const limit = limitFor(bench, protectKnee);
    expect(limit.blocked).toBe(false);
    expect(limit.loadCap).toBe(1);
    expect(limit.volumeCap).toBe(1);
  });

  it("applies the strictest injury when two overlap", () => {
    const both = adaptationsFor([injury({ id: "a", area: "knee", severity: 1, since: "2026-01-01" }), injury({ id: "b", area: "back", severity: 3, since: "2026-01-01" })], "2026-02-01");
    const hinge = getExercise("romanian-deadlift") ?? getExercise("deadlift");
    if (hinge) expect(limitFor(hinge, both).loadCap).toBe(0);
  });

  it("reports nothing to limit when there is no injury", () => {
    expect(limitFor("back-squat", []).loadCap).toBe(1);
    expect(protectedAreas([])).toEqual([]);
  });
});

describe("a block built around an injury", () => {
  const knee = adaptationsFor([injury({ area: "knee", severity: 2, since: "2026-01-05" })], "2026-01-05");

  it("never programmes a movement that loads the protected joint", () => {
    const { sessions } = generatePlan(profile, "2026-01-05", {}, knee);
    for (const s of sessions)
      for (const e of s.exercises)
        expect(getExercise(e.slug)?.painFlags ?? []).not.toContain("knee");
  });

  it("keeps the athlete training — the block does not collapse", () => {
    const { sessions } = generatePlan(profile, "2026-01-05", {}, knee);
    expect(sessions.length).toBeGreaterThan(0);
    for (const s of sessions) expect(s.exercises.length).toBeGreaterThan(0);
  });

  it("leaves upper-body load untouched by a knee injury", () => {
    const top = (inj: typeof knee) => {
      const { sessions } = generatePlan(profile, "2026-01-05", {}, inj);
      return Math.max(0, ...sessions.flatMap((s) => s.exercises)
        .filter((e) => { const m = getExercise(e.slug); return m?.pattern === "push_h" && m.loadable; })
        .flatMap((e) => e.sets.map((x) => x.loadKg ?? 0)));
    };
    expect(top(knee)).toBe(top([]));
  });

  it("still rounds every load to what exists on the bar", () => {
    const reload = adaptationsFor([injury({ area: "shoulder", severity: 1, since: "2026-01-01" })], "2026-01-06");
    const { sessions } = generatePlan(profile, "2026-01-05", {}, reload);
    for (const s of sessions)
      for (const e of s.exercises)
        for (const set of e.sets)
          if (set.loadKg) expect(Math.round(set.loadKg * 100) % 250).toBe(0);
  });

  it("explains in the session why a movement is being held back", () => {
    const reload = adaptationsFor([injury({ area: "shoulder", severity: 1, since: "2026-01-01" })], "2026-01-06");
    const { sessions } = generatePlan(profile, "2026-01-05", {}, reload);
    const held = sessions.flatMap((s) => s.exercises).find((e) => e.why.includes("settles"));
    expect(held?.why).toMatch(/shoulder/);
  });

  it("returns to the normal block once the injury is resolved", () => {
    const resolved = adaptationsFor([injury({ area: "knee", resolvedAt: "2026-01-04" })], "2026-01-05");
    expect(resolved).toEqual([]);
    const { sessions } = generatePlan(profile, "2026-01-05", {}, resolved);
    const { sessions: normal } = generatePlan(profile, "2026-01-05");
    expect(sessions.flatMap((s) => s.exercises.map((e) => e.slug)))
      .toEqual(normal.flatMap((s) => s.exercises.map((e) => e.slug)));
  });
});
