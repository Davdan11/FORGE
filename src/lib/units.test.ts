import { describe, expect, it } from "vitest";
import { e1rm, fmtDuration, fmtHeight, fmtLoad, fmtPace, kgToLb, lbToKg, platesFor, roundLoad } from "./units";

/* These decide the number on the bar and what the athlete is told to load.
   Wrong here is not a cosmetic bug. */

describe("roundLoad", () => {
  it("snaps metric loads to the 2.5 kg that actually exists", () => {
    expect(roundLoad(61.2, "kg")).toBe(60);
    expect(roundLoad(63.8, "kg")).toBe(65);
    expect(roundLoad(62.5, "kg")).toBe(62.5);
  });

  it("snaps imperial loads to 5 lb, returning kg", () => {
    expect(kgToLb(roundLoad(lbToKg(137), "lb"))).toBeCloseTo(135, 6);
    expect(kgToLb(roundLoad(lbToKg(138), "lb"))).toBeCloseTo(140, 6);
  });

  it("never returns a negative load", () => {
    expect(roundLoad(0, "kg")).toBe(0);
    expect(roundLoad(0.4, "kg")).toBe(0);
  });
});

describe("platesFor", () => {
  it("loads 100 kg as 25+15 per side on a 20 kg bar", () => {
    const { bar, perSide, short } = platesFor(100, "kg");
    expect(bar).toBe("20 kg bar");
    expect(perSide).toEqual(["25", "15"]);
    expect(short).toBe(false);
    // The plates must actually add up to the requested load.
    expect(20 + perSide.reduce((a, p) => a + Number(p), 0) * 2).toBe(100);
  });

  it("flags a load lighter than the empty bar instead of going negative", () => {
    const { perSide, short } = platesFor(15, "kg");
    expect(short).toBe(true);
    expect(perSide).toEqual([]);
  });

  it("treats the bare bar as loadable with no plates", () => {
    const { perSide, short } = platesFor(20, "kg");
    expect(short).toBe(false);
    expect(perSide).toEqual([]);
  });

  it("adds up in imperial too", () => {
    const { perSide } = platesFor(lbToKg(225), "lb");
    expect(perSide).toEqual(["45", "45"]);
    expect(45 + perSide.reduce((a, p) => a + Number(p), 0) * 2).toBe(225);
  });

  it("does not drop a plate to floating point drift", () => {
    // 62.5 kg = bar + 21.25 per side = 20 + 1.25.
    expect(platesFor(62.5, "kg").perSide).toEqual(["20", "1.25"]);
  });
});

describe("e1rm (Epley)", () => {
  it("returns the load itself for a single", () => {
    expect(e1rm(100, 1)).toBe(100);
  });

  it("estimates above the load for multiple reps", () => {
    expect(e1rm(100, 5)).toBeCloseTo(116.667, 3);
    expect(e1rm(100, 10)).toBeCloseTo(133.333, 3);
  });

  it("rises with reps at the same load, so a better set always scores higher", () => {
    const at = (reps: number) => e1rm(100, reps);
    expect(at(6)).toBeGreaterThan(at(5));
    expect(at(12)).toBeGreaterThan(at(6));
  });

  it("guards the zero-rep case rather than inventing a max", () => {
    expect(e1rm(100, 0)).toBe(100);
  });
});

describe("formatters", () => {
  it("formats durations with an hour only when there is one", () => {
    expect(fmtDuration(59)).toBe("0:59");
    expect(fmtDuration(600)).toBe("10:00");
    expect(fmtDuration(3661)).toBe("1:01:01");
  });

  it("converts pace per km to per mile in imperial", () => {
    expect(fmtPace(300, "km")).toBe("5:00 /km");
    expect(fmtPace(300, "mi")).toBe("8:03 /mi");
  });

  it("shows an em dash rather than NaN for an undefined or infinite pace", () => {
    expect(fmtPace(undefined, "km")).toBe("—");
    expect(fmtPace(Infinity, "km")).toBe("—");
    expect(fmtLoad(undefined, "kg")).toBe("—");
  });

  it("formats height in feet and inches", () => {
    expect(fmtHeight(175, "kg")).toBe("175 cm");
    expect(fmtHeight(182.88, "lb")).toBe("6'0\"");
  });
});
