import type { Course } from "./course";

/* ─────────────────────────────────────────────────────────────
   Ground that is actually ground.

   Until now the world stood on one flat plane six kilometres
   across. The road rose and fell over it, which meant a climb
   was a strip of tarmac floating up out of a sheet — you could
   see the gradient on the dial and not in the world. That single
   fact is most of why it did not read as a place.

   This carves the road into a landscape instead: every point on
   the ground takes the height of the nearest piece of road, then
   rises away from it. So a climb has a valley around it, and a
   descent has walls.

   It lives outside the renderer because it is arithmetic, and
   arithmetic can be tested.
   ───────────────────────────────────────────────────────────── */

export interface Terrain {
  /** Grid of heights, row-major, `size` × `size`. */
  heights: Float32Array;
  size: number;
  /** World-space extent the grid covers. */
  minX: number;
  minZ: number;
  width: number;
  depth: number;
}

/** How far past the course the ground extends, metres. */
const MARGIN = 500;
/** Metres either side of the centreline that stay flat — the verge. */
const FLAT_M = 9;
/** Distance over which the ground climbs to full height. */
const RISE_M = 150;

export function buildTerrain(course: Course, size = 96): Terrain {
  const xs = course.points.map((p) => p.x);
  const zs = course.points.map((p) => p.z);
  const minX = Math.min(...xs) - MARGIN;
  const maxX = Math.max(...xs) + MARGIN;
  const minZ = Math.min(...zs) - MARGIN;
  const maxZ = Math.max(...zs) + MARGIN;
  const width = maxX - minX;
  const depth = maxZ - minZ;

  // Every grid vertex searches the road for its nearest point. At full course
  // resolution that is tens of millions of comparisons; every fifth point is
  // fifty metres apart, which is far finer than the ground needs.
  const road = course.points.filter((_, i) => i % 5 === 0);

  const heights = new Float32Array(size * size);
  for (let row = 0; row < size; row++) {
    const z = minZ + (depth * row) / (size - 1);
    for (let col = 0; col < size; col++) {
      const x = minX + (width * col) / (size - 1);

      let nearest = Infinity;
      let roadAlt = 0;
      for (const p of road) {
        const dx = p.x - x, dz = p.z - z;
        const d = dx * dx + dz * dz;
        if (d < nearest) { nearest = d; roadAlt = p.alt; }
      }

      const dist = Math.sqrt(nearest);
      // Smoothstep from the verge outward, so the ground leaves the road
      // gently instead of stepping up off it.
      const t = clamp((dist - FLAT_M) / RISE_M, 0, 1);
      const ease = t * t * (3 - 2 * t);
      heights[row * size + col] = roadAlt - 0.4 + relief(x, z) * ease;
    }
  }

  return { heights, size, minX, minZ, width, depth };
}

/**
 * Rolling relief, in metres above the road.
 *
 * Three wavelengths: long ridges, shorter shoulders, and a fine ripple so a
 * hillside is not a smooth dome. Deterministic in world position, so terrain
 * never shifts between two people riding the same course.
 */
function relief(x: number, z: number): number {
  return (
    38 * Math.sin(x / 620) * Math.cos(z / 540) +
    14 * Math.sin(x / 210 + 1.7) * Math.cos(z / 190 + 0.6) +
    4 * Math.sin(x / 70 + 0.3) * Math.cos(z / 63 + 2.2)
  );
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Where to stand a prop, and how big.
 *
 * Scenery is scattered deterministically from the course, so a rider who
 * rejoins a course finds the same trees in the same places — and two people on
 * it are looking at one world rather than two that happen to share a road.
 */
export interface Placement {
  x: number; y: number; z: number;
  rotation: number;
  scale: number;
}

export function scatter(course: Course, count: number, seed: number): Placement[] {
  const rnd = mulberry(seed);
  const out: Placement[] = [];
  const pts = course.points;

  for (let i = 0; i < count; i++) {
    const p = pts[Math.floor(rnd() * pts.length)];
    const next = pts[Math.min(pts.length - 1, pts.indexOf(p) + 1)] ?? p;

    // Perpendicular to the road, so nothing is ever planted on it.
    const dx = next.x - p.x, dz = next.z - p.z;
    const len = Math.hypot(dx, dz) || 1;
    const nx = -dz / len, nz = dx / len;

    const side = rnd() < 0.5 ? 1 : -1;
    // 7 m clears the verge; the square puts most things near the road and a
    // few far out, which reads as a wood thinning rather than a row.
    const off = 7 + rnd() * rnd() * 90;

    out.push({
      x: p.x + nx * off * side,
      y: p.alt - 0.3,
      z: p.z + nz * off * side,
      rotation: rnd() * Math.PI * 2,
      scale: 0.7 + rnd() * 0.8,
    });
  }
  return out;
}

function mulberry(a: number) {
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashSeed(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
