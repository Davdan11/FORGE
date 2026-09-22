import type { PrescribedSet, Units } from "../types";
import { roundLoad } from "../units";

/* ─────────────────────────────────────────────────────────────
   In-session auto-regulation: after each logged set, re-prescribe
   the next one from the RPE gap. Returns the new set + the why.
   ───────────────────────────────────────────────────────────── */

export interface SetOutcome { next: PrescribedSet; why: string | null }

export function nextSetFromRpe(prev: PrescribedSet, logged: { rpe?: number; reps?: number; loadKg?: number }, next: PrescribedSet, units: Units): SetOutcome {
  if (!next || logged.rpe == null || prev.rpe == null) return { next, why: null };
  const gap = logged.rpe - prev.rpe;                     // + = harder than intended
  const repsShort = prev.reps != null && logged.reps != null ? prev.reps - logged.reps : 0;
  const load = logged.loadKg ?? next.loadKg;

  if (load && next.loadKg) {
    if (gap >= 2 || repsShort >= 2) {
      const l = roundLoad(load * 0.92, units);
      return { next: { ...next, loadKg: l }, why: `That set came in at RPE ${logged.rpe} (target ${prev.rpe})${repsShort >= 2 ? ` and ${repsShort} reps short` : ""}. Load −8% so the block finishes at the intended intensity, not fried.` };
    }
    if (gap >= 1 || repsShort === 1) {
      const l = roundLoad(load * 0.96, units);
      return { next: { ...next, loadKg: l }, why: `RPE ${logged.rpe} vs target ${prev.rpe}. Taking a notch off (−4%) to keep the reps clean.` };
    }
    if (gap <= -1.5 && repsShort <= 0) {
      const l = roundLoad(load * 1.04, units);
      return { next: { ...next, loadKg: l }, why: `RPE ${logged.rpe} — easier than planned. +4% on the next set; the target is ${prev.rpe}.` };
    }
    if (logged.loadKg && logged.loadKg !== next.loadKg && Math.abs(gap) < 1) {
      return { next: { ...next, loadKg: logged.loadKg }, why: null }; // carry the load you actually used
    }
  } else if (next.reps != null && prev.reps != null) {
    if (gap >= 2) return { next: { ...next, reps: Math.max(3, next.reps - 2) }, why: `RPE ${logged.rpe} on bodyweight work — two reps off the next set.` };
    if (gap <= -1.5) return { next: { ...next, reps: next.reps + 2 }, why: `Felt easy (RPE ${logged.rpe}). Two more reps next set.` };
  }
  return { next, why: null };
}

/** Suggested progression for the same exercise next week, from this week's best set. */
export function nextWeekLoad(best: { loadKg: number; reps: number; rpe?: number }, units: Units) {
  const rpe = best.rpe ?? 8;
  const mul = rpe <= 6.5 ? 1.05 : rpe <= 7.5 ? 1.03 : rpe <= 8.5 ? 1.015 : 1.0;
  return roundLoad(best.loadKg * mul, units);
}
