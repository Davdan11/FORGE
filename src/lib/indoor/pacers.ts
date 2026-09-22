import { ROAD_BIKE, step, type Bike } from "./physics";
import type { Course } from "./course";
import { at } from "./course";

/* ─────────────────────────────────────────────────────────────
   Pacers.

   A course with one rider on it is a corridor. There is nothing
   to chase, nothing to be passed by, and no answer to "how am I
   doing" beyond a number on a dial.

   These are robots and they are labelled as robots, on the road
   and in the standings. That distinction is not decoration: a
   bot presented as a person is a lie, and a leaderboard with
   invented people on it is worthless the day somebody notices.
   Zwift reached the same conclusion and calls them Pace
   Partners. Ours say "bot" wherever a name appears.

   Each holds a steady watts-per-kilogram, which is how cyclists
   actually talk about pace, and each is pushed through the same
   physics as the athlete — so a pacer slows on the climbs too,
   and holding their wheel up a hill is genuinely hard.
   ───────────────────────────────────────────────────────────── */

export interface PacerSpec {
  id: string;
  name: string;
  /** Watts per kilogram held on the flat and up the hills alike. */
  wPerKg: number;
  /** Rider mass, kg — a light pacer climbs away from a heavy one. */
  massKg: number;
}

export const PACERS: PacerSpec[] = [
  { id: "pace-easy", name: "Robin", wPerKg: 1.6, massKg: 72 },
  { id: "pace-steady", name: "Marceau", wPerKg: 2.3, massKg: 78 },
  { id: "pace-hard", name: "Ines", wPerKg: 3.1, massKg: 63 },
];

export interface PacerState {
  spec: PacerSpec;
  bike: Bike;
  watts: number;
  speedMs: number;
  distanceM: number;
}

/**
 * Line them up.
 *
 * Staggered down the road rather than started together, so the first thing on
 * screen is a road with people on it rather than a wall of three avatars.
 */
export function startPacers(): PacerState[] {
  return PACERS.map((spec, i) => ({
    spec,
    bike: ROAD_BIKE(spec.massKg),
    watts: Math.round(spec.wPerKg * spec.massKg),
    speedMs: 0,
    // The strongest starts furthest back: catching Ines should mean something.
    distanceM: 240 - i * 110,
  }));
}

/* ── running pacers ──────────────────────────────────────────
   Runners hold a pace, not a power. On a climb the same effort is
   slower: roughly 4 % of speed per 1 % of gradient uphill, a little
   faster downhill until the legs brake (Minetti's cost of running on
   a slope, flattened to what a pacer needs). */
export const RUN_PACERS = [
  { id: "run-easy", name: "Robin", kmh: 8.5 },
  { id: "run-steady", name: "Marceau", kmh: 10.5 },
  { id: "run-hard", name: "Ines", kmh: 13 },
];

export interface RunPacerState { spec: { id: string; name: string; kmh: number }; speedMs: number; distanceM: number }

export function startRunPacers(): RunPacerState[] {
  return RUN_PACERS.map((spec, i) => ({ spec, speedMs: 0, distanceM: 120 - i * 50 }));
}

/** Pace on a slope: `gradient` is rise over run. */
export function runSpeedOnGrade(flatMs: number, gradient: number) {
  const f = gradient >= 0 ? 1 / (1 + 4 * gradient) : Math.min(1.12, 1 - 2 * gradient);
  return flatMs * f;
}

export function stepRunPacers(pacers: RunPacerState[], course: Course, dt: number) {
  for (const p of pacers) {
    const target = runSpeedOnGrade(p.spec.kmh / 3.6, at(course, p.distanceM).gradient);
    // Ease toward the target: nobody changes pace in a single frame.
    p.speedMs += (target - p.speedMs) * Math.min(1, dt * 0.8);
    p.distanceM += p.speedMs * dt;
  }
}

/** Advance every pacer one tick of the same physics the athlete rides. */
export function stepPacers(pacers: PacerState[], course: Course, dt: number) {
  for (const p of pacers) {
    const here = at(course, p.distanceM);
    p.speedMs = step(p.speedMs, p.watts, here.gradient, p.bike, dt);
    p.distanceM += p.speedMs * dt;
  }
}

/**
 * Where the athlete sits in the bunch, one-indexed.
 *
 * Distance along the course is the only ordering that means anything here:
 * everyone is on the same road, so whoever is furthest along is ahead.
 */
export function placeInBunch(mine: number, pacers: { distanceM: number }[]): { position: number; of: number } {
  const ahead = pacers.filter((p) => p.distanceM > mine).length;
  return { position: ahead + 1, of: pacers.length + 1 };
}

/** Gap to the rider immediately ahead, in metres, or null when leading. */
export function gapToNext(mine: number, pacers: { distanceM: number }[]): number | null {
  const ahead = pacers.filter((p) => p.distanceM > mine).map((p) => p.distanceM - mine);
  return ahead.length ? Math.min(...ahead) : null;
}
