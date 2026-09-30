import type { Adherence, FoodEntry, NutritionDay } from "../types";
import { INGREDIENTS } from "./ingredients";

/* ─────────────────────────────────────────────────────────────
   "J'ai mangé autre chose" — food eaten outside the plan.

   A food is found (the built-in table, Open Food Facts, the recent
   list) as a FoodItem with its numbers per 100 g; the portion eaten
   is saved on the day as a FoodEntry with the portion's own numbers,
   so a later change to the database never rewrites what was eaten.
   Pure functions here; the network lives in ./off.ts.
   ───────────────────────────────────────────────────────────── */

export interface Per100 { kcal: number; protein: number; carbs: number; fat: number; sugar?: number; fiber?: number }
export interface FoodItem {
  /** Stable key: "ing:<id>", "off:<code>", "manual:<name>". */
  key: string;
  name: string;
  brand?: string;
  per100: Per100;
  /** Grams in one serving, when known (a label's serving, an egg). */
  servingG?: number;
  /** The label's own words for the serving ("1 pot (175 g)"). */
  servingLabel?: string;
  source: "off" | "search" | "manual";
  barcode?: string;
  offCode?: string;
  image?: string;
  /** Recents only: the grams logged last time, for one-tap re-logging. */
  lastGrams?: number;
}
export type Totals = { kcal: number; protein: number; carbs: number; fat: number; sugar: number; fiber: number };

const r1 = (x: number) => Math.round(x * 10) / 10;
const num = (x: unknown): number | undefined => {
  const n = typeof x === "string" ? Number(x.replace(",", ".")) : typeof x === "number" ? x : NaN;
  return Number.isFinite(n) && n >= 0 ? n : undefined;
};

/* ── Open Food Facts ─────────────────────────────────────────── */

/** The fields asked of Open Food Facts: nothing more is downloaded. */
export const OFF_FIELDS = ["code", "product_name", "product_name_fr", "brands", "nutriments", "serving_size", "serving_quantity", "image_small_url"];

type OffProduct = {
  code?: string; product_name?: string; product_name_fr?: string; brands?: string | string[];
  nutriments?: Record<string, unknown>; serving_size?: string; serving_quantity?: number | string; image_small_url?: string;
};

/**
 * An Open Food Facts product as a FoodItem, or null when it cannot be logged
 * honestly: no name, or no energy per 100 g (a label read without kcal would
 * log a food as free). Energy in kJ only is converted (÷ 4.184).
 */
export function parseOffProduct(p: OffProduct | null | undefined, lang: "fr" | "en" = "fr"): FoodItem | null {
  if (!p) return null;
  const n = p.nutriments ?? {};
  const kj = num(n["energy-kj_100g"]) ?? (n["energy_unit"] === "kJ" || n["energy_unit"] === undefined ? num(n["energy_100g"]) : undefined);
  const kcal = num(n["energy-kcal_100g"]) ?? (kj != null ? kj / 4.184 : undefined);
  if (kcal == null) return null;
  const name = ((lang === "fr" ? p.product_name_fr || p.product_name : p.product_name || p.product_name_fr) ?? "").trim();
  if (!name) return null;
  const brands = Array.isArray(p.brands) ? p.brands.join(", ") : p.brands;
  const brand = brands?.split(",")[0]?.trim() || undefined;
  const serving = num(p.serving_quantity);
  const sugar = num(n["sugars_100g"]), fiber = num(n["fiber_100g"]);
  return {
    key: `off:${p.code ?? name}`,
    name, brand,
    per100: { kcal: r1(kcal), protein: r1(num(n["proteins_100g"]) ?? 0), carbs: r1(num(n["carbohydrates_100g"]) ?? 0), fat: r1(num(n["fat_100g"]) ?? 0), ...(sugar != null ? { sugar: r1(sugar) } : {}), ...(fiber != null ? { fiber: r1(fiber) } : {}) },
    ...(serving && serving > 0 ? { servingG: serving } : {}),
    ...(p.serving_size ? { servingLabel: p.serving_size } : {}),
    source: "off",
    ...(p.code ? { offCode: p.code, barcode: p.code } : {}),
    ...(p.image_small_url ? { image: p.image_small_url } : {}),
  };
}

/** What a portion of a food holds, from its numbers per 100 g. */
export function portion(per100: Per100, grams: number): Totals {
  const k = Math.max(0, grams) / 100;
  return {
    kcal: Math.round(per100.kcal * k), protein: r1(per100.protein * k), carbs: r1(per100.carbs * k), fat: r1(per100.fat * k),
    sugar: r1((per100.sugar ?? 0) * k), fiber: r1((per100.fiber ?? 0) * k),
  };
}

/** A logged portion, ready to save on the day. */
export function entryFrom(item: FoodItem, grams: number, time: string, fromRecent = false, id = newId()): FoodEntry {
  const p = portion(item.per100, grams);
  return {
    id, time, name: item.name, ...(item.brand ? { brand: item.brand } : {}), grams: Math.round(grams),
    kcal: p.kcal, protein: p.protein, carbs: p.carbs, fat: p.fat,
    ...(item.per100.sugar != null ? { sugar: p.sugar } : {}), ...(item.per100.fiber != null ? { fiber: p.fiber } : {}),
    source: fromRecent ? "recent" : item.source,
    ...(item.barcode ? { barcode: item.barcode } : {}), ...(item.offCode ? { offCode: item.offCode } : {}),
  };
}

export function newId(): string {
  try { if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID(); } catch {}
  return `x${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/** A barcode worth asking about: EAN-8, UPC-A, EAN-13 or GTIN-14, digits only. */
export function cleanBarcode(raw: string): string | null {
  const d = raw.replace(/\D/g, "");
  return [8, 12, 13, 14].includes(d.length) ? d : null;
}

/* ── The built-in table (offline, and first) ─────────────────── */

/** Combining accents left by NFD (U+0300 to U+036F). */
const ACCENTS = new RegExp(`[${String.fromCharCode(0x300)}-${String.fromCharCode(0x36f)}]`, "g");
const fold = (s: string) => s.toLowerCase().normalize("NFD").replace(ACCENTS, "").replace(/[’']/g, " ");

/** A table unit in the reader's words ("egg" → "œuf"). */
const UNIT_FR: Record<string, string> = { tbsp: "c. à soupe", tsp: "c. à thé", apple: "pomme", banana: "banane", orange: "orange", kiwi: "kiwi", half: "demi", cake: "galette", slice: "tranche", scoop: "mesure" };
function unitLabel(unit: string, words: readonly string[] | undefined, lang: "fr" | "en"): string {
  if (words) return lang === "fr" ? words[0] : words[2];
  return lang === "fr" ? UNIT_FR[unit] ?? unit : unit;
}

/** Common foods from the recipe table, found by French or English name, without a network. */
export function searchLocal(query: string, lang: "fr" | "en" = "fr", limit = 8): FoodItem[] {
  const q = fold(query).trim();
  if (q.length < 2) return [];
  const terms = q.split(/\s+/);
  const scored: { i: (typeof INGREDIENTS)[number]; s: number }[] = [];
  for (const i of INGREDIENTS) {
    const fr = fold(i.fr), en = fold(i.name);
    const hay = `${fr} ${en}`;
    if (!terms.every((t) => hay.includes(t))) continue;
    const main = lang === "fr" ? fr : en;
    scored.push({ i, s: main.startsWith(q) ? 0 : main.includes(q) ? 1 : 2 });
  }
  return scored.sort((a, b) => a.s - b.s || a.i.fr.length - b.i.fr.length).slice(0, limit).map(({ i }) => {
    const [kcal, protein, carbs, sugar, fat, fiber] = i.n;
    return {
      key: `ing:${i.id}`, name: lang === "fr" ? i.fr : i.name,
      per100: { kcal, protein, carbs, fat, sugar, fiber }, source: "search" as const,
      ...(i.unit && i.unit[0] !== "ml" ? { servingG: i.unit[1], servingLabel: unitLabel(i.unit[0], i.words, lang) } : {}),
    };
  });
}

/* ── Recent foods (this device) ─────────────────────────────── */

const RECENT_KEY = "forge.food.recent";
export function recentFoods(): FoodItem[] {
  try { const v = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]"); return Array.isArray(v) ? v : []; } catch { return []; }
}
export function rememberFood(item: FoodItem, max = 20) {
  try { localStorage.setItem(RECENT_KEY, JSON.stringify([item, ...recentFoods().filter((x) => x.key !== item.key)].slice(0, max))); } catch {}
}

/* ── Totals ─────────────────────────────────────────────────── */

/** What the day's off-plan food adds up to. */
export function extrasTotals(day: Pick<NutritionDay, "extras">): Totals {
  const t: Totals = { kcal: 0, protein: 0, carbs: 0, fat: 0, sugar: 0, fiber: 0 };
  for (const e of day.extras ?? []) {
    t.kcal += e.kcal; t.protein += e.protein; t.carbs += e.carbs; t.fat += e.fat; t.sugar += e.sugar ?? 0; t.fiber += e.fiber ?? 0;
  }
  return t;
}

/**
 * The adherence answer the week's own log suggests (the athlete can still change it).
 *  - "all":  90 % of the planned meals ticked (without eating >10 % over the plan on top),
 *            or the real intake within ±10 % of the plan;
 *  - "most": 60 % of the meals ticked, or intake within ±25 %;
 *  - "some": anything else.
 * Null when nothing was logged: no data is not the same as a bad week.
 */
export function suggestAdherence(w: { mealsDone: number; mealsPlanned: number; eatenKcal?: number; plannedKcal?: number }): Adherence | null {
  const ratio = w.mealsPlanned > 0 ? w.mealsDone / w.mealsPlanned : null;
  const kcal = w.eatenKcal != null && w.plannedKcal ? w.eatenKcal / w.plannedKcal : null;
  if (ratio == null && kcal == null) return null;
  if (!w.mealsDone && !w.eatenKcal) return null;
  const within = (x: number | null, tol: number) => x != null && Math.abs(x - 1) <= tol;
  if (within(kcal, 0.1) || (ratio != null && ratio >= 0.9 && (kcal == null || kcal <= 1.1))) return "all";
  if (within(kcal, 0.25) || (ratio != null && ratio >= 0.6)) return "most";
  return "some";
}
