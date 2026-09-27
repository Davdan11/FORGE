/* ─────────────────────────────────────────────────────────────
   Outdoor activities from other apps: GPX (Strava, Komoot, most
   watches) and TCX (Garmin Connect, Polar, Suunto). What comes out
   is the same thing the phone's own GPS recording gives the Move
   page (points, heart rate, the sport), so an imported run lands
   in the usual save sheet with its splits, climb and XP.
   ───────────────────────────────────────────────────────────── */

import type { ActivityType, TrackPoint } from "@/lib/types";

export interface ImportedTrack {
  type: ActivityType;
  startedAt: string;
  points: TrackPoint[];
  /** [seconds since start, bpm] */
  hr: [number, number][];
  name?: string;
}

export class TrackError extends Error {}

const num = (s: string | null | undefined) => (s == null || s === "" ? undefined : Number(s));

/** The sport named in the file (GPX <type>, TCX Sport="…"), else a guess from the average speed. */
function sport(named: string | undefined, points: TrackPoint[]): ActivityType {
  const n = (named ?? "").toLowerCase();
  if (/ride|cycl|bik|velo|vélo|^1$|biking/.test(n)) return /mountain|mtb/.test(n) ? "mtb" : /gravel/.test(n) ? "gravel" : "ride";
  if (/trail/.test(n)) return "trail";
  if (/run|jog|course|^9$/.test(n)) return "run";
  if (/hik|rando/.test(n)) return "hike";
  if (/walk|marche/.test(n)) return "walk";
  if (/swim|nage/.test(n)) return "swim";
  if (/ski/.test(n)) return "ski";
  if (points.length > 1) {
    let d = 0;
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i], R = 6371000, r = Math.PI / 180;
      const x = (b.lng - a.lng) * r * Math.cos(((a.lat + b.lat) / 2) * r), y = (b.lat - a.lat) * r;
      d += Math.sqrt(x * x + y * y) * R;
    }
    const s = (points[points.length - 1].t - points[0].t) / 1000;
    const v = s > 0 ? d / s : 0;
    return v > 4.2 ? "ride" : v > 2.1 ? "run" : "walk";
  }
  return "other";
}

function byLocal(parent: Element | Document, name: string): Element[] {
  return Array.from(parent.getElementsByTagName("*")).filter((e) => e.localName === name);
}
const firstText = (parent: Element, name: string) => byLocal(parent, name)[0]?.textContent?.trim();

export function parseTrackFile(text: string, fileName = ""): ImportedTrack {
  const doc = new DOMParser().parseFromString(text, "application/xml");
  if (doc.getElementsByTagName("parsererror").length) throw new TrackError("unreadable");
  const root = doc.documentElement.localName.toLowerCase();
  const points: TrackPoint[] = [];
  const hrRaw: [number, number][] = [];
  let named: string | undefined, name: string | undefined;

  if (root === "gpx") {
    named = firstText(doc.documentElement, "type");
    name = firstText(doc.documentElement, "name");
    for (const p of byLocal(doc, "trkpt")) {
      const lat = num(p.getAttribute("lat")), lng = num(p.getAttribute("lon")), time = firstText(p, "time");
      if (lat == null || lng == null || !time) continue;
      const t = Date.parse(time); if (!Number.isFinite(t)) continue;
      const alt = num(firstText(p, "ele")), hr = num(firstText(p, "hr"));
      points.push({ t, lat, lng, alt, hr });
      if (hr) hrRaw.push([t, hr]);
    }
  } else if (root === "trainingcenterdatabase") {
    const act = byLocal(doc, "Activity")[0];
    named = act?.getAttribute("Sport") ?? undefined;
    name = act ? firstText(act, "Notes") : undefined;
    for (const p of byLocal(doc, "Trackpoint")) {
      const time = firstText(p, "Time"); const pos = byLocal(p, "Position")[0];
      if (!time) continue;
      const t = Date.parse(time); if (!Number.isFinite(t)) continue;
      const hrEl = byLocal(p, "HeartRateBpm")[0]; const hr = hrEl ? num(firstText(hrEl, "Value")) : undefined;
      if (hr) hrRaw.push([t, hr]);
      if (!pos) continue;
      const lat = num(firstText(pos, "LatitudeDegrees")), lng = num(firstText(pos, "LongitudeDegrees"));
      if (lat == null || lng == null) continue;
      points.push({ t, lat, lng, alt: num(firstText(p, "AltitudeMeters")), hr });
    }
  } else throw new TrackError("format");

  if (points.length < 2) throw new TrackError("empty");
  points.sort((a, b) => a.t - b.t);
  const t0 = points[0].t;
  // Heart rate thinned to one sample every ~5 s, like the phone's own recording.
  const hr: [number, number][] = [];
  for (const [t, b] of hrRaw.sort((a, c) => a[0] - c[0])) {
    const s = Math.round((t - t0) / 1000);
    if (s >= 0 && (!hr.length || s - hr[hr.length - 1][0] >= 5)) hr.push([s, b]);
  }
  return { type: sport(named, points), startedAt: new Date(t0).toISOString(), points, hr, name: name || fileName.replace(/\.(gpx|tcx)$/i, "") || undefined };
}
