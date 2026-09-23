import { describe, expect, it } from "vitest";
import { antFrame, antPage, fecTargetPower, fecTrackResistance, fecUserConfig, freshFecState, parseFec } from "./fec";

/* Byte layouts from the ANT+ FE-C device profile (pages 0x10, 0x19, 0x31,
   0x33, 0x37) and the ANT serial message format. SPEC-TESTED ONLY: none of
   these frames has been checked against a real Tacx trainer yet. */

const hex = (u: Uint8Array) => [...u].map((b) => b.toString(16).padStart(2, "0")).join(" ");
/** Independent of the code under test: sync, len 9, 0x4E, channel 5, page, XOR. */
const frame = (...page: number[]) => {
  const b = [0xa4, 0x09, 0x4e, 0x05, ...page];
  return new DataView(Uint8Array.from([...b, b.reduce((x, y) => x ^ y, 0)]).buffer);
};

describe("ANT message wrapping", () => {
  it("wraps a page with sync, length, broadcast id, channel 5 and an XOR checksum", () => {
    // Page 0x33 at +5 %: grade (5 + 200) × 100 = 20500 = 0x5014, Crr 0.004 / 5e-5 = 80 = 0x50.
    expect(hex(fecTrackResistance(5))).toBe("a4 09 4e 05 33 ff ff ff ff 14 50 50 c1");
  });

  it("unwraps only well-formed frames", () => {
    expect(hex(antPage(new DataView(antFrame(Uint8Array.of(1, 2, 3, 4, 5, 6, 7, 8)).buffer))!)).toBe("01 02 03 04 05 06 07 08");
    const bad = antFrame(Uint8Array.of(1, 2, 3, 4, 5, 6, 7, 8)); bad[12] ^= 1;
    expect(antPage(new DataView(bad.buffer))).toBeNull();
    expect(antPage(new DataView(Uint8Array.of(0xa5, 9, 0x4e, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0).buffer))).toBeNull();
    expect(antPage(new DataView(Uint8Array.of(0xa4, 9).buffer))).toBeNull();
  });
});

describe("FE-C commands", () => {
  it("encodes a descent below the −200 % offset correctly", () => {
    const p = antPage(new DataView(fecTrackResistance(-3.5).buffer))!;
    expect(p[5] | (p[6] << 8)).toBe(19650);
  });

  it("clamps grades like the FTMS path", () => {
    const p = antPage(new DataView(fecTrackResistance(99).buffer))!;
    expect(p[5] | (p[6] << 8)).toBe(24000);
  });

  it("encodes target power in quarter watts (page 0x31)", () => {
    // 250 W → 1000 = 0x03E8
    expect(hex(fecTargetPower(250))).toBe("a4 09 4e 05 31 ff ff ff ff ff e8 03 c3");
  });

  it("encodes the user configuration (page 0x37)", () => {
    // 75 kg → 7500 = 0x1D4C · bike 8 kg / 0.05 = 160 = 0x0A0 · wheel 0.70 m → 70
    const p = antPage(new DataView(fecUserConfig(75, 8, 0.7).buffer))!;
    expect(hex(p)).toBe("37 4c 1d ff 0f 0a 46 00");
  });
});

describe("FE-C data pages", () => {
  it("reads general FE data (page 0x10) and accumulates the rollover counters", () => {
    const st = freshFecState();
    // elapsed 0xFC (63 s), distance 250 m, speed 8333 mm/s, HR 140
    const a = parseFec(frame(0x10, 0x19, 0xfc, 250, 0x8d, 0x20, 140, 0x24), st);
    expect(a.speedMs).toBeCloseTo(8.333, 3);
    expect(a.hr).toBe(140);
    expect(a.distanceM).toBe(0);
    // Both counters wrap: +8 ticks (2 s), +10 m.
    const b = parseFec(frame(0x10, 0x19, 0x04, 4, 0x8d, 0x20, 0xff, 0x24), st);
    expect(b.elapsedS).toBe(2);
    expect(b.distanceM).toBe(10);
    expect(b.hr).toBeUndefined();
  });

  it("reads power (12 bits) and cadence from the trainer page (0x19)", () => {
    // cadence 90, power LSB 0x2C + MSN 0x1 = 300 W, status nibble 0x3 ignored
    expect(parseFec(frame(0x19, 0x01, 90, 0x10, 0x27, 0x2c, 0x31, 0x30), freshFecState())).toEqual({ cadence: 90, power: 300 });
  });

  it("treats 0xFF cadence and 0xFFF power as absent", () => {
    expect(parseFec(frame(0x19, 0x01, 0xff, 0, 0, 0xff, 0x3f, 0x30), freshFecState())).toEqual({});
  });

  it("ignores pages it does not use and corrupt frames", () => {
    expect(parseFec(frame(0x50, 0, 0, 0, 0, 0, 0, 0), freshFecState())).toEqual({});
    const v = frame(0x19, 0x01, 90, 0, 0, 0x2c, 0x01, 0x30);
    v.setUint8(12, v.getUint8(12) ^ 0xff);
    expect(parseFec(v, freshFecState())).toEqual({});
  });
});
