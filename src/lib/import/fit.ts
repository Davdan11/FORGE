/* ─────────────────────────────────────────────────────────────
   Reading a .fit file: the format every trainer app and bike
   computer exports (Zwift, MyWhoosh, Rouvy, Wahoo SYSTM,
   TrainerRoad, Garmin, …).

   A FIT file is a stream of records. A "definition" record says
   which fields the next data records of that kind carry (number,
   size, type, byte order); "data" records then carry the values.
   We read what a ride summary needs: who made the file (file_id,
   device_info, the sport's name), the session totals, and the
   per-second records for best efforts. Everything else is skipped
   by size, so an unknown message never derails the parse.

   Pure: an ArrayBuffer in, plain numbers out. No network, no
   dependency, and a file that isn't FIT fails with a clear error.
   ───────────────────────────────────────────────────────────── */

/** Seconds between the Unix epoch and FIT's (1989-12-31 00:00 UTC). */
const FIT_EPOCH = 631065600;

export interface FitRide {
  start: Date;
  /** Wall time and moving time, seconds. */
  elapsedSec: number;
  movingSec: number;
  distanceM: number;
  ascentM: number;
  avgW?: number;
  maxW?: number;
  normalizedW?: number;
  avgHr?: number;
  maxHr?: number;
  avgCadence?: number;
  kcal?: number;
  /** FIT sport / sub-sport numbers (2 = cycling; sub 6 = indoor, 58 = virtual activity). */
  sport?: number;
  subSport?: number;
  /** Who wrote it: manufacturer and product ids, and every name found (product names, sport name, software). */
  manufacturer?: number;
  product?: number;
  names: string[];
  /** One sample a second from the records (-1 = no reading). */
  seconds: { t: number[]; w: number[]; hr: number[]; cad: number[]; d: number[]; alt: number[] };
}

type Field = { num: number; size: number; type: number };
type Def = { global: number; little: boolean; fields: Field[]; devBytes: number };

export class FitError extends Error {}

export function parseFit(buffer: ArrayBuffer): FitRide {
  const v = new DataView(buffer);
  if (v.byteLength < 14) throw new FitError("too short");
  const headerSize = v.getUint8(0);
  if (headerSize < 12 || v.byteLength < headerSize) throw new FitError("bad header");
  if (String.fromCharCode(v.getUint8(8), v.getUint8(9), v.getUint8(10), v.getUint8(11)) !== ".FIT") throw new FitError("not a FIT file");
  const end = Math.min(v.byteLength, headerSize + v.getUint32(4, true));

  const defs = new Map<number, Def>();
  const out: FitRide = { start: new Date(0), elapsedSec: 0, movingSec: 0, distanceM: 0, ascentM: 0, names: [], seconds: { t: [], w: [], hr: [], cad: [], d: [], alt: [] } };
  const records: { ts: number; w: number; hr: number; cad: number; d: number; alt: number }[] = [];
  let lastTs = 0, sessions = 0;

  let o = headerSize;
  while (o < end) {
    const h = v.getUint8(o++);
    let local: number, timeOffset = -1;
    if (h & 0x80) { local = (h >> 5) & 0x03; timeOffset = h & 0x1f; }        // compressed timestamp header (data)
    else if (h & 0x40) {                                                      // definition
      local = h & 0x0f;
      const dev = (h & 0x20) !== 0;
      if (o + 5 > end) break;
      const little = v.getUint8(o + 1) === 0;
      const global = v.getUint16(o + 2, little);
      const n = v.getUint8(o + 4); o += 5;
      const fields: Field[] = [];
      for (let i = 0; i < n && o + 3 <= end; i++, o += 3) fields.push({ num: v.getUint8(o), size: v.getUint8(o + 1), type: v.getUint8(o + 2) });
      let devBytes = 0;
      if (dev && o < end) { const nd = v.getUint8(o++); for (let i = 0; i < nd && o + 3 <= end; i++, o += 3) devBytes += v.getUint8(o + 1); }
      defs.set(local, { global, little, fields, devBytes });
      continue;
    } else local = h & 0x0f;

    const def = defs.get(local);
    if (!def) throw new FitError("data before its definition");
    const values = new Map<number, number | string>();
    for (const f of def.fields) {
      if (o + f.size > end) { o = end; break; }
      const val = read(v, o, f, def.little);
      if (val !== undefined) values.set(f.num, val);
      o += f.size;
    }
    o += def.devBytes;

    // A compressed header carries the last 5 bits of the timestamp.
    let ts = typeof values.get(253) === "number" ? (values.get(253) as number) : -1;
    if (timeOffset >= 0) { ts = (lastTs & ~0x1f) + timeOffset; if (ts < lastTs) ts += 0x20; }
    if (ts > 0) lastTs = ts;

    const num = (k: number) => { const x = values.get(k); return typeof x === "number" ? x : undefined; };
    const str = (k: number) => { const x = values.get(k); return typeof x === "string" && x.trim() ? x.trim() : undefined; };
    switch (def.global) {
      case 0: // file_id
        out.manufacturer ??= num(1); out.product ??= num(2);
        if (str(8)) out.names.push(str(8)!);
        break;
      case 23: // device_info: the creator is device index 0
        if (num(0) === 0 || num(0) === undefined) { out.manufacturer ??= num(2); }
        if (str(27)) out.names.push(str(27)!);
        break;
      case 12: // sport (its name, e.g. "Virtual Ride", or the app's own)
        if (str(3)) out.names.push(str(3)!);
        break;
      case 49: // file_creator: software version only, no name
        break;
      case 18: { // session: add up (a file can hold several)
        sessions++;
        const start = num(2);
        if (start && (sessions === 1 || start + FIT_EPOCH < out.start.getTime() / 1000)) out.start = new Date((start + FIT_EPOCH) * 1000);
        out.elapsedSec += (num(7) ?? 0) / 1000;
        out.movingSec += (num(8) ?? num(7) ?? 0) / 1000;
        out.distanceM += (num(9) ?? 0) / 100;
        out.ascentM += num(22) ?? 0;
        out.sport ??= num(5); out.subSport ??= num(6);
        out.avgW ??= num(20); out.maxW = Math.max(out.maxW ?? 0, num(21) ?? 0) || undefined;
        out.normalizedW ??= num(34);
        out.avgHr ??= num(16); out.maxHr = Math.max(out.maxHr ?? 0, num(17) ?? 0) || undefined;
        out.avgCadence ??= num(18);
        out.kcal = (out.kcal ?? 0) + (num(11) ?? 0) || undefined;
        break;
      }
      case 20: // record
        if (ts > 0) records.push({ ts, w: num(7) ?? -1, hr: num(3) ?? -1, cad: num(4) ?? -1, d: num(5) !== undefined ? num(5)! / 100 : -1, alt: num(2) !== undefined ? num(2)! / 5 - 500 : -1 });
        break;
    }
  }

  if (!sessions && !records.length) throw new FitError("no ride in this file");
  // One sample a second from the records (the last reading of each second, gaps left empty).
  if (records.length) {
    const t0 = records[0].ts;
    if (!sessions) out.start = new Date((t0 + FIT_EPOCH) * 1000);
    const last = records[records.length - 1].ts - t0;
    if (last >= 0 && last < 60 * 60 * 24) {
      const s = out.seconds;
      for (let i = 0; i <= last; i++) { s.t.push(i); s.w.push(-1); s.hr.push(-1); s.cad.push(-1); s.d.push(-1); s.alt.push(-1); }
      for (const r of records) { const i = r.ts - t0; s.w[i] = r.w; s.hr[i] = r.hr; s.cad[i] = r.cad; s.d[i] = r.d; s.alt[i] = r.alt; }
    }
    if (!sessions) {
      out.elapsedSec = last;
      out.movingSec = last;
      out.distanceM = Math.max(0, ...records.map((r) => r.d));
    }
    if (out.avgW === undefined) { const ws = records.map((r) => r.w).filter((w) => w >= 0); if (ws.length) out.avgW = Math.round(ws.reduce((a, b) => a + b, 0) / ws.length); }
  }
  return out;
}

/** One field's value, or undefined when it holds FIT's "invalid" marker. Arrays give their first element. */
function read(v: DataView, o: number, f: Field, little: boolean): number | string | undefined {
  const base = f.type & 0x1f;
  switch (base) {
    case 0x07: { // string, zero-terminated, UTF-8
      const bytes: number[] = [];
      for (let i = 0; i < f.size; i++) { const b = v.getUint8(o + i); if (!b) break; bytes.push(b); }
      return new TextDecoder().decode(new Uint8Array(bytes));
    }
    case 0x00: case 0x02: case 0x0a: case 0x0d: { const x = v.getUint8(o); return x === 0xff || (base === 0x0a && x === 0) ? undefined : x; }
    case 0x01: { const x = v.getInt8(o); return x === 0x7f ? undefined : x; }
    case 0x03: { if (f.size < 2) return undefined; const x = v.getInt16(o, little); return x === 0x7fff ? undefined : x; }
    case 0x04: case 0x0b: { if (f.size < 2) return undefined; const x = v.getUint16(o, little); return x === 0xffff || (base === 0x0b && x === 0) ? undefined : x; }
    case 0x05: { if (f.size < 4) return undefined; const x = v.getInt32(o, little); return x === 0x7fffffff ? undefined : x; }
    case 0x06: case 0x0c: { if (f.size < 4) return undefined; const x = v.getUint32(o, little); return x === 0xffffffff || (base === 0x0c && x === 0) ? undefined : x; }
    case 0x08: { if (f.size < 4) return undefined; const x = v.getFloat32(o, little); return Number.isFinite(x) ? x : undefined; }
    case 0x09: { if (f.size < 8) return undefined; const x = v.getFloat64(o, little); return Number.isFinite(x) ? x : undefined; }
    default: return undefined; // 64-bit integers and anything unknown: skipped
  }
}

/** Best average power over `seconds` (null when the ride is shorter or has no power). */
export function bestPower(w: number[], seconds: number): number | null {
  if (w.length < seconds) return null;
  let sum = 0, n = 0, best = -1;
  const val = (i: number) => (w[i] >= 0 ? w[i] : 0);
  for (let i = 0; i < w.length; i++) {
    sum += val(i); if (w[i] >= 0) n++;
    if (i >= seconds) { sum -= val(i - seconds); if (w[i - seconds] >= 0) n--; }
    if (i >= seconds - 1 && n >= seconds * 0.8) best = Math.max(best, sum / seconds);
  }
  return best < 0 ? null : Math.round(best);
}
