import { describe, expect, it } from "vitest";
import { buildNutritionDay, dayTotals, eatenTotals } from "./engine";
import { cleanBarcode, entryFrom, extrasTotals, parseOffProduct, portion, searchLocal, suggestAdherence } from "./foodlog";
import type { FoodEntry, NutritionDay, Profile } from "../types";

const profile: Profile = {
  id: "p1", name: "Test", sex: "male", age: 30, heightCm: 175, weightKg: 78,
  units: { weight: "kg", distance: "km" }, goal: "recomp", level: "intermediate", daysPerWeek: 4, sessionMinutes: 60,
  equipment: ["barbell", "rack", "bench", "dumbbell"], pain: [],
  baselines: {}, dietary: [], mealsPerDay: 3, wakeTime: "07:00", trainTime: "18:00",
  notifications: false, createdAt: "2026-01-01T00:00:00.000Z",
};

const extra = (kcal: number, protein = 0, carbs = 0, fat = 0): FoodEntry => ({ id: String(Math.random()), time: "15:00", name: "Barre", grams: 50, kcal, protein, carbs, fat, source: "manual" });

describe("eaten totals include food eaten off the plan", () => {
  const day: NutritionDay = buildNutritionDay(profile, "2026-09-29", null);

  it("counts extras on top of ticked meals, and nothing else", () => {
    const none = eatenTotals(day);
    expect(none.kcal).toBe(0);
    const withExtras = { ...day, extras: [extra(250, 10, 30, 8), extra(100, 5, 10, 3)] };
    const e = eatenTotals(withExtras);
    expect(e.kcal).toBe(350);
    expect(e.protein).toBe(15);
    expect(e.carbs).toBe(40);
    expect(e.fat).toBe(11);
    // The planned day is still the plan.
    expect(dayTotals(withExtras).kcal).toBeCloseTo(dayTotals(day).kcal);
  });

  it("adds extras to ticked meals and ignores a skipped (replaced) meal", () => {
    const meals = day.meals.map((m, i) => (i === 0 ? { ...m, done: true } : i === 1 ? { ...m, done: true, skipped: true } : m));
    const ticked = eatenTotals({ ...day, meals: [meals[0]] });
    const e = eatenTotals({ ...day, meals, extras: [extra(300)] });
    expect(e.kcal).toBeCloseTo(ticked.kcal + 300);
  });

  it("extrasTotals handles a day without extras", () => {
    expect(extrasTotals({}).kcal).toBe(0);
  });
});

describe("Open Food Facts parsing", () => {
  const liberte = {
    code: "0065684005307", product_name: "Greek yogurt", product_name_fr: "Liberté Grec (0% MG)", brands: ["Liberté", "General Mills"],
    nutriments: { "energy-kcal_100g": 57.142857, proteins_100g: 9.7142857, carbohydrates_100g: 3.43, fat_100g: 0, sugars_100g: 3.43, fiber_100g: 1 },
    serving_size: "175 g", serving_quantity: 175, image_small_url: "https://images.openfoodfacts.org/x.jpg",
  };

  it("reads per-100 g values, the French name and the first brand", () => {
    const x = parseOffProduct(liberte, "fr")!;
    expect(x.name).toBe("Liberté Grec (0% MG)");
    expect(x.brand).toBe("Liberté");
    expect(x.per100).toEqual({ kcal: 57.1, protein: 9.7, carbs: 3.4, fat: 0, sugar: 3.4, fiber: 1 });
    expect(x.servingG).toBe(175);
    expect(x.offCode).toBe("0065684005307");
    expect(parseOffProduct(liberte, "en")!.name).toBe("Greek yogurt");
  });

  it("scales per 100 g to the portion eaten", () => {
    const x = parseOffProduct(liberte)!;
    const p = portion(x.per100, 175);
    expect(p.kcal).toBe(100);           // 57.1 × 1.75
    expect(p.protein).toBe(17);         // 9.7 × 1.75 = 16.975
    expect(p.carbs).toBe(6);            // 3.4 × 1.75 = 5.95
    const e = entryFrom(x, 175, "10:15");
    expect(e).toMatchObject({ time: "10:15", grams: 175, kcal: 100, source: "off", offCode: "0065684005307", brand: "Liberté" });
    expect(e.sugar).toBe(6);
  });

  it("brands as a comma string, kJ-only energy, string numbers", () => {
    const x = parseOffProduct({ code: "1", product_name: "Nutella", brands: "Nutella, Ferrero", nutriments: { "energy-kj_100g": 2252, proteins_100g: "6,3", carbohydrates_100g: 57.5, fat_100g: 30.9 } })!;
    expect(x.brand).toBe("Nutella");
    expect(x.per100.kcal).toBe(538.2);
    expect(x.per100.protein).toBe(6.3);
    expect(x.per100.sugar).toBeUndefined();
    expect(x.servingG).toBeUndefined();
  });

  it("skips products without calories or a name", () => {
    expect(parseOffProduct({ code: "2", product_name: "Mystère", nutriments: { proteins_100g: 3 } })).toBeNull();
    expect(parseOffProduct({ code: "3", nutriments: { "energy-kcal_100g": 100 } })).toBeNull();
    expect(parseOffProduct(null)).toBeNull();
  });

  it("recent re-logs are marked as such", () => {
    expect(entryFrom(parseOffProduct(liberte)!, 100, "08:00", true).source).toBe("recent");
  });
});

describe("local foods and barcodes", () => {
  it("finds common foods by French name, accents or not", () => {
    expect(searchLocal("poulet", "fr")[0]?.name.toLowerCase()).toContain("poulet");
    expect(searchLocal("oeuf", "fr").length + searchLocal("œuf", "fr").length).toBeGreaterThan(0);
    expect(searchLocal("chicken", "en")[0]?.name.toLowerCase()).toContain("chicken");
    expect(searchLocal("x", "fr")).toEqual([]);
  });
  it("accepts only real barcode lengths", () => {
    expect(cleanBarcode("0 65684 00530 7")).toBe("0065684005307".slice(1));
    expect(cleanBarcode("3017620422003")).toBe("3017620422003");
    expect(cleanBarcode("12345")).toBeNull();
  });
});

describe("adherence suggestion", () => {
  it("≥ 90 % of meals ticked → all", () => {
    expect(suggestAdherence({ mealsDone: 19, mealsPlanned: 21 })).toBe("all");
  });
  it("eaten within ±10 % of plan → all, even with few ticks", () => {
    expect(suggestAdherence({ mealsDone: 5, mealsPlanned: 21, eatenKcal: 14_500, plannedKcal: 14_000 })).toBe("all");
    expect(suggestAdherence({ mealsDone: 5, mealsPlanned: 21, eatenKcal: 12_700, plannedKcal: 14_000 })).toBe("all");
  });
  it("≥ 60 % of meals → most", () => {
    expect(suggestAdherence({ mealsDone: 13, mealsPlanned: 21 })).toBe("most");
    expect(suggestAdherence({ mealsDone: 18, mealsPlanned: 21 })).toBe("most"); // 86 %
  });
  it("all meals ticked but well over the plan with extras → most, not all", () => {
    expect(suggestAdherence({ mealsDone: 21, mealsPlanned: 21, eatenKcal: 18_000, plannedKcal: 14_000 })).toBe("most");
  });
  it("else some", () => {
    expect(suggestAdherence({ mealsDone: 6, mealsPlanned: 21, eatenKcal: 20_000, plannedKcal: 14_000 })).toBe("some");
    expect(suggestAdherence({ mealsDone: 2, mealsPlanned: 21 })).toBe("some");
  });
  it("nothing logged → no suggestion", () => {
    expect(suggestAdherence({ mealsDone: 0, mealsPlanned: 21 })).toBeNull();
    expect(suggestAdherence({ mealsDone: 0, mealsPlanned: 0 })).toBeNull();
  });
});
