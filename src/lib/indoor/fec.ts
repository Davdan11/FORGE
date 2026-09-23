/* ─────────────────────────────────────────────────────────────
   Tacx FE-C over Bluetooth.

   Before Tacx shipped FTMS firmware, their trainers (Neo, Neo 2/2T,
   Flux, Flux S, Vortex Smart, Bushido Smart, Genius Smart…) spoke
   ANT+ FE-C over BLE: a vendor service whose two characteristics
   carry ANT messages verbatim.

     service  6e40fec1-b5a3-f393-e0a9-e50e24dcca9e
     notify   6e40fec2-…  the trainer's data pages
     write    6e40fec3-…  our command pages

   Each message is the ANT serial frame for a broadcast data
   message: sync 0xA4, length 9, message id 0x4E, channel 5, the
   8-byte FE-C page, then an XOR of every byte before it.

   Byte layouts follow the ANT+ Device Profile "Fitness Equipment"
   (FE-C), pages 0x10, 0x19, 0x31, 0x33 and 0x37. These encoders and
   decoders are SPEC-TESTED ONLY (fec.test.ts builds frames from the
   spec's byte tables); they have not yet been run against a real
   Tacx trainer.
   ───────────────────────────────────────────────────────────── */

import type { Reading } from "./ble-parse";

export const FEC_SERVICE = "6e40fec1-b5a3-f393-e0a9-e50e24dcca9e";
export const FEC_NOTIFY = "6e40fec2-b5a3-f393-e0a9-e50e24dcca9e";
export const FEC_WRITE = "6e40fec3-b5a3-f393-e0a9-e50e24dcca9e";

const SYNC = 0xa4;
const MSG_BROADCAST = 0x4e;
const MSG_ACKNOWLEDGED = 0x4f;
const CHANNEL = 0x05;

export const PAGE = {
  generalFe: 0x10,
  trainer: 0x19,
  targetPower: 0x31,
  trackResistance: 0x33,
  userConfig: 0x37,
} as const;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** XOR of every byte: the ANT serial checksum. */
export function antChecksum(bytes: ArrayLike<number>, end = bytes.length) {
  let x = 0;
  for (let i = 0; i < end; i++) x ^= bytes[i];
  return x;
}

/** Wrap an 8-byte FE-C page in an ANT broadcast message for channel 5. */
export function antFrame(page: Uint8Array): Uint8Array {
  if (page.length !== 8) throw new Error("An FE-C page is 8 bytes.");
  const out = new Uint8Array(13);
  out[0] = SYNC; out[1] = 9; out[2] = MSG_BROADCAST; out[3] = CHANNEL;
  out.set(page, 4);
  out[12] = antChecksum(out, 12);
  return out;
}

/** The 8-byte page inside an ANT message, or null when it is not one we trust
 *  (wrong sync, wrong length, not a data message, bad checksum). */
export function antPage(v: DataView): Uint8Array | null {
  if (v.byteLength < 13 || v.getUint8(0) !== SYNC) return null;
  const len = v.getUint8(1);
  if (len < 9 || v.byteLength < len + 4) return null;
  const id = v.getUint8(2);
  if (id !== MSG_BROADCAST && id !== MSG_ACKNOWLEDGED) return null;
  const bytes = new Uint8Array(v.buffer, v.byteOffset, len + 4);
  if (antChecksum(bytes, len + 3) !== bytes[len + 3]) return null;
  return bytes.slice(4, 12);
}

/* ── commands ─────────────────────────────────────────────── */

/**
 * Page 0x33 Track Resistance — the FE-C "slope" mode.
 * bytes 1–4 reserved 0xFF · bytes 5–6 grade, uint16 LE, 0.01 % units
 * offset by −200.00 % · byte 7 Crr in 5×10⁻⁵ units (0.004 → 80).
 */
export function fecTrackResistance(gradePct: number, crr = 0.004): Uint8Array {
  const p = new Uint8Array([PAGE.trackResistance, 0xff, 0xff, 0xff, 0xff, 0, 0, 0]);
  const raw = Math.round((clamp(gradePct, -40, 40) + 200) * 100);
  p[5] = raw & 0xff; p[6] = raw >> 8;
  p[7] = Math.round(clamp(crr, 0, 0.0127) / 0.00005);
  return antFrame(p);
}

/**
 * Page 0x31 Target Power — ERG.
 * bytes 1–5 reserved 0xFF · bytes 6–7 target power, uint16 LE, 0.25 W units.
 */
export function fecTargetPower(watts: number): Uint8Array {
  const p = new Uint8Array([PAGE.targetPower, 0xff, 0xff, 0xff, 0xff, 0xff, 0, 0]);
  const raw = Math.round(clamp(watts, 0, 4000) * 4);
  p[6] = raw & 0xff; p[7] = raw >> 8;
  return antFrame(p);
}

/**
 * Page 0x37 User Configuration — so the trainer's own slope physics use the
 * rider's mass rather than a default.
 * bytes 1–2 user weight uint16 LE 0.01 kg · byte 3 reserved 0xFF ·
 * byte 4 low nibble wheel-diameter offset (0xF = none), high nibble bike
 * weight bits 0–3 · byte 5 bike weight bits 4–11 (0.05 kg units) ·
 * byte 6 wheel diameter 0.01 m · byte 7 gear ratio (0 = invalid).
 */
export function fecUserConfig(riderKg: number, bikeKg = 8, wheelM = 0.7): Uint8Array {
  const user = Math.round(clamp(riderKg, 0, 655.34) * 100);
  const bike = Math.round(clamp(bikeKg, 0, 50) / 0.05);
  const p = new Uint8Array(8);
  p[0] = PAGE.userConfig;
  p[1] = user & 0xff; p[2] = user >> 8;
  p[3] = 0xff;
  p[4] = 0x0f | ((bike & 0x0f) << 4);
  p[5] = (bike >> 4) & 0xff;
  p[6] = Math.round(clamp(wheelM, 0, 2.54) * 100);
  p[7] = 0x00;
  return antFrame(p);
}

/* ── data pages ───────────────────────────────────────────── */

export interface FecState {
  /** Last raw rollover counters, to turn them into running totals. */
  elapsedRaw?: number;
  distanceRaw?: number;
  elapsedS: number;
  distanceM: number;
}

export const freshFecState = (): FecState => ({ elapsedS: 0, distanceM: 0 });

/**
 * Decode one notification from the FE-C notify characteristic.
 *
 * Page 0x10 General FE Data: byte 1 equipment type · byte 2 elapsed time
 * (0.25 s, rolls over at 64 s) · byte 3 distance (m, rolls over at 256) ·
 * bytes 4–5 speed uint16 LE 0.001 m/s · byte 6 heart rate (0xFF = none).
 *
 * Page 0x19 Specific Trainer Data: byte 1 event count · byte 2 cadence rpm
 * (0xFF = none) · bytes 3–4 accumulated power · byte 5 + low nibble of
 * byte 6 instantaneous power, 12 bits, 1 W (0xFFF = none).
 *
 * The rollover counters are accumulated into `state`, which belongs to one
 * connection.
 */
export function parseFec(v: DataView, state: FecState): Reading & { elapsedS?: number } {
  const p = antPage(v);
  if (!p) return {};

  if (p[0] === PAGE.generalFe) {
    const out: Reading & { elapsedS?: number } = {};
    const elapsed = p[2], dist = p[3];
    if (state.elapsedRaw != null) state.elapsedS += ((elapsed - state.elapsedRaw + 256) % 256) / 4;
    if (state.distanceRaw != null) state.distanceM += (dist - state.distanceRaw + 256) % 256;
    state.elapsedRaw = elapsed; state.distanceRaw = dist;
    out.elapsedS = state.elapsedS;
    out.distanceM = state.distanceM;
    out.speedMs = (p[4] | (p[5] << 8)) / 1000;
    if (p[6] !== 0xff && p[6] > 0) out.hr = p[6];
    return out;
  }

  if (p[0] === PAGE.trainer) {
    const out: Reading = {};
    if (p[2] !== 0xff) out.cadence = p[2];
    const power = p[5] | ((p[6] & 0x0f) << 8);
    if (power !== 0xfff) out.power = power;
    return out;
  }

  return {};
}
