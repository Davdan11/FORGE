/* ─────────────────────────────────────────────────────────────
   Health Connect (Android) and Apple Health (iPhone), phone apps only.

   Reads, never writes: the day's steps, last night's sleep, heart
   rate variability and resting heart rate, the scale's weigh-ins
   (a smart scale synced there), and the workouts other apps or a
   watch recorded (a Garmin run synced to Health Connect, an Apple
   Watch ride). Workouts become FORGE activities (no GPS track: the
   health stores keep only totals), once each, keyed by the store's
   own id — and pay XP like any training (see awardWatchActivity).
   A new weigh-in feeds the weekly coach; a workout of today adds
   its fuel to today's food (nutrition/activityFuel.ts).
   ───────────────────────────────────────────────────────────── */

import { isNativeShell } from "@/lib/native";
import { db, uid } from "@/lib/db";
import type { Activity, ActivityType } from "@/lib/types";

const CONNECTED = "forge.health.connected";
const DAY = "forge.health.today";

export type HealthDay = { date: string; steps?: number; sleepMin?: number; restingHr?: number; hrvMs?: number; at: string };

export const healthSupported = () => isNativeShell();
export const healthConnected = () => { try { const v = localStorage.getItem(CONNECTED); return v === "1" || v === READS_VERSION; } catch { return false; } };
/** Bumped when FORGE starts reading a new kind of data: a phone connected before is asked once for the new ones. */
const READS_VERSION = "2";
const READS = ["steps", "sleep", "restingHeartRate", "heartRateVariability", "weight", "workouts"] as const;
export function healthToday(): HealthDay | null {
  try { const d = JSON.parse(localStorage.getItem(DAY) ?? "null") as HealthDay | null; return d && d.date === new Date().toDateString() ? d : null; } catch { return null; }
}

async function plugin() { return (await import("@capgo/capacitor-health")).Health; }
const localDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Asks for read access; false when the phone has no health store (old Android without Health Connect). */
export async function connectHealth(): Promise<{ ok: boolean; reason?: string }> {
  if (!healthSupported()) return { ok: false, reason: "web" };
  const Health = await plugin();
  const a = await Health.isAvailable();
  if (!a.available) return { ok: false, reason: a.reason ?? "unavailable" };
  await Health.requestAuthorization({ read: [...READS], write: [] });
  try { localStorage.setItem(CONNECTED, READS_VERSION); } catch { /* private mode */ }
  return { ok: true };
}

export function disconnectHealth() { try { localStorage.removeItem(CONNECTED); localStorage.removeItem(DAY); } catch { /* private mode */ } }

const WORKOUT_TYPE: Record<string, ActivityType> = {
  running: "run", walking: "walk", hiking: "hike", cycling: "ride", mountainBiking: "mtb", swimming: "swim", rowing: "row",
  skiing: "ski", downhillSkiing: "ski_alpine", snowboarding: "snowboard", climbing: "climb", soccer: "soccer",
  americanFootball: "football", hockey: "hockey", basketball: "basketball", tennis: "tennis", boxing: "combat", martialArts: "combat",
  surfing: "surf", paddling: "kayak", skating: "skate",
};

/** Pulls the day's numbers and the last 30 days of workouts. Returns how many new activities came in. */
export async function syncHealth(): Promise<number> {
  if (!healthSupported() || !healthConnected()) return 0;
  const Health = await plugin();
  try {
    if (localStorage.getItem(CONNECTED) !== READS_VERSION) {
      await Health.requestAuthorization({ read: [...READS], write: [] });
      localStorage.setItem(CONNECTED, READS_VERSION);
    }
  } catch { /* declined: what was granted before still works */ }
  const now = new Date(), midnight = new Date(now); midnight.setHours(0, 0, 0, 0);
  const lastEvening = new Date(midnight.getTime() - 6 * 3600e3), noon = new Date(midnight.getTime() + 12 * 3600e3);
  const day: HealthDay = { date: now.toDateString(), at: now.toISOString() };
  try {
    const { samples } = await Health.readSamples({ dataType: "steps", startDate: midnight.toISOString(), endDate: now.toISOString(), limit: 1000 });
    day.steps = Math.round(samples.reduce((s, x) => s + (x.value ?? 0), 0));
  } catch { /* not granted */ }
  try {
    const { samples } = await Health.readSamples({ dataType: "sleep", startDate: lastEvening.toISOString(), endDate: noon.toISOString(), limit: 200 });
    const asleep = samples.filter((x) => !/awake|inBed|out/i.test(String(x.sleepState ?? "asleep")));
    const min = asleep.reduce((s, x) => s + (new Date(x.endDate).getTime() - new Date(x.startDate).getTime()) / 60000, 0);
    if (min > 0) day.sleepMin = Math.round(min);
  } catch { /* not granted */ }
  try {
    const { samples } = await Health.readSamples({ dataType: "restingHeartRate", startDate: new Date(now.getTime() - 2 * 86400e3).toISOString(), endDate: now.toISOString(), limit: 10 });
    const last = samples[samples.length - 1]; if (last) day.restingHr = Math.round(last.value);
  } catch { /* not granted */ }
  try {
    // Heart rate variability, overnight: the watch's recovery signal. The night's average.
    const { samples } = await Health.readSamples({ dataType: "heartRateVariability", startDate: lastEvening.toISOString(), endDate: noon.toISOString(), limit: 200 });
    const ok = samples.filter((x) => x.value > 5 && x.value < 300);
    if (ok.length) day.hrvMs = Math.round(ok.reduce((s, x) => s + x.value, 0) / ok.length);
  } catch { /* not granted */ }
  try {
    // A smart scale (Garmin Index, Withings…) writes here: its weigh-ins become FORGE's, one a day.
    const { samples } = await Health.readSamples({ dataType: "weight", startDate: new Date(now.getTime() - 14 * 86400e3).toISOString(), endDate: now.toISOString(), limit: 60 });
    const have = new Set((await db.weights.toArray()).map((w) => w.date));
    const byDay = new Map<string, number>();
    for (const x of samples) { const d = localDay(new Date(x.startDate)); if (!have.has(d) && x.value > 25 && x.value < 350) byDay.set(d, x.value); }
    const { logWeighIn } = await import("@/lib/progress");
    for (const [d, kg] of [...byDay].sort()) await logWeighIn(Math.round(kg * 10) / 10, d);
  } catch { /* not granted */ }
  try { localStorage.setItem(DAY, JSON.stringify(day)); } catch { /* private mode */ }

  let added = 0;
  try {
    const { workouts } = await Health.queryWorkouts({ startDate: new Date(now.getTime() - 30 * 86400e3).toISOString(), endDate: now.toISOString(), limit: 100 });
    const existing = await db.activities.toArray();
    const seen = new Set(existing.map((a) => a.meta?.health).filter(Boolean));
    const at = new Date().toISOString();
    const rows: Activity[] = [];
    for (const w of workouts) {
      const key = `health:${w.platformId ?? `${w.startDate}-${w.workoutType}`}`;
      if (seen.has(key)) continue;
      // The phone's own FORGE recordings also reach the health store: skip anything overlapping one of ours.
      const s = new Date(w.startDate).getTime();
      if (existing.some((a) => Math.abs(new Date(a.startedAt).getTime() - s) < 3 * 60e3)) continue;
      const type = WORKOUT_TYPE[w.workoutType] ?? "other";
      const dist = w.totalDistance ?? 0;
      rows.push({
        id: uid(), type, startedAt: w.startDate, endedAt: w.endDate, distanceM: dist, durationSec: Math.round(w.duration), movingSec: Math.round(w.duration),
        avgPaceSecKm: dist > 0 ? w.duration / (dist / 1000) : undefined, elevGainM: 0, points: [], splits: [],
        title: w.sourceName ? `${w.sourceName}` : "Health", xp: 0, kcal: w.totalEnergyBurned ? Math.round(w.totalEnergyBurned) : undefined, kcalSource: "estimate",
        meta: { health: key }, dirty: 1, updatedAt: at,
      } as Activity);
      seen.add(key);
    }
    if (rows.length) {
      await db.activities.bulkPut(rows); added = rows.length;
      // Training done with the watch counts like any other: XP, sparks, streak,
      // challenges. Only the last two weeks pay, so connecting the first time
      // does not dump a month of old workouts into the rank.
      const { awardWatchActivity } = await import("@/lib/progress");
      const recent = Date.now() - 14 * 86400e3;
      for (const a of rows) if (new Date(a.startedAt).getTime() >= recent) {
        const { xp } = await awardWatchActivity(a);
        await db.activities.update(a.id, { xp, dirty: 1 });
      }
    }
  } catch { /* workouts not granted */ }
  // Today's workouts, the watch's or FORGE's own, fuel today's food.
  try { const { applyActivityFuel } = await import("@/lib/nutrition/activityFuel"); await applyActivityFuel(); } catch { /* no plan yet */ }
  return added;
}
