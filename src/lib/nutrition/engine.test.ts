import { describe, expect, it } from "vitest";
import { buildNutritionDay, dailyTargets, dayTotals, groceryList } from "./engine";
import { getMeal } from "./recipes";
import type { Profile } from "../types";

const make = (over: Partial<Profile> = {}): Profile => ({
  id: "p1", name: "Test", sex: "male", age: 30, heightCm: 175, weightKg: 78,
  units: { weight: "kg", distance: "km" }, goal: "build", level: "intermediate", daysPerWeek: 4, sessionMinutes: 60,
  equipment: ["barbell", "rack", "bench", "dumbbell"], pain: [],
  baselines: {}, dietary: [], mealsPerDay: 4, wakeTime: "07:00", trainTime: "18:00",
  notifications: false, createdAt: "2026-01-01T00:00:00.000Z", ...over,
});

describe("dailyTargets", () => {
  it("produces a plausible intake rather than a number that would starve someone", () => {
    const t = dailyTargets(make(), "train");
    expect(t.kcal).toBeGreaterThan(1500);
    expect(t.kcal).toBeLessThan(5000);
    expect(t.protein).toBeGreaterThan(0);
    expect(t.carbs).toBeGreaterThan(0);
    expect(t.fat).toBeGreaterThan(0);
  });

  it("keeps the macros roughly consistent with the calorie target", () => {
    const t = dailyTargets(make(), "train");
    const fromMacros = t.protein * 4 + t.carbs * 4 + t.fat * 9;
    expect(Math.abs(fromMacros - t.kcal) / t.kcal).toBeLessThan(0.1);
  });

  it("eats less on a cut than on a build, and more on a hard day than at rest", () => {
    expect(dailyTargets(make({ goal: "cut" }), "train").kcal).toBeLessThan(dailyTargets(make({ goal: "build" }), "train").kcal);
    const p = make();
    expect(dailyTargets(p, "hard").kcal).toBeGreaterThan(dailyTargets(p, "train").kcal);
    expect(dailyTargets(p, "train").kcal).toBeGreaterThan(dailyTargets(p, "rest").kcal);
  });

  it("raises protein per kilo when cutting, to protect muscle in a deficit", () => {
    const p = make();
    const cut = dailyTargets({ ...p, goal: "cut" }, "train");
    const endurance = dailyTargets({ ...p, goal: "endurance" }, "train");
    expect(cut.protein / p.weightKg).toBeGreaterThan(endurance.protein / p.weightKg);
  });

  it("scales with bodyweight", () => {
    expect(dailyTargets(make({ weightKg: 95 }), "train").protein).toBeGreaterThan(dailyTargets(make({ weightKg: 60 }), "train").protein);
  });

  it("sets a tighter sugar ceiling on a cut and a fibre floor that never drops below 25 g", () => {
    const p = make();
    expect(dailyTargets({ ...p, goal: "cut" }, "train").sugarMax / dailyTargets({ ...p, goal: "cut" }, "train").kcal)
      .toBeLessThan(dailyTargets(p, "train").sugarMax / dailyTargets(p, "train").kcal);
    expect(dailyTargets(make({ weightKg: 45, heightCm: 150, age: 60, sex: "female" }), "rest").fiberMin).toBeGreaterThanOrEqual(25);
  });
});

describe("buildNutritionDay", () => {
  it("plans exactly as many meals as the athlete asked for", () => {
    for (const meals of [3, 4, 5] as const) {
      const day = buildNutritionDay(make({ mealsPerDay: meals }), "2026-01-05", null);
      expect(day.meals).toHaveLength(meals);
    }
  });

  it("gives every meal a time, and orders the day forwards", () => {
    const day = buildNutritionDay(make(), "2026-01-05", null);
    const times = day.meals.map((m) => m.time);
    expect(times.every((t) => /^\d{2}:\d{2}$/.test(t))).toBe(true);
    expect([...times].sort()).toEqual(times);
  });

  it("does not repeat a meal the athlete has just eaten", () => {
    const p = make();
    const first = buildNutritionDay(p, "2026-01-05", null);
    const recent = first.meals.map((m) => m.mealId);
    const second = buildNutritionDay(p, "2026-01-06", null, first, recent);
    for (const m of second.meals) expect(recent).not.toContain(m.mealId);
  });

  it("does not repeat a meal within the same day either", () => {
    const day = buildNutritionDay(make({ mealsPerDay: 5 }), "2026-01-05", null);
    expect(new Set(day.meals.map((m) => m.mealId)).size).toBe(day.meals.length);
  });

  it("only picks meals that exist in the catalogue", () => {
    const day = buildNutritionDay(make(), "2026-01-05", null);
    for (const m of day.meals) expect(getMeal(m.mealId)).toBeTruthy();
  });

  it("respects a vegan athlete on every meal of the day", () => {
    const day = buildNutritionDay(make({ dietary: ["vegan"] }), "2026-01-05", null);
    for (const m of day.meals) expect(getMeal(m.mealId)?.tags).toContain("vegan");
  });

  it("respects gluten-free and lactose-free together", () => {
    const day = buildNutritionDay(make({ dietary: ["gluten_free", "lactose_free"] }), "2026-01-05", null);
    for (const m of day.meals) {
      const tags = getMeal(m.mealId)?.tags ?? [];
      expect(tags).toContain("gluten_free");
      expect(tags).toContain("lactose_free");
    }
  });

  it("lands close to the calorie target once the meals are scaled", () => {
    const p = make();
    const day = buildNutritionDay(p, "2026-01-05", null);
    const totals = dayTotals(day);
    expect(Math.abs(totals.kcal - day.targets.kcal) / day.targets.kcal).toBeLessThan(0.15);
  });

  it("starts the day with nothing ticked off", () => {
    const day = buildNutritionDay(make(), "2026-01-05", null);
    expect(day.meals.every((m) => !m.done)).toBe(true);
  });
});

describe("groceryList", () => {
  it("merges the week into one alphabetical list, each ingredient appearing once", () => {
    const p = make();
    const days = ["2026-01-05", "2026-01-06", "2026-01-07"].map((d) => buildNutritionDay(p, d, null));
    const list = groceryList(days);
    expect(list.length).toBeGreaterThan(0);

    const keys = list.map((l) => l.item.toLowerCase());
    expect(new Set(keys).size).toBe(keys.length);
    expect([...list.map((l) => l.item)].sort((a, b) => a.localeCompare(b))).toEqual(list.map((l) => l.item));
  });

  it("keeps a quantity line per time an ingredient is needed, so nothing is under-bought", () => {
    const p = make();
    const day = buildNutritionDay(p, "2026-01-05", null);
    const once = groceryList([day]);
    const twice = groceryList([day, day]);
    expect(twice.length).toBe(once.length);
    const totalOnce = once.reduce((a, l) => a + l.qty.length, 0);
    expect(twice.reduce((a, l) => a + l.qty.length, 0)).toBe(totalOnce * 2);
  });

  it("returns nothing for an empty week rather than throwing", () => {
    expect(groceryList([])).toEqual([]);
  });
});
