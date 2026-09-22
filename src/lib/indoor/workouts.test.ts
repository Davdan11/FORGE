import { describe, expect, it } from "vitest";
import { BUILT_IN_WORKOUTS, flatten, positionAt, sanitize, stressScore, targetFor, totalSec, zoneOfPct } from "./workouts";

describe("structured workouts", () => {
  const w = { blocks: [
    { kind: "ramp" as const, sec: 100, from: 50, to: 100 },
    { kind: "intervals" as const, repeat: 2, onSec: 60, onPct: 120, offSec: 30, offPct: 50 },
    { kind: "steady" as const, sec: 60, pct: 60 },
  ] };
  const steps = flatten(w);

  it("unrolls intervals and keeps time continuous", () => {
    expect(steps.map((s) => s.sec)).toEqual([100, 60, 30, 60, 30, 60]);
    expect(steps.map((s) => s.startSec)).toEqual([0, 100, 160, 190, 250, 280]);
    expect(totalSec(steps)).toBe(340);
  });

  it("interpolates along a ramp", () => {
    expect(positionAt(steps, 50).pct).toBe(75);
    expect(positionAt(steps, 0).pct).toBe(50);
  });

  it("knows the interval, the time left and what comes next", () => {
    const p = positionAt(steps, 170);
    expect(p.step?.label).toBe("Recover");
    expect(p.leftSec).toBe(20);
    expect(p.next?.label).toBe("Interval 2/2");
  });

  it("ends", () => {
    expect(positionAt(steps, 340).done).toBe(true);
  });

  it("turns a percentage into watts or a belt speed", () => {
    expect(targetFor("ride", 90, { ftpW: 250, thresholdKmh: 12 })).toBe(225);
    expect(targetFor("run", 100, { ftpW: 250, thresholdKmh: 12 }) * 3.6).toBeCloseTo(12, 6);
  });

  it("scores an hour at FTP as 100", () => {
    expect(stressScore(flatten({ blocks: [{ kind: "steady", sec: 3600, pct: 100 }] }))).toBe(100);
  });

  it("places zones on Coggan's boundaries", () => {
    expect([50, 60, 85, 100, 110, 130].map(zoneOfPct)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("refuses numbers nobody can ride", () => {
    const s = sanitize({ id: "x", name: "  ", sport: "ride", blocks: [{ kind: "steady", sec: 2, pct: 900 }] });
    expect(s.name).toBe("My workout");
    expect(s.blocks[0]).toEqual({ kind: "steady", sec: 10, pct: 200 });
  });

  it("ships workouts that are all rideable", () => {
    for (const b of BUILT_IN_WORKOUTS) expect(totalSec(flatten(b))).toBeGreaterThan(1200);
  });
});
