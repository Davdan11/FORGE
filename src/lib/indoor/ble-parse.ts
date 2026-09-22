/* ─────────────────────────────────────────────────────────────
   Decoding what a fitness sensor actually says.

   Four kinds of hardware, four byte layouts, all of them
   variable-length with a flags word at the front deciding which
   fields are present and in which order. Get an offset wrong and
   you do not crash — you read cadence as power and the avatar
   sprints up a hill at 900 W. Silent, plausible, wrong.

   So the parsing lives here as pure functions over a DataView,
   with no Bluetooth anywhere near it. That is the only part of
   this feature that can be tested without owning the hardware,
   and it is the part most likely to be wrong.

   Field orders follow the Bluetooth SIG specifications:
   Heart Rate Service 0x180D, Cycling Power 0x1818,
   Cycling Speed and Cadence 0x1816, Fitness Machine 0x1826,
   Running Speed and Cadence 0x1814.
   ───────────────────────────────────────────────────────────── */

/** Everything a sensor might tell us, all optional. A heart-rate strap fills
 *  one field; a good trainer fills four. */
export interface Reading {
  /** Watts at the pedals. Measured, never inferred, when this is set. */
  power?: number;
  /** Beats per minute. */
  hr?: number;
  /** Revolutions per minute. */
  cadence?: number;
  /** Metres per second, as reported by the machine. */
  speedMs?: number;
  /** Cumulative metres, when the machine counts them itself. */
  distanceM?: number;
  /** Treadmill incline, percent. */
  inclinePct?: number;
}

/* ── Heart Rate Measurement (0x2A37) ──────────────────────────
   byte 0: flags. bit 0 picks the width of the value that follows,
   which is the whole reason this cannot be a fixed offset. */
export function parseHeartRate(v: DataView): Reading {
  if (v.byteLength < 2) return {};
  const flags = v.getUint8(0);
  const wide = (flags & 0x01) !== 0;
  if (wide && v.byteLength < 3) return {};
  const hr = wide ? v.getUint16(1, true) : v.getUint8(1);
  // 0 is what a strap sends when it has lost contact with skin, not a reading.
  return hr > 0 ? { hr } : {};
}

/* ── Cycling Power Measurement (0x2A63) ───────────────────────
   uint16 flags, then a signed instantaneous power that is always
   present — the one field here we can count on. */
export function parseCyclingPower(v: DataView, prev?: CrankState): Reading & { crank?: CrankState } {
  if (v.byteLength < 4) return {};
  const flags = v.getUint16(0, true);
  const power = v.getInt16(2, true);
  let o = 4;

  if (flags & 0x0001) o += 1;              // pedal power balance, uint8
  if (flags & 0x0004) o += 2;              // accumulated torque, uint16
  if (flags & 0x0010) o += 6;              // wheel revolution data, uint32 + uint16

  // Crank data is how a power meter reports cadence: a running count of
  // revolutions and the time of the last one, so cadence is a rate between
  // two notifications rather than a number the sensor sends.
  let crank: CrankState | undefined;
  let cadence: number | undefined;
  if (flags & 0x0020 && v.byteLength >= o + 4) {
    crank = { revs: v.getUint16(o, true), time1024: v.getUint16(o + 2, true) };
    cadence = cadenceFrom(prev, crank);
  }

  return { power, cadence, crank };
}

/* ── CSC Measurement (0x2A5B) ─────────────────────────────────
   A cheap magnet sensor. Same cumulative-count idea, one byte of
   flags instead of two. */
export function parseCsc(v: DataView, prev?: CscState, wheelCircumferenceM = 2.105): Reading & { csc?: CscState } {
  if (v.byteLength < 1) return {};
  const flags = v.getUint8(0);
  let o = 1;

  const next: CscState = {};
  let speedMs: number | undefined;
  let cadence: number | undefined;

  if (flags & 0x01) {                       // wheel revolution data
    if (v.byteLength < o + 6) return {};
    next.wheel = { revs: v.getUint32(o, true), time1024: v.getUint16(o + 4, true) };
    o += 6;
    const d = delta(prev?.wheel, next.wheel, 0xFFFFFFFF);
    // A default 2.105 m circumference is a 700×25c tyre. Wrong for a 650b or a
    // fat bike, so it belongs in settings eventually — but a wrong-by-5% speed
    // beats no speed at all.
    if (d) speedMs = (d.revs * wheelCircumferenceM) / d.seconds;
  }

  if (flags & 0x02) {                       // crank revolution data
    if (v.byteLength < o + 4) return { speedMs, csc: next };
    next.crank = { revs: v.getUint16(o, true), time1024: v.getUint16(o + 2, true) };
    const d = delta(prev?.crank, next.crank, 0xFFFF);
    if (d) cadence = (d.revs / d.seconds) * 60;
  }

  return { speedMs, cadence, csc: next };
}

/* ── FTMS Indoor Bike Data (0x2AD2) ───────────────────────────
   The richest and the most treacherous. Thirteen optional fields
   in a fixed order, and bit 0 is inverted: it is "More Data", so
   instantaneous speed is present when the bit is CLEAR. Reading
   that bit the obvious way shifts every later field by two bytes. */
export function parseIndoorBike(v: DataView): Reading {
  if (v.byteLength < 2) return {};
  const flags = v.getUint16(0, true);
  let o = 2;
  const out: Reading = {};

  const take = (n: number) => { const at = o; o += n; return v.byteLength >= o ? at : -1; };

  if (!(flags & 0x0001)) { const at = take(2); if (at >= 0) out.speedMs = (v.getUint16(at, true) / 100) / 3.6; }
  if (flags & 0x0002) take(2);                                            // average speed
  if (flags & 0x0004) { const at = take(2); if (at >= 0) out.cadence = v.getUint16(at, true) / 2; }
  if (flags & 0x0008) take(2);                                            // average cadence
  if (flags & 0x0010) { const at = take(3); if (at >= 0) out.distanceM = v.getUint8(at) | (v.getUint8(at + 1) << 8) | (v.getUint8(at + 2) << 16); }
  if (flags & 0x0020) take(2);                                            // resistance level
  if (flags & 0x0040) { const at = take(2); if (at >= 0) out.power = v.getInt16(at, true); }
  if (flags & 0x0080) take(2);                                            // average power
  if (flags & 0x0100) take(5);                                            // expended energy
  if (flags & 0x0200) { const at = take(1); if (at >= 0) out.hr = v.getUint8(at); }

  return out;
}

/* ── FTMS Treadmill Data (0x2ACD) ─────────────────────────────
   Same shape as Indoor Bike Data — flags, then optional fields in
   a fixed order, bit 0 inverted ("More Data") — with running
   fields: distance, incline and ramp angle, elevation, pace,
   energy, heart rate. Speed and incline are what move the runner. */
export function parseTreadmill(v: DataView): Reading {
  if (v.byteLength < 2) return {};
  const flags = v.getUint16(0, true);
  let o = 2;
  const out: Reading = {};

  const take = (n: number) => { const at = o; o += n; return v.byteLength >= o ? at : -1; };

  if (!(flags & 0x0001)) { const at = take(2); if (at >= 0) out.speedMs = (v.getUint16(at, true) / 100) / 3.6; }
  if (flags & 0x0002) take(2);                                            // average speed
  if (flags & 0x0004) { const at = take(3); if (at >= 0) out.distanceM = v.getUint8(at) | (v.getUint8(at + 1) << 8) | (v.getUint8(at + 2) << 16); }
  if (flags & 0x0008) { const at = take(4); if (at >= 0) out.inclinePct = v.getInt16(at, true) / 10; } // incline + ramp angle
  if (flags & 0x0010) take(4);                                            // elevation gain, positive and negative
  if (flags & 0x0020) take(1);                                            // instantaneous pace
  if (flags & 0x0040) take(1);                                            // average pace
  if (flags & 0x0080) take(5);                                            // expended energy
  if (flags & 0x0100) { const at = take(1); if (at >= 0) out.hr = v.getUint8(at); }

  return out;
}

/* ── RSC Measurement (0x2A53) — a running footpod ─────────────
   uint8 flags; speed (uint16, 1/256 m/s) and cadence (uint8,
   steps per minute) always present; then stride length and total
   distance when their flag bits say so. */
export function parseRsc(v: DataView): Reading {
  if (v.byteLength < 4) return {};
  const flags = v.getUint8(0);
  const out: Reading = { speedMs: v.getUint16(1, true) / 256, cadence: v.getUint8(3) };
  let o = 4;
  if (flags & 0x01) o += 2;                                               // stride length
  if (flags & 0x02 && v.byteLength >= o + 4) out.distanceM = v.getUint32(o, true) / 10;
  return out;
}

/* ── cumulative counters ──────────────────────────────────────
   Both cycling profiles report totals, not rates. Turning them
   into a rate means two notifications and a subtraction — and
   the counters wrap, so a naive subtraction goes negative and
   the avatar stops dead once every few minutes. */

export interface Rev { revs: number; time1024: number }
export type CrankState = Rev;
export interface CscState { wheel?: Rev; crank?: Rev }

function delta(prev: Rev | undefined, next: Rev, revMax: number): { revs: number; seconds: number } | null {
  if (!prev) return null;
  // Event time is 1/1024 s and always wraps at 16 bits — about 64 seconds.
  const ticks = (next.time1024 - prev.time1024 + 0x10000) % 0x10000;
  if (ticks === 0) return null;                    // no new event: coasting
  const revs = (next.revs - prev.revs + revMax + 1) % (revMax + 1);
  return { revs, seconds: ticks / 1024 };
}

function cadenceFrom(prev: Rev | undefined, next: Rev): number | undefined {
  const d = delta(prev, next, 0xFFFF);
  if (!d) return undefined;
  const rpm = (d.revs / d.seconds) * 60;
  // Above 250 rpm is a decoding fault or a wrap we mishandled, not a human.
  return rpm >= 0 && rpm < 250 ? rpm : undefined;
}
