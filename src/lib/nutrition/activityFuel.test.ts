import { describe, expect, it } from "vitest";
import { fuelFor } from "./activityFuel";
import { withActivityFuel } from "./engine";

describe("fuel for unplanned training", () => {
  it("feeds a watch run on a rest day, at 75 % of the watch's figure", () => {
    expect(fuelFor([{ kcal: 600 }], "rest").extra).toBe(450);
  });
  it("does not pay twice for the session the plan already feeds", () => {
    expect(fuelFor([{ kcal: 380 }], "train").extra).toBe(0);
  });
  it("tops up a long ride on top of the plan, capped", () => {
    expect(fuelFor([{ kcal: 1400 }], "hard").extra).toBe(600);
    expect(fuelFor([{ kcal: 5000 }], "rest").extra).toBe(1000);
  });
  it("puts it in carbs and fat, never protein", () => {
    const t = withActivityFuel({ kcal: 2200, protein: 160, carbs: 220, fat: 70 }, 400);
    expect(t.protein).toBe(160);
    expect(t.kcal).toBe(2600);
    expect(t.carbs * 4 + t.fat * 9 - (220 * 4 + 70 * 9)).toBeGreaterThan(380);
  });
});
