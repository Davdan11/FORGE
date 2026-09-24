import { describe, expect, it } from "vitest";
import { FIELD, expected, rateRace, ratingTier, startRating } from "./rating";

describe("FORGE rating", () => {
  it("starts a new rider at their category's field strength", () => {
    expect(startRating("C").value).toBe(FIELD.C);
    expect(expected(FIELD.C, FIELD.C)).toBeCloseTo(0.5);
  });

  it("rises for a win, falls for last place, most in the first races", () => {
    const won = rateRace(undefined, "C", 1, 15);
    const last = rateRace(undefined, "C", 15, 15);
    expect(won.value).toBe(FIELD.C + 32);
    expect(last.value).toBe(FIELD.C - 32);
    // After five races the steps halve.
    let r = startRating("C"); for (let i = 0; i < 5; i++) r = rateRace(r, "C", 8, 15);
    expect(rateRace(r, "C", 1, 15).value - r.value).toBeLessThan(20);
  });

  it("moves a strong rider little for winning an easy field", () => {
    const strong = { ...startRating("A"), races: 10 };
    const winD = rateRace(strong, "D", 1, 15).value - strong.value;
    const winA = rateRace(strong, "A", 1, 15).value - strong.value;
    expect(winD).toBeLessThan(winA);
    expect(winD).toBeGreaterThanOrEqual(0);
  });

  it("ignores impossible results and keeps a short history", () => {
    const r = startRating("B");
    expect(rateRace(r, "B", 0, 10)).toBe(r);
    expect(rateRace(r, "B", 3, 1)).toBe(r);
    let h = r; for (let i = 0; i < 14; i++) h = rateRace(h, "B", 2, 10);
    expect(h.history.length).toBe(10);
    expect(h.best).toBeGreaterThanOrEqual(h.value);
  });

  it("names the level", () => {
    expect(ratingTier(2000)).toBe("Élite");
    expect(ratingTier(900, true)).toBe("Rookie");
  });
});
