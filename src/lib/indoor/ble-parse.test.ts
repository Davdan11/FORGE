import { describe, it, expect } from "vitest";
import { parseHeartRate, parseCyclingPower, parseCsc, parseIndoorBike, type Rev } from "./ble-parse";

/* Frames are built here byte by byte from the Bluetooth SIG specs, because
   the alternative is owning four kinds of trainer. A wrong offset does not
   throw — it reads cadence as power — so every test names the value it
   expects rather than just checking the shape. */

const view = (...bytes: number[]) => new DataView(new Uint8Array(bytes).buffer);
const u16 = (n: number) => [n & 0xff, (n >> 8) & 0xff];
const i16 = (n: number) => u16(n < 0 ? n + 0x10000 : n);
const u32 = (n: number) => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >> 24) & 0xff];

describe("parseHeartRate", () => {
  it("reads an 8-bit value", () => {
    expect(parseHeartRate(view(0x00, 152))).toEqual({ hr: 152 });
  });

  it("reads a 16-bit value when the flag says so", () => {
    expect(parseHeartRate(view(0x01, ...u16(300)))).toEqual({ hr: 300 });
  });

  it("does not read a 16-bit value as 8-bit", () => {
    // The whole point of the flag: 0x01 with 152 little-endian is [152, 0].
    // Read as uint8 that is still 152, so use a value where the two differ.
    expect(parseHeartRate(view(0x01, ...u16(400)))).toEqual({ hr: 400 });
  });

  it("treats zero as lost contact, not a reading", () => {
    expect(parseHeartRate(view(0x00, 0))).toEqual({});
  });

  it("ignores a truncated frame", () => {
    expect(parseHeartRate(view(0x00))).toEqual({});
    expect(parseHeartRate(view(0x01, 44))).toEqual({});
  });
});

describe("parseCyclingPower", () => {
  it("reads instantaneous power", () => {
    expect(parseCyclingPower(view(...u16(0x0000), ...i16(243))).power).toBe(243);
  });

  it("reads negative power without wrapping it to 65k", () => {
    expect(parseCyclingPower(view(...u16(0x0000), ...i16(-5))).power).toBe(-5);
  });

  it("finds power at the front however many optional fields follow", () => {
    const flags = 0x0001 | 0x0004 | 0x0010 | 0x0020;
    const frame = view(
      ...u16(flags), ...i16(211),
      50,                                   // pedal power balance
      ...u16(1234),                         // accumulated torque
      ...u32(9999), ...u16(1000),           // wheel revolutions
      ...u16(100), ...u16(2048),            // crank revolutions
    );
    expect(frame.byteLength).toBe(17);
    expect(parseCyclingPower(frame).power).toBe(211);
  });

  it("derives cadence from two crank samples, skipping the optional fields", () => {
    const flags = 0x0001 | 0x0020;          // balance present, then crank
    const at = (revs: number, t: number) => view(...u16(flags), ...i16(200), 50, ...u16(revs), ...u16(t));

    const first = parseCyclingPower(at(100, 0));
    expect(first.cadence).toBeUndefined();  // one sample is not a rate

    // 30 revolutions in 20.48 s → 87.9 rpm
    const second = parseCyclingPower(at(130, 20 * 1024 + 492), first.crank);
    expect(second.cadence).toBeCloseTo(87.9, 0);
  });

  it("survives the 16-bit event-time wrap without going negative", () => {
    const flags = 0x0020;
    const at = (revs: number, t: number) => view(...u16(flags), ...i16(200), ...u16(revs), ...u16(t));
    const prev: Rev = { revs: 65530, time1024: 65000 };
    // Both counters wrap between the two samples: 15 revolutions in 10 s,
    // which is 90 rpm — an ordinary cadence that a naive subtraction would
    // turn into a negative number and drop.
    const out = parseCyclingPower(at((65530 + 15) % 0x10000, (65000 + 10240) % 0x10000), prev);
    expect(out.cadence).toBeCloseTo(90, 0);
  });

  it("reports no cadence while coasting, rather than a stale one", () => {
    const flags = 0x0020;
    const at = (revs: number, t: number) => view(...u16(flags), ...i16(0), ...u16(revs), ...u16(t));
    const first = parseCyclingPower(at(100, 5000));
    expect(parseCyclingPower(at(100, 5000), first.crank).cadence).toBeUndefined();
  });

  it("ignores a truncated frame", () => {
    expect(parseCyclingPower(view(0x00, 0x00))).toEqual({});
  });
});

describe("parseCsc", () => {
  it("derives speed from wheel revolutions", () => {
    const at = (revs: number, t: number) => view(0x01, ...u32(revs), ...u16(t));
    const first = parseCsc(at(1000, 0));
    expect(first.speedMs).toBeUndefined();

    // 10 wheel turns × 2.105 m in 2 s = 10.5 m/s
    const second = parseCsc(at(1010, 2048), first.csc);
    expect(second.speedMs).toBeCloseTo(10.525, 2);
  });

  it("honours a different wheel circumference", () => {
    const at = (revs: number, t: number) => view(0x01, ...u32(revs), ...u16(t));
    const first = parseCsc(at(0, 0), undefined, 1.5);
    const second = parseCsc(at(10, 1024), first.csc, 1.5);
    expect(second.speedMs).toBeCloseTo(15, 2);
  });

  it("reads cadence when only crank data is present", () => {
    const at = (revs: number, t: number) => view(0x02, ...u16(revs), ...u16(t));
    const first = parseCsc(at(0, 0));
    const second = parseCsc(at(30, 20 * 1024 + 492), first.csc);
    expect(second.cadence).toBeCloseTo(87.9, 0);
  });

  it("reads both when both flags are set, in the right order", () => {
    const at = (w: number, wt: number, c: number, ct: number) =>
      view(0x03, ...u32(w), ...u16(wt), ...u16(c), ...u16(ct));
    const first = parseCsc(at(0, 0, 0, 0));
    const second = parseCsc(at(10, 2048, 30, 2048), first.csc);
    expect(second.speedMs).toBeCloseTo(10.525, 2);
    expect(second.cadence).toBeCloseTo(900, 0);
  });

  it("survives the 32-bit wheel counter wrapping", () => {
    const at = (revs: number, t: number) => view(0x01, ...u32(revs), ...u16(t));
    const first = parseCsc(at(0xFFFFFFFE, 0));
    const second = parseCsc(at(3, 1024), first.csc);
    expect(second.speedMs).toBeGreaterThan(0);
    expect(second.speedMs).toBeLessThan(20);
  });
});

describe("parseIndoorBike", () => {
  it("reads instantaneous speed, which is present when bit 0 is CLEAR", () => {
    // 3000 × 0.01 km/h = 30 km/h = 8.333 m/s
    expect(parseIndoorBike(view(...u16(0x0000), ...u16(3000))).speedMs).toBeCloseTo(8.333, 2);
  });

  it("omits speed when the More Data bit is SET", () => {
    // Reading this bit the obvious way round shifts every later field by two
    // bytes, which is the single most likely mistake in this file.
    const frame = view(...u16(0x0001 | 0x0040), ...i16(250));
    expect(parseIndoorBike(frame).speedMs).toBeUndefined();
    expect(parseIndoorBike(frame).power).toBe(250);
  });

  it("finds power after speed, cadence, distance and resistance", () => {
    const flags = 0x0004 | 0x0010 | 0x0020 | 0x0040;   // cadence, distance, resistance, power
    const frame = view(
      ...u16(flags),
      ...u16(3000),                 // instantaneous speed (bit 0 clear)
      ...u16(180),                  // cadence, 0.5 rpm units → 90 rpm
      12, 0, 0,                     // total distance, uint24 → 12 m
      ...i16(7),                    // resistance
      ...i16(264),                  // power
    );
    const out = parseIndoorBike(frame);
    expect(out.speedMs).toBeCloseTo(8.333, 2);
    expect(out.cadence).toBe(90);
    expect(out.distanceM).toBe(12);
    expect(out.power).toBe(264);
  });

  it("reads a 24-bit distance past 65535 m", () => {
    const frame = view(...u16(0x0011), 0x40, 0x42, 0x0f);  // 0x0f4240 = 1,000,000
    expect(parseIndoorBike(frame).distanceM).toBe(1_000_000);
  });

  it("reads heart rate at the very end of a full frame", () => {
    const flags = 0x0004 | 0x0040 | 0x0100 | 0x0200;   // cadence, power, energy, HR
    const frame = view(
      ...u16(flags),
      ...u16(2500),                 // speed
      ...u16(170),                  // cadence → 85 rpm
      ...i16(198),                  // power
      ...u16(120), ...u16(500), 9,  // expended energy, 5 bytes
      148,                          // heart rate
    );
    const out = parseIndoorBike(frame);
    expect(out.cadence).toBe(85);
    expect(out.power).toBe(198);
    expect(out.hr).toBe(148);
  });

  it("stops rather than reading past the end of a short frame", () => {
    const flags = 0x0040;           // claims power
    expect(() => parseIndoorBike(view(...u16(flags), ...u16(3000)))).not.toThrow();
    expect(parseIndoorBike(view(...u16(flags), ...u16(3000))).power).toBeUndefined();
  });
});
