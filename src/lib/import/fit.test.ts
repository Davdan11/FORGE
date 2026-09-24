import { describe, expect, it } from "vitest";
import { bestPower, FitError, parseFit } from "./fit";
import { detectPlatform, importedActivity, isDuplicate, platformTotals } from "./platforms";

/* A tiny FIT writer, enough to build real files for the parser: definition + data records, little-endian. */
type F = [num: number, size: number, type: number, value: number | string];
function fitFile(messages: { local: number; global: number; fields: F[]; compressed?: number }[]): ArrayBuffer {
  const body: number[] = [];
  const defined = new Map<number, string>();
  const u16 = (x: number) => [x & 0xff, (x >> 8) & 0xff];
  const u32 = (x: number) => [x & 0xff, (x >> 8) & 0xff, (x >> 16) & 0xff, (x >>> 24) & 0xff];
  for (const m of messages) {
    const sig = `${m.global}:${m.fields.map((f) => f.slice(0, 3).join(",")).join(";")}`;
    if (defined.get(m.local) !== sig) {
      body.push(0x40 | m.local, 0, 0, ...u16(m.global), m.fields.length);
      for (const [num, size, type] of m.fields) body.push(num, size, type);
      defined.set(m.local, sig);
    }
    body.push(m.compressed !== undefined ? 0x80 | (m.local << 5) | m.compressed : m.local);
    for (const [, size, , value] of m.fields) {
      if (typeof value === "string") { const b = [...new TextEncoder().encode(value)]; for (let i = 0; i < size; i++) body.push(b[i] ?? 0); }
      else if (size === 1) body.push(value & 0xff);
      else if (size === 2) body.push(...u16(value));
      else body.push(...u32(value));
    }
  }
  const header = [14, 0x20, ...u16(2140), ...u32(body.length), 0x2e, 0x46, 0x49, 0x54, 0, 0];
  return new Uint8Array([...header, ...body, 0, 0]).buffer;
}

const START = 1_000_000_000; // FIT seconds (2021-09-08)
function ride(opts: { maker: number; product?: string; sportName?: string; watts: number; seconds: number }) {
  const msgs: { local: number; global: number; fields: F[]; compressed?: number }[] = [
    { local: 0, global: 0, fields: [[1, 2, 0x84, opts.maker], [2, 2, 0x84, 1], ...(opts.product ? [[8, 20, 0x07, opts.product] as F] : [])] },
  ];
  if (opts.sportName) msgs.push({ local: 1, global: 12, fields: [[3, 16, 0x07, opts.sportName]] });
  for (let i = 0; i < opts.seconds; i++) {
    // Every 10th record has a full timestamp; the others a compressed one.
    if (i % 10 === 0) msgs.push({ local: 2, global: 20, fields: [[253, 4, 0x86, START + i], [7, 2, 0x84, opts.watts], [3, 1, 0x02, 140], [5, 4, 0x86, i * 1000]] });
    else msgs.push({ local: 3, global: 20, fields: [[7, 2, 0x84, opts.watts], [3, 1, 0x02, 140], [5, 4, 0x86, i * 1000]], compressed: (START + i) & 0x1f });
  }
  msgs.push({ local: 4, global: 18, fields: [[2, 4, 0x86, START], [7, 4, 0x86, opts.seconds * 1000], [8, 4, 0x86, opts.seconds * 1000], [9, 4, 0x86, opts.seconds * 1000], [22, 2, 0x84, 120], [20, 2, 0x84, opts.watts], [21, 2, 0x84, opts.watts + 200], [16, 1, 0x02, 140], [5, 1, 0x00, 2], [6, 1, 0x00, 58]] });
  return fitFile(msgs);
}

describe("FIT import", () => {
  it("reads a Zwift ride: totals, maker, per-second power, best efforts", () => {
    const r = parseFit(ride({ maker: 260, watts: 250, seconds: 1300 }));
    expect(r.manufacturer).toBe(260);
    expect(r.start.toISOString()).toBe(new Date((START + 631065600) * 1000).toISOString());
    expect(r.elapsedSec).toBe(1300);
    expect(r.distanceM).toBe(13000);
    expect(r.ascentM).toBe(120);
    expect(r.avgW).toBe(250);
    expect(r.subSport).toBe(58);
    // Compressed timestamps land on the right seconds: no hole in the series.
    expect(r.seconds.w.length).toBe(1300);
    expect(r.seconds.w.every((w) => w === 250)).toBe(true);
    expect(bestPower(r.seconds.w, 1200)).toBe(250);
    expect(detectPlatform(r)).toBe("zwift");
  });

  it("tells the platform from names inside the file, then from its name", () => {
    expect(detectPlatform(parseFit(ride({ maker: 255, product: "MyWhoosh", watts: 200, seconds: 30 })))).toBe("mywhoosh");
    expect(detectPlatform(parseFit(ride({ maker: 255, sportName: "ROUVY ride", watts: 200, seconds: 30 })))).toBe("rouvy");
    expect(detectPlatform({ manufacturer: 255, names: [] }, "2026-09-20_SYSTM_workout.fit")).toBe("wahoo");
    expect(detectPlatform({ manufacturer: 255, names: [] }, "ride.fit")).toBeNull();
  });

  it("refuses what is not a FIT file", () => {
    expect(() => parseFit(new TextEncoder().encode("<gpx>not fit at all</gpx>").buffer as ArrayBuffer)).toThrow(FitError);
  });

  it("keeps each platform apart and skips a file already imported", () => {
    const z = importedActivity(parseFit(ride({ maker: 260, watts: 250, seconds: 1300 })), "zwift", "z.fit", "a1");
    const w = importedActivity(parseFit(ride({ maker: 255, product: "MyWhoosh", watts: 180, seconds: 600 })), "mywhoosh", "w.fit", "a2");
    expect(z.xp).toBe(0);
    expect(z.meta?.imported?.best20min).toBe(250);
    expect(isDuplicate(z, [w])).toBe(false);
    expect(isDuplicate({ ...z, startedAt: new Date(Date.parse(z.startedAt) + 30_000).toISOString() }, [z])).toBe(true);
    const totals = platformTotals([z, w, { ...z, id: "a3" }]);
    expect(totals.map((t) => t.platform.id)).toEqual(["zwift", "mywhoosh"]);
    expect(totals[0].rides).toBe(2);
    expect(totals[0].km).toBeCloseTo(26);
    expect(totals[1].avgW).toBe(180);
  });
});
