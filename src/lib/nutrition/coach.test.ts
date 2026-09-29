import { describe, expect, it } from "vitest";
import type { Profile } from "../types";
import { checkIn, checkTarget, expectedPerWeek, goalTimeline, ratePerWeek, trendSeries, withCheckIn, lowestHealthyKg } from "./coach";
import { explainTargets, goalReached } from "./science";

const base: Profile = {
  id: "p", name: "T", sex: "male", age: 35, heightCm: 178, weightKg: 90, units: { weight: "lb", distance: "km" },
  goal: "cut", level: "intermediate", daysPerWeek: 4, sessionMinutes: 60, equipment: [], pain: [], baselines: {},
  dietary: [], mealsPerDay: 4, wakeTime: "07:00", trainTime: "18:00", notifications: false, createdAt: "2026-01-01T00:00:00.000Z",
  startWeightKg: 90,
};
const iso = (d: number) => new Date(Date.parse("2026-01-01") + d * 86_400_000).toISOString().slice(0, 10);
/** Weigh-ins every other day from day `from` to `to`, on a straight line of `perWeek` kg, with ±0.4 kg of water noise. */
const line = (from: number, to: number, startKg: number, perWeek: number) => {
  const out = [];
  for (let d = from; d <= to; d += 2) out.push({ date: iso(d), kg: Math.round((startKg + (perWeek * (d - from)) / 7 + (d % 4 === 0 ? 0.4 : -0.4)) * 10) / 10 });
  return out;
};
const week = { sessions: { planned: 4, done: 4 }, meals: { planned: 28, done: 25 } };

describe("the trend", () => {
  it("smooths out a one-day spike", () => {
    const s = trendSeries([{ date: iso(0), kg: 90 }, { date: iso(1), kg: 90 }, { date: iso(2), kg: 91.5 }, { date: iso(3), kg: 90 }]);
    expect(s.at(-1)!.trend).toBeLessThan(90.2);
  });
  it("measures the real rate through the noise", () => {
    const r = ratePerWeek(line(0, 21, 90, -0.7))!;
    expect(r).toBeGreaterThan(-0.85);
    expect(r).toBeLessThan(-0.55);
  });
  it("refuses to guess from too little", () => {
    expect(ratePerWeek(line(0, 6, 90, -1))).toBeNull();
  });
});

describe("the weekly check-in", () => {
  const today = iso(35);
  const expected = expectedPerWeek(base);
  it("plans a loss of 0.5–1 % a week", () => {
    expect(expected).toBeLessThan(-0.45);
    expect(expected).toBeGreaterThan(-0.9);
  });
  it("leaves the food alone when the scale follows the plan", () => {
    const c = checkIn({ profile: base, today, weighIns: line(0, 35, 90, expected), startDate: iso(0), adherence: "all", ...week });
    expect(c.verdict).toBe("on_track");
    expect(c.deltaKcal).toBe(0);
  });
  it("takes calories off when the loss stalls, at most 200 a week", () => {
    const c = checkIn({ profile: base, today, weighIns: line(0, 35, 90, -0.1), startDate: iso(0), adherence: "all", ...week });
    expect(c.verdict).toBe("too_slow");
    expect(c.deltaKcal).toBeLessThan(0);
    expect(c.deltaKcal).toBeGreaterThanOrEqual(-200);
  });
  it("feeds more when the loss is too fast (muscle is at stake)", () => {
    const c = checkIn({ profile: base, today, weighIns: line(0, 35, 90, -1.6), startDate: iso(0), adherence: "all", ...week });
    expect(c.verdict).toBe("too_fast");
    expect(c.deltaKcal).toBeGreaterThan(0);
  });
  it("changes nothing when the plan was not followed", () => {
    const c = checkIn({ profile: base, today, weighIns: line(0, 35, 90, 0), startDate: iso(0), adherence: "some", ...week });
    expect(c.verdict).toBe("off_plan");
    expect(c.deltaKcal).toBe(0);
  });
  it("moves at half strength on a mostly-followed week", () => {
    const all = checkIn({ profile: base, today, weighIns: line(0, 35, 90, -0.3), startDate: iso(0), adherence: "all", ...week });
    const most = checkIn({ profile: base, today, weighIns: line(0, 35, 90, -0.3), startDate: iso(0), adherence: "most", ...week });
    expect(Math.abs(most.deltaKcal)).toBeLessThan(Math.abs(all.deltaKcal));
  });
  it("ignores the first days' water drop", () => {
    // A 2 kg drop in the first week, then exactly on plan: nothing to correct.
    const w = [...line(0, 8, 92, -1.5), ...line(10, 35, 90, expected)];
    const c = checkIn({ profile: base, today, weighIns: w, startDate: iso(0), adherence: "all", ...week });
    expect(c.verdict).toBe("on_track");
  });
  it("keeps the standing correction inside ±500 kcal, and the targets follow it", () => {
    let p = base;
    for (let k = 0; k < 6; k++) {
      const c = checkIn({ profile: p, today: iso(35 + k * 7), weighIns: line(0, 35 + k * 7, 90, 0), startDate: iso(0), adherence: "all", ...week });
      p = { ...p, coach: withCheckIn(p.coach, c) };
    }
    expect(p.coach!.adjustKcal).toBeGreaterThanOrEqual(-500);
    expect(explainTargets(p, "train").kcal).toBeLessThan(explainTargets(base, "train").kcal);
    expect(explainTargets(p, "train").kcal).toBeGreaterThanOrEqual(1500);
  });
});

describe("the safe floor", () => {
  it("never takes the food under the floor; says to move more instead", () => {
    const small: Profile = { ...base, sex: "female", weightKg: 60, heightCm: 160, startWeightKg: 60, daysPerWeek: 2 };
    let p = small;
    for (let k = 0; k < 4; k++) {
      const c = checkIn({ profile: p, today: iso(35 + k * 7), weighIns: line(0, 35 + k * 7, 60, 0), startDate: iso(0), adherence: "all", ...week });
      p = { ...p, coach: withCheckIn(p.coach, c) };
      if (k === 3) expect(c.atFloor).toBe(true);
    }
    for (const d of ["rest", "train", "hard"] as const) {
      const t = explainTargets(p, d);
      expect(t.kcal).toBeGreaterThanOrEqual(1200);
      // The correction shown is the one that really applies.
      const step = t.steps.find((s) => /coach/i.test(s.label));
      if (step) expect(Math.abs(Number(step.value.replace(/[^\d-]/g, "")))).toBeLessThanOrEqual(Math.abs(p.coach!.adjustKcal));
    }
  });
});

describe("the finish line", () => {
  it("puts a date on 15 lb", () => {
    const t = goalTimeline({ ...base, targetWeightKg: 90 - 15 / 2.2046 }, "2026-01-01")!;
    // 6.8 kg at ~0.6 kg a week, slowing as the weight drops: roughly 11–16 weeks.
    expect(t.weeks).toBeGreaterThanOrEqual(10);
    expect(t.weeks).toBeLessThanOrEqual(17);
    expect(t.slow).toBe(false);
  });
  it("holds the weight once there", () => {
    const p = { ...base, weightKg: 80, targetWeightKg: 80 };
    expect(goalReached(p)).toBe(true);
    expect(goalTimeline(p, "2026-01-01")).toBeNull();
    const t = explainTargets(p, "train");
    expect(Math.abs(t.kcal - t.maintenance)).toBeLessThan(20);
  });
  it("turns down unhealthy targets", () => {
    expect(checkTarget(base, lowestHealthyKg(178) - 2).ok).toBe(false);
    expect(checkTarget(base, 95).ok).toBe(false);
    expect(checkTarget(base, 80).ok).toBe(true);
  });
});
