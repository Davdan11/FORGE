import type { TrackPoint } from "../types";
import { haversine } from "../geo";

/* ─────────────────────────────────────────────────────────────
   What leaves the device when a route is published.

   The rule given was: never show where someone is in real time —
   only the route, once the activity is logged. That rule is kept,
   and it is not enough on its own, because a raw trace says more
   than a live dot ever does.

   A live dot is one moment. A published route is permanent, and
   it repeats: post the same loop twenty times and the point every
   one of them begins at is not a coincidence, it is a front door.
   So three things happen here, and none of them are optional:

     1. The ends are cut. The first and last stretch of every
        published route is dropped, so the trace starts once you
        are already down the street.
     2. The shape is coarsened. Points are thinned to the shape of
        the route, not the metre-by-metre record of it.
     3. Position becomes a neighbourhood. The "near you" feed
        matches on a grid cell several kilometres wide, derived
        from the middle of the trimmed route — never its start.
        No precise coordinate is ever sent for matching.

   Everything below is pure: it takes a track and returns what is
   safe to publish. Nothing here talks to a network, so what gets
   sent is exactly what these functions return.
   ───────────────────────────────────────────────────────────── */

/** Metres removed from each end of a published route. */
export const TRIM_M = 250;

/** Grid size for the local feed, in degrees. ~11 km tall; ~8 km wide at 45°N. */
export const CELL_DEG = 0.1;

/** A published route is a bare [lat, lng] list — no timestamps, no altitude,
 *  no accuracy, no heart rate. Anything not needed to draw the line is not
 *  something the feed has any business holding. */
export type PublicRoute = [number, number][];

/**
 * Drop the first and last `metres` of a track.
 *
 * Returns an empty array when the route is too short to survive the cut: a
 * 400 m jog around the block trimmed at both ends is nothing but the block
 * it started on, which is the one thing we are trying not to publish. Such
 * an activity can still be shared — as numbers, with no map.
 */
export function trimEndpoints(points: TrackPoint[], metres = TRIM_M): TrackPoint[] {
  if (points.length < 2) return [];

  // Walk in from the start until `metres` of ground is behind us.
  let head = 0;
  for (let d = 0; head < points.length - 1 && d < metres; head++) d += haversine(points[head], points[head + 1]);

  // And in from the end.
  let tail = points.length - 1;
  for (let d = 0; tail > 0 && d < metres; tail--) d += haversine(points[tail - 1], points[tail]);

  // `tail` is exclusive of the trimmed portion, so it must stay ahead of head
  // by enough points to draw a line at all.
  if (tail - head < 2) return [];
  return points.slice(head, tail + 1);
}

/**
 * Ramer–Douglas–Peucker, iterative so a long track cannot blow the stack.
 * `tolerance` is in metres: a point is kept only when dropping it would move
 * the line by more than that.
 */
export function simplify(points: TrackPoint[], toleranceM = 12): TrackPoint[] {
  if (points.length < 3) return points.slice();

  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;

  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop()!;
    let worst = 0;
    let index = -1;
    for (let i = first + 1; i < last; i++) {
      const d = perpendicularM(points[i], points[first], points[last]);
      if (d > worst) { worst = d; index = i; }
    }
    if (index !== -1 && worst > toleranceM) {
      keep[index] = 1;
      stack.push([first, index], [index, last]);
    }
  }

  return points.filter((_, i) => keep[i] === 1);
}

/** Distance from `p` to the segment `a`–`b`, in metres. */
function perpendicularM(p: TrackPoint, a: TrackPoint, b: TrackPoint): number {
  // Project onto a local flat plane. Over the span of one segment the error is
  // far below the tolerances we care about, and it avoids trigonometry per point.
  const mLat = 111_320;
  const mLng = 111_320 * Math.cos((a.lat * Math.PI) / 180);
  const ax = a.lng * mLng, ay = a.lat * mLat;
  const bx = b.lng * mLng, by = b.lat * mLat;
  const px = p.lng * mLng, py = p.lat * mLat;

  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(px - ax, py - ay);

  // Clamped projection: a point beyond either end measures to that end.
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/**
 * The grid cell a coordinate falls in. Several kilometres wide, so it names a
 * neighbourhood and cannot name a street. This is the only location the feed
 * ever stores.
 */
export function cellOf(lat: number, lng: number): string {
  const q = (v: number) => Math.floor(v / CELL_DEG);
  return `${q(lat)}:${q(lng)}`;
}

/**
 * The cell a coordinate is in, plus its eight neighbours.
 *
 * Without this the feed has a hard edge: someone training two streets away
 * but across a grid line would never appear, which reads as the feature being
 * broken rather than as a boundary nobody can see.
 */
export function cellsAround(lat: number, lng: number): string[] {
  const la = Math.floor(lat / CELL_DEG);
  const ln = Math.floor(lng / CELL_DEG);
  const out: string[] = [];
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) out.push(`${la + i}:${ln + j}`);
  return out;
}

/**
 * Everything a track contributes to a post: the drawable line and the
 * neighbourhood it happened in.
 *
 * The cell comes from the midpoint of the *trimmed* route. Taking it from the
 * start would undo the trim — a coarse cell centred on your house is still
 * centred on your house, and enough posts would average out to it.
 */
export function publishableRoute(points: TrackPoint[], trimM = TRIM_M): { route: PublicRoute; cell: string | null } {
  const trimmed = trimEndpoints(points, trimM);
  if (trimmed.length < 2) return { route: [], cell: null };

  const thinned = simplify(trimmed, 12);
  // A cap on top of the tolerance: a 200 km ride simplified at 12 m is still
  // thousands of points, and the feed draws these at thumbnail size.
  const route = decimate(thinned, 240).map((p) => [round5(p.lat), round5(p.lng)] as [number, number]);

  const mid = trimmed[Math.floor(trimmed.length / 2)];
  return { route, cell: cellOf(mid.lat, mid.lng) };
}

/**
 * Project a published route into an SVG path inside a `size`×`size` box.
 *
 * Lives here, away from the component that draws it, because the ways this can
 * be wrong are silent ones: a route stretched to fill the box is a different
 * route, and latitude increasing upward while SVG y increases downward will
 * happily render every loop upside down. Both are invisible in a screenshot of
 * an unfamiliar city and obvious in a test.
 */
export function routePath(route: PublicRoute, size = 100, pad = 8): string {
  if (route.length < 2) return "";

  const lats = route.map((p) => p[0]);
  const lngs = route.map((p) => p[1]);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);

  // A degree of longitude is shorter than a degree of latitude everywhere but
  // the equator. Ignoring that draws a Québec loop about a third too wide.
  const latScale = Math.cos(((minLat + maxLat) / 2) * Math.PI / 180);
  const w = Math.max((maxLng - minLng) * latScale, 1e-9);
  const h = Math.max(maxLat - minLat, 1e-9);

  // One scale for both axes: the shape keeps its proportions.
  const inner = size - pad * 2;
  const s = inner / Math.max(w, h);
  const ox = pad + (inner - w * s) / 2;
  const oy = pad + (inner - h * s) / 2;

  return route
    // `maxLat - lat` flips the axis: north belongs at the top.
    .map((p, i) => `${i ? "L" : "M"}${(ox + (p[1] - minLng) * latScale * s).toFixed(2)} ${(oy + (maxLat - p[0]) * s).toFixed(2)}`)
    .join(" ");
}

/** Evenly drop points until at most `max` remain, keeping both ends. */
function decimate<T>(xs: T[], max: number): T[] {
  if (xs.length <= max) return xs;
  const step = (xs.length - 1) / (max - 1);
  const out: T[] = [];
  for (let i = 0; i < max; i++) out.push(xs[Math.round(i * step)]);
  return out;
}

/** ~1 m of precision. Publishing 14 decimal places would be a claim to
 *  accuracy no consumer GPS has, and it triples the size of every route. */
const round5 = (v: number) => Math.round(v * 1e5) / 1e5;
