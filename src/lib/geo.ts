import type { TrackPoint } from "./types";

export function haversine(a: TrackPoint, b: TrackPoint) {
  const R = 6371000, toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Summarise a track: distance, elevation gain/loss, moving time, max speed, per-km splits. */
export function summarise(points: TrackPoint[]) {
  let distanceM = 0, elevGainM = 0, elevLossM = 0, movingMs = 0, maxSpeedMs = 0, lastAlt: number | undefined;
  const splits: { km: number; sec: number }[] = [];
  let splitStartT = points[0]?.t ?? 0, nextKm = 1000;
  for (let i = 1; i < points.length; i++) {
    const d = haversine(points[i - 1], points[i]);
    const dt = points[i].t - points[i - 1].t;
    distanceM += d;
    if (dt > 0) { const v = d / (dt / 1000); if (v > 0.5) movingMs += dt; if (v > maxSpeedMs && v < 30) maxSpeedMs = v; }
    const alt = points[i].alt;
    if (alt != null && lastAlt != null) { const diff = alt - lastAlt; if (diff > 0.5) elevGainM += diff; else if (diff < -0.5) elevLossM += -diff; }
    if (alt != null) lastAlt = alt;
    while (distanceM >= nextKm) {
      splits.push({ km: nextKm / 1000, sec: (points[i].t - splitStartT) / 1000 });
      splitStartT = points[i].t;
      nextKm += 1000;
    }
  }
  const durationSec = points.length > 1 ? (points[points.length - 1].t - points[0].t) / 1000 : 0;
  return { distanceM, elevGainM, elevLossM, splits, durationSec, movingSec: Math.round(movingMs / 1000), maxSpeedMs, avgPaceSecKm: distanceM > 0 ? durationSec / (distanceM / 1000) : undefined };
}

/** Drop GPS noise: bad accuracy, teleports, duplicates. */
export function acceptPoint(prev: TrackPoint | undefined, p: TrackPoint) {
  if (p.acc != null && p.acc > 35) return false;
  if (!prev) return true;
  const d = haversine(prev, p), dt = (p.t - prev.t) / 1000;
  if (dt <= 0) return false;
  if (d / dt > 30) return false; // > 108 km/h = glitch
  if (d < 1.5) return false;
  return true;
}

/** Elevation profile resampled to N points (distance on x, altitude on y). */
export function elevationProfile(points: TrackPoint[], n = 60): { d: number; alt: number }[] {
  const withAlt = points.filter((p) => p.alt != null);
  if (withAlt.length < 2) return [];
  const cum: { d: number; alt: number }[] = [{ d: 0, alt: withAlt[0].alt! }];
  for (let i = 1; i < withAlt.length; i++) cum.push({ d: cum[i - 1].d + haversine(withAlt[i - 1], withAlt[i]), alt: withAlt[i].alt! });
  const total = cum[cum.length - 1].d; if (total <= 0) return [];
  const out: { d: number; alt: number }[] = [];
  let j = 0;
  for (let k = 0; k < n; k++) {
    const target = (total * k) / (n - 1);
    while (j < cum.length - 2 && cum[j + 1].d < target) j++;
    const a = cum[j], b = cum[j + 1] ?? a;
    const f = b.d === a.d ? 0 : (target - a.d) / (b.d - a.d);
    out.push({ d: target, alt: a.alt + (b.alt - a.alt) * f });
  }
  // light smoothing
  return out.map((p, i) => ({ d: p.d, alt: (out[Math.max(0, i - 1)].alt + p.alt + out[Math.min(out.length - 1, i + 1)].alt) / 3 }));
}

/** Pace per segment of the route (for pace-coloured lines), in sec/km, one value per point pair. */
export function paceSeries(points: TrackPoint[]) {
  const out: number[] = [];
  for (let i = 1; i < points.length; i++) {
    const d = haversine(points[i - 1], points[i]);
    const dt = (points[i].t - points[i - 1].t) / 1000;
    out.push(d > 0 ? dt / (d / 1000) : Infinity);
  }
  return out;
}
