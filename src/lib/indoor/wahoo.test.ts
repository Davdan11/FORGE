import { describe, expect, it } from "vitest";
import { wahooErg, wahooGrade, wahooSimInit, wahooUnlock } from "./wahoo";

/* Checked against public reverse-engineering notes for the pre-FTMS Wahoo
   trainer characteristic, NOT against a trainer. If a KICKR ignores these,
   the notes (or our reading of them) are wrong, not the arithmetic. */

const hex = (u: Uint8Array) => [...u].map((b) => b.toString(16).padStart(2, "0")).join(" ");

describe("Wahoo legacy commands", () => {
  it("unlock is op 0x20 with EE FC", () => {
    expect(hex(wahooUnlock())).toBe("20 ee fc");
  });

  it("ERG target is op 0x42 with uint16 LE watts", () => {
    expect(hex(wahooErg(250))).toBe("42 fa 00");
    expect(hex(wahooErg(-10))).toBe("42 00 00");
  });

  it("simulation init is op 0x43: weight ×100, Crr ×1000, Cw ×1000", () => {
    // 83 kg → 8300 = 0x206C · 0.004 → 4 · 0.51 → 510 = 0x01FE
    expect(hex(wahooSimInit(83))).toBe("43 6c 20 04 00 fe 01");
  });

  it("grade is op 0x46: (grade/100 + 1) × 32768", () => {
    expect(hex(wahooGrade(0))).toBe("46 00 80");
    expect(hex(wahooGrade(5))).toBe("46 66 86");    // 34406.4 → 34406
    expect(hex(wahooGrade(-5))).toBe("46 9a 79");   // 31129.6 → 31130
  });

  it("clamps grade to ±40 % and the raw value to 16 bits", () => {
    expect(new DataView(wahooGrade(99).buffer).getUint16(1, true)).toBe(45875);
    expect(new DataView(wahooGrade(-99).buffer).getUint16(1, true)).toBe(19661);
  });
});
