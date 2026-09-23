import type { AvoidFood, DayPlanMeal, Meal, MealSlot, NutritionDay, Profile, Session } from "../types";
import { addDays } from "../db";
import { fitScore, getMeal, sampleIds, searchRecipes } from "./recipes";
import { MEALS as CURATED } from "../data/meals";
import type { Diet } from "./ingredients";
import { explainTargets, type DayType as SciDayType } from "./science";

/* ─────────────────────────────────────────────────────────────
   NUTRITION ENGINE v3
   1. Targets: see ./science.ts — every number there comes with the
      reason for it, and the tests hold it to coaching practice.
   2. A day of meals from the whole catalogue, built slot by slot
      against what is LEFT of all four targets (energy, protein,
      carbs, fat), then portions tuned together so the day lands
      on target; free sugar held under its ceiling.
   3. Timed like a coach would: a snack when the day is long, a
      shake when protein would not fit in three meals, pre- and
      post-workout fuel that merges with a meal instead of piling
      a second plate on top of it.
   4. Groceries for N days. 5. Nudges tied to the session.
   ───────────────────────────────────────────────────────────── */

export type DayType = NutritionDay["dayType"];

/** The day's targets. The reasoning behind each lives in ./science.ts. */
export function dailyTargets(p: Profile, dayType: DayType) {
  const t = explainTargets(p, dayType as SciDayType);
  return { kcal: t.kcal, protein: t.protein, carbs: t.carbs, fat: t.fat, sugarMax: t.sugarMax, fiberMin: t.fiberMin };
}

const SLOTS_BY_MEALS: Record<3 | 4 | 5, MealSlot[]> = {
  3: ["breakfast", "lunch", "dinner"],
  4: ["breakfast", "lunch", "snack", "dinner"],
  5: ["breakfast", "snack", "lunch", "snack", "dinner"],
};
const SHARE: Record<MealSlot, number> = { breakfast: 0.27, lunch: 0.32, dinner: 0.33, snack: 0.1, pre: 0.1, post: 0.12 };


/** Diets the recipe catalogue tags directly. Halal and keto are enforced by
 *  `mealFits` instead: one by ingredient, the other by macros. */
export const dietsOf = (p: Profile): Diet[] => p.dietary.filter((d): d is Diet => d !== "halal" && d !== "keto");

/* Words that give a food away in an ingredient line. Matched on whole words,
   so "egg" does not catch "eggplant" and "ham" does not catch "hummus". */
const AVOID_WORDS: Record<AvoidFood, string[]> = {
  nuts: ["almond", "almonds", "walnut", "walnuts", "cashew", "cashews", "pecan", "pecans", "pistachio", "pistachios", "hazelnut", "hazelnuts", "nut", "nuts"],
  peanuts: ["peanut", "peanuts"],
  shellfish: ["shrimp", "prawn", "prawns", "crab", "lobster", "mussel", "mussels", "scallop", "scallops", "clam", "clams", "oyster", "oysters"],
  fish: ["fish", "salmon", "tuna", "cod", "trout", "sardine", "sardines", "mackerel", "anchovy", "tilapia", "haddock"],
  eggs: ["egg", "eggs"],
  dairy: ["milk", "yogurt", "yoghurt", "skyr", "cheese", "feta", "parmesan", "halloumi", "paneer", "butter", "cream", "whey", "ricotta", "mozzarella"],
  soy: ["soy", "tofu", "tempeh", "edamame", "miso"],
  pork: ["pork", "bacon", "ham", "prosciutto", "chorizo", "pancetta", "salami"],
  red_meat: ["beef", "steak", "sirloin", "lamb", "veal", "bison", "pork"],
};
const words = (s: string) => s.toLowerCase().match(/[a-zà-ÿ]+/g) ?? [];

/** Foods the profile never wants served: its own list, plus pork for halal. */
export function avoidedFoods(p: Profile): AvoidFood[] {
  const out = new Set(p.avoidFoods ?? []);
  if (p.dietary.includes("halal")) out.add("pork");
  return [...out];
}

/** Everything about a meal except the tagged diets: avoided foods and keto. */
export function mealFits(m: Meal, p: Profile): boolean {
  const avoid = avoidedFoods(p);
  if (avoid.length) {
    const banned = new Set(avoid.flatMap((a) => AVOID_WORDS[a]));
    // "Oat milk" and "peanut butter" are not dairy: the plant word wins.
    const plant = /\b(oat|almond|soy|coconut|rice|peanut|nut)\s+(milk|butter|yogurt|cream)\b/i;
    for (const ing of m.ingredients) {
      const text = avoid.includes("dairy") ? ing.item.replace(plant, (x) => x.split(/\s+/)[0]) : ing.item;
      if (words(text).some((w) => banned.has(w))) return false;
    }
  }
  if (p.dietary.includes("keto") && (m.carbs * 4) / Math.max(1, m.kcal) > 0.12) return false;
  return true;
}

function timeAdd(hhmm: string, minutes: number) {
  const [h, m] = hhmm.split(":").map(Number);
  const t = ((h * 60 + m + minutes) % 1440 + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

/* Deterministic PRNG so a given day always builds the same menu. */
function rng(seed: number) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

/** Candidate pool for a slot: a random sample of the catalog (fast) + all curated, filtered by diet, minus recent meals. */
function candidates(slot: MealSlot, p: Profile, avoid: Set<string>, rand: () => number): Meal[] {
  const diets = dietsOf(p);
  const ok = (m: Meal) => !avoid.has(m.id) && dietOk(m, diets) && mealFits(m, p);
  const out: Meal[] = [];
  for (const m of CURATED) if (m.slot.includes(slot) && ok(m)) out.push(m);
  // Keto and long avoid lists reject most of a sample, so draw more.
  // Keto, plant-based and long avoid lists reject or thin out most of a sample: draw more.
  const plant = p.dietary.includes("vegetarian") || p.dietary.includes("vegan");
  const n = p.dietary.includes("keto") ? 400 : avoidedFoods(p).length || plant ? 120 : 40;
  for (const id of sampleIds(slot, n, rand)) {
    const m = getMeal(id);
    if (m && ok(m)) out.push(m);
  }
  return out;
}
function dietOk(m: Meal, diets: Diet[]) {
  return diets.every((d) => m.tags.includes(d) || (d === "vegetarian" && m.tags.includes("vegan")) || (d === "pescatarian" && (m.tags.includes("vegetarian") || m.tags.includes("vegan"))));
}

const mins = (hhmm: string) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };

type Plan = { slot: MealSlot; time: string; note?: string };

/**
 * Which meals, at what time. Coaches spread protein over four or more
 * feedings, fuel before a session and refuel after it — without two plates
 * fifteen minutes apart. So:
 *  - a snack is added when protein per meal would pass ~50 g (a shake fits);
 *  - on a training day, pre sits 90 min before, post 30 min after the end;
 *  - a meal within 75 min before the session IS the pre-workout meal, a meal
 *    within 90 min after it IS the recovery meal: no extra plate;
 *  - a snack too close to pre or post is dropped, its share passed on.
 */
export function mealPlan(p: Profile, train: boolean, minutes: number, protein: number): Plan[] {
  const base = [...SLOTS_BY_MEALS[p.mealsPerDay]];
  if (base.length === 3 && protein / 3 > 50) base.splice(2, 0, "snack");
  const wake = p.wakeTime || "07:00";
  const firstSnack = mins(wake) < 6 * 60 + 30 ? "10:00" : "15:30";
  const times: Record<MealSlot, string> = { breakfast: timeAdd(wake, 30), lunch: "12:30", dinner: "19:00", snack: firstSnack, pre: "", post: "" };
  const plan: Plan[] = [];
  let snacks = 0;
  for (const slot of base) {
    const t = slot === "snack" ? (snacks++ === 0 ? times.snack : "20:45") : times[slot];
    plan.push({ slot, time: t });
  }
  if (train) {
    const start = mins(p.trainTime || "18:00"), end = start + minutes;
    const before = plan.filter((x) => x.slot !== "snack" && start - mins(x.time) >= 0 && start - mins(x.time) <= 75);
    const after = plan.filter((x) => x.slot !== "snack" && mins(x.time) - end >= -10 && mins(x.time) - end <= 90);
    if (before.length) before[before.length - 1].note = "Pre-workout";
    else plan.push({ slot: "pre", time: timeAdd(p.trainTime || "18:00", -90) });
    if (after.length) after[0].note = "Recovery meal";
    else plan.push({ slot: "post", time: timeAdd(p.trainTime || "18:00", minutes + 30) });
  }
  // A snack within 90 min of any other feeding is one feeding too many.
  const kept = plan.filter((x) => x.slot !== "snack" || !plan.some((y) => y !== x && Math.abs(mins(y.time) - mins(x.time)) < 90));
  return kept.sort((a, b) => a.time.localeCompare(b.time));
}

type Macro = { kcal: number; protein: number; carbs: number; fat: number; sugar: number };
const macrosOf = (m: Meal, k: number): Macro => ({ kcal: m.kcal * k, protein: m.protein * k, carbs: m.carbs * k, fat: m.fat * k, sugar: (m.sugar ?? 0) * k });
const add = (a: Macro, b: Macro): Macro => ({ kcal: a.kcal + b.kcal, protein: a.protein + b.protein, carbs: a.carbs + b.carbs, fat: a.fat + b.fat, sugar: a.sugar + b.sugar });
const ZERO: Macro = { kcal: 0, protein: 0, carbs: 0, fat: 0, sugar: 0 };
const SCALES = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
/** Big eaters (a 140 kg athlete on 4,000+ kcal) get bigger plates, not more plates. */
const scalesFor = (kcal: number) => (kcal > 3400 ? [...SCALES, 2.25, 2.5] : SCALES);

/** How far a day (or part of one) is from its targets: relative errors,
 *  protein short-fall weighted most, sugar only when over its ceiling. */
function miss(got: Macro, t: Macro & { sugarMax: number }, proteinWeight = 3) {
  const rel = (g: number, w: number) => Math.abs(g - w) / Math.max(1, w);
  return rel(got.kcal, t.kcal) * 2 + Math.max(0, (t.protein - got.protein) / t.protein) * proteinWeight + Math.max(0, (got.protein - t.protein * (t.kcal > 3400 ? 1.35 : 1.2)) / t.protein)
    + rel(got.carbs, t.carbs) * 0.7 + rel(got.fat, t.fat) * 0.7 + Math.max(0, (got.sugar - t.sugarMax) / Math.max(1, t.sugarMax)) * 3;
}

export function buildNutritionDay(p: Profile, date: string, session: Session | null, yesterday?: NutritionDay, recent: string[] = []): NutritionDay {
  const dayType: DayType = !session || session.kind === "rest" || session.kind === "mobility" ? "rest" : session.kind === "cardio_intervals" || (session.focus === "strength" && session.minutes >= 60) ? "hard" : "train";
  const targets = dailyTargets(p, dayType);
  const SC = scalesFor(targets.kcal);
  const train = !!session && dayType !== "rest";
  const plan = mealPlan(p, train, session?.minutes ?? p.sessionMinutes, targets.protein);
  const avoid = new Set<string>([...(yesterday?.meals.map((m) => m.mealId) ?? []), ...recent]);
  const rand = rng(date.split("-").reduce((a, b) => a * 31 + Number(b), 7) + p.name.length);
  const shareOf = (x: Plan) => SHARE[x.slot] + (x.note === "Recovery meal" ? 0.04 : 0);
  const totalShare = plan.reduce((a, x) => a + shareOf(x), 0);

  // 1. Slot by slot, against what is left of every target.
  const chosen: { plan: Plan; meal: Meal; scale: number }[] = [];
  let got: Macro = ZERO;
  let shareLeft = totalShare;
  for (const x of plan) {
    const part = shareOf(x) / shareLeft;
    const want = {
      kcal: (targets.kcal - got.kcal) * part, protein: (targets.protein - got.protein) * part,
      carbs: (targets.carbs - got.carbs) * part, fat: (targets.fat - got.fat) * part, sugar: 0,
      sugarMax: (targets.sugarMax - got.sugar) * part * 1.1,
    };
    shareLeft -= shareOf(x);
    const pool = candidates(x.slot, p, avoid, rand);
    if (!pool.length) continue;
    const ranked = pool.map((m) => {
      let best = { k: 1, e: Infinity };
      for (const k of SC) { const e = miss(macrosOf(m, k), want); if (e < best.e) best = { k, e }; }
      // A little goal flavour on top: protein density in a deficit, carbs for endurance.
      return { m, k: best.k, e: best.e + fitScore(m, { kcal: want.kcal, protein: want.protein }, p.goal) * 0.15 };
    }).sort((a, b) => a.e - b.e);
    const top = ranked.slice(0, Math.min(5, ranked.length));
    const pick = top[Math.floor(rand() * top.length)];
    avoid.add(pick.m.id);
    chosen.push({ plan: x, meal: pick.m, scale: pick.k });
    got = add(got, macrosOf(pick.m, pick.k));
  }

  // 2. Tune the portions together: a few passes of coordinate descent over
  //    quarter-portion steps, so the whole day lands, not each plate alone.
  const full = { ...targets, sugar: 0 };
  const total = () => chosen.reduce((acc, c) => add(acc, macrosOf(c.meal, c.scale)), ZERO);
  const tune = (pw = 3) => {
    for (let pass = 0; pass < 4; pass++) {
      let improved = false;
      for (const c of chosen) {
        const was = c.scale;
        let best = { k: was, e: miss(total(), full, pw) };
        for (const k of SC) { c.scale = k; const e = miss(total(), full, pw); if (e < best.e - 1e-9) best = { k, e }; }
        c.scale = best.k;
        if (best.k !== was) improved = true;
      }
      if (!improved) break;
    }
  };
  tune();

  // 3. Still short on protein or energy (a vegetarian cut, a big keto build)?
  //    Do what a coach does: add a snack (a shake, a pudding, edamame) at a
  //    time with 90 min clear either side, then tune again. At most two.
  const FREE = ["10:00", "15:30", "21:00", "16:30", "10:30", "20:30"];
  // Try a top-up the way a coach would: add the snack, re-balance every
  // portion around it, and keep it only if the whole day is closer to target.
  for (let extra = 0; extra < 4; extra++) {
    const now = total();
    if (now.protein >= targets.protein * 0.93 && now.kcal >= targets.kcal * 0.93) break;
    const time = FREE.find((t) => chosen.every((c) => Math.abs(mins(c.plan.time) - mins(t)) >= 90));
    if (!time) break;
    // Short on protein: only protein-dense snacks (a third of the energy or more) qualify.
    const needProtein = now.protein < targets.protein * 0.93;
    const pool = candidates("snack", p, avoid, rand)
      .filter((m) => !needProtein || (m.protein * 4) / Math.max(1, m.kcal) >= 0.33)
      .sort((a, b) => needProtein ? b.protein / b.kcal - a.protein / a.kcal : b.kcal - a.kcal)
      .slice(0, 4);
    const before = { e: miss(now, full), scales: chosen.map((c) => c.scale) };
    let kept: { m: Meal; e: number; scales: number[] } | null = null;
    for (const m of pool) {
      chosen.push({ plan: { slot: "snack", time, note: needProtein ? "Protein top-up" : "Energy top-up" }, meal: m, scale: 1 });
      tune();
      const e = miss(total(), full);
      if (e < before.e - 0.02 && (!kept || e < kept.e)) kept = { m, e, scales: chosen.map((c) => c.scale) };
      chosen.pop();
      chosen.forEach((c, i) => (c.scale = before.scales[i]));
    }
    if (!kept) break;
    avoid.add(kept.m.id);
    chosen.push({ plan: { slot: "snack", time, note: needProtein ? "Protein top-up" : "Energy top-up" }, meal: kept.m, scale: 1 });
    chosen.forEach((c, i) => (c.scale = kept!.scales[i]));
  }

  const meals: DayPlanMeal[] = chosen.map((c) => ({ slot: c.plan.slot, time: c.plan.time, mealId: c.meal.id, scale: c.scale, ...(c.plan.note ? { note: c.plan.note } : {}) }));
  meals.sort((a, b) => a.time.localeCompare(b.time));
  return { id: date, date, dayType, targets: { kcal: targets.kcal, protein: targets.protein, carbs: targets.carbs, fat: targets.fat }, meals, waterMl: Math.round(p.weightKg * 35 + (train ? 500 : 0)) };
}

/** After a swap, re-tune every portion so the day still adds up. */
export function retuneDay(p: Profile, day: NutritionDay): NutritionDay {
  const t = dailyTargets(p, day.dayType);
  const SC = scalesFor(t.kcal);
  const full = { ...t, sugar: 0 };
  const meals = day.meals.map((m) => ({ ...m }));
  const total = () => meals.reduce((acc, m) => { const r = getMeal(m.mealId); return r ? add(acc, macrosOf(r, m.scale)) : acc; }, ZERO);
  for (let pass = 0; pass < 4; pass++) {
    let improved = false;
    for (const m of meals) {
      if (m.done) continue;
      const was = m.scale;
      let best = { k: was, e: miss(total(), full) };
      for (const k of SC) { m.scale = k; const e = miss(total(), full); if (e < best.e - 1e-9) best = { k, e }; }
      m.scale = best.k;
      if (best.k !== was) improved = true;
    }
    if (!improved) break;
  }
  return { ...day, meals };
}

function sumMeals(meals: NutritionDay["meals"]) {
  return meals.reduce((acc, m) => {
    const meal = getMeal(m.mealId); if (!meal) return acc;
    acc.kcal += meal.kcal * m.scale; acc.protein += meal.protein * m.scale; acc.carbs += meal.carbs * m.scale; acc.fat += meal.fat * m.scale; acc.sugar += (meal.sugar ?? 0) * m.scale; acc.fiber += (meal.fiber ?? 0) * m.scale;
    return acc;
  }, { kcal: 0, protein: 0, carbs: 0, fat: 0, sugar: 0, fiber: 0 });
}

/** What the whole planned day adds up to — used to check the plan hits target. */
export function dayTotals(day: NutritionDay) {
  return sumMeals(day.meals);
}

/**
 * What has actually been eaten so far: ticked meals only.
 *
 * Progress bars have to start empty and fill as the day is logged. Summing the
 * whole plan made them full before the first bite, so ticking a meal changed
 * nothing and the card read as though the day were already done.
 */
export function eatenTotals(day: NutritionDay) {
  return sumMeals(day.meals.filter((m) => m.done));
}

export function groceryList(days: NutritionDay[]) {
  const map = new Map<string, { item: string; qty: string[] }>();
  for (const d of days) for (const m of d.meals) {
    const meal = getMeal(m.mealId); if (!meal) continue;
    for (const ing of meal.ingredients) {
      const key = ing.item.toLowerCase();
      const cur = map.get(key) ?? { item: ing.item, qty: [] };
      if (ing.qty) cur.qty.push(m.scale === 1 ? ing.qty : `${ing.qty} ×${m.scale}`);
      map.set(key, cur);
    }
  }
  return [...map.values()].sort((a, b) => a.item.localeCompare(b.item));
}

export function nudgesFor(day: NutritionDay, session: Session | null, tomorrow?: NutritionDay) {
  const out: { time: string; title: string; body: string }[] = [];
  const pre = day.meals.find((m) => m.slot === "pre");
  const post = day.meals.find((m) => m.slot === "post");
  if (pre && session) out.push({ time: pre.time, title: `${session.title} in 90 min`, body: `Eat now: ${getMeal(pre.mealId)?.name}. Carbs before, protein after.` });
  if (post && session) out.push({ time: post.time, title: "Session done — protein window", body: `${getMeal(post.mealId)?.name}: ~30 g protein within the hour.` });
  const lunch = day.meals.find((m) => m.slot === "lunch");
  if (lunch) out.push({ time: lunch.time, title: "Lunch", body: `${getMeal(lunch.mealId)?.name} · ${Math.round((getMeal(lunch.mealId)?.kcal ?? 0) * lunch.scale)} kcal` });
  if (tomorrow && tomorrow.dayType !== day.dayType) out.push({ time: "20:30", title: `Tomorrow: ${tomorrow.dayType} day`, body: `Calories ${tomorrow.targets.kcal > day.targets.kcal ? "up" : "down"} to ${tomorrow.targets.kcal}. Groceries updated.` });
  return out.sort((a, b) => a.time.localeCompare(b.time));
}

/** Best swaps for a planned slot: top goal-fit recipes not already in the day. */
export function swapOptions(p: Profile, day: NutritionDay, planned: DayPlanMeal, n = 12): Meal[] {
  const targetKcal = day.targets.kcal * (SHARE[planned.slot] / day.meals.reduce((a, m) => a + SHARE[m.slot], 0));
  const targetProtein = day.targets.protein * (SHARE[planned.slot] / day.meals.reduce((a, m) => a + SHARE[m.slot], 0));
  const inDay = new Set(day.meals.map((m) => m.mealId));
  const rand = rng(Date.now() % 100000);
  const pool = candidates(planned.slot, p, inDay, rand);
  return pool.map((m) => ({ m, s: fitScore(m, { kcal: targetKcal, protein: targetProtein }, p.goal) })).sort((a, b) => a.s - b.s).slice(0, n).map((x) => x.m);
}

export const nextDate = (iso: string) => addDays(iso, 1);
export { searchRecipes };
