import type { Activity, TrackPoint } from "../types";
import { haversine } from "../geo";
import { trimEndpoints } from "../social/privacy";

/* ─────────────────────────────────────────────────────────────
   Courses to ride indoors.

   Two sources. One is invented — a ribbon of road generated from
   a seed, which is how somebody gets a mountain to climb on
   their first evening. The other is a route somebody actually
   rode outside, which is the interesting one: it means every
   real ride in the app is a course waiting to be ridden again in
   winter, and Zwift cannot do that.

   A course carries NO geography. Not latitude, not longitude,
   not a place name — only metres from the start, a shape, and a
   height profile. That is partly because the renderer has no use
   for anything else, and mostly because a course is meant to be
   shared, and a shared course built from a real ride would
   otherwise be a map of where its author lives. The same trim
   that protects a published route protects a published course.
   ───────────────────────────────────────────────────────────── */

export interface CoursePoint {
  /** Metres travelled from the start. */
  d: number;
  /** Metres above the course's lowest point. */
  alt: number;
  /** Position on the ground, in metres, relative to the start. */
  x: number;
  z: number;
  /** Rise over run at this point, smoothed. 0.08 is an eight percent climb. */
  gradient: number;
}

export interface Course {
  id: string;
  name: string;
  lengthM: number;
  elevGainM: number;
  points: CoursePoint[];
  /** True when the end meets the start, so laps make sense. */
  loop: boolean;
}

/** Spacing between course points. Ten metres is finer than any gradient a
 *  rider can feel and coarse enough that a 40 km course stays 4,000 points. */
const STEP_M = 10;

/* ── from a real ride ─────────────────────────────────────── */

/**
 * Build a course from an activity someone recorded outdoors.
 *
 * `trim` defaults on, and should only ever be turned off for a course that
 * stays on the device. The moment a course can be shared, its first and last
 * few hundred metres are the author's street.
 */
export function courseFromActivity(a: Activity, opts: { trim?: boolean } = {}): Course | null {
  const points = opts.trim === false ? a.points : trimEndpoints(a.points);
  if (points.length < 2) return null;

  const flat = project(points);
  if (flat.length < 2) return null;

  const resampled = resample(flat, STEP_M);
  if (resampled.length < 2) return null;

  return finish(resampled, a.id, a.title);
}

/** Longitude and latitude to metres on a flat plane, relative to the first
 *  point. Over a few tens of kilometres the distortion is far below anything
 *  a rider could notice, and it drops the coordinates on the floor, which is
 *  the point. */
function project(points: TrackPoint[]): { x: number; z: number; alt: number; d: number }[] {
  const lat0 = points[0].lat;
  const mLat = 111_320;
  const mLng = 111_320 * Math.cos((lat0 * Math.PI) / 180);

  let d = 0;
  const out: { x: number; z: number; alt: number; d: number }[] = [];
  for (let i = 0; i < points.length; i++) {
    if (i > 0) d += haversine(points[i - 1], points[i]);
    out.push({
      x: (points[i].lng - points[0].lng) * mLng,
      z: (points[i].lat - lat0) * mLat,
      // A track with no barometer has no altitude. A flat course is a real
      // course; a course full of NaN is a crash.
      alt: points[i].alt ?? 0,
      d,
    });
  }
  return out;
}

/* ── invented ─────────────────────────────────────────────── */

/**
 * A generated loop.
 *
 * Sums of sines at different wavelengths, which is the cheapest thing that
 * produces terrain a rider reads as terrain: long climbs with shorter rolls
 * on top, rather than one even ramp. Every wavelength divides the loop length
 * so the end meets the start — both in shape and in height, because a course
 * that drops four metres per lap is a perpetual motion machine.
 */
export function generateCourse(opts: { id: string; name: string; lengthM: number; hilliness: number; seed?: number }): Course {
  const { id, name, lengthM, hilliness } = opts;
  const seed = opts.seed ?? hash(id);
  const rnd = mulberry(seed);

  const n = Math.max(8, Math.round(lengthM / STEP_M));
  const radius = lengthM / (2 * Math.PI);

  // Three shape harmonics turn a circle into something that reads as a road.
  const shape = [1, 2, 3].map((k) => ({ k: k + 1, amp: (0.08 + rnd() * 0.16) / k, phase: rnd() * Math.PI * 2 }));
  // Height harmonics: integer cycles per lap, so altitude closes.
  const hills = [1, 2, 4, 7].map((k) => ({ k, amp: (hilliness * 60) / k, phase: rnd() * Math.PI * 2 }));

  const raw: { x: number; z: number; alt: number; d: number }[] = [];
  let d = 0;
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    const r = radius * (1 + shape.reduce((s, h) => s + h.amp * Math.sin(h.k * t + h.phase), 0));
    const x = Math.cos(t) * r;
    const z = Math.sin(t) * r;
    const alt = hills.reduce((s, h) => s + h.amp * Math.sin(h.k * t + h.phase), 0);
    if (i > 0) d += Math.hypot(x - raw[i - 1].x, z - raw[i - 1].z);
    raw.push({ x, z, alt, d });
  }
  // Close the ring by repeating the first point at the far end.
  raw.push({ ...raw[0], d: d + Math.hypot(raw[0].x - raw[n - 1].x, raw[0].z - raw[n - 1].z) });

  return finish(resample(raw, STEP_M), id, name);
}

/* ── shared tail ──────────────────────────────────────────── */

/** Walk the polyline emitting a point every `step` metres. */
function resample<T extends { x: number; z: number; alt: number; d: number }>(src: T[], step: number) {
  const total = src[src.length - 1].d;
  if (total < step * 2) return [];

  const out: { x: number; z: number; alt: number; d: number }[] = [];
  let j = 0;
  for (let d = 0; d <= total; d += step) {
    while (j < src.length - 2 && src[j + 1].d < d) j++;
    const a = src[j], b = src[j + 1] ?? a;
    const span = b.d - a.d;
    const f = span <= 0 ? 0 : (d - a.d) / span;
    out.push({ x: a.x + (b.x - a.x) * f, z: a.z + (b.z - a.z) * f, alt: a.alt + (b.alt - a.alt) * f, d });
  }
  return out;
}

function finish(pts: { x: number; z: number; alt: number; d: number }[], id: string, name: string): Course {
  // GPS altitude is noisy by several metres from one sample to the next.
  // Differentiated raw, it produces gradients of ±30% on flat ground and the
  // ride becomes a series of walls. Smooth first, then differentiate.
  const alt = smooth(pts.map((p) => p.alt), 7);
  const low = Math.min(...alt);

  const points: CoursePoint[] = pts.map((p, i) => {
    const a = alt[Math.max(0, i - 2)];
    const b = alt[Math.min(alt.length - 1, i + 2)];
    const run = pts[Math.min(pts.length - 1, i + 2)].d - pts[Math.max(0, i - 2)].d;
    return {
      d: p.d,
      alt: alt[i] - low,
      x: p.x,
      z: p.z,
      // Clamped: no rideable road exceeds 30%, and a GPS spike that says 80%
      // would stop the avatar dead.
      gradient: run > 0 ? clamp((b - a) / run, -0.3, 0.3) : 0,
    };
  });

  let elevGainM = 0;
  for (let i = 1; i < points.length; i++) {
    const up = points[i].alt - points[i - 1].alt;
    if (up > 0) elevGainM += up;
  }

  const first = points[0], last = points[points.length - 1];
  const loop = Math.hypot(last.x - first.x, last.z - first.z) < 60;

  return { id, name, lengthM: last.d, elevGainM, points, loop };
}

/** Where on the course is a rider who has travelled `d` metres. Wraps on a
 *  loop, so laps happen by themselves; clamps on a point-to-point. */
export function at(course: Course, d: number): CoursePoint {
  const len = course.lengthM;
  const along = course.loop ? ((d % len) + len) % len : clamp(d, 0, len);
  const i = clamp(Math.floor(along / STEP_M), 0, course.points.length - 2);
  const a = course.points[i], b = course.points[i + 1];
  const span = b.d - a.d;
  const f = span <= 0 ? 0 : (along - a.d) / span;
  return {
    d: along,
    alt: a.alt + (b.alt - a.alt) * f,
    x: a.x + (b.x - a.x) * f,
    z: a.z + (b.z - a.z) * f,
    gradient: a.gradient + (b.gradient - a.gradient) * f,
  };
}

function smooth(xs: number[], window: number): number[] {
  const half = Math.floor(window / 2);
  return xs.map((_, i) => {
    let sum = 0, n = 0;
    for (let j = Math.max(0, i - half); j <= Math.min(xs.length - 1, i + half); j++) { sum += xs[j]; n++; }
    return sum / n;
  });
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Deterministic PRNG, so a course id always generates the same road. Two
 *  riders on "Vallée" must be on the same hill. */
function mulberry(a: number) {
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
