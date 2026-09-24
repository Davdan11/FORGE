/* ─────────────────────────────────────────────────────────────
   The other places people ride: Zwift, MyWhoosh, Rouvy, Wahoo
   SYSTM / RGT, TrainerRoad… Rides imported from their files are
   kept apart, one card per platform, never added into one big
   total: a rider sees "Zwift: 42 rides, 1 280 km" next to
   "MyWhoosh: 9 rides" and next to FORGE Ride.

   Which platform wrote a file is read from the file itself: the
   manufacturer id FIT gives each maker (Zwift has its own), the
   product and sport names inside, then the file's name. When none
   of that says, the rider picks it (the import screen asks).
   ───────────────────────────────────────────────────────────── */

import type { Activity } from "../types";
import { bestPower, type FitRide } from "./fit";

export type PlatformId = "zwift" | "mywhoosh" | "rouvy" | "wahoo" | "trainerroad" | "fulgaz" | "bkool" | "garmin" | "other";

export interface Platform { id: PlatformId; name: string; color: string; ink: string }

export const PLATFORMS: Platform[] = [
  { id: "zwift", name: "Zwift", color: "#FC6719", ink: "#fff" },
  { id: "mywhoosh", name: "MyWhoosh", color: "#00C2A8", ink: "#07090d" },
  { id: "rouvy", name: "Rouvy", color: "#E6007E", ink: "#fff" },
  { id: "wahoo", name: "Wahoo SYSTM / RGT", color: "#1F8EFA", ink: "#fff" },
  { id: "trainerroad", name: "TrainerRoad", color: "#E3262E", ink: "#fff" },
  { id: "fulgaz", name: "FulGaz", color: "#FFC400", ink: "#07090d" },
  { id: "bkool", name: "Bkool", color: "#2DBE60", ink: "#07090d" },
  { id: "garmin", name: "Garmin", color: "#6AB2E7", ink: "#07090d" },
  { id: "other", name: "Autre", color: "#8A93A3", ink: "#fff" },
];
export const platform = (id: string | undefined): Platform => PLATFORMS.find((p) => p.id === id) ?? PLATFORMS[PLATFORMS.length - 1];

/** FIT manufacturer ids that name a platform on their own. */
const MAKERS: Partial<Record<number, PlatformId>> = { 260: "zwift", 1: "garmin", 32: "wahoo" };
/** Words found in product / sport / software names or the file name. */
const WORDS: [RegExp, PlatformId][] = [
  [/zwift/i, "zwift"], [/my\s*whoosh|whoosh/i, "mywhoosh"], [/rouvy/i, "rouvy"],
  [/systm|sufferfest|\brgt\b|wahoo/i, "wahoo"], [/trainer\s*road/i, "trainerroad"], [/fulgaz/i, "fulgaz"], [/bkool/i, "bkool"], [/garmin|edge|forerunner|fenix/i, "garmin"],
];

/** Which platform wrote this ride (null: can't tell, ask the rider). */
export function detectPlatform(ride: Pick<FitRide, "manufacturer" | "names">, fileName = ""): PlatformId | null {
  // Names first: an app on a Wahoo or Garmin device still names itself.
  for (const text of [...ride.names, fileName]) for (const [re, id] of WORDS) if (re.test(text)) return id;
  const maker = ride.manufacturer !== undefined ? MAKERS[ride.manufacturer] : undefined;
  return maker ?? null;
}

/** The Activity saved for an imported ride (no XP: it was earned elsewhere). */
export function importedActivity(ride: FitRide, platformId: PlatformId, fileName: string, id: string): Activity {
  const p = platform(platformId);
  const w = ride.seconds.w;
  const hrSeries: [number, number][] = [];
  for (let i = 0; i < ride.seconds.hr.length; i += 5) if (ride.seconds.hr[i] > 0) hrSeries.push([i, ride.seconds.hr[i]]);
  return {
    id, type: "ride",
    startedAt: ride.start.toISOString(), endedAt: new Date(ride.start.getTime() + ride.elapsedSec * 1000).toISOString(),
    distanceM: Math.round(ride.distanceM), durationSec: Math.round(ride.elapsedSec), movingSec: Math.round(ride.movingSec),
    avgPaceSecKm: ride.distanceM > 0 ? ride.movingSec / (ride.distanceM / 1000) : undefined,
    elevGainM: Math.round(ride.ascentM), points: [], splits: [],
    title: `${p.name} · ${ride.subSport === 58 || ride.subSport === 6 ? "sortie virtuelle" : "sortie"}`,
    xp: 0, avgHr: ride.avgHr, maxHr: ride.maxHr, kcal: ride.kcal, kcalSource: ride.kcal ? "estimate" : undefined,
    hrSeries: hrSeries.length ? hrSeries : undefined,
    meta: {
      discipline: ride.subSport === 58 || ride.subSport === 6 ? "virtual" : undefined,
      imported: {
        platform: platformId, file: fileName.slice(0, 80),
        avgW: ride.avgW, maxW: ride.maxW, normalizedW: ride.normalizedW, avgCadence: ride.avgCadence,
        best5min: bestPower(w, 300) ?? undefined, best20min: bestPower(w, 1200) ?? undefined,
      },
    },
  };
}

/** Same ride already saved? (same platform, starting within a minute) */
export function isDuplicate(a: Pick<Activity, "startedAt" | "meta">, existing: Pick<Activity, "startedAt" | "meta">[]): boolean {
  const t = Date.parse(a.startedAt), p = a.meta?.imported?.platform;
  return existing.some((e) => e.meta?.imported?.platform === p && Math.abs(Date.parse(e.startedAt) - t) < 60_000);
}

export interface PlatformTotals {
  platform: Platform;
  rides: number; km: number; hours: number; climbM: number;
  /** Time-weighted over the rides that had power. */
  avgW?: number;
  best20min?: number; best5min?: number;
  last?: string;
}

/** One card's numbers per platform, busiest first. Never one total across them. */
export function platformTotals(activities: Pick<Activity, "startedAt" | "distanceM" | "movingSec" | "durationSec" | "elevGainM" | "meta">[]): PlatformTotals[] {
  const by = new Map<PlatformId, PlatformTotals & { wSec: number; wSum: number }>();
  for (const a of activities) {
    const im = a.meta?.imported; if (!im) continue;
    const id = platform(im.platform).id;
    const t = by.get(id) ?? { platform: platform(id), rides: 0, km: 0, hours: 0, climbM: 0, wSec: 0, wSum: 0 };
    const sec = a.movingSec ?? a.durationSec;
    t.rides++; t.km += a.distanceM / 1000; t.hours += sec / 3600; t.climbM += a.elevGainM;
    if (im.avgW) { t.wSum += im.avgW * sec; t.wSec += sec; }
    if (im.best20min) t.best20min = Math.max(t.best20min ?? 0, im.best20min);
    if (im.best5min) t.best5min = Math.max(t.best5min ?? 0, im.best5min);
    if (!t.last || a.startedAt > t.last) t.last = a.startedAt;
    by.set(id, t);
  }
  return [...by.values()]
    .map(({ wSec, wSum, ...t }) => ({ ...t, avgW: wSec > 0 ? Math.round(wSum / wSec) : undefined }))
    .sort((a, b) => b.hours - a.hours);
}
