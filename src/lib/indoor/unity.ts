/* ─────────────────────────────────────────────────────────────
   The Unity indoor game, seen from the app.

   Unity draws the world and runs the ride; the app keeps what it
   always kept: Bluetooth, trainer control, the account, XP and
   saving, and the rooms where real people ride together. The two
   talk in JSON (the contract is written at the top of
   ForgeBridge.cs in the FORGE-Unity repo):

     app → game   sample, profile, riders, reward, palmares, look,
                  unlocks, events, challenge, command
     game → app   ready, grade, ergTarget, position, checkpoint,
                  segment, finish, end, profileUpdate, look,
                  palmares, event, challenge

   Everything here is pure, so it is tested without a browser.
   ───────────────────────────────────────────────────────────── */

import { levelFromXp, rankFor } from "../gamification";
import { extrapolate, type Peer } from "./live";

/** A ride summary as the game sends it at the line ("finish") or when the rider stops ("end"). */
export interface UnitySummary {
  type: "finish" | "end";
  routeId: number;
  route: string;
  completed: boolean;
  distance: number;
  elapsed: number;
  ascent: number;
  avgSpeedKph: number;
  avgWatts: number;
  normalizedWatts: number | null;
  maxWatts: number;
  avgHeartRate: number | null;
  maxHeartRate: number;
  avgCadence: number | null;
  kilojoules: number;
  draftShare: number;
  event: string | null;
}

export type UnityMessage =
  | { type: "ready"; lang?: "fr" | "en"; routeId: number; route: string; routes: { id: number; key: string; name: string; country: string; lengthKm: number; ascent: number }[] }
  | { type: "grade"; grade: number }
  | { type: "ergTarget"; watts: number | null }
  | { type: "position"; routeId: number; route: string; distance: number; speedKph: number; elapsed: number; draft: number; altitude: number; category: string; paused: boolean }
  | { type: "checkpoint"; number: number; distance: number }
  | { type: "segment"; key: string; length: number; name: string; kind: string; seconds: number; medal: string }
  | { type: "kudos"; to: string }
  | UnitySummary
  | { type: "profileUpdate"; weightKg: number; ftp: number }
  | { type: "look"; look: string }
  | { type: "palmares"; data: unknown }
  | { type: "event"; action: "join" | "leave" | "start"; id: string; route: string; start: number; kind: "group" | "race"; category: string }
  | { type: "challenge"; action: string; code: string; route?: string; routeName?: string; seconds?: number; won?: boolean };

/**
 * The room a Unity rider shares. Riders of the Unity world and of the
 * Three.js world see different roads, so they never share a room; riders in
 * the same event share one room whatever else is happening on that route.
 */
export function unityRoom(route: string, event?: string | null, raceCategory?: string | null): string {
  // A race is run per category (A/B/C/D), so each category gets its own room.
  return event ? `unity-event:${event}${raceCategory ? `:${raceCategory}` : ""}` : `unity:${route}`;
}

const TAGS = ["#FF6F9C", "#5C9EFF", "#FFA23F", "#74EB8A", "#B07CFF", "#2EF0DE", "#FFD23F", "#FF5A5A"];
/** A stable name-tag colour for someone who did not send one. */
export function colorFor(id: string): string {
  let h = 17;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return TAGS[h % TAGS.length];
}

/** The people in the room, where they are now, as the game's "riders" message. */
export function ridersMessage(peers: Iterable<Peer>, now: number) {
  const riders = [];
  for (const p of peers) {
    riders.push({
      id: `p-${p.id}`,
      name: p.name,
      country: "",
      distance: Math.round(extrapolate(p, now) * 10) / 10,
      speedKph: Math.round(p.speedMs * 3.6 * 10) / 10,
      color: p.color ?? colorFor(p.id),
      look: p.look ?? "",
      // Only an effort their app measured counts in results; the game shows a check mark.
      verified: p.quality === "m",
      category: p.category ?? "",
    });
  }
  return { type: "riders", riders };
}

/** Who the rider is, for the game: weight and FTP for the physics, and the progression the app counts. */
export function profileMessage(p: { name: string; weightKg: number; ftpW: number }, totalXp: number) {
  const lv = levelFromXp(totalXp);
  return {
    type: "profile",
    name: p.name.trim().split(/\s+/)[0] ?? "",
    weightKg: Math.round(p.weightKg),
    ftp: Math.round(p.ftpW),
    level: lv.level,
    levelXp: Math.round(lv.into),
    levelNeed: lv.need,
    totalXp: Math.round(totalXp),
    rank: rankFor(lv.level),
  };
}

/** The XP just counted for a ride, and where it leaves the rider. */
export function rewardMessage(gained: number, totalBefore: number) {
  const before = levelFromXp(totalBefore), after = levelFromXp(totalBefore + gained);
  return {
    type: "reward",
    xp: Math.round(gained),
    level: after.level,
    levelXp: Math.round(after.into),
    levelNeed: after.need,
    rank: rankFor(after.level),
    levelUp: after.level > before.level,
  };
}

/** Splits from the game's position reports: one entry each time a new kilometre is crossed. */
export function addSplits(splits: { km: number; sec: number }[], distanceM: number, elapsedSec: number, lastSplitSec: number): number {
  let last = lastSplitSec;
  while (distanceM >= (splits.length + 1) * 1000) {
    splits.push({ km: splits.length + 1, sec: Math.round(elapsedSec - last) });
    last = elapsedSec;
  }
  return last;
}
