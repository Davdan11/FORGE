/* ─────────────────────────────────────────────────────────────
   Telling a trainer or treadmill what to do: the Fitness Machine
   Control Point (0x2AD9), Bluetooth SIG FTMS 1.0.

   Every command is an op code and little-endian parameters. The
   machine answers each one with an indication: 0x80, the op code
   it is answering, and a result (0x01 = success). Nothing is
   obeyed until control has been requested and granted, so the
   order is always: request control, start, then set targets.

   Pure byte building and parsing, so it can be tested without
   the hardware — the same reason the decoders live apart.
   ───────────────────────────────────────────────────────────── */

export const OP = {
  requestControl: 0x00,
  reset: 0x01,
  setTargetSpeed: 0x02,
  setTargetIncline: 0x03,
  setTargetPower: 0x05,
  start: 0x07,
  stop: 0x08,
  setSimulation: 0x11,
  response: 0x80,
} as const;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const cmdRequestControl = () => Uint8Array.of(OP.requestControl);
export const cmdStart = () => Uint8Array.of(OP.start);
export const cmdStop = () => Uint8Array.of(OP.stop, 0x01);

/**
 * Indoor Bike Simulation Parameters: the trainer works out resistance itself
 * from grade, wind, rolling and air resistance — the "slope" mode.
 * wind sint16 0.001 m/s · grade sint16 0.01 % · crr uint8 0.0001 · cw uint8 0.01 kg/m
 */
export function cmdSimulation(gradePct: number, opts: { windMs?: number; crr?: number; cw?: number } = {}) {
  const b = new DataView(new ArrayBuffer(7));
  b.setUint8(0, OP.setSimulation);
  b.setInt16(1, Math.round(clamp(opts.windMs ?? 0, -32, 32) * 1000), true);
  b.setInt16(3, Math.round(clamp(gradePct, -40, 40) * 100), true);
  b.setUint8(5, Math.round(clamp(opts.crr ?? 0.004, 0, 0.0255) * 10000));
  b.setUint8(6, Math.round(clamp(opts.cw ?? 0.51, 0, 2.55) * 100));
  return new Uint8Array(b.buffer);
}

/** ERG: hold this many watts whatever the cadence. sint16, 1 W. */
export function cmdTargetPower(watts: number) {
  const b = new DataView(new ArrayBuffer(3));
  b.setUint8(0, OP.setTargetPower);
  b.setInt16(1, Math.round(clamp(watts, 0, 2000)), true);
  return new Uint8Array(b.buffer);
}

/** Treadmill belt speed. uint16, 0.01 km/h. */
export function cmdTargetSpeed(ms: number) {
  const b = new DataView(new ArrayBuffer(3));
  b.setUint8(0, OP.setTargetSpeed);
  b.setUint16(1, Math.round(clamp(ms * 3.6, 0, 25) * 100), true);
  return new Uint8Array(b.buffer);
}

/** Treadmill incline. sint16, 0.1 %. */
export function cmdTargetIncline(pct: number) {
  const b = new DataView(new ArrayBuffer(3));
  b.setUint8(0, OP.setTargetIncline);
  b.setInt16(1, Math.round(clamp(pct, -5, 40) * 10), true);
  return new Uint8Array(b.buffer);
}

/** The machine's answer to a command, or null if this is not a response. */
export function parseResponse(v: DataView): { op: number; ok: boolean; result: number } | null {
  if (v.byteLength < 3 || v.getUint8(0) !== OP.response) return null;
  const result = v.getUint8(2);
  return { op: v.getUint8(1), ok: result === 0x01, result };
}

export const RESULT_TEXT: Record<number, string> = {
  0x01: "OK",
  0x02: "not supported by this machine",
  0x03: "value out of range",
  0x04: "refused",
  0x05: "control not granted",
};

/**
 * When to send the next grade. Trainers take roughly one command a second and
 * drop or queue anything faster; a grade that moved less than half a percent
 * is not worth a command. A repeat every ten seconds keeps control alive on
 * trainers that give it up when nothing arrives.
 */
export function shouldSendGrade(lastSent: number | null, grade: number, lastAtMs: number, nowMs: number) {
  if (nowMs - lastAtMs < 1000) return false;
  return lastSent == null || Math.abs(grade - lastSent) >= 0.5 || nowMs - lastAtMs > 10000;
}
