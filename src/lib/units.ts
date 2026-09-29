import type { DistanceUnit, UnitPrefs, Units, WeightUnit } from "./types";
import { tr } from "./i18n";

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

/**
 * Cooking temperatures in both scales. Ovens in Québec and the US are marked
 * in Fahrenheit, so people who weigh in pounds read "425 °F (220 °C)"; everyone
 * else reads "220 °C (425 °F)". Oven settings round to 25 °F, the way ovens are
 * marked; doneness temperatures (under 100 °C) round to 5 °F, so 74 °C reads
 * 165 °F. For pound users, sizes in cm also get inches: "2 cm (¾ in)".
 * Text already carrying a Fahrenheit value is left alone.
 */
export function localizeCooking(text: string, u: WeightLike, lang: "fr" | "en" = "en"): string {
  const lb = w(u) === "lb";
  const f = (c: string) => {
    const x = (Number(c) * 9) / 5 + 32;
    return Number(c) >= 100 ? Math.round(x / 25) * 25 : Math.round(x / 5) * 5;
  };
  let out = text.replace(/(\d+)(?:[–-](\d+))?\s?°C(?!\s*\(\s*\d+[^)]*°F)(?!\s*\/\s*\d)/g, (m, a: string, b: string | undefined, at: number, all: string) => {
    const c = b ? `${a}–${b} °C` : `${a} °C`;
    const fh = b ? `${f(a)}–${f(b)} °F` : `${f(a)} °F`;
    // Already in brackets, "(74 °C)": no brackets inside brackets — "(74 °C / 165 °F)".
    if (all[at - 1] === "(" && all[at + m.length] === ")") return lb ? `${fh} / ${c}` : `${c} / ${fh}`;
    return lb ? `${fh} (${c})` : `${c} (${fh})`;
  });
  if (lb) {
    const q = ["", "¼", "½", "¾"];
    out = out.replace(/(\d+(?:[.,]\d+)?)\s?cm\b(?!\s*\()/g, (m, n: string) => {
      const inch = Math.max(0.25, Math.round((Number(n.replace(",", ".")) / 2.54) * 4) / 4);
      const whole = Math.floor(inch), part = Math.round((inch - whole) * 4);
      return `${m} (${whole || ""}${q[part]} ${lang === "fr" ? "po" : "in"})`;
    });
  }
  return out;
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
    return { bar: tr("barre de 45 lb", "45 lb bar"), perSide: out, short: total < bar };
  }
  const bar = 20, plates = [25, 20, 15, 10, 5, 2.5, 1.25];
  let rem = Math.max(0, (loadKg - bar) / 2); const out: string[] = [];
  for (const p of plates) while (rem >= p - 0.01) { out.push(`${p}`); rem -= p; }
  return { bar: tr("barre de 20 kg", "20 kg bar"), perSide: out, short: loadKg < bar };
}

/** Epley e1RM. */
export const e1rm = (loadKg: number, reps: number) => (reps <= 1 ? loadKg : loadKg * (1 + reps / 30));

/** Read a profile written before weight and distance were separable. */
export function normaliseUnits(u: UnitPrefs | Units | undefined): UnitPrefs {
  if (u && typeof u === "object") return u;
  return u === "imperial" ? { weight: "lb", distance: "mi" } : { weight: "kg", distance: "km" };
}
