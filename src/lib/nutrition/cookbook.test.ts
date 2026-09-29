import { describe, expect, it } from "vitest";
import { fraction, ingredientsFor, localizeMeal, mealTitle, minutesIn, renderQty, stepsFor } from "./cookbook";
import { catalogIds, getMeal, searchRecipes } from "./recipes";
import { MEALS } from "../data/meals";
import type { Meal } from "../types";

/* Recipes read like a cookbook in both languages: every generated and curated
   recipe has French and English, the grams in the steps are the grams in the
   ingredient list (at any portion scale), and temperatures show both scales. */

const TOKEN = /\{(g|ml|tsp|tbsp|n):(\d+(?:\.\d+)?)(?:\|[^|}]*\|[^}]*)?\}/g;
/** A sample across every template: each template's first recipe plus every 37th id. */
const sample = (() => {
  const ids = catalogIds();
  const seen = new Set<string>();
  const out: string[] = [];
  ids.forEach((id, i) => { const t = id.split(":")[1]; if (!seen.has(t) || i % 37 === 0) { seen.add(t); out.push(id); } });
  return out.map((id) => getMeal(id)!);
})();

describe("quantity tokens", () => {
  it("render grams, millilitres, spoons and counts in both languages", () => {
    expect(renderQty("{g:250} sweet potato", 1, "en")).toBe("250 g sweet potato");
    expect(renderQty("{ml:250} milk", 1, "en")).toBe("250 ml milk");
    expect(renderQty("{tsp:0.5} salt", 1, "en")).toBe("½ tsp salt");
    expect(renderQty("{tsp:0.5} de sel", 1, "fr")).toBe("½ c. à thé de sel");
    expect(renderQty("{tbsp:1.5}", 1, "fr")).toBe("1½ c. à soupe");
    expect(renderQty("{n:3|egg|eggs}", 1, "en")).toBe("3 eggs");
    expect(renderQty("{n:1|œuf|œufs}", 1, "fr")).toBe("1 œuf");
    expect(fraction(0.25)).toBe("¼");
  });
  it("scale with the portion, including decimal scales like 0.7 and 1.3", () => {
    expect(renderQty("{g:180}", 1.5, "en")).toBe("270 g");
    expect(renderQty("{g:180}", 0.7, "en")).toBe("125 g");
    expect(renderQty("{g:250}", 1.3, "en")).toBe("325 g");
    expect(renderQty("{ml:250}", 1.3, "en")).toBe("330 ml");
    expect(renderQty("{n:3|egg|eggs}", 1.3, "en")).toBe("4 eggs");
    expect(renderQty("{tsp:1}", 3, "en")).toBe("1 tbsp");
  });
  it("time a step from its first 'N min', in French too", () => {
    expect(minutesIn("Laisse mijoter 12 min, puis repose 5 min.")).toBe(720);
    expect(minutesIn("Blend 45 s.")).toBe(45);
    expect(minutesIn("Tranche le poulet.")).toBeNull();
  });
});

function checkBilingual(m: Meal) {
  expect(m.nameFr, m.id).toBeTruthy();
  expect(m.cuisineFr, m.id).toBeTruthy();
  expect(m.stepsFr?.length, m.id).toBe(m.steps.length);
  expect(m.ingredientsFr?.length, m.id).toBe(m.ingredients.length);
  if (m.timers) expect(m.timers.length, m.id).toBe(m.steps.length);
  if (m.tip) expect(m.tipFr, m.id).toBeTruthy();
  for (const lang of ["fr", "en"] as const) {
    const v = localizeMeal(m, lang, { units: "lb" });
    const text = [v.name, v.tip ?? "", v.storage ?? "", ...v.steps.map((s) => s.text), ...v.ingredients.map((i) => `${i.item} ${i.qty}`)].join("\n");
    expect(text, m.id).not.toMatch(/[{}<>]|undefined|NaN/);
    expect(v.steps.length, m.id).toBeGreaterThan(0);
  }
  // French really is French, English really is English.
  expect(m.stepsFr!.join(" "), m.id).not.toBe(m.steps.join(" "));
}

describe("generated recipes", () => {
  it("have a French and an English name, ingredients, steps, tip and storage", () => {
    for (const m of sample) { checkBilingual(m); expect(m.storage && m.storageFr, m.id).toBeTruthy(); }
  });

  it("say in the steps exactly the grams the ingredient list asks for", () => {
    for (const m of sample) {
      for (const [ings, steps] of [[m.ingredients, m.steps], [m.ingredientsFr!, m.stepsFr!]] as const) {
        const said = steps.join(" ");
        for (const ing of ings) {
          // Cooking oil is the sum of the teaspoons the steps call for, not one amount.
          if (/cooking oil|huile de cuisson/i.test(ing.item)) continue;
          // The ingredient's weight token ({g:180}, {ml:250}) must appear in a step.
          const tok = ing.qty.match(/\{(?:g|ml):[\d.]+\}/g);
          expect(tok, `${m.id} ${ing.item}`).toBeTruthy();
          expect(tok!.some((t) => said.includes(t)), `${m.id}: ${ing.item} ${ing.qty} not in steps`).toBe(true);
        }
        for (const t of said.match(TOKEN) ?? []) expect(t, m.id).toMatch(/^\{(g|ml|tsp|tbsp|n):\d/);
      }
    }
  });

  it("scale the grams inside the steps with the portion", () => {
    const m = getMeal("g:tray:chicken-breast:sweet-potato:broccoli:chimichurri")!;
    const en = stepsFor(m, { lang: "en", scale: 1.5, units: "kg" }).map((s) => s.text).join(" ");
    expect(en).toContain("270 g chicken breast");
    expect(en).toContain("375 g sweet potato");
    const fr = stepsFor(m, { lang: "fr", scale: 1.5, units: "kg" }).map((s) => s.text).join(" ");
    expect(fr).toContain("270 g de poitrine de poulet");
    expect(ingredientsFor(m, "fr", 1.5).find((i) => i.item === "Patate douce")!.qty).toBe("375 g");
  });

  it("plan the cooking so everything is ready together, with a timer on each timed step", () => {
    const m = getMeal("g:tray:chicken-breast:sweet-potato:broccoli:chimichurri")!;
    const s = stepsFor(m, { lang: "en", units: "kg" });
    expect(s[0].text).toBe("Preheat the oven to 220 °C (425 °F) with a rack in the middle, and line a large sheet pan with parchment paper.");
    expect(s.some((x) => x.text.startsWith("Prep: pat 180 g chicken breast dry"))).toBe(true);
    const timed = s.filter((x) => x.sec);
    // Sweet potato 25 min goes in first; the chicken at minute 5, the broccoli at minute 10: all done at 25.
    expect(timed.map((x) => x.text.slice(0, 10))).toEqual(["Minute 0 —", "Minute 5 —", "Minute 10 "]);
    expect(timed.reduce((a, x) => a + x.sec!, 0)).toBe(25 * 60);
    expect(s.map((x) => x.text).join(" ")).toContain("74 °C (165 °F)");
    const lb = stepsFor(m, { lang: "fr", units: "lb" });
    expect(lb[0].text).toContain("425 °F (220 °C)");
  });

  it("have grammatical French names", () => {
    expect(getMeal("g:tray:chicken-breast:sweet-potato:broccoli:chimichurri")!.nameFr).toBe("Plaque de poulet citron-fines herbes avec patate douce, brocoli et chimichurri");
    expect(getMeal("g:curry:chicken-breast:spinach:white-rice")!.nameFr).toBe("Cari de poulet et épinards à la noix de coco avec riz blanc");
    expect(mealTitle(getMeal("g:plate:salmon:quinoa:broccoli:pesto")!, "fr")).toEqual(["Saumon rôti", "avec quinoa, brocoli et pesto"]);
  });
});

describe("curated recipes", () => {
  it("are all bilingual", () => {
    for (const m of MEALS) checkBilingual(m);
  });
});

describe("search", () => {
  it("finds recipes in French and in English, accents or not", () => {
    const fr = searchRecipes({ q: "poulet patate douce", limit: 5 });
    const en = searchRecipes({ q: "chicken sweet potato", limit: 5 });
    expect(fr.total).toBeGreaterThan(0);
    expect(fr.total).toBe(en.total);
    expect(searchRecipes({ q: "crevettes", limit: 1 }).total).toBe(searchRecipes({ q: "shrimp", limit: 1 }).total);
    expect(searchRecipes({ q: "bleuets", limit: 1 }).total).toBeGreaterThan(0);
    expect(searchRecipes({ q: "pates", limit: 1 }).total).toBeGreaterThan(0);
  });
});
