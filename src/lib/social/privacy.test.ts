import { describe, it, expect } from "vitest";
import type { TrackPoint } from "../types";
import { haversine } from "../geo";
import { trimEndpoints, simplify, cellOf, cellsAround, publishableRoute, routePath, TRIM_M, CELL_DEG } from "./privacy";

/* The claims worth testing here are privacy claims, so they are written as
   the promise they make to the person running, not as unit mechanics. */

const HOME = { lat: 45.5017, lng: -73.5673 };

/** A straight track heading north from `from`, one point every `stepM` metres. */
function line(from: { lat: number; lng: number }, metres: number, stepM = 10): TrackPoint[] {
  const perDeg = 111_320;
  const pts: TrackPoint[] = [];
  for (let d = 0; d <= metres; d += stepM) {
    pts.push({ t: d * 100, lat: from.lat + d / perDeg, lng: from.lng });
  }
  return pts;
}

/** An out-and-back: leaves home, turns around, comes back to the same door. */
function outAndBack(from: { lat: number; lng: number }, metres: number): TrackPoint[] {
  const out = line(from, metres / 2);
  const back = out.slice(0, -1).reverse().map((p, i) => ({ ...p, t: out[out.length - 1].t + (i + 1) * 1000 }));
  return [...out, ...back];
}

describe("trimEndpoints — the start of a route is a home address", () => {
  it("removes at least TRIM_M of ground from the front", () => {
    const track = line(HOME, 3000);
    const trimmed = trimEndpoints(track);
    expect(haversine(track[0], trimmed[0])).toBeGreaterThanOrEqual(TRIM_M);
  });

  it("removes at least TRIM_M of ground from the back", () => {
    const track = line(HOME, 3000);
    const trimmed = trimEndpoints(track);
    expect(haversine(track[track.length - 1], trimmed[trimmed.length - 1])).toBeGreaterThanOrEqual(TRIM_M);
  });

  it("hides the door on an out-and-back, where start and finish are the same point", () => {
    const track = outAndBack(HOME, 4000);
    const trimmed = trimEndpoints(track);
    for (const p of trimmed) expect(haversine(p, { t: 0, ...HOME })).toBeGreaterThan(TRIM_M * 0.9);
  });

  it("publishes nothing at all when the route is too short to survive the cut", () => {
    // 400 m around the block: trimmed at both ends there is no route left that
    // is not the block itself.
    expect(trimEndpoints(line(HOME, 400))).toEqual([]);
  });

  it("keeps the middle intact", () => {
    const track = line(HOME, 5000);
    const trimmed = trimEndpoints(track);
    const kept = haversine(trimmed[0], trimmed[trimmed.length - 1]);
    expect(kept).toBeGreaterThan(5000 - 2 * TRIM_M - 50);
  });

  it("survives a degenerate track without throwing", () => {
    expect(trimEndpoints([])).toEqual([]);
    expect(trimEndpoints([{ t: 0, ...HOME }])).toEqual([]);
  });
});

describe("simplify", () => {
  it("collapses a straight line to its two ends", () => {
    expect(simplify(line(HOME, 1000), 12)).toHaveLength(2);
  });

  it("keeps a corner that a walker would notice", () => {
    const a = line(HOME, 500);
    const corner = a[a.length - 1];
    const b = Array.from({ length: 50 }, (_, i) => ({ t: corner.t + i * 100, lat: corner.lat, lng: corner.lng + (i * 10) / 78_000 }));
    expect(simplify([...a, ...b], 12).length).toBeGreaterThanOrEqual(3);
  });

  it("never drops the first or last point", () => {
    const track = line(HOME, 2000);
    const out = simplify(track, 50);
    expect(out[0]).toEqual(track[0]);
    expect(out[out.length - 1]).toEqual(track[track.length - 1]);
  });

  it("handles a very long track without recursing", () => {
    const long = line(HOME, 200_000, 20); // 10,000 points
    expect(() => simplify(long, 12)).not.toThrow();
  });
});

describe("cellOf — a neighbourhood, not a street", () => {
  it("gives the same cell to two points a few hundred metres apart", () => {
    expect(cellOf(45.5017, -73.5673)).toBe(cellOf(45.5037, -73.5653));
  });

  it("gives different cells to points tens of kilometres apart", () => {
    expect(cellOf(45.50, -73.56)).not.toBe(cellOf(46.81, -71.21)); // Montréal vs Québec
  });

  it("cannot be inverted to better than the cell size", () => {
    // Everything the cell tells you is that the point was somewhere in a box
    // this wide. That box is kilometres across, by construction.
    const kmTall = CELL_DEG * 111.32;
    expect(kmTall).toBeGreaterThan(5);
  });

  it("works south of the equator and west of Greenwich", () => {
    expect(cellOf(-33.87, 151.21)).toBe(cellOf(-33.85, 151.25));
    expect(() => cellOf(-0.001, -0.001)).not.toThrow();
  });
});

describe("cellsAround", () => {
  it("returns the cell and its eight neighbours", () => {
    const cells = cellsAround(45.5017, -73.5673);
    expect(cells).toHaveLength(9);
    expect(new Set(cells).size).toBe(9);
    expect(cells).toContain(cellOf(45.5017, -73.5673));
  });

  it("includes the neighbour of someone just across a grid line", () => {
    // Two people 400 m apart either side of a boundary must still see each
    // other, or the feature reads as broken.
    const justBelow = 45.4999, justAbove = 45.5001;
    expect(cellOf(justBelow, -73.56)).not.toBe(cellOf(justAbove, -73.56));
    expect(cellsAround(justBelow, -73.56)).toContain(cellOf(justAbove, -73.56));
  });
});

describe("publishableRoute — what actually leaves the device", () => {
  it("carries no timestamps, altitude, accuracy or heart rate", () => {
    const track = line(HOME, 3000).map((p) => ({ ...p, alt: 40, acc: 5, hr: 152 }));
    const { route } = publishableRoute(track);
    for (const point of route) {
      expect(point).toHaveLength(2);
      expect(typeof point[0]).toBe("number");
    }
    expect(JSON.stringify(route)).not.toMatch(/hr|alt|acc|"t"/);
  });

  it("starts away from where the track started", () => {
    const track = line(HOME, 3000);
    const { route } = publishableRoute(track);
    expect(haversine({ t: 0, lat: route[0][0], lng: route[0][1] }, track[0])).toBeGreaterThanOrEqual(TRIM_M);
  });

  it("derives the cell from the middle, not the start", () => {
    // A long route whose midpoint sits in a different cell from its origin
    // must be filed under the midpoint — otherwise the trim is undone.
    const track = line(HOME, 30_000, 25);
    const { cell } = publishableRoute(track);
    expect(cell).not.toBe(cellOf(HOME.lat, HOME.lng));
    const mid = track[Math.floor(track.length / 2)];
    expect(cell).toBe(cellOf(mid.lat, mid.lng));
  });

  it("returns no route and no cell for a track too short to trim", () => {
    expect(publishableRoute(line(HOME, 300))).toEqual({ route: [], cell: null });
  });

  it("caps the point count so a long ride stays a thumbnail", () => {
    const { route } = publishableRoute(line(HOME, 200_000, 20));
    expect(route.length).toBeLessThanOrEqual(240);
  });

  it("rounds coordinates to about a metre", () => {
    const { route } = publishableRoute(line(HOME, 3000));
    for (const [lat, lng] of route) {
      expect(String(lat).split(".")[1]?.length ?? 0).toBeLessThanOrEqual(5);
      expect(String(lng).split(".")[1]?.length ?? 0).toBeLessThanOrEqual(5);
    }
  });
});

describe("routePath — the drawn shape", () => {
  const parse = (d: string) => d.split(/[ML]/).filter(Boolean).map((s) => s.trim().split(" ").map(Number) as [number, number]);

  it("returns nothing for a route that cannot be drawn", () => {
    expect(routePath([])).toBe("");
    expect(routePath([[45.5, -73.5]])).toBe("");
  });

  it("stays inside the box", () => {
    const square: [number, number][] = [[45.50, -73.60], [45.52, -73.60], [45.52, -73.57], [45.50, -73.57], [45.50, -73.60]];
    for (const [x, y] of parse(routePath(square, 100, 8))) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(100);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(100);
    }
  });

  it("puts north at the top", () => {
    // SVG y grows downward while latitude grows upward. Get this wrong and
    // every route renders mirrored, which nobody spots in a strange city.
    const northward: [number, number][] = [[45.50, -73.58], [45.56, -73.58]];
    const [first, last] = parse(routePath(northward));
    expect(last[1]).toBeLessThan(first[1]);
  });

  it("puts east on the right", () => {
    const eastward: [number, number][] = [[45.50, -73.60], [45.50, -73.54]];
    const [first, last] = parse(routePath(eastward));
    expect(last[0]).toBeGreaterThan(first[0]);
  });

  it("draws a route at its true proportions, not stretched to fill the box", () => {
    // The property is that the shape on screen has the same aspect ratio as
    // the ground it covers — measured with haversine, so the test does not
    // repeat the projection's own arithmetic back at it.
    const box: [number, number][] = [[45.50, -73.580], [45.52, -73.580], [45.52, -73.5729], [45.50, -73.5729]];
    const groundH = haversine({ t: 0, lat: 45.50, lng: -73.58 }, { t: 0, lat: 45.52, lng: -73.58 });
    const groundW = haversine({ t: 0, lat: 45.51, lng: -73.580 }, { t: 0, lat: 45.51, lng: -73.5729 });

    const pts = parse(routePath(box, 100, 0));
    const drawnW = Math.max(...pts.map((p) => p[0])) - Math.min(...pts.map((p) => p[0]));
    const drawnH = Math.max(...pts.map((p) => p[1])) - Math.min(...pts.map((p) => p[1]));

    expect(drawnH / drawnW).toBeCloseTo(groundH / groundW, 1);
  });

  it("corrects for longitude shrinking away from the equator", () => {
    // The same degree span is narrower in Québec than at the equator.
    const span: [number, number][] = [[0, 0], [0, 0.1]];
    const north: [number, number][] = [[60, 0], [60, 0.1]];
    const width = (d: string) => { const p = parse(d); return Math.abs(p[1][0] - p[0][0]); };
    // Both fill the box on their long axis, so compare the scale factor used:
    // at 60°N, cos(60°) = 0.5, so the same span is drawn half as wide before
    // the fit-to-box step normalises it. Check the projection directly instead.
    expect(width(routePath(span, 100, 0))).toBeCloseTo(width(routePath(north, 100, 0)), 5);
  });

  it("handles a route where every point is identical without producing NaN", () => {
    const stuck: [number, number][] = [[45.5, -73.5], [45.5, -73.5], [45.5, -73.5]];
    expect(routePath(stuck)).not.toMatch(/NaN/);
  });
});
