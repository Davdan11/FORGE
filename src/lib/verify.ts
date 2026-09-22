import type { ActivityType, TrackPoint } from "./types";
import { haversine } from "./geo";
import { sportSpec } from "./data/sports";

/* ─────────────────────────────────────────────────────────────
   Does the track hold together?

   The app cannot prove someone ran; nothing short of a camera can.
   What it can do is refuse to pay for the parts that are not
   effort — the stretch at motorway speed, the twenty minutes
   parked at a café, the GPS jump across town — and award XP on
   what is left.

   The framing matters. This is not an accusation system. It is an
   accounting one: you are credited for the work the data supports,
   and told plainly which part did not count and why. Someone who
   genuinely trains never notices it. Someone driving their route
   gets the distance, and none of the credit.
   ───────────────────────────────────────────────────────────── */

export type FlagKind = "vehicle" | "idle" | "teleport" | "sparse" | "static";

export interface Flag {
  kind: FlagKind;
  /** Seconds or metres removed by this flag, for the explanation. */
  amount: number;
  message: string;
}

export interface Verification {
  verdict: "verified" | "partial" | "unverified";
  /** Seconds where the athlete was actually moving. */
  movingSec: number;
  /** Seconds stopped, excluded from credit. */
  idleSec: number;
  /** Distance over segments that a human doing this sport could produce. */
  verifiedDistanceM: number;
  /** Distance discarded as implausible. */
  discardedDistanceM: number;
  /** 0–1. What share of the effort counts toward XP. */
  credit: number;
  flags: Flag[];
}

/** Below this, the athlete is standing still. */
const MOVING_MS = 0.5;
/** A stop longer than this is a break, not a traffic light. */
const IDLE_GAP_SEC = 90;
/** A sample gap longer than this means the recorder was not watching. */
const SPARSE_GAP_SEC = 120;

const round = (n: number) => Math.round(n);

/**
 * Audit a recorded track against what the sport makes possible.
 * Pure: give it points and a type, it tells you what counts.
 */
export function verifyActivity(points: TrackPoint[], type: ActivityType, elapsedSec?: number): Verification {
  const spec = sportSpec(type);
  const flags: Flag[] = [];

  // Sports with no GPS expectation — a climbing wall, a rink, a mat — are taken
  // at their word on duration. There is nothing in a track to check.
  if (!spec.gps) {
    const sec = round(elapsedSec ?? 0);
    return { verdict: "verified", movingSec: sec, idleSec: 0, verifiedDistanceM: 0, discardedDistanceM: 0, credit: 1, flags };
  }

  if (points.length < 2) {
    const sec = round(elapsedSec ?? 0);
    if (sec > 60) flags.push({ kind: "sparse", amount: sec, message: "No usable GPS track was recorded for this activity." });
    return { verdict: sec > 60 ? "unverified" : "verified", movingSec: 0, idleSec: sec, verifiedDistanceM: 0, discardedDistanceM: 0, credit: 0, flags };
  }

  let movingMs = 0, idleMs = 0, sparseMs = 0;
  let verifiedM = 0, discardedM = 0, teleportM = 0, vehicleMs = 0;

  for (let i = 1; i < points.length; i++) {
    const d = haversine(points[i - 1], points[i]);
    const dtMs = points[i].t - points[i - 1].t;
    if (dtMs <= 0) continue;
    const dtSec = dtMs / 1000;
    const v = d / dtSec;

    // A jump of kilometres between two samples seconds apart is a GPS error or
    // a different vehicle entirely; it is never distance covered.
    if (v > spec.ceilingMs * 3 && d > 300) {
      teleportM += d; discardedM += d; continue;
    }
    if (v > spec.ceilingMs) {
      discardedM += d; vehicleMs += dtMs; continue;
    }
    if (dtSec > SPARSE_GAP_SEC) { sparseMs += dtMs; continue; }
    if (v < MOVING_MS) {
      idleMs += dtMs;
      continue;
    }
    movingMs += dtMs;
    verifiedM += d;
  }

  const movingSec = round(movingMs / 1000);
  const idleSec = round((idleMs + sparseMs) / 1000);

  if (vehicleMs > 0) {
    flags.push({
      kind: "vehicle", amount: round(discardedM - teleportM),
      message: `${round((discardedM - teleportM) / 10) / 100} km was covered faster than ${spec.label.toLowerCase()} allows and doesn't count.`,
    });
  }
  if (teleportM > 0) {
    flags.push({ kind: "teleport", amount: round(teleportM), message: "The track jumps between distant points — those gaps were dropped." });
  }
  if (idleMs / 1000 > IDLE_GAP_SEC) {
    flags.push({ kind: "idle", amount: round(idleMs / 1000), message: `${Math.round(idleMs / 60000)} min stopped. Breaks don't count toward the effort.` });
  }
  if (sparseMs / 1000 > SPARSE_GAP_SEC) {
    flags.push({ kind: "sparse", amount: round(sparseMs / 1000), message: "The recorder lost signal for a stretch, which was left out." });
  }
  if (movingSec > 60 && verifiedM < 20) {
    flags.push({ kind: "static", amount: movingSec, message: "The timer ran but the device barely moved." });
  }

  // Credit is the share of the elapsed activity that survived the audit.
  const total = movingSec + idleSec;
  const credit = total > 0 ? Math.max(0, Math.min(1, movingSec / total)) : 0;
  const verdict: Verification["verdict"] =
    flags.some((f) => f.kind === "vehicle" || f.kind === "teleport" || f.kind === "static") ? "unverified"
      : flags.length > 0 ? "partial"
        : "verified";

  return { verdict, movingSec, idleSec, verifiedDistanceM: round(verifiedM), discardedDistanceM: round(discardedM), credit, flags };
}

/** One line for the activity card. */
export function verdictLabel(v: Verification) {
  switch (v.verdict) {
    case "verified": return "Verified effort";
    case "partial": return "Partly credited";
    default: return "Not credited";
  }
}
