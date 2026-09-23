import type { DistanceUnit, UnitPrefs, Units, WeightUnit } from "./types";

/* Each formatter knows which dimension it needs, so callers may hand it the
   whole preference object and never pick the wrong half. */
export type WeightLike = WeightUnit | UnitPrefs;
export type DistanceLike = DistanceUnit | UnitPrefs;
const w = (u: WeightLike): WeightUnit => (typeof u === "string" ? u : u.weight);
const d = (u: DistanceLike): DistanceUnit => (typeof u === "string" ? u : u.distance);

/**
 * Units that feel native where the phone is. The US measures in pounds and
 * miles (so do Liberia and Myanmar); the UK weighs in kilograms and runs in
 * miles; everywhere else is metric. Only a default: both stay switchable.
 */
export function localeUnits(locale?: string): UnitPrefs {
  const tag = locale ?? (typeof navigator !== "undefined" ? navigator.language : "");
  const region = (tag.split(/[-_]/)[1] ?? "").toUpperCase();
  if (region === "US" || region === "LR" || region === "MM") return { weight: "lb", distance: "mi" };
  if (region === "GB") return { weight: "kg", distance: "mi" };
  return { weight: "kg", distance: "km" };
}

export const kgToLb = (kg: number) => kg * 2.2046226218;
export const lbToKg = (lb: number) => lb / 2.2046226218;

/** Round a load to what actually exists on a bar / rack. */
export function roundLoad(kg: number, u: WeightLike) {
  if (w(u) === "lb") {
    const lb = Math.round(kgToLb(kg) / 5) * 5;
    return lbToKg(lb);
  }
  return Math.round(kg / 2.5) * 2.5;
}

export function fmtLoad(kg: number | undefined, u: WeightLike, withUnit = true) {
  if (kg == null) return "—";
  const unit = w(u);
  const v = unit === "lb" ? Math.round(kgToLb(kg)) : Math.round(kg * 2) / 2;
  return withUnit ? `${v} ${unit}` : String(v);
}

export function fmtDist(m: number, u: DistanceLike) {
  if (d(u) === "mi") return `${(m / 1609.344).toFixed(2)} mi`;
  return `${(m / 1000).toFixed(2)} km`;
}

export function fmtPace(secPerKm: number | undefined, u: DistanceLike) {
  if (!secPerKm || !isFinite(secPerKm)) return "—";
  const unit = d(u);
  const s = unit === "mi" ? secPerKm * 1.609344 : secPerKm;
  const m = Math.floor(s / 60);
  const r = Math.round(s % 60);
  return `${m}:${String(r).padStart(2, "0")} /${unit}`;
}

export function fmtDuration(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}

export function fmtHeight(cm: number, u: WeightLike) {
  if (w(u) === "lb") {
    const inches = cm / 2.54;
    return `${Math.floor(inches / 12)}'${Math.round(inches % 12)}"`;
  }
  return `${Math.round(cm)} cm`;
}

/** Plates per side for a barbell load. Bar = 20 kg (45 lb). */
export function platesFor(loadKg: number, u: WeightLike): { bar: string; perSide: string[]; short: boolean } {
  if (w(u) === "lb") {
    const total = kgToLb(loadKg), bar = 45, plates = [45, 35, 25, 10, 5, 2.5];
    let rem = Math.max(0, (total - bar) / 2); const out: string[] = [];
    for (const p of plates) while (rem >= p - 0.01) { out.push(`${p}`); rem -= p; }
    return { bar: "45 lb bar", perSide: out, short: total < bar };
  }
  const bar = 20, plates = [25, 20, 15, 10, 5, 2.5, 1.25];
  let rem = Math.max(0, (loadKg - bar) / 2); const out: string[] = [];
  for (const p of plates) while (rem >= p - 0.01) { out.push(`${p}`); rem -= p; }
  return { bar: "20 kg bar", perSide: out, short: loadKg < bar };
}

/** Epley e1RM. */
export const e1rm = (loadKg: number, reps: number) => (reps <= 1 ? loadKg : loadKg * (1 + reps / 30));

/** Read a profile written before weight and distance were separable. */
export function normaliseUnits(u: UnitPrefs | Units | undefined): UnitPrefs {
  if (u && typeof u === "object") return u;
  return u === "imperial" ? { weight: "lb", distance: "mi" } : { weight: "kg", distance: "km" };
}
