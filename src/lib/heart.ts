import type { ActivityType, Profile, Sex } from "./types";
import { sportSpec } from "./data/sports";
import { getLang, type Lang } from "./i18n";

/* ─────────────────────────────────────────────────────────────
   Heart rate, zones and calories for a recorded activity.

   Calories come from heart rate when a strap or watch was connected
   (Keytel et al. 2005: body weight, age, sex and average heart rate —
   the equation most sports watches build on), otherwise from the
   sport's metabolic cost (MET) at the pace actually moved. The source
   is kept with the number, so an estimate is never shown as a
   measurement.
   ───────────────────────────────────────────────────────────── */

/** [seconds since start, beats per minute], one sample every few seconds. */
export type HrSeries = [number, number][];

export const maxHrFor = (age: number) => Math.round(208 - 0.7 * age);

/** Zone 1–5 as a share of max heart rate (50–60, 60–70, 70–80, 80–90, 90+ %). */
export function zoneOf(hr: number, maxHr: number): 0 | 1 | 2 | 3 | 4 | 5 {
  const p = hr / maxHr;
  return p >= 0.9 ? 5 : p >= 0.8 ? 4 : p >= 0.7 ? 3 : p >= 0.6 ? 2 : p >= 0.5 ? 1 : 0;
}

export const ZONE_NAME = ["Rest", "Easy", "Aerobic", "Tempo", "Threshold", "Max"] as const;
export const ZONE_NAME_FR = ["Repos", "Facile", "Aérobie", "Tempo", "Seuil", "Max"] as const;
/** A zone's name in the given language (the current one by default). */
export const zoneName = (z: number, lang: Lang = getLang()) => (lang === "fr" ? ZONE_NAME_FR : ZONE_NAME)[z] ?? "";

/** Average and max over a series. Readings outside what a heart can do are dropped. */
export function hrSummary(series: HrSeries | undefined) {
  const v = (series ?? []).map(([, b]) => b).filter((b) => b >= 30 && b <= 230);
  if (!v.length) return null;
  return { avg: Math.round(v.reduce((a, b) => a + b, 0) / v.length), max: Math.max(...v) };
}

/** kcal/min from heart rate (Keytel 2005). */
function keytelPerMin(hr: number, weightKg: number, age: number, sex: Sex) {
  const male = (-55.0969 + 0.6309 * hr + 0.1988 * weightKg + 0.2017 * age) / 4.184;
  const female = (-20.4022 + 0.4472 * hr - 0.1263 * weightKg + 0.074 * age) / 4.184;
  const k = sex === "male" ? male : sex === "female" ? female : (male + female) / 2;
  return Math.max(0, k);
}

/* Metabolic cost per sport, when there is no heart rate. Running and riding
   scale with speed; the rest are typical values for the activity. */
function met(type: ActivityType, speedKmh: number): number {
  switch (type) {
    case "run": case "trail": return Math.max(6, Math.min(16, speedKmh * 1.0));
    case "walk": return speedKmh > 6 ? 5 : 3.5;
    case "hike": return 6;
    case "ruck": return 7.5;
    case "ride": case "gravel": return speedKmh < 16 ? 6 : speedKmh < 20 ? 8 : speedKmh < 25 ? 10 : 12;
    case "mtb": return 8.5;
    case "skate": return 7.5;
    case "ski": return 9;
    case "ski_alpine": case "snowboard": return 5.5;
    case "ice_skate": return 7;
    case "swim": return 7;
    case "row": case "kayak": return 7;
    case "surf": return 3;
    case "climb": case "boulder": return 7.5;
    case "hockey": return 8;
    case "soccer": case "football": case "basketball": return 7.5;
    case "tennis": return 7;
    case "combat": return 10;
    default: return sportSpec(type).group === "air" ? 3 : 5;
  }
}

/**
 * Calories for an activity. `movingMin` should be moving time: standing at a
 * light burns what standing burns, not what running does.
 */
export function activityKcal(input: {
  type: ActivityType; movingMin: number; distanceM: number; profile: Pick<Profile, "weightKg" | "age" | "sex">; hr?: HrSeries;
}): { kcal: number; source: "heart_rate" | "estimate" } {
  const { profile: p, movingMin } = input;
  const hr = hrSummary(input.hr);
  // Enough heart-rate coverage to trust it: a strap that dropped after two
  // minutes of an hour describes those two minutes, not the hour.
  const covered = input.hr?.length ? (input.hr[input.hr.length - 1][0] - input.hr[0][0]) / 60 : 0;
  if (hr && movingMin > 0 && covered >= movingMin * 0.6) {
    return { kcal: Math.round(keytelPerMin(hr.avg, p.weightKg, p.age, p.sex) * movingMin), source: "heart_rate" };
  }
  const speedKmh = movingMin > 0 ? input.distanceM / 1000 / (movingMin / 60) : 0;
  // MET × kg × hours = kcal.
  return { kcal: Math.round(met(input.type, speedKmh) * p.weightKg * (movingMin / 60)), source: "estimate" };
}
