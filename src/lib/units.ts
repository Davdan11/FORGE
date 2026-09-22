import type { Units } from "./types";

export const kgToLb = (kg: number) => kg * 2.2046226218;
export const lbToKg = (lb: number) => lb / 2.2046226218;

/** Round a load to what actually exists on a bar / rack. */
export function roundLoad(kg: number, units: Units) {
  if (units === "imperial") {
    const lb = Math.round(kgToLb(kg) / 5) * 5;
    return lbToKg(lb);
  }
  return Math.round(kg / 2.5) * 2.5;
}

export function fmtLoad(kg: number | undefined, units: Units, withUnit = true) {
  if (kg == null) return "—";
  const v = units === "imperial" ? Math.round(kgToLb(kg)) : Math.round(kg * 2) / 2;
  return withUnit ? `${v} ${units === "imperial" ? "lb" : "kg"}` : String(v);
}

export function fmtDist(m: number, units: Units) {
  if (units === "imperial") return `${(m / 1609.344).toFixed(2)} mi`;
  return `${(m / 1000).toFixed(2)} km`;
}

export function fmtPace(secPerKm: number | undefined, units: Units) {
  if (!secPerKm || !isFinite(secPerKm)) return "—";
  const s = units === "imperial" ? secPerKm * 1.609344 : secPerKm;
  const m = Math.floor(s / 60);
  const r = Math.round(s % 60);
  return `${m}:${String(r).padStart(2, "0")} /${units === "imperial" ? "mi" : "km"}`;
}

export function fmtDuration(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}

export function fmtHeight(cm: number, units: Units) {
  if (units === "imperial") {
    const inches = cm / 2.54;
    return `${Math.floor(inches / 12)}'${Math.round(inches % 12)}"`;
  }
  return `${Math.round(cm)} cm`;
}

/** Plates per side for a barbell load. Bar = 20 kg (45 lb). */
export function platesFor(loadKg: number, units: Units): { bar: string; perSide: string[]; short: boolean } {
  if (units === "imperial") {
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
