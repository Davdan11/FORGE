import { describe, expect, it } from "vitest";
import { localeUnits, localizeCooking } from "./units";
import { catalogIds, getMeal } from "./nutrition/recipes";
import { MEALS } from "./data/meals";
import { minimumAge } from "./brand";

describe("default units by region", () => {
  it("uses pounds and miles in the US", () => {
    expect(localeUnits("en-US")).toEqual({ weight: "lb", distance: "mi" });
  });
  it("weighs in kilograms and runs in miles in the UK", () => {
    expect(localeUnits("en-GB")).toEqual({ weight: "kg", distance: "mi" });
  });
  it("is metric everywhere else, and when the region is unknown", () => {
    expect(localeUnits("fr-CA")).toEqual({ weight: "kg", distance: "km" });
    expect(localeUnits("en-AU")).toEqual({ weight: "kg", distance: "km" });
    expect(localeUnits("en")).toEqual({ weight: "kg", distance: "km" });
  });
});


describe("cooking temperatures", () => {
  it("shows Fahrenheit first to pound users, rounded the way ovens are marked, with Celsius alongside", () => {
    expect(localizeCooking("Roast at 220 °C for 25 min.", "lb")).toBe("Roast at 425 °F (220 °C) for 25 min.");
    expect(localizeCooking("Preheat to 200 °C.", "lb")).toBe("Preheat to 400 °F (200 °C).");
    expect(localizeCooking("until the inside hits 74 °C.", "lb")).toBe("until the inside hits 165 °F (74 °C).");
    expect(localizeCooking("pork to 63 °C, beef to 57 °C", "lb")).toBe("pork to 145 °F (63 °C), beef to 135 °F (57 °C)");
    expect(localizeCooking("Bake at 180–200 °C.", "lb")).toBe("Bake at 350–400 °F (180–200 °C).");
  });
  it("shows Celsius first to everyone else, with Fahrenheit alongside", () => {
    expect(localizeCooking("Roast at 220 °C.", "kg")).toBe("Roast at 220 °C (425 °F).");
  });
  it("never nests brackets and never converts twice", () => {
    expect(localizeCooking("until steaming (74 °C).", "kg")).toBe("until steaming (74 °C / 165 °F).");
    const once = localizeCooking("Roast at 220 °C.", "kg");
    expect(localizeCooking(once, "kg")).toBe(once);
  });
  it("gives pound users inches next to centimetres", () => {
    expect(localizeCooking("cut into 2 cm cubes", "lb", "en")).toBe("cut into 2 cm (¾ in) cubes");
    expect(localizeCooking("en cubes de 2,5 cm", "lb", "fr")).toBe("en cubes de 2,5 cm (1 po)");
    expect(localizeCooking("cut into 2 cm cubes", "kg")).toBe("cut into 2 cm cubes");
  });
});

describe("every recipe reads as American English", () => {
  // Words a US cook would stop at. Ids (turkey-mince, courgette) are not shown.
  const BRITISH = /\b(courgettes?|aubergines?|coriander|spring onions?|rocket|mince|colour|flavour|fibre|centre|grey|yoghurt|tinned|chilli)\b/i;
  it("has none of them, across all generated and curated recipes", () => {
    const bad: string[] = [];
    const check = (label: string, text: string) => { if (BRITISH.test(text)) bad.push(`${label}: ${text.match(BRITISH)![0]}`); };
    for (const m of MEALS) check(m.id, [m.name, m.tip ?? "", ...m.steps, ...m.ingredients.map((i) => i.item)].join(" "));
    for (const id of catalogIds()) {
      const m = getMeal(id);
      if (m) check(id, [m.name, m.tip ?? "", ...m.steps, ...m.ingredients.map((i) => i.item)].join(" "));
      if (bad.length > 5) break;
    }
    expect(bad).toEqual([]);
  }, 60_000);
});

describe("minimum age", () => {
  it("is 13 in the US and the UK", () => {
    expect(minimumAge("en-US", "America/New_York")).toBe(13);
    expect(minimumAge("en-GB", "Europe/London")).toBe(13);
  });
  it("is 16 in the EU, by language region or by time zone", () => {
    expect(minimumAge("de-DE", "Europe/Berlin")).toBe(16);
    expect(minimumAge("en-US", "Europe/Paris")).toBe(16);
    expect(minimumAge("fr-FR", "America/Montreal")).toBe(16);
  });
});
