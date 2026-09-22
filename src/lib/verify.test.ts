import { describe, expect, it } from "vitest";
import { verifyActivity } from "./verify";
import { sportSpec } from "./data/sports";
import type { TrackPoint } from "./types";

/* These decide whether an effort earns XP, so the honest athlete must never be
   penalised and the driven route must never be paid. */

const LAT0 = 45.52, LNG0 = -73.58;
/** Roughly one metre of latitude. */
const M = 1 / 111_320;

/** A straight track at a constant speed, one sample per second. */
function track(speedMs: number, seconds: number, startT = 0, startLat = LAT0): TrackPoint[] {
  const pts: TrackPoint[] = [];
  for (let i = 0; i <= seconds; i++) {
    pts.push({ t: startT + i * 1000, lat: startLat + i * speedMs * M, lng: LNG0, alt: 40 });
  }
  return pts;
}

/** Stand still for `seconds`, sampling the whole time. */
function still(seconds: number, startT: number, lat: number): TrackPoint[] {
  const pts: TrackPoint[] = [];
  for (let i = 1; i <= seconds; i++) pts.push({ t: startT + i * 1000, lat, lng: LNG0, alt: 40 });
  return pts;
}

describe("an honest effort", () => {
  it("credits a steady run in full", () => {
    const v = verifyActivity(track(3, 600), "run");           // 3 m/s for 10 min
    expect(v.verdict).toBe("verified");
    expect(v.flags).toEqual([]);
    expect(v.credit).toBe(1);
    expect(v.verifiedDistanceM).toBeGreaterThan(1750);
    expect(v.movingSec).toBe(600);
  });

  it("credits a fast descent on a bike that would be impossible on foot", () => {
    const onBike = verifyActivity(track(16, 300), "ride");     // 58 km/h
    expect(onBike.verdict).toBe("verified");
    const onFoot = verifyActivity(track(16, 300), "run");
    expect(onFoot.verdict).toBe("unverified");
  });

  it("tolerates a short pause at a crossing without flagging a break", () => {
    const pts = [...track(3, 300), ...still(30, 300_000, LAT0 + 300 * 3 * M)];
    const v = verifyActivity(pts, "run");
    expect(v.flags.some((f) => f.kind === "idle")).toBe(false);
    expect(v.credit).toBeGreaterThan(0.85);
  });
});

describe("a break in the middle", () => {
  it("excludes a long stop from moving time and says so", () => {
    const end = LAT0 + 300 * 3 * M;
    const pts = [...track(3, 300), ...still(600, 300_000, end)];   // 5 min run, 10 min parked
    const v = verifyActivity(pts, "run");
    const idle = v.flags.find((f) => f.kind === "idle");
    expect(idle).toBeTruthy();
    expect(idle!.message).toMatch(/stopped/i);
    expect(v.movingSec).toBe(300);
    expect(v.idleSec).toBeGreaterThan(550);
    expect(v.credit).toBeLessThan(0.4);
  });

  it("still counts the distance actually covered before the break", () => {
    const end = LAT0 + 300 * 3 * M;
    const v = verifyActivity([...track(3, 300), ...still(600, 300_000, end)], "run");
    expect(v.verifiedDistanceM).toBeGreaterThan(850);
  });
});

describe("a route that was driven", () => {
  it("refuses to credit car speeds logged as a run", () => {
    const v = verifyActivity(track(20, 600), "run");            // 72 km/h
    expect(v.verdict).toBe("unverified");
    expect(v.verifiedDistanceM).toBe(0);
    expect(v.credit).toBe(0);
    expect(v.flags.find((f) => f.kind === "vehicle")!.message).toMatch(/faster than run allows/i);
  });

  it("keeps the honest half of a mixed track and drops the driven half", () => {
    const ranTo = LAT0 + 300 * 3 * M;
    const pts = [...track(3, 300), ...track(20, 300, 300_000, ranTo)];
    const v = verifyActivity(pts, "run");
    expect(v.verifiedDistanceM).toBeGreaterThan(850);           // the running part
    expect(v.discardedDistanceM).toBeGreaterThan(5000);         // the driving part
    expect(v.verdict).toBe("unverified");
  });

  it("drops a teleport rather than banking it as distance", () => {
    const pts: TrackPoint[] = [
      { t: 0, lat: LAT0, lng: LNG0 },
      { t: 5_000, lat: LAT0 + 0.1, lng: LNG0 },                 // 11 km in 5 s
      { t: 10_000, lat: LAT0 + 0.1002, lng: LNG0 },
    ];
    const v = verifyActivity(pts, "run");
    expect(v.flags.some((f) => f.kind === "teleport")).toBe(true);
    expect(v.verifiedDistanceM).toBeLessThan(100);
  });
});

describe("sports with nothing to track", () => {
  it("takes a climbing session at its word on duration", () => {
    expect(sportSpec("climb").gps).toBe(false);
    const v = verifyActivity([], "climb", 3600);
    expect(v.verdict).toBe("verified");
    expect(v.movingSec).toBe(3600);
    expect(v.credit).toBe(1);
  });

  it("does the same for a hockey game and a swim", () => {
    for (const t of ["hockey", "swim", "basketball"] as const) {
      const v = verifyActivity([], t, 2700);
      expect(v.verdict).toBe("verified");
      expect(v.credit).toBe(1);
    }
  });
});

describe("a recording that produced nothing", () => {
  it("refuses to credit a GPS sport with no track at all", () => {
    const v = verifyActivity([], "run", 1800);
    expect(v.verdict).toBe("unverified");
    expect(v.credit).toBe(0);
    expect(v.flags[0].message).toMatch(/no usable gps/i);
  });

  it("flags a timer that ran while the device sat on a table", () => {
    const v = verifyActivity(still(600, 0, LAT0), "run", 600);
    expect(v.credit).toBeLessThan(0.2);
    expect(v.verdict).not.toBe("verified");
  });

  it("does not flag a thirty-second recording that was simply stopped early", () => {
    const v = verifyActivity([], "run", 30);
    expect(v.verdict).toBe("verified");
    expect(v.flags).toEqual([]);
  });
});

describe("shape of the result", () => {
  it("always returns a credit between 0 and 1 and non-negative times", () => {
    const cases: TrackPoint[][] = [[], track(3, 60), track(40, 60), still(120, 0, LAT0)];
    for (const pts of cases) {
      const v = verifyActivity(pts, "run", 120);
      expect(v.credit).toBeGreaterThanOrEqual(0);
      expect(v.credit).toBeLessThanOrEqual(1);
      expect(v.movingSec).toBeGreaterThanOrEqual(0);
      expect(v.idleSec).toBeGreaterThanOrEqual(0);
      expect(v.verifiedDistanceM).toBeGreaterThanOrEqual(0);
    }
  });
});
