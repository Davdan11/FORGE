import { describe, it, expect } from "vitest";
import {
  step, steadySpeed, ROAD_BIKE, powerFromHr, powerFromSpeed, declaredPower,
  guessFtp, maxHrFor, XP_CREDIT,
} from "./physics";
import { SensorFusion } from "./sensors";

/* These are checked against speeds a cyclist recognises, not against the
   equation repeated back at itself. If 250 W on the flat stops being about
   36 km/h, the model has drifted and the ride will feel wrong long before
   anyone works out why. */

const RIDER = ROAD_BIKE(75);   // 75 kg athlete, 83 kg all in

describe("steadySpeed — does it match the real world", () => {
  it("puts 200 W on the flat at about 33 km/h", () => {
    expect(steadySpeed(200, 0, RIDER) * 3.6).toBeGreaterThan(30);
    expect(steadySpeed(200, 0, RIDER) * 3.6).toBeLessThan(36);
  });

  it("puts 250 W on the flat at about 36 km/h", () => {
    expect(steadySpeed(250, 0, RIDER) * 3.6).toBeCloseTo(36.3, 0);
  });

  it("shows how little speed another 50 W buys, because drag grows as the cube", () => {
    const at250 = steadySpeed(250, 0, RIDER) * 3.6;
    const at300 = steadySpeed(300, 0, RIDER) * 3.6;
    // Twenty percent more power for under three km/h: the fact that makes
    // aerodynamics matter, and it has to survive in the model.
    expect(at300 - at250).toBeLessThan(3.5);
  });

  it("puts 250 W up an eight percent climb at about 12 km/h", () => {
    expect(steadySpeed(250, 0.08, RIDER) * 3.6).toBeCloseTo(12.3, 0);
  });

  it("slows a heavier rider more on a climb than on the flat", () => {
    const light = ROAD_BIKE(60), heavy = ROAD_BIKE(95);
    const flatGap = steadySpeed(250, 0, light) - steadySpeed(250, 0, heavy);
    const climbGap = steadySpeed(250, 0.08, light) - steadySpeed(250, 0.08, heavy);
    expect(climbGap).toBeGreaterThan(flatGap * 2);
  });

  it("is monotonic: more power is never slower", () => {
    let last = -1;
    for (let w = 0; w <= 600; w += 25) {
      const v = steadySpeed(w, 0.03, RIDER);
      expect(v).toBeGreaterThanOrEqual(last);
      last = v;
    }
  });

  it("is monotonic in gradient: steeper is never faster", () => {
    let last = Infinity;
    for (let g = -0.05; g <= 0.2; g += 0.01) {
      const v = steadySpeed(250, g, RIDER);
      expect(v).toBeLessThanOrEqual(last + 1e-9);
      last = v;
    }
  });
});

describe("step — moving one tick at a time", () => {
  it("converges on the steady speed from a standstill", () => {
    let v = 0;
    for (let i = 0; i < 120; i++) v = step(v, 250, 0, RIDER, 1);
    expect(v).toBeCloseTo(steadySpeed(250, 0, RIDER), 1);
  });

  it("converges on the same speed coming down from too fast", () => {
    let v = 20;
    for (let i = 0; i < 120; i++) v = step(v, 250, 0, RIDER, 1);
    expect(v).toBeCloseTo(steadySpeed(250, 0, RIDER), 1);
  });

  it("does not launch the rider on the first tick from zero", () => {
    // P/v is infinite at a standstill. Without a cap the avatar teleports.
    expect(step(0, 600, 0, RIDER, 1) * 3.6).toBeLessThan(20);
  });

  it("lets a rider freewheel downhill with no power at all", () => {
    let v = 5;
    for (let i = 0; i < 60; i++) v = step(v, 0, -0.06, RIDER, 1);
    expect(v * 3.6).toBeGreaterThan(30);
  });

  it("brings a rider who stops pedalling on a climb to a halt, not backwards", () => {
    let v = 4;
    for (let i = 0; i < 60; i++) v = step(v, 0, 0.08, RIDER, 1);
    expect(v).toBe(0);
  });

  it("gives the same answer whatever the tick size", () => {
    // A 60 fps client and a 4 Hz one must not diverge, or two riders on the
    // same course drift apart for no reason anybody can see.
    let coarse = 0; for (let i = 0; i < 100; i++) coarse = step(coarse, 250, 0.02, RIDER, 1);
    let fine = 0;   for (let i = 0; i < 6000; i++) fine = step(fine, 250, 0.02, RIDER, 1 / 60);
    expect(fine).toBeCloseTo(coarse, 1);
  });

  it("survives a gradient no real road has", () => {
    expect(() => step(5, 250, 5, RIDER, 1)).not.toThrow();
    expect(Number.isFinite(step(5, 250, -5, RIDER, 1))).toBe(true);
  });
});

describe("effort that was not measured", () => {
  it("labels heart-rate power as an estimate, never a measurement", () => {
    expect(powerFromHr(150, 50, 190, 250).quality).toBe("estimated");
    expect(powerFromSpeed(8).quality).toBe("estimated");
    expect(declaredPower(300).quality).toBe("declared");
  });

  it("rises with heart rate", () => {
    const ftp = 250;
    let last = -1;
    for (let hr = 50; hr <= 190; hr += 10) {
      const w = powerFromHr(hr, 50, 190, ftp).watts;
      expect(w).toBeGreaterThanOrEqual(last);
      last = w;
    }
  });

  it("puts threshold heart rate near threshold power", () => {
    // At the top of heart-rate reserve a rider should be near their FTP, not
    // at half of it and not at double.
    const w = powerFromHr(190, 50, 190, 250).watts;
    expect(w).toBeGreaterThan(250 * 0.9);
    expect(w).toBeLessThan(250 * 1.5);
  });

  it("gives almost nothing at resting heart rate", () => {
    expect(powerFromHr(50, 50, 190, 250).watts).toBe(0);
  });

  it("does not explode if max and rest heart rate are equal", () => {
    expect(() => powerFromHr(120, 150, 150, 250)).not.toThrow();
  });

  it("caps what somebody can simply type in", () => {
    expect(declaredPower(99999).watts).toBe(600);
    expect(declaredPower(-50).watts).toBe(0);
  });

  it("pays nothing for declared effort and part for estimated", () => {
    // The whole point: a person with no hardware can ride the course and see
    // the world move. They cannot climb a leaderboard by typing a number.
    expect(XP_CREDIT.declared).toBe(0);
    expect(XP_CREDIT.estimated).toBeLessThan(XP_CREDIT.measured);
    expect(XP_CREDIT.measured).toBe(1);
  });
});

describe("the guesses that make heart-rate mode possible", () => {
  it("uses Tanaka rather than 220 minus age", () => {
    // 220−age says 200 at twenty and 170 at fifty; both are known to be off.
    expect(maxHrFor(20)).toBe(194);
    expect(maxHrFor(50)).toBe(173);
  });

  it("scales a guessed FTP with weight and training level", () => {
    expect(guessFtp(75, "new")).toBeLessThan(guessFtp(75, "advanced"));
    expect(guessFtp(60, "intermediate")).toBeLessThan(guessFtp(90, "intermediate"));
  });

  it("guesses an FTP an actual person could hold", () => {
    const w = guessFtp(75, "intermediate");
    expect(w).toBeGreaterThan(150);
    expect(w).toBeLessThan(300);
  });
});

describe("SensorFusion — merging several sensors", () => {
  it("keeps the newest value for each field", () => {
    const f = new SensorFusion();
    f.accept({ hr: 140 }, 1000);
    f.accept({ power: 220, cadence: 88 }, 1100);
    f.accept({ hr: 145 }, 1200);
    expect(f.get("hr", 1300)).toBe(145);
    expect(f.get("power", 1300)).toBe(220);
    expect(f.get("cadence", 1300)).toBe(88);
  });

  it("forgets a reading that has gone stale", () => {
    // A strap that died at 148 must not keep the avatar moving four minutes
    // later. No reading is better than a frozen one.
    const f = new SensorFusion(5000);
    f.accept({ hr: 148 }, 1000);
    expect(f.get("hr", 4000)).toBe(148);
    expect(f.get("hr", 9000)).toBeUndefined();
  });

  it("lets one sensor stay alive while another goes quiet", () => {
    const f = new SensorFusion(5000);
    f.accept({ hr: 150 }, 1000);
    f.accept({ power: 240 }, 8000);
    expect(f.get("hr", 9000)).toBeUndefined();
    expect(f.get("power", 9000)).toBe(240);
    expect(f.silent(9000)).toBe(false);
  });

  it("reports silence when everything has stopped", () => {
    const f = new SensorFusion(5000);
    f.accept({ hr: 150, power: 200 }, 1000);
    expect(f.silent(2000)).toBe(false);
    expect(f.silent(20000)).toBe(true);
  });

  it("is silent before it has heard anything", () => {
    expect(new SensorFusion().silent()).toBe(true);
  });
});
