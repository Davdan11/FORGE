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
  it("shows Fahrenheit to pound users, rounded the way ovens are marked", () => {
    expect(localizeCooking("Roast at 220 °C for 25 min.", "lb")).toBe("Roast at 425 °F for 25 min.");
    expect(localizeCooking("until the inside hits 75 °C.", "lb")).toBe("until the inside hits 165 °F.");
    expect(localizeCooking("Bake at 180–200 °C.", "lb")).toBe("Bake at 350–400 °F.");
  });
  it("leaves Celsius alone for everyone else", () => {
    expect(localizeCooking("Roast at 220 °C.", "kg")).toBe("Roast at 220 °C.");
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
