import { describe, expect, it } from "vitest";
import { bmr, explainTargets, projection, referenceWeight, activityFactor } from "./science";
import { buildNutritionDay, dayTotals } from "./engine";
import type { Goal, Profile } from "../types";

/* ─────────────────────────────────────────────────────────────
   The coach panel.

   Thousands of people — small and large, young and old, every
   goal, two to six training days, three ways of eating — and the
   rules a sports nutritionist would hold any plan to. A failure
   here is a plan a coach would look at and say "what is this?".

   Targets are checked for every profile; menus for a spread of
   them (building a day searches the catalogue, so all of them
   would take minutes).
   ───────────────────────────────────────────────────────────── */

const BODIES: [number, number][] = [[48, 155], [58, 165], [68, 172], [80, 180], [95, 178], [115, 175], [140, 182]];
const GOALS: Goal[] = ["cut", "recomp", "build", "strength", "endurance", "perform"];
const DIETS: Profile["dietary"][] = [[], ["vegetarian"], ["keto"]];

function person(sex: "male" | "female", age: number, [kg, cm]: [number, number], goal: Goal, days: Profile["daysPerWeek"], dietary: Profile["dietary"], meals: Profile["mealsPerDay"] = 4): Profile {
  return {
    id: "p", name: "Test", sex, age, heightCm: cm, weightKg: kg, units: { weight: "kg", distance: "km" }, goal, level: "intermediate",
    daysPerWeek: days, sessionMinutes: 60, equipment: [], trainingPlace: "full_gym", pain: [], baselines: {}, dietary, mealsPerDay: meals,
    wakeTime: "07:00", trainTime: "18:00", notifications: false, createdAt: "", lifestyle: { sleep: "7_8", stress: "moderate", work: "desk" },
  } as unknown as Profile;
}

const everyone: Profile[] = [];
for (const sex of ["male", "female"] as const)
  for (const age of [18, 30, 45, 60, 72])
    for (const body of BODIES)
      for (const goal of GOALS)
        for (const days of [2, 4, 6] as const)
          for (const diet of DIETS) everyone.push(person(sex, age, body, goal, days, diet));

describe("coach panel: daily targets", () => {
  it(`holds for all ${everyone.length} profiles`, () => {
    const faults: string[] = [];
    for (const p of everyone) {
      const who = `${p.sex} ${p.age}y ${p.weightKg}kg/${p.heightCm}cm ${p.goal} ${p.daysPerWeek}d ${p.dietary.join("+") || "omni"}`;
      const ref = referenceWeight(p);
      for (const dt of ["rest", "train", "hard"] as const) {
        const t = explainTargets(p, dt);
        const floor = Math.max(bmr(p), p.sex === "female" ? 1200 : 1500);
        if (t.kcal < floor - 10) faults.push(`${who} ${dt}: ${t.kcal} kcal under the floor ${Math.round(floor)}`);
        const energy = t.protein * 4 + t.carbs * 4 + t.fat * 9;
        if (Math.abs(energy - t.kcal) / t.kcal > 0.03) faults.push(`${who} ${dt}: macros make ${Math.round(energy)} kcal, target ${t.kcal}`);
        const pkg = t.protein / ref;
        if (pkg < 1.55 || pkg > 2.45) faults.push(`${who} ${dt}: protein ${pkg.toFixed(2)} g/kg reference`);
        if (t.protein / p.weightKg > 2.6) faults.push(`${who} ${dt}: protein ${(t.protein / p.weightKg).toFixed(2)} g/kg of scale weight`);
        if (!p.dietary.includes("keto")) {
          if (t.carbs < (explainTargets(p, dt).kcal <= 1400 ? 85 : 100)) faults.push(`${who} ${dt}: carbs ${t.carbs} g`);
          const fatShare = (t.fat * 9) / t.kcal;
          if (fatShare < 0.19 || fatShare > 0.36) faults.push(`${who} ${dt}: fat ${(fatShare * 100).toFixed(0)} % of energy`);
        } else if (t.carbs > 50) faults.push(`${who} ${dt}: keto carbs ${t.carbs} g`);
      }
      // What the scale should do, week to week.
      const perWeekPct = (projection(p).perWeekKg / p.weightKg) * 100;
      // A cut held at the energy floor loses slowly by design (the app says to move more).
      if (p.goal === "cut" && !projection(p).floored && (perWeekPct > -0.25 || perWeekPct < -1.05)) faults.push(`${who}: cut at ${perWeekPct.toFixed(2)} %/week`);
      if (p.goal === "build" && (perWeekPct < 0 || perWeekPct > 0.5)) faults.push(`${who}: build at ${perWeekPct.toFixed(2)} %/week`);
      const maint = bmr(p) * activityFactor(p);
      const trainKcal = explainTargets(p, "train").kcal;
      if (p.goal === "cut" && (maint - trainKcal) / maint > 0.26) faults.push(`${who}: deficit ${(((maint - trainKcal) / maint) * 100).toFixed(0)} %`);
    }
    expect(faults.slice(0, 25)).toEqual([]);
  });
});

describe("coach panel: menus", () => {
  // Every 11th profile: a spread across sex, age, size, goal, days and diet.
  const sample = everyone.filter((_, i) => i % 11 === 0);
  const train = { kind: "lower", focus: "hypertrophy", minutes: 60 } as never;
  const mins = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };

  it(`land on target for ${sample.length} people, rest and training days`, () => {
    const faults: string[] = [];
    const errs = { kcal: [] as number[], protein: [] as number[], carbs: [] as number[], fat: [] as number[] };
    for (const p of sample) {
      for (const [label, session] of [["rest", null], ["train", train]] as const) {
        const day = buildNutritionDay(p, "2026-10-05", session);
        const got = dayTotals(day);
        const t = day.targets;
        const who = `${p.sex} ${p.weightKg}kg ${p.goal} ${p.dietary.join("+") || "omni"} ${label}`;
        const r = (g: number, w: number) => (g - w) / w;
        errs.kcal.push(r(got.kcal, t.kcal)); errs.protein.push(r(got.protein, t.protein)); errs.carbs.push(r(got.carbs, t.carbs)); errs.fat.push(r(got.fat, t.fat));
        if (Math.abs(r(got.kcal, t.kcal)) > 0.08) faults.push(`${who}: ${Math.round(got.kcal)} / ${t.kcal} kcal`);
        // Short of target is only a fault below 1.6 g/kg of reference weight — the
        // level the research treats as enough to keep muscle in a deficit.
        if (r(got.protein, t.protein) < -0.1 && got.protein < referenceWeight(p) * 1.6 - 1) faults.push(`${who}: protein ${Math.round(got.protein)} / ${t.protein} g`);
        const times = day.meals.map((m) => mins(m.time)).sort((a, b) => a - b);
        for (let i = 1; i < times.length; i++) if (times[i] - times[i - 1] < 75) faults.push(`${who}: two feedings ${times[i] - times[i - 1]} min apart`);
        if (t.protein > 170 && day.meals.length < 4) faults.push(`${who}: ${t.protein} g protein over ${day.meals.length} feedings`);
      }
    }
    const mae = (xs: number[]) => Math.round((xs.reduce((a, x) => a + Math.abs(x), 0) / xs.length) * 1000) / 10;
    const within = (xs: number[], tol: number) => Math.round((xs.filter((x) => Math.abs(x) <= tol).length / xs.length) * 100);
    console.log(`within ±10 %: kcal ${within(errs.kcal, 0.1)} % · protein ${within(errs.protein, 0.1)} % · carbs ${within(errs.carbs, 0.15)} % (±15) · fat ${within(errs.fat, 0.15)} % (±15)`);
    console.log(`menu error (mean |%|): kcal ${mae(errs.kcal)} · protein ${mae(errs.protein)} · carbs ${mae(errs.carbs)} · fat ${mae(errs.fat)}`);
    expect(faults.slice(0, 25)).toEqual([]);
  }, 120_000);
});

describe("coach panel: a maintenance week is maintenance", () => {
  it("averages to maintenance over the week for every training frequency", () => {
    for (const days of [2, 3, 4, 5, 6] as const) {
      const p = person("male", 30, [80, 180], "endurance", days, []);
      expect(Math.abs(projection(p).perWeekKg)).toBeLessThan(0.03);
    }
  });
});
