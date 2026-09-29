import type { Meal, UnitPrefs, Units } from "../types";
import type { Lang } from "../i18n";
import { localizeCooking, type WeightLike } from "../units";

/* ─────────────────────────────────────────────────────────────
   COOKBOOK RENDERING
   Recipes are stored once, in English (the source, and the id) with
   a French twin in the *Fr fields. Quantities are tokens so a ×1.5
   portion reads "375 g" in the step, not "250 g ×1.5":

     {g:250}            → 250 g
     {ml:250}           → 250 ml
     {tsp:0.5}          → ½ tsp · ½ c. à thé
     {tbsp:1}           → 1 tbsp · 1 c. à soupe
     {n:3|egg|eggs}     → 3 eggs          ({n:1} alone → 1)

   Temperatures are written in °C; localizeCooking shows both scales,
   Fahrenheit first for people who weigh in pounds.
   ───────────────────────────────────────────────────────────── */

const TOKEN = /\{(g|ml|tsp|tbsp|n):(\d+(?:\.\d+)?)(?:\|([^|}]*)\|([^}]*))?\}/g;

const FRAC: Record<number, string> = { 0.25: "¼", 0.5: "½", 0.75: "¾" };
/** 1.5 → "1½", 0.25 → "¼", 2 → "2". Values are rounded to the nearest quarter first. */
export function fraction(v: number): string {
  const q = Math.round(v * 4) / 4;
  const whole = Math.floor(q), part = +(q - whole).toFixed(2);
  if (!part) return String(whole);
  return `${whole || ""}${FRAC[part]}`;
}

const roundG = (v: number) => (v < 20 ? Math.max(1, Math.round(v)) : Math.round(v / 5) * 5);
const roundMl = (v: number) => (v < 50 ? Math.max(5, Math.round(v / 5) * 5) : Math.round(v / 10) * 10);

/** Resolve quantity tokens at a portion scale, in a language. Text without tokens passes through. */
export function renderQty(text: string, scale = 1, lang: Lang = "en"): string {
  if (!text.includes("{")) return text;
  return text.replace(TOKEN, (_m, kind: string, raw: string, one?: string, many?: string) => {
    const v = Number(raw) * scale;
    switch (kind) {
      case "g": return `${roundG(v)} g`;
      case "ml": return `${roundMl(v)} ml`;
      case "tsp": case "tbsp": {
        // Past 3 tsp, say it in tablespoons.
        const tbsp = kind === "tbsp" || v >= 3;
        const n = kind === "tsp" && tbsp ? v / 3 : v;
        const q = Math.max(0.25, Math.round(n * 4) / 4);
        return `${fraction(q)} ${tbsp ? (lang === "fr" ? "c. à soupe" : "tbsp") : (lang === "fr" ? "c. à thé" : "tsp")}`;
      }
      default: {
        // Counts: halves below 2 (½ avocado), whole numbers above (3 eggs, not 4½).
        const q = v < 2 ? Math.max(0.5, Math.round(v * 2) / 2) : Math.round(v);
        const word = one == null ? "" : ` ${q > 1 ? many : one}`;
        return `${fraction(q)}${word}`;
      }
    }
  });
}

/** Seconds of the first "N min" (or "N s") in a step — the cook-mode timer. Works in both languages. */
export function minutesIn(s: string): number | null {
  const m = s.match(/(\d+(?:[.,]\d+)?)\s*min\b/);
  if (m) return Math.round(Number(m[1].replace(",", ".")) * 60);
  const sec = s.match(/(\d+)\s*s\b/);
  return sec ? Number(sec[1]) : null;
}

const pickArr = <T,>(fr: T[] | undefined, en: T[], lang: Lang) => (lang === "fr" && fr && fr.length === en.length ? fr : en);

/** The recipe's name in a language. */
export function mealName(m: Meal, lang: Lang): string {
  return lang === "fr" && m.nameFr ? m.nameFr : m.name;
}

/** Name split for cards: the dish, then what comes with it ("with …" / "avec …", connector kept). */
export function mealTitle(m: Meal, lang: Lang): [head: string, tail: string] {
  const name = mealName(m, lang);
  const sep = lang === "fr" && m.nameFr ? " avec " : " with ";
  const i = name.indexOf(sep);
  return i > 0 ? [name.slice(0, i), name.slice(i + 1)] : [name, ""];
}

export function mealCuisine(m: Meal, lang: Lang): string | undefined {
  return lang === "fr" && m.cuisineFr ? m.cuisineFr : m.cuisine;
}

/** Ingredients in a language with quantities at the portion scale. */
export function ingredientsFor(m: Meal, lang: Lang, scale = 1): { item: string; qty: string }[] {
  return pickArr(m.ingredientsFr, m.ingredients, lang).map((i) => {
    const qty = i.qty.includes("{") ? renderQty(i.qty, scale, lang) : i.qty && scale !== 1 ? `${i.qty} ×${scale}` : i.qty;
    return { item: i.item, qty };
  });
}

type U = WeightLike | Units | undefined;
const unitsOf = (u: U): WeightLike => (u == null ? "kg" : typeof u === "string" ? (u === "imperial" ? "lb" : u === "metric" ? "kg" : u) : (u as UnitPrefs));

/** Steps ready to show: language, scaled quantities, both temperature scales, and each step's timer. */
export function stepsFor(m: Meal, opts: { lang: Lang; scale?: number; units?: U }): { text: string; sec: number | null }[] {
  const { lang, scale = 1 } = opts;
  const units = unitsOf(opts.units);
  const src = pickArr(m.stepsFr, m.steps, lang);
  return src.map((s, i) => {
    const text = localizeCooking(renderQty(s, scale, lang), units, lang);
    const fixed = m.timers?.[i];
    return { text, sec: fixed === undefined ? minutesIn(text) : fixed };
  });
}

/** Everything a page shows about a recipe, in one language. */
export function localizeMeal(m: Meal, lang: Lang, opts: { scale?: number; units?: U } = {}) {
  const units = unitsOf(opts.units);
  const scale = opts.scale ?? 1;
  const tip = lang === "fr" && m.tipFr ? m.tipFr : m.tip;
  const storage = lang === "fr" && m.storageFr ? m.storageFr : m.storage;
  const [head, tail] = mealTitle(m, lang);
  return {
    name: mealName(m, lang), head, tail,
    cuisine: mealCuisine(m, lang),
    tip: tip ? localizeCooking(renderQty(tip, scale, lang), units, lang) : undefined,
    storage: storage ? localizeCooking(renderQty(storage, scale, lang), units, lang) : undefined,
    ingredients: ingredientsFor(m, lang, scale),
    steps: stepsFor(m, { lang, scale, units }),
  };
}

/** Lowercase, accents stripped: "Crème brûlée" → "creme brulee". For search in both languages. */
export const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
