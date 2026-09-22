import { describe, expect, it } from "vitest";
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
