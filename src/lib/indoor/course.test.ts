import { describe, it, expect } from "vitest";
import { generateCourse, courseFromActivity, at } from "./course";
import { TRIM_M } from "../social/privacy";
import type { Activity, TrackPoint } from "../types";

const ride = (points: TrackPoint[]): Activity => ({
  id: "a1", type: "ride", startedAt: "2026-01-05T09:00:00.000Z",
  distanceM: 0, durationSec: 3600, elevGainM: 0, points, splits: [],
  title: "Morning ride", xp: 0,
});

/** A straight road climbing steadily away from a fixed origin. */
function climb(metres: number, gradient: number, stepM = 10): TrackPoint[] {
  const pts: TrackPoint[] = [];
  for (let d = 0; d <= metres; d += stepM) {
    pts.push({ t: d * 200, lat: 45.5 + d / 111_320, lng: -73.6, alt: 100 + d * gradient });
  }
  return pts;
}

describe("generateCourse", () => {
  it("makes a course about the length asked for", () => {
    const c = generateCourse({ id: "vallee", name: "Vallée", lengthM: 10_000, hilliness: 0.5 });
    expect(c.lengthM).toBeGreaterThan(8_000);
    expect(c.lengthM).toBeLessThan(13_000);
  });

  it("is a loop, so laps work", () => {
    const c = generateCourse({ id: "vallee", name: "Vallée", lengthM: 8_000, hilliness: 0.5 });
    expect(c.loop).toBe(true);
  });

  it("closes in height as well as in shape", () => {
    // A loop that drops four metres a lap is a perpetual motion machine, and
    // after twenty laps the rider is below sea level.
    const c = generateCourse({ id: "boucle", name: "Boucle", lengthM: 12_000, hilliness: 0.8 });
    const first = c.points[0], last = c.points[c.points.length - 1];
    expect(Math.abs(last.alt - first.alt)).toBeLessThan(3);
  });

  it("gives the same road for the same id, every time", () => {
    // Two riders on the same course must be on the same hill.
    const a = generateCourse({ id: "mont", name: "Mont", lengthM: 9_000, hilliness: 0.7 });
    const b = generateCourse({ id: "mont", name: "Mont", lengthM: 9_000, hilliness: 0.7 });
    expect(b.points.map((p) => Math.round(p.alt))).toEqual(a.points.map((p) => Math.round(p.alt)));
  });

  it("gives a different road for a different id", () => {
    const a = generateCourse({ id: "mont", name: "A", lengthM: 9_000, hilliness: 0.7 });
    const b = generateCourse({ id: "plaine", name: "B", lengthM: 9_000, hilliness: 0.7 });
    expect(b.points.map((p) => Math.round(p.alt))).not.toEqual(a.points.map((p) => Math.round(p.alt)));
  });

  it("climbs more when asked to be hillier", () => {
    const flat = generateCourse({ id: "x", name: "x", lengthM: 10_000, hilliness: 0.1 });
    const steep = generateCourse({ id: "x", name: "x", lengthM: 10_000, hilliness: 1 });
    expect(steep.elevGainM).toBeGreaterThan(flat.elevGainM * 3);
  });

  it("never produces a gradient no road could have", () => {
    const c = generateCourse({ id: "alpe", name: "Alpe", lengthM: 6_000, hilliness: 1 });
    for (const p of c.points) {
      expect(Math.abs(p.gradient)).toBeLessThanOrEqual(0.3);
      expect(Number.isFinite(p.gradient)).toBe(true);
    }
  });
});

describe("courseFromActivity", () => {
  it("turns a recorded ride into something rideable", () => {
    const c = courseFromActivity(ride(climb(4_000, 0.05)));
    expect(c).not.toBeNull();
    expect(c!.lengthM).toBeGreaterThan(3_000);
  });

  it("reads the gradient of a steady climb correctly", () => {
    const c = courseFromActivity(ride(climb(4_000, 0.06)))!;
    const middle = c.points.slice(20, -20);
    const avg = middle.reduce((s, p) => s + p.gradient, 0) / middle.length;
    expect(avg).toBeCloseTo(0.06, 2);
  });

  it("carries no geography at all", () => {
    // Not latitude, not longitude, not a place. A course is meant to be
    // shared, and geography is what makes that dangerous.
    const c = courseFromActivity(ride(climb(4_000, 0.04)))!;
    const json = JSON.stringify(c);
    expect(json).not.toMatch(/lat|lng|-73\.6|45\.5/);
    expect(Object.keys(c.points[0]).sort()).toEqual(["alt", "d", "gradient", "x", "z"]);
  });

  it("trims the ends by default, like a published route", () => {
    const track = climb(4_000, 0.04);
    const c = courseFromActivity(ride(track))!;
    // The course starts relative to its own first point, so check that the
    // ground it covers is shorter than the ride by roughly two trims.
    expect(c.lengthM).toBeLessThan(4_000 - TRIM_M);
  });

  it("keeps the whole ride when trimming is explicitly turned off", () => {
    const track = climb(4_000, 0.04);
    const kept = courseFromActivity(ride(track), { trim: false })!;
    const trimmed = courseFromActivity(ride(track))!;
    expect(kept.lengthM).toBeGreaterThan(trimmed.lengthM + TRIM_M);
  });

  it("returns null for a ride too short to make a course from", () => {
    expect(courseFromActivity(ride(climb(200, 0.02)))).toBeNull();
    expect(courseFromActivity(ride([]))).toBeNull();
  });

  it("survives a track with no altitude at all", () => {
    const noAlt = climb(3_000, 0).map((p) => { const q = { ...p }; delete q.alt; return q; });
    const c = courseFromActivity(ride(noAlt));
    expect(c).not.toBeNull();
    expect(c!.elevGainM).toBe(0);
    for (const p of c!.points) expect(Number.isFinite(p.alt)).toBe(true);
  });

  it("does not turn GPS altitude noise into a wall", () => {
    // Real barometric altitude jitters by metres between samples. Differentiated
    // raw, a flat road becomes a series of 30% ramps.
    const noisy = climb(3_000, 0).map((p, i) => ({ ...p, alt: 100 + (i % 2 ? 3 : -3) }));
    const c = courseFromActivity(ride(noisy))!;
    const worst = Math.max(...c.points.map((p) => Math.abs(p.gradient)));
    expect(worst).toBeLessThan(0.05);
  });
});

describe("at — where the rider is", () => {
  const loop = generateCourse({ id: "boucle", name: "Boucle", lengthM: 10_000, hilliness: 0.6 });

  it("wraps past the end of a loop, so laps happen by themselves", () => {
    const start = at(loop, 0);
    const lapLater = at(loop, loop.lengthM);
    expect(lapLater.x).toBeCloseTo(start.x, 0);
    expect(lapLater.z).toBeCloseTo(start.z, 0);
  });

  it("handles a rider who has gone backwards past zero", () => {
    expect(() => at(loop, -500)).not.toThrow();
    expect(at(loop, -500).d).toBeGreaterThanOrEqual(0);
  });

  it("interpolates between points rather than snapping", () => {
    const a = at(loop, 1000), b = at(loop, 1005), c = at(loop, 1010);
    expect(b.d).toBe(1005);
    // The midpoint sits between its neighbours, not on top of one of them.
    expect(Math.min(a.x, c.x)).toBeLessThanOrEqual(b.x + 1e-6);
    expect(Math.max(a.x, c.x)).toBeGreaterThanOrEqual(b.x - 1e-6);
  });

  it("clamps on a point-to-point course instead of teleporting to the start", () => {
    const line = courseFromActivity(ride(climb(5_000, 0.05)))!;
    expect(line.loop).toBe(false);
    expect(at(line, 999_999).d).toBeCloseTo(line.lengthM, 0);
  });
});
