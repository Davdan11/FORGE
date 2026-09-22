import { describe, expect, it } from "vitest";
import { cmdRequestControl, cmdSimulation, cmdStart, cmdTargetIncline, cmdTargetPower, cmdTargetSpeed, parseResponse, shouldSendGrade } from "./ftms";
import { parseRsc, parseTreadmill } from "./ble-parse";

/* Bytes checked against the FTMS 1.0 and RSC specifications. A wrong byte here
   does not fail loudly: the trainer ignores it, or worse, obeys it. */

const view = (...bytes: number[]) => new DataView(Uint8Array.from(bytes).buffer);
const hex = (u: Uint8Array) => [...u].map((b) => b.toString(16).padStart(2, "0")).join(" ");

describe("control point commands", () => {
  it("request control and start are single op codes", () => {
    expect(hex(cmdRequestControl())).toBe("00");
    expect(hex(cmdStart())).toBe("07");
  });

  it("encodes a 5% grade as 500 hundredths, little-endian, with default crr and cw", () => {
    // op 0x11 · wind 0 · grade 500 (f4 01) · crr 0.004 → 40 (28) · cw 0.51 → 51 (33)
    expect(hex(cmdSimulation(5))).toBe("11 00 00 f4 01 28 33");
  });

  it("encodes a descent as a negative grade", () => {
    expect(new DataView(cmdSimulation(-3.5).buffer).getInt16(3, true)).toBe(-350);
  });

  it("clamps grades a trainer could never honour", () => {
    expect(new DataView(cmdSimulation(99).buffer).getInt16(3, true)).toBe(4000);
  });

  it("encodes ERG watts and treadmill incline", () => {
    expect(hex(cmdTargetPower(250))).toBe("05 fa 00");
    expect(hex(cmdTargetIncline(4.5))).toBe("03 2d 00");
    // 12 km/h = 1200 hundredths = b0 04
    expect(hex(cmdTargetSpeed(12 / 3.6))).toBe("02 b0 04");
  });

  it("reads the machine's answer", () => {
    expect(parseResponse(view(0x80, 0x11, 0x01))).toEqual({ op: 0x11, ok: true, result: 1 });
    expect(parseResponse(view(0x80, 0x05, 0x02))).toEqual({ op: 0x05, ok: false, result: 2 });
    expect(parseResponse(view(0x11, 0x00))).toBeNull();
  });

  it("sends grades at most once a second, and only when they changed", () => {
    expect(shouldSendGrade(null, 2, 0, 5000)).toBe(true);
    expect(shouldSendGrade(2, 2.2, 5000, 6500)).toBe(false);  // too small a change
    expect(shouldSendGrade(2, 3, 5000, 5500)).toBe(false);    // too soon
    expect(shouldSendGrade(2, 3, 5000, 6100)).toBe(true);
    expect(shouldSendGrade(2, 2, 5000, 16000)).toBe(true);    // keep-alive
  });
});

describe("running sensors", () => {
  it("reads a treadmill at 12 km/h on a 2% incline", () => {
    // flags 0x0008: incline present; speed present because bit 0 is clear.
    // speed 1200 (0.01 km/h) = b0 04 · incline 20 (0.1 %) = 14 00 · ramp 0
    const r = parseTreadmill(view(0x08, 0x00, 0xb0, 0x04, 0x14, 0x00, 0x00, 0x00));
    expect(r.speedMs! * 3.6).toBeCloseTo(12, 5);
    expect(r.inclinePct).toBe(2);
  });

  it("reads treadmill distance and heart rate when flagged", () => {
    // flags 0x0104: distance + HR · speed 1000 · distance 1234 m · hr 150
    const r = parseTreadmill(view(0x04, 0x01, 0xe8, 0x03, 0xd2, 0x04, 0x00, 150));
    expect(r.distanceM).toBe(1234);
    expect(r.hr).toBe(150);
  });

  it("reads a footpod's speed, cadence and distance", () => {
    // flags 0x02 (total distance) · 3.5 m/s = 896/256 = 80 03 · cadence 170 · 5000 dm
    const r = parseRsc(view(0x02, 0x80, 0x03, 170, 0x88, 0x13, 0x00, 0x00));
    expect(r.speedMs).toBeCloseTo(3.5, 5);
    expect(r.cadence).toBe(170);
    expect(r.distanceM).toBe(500);
  });
});
