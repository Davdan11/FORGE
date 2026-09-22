import { describe, expect, it } from "vitest";
import { consistency, liftTrends, readGoal, recentWeeks, trendOfCompleted, trendPerWeek, weekStart, weekly } from "./analytics";
import type { Activity, LoggedSet, SessionLog } from "./types";

const set = (slug: string, at: string, loadKg: number, reps: number): LoggedSet =>
  ({ id: `${slug}${at}${loadKg}`, sessionId: "s", exerciseId: "e", setIndex: 0, slug, at, loadKg, reps });

describe("week bucketing", () => {
  it("snaps any day to the Monday of its week", () => {
    // 2026-01-07 is a Wednesday; 2026-01-05 is the Monday.
    expect(weekStart("2026-01-07")).toBe("2026-01-05");
    expect(weekStart("2026-01-05")).toBe("2026-01-05");
    expect(weekStart("2026-01-11")).toBe("2026-01-05");   // Sunday still belongs to it
    expect(weekStart("2026-01-12")).toBe("2026-01-12");   // next Monday
  });

  it("accepts a full timestamp, not only a date", () => {
    expect(weekStart("2026-01-07T18:30:00.000Z")).toBe("2026-01-05");
  });

  it("lists the last n weeks oldest first, ending on this week", () => {
    const w = recentWeeks("2026-01-07", 3);
    expect(w).toEqual(["2025-12-22", "2025-12-29", "2026-01-05"]);
  });

  it("keeps empty weeks at zero so a gap stays visible", () => {
    const weeks = recentWeeks("2026-01-19", 3);   // Dec 29, Jan 5, Jan 12... plus current
    const rows = [{ d: "2026-01-19", v: 5 }];
    const series = weekly(rows, (r) => r.d, (r) => r.v, weeks);
    expect(series).toHaveLength(weeks.length);
    expect(series.filter((s) => s.value === 0).length).toBe(weeks.length - 1);
    expect(series[series.length - 1].value).toBe(5);
  });

  it("ignores rows outside the window instead of folding them into the edge", () => {
    const weeks = recentWeeks("2026-01-19", 2);
    const series = weekly([{ d: "2020-01-01", v: 99 }], (r) => r.d, (r) => r.v, weeks);
    expect(series.every((s) => s.value === 0)).toBe(true);
  });
});

describe("liftTrends", () => {
  it("keeps the best estimate per day and orders them forwards", () => {
    const t = liftTrends([
      set("back-squat", "2026-01-05", 100, 5),
      set("back-squat", "2026-01-05", 90, 5),     // same day, lighter
      set("back-squat", "2026-01-12", 110, 5),
    ])[0];
    expect(t.points.map((p) => p.date)).toEqual(["2026-01-05", "2026-01-12"]);
    expect(t.points[0].e1rm).toBeCloseTo(116.7, 1);   // the 100 kg set, not the 90
  });

  it("reports the gain from the first session to the best one", () => {
    const t = liftTrends([
      set("bench-press", "2026-01-05", 100, 1),
      set("bench-press", "2026-02-05", 120, 1),
    ])[0];
    expect(t.first).toBe(100);
    expect(t.best).toBe(120);
    expect(t.gainPct).toBe(20);
  });

  it("skips a movement logged only once, which has no trend to show", () => {
    expect(liftTrends([set("deadlift", "2026-01-05", 140, 3)])).toEqual([]);
  });

  it("ignores bodyweight sets that carry no load", () => {
    const sets = [{ id: "a", sessionId: "s", exerciseId: "e", setIndex: 0, slug: "pull-up", at: "2026-01-05", reps: 10 } as LoggedSet,
                  { id: "b", sessionId: "s", exerciseId: "e", setIndex: 1, slug: "pull-up", at: "2026-01-12", reps: 12 } as LoggedSet];
    expect(liftTrends(sets)).toEqual([]);
  });

  it("puts the biggest gain first", () => {
    const trends = liftTrends([
      set("a-lift", "2026-01-05", 100, 1), set("a-lift", "2026-02-05", 105, 1),   // +5%
      set("b-lift", "2026-01-05", 100, 1), set("b-lift", "2026-02-05", 130, 1),   // +30%
    ]);
    expect(trends[0].slug).toBe("b-lift");
  });
});

describe("consistency", () => {
  const weeks = recentWeeks("2026-01-26", 4);
  const log = (d: string): SessionLog => ({ id: d, sessionId: "s", startedAt: d, xp: 0 });

  it("counts both gym sessions and recorded activities", () => {
    const act = { id: "a", type: "run", startedAt: weeks[3], distanceM: 5000, durationSec: 1500 } as Activity;
    const c = consistency([log(weeks[3])], [act], weeks);
    expect(c.sessions[3].value).toBe(2);
  });

  it("measures the longest unbroken run of weeks", () => {
    const c = consistency([log(weeks[0]), log(weeks[1]), log(weeks[3])], [], weeks);
    expect(c.weeksTrained).toBe(3);
    expect(c.longestRun).toBe(2);
  });

  it("reports an untouched window honestly", () => {
    const c = consistency([], [], weeks);
    expect(c.weeksTrained).toBe(0);
    expect(c.longestRun).toBe(0);
  });
});

describe("trendPerWeek", () => {
  it("is positive when a series climbs and negative when it falls", () => {
    expect(trendPerWeek([1, 2, 3, 4])).toBeGreaterThan(0);
    expect(trendPerWeek([4, 3, 2, 1])).toBeLessThan(0);
  });

  it("is flat for a flat series, and zero when there is nothing to fit", () => {
    expect(trendPerWeek([5, 5, 5])).toBe(0);
    expect(trendPerWeek([7])).toBe(0);
    expect(trendPerWeek([])).toBe(0);
  });

  it("recovers a known slope", () => {
    expect(trendPerWeek([0, 2, 4, 6])).toBeCloseTo(2, 6);
  });
});

describe("readGoal", () => {
  const weeks = recentWeeks("2026-03-02", 8);
  const base = {
    weights: [], lifts: [], tonnage: weekly([], () => "", () => 0, weeks),
    distance: weekly([], () => "", () => 0, weeks), readiness: [],
  };
  const trained = (n: number) => consistency(weeks.slice(0, n).map((w) => ({ id: w, sessionId: "s", startedAt: w, xp: 0 })), [], weeks);

  it("refuses to draw conclusions from under three weeks", () => {
    const r = readGoal({ ...base, goal: "build", consistency: trained(2) });
    expect(r.headline).toMatch(/too early/i);
    expect(r.missing).toBeUndefined();
  });

  it("names consistency as the thing to fix when weeks are being missed", () => {
    const r = readGoal({ ...base, goal: "build", consistency: trained(4) });   // 4 of 8
    expect(r.missing).toMatch(/4 of the last 8 weeks/);
  });

  it("calls a cut healthy when weight falls at a sustainable rate", () => {
    const weights = weeks.map((d, i) => ({ id: d, date: d, kg: 90 - i * 0.5 }));
    const r = readGoal({ ...base, goal: "cut", weights, consistency: trained(8) });
    expect(r.headline).toMatch(/sustainable/i);
    expect(r.onTrack).toBeGreaterThan(0.7);
  });

  it("says so plainly when a cut is not moving", () => {
    const weights = weeks.map((d) => ({ id: d, date: d, kg: 90 }));
    const r = readGoal({ ...base, goal: "cut", weights, consistency: trained(8) });
    expect(r.headline).toMatch(/not moving down/i);
    expect(r.missing).toMatch(/calories/i);
  });

  it("asks for weigh-ins rather than guessing when there are none", () => {
    const r = readGoal({ ...base, goal: "cut", consistency: trained(8) });
    expect(r.detail).toMatch(/log your weight/i);
  });

  it("always returns a readable headline and a confidence between 0 and 1", () => {
    for (const goal of ["cut", "build", "strength", "endurance", "perform", "recomp"] as const) {
      const r = readGoal({ ...base, goal, consistency: trained(8) });
      expect(r.headline.length).toBeGreaterThan(0);
      expect(r.onTrack).toBeGreaterThanOrEqual(0);
      expect(r.onTrack).toBeLessThanOrEqual(1);
    }
  });
});

describe("trendOfCompleted", () => {
  it("ignores the week in progress, which is always short", () => {
    // Four full weeks climbing, then a partial current week.
    const series = [10, 20, 30, 40, 5].map((value, i) => ({ label: `w${i}`, value }));
    expect(trendOfCompleted(series)).toBeGreaterThan(0);
    expect(trendPerWeek(series.map((s) => s.value))).toBeLessThan(trendOfCompleted(series));
  });

  it("returns zero rather than throwing when there is only the current week", () => {
    expect(trendOfCompleted([{ label: "w0", value: 9 }])).toBe(0);
    expect(trendOfCompleted([])).toBe(0);
  });
});
