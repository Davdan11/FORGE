import { registerPlugin } from "@capacitor/core";
import type { BackgroundGeolocationPlugin } from "@capacitor-community/background-geolocation";
import type { ActivityType, TrackPoint } from "./types";
import { isNativeShell } from "./native";

/* ─────────────────────────────────────────────────────────────
   Recording GPS that survives a pocket.

   In a browser, and in a WebView, `navigator.geolocation` stops the
   moment the screen locks or another app comes forward: a run
   recorded that way has a straight line where the athlete was, or
   ends at the first traffic light. Keeping the screen awake hid the
   problem; nobody runs with the screen on.

   In the native shell the fixes come from a foreground service
   instead (Android shows the "FORGE is recording" notification that
   keeps it alive; iOS runs it under the location background mode),
   so they keep arriving with the phone locked in a pocket.

   Separately, the track so far is written to storage as it grows. If
   the system kills the app mid-run anyway — some Android builds do,
   whatever the notification says — the athlete comes back to their
   run, not to nothing.
   ───────────────────────────────────────────────────────────── */

export type GpsProblem = "denied" | "unavailable" | "signal";
export type StopGps = () => Promise<void>;

const Background = registerPlugin<BackgroundGeolocationPlugin>("BackgroundGeolocation");

/** Start delivering fixes. Resolves to the function that stops them. */
export async function startGps(
  onFix: (p: TrackPoint) => void,
  onProblem: (p: GpsProblem) => void,
  notice: { title: string; message: string },
): Promise<StopGps> {
  if (isNativeShell()) {
    const id = await Background.addWatcher(
      {
        backgroundTitle: notice.title,
        backgroundMessage: notice.message,
        requestPermissions: true,
        stale: false,      // never a cached fix from before the start
        distanceFilter: 0, // every fix: pace and splits need them, the verifier filters
      },
      (loc, err) => {
        if (err) { onProblem(err.code === "NOT_AUTHORIZED" ? "denied" : "signal"); return; }
        if (!loc || loc.simulated) return; // a mock-location app is not a run
        onFix({ t: loc.time ?? Date.now(), lat: loc.latitude, lng: loc.longitude, alt: loc.altitude ?? undefined, acc: loc.accuracy });
      },
    );
    return async () => { await Background.removeWatcher({ id }); };
  }

  if (!("geolocation" in navigator)) { onProblem("unavailable"); return async () => {}; }
  const id = navigator.geolocation.watchPosition(
    (pos) => onFix({ t: pos.timestamp, lat: pos.coords.latitude, lng: pos.coords.longitude, alt: pos.coords.altitude ?? undefined, acc: pos.coords.accuracy }),
    (e) => onProblem(e.code === 1 ? "denied" : "signal"),
    { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 },
  );
  return async () => navigator.geolocation.clearWatch(id);
}

/** The phone's location settings, for someone who refused permission. */
export async function openLocationSettings() {
  if (isNativeShell()) await Background.openSettings();
}

/* ── Surviving a killed app ─────────────────────────────────── */

export interface TrackDraft {
  type: ActivityType;
  startedAt: string;
  /** Milliseconds spent paused, as of the last save. */
  pausedMs: number;
  points: TrackPoint[];
  workoutId?: string;
  /** Heart-rate samples, when a strap was connected. */
  hr?: [number, number][];
  savedAt: number;
}

const DRAFT = "forge.liveTrack";
/** A draft older than this is a forgotten run, not an interrupted one. */
const DRAFT_MAX_AGE_MS = 36 * 3600 * 1000;

export function saveDraft(d: Omit<TrackDraft, "savedAt">) {
  try { localStorage.setItem(DRAFT, JSON.stringify({ ...d, savedAt: Date.now() })); } catch { /* storage full or blocked: the live run continues */ }
}

export function readDraft(now = Date.now()): TrackDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT);
    if (!raw) return null;
    const d = JSON.parse(raw) as TrackDraft;
    if (!d.points?.length || now - d.savedAt > DRAFT_MAX_AGE_MS) { clearDraft(); return null; }
    return d;
  } catch { return null; }
}

export function clearDraft() {
  try { localStorage.removeItem(DRAFT); } catch { /* nothing to clear */ }
}
