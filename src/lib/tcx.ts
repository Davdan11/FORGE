/* ─────────────────────────────────────────────────────────────
   Indoor rides as a TCX file, for Strava, Garmin Connect and
   TrainingPeaks: one trackpoint a second with distance, speed,
   power, heart rate and cadence. Strava reads power from the
   standard ActivityExtension/v2 "Watts" field.

   No GPS is written: an indoor ride happens on a fictional road,
   and a latitude would put it somewhere it never was. Strava
   files it as a virtual ride.
   ───────────────────────────────────────────────────────────── */

/** One sample a second, recorded while the ride runs. Arrays stay aligned; -1 = no reading. */
export interface RideStreams {
  /** Seconds since the start. */
  t: number[];
  /** Metres along the course. */
  d: number[];
  /** Metres above sea level on the course. */
  alt: number[];
  w: number[];
  hr: number[];
  cad: number[];
}

export const emptyStreams = (): RideStreams => ({ t: [], d: [], alt: [], w: [], hr: [], cad: [] });

export function pushSample(s: RideStreams, p: { t: number; d: number; alt?: number; w?: number | null; hr?: number | null; cad?: number | null }) {
  s.t.push(Math.round(p.t)); s.d.push(Math.round(p.d * 10) / 10); s.alt.push(Math.round((p.alt ?? 0) * 10) / 10);
  s.w.push(p.w == null ? -1 : Math.round(p.w)); s.hr.push(p.hr == null ? -1 : Math.round(p.hr)); s.cad.push(p.cad == null ? -1 : Math.round(p.cad));
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function toTcx(a: { startedAt: string; title: string; durationSec: number; distanceM: number; kcal?: number }, s: RideStreams): string {
  const start = new Date(a.startedAt).getTime();
  const iso = (sec: number) => new Date(start + sec * 1000).toISOString();
  const pts: string[] = [];
  for (let i = 0; i < s.t.length; i++) {
    const speed = i > 0 && s.t[i] > s.t[i - 1] ? (s.d[i] - s.d[i - 1]) / (s.t[i] - s.t[i - 1]) : 0;
    pts.push(
      `<Trackpoint><Time>${iso(s.t[i])}</Time><AltitudeMeters>${s.alt[i]}</AltitudeMeters><DistanceMeters>${s.d[i]}</DistanceMeters>` +
      (s.hr[i] > 0 ? `<HeartRateBpm><Value>${s.hr[i]}</Value></HeartRateBpm>` : "") +
      (s.cad[i] >= 0 ? `<Cadence>${s.cad[i]}</Cadence>` : "") +
      `<Extensions><TPX xmlns="http://www.garmin.com/xmlschemas/ActivityExtension/v2"><Speed>${Math.max(0, Math.round(speed * 100) / 100)}</Speed>` +
      (s.w[i] >= 0 ? `<Watts>${s.w[i]}</Watts>` : "") + `</TPX></Extensions></Trackpoint>`,
    );
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2">` +
    `<Activities><Activity Sport="Biking"><Id>${iso(0)}</Id>` +
    `<Lap StartTime="${iso(0)}"><TotalTimeSeconds>${Math.round(a.durationSec)}</TotalTimeSeconds><DistanceMeters>${Math.round(a.distanceM)}</DistanceMeters>` +
    `<Calories>${Math.round(a.kcal ?? 0)}</Calories><Intensity>Active</Intensity><TriggerMethod>Manual</TriggerMethod>` +
    `<Track>${pts.join("")}</Track></Lap>` +
    `<Notes>${esc(a.title)} · FORGE Ride (indoor)</Notes></Activity></Activities></TrainingCenterDatabase>\n`;
}

/** Save the file (or open the share sheet on a phone). */
export async function downloadTcx(name: string, xml: string) {
  const file = new File([xml], `${name.replace(/[^\w-]+/g, "-").slice(0, 60) || "forge-ride"}.tcx`, { type: "application/vnd.garmin.tcx+xml" });
  if (typeof navigator !== "undefined" && navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: name }); return "shared" as const; }
  const url = URL.createObjectURL(file);
  const link = document.createElement("a"); link.href = url; link.download = file.name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return "downloaded" as const;
}
