/* ─────────────────────────────────────────────────────────────
   Wahoo's pre-FTMS trainer control.

   KICKR, KICKR Snap and KICKR Core on firmware older than their
   FTMS update report power through the standard Cycling Power
   service (0x1818, measurement 0x2A63 — decoded in ble-parse.ts)
   and take commands on a vendor characteristic inside that same
   service:

     a026e005-0a7d-4ab3-97fa-f1500f9feb8b

   Wahoo never published this protocol. The op codes and scalings
   below come from PUBLIC REVERSE-ENGINEERING NOTES (open-source
   trainer apps and forum write-ups) and are NOT VERIFIED ON
   HARDWARE here. wahoo.test.ts only checks that the bytes match
   those notes.

     0x20  unlock               EE FC
     0x42  ERG target           uint16 LE watts
     0x43  simulation init      weight kg×100, Crr×1000, wind Cw×1000 (uint16 LE each)
     0x46  simulation grade     uint16 LE = (grade/100 + 1) × 32768, clamped to 0…65535
   ───────────────────────────────────────────────────────────── */

export const WAHOO_CONTROL = "a026e005-0a7d-4ab3-97fa-f1500f9feb8b";

export const WAHOO_OP = {
  unlock: 0x20,
  erg: 0x42,
  simInit: 0x43,
  simGrade: 0x46,
} as const;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const u16 = (op: number, ...values: number[]) => {
  const b = new DataView(new ArrayBuffer(1 + values.length * 2));
  b.setUint8(0, op);
  values.forEach((v, i) => b.setUint16(1 + i * 2, clamp(Math.round(v), 0, 0xffff), true));
  return new Uint8Array(b.buffer);
};

/** Unverified on hardware: the unlock the legacy firmware is said to need
 *  before it obeys anything else. */
export const wahooUnlock = () => Uint8Array.of(WAHOO_OP.unlock, 0xee, 0xfc);

/** ERG: hold this many watts. Unverified on hardware. */
export const wahooErg = (watts: number) => u16(WAHOO_OP.erg, clamp(watts, 0, 2000));

/** Enter simulation mode with the rider's physics. Unverified on hardware. */
export const wahooSimInit = (weightKg: number, crr = 0.004, cw = 0.51) =>
  u16(WAHOO_OP.simInit, clamp(weightKg, 0, 655) * 100, crr * 1000, cw * 1000);

/** Simulation grade. Unverified on hardware. Grades beyond ±40 % are clamped
 *  like the FTMS path, then the raw value is clamped to 16 bits. */
export const wahooGrade = (gradePct: number) =>
  u16(WAHOO_OP.simGrade, (clamp(gradePct, -40, 40) / 100 + 1) * 32768);
