import type { Goal, NutritionDay, Profile } from "../types";

/* ─────────────────────────────────────────────────────────────
   The numbers behind every plate, and the reason for each.

   Everything a coach would ask "why?" about lives here, as pure
   functions that return both the number and the step that made
   it — so the app can show its working, and the tests can hold it
   to what a sports nutritionist would sign off on:

   - Energy: Mifflin-St Jeor resting rate × an activity factor
     from training days and the kind of job, adjusted by day type.
   - Goal: a deficit or surplus sized by a realistic RATE of change
     (per cent of bodyweight per week), capped as a share of
     maintenance, and never below resting energy.
   - Protein on a reference weight: above a BMI of 27 the extra
     mass is mostly fat, which needs no protein, so the target is
     set on an adjusted weight instead of the scale weight.
   - Fat never below 0.8 g/kg (reference) nor 25 % of energy, never
     above 35 %; carbohydrate is the rest, with a floor.
   - Free sugar under the WHO ceiling (10 %, 6 % in a deficit);
     fibre at 14 g per 1,000 kcal.
   ───────────────────────────────────────────────────────────── */

export type DayType = NutritionDay["dayType"];

/** Energy in a kilogram of body-weight change, the classic 7,700 kcal. */
export const KCAL_PER_KG = 7700;

export function bmr(p: Pick<Profile, "sex" | "weightKg" | "heightCm" | "age">) {
  const base = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age;
  return p.sex === "female" ? base - 161 : p.sex === "male" ? base + 5 : base - 78;
}

/** Activity multiplier: training days a week, plus the job. */
export function activityFactor(p: Pick<Profile, "daysPerWeek" | "lifestyle">) {
  const training = { 2: 1.35, 3: 1.45, 4: 1.55, 5: 1.65, 6: 1.75 }[p.daysPerWeek] ?? 1.45;
  const work = { desk: 0, on_feet: 0.08, physical: 0.18 }[p.lifestyle?.work ?? "desk"];
  return training + work;
}

/** A rest day burns less than the weekly average, a hard day more. */
export const DAY_FACTOR: Record<DayType, number> = { rest: 0.9, train: 1.0, hard: 1.08 };

/**
 * The day factor, normalised so the WEEK averages exactly maintenance: with
 * four training days and three rest days, rest at 0.90 and training at 1.00
 * would leave the week 4 % short — a hidden deficit on a maintenance plan.
 */
export function dayFactor(p: Pick<Profile, "daysPerWeek">, dayType: DayType) {
  const avg = (p.daysPerWeek * DAY_FACTOR.train + (7 - p.daysPerWeek) * DAY_FACTOR.rest) / 7;
  return DAY_FACTOR[dayType] / avg;
}

export const bmi = (p: Pick<Profile, "weightKg" | "heightCm">) => p.weightKg / (p.heightCm / 100) ** 2;

/**
 * The weight protein and fat are set on. At a BMI up to 27 it is the scale
 * weight. Above, it is the weight at BMI 25 plus a quarter of the excess —
 * the usual "adjusted body weight" — because fat mass needs no protein.
 */
export function referenceWeight(p: Pick<Profile, "weightKg" | "heightCm">) {
  if (bmi(p) <= 27) return p.weightKg;
  const at25 = 25 * (p.heightCm / 100) ** 2;
  return Math.round((at25 + 0.25 * (p.weightKg - at25)) * 10) / 10;
}

/** Target rate of weight change, as a share of bodyweight per week. */
export const RATE_PER_WEEK: Record<Goal, number> = {
  cut: -0.0075,      // 0.5–1 %/week is the evidence-based range; the middle of it
  recomp: -0.0025,   // a slow trim while strength climbs
  build: 0.0025,     // ~1 %/month: lean gain without piling on fat
  strength: 0.001,   // eat to perform, a touch above maintenance
  endurance: 0,
  perform: 0,
};

const MAX_DEFICIT = 0.25;   // never more than 25 % under maintenance
const MAX_SURPLUS = 0.15;
const PROTEIN_PER_KG: Record<Goal, number> = { cut: 2.2, recomp: 2.0, build: 1.8, strength: 1.8, endurance: 1.6, perform: 1.7 };

export interface Step { label: string; value: string; why: string }

/** Daily targets for a day type, with every step that produced them. */
export function explainTargets(p: Profile, dayType: DayType) {
  const rest = bmr(p);
  const factor = activityFactor(p);
  const maintenance = rest * factor * dayFactor(p, dayType);
  const weeklyMaintenance = rest * factor;

  // The deficit or surplus comes from the rate, then is held inside safe bounds.
  const rate = RATE_PER_WEEK[p.goal];
  const dailyDelta = (rate * p.weightKg * KCAL_PER_KG) / 7;
  const bounded = Math.max(-MAX_DEFICIT * weeklyMaintenance, Math.min(MAX_SURPLUS * weeklyMaintenance, dailyDelta));
  const floor = Math.max(rest, p.sex === "female" ? 1200 : 1500);
  const kcal = Math.round(Math.max(floor, maintenance + bounded) / 10) * 10;

  const ref = referenceWeight(p);
  const keto = p.dietary.includes("keto");
  // Protein per kg of reference weight — but never more than 35 % of energy
  // (then it crowds out the carbs that fuel training), and never under 1.6 g/kg.
  const proteinPerKg = Math.max(1.6, Math.min(PROTEIN_PER_KG[p.goal], (kcal * 0.35) / 4 / ref));
  const protein = Math.round(ref * proteinPerKg);
  const fatMin = Math.max(ref * 0.8, (kcal * 0.25) / 9);
  let fat: number, carbs: number;
  if (keto) {
    carbs = 45;
    fat = Math.round((kcal - protein * 4 - carbs * 4) / 9);
  } else {
    // Carbohydrate floor: the brain alone runs on ~100 g a day, and training
    // days need more — 2 g/kg of reference weight on a hard day.
    const carbFloor = Math.max(100, dayType === "rest" ? ref * 1.5 : dayType === "hard" ? ref * 2.2 : ref * 1.8);
    fat = Math.round(Math.min(fatMin, (kcal * 0.35) / 9));
    carbs = Math.round((kcal - protein * 4 - fat * 9) / 4);
    if (carbs < carbFloor) {
      // Short on room: take it from fat down to its floor, never from protein.
      const give = Math.min(fat - Math.round(Math.max(ref * 0.6, (kcal * 0.2) / 9)), Math.ceil(((carbFloor - carbs) * 4) / 9));
      fat -= Math.max(0, give);
      carbs = Math.round((kcal - protein * 4 - fat * 9) / 4);
    }
  }
  const sugarMax = Math.round((kcal * (p.goal === "cut" ? 0.06 : 0.1)) / 4);
  const fiberMin = Math.round(Math.max(25, (kcal / 1000) * 14));

  const signed = (n: number) => `${n > 0 ? "+" : ""}${Math.round(n)}`;
  const steps: Step[] = [
    { label: "Resting energy", value: `${Math.round(rest).toLocaleString("en-US")} kcal`, why: `What your body burns doing nothing, from your weight, height, age and sex (Mifflin-St Jeor, the equation dietitians use).` },
    { label: "Your activity", value: `× ${factor.toFixed(2)}`, why: `${p.daysPerWeek} training days a week${p.lifestyle?.work && p.lifestyle.work !== "desk" ? `, and a ${p.lifestyle.work === "physical" ? "physical" : "on-your-feet"} job` : ""}. That gives your maintenance: ${Math.round(weeklyMaintenance).toLocaleString("en-US")} kcal a day on average.` },
    { label: dayType === "rest" ? "Rest day" : dayType === "hard" ? "Hard training day" : "Training day", value: `× ${dayFactor(p, dayType).toFixed(2)}`, why: dayType === "rest" ? "Less moving today, so a little less food — mostly fewer carbs." : dayType === "hard" ? "More work today, so more fuel — mostly carbs, around the session." : "An average training day." },
    { label: "Your goal", value: Math.abs(kcal - maintenance) < 15 ? "±0 kcal" : `${signed(Math.round((kcal - maintenance) / 10) * 10)} kcal`, why: goalWhy(p.goal, rate, p.weightKg, kcal <= floor + 5 && bounded < 0, p.units?.weight === "lb") },
    { label: "Protein", value: `${protein} g`, why: `${proteinPerKg.toFixed(1)} g per kg of ${ref === p.weightKg ? "your bodyweight" : `a reference weight of ${ref} kg (extra fat mass needs no protein)`}. ${p.goal === "cut" ? "High in a deficit to keep the muscle you have." : "Enough to build and repair after training."}` },
    { label: "Fat", value: `${fat} g`, why: `At least 0.8 g per kg and a quarter of your energy: hormones and vitamins need it.` },
    { label: "Carbs", value: `${carbs} g`, why: keto ? "Keto: held under 50 g; fat supplies the rest." : "The rest of your energy. Carbs fuel hard training, so they rise and fall with the day." },
    { label: "Sugar, max", value: `${sugarMax} g`, why: `Free sugar under ${p.goal === "cut" ? "6" : "10"} % of energy (WHO guideline${p.goal === "cut" ? ", tighter in a deficit" : ""}). Fruit counts, but whole fruit is fine.` },
    { label: "Fibre, min", value: `${fiberMin} g`, why: "14 g per 1,000 kcal: fullness, digestion, steadier energy." },
  ];

  return { kcal, protein, carbs, fat, sugarMax, fiberMin, maintenance: Math.round(maintenance), referenceKg: ref, steps };
}

function goalWhy(goal: Goal, rate: number, kg: number, atFloor: boolean, pounds = false) {
  const perWeek = Math.abs(rate * kg);
  // In the rider's own unit, like every other weight on screen.
  const w = (k: number) => pounds ? `${(k * 2.20462).toFixed(1)} lb` : `${k.toFixed(1)} kg`;
  if (atFloor) return "A deficit, held at your floor: eating less than this costs muscle, not fat. To lose faster, move more — daily walks and a third training day do more than cutting food further.";
  switch (goal) {
    case "cut": return `A deficit for about ${w(perWeek)} a week (0.75 % of your weight) — fast enough to see, slow enough to keep your muscle.`;
    case "recomp": return "A small deficit: lose fat slowly while your strength keeps climbing.";
    case "build": return `A small surplus for about ${w(perWeek * 4.3)} a month — mostly muscle, not fat.`;
    case "strength": return "About maintenance, a touch over: eat to lift, not to gain.";
    default: return "Maintenance: fuel the training, keep your weight steady.";
  }
}

/**
 * What to realistically expect on the scale. The weekly average of the day
 * types, against maintenance; shown as a range because real bodies adapt,
 * and the first week moves more (water and glycogen).
 */
export function projection(p: Profile, weeks = 8) {
  const trainDays = p.daysPerWeek;
  const avgIntake = (explainTargets(p, "train").kcal * trainDays + explainTargets(p, "rest").kcal * (7 - trainDays)) / 7;
  const maintenance = bmr(p) * activityFactor(p);
  const perWeekKg = ((avgIntake - maintenance) * 7) / KCAL_PER_KG;
  // Adaptation: a deficit shrinks as weight falls and the body economises;
  // taking 80 % of the arithmetic over two months is the honest middle.
  const total = perWeekKg * weeks * 0.8;
  const floored = explainTargets(p, "train").kcal <= Math.max(bmr(p), p.sex === "female" ? 1200 : 1500) + 10;
  return {
    floored,
    perWeekKg: Math.round(perWeekKg * 100) / 100,
    weeks,
    lowKg: Math.round(total * 0.75 * 10) / 10,
    highKg: Math.round(total * 1.2 * 10) / 10,
  };
}
