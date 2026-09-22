import { describe, expect, it } from "vitest";
import { activityKcal, hrSummary, maxHrFor, zoneOf, type HrSeries } from "./heart";

/* Calories are the number people quote back. It has to be plausible, and an
   estimate must never pass for a measurement. */

const athlete = { weightKg: 78, age: 30, sex: "male" as const };
const steady = (bpm: number, minutes: number): HrSeries => Array.from({ length: minutes * 12 + 1 }, (_, i) => [i * 5, bpm]);

describe("heart rate", () => {
  it("places zones on max heart rate", () => {
    const max = maxHrFor(30); // 187
    expect(max).toBe(187);
    expect(zoneOf(100, max)).toBe(1);
    expect(zoneOf(135, max)).toBe(3);
    expect(zoneOf(175, max)).toBe(5);
  });

  it("summarises a series and ignores impossible readings", () => {
    expect(hrSummary([[0, 140], [5, 150], [10, 0], [15, 255], [20, 160]])).toEqual({ avg: 150, max: 160 });
    expect(hrSummary([])).toBeNull();
  });
});

describe("calories", () => {
  it("uses heart rate when the strap covered the activity", () => {
    const r = activityKcal({ type: "run", movingMin: 30, distanceM: 5000, profile: athlete, hr: steady(150, 30) });
    expect(r.source).toBe("heart_rate");
    // Keytel for a 30-year-old 78 kg man at 150 bpm: (−55.0969 + 0.6309·150
    // + 0.1988·78 + 0.2017·30) / 4.184 ≈ 14.6 kcal a minute.
    expect(r.kcal).toBe(438);
  });

  it("falls back to an estimate when the strap dropped out early", () => {
    const r = activityKcal({ type: "run", movingMin: 60, distanceM: 10000, profile: athlete, hr: steady(150, 5) });
    expect(r.source).toBe("estimate");
  });

  it("estimates from sport and pace without a sensor, and faster costs more", () => {
    const easy = activityKcal({ type: "run", movingMin: 30, distanceM: 4000, profile: athlete });
    const hard = activityKcal({ type: "run", movingMin: 30, distanceM: 7000, profile: athlete });
    expect(easy.source).toBe("estimate");
    expect(hard.kcal).toBeGreaterThan(easy.kcal);
    // A 10 km/h run for 30 min at 78 kg is about 390 kcal.
    expect(activityKcal({ type: "run", movingMin: 30, distanceM: 5000, profile: athlete }).kcal).toBeGreaterThan(300);
  });

  it("gives a walk far less than a run of the same time", () => {
    const walk = activityKcal({ type: "walk", movingMin: 30, distanceM: 2500, profile: athlete });
    const run = activityKcal({ type: "run", movingMin: 30, distanceM: 5000, profile: athlete });
    expect(walk.kcal).toBeLessThan(run.kcal / 2);
  });

  it("is zero for zero minutes", () => {
    expect(activityKcal({ type: "hockey", movingMin: 0, distanceM: 0, profile: athlete }).kcal).toBe(0);
  });
});
