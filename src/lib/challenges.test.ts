import { describe, expect, it } from "vitest";
import { challengesFor, negativeSplit, unpaid } from "./challenges";
import { addDays } from "./db";
import type { Activity, ActivityType, TrackPoint } from "./types";

/* Challenges are a promise twice over: sized to the person, and paid only for
   work the track supports. */

const TODAY = "2026-09-23"; // a Wednesday; its week starts 2026-09-21

/** A straight track at a steady speed, one point every 5 s. */
function track(distanceM: number, speedMs: number, start: number): TrackPoint[] {
  const pts: TrackPoint[] = [];
  const n = Math.ceil(distanceM / (speedMs * 5));
  for (let i = 0; i <= n; i++) pts.push({ t: start + i * 5000, lat: 45.5 + (i * speedMs * 5) / 111195, lng: -73.6 });
  return pts;
}

let seq = 0;
function activity(type: ActivityType, date: string, distanceM: number, opts: { speed?: number; minutes?: number; elevGainM?: number; elevLossM?: number } = {}): Activity {
  const speed = opts.speed ?? 3;
  const start = new Date(date + "T08:00:00").getTime();
  const points = distanceM > 0 ? track(distanceM, speed, start) : [];
  const durationSec = opts.minutes ? opts.minutes * 60 : Math.round(distanceM / speed);
  return {
    id: `a${++seq}`, type, startedAt: new Date(start).toISOString(), distanceM, durationSec, elevGainM: opts.elevGainM ?? 0, elevLossM: opts.elevLossM,
    points, splits: [], title: "t", xp: 0,
  } as Activity;
}

describe("sizing", () => {
  it("gives a first-timer sensible defaults", () => {
    const { weekly } = challengesFor("run", TODAY, [], "km");
    const dist = weekly.find((c) => c.kind === "distance_total")!;
    expect(dist.target).toBe(6000);
    expect(dist.detail).toMatch(/first one sets your baseline/);
    expect(weekly.find((c) => c.kind === "sessions")!.target).toBe(2);
  });

  it("aims about ten percent past the last four weeks", () => {
    const history = [3, 10, 17, 24].map((d) => activity("run", addDays("2026-09-21", -d), 5000));
    const { weekly } = challengesFor("run", TODAY, history, "km");
    // 20 km over 4 weeks is 5 km a week; +10% rounds to 5.5 km.
    expect(weekly.find((c) => c.kind === "distance_total")!.target).toBe(5500);
    expect(weekly.find((c) => c.kind === "distance_total")!.detail).toMatch(/usual is 5 km a week/);
  });

  it("never lets the week's own activities move the target", () => {
    const history = [3, 10, 17, 24].map((d) => activity("run", addDays("2026-09-21", -d), 5000));
    const before = challengesFor("run", TODAY, history, "km").weekly.map((c) => c.target);
    const after = challengesFor("run", TODAY, [...history, activity("run", TODAY, 12000)], "km").weekly.map((c) => c.target);
    expect(after).toEqual(before);
  });
});

describe("each sport is measured its own way", () => {
  it("alpine counts vertical, not kilometres", () => {
    const { daily, weekly } = challengesFor("ski_alpine", TODAY, [], "km");
    expect(["descent", "moving"]).toContain(daily.kind);
    expect(weekly.map((c) => c.kind)).toContain("descent_total");
    expect(weekly.map((c) => c.kind)).not.toContain("distance_total");
  });

  it("hockey counts minutes on the ice", () => {
    const { daily, weekly } = challengesFor("hockey", TODAY, [], "km");
    expect(daily.kind).toBe("moving");
    expect(weekly.map((c) => c.kind).sort()).toEqual(["moving_total", "sessions"]);
  });

  it("hiking can ask for a climb", () => {
    expect(challengesFor("hike", TODAY, [], "km").weekly.map((c) => c.kind)).toContain("climb_total");
  });
});

describe("progress", () => {
  it("completes when a real outing reaches the target", () => {
    const { weekly } = challengesFor("run", TODAY, [activity("run", "2026-09-22", 6200)], "km");
    const dist = weekly.find((c) => c.kind === "distance_total")!;
    expect(dist.progress).toBeGreaterThanOrEqual(6000);
    expect(dist.done).toBe(true);
  });

  it("does not count a route driven at car speed", () => {
    const { weekly } = challengesFor("run", TODAY, [activity("run", "2026-09-22", 20000, { speed: 25 })], "km");
    const dist = weekly.find((c) => c.kind === "distance_total")!;
    expect(dist.progress).toBe(0);
    expect(dist.done).toBe(false);
  });

  it("counts time for a sport with no GPS", () => {
    const { daily } = challengesFor("hockey", TODAY, [activity("hockey", TODAY, 0, { minutes: 50 })], "km");
    expect(daily.done).toBe(true);
  });

  it("ignores other sports and other weeks", () => {
    const acts = [activity("ride", "2026-09-22", 30000, { speed: 8 }), activity("run", "2026-09-14", 8000)];
    const dist = challengesFor("run", TODAY, acts, "km").weekly.find((c) => c.kind === "distance_total")!;
    expect(dist.progress).toBe(0);
  });
});

describe("the daily challenge", () => {
  it("is the same all day and changes across days", () => {
    const kinds = Array.from({ length: 14 }, (_, i) => challengesFor("trail", addDays(TODAY, i), [], "km").daily.kind);
    expect(challengesFor("trail", TODAY, [], "km").daily.id).toBe(challengesFor("trail", TODAY, [], "km").daily.id);
    expect(new Set(kinds).size).toBeGreaterThan(1);
  });
});

describe("payment", () => {
  it("pays a completed challenge once", () => {
    const c = challengesFor("run", TODAY, [activity("run", "2026-09-22", 6200)], "km");
    const first = unpaid(c, []);
    expect(first.length).toBeGreaterThan(0);
    expect(unpaid(c, first.map((x) => x.id))).toEqual([]);
  });
});

describe("negative split", () => {
  it("needs the second half faster than the first", () => {
    expect(negativeSplit({ splits: [{ km: 1, sec: 330 }, { km: 2, sec: 325 }, { km: 3, sec: 310 }, { km: 4, sec: 300 }] })).toBe(true);
    expect(negativeSplit({ splits: [{ km: 1, sec: 300 }, { km: 2, sec: 305 }, { km: 3, sec: 320 }, { km: 4, sec: 330 }] })).toBe(false);
    expect(negativeSplit({ splits: [{ km: 1, sec: 330 }, { km: 2, sec: 300 }] })).toBe(false);
  });
});
