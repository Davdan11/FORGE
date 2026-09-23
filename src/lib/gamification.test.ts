import { describe, expect, it } from "vitest";
import { evaluateBadges } from "./gamification";
import { LEVELS_PER_TIER, SUB_RANKS, TIERS, rankFor, subRankFor } from "./gamification";

/* The rank artwork is drawn at five sub-ranks per tier. Every level must land
   on one of them, in order, and each tier must start again at I. */
describe("sub-ranks", () => {
  it("gives each sub-rank two levels, I to V", () => {
    expect(Array.from({ length: LEVELS_PER_TIER }, (_, i) => subRankFor(1 + i))).toEqual(["I", "I", "II", "II", "III", "III", "IV", "IV", "V", "V"]);
  });

  it("restarts at I in every tier", () => {
    for (const t of TIERS) expect(rankFor(t.from)).toBe(`${t.name} I`);
  });

  it("uses every sub-rank in every tier", () => {
    for (const t of TIERS) {
      const seen = new Set(Array.from({ length: LEVELS_PER_TIER }, (_, i) => subRankFor(t.from + i)));
      expect([...seen]).toEqual([...SUB_RANKS]);
    }
  });
});

import { payOnce } from "./progress";

describe("daily rewards pay once", () => {
  it("pays a check-in once a day, however often it is redone", () => {
    const s: { paidDay?: { date: string; keys: string[] } } = {};
    expect(payOnce(s, "2026-09-22", "readiness")).toBe(true);
    expect(payOnce(s, "2026-09-22", "readiness")).toBe(false);
    expect(payOnce(s, "2026-09-23", "readiness")).toBe(true);
  });
  it("pays each meal and the full-day bonus once, separately", () => {
    const s: { paidDay?: { date: string; keys: string[] } } = {};
    expect(payOnce(s, "2026-09-22", "meal:0")).toBe(true);
    expect(payOnce(s, "2026-09-22", "meal:1")).toBe(true);
    expect(payOnce(s, "2026-09-22", "meal:0")).toBe(false);
    expect(payOnce(s, "2026-09-22", "fullday")).toBe(true);
    expect(payOnce(s, "2026-09-22", "fullday")).toBe(false);
  });
});

describe("progress badges", () => {
  const stats = { id: "me", xp: 0, level: 1, streakWeeks: 0, badges: [], totals: { sessions: 0, volumeKg: 0, distanceM: 0, mobilityMin: 0, mealsLogged: 0 } } as never;
  const ctx = (weightChangeKg: number, goal: "cut" | "build", fullWeeks = 0) => ({ bestE1rm: {}, bodyweightKg: 80, zone2Min: 0, weightChangeKg, goal, fullWeeks });
  it("congratulates a loss only on a fat-loss plan", () => {
    expect(evaluateBadges(stats, ctx(-2.5, "cut"))).toEqual(expect.arrayContaining(["down_1lb", "down_5lb"]));
    expect(evaluateBadges(stats, ctx(-2.5, "build"))).not.toContain("down_1lb");
  });
  it("congratulates a gain only on a muscle-gain plan", () => {
    expect(evaluateBadges(stats, ctx(1, "build"))).toContain("up_2lb");
    expect(evaluateBadges(stats, ctx(1, "cut"))).not.toContain("up_2lb");
  });
  it("rewards a full week and four of them", () => {
    expect(evaluateBadges(stats, ctx(0, "cut", 1))).toContain("full_week");
    expect(evaluateBadges(stats, ctx(0, "cut", 4))).toEqual(expect.arrayContaining(["full_week", "full_month"]));
  });
});
