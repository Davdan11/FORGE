import type { DayPlanMeal, Meal, MealSlot, NutritionDay, Profile, Session } from "../types";
import { addDays } from "../db";
import { fitScore, getMeal, sampleIds, searchRecipes } from "./recipes";
import { MEALS as CURATED } from "../data/meals";
import type { Diet } from "./ingredients";

/* ─────────────────────────────────────────────────────────────
   NUTRITION ENGINE v2
   1. Targets from body + goal + day type (Mifflin-St Jeor × activity),
      including a sugar ceiling and a fibre floor.
   2. A day of meals chosen from the whole recipe catalog (thousands),
      scored for goal fit per slot, timed around the session, scaled
      to targets, never repeating what you ate the last three days.
   3. Groceries for N days. 4. Nudges tied to the session.
   ───────────────────────────────────────────────────────────── */

export type DayType = NutritionDay["dayType"];

export function dailyTargets(p: Profile, dayType: DayType) {
  const bmr = p.sex === "female" ? 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age - 161 : 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age + 5;
  const activity = { 2: 1.35, 3: 1.45, 4: 1.55, 5: 1.65, 6: 1.75 }[p.daysPerWeek];
  let tdee = bmr * activity;
  tdee *= dayType === "hard" ? 1.08 : dayType === "train" ? 1.0 : 0.9;
  const goalAdj = { cut: -0.18, recomp: -0.05, strength: 0.05, build: 0.12, endurance: 0.05, perform: 0.05 }[p.goal];
  const kcal = Math.round(tdee * (1 + goalAdj) / 10) * 10;
  const proteinPerKg = p.goal === "cut" ? 2.2 : p.goal === "build" || p.goal === "strength" ? 1.9 : 1.7;
  const protein = Math.round(p.weightKg * proteinPerKg);
  const fat = Math.round(Math.max(p.weightKg * 0.7, kcal * 0.25 / 9));
  const carbs = Math.max(80, Math.round((kcal - protein * 4 - fat * 9) / 4));
  const sugarMax = Math.round(kcal * (p.goal === "cut" ? 0.06 : 0.09) / 4);   // WHO-style free-sugar ceiling
  const fiberMin = Math.round(Math.max(25, kcal / 1000 * 14));
  return { kcal, protein, carbs, fat, sugarMax, fiberMin };
}

const SLOTS_BY_MEALS: Record<3 | 4 | 5, MealSlot[]> = {
  3: ["breakfast", "lunch", "dinner"],
  4: ["breakfast", "lunch", "snack", "dinner"],
  5: ["breakfast", "snack", "lunch", "snack", "dinner"],
};
const SHARE: Record<MealSlot, number> = { breakfast: 0.27, lunch: 0.32, dinner: 0.33, snack: 0.1, pre: 0.1, post: 0.12 };

export const dietsOf = (p: Profile): Diet[] => p.dietary.filter((d): d is Diet => d !== "halal");

function timeAdd(hhmm: string, minutes: number) {
  const [h, m] = hhmm.split(":").map(Number);
  const t = ((h * 60 + m + minutes) % 1440 + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

/* Deterministic PRNG so a given day always builds the same menu. */
function rng(seed: number) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

/** Candidate pool for a slot: a random sample of the catalog (fast) + all curated, filtered by diet, minus recent meals. */
function candidates(slot: MealSlot, diets: Diet[], avoid: Set<string>, rand: () => number): Meal[] {
  const out: Meal[] = [];
  for (const m of CURATED) if (m.slot.includes(slot) && !avoid.has(m.id) && dietOk(m, diets)) out.push(m);
  for (const id of sampleIds(slot, 40, rand)) {
    const m = getMeal(id);
    if (m && !avoid.has(m.id) && dietOk(m, diets)) out.push(m);
  }
  return out;
}
function dietOk(m: Meal, diets: Diet[]) {
  return diets.every((d) => m.tags.includes(d) || (d === "vegetarian" && m.tags.includes("vegan")) || (d === "pescatarian" && (m.tags.includes("vegetarian") || m.tags.includes("vegan"))));
}

export function buildNutritionDay(p: Profile, date: string, session: Session | null, yesterday?: NutritionDay, recent: string[] = []): NutritionDay {
  const dayType: DayType = !session || session.kind === "rest" || session.kind === "mobility" ? "rest" : session.kind === "cardio_intervals" || (session.focus === "strength" && session.minutes >= 60) ? "hard" : "train";
  const targets = dailyTargets(p, dayType);
  const slots = [...SLOTS_BY_MEALS[p.mealsPerDay]];
  const avoid = new Set<string>([...(yesterday?.meals.map((m) => m.mealId) ?? []), ...recent]);
  const rand = rng(date.split("-").reduce((a, b) => a * 31 + Number(b), 7) + p.name.length);
  const diets = dietsOf(p);
  const train = session && dayType !== "rest";
  if (train) slots.push("pre", "post");

  const wake = p.wakeTime || "07:00", trainAt = p.trainTime || "18:00";
  const times: Record<MealSlot, string> = { breakfast: timeAdd(wake, 30), lunch: "12:30", dinner: "19:30", snack: "16:00", pre: timeAdd(trainAt, -90), post: timeAdd(trainAt, 75) };
  const totalShare = slots.reduce((a, s) => a + SHARE[s], 0);
  const meals: DayPlanMeal[] = [];

  for (const slot of slots) {
    const targetKcal = targets.kcal * (SHARE[slot] / totalShare);
    const targetProtein = targets.protein * (SHARE[slot] / totalShare);
    const pool = candidates(slot, diets, avoid, rand);
    if (!pool.length) continue;
    // Score everything (goal fit + a sugar budget for the slot), then pick among the best few for variety.
    const sugarBudget = targets.sugarMax * (SHARE[slot] / totalShare) * 1.15;
    const ranked = pool.map((m) => {
      const scale = Math.max(0.6, Math.min(1.8, targetKcal / Math.max(1, m.kcal)));
      const over = Math.max(0, m.sugar * scale - sugarBudget) / Math.max(1, sugarBudget);
      return { m, s: fitScore(m, { kcal: targetKcal, protein: targetProtein }, p.goal) + over * 1.6 };
    }).sort((a, b) => a.s - b.s);
    const top = ranked.slice(0, Math.min(6, ranked.length));
    const chosen = top[Math.floor(rand() * top.length)].m;
    avoid.add(chosen.id);
    const scale = Math.max(0.6, Math.min(1.8, Math.round((targetKcal / Math.max(1, chosen.kcal)) * 4) / 4));
    meals.push({ slot, time: times[slot], mealId: chosen.id, scale });
  }
  meals.sort((a, b) => a.time.localeCompare(b.time));
  return { id: date, date, dayType, targets: { kcal: targets.kcal, protein: targets.protein, carbs: targets.carbs, fat: targets.fat }, meals, waterMl: Math.round(p.weightKg * 35 + (train ? 500 : 0)) };
}

export function dayTotals(day: NutritionDay) {
  return day.meals.reduce((acc, m) => {
    const meal = getMeal(m.mealId); if (!meal) return acc;
    acc.kcal += meal.kcal * m.scale; acc.protein += meal.protein * m.scale; acc.carbs += meal.carbs * m.scale; acc.fat += meal.fat * m.scale; acc.sugar += (meal.sugar ?? 0) * m.scale; acc.fiber += (meal.fiber ?? 0) * m.scale;
    return acc;
  }, { kcal: 0, protein: 0, carbs: 0, fat: 0, sugar: 0, fiber: 0 });
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
  const pool = candidates(planned.slot, dietsOf(p), inDay, rand);
  return pool.map((m) => ({ m, s: fitScore(m, { kcal: targetKcal, protein: targetProtein }, p.goal) })).sort((a, b) => a.s - b.s).slice(0, n).map((x) => x.m);
}

export const nextDate = (iso: string) => addDays(iso, 1);
export { searchRecipes };
