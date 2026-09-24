/* ─────────────────────────────────────────────────────────────
   Structured indoor workouts: the ones you build yourself.

   A workout is a list of blocks. A block is steady (hold one
   intensity), a ramp (go from one to another), or intervals
   (on/off, repeated). Intensity is a percentage of threshold:
   FTP in watts on the bike, threshold speed on the treadmill —
   so the same workout scales to whoever rides it, and a stronger
   rider next month gets a harder session without editing it.

   On a controllable trainer the target is sent as ERG watts and
   the trainer holds it whatever the cadence. Without one it is a
   target on screen, and the ride is scored as usual.
   ───────────────────────────────────────────────────────────── */

import { tr } from "../i18n";

export type WorkoutSport = "ride" | "run";

export type Block =
  | { kind: "steady"; sec: number; pct: number }
  | { kind: "ramp"; sec: number; from: number; to: number }
  | { kind: "intervals"; repeat: number; onSec: number; onPct: number; offSec: number; offPct: number };

export interface StructuredWorkout {
  id: string;
  name: string;
  sport: WorkoutSport;
  blocks: Block[];
  /** Built-ins cannot be edited or deleted; a copy can. */
  builtIn?: boolean;
}

/** One flattened stretch of the workout: intervals unrolled, ramps kept whole. */
export interface Step { startSec: number; sec: number; from: number; to: number; label: string }

export function flatten(w: Pick<StructuredWorkout, "blocks">): Step[] {
  const out: Step[] = [];
  let t = 0;
  const push = (sec: number, from: number, to: number, label: string) => {
    if (sec <= 0) return;
    out.push({ startSec: t, sec, from, to, label });
    t += sec;
  };
  for (const b of w.blocks) {
    if (b.kind === "steady") push(b.sec, b.pct, b.pct, zoneLabel(b.pct));
    else if (b.kind === "ramp") push(b.sec, b.from, b.to, b.to >= b.from ? tr("Rampe montante", "Ramp up") : tr("Rampe descendante", "Ramp down"));
    else for (let i = 0; i < b.repeat; i++) {
      push(b.onSec, b.onPct, b.onPct, tr(`Intervalle ${i + 1}/${b.repeat}`, `Interval ${i + 1}/${b.repeat}`));
      push(b.offSec, b.offPct, b.offPct, tr("Récup", "Recover"));
    }
  }
  return out;
}

export const totalSec = (steps: Step[]) => (steps.length ? steps[steps.length - 1].startSec + steps[steps.length - 1].sec : 0);

/** Where the workout is at `t` seconds: the step, its target, and what is left. */
export function positionAt(steps: Step[], t: number) {
  const end = totalSec(steps);
  if (!steps.length || t >= end) return { done: true as const, index: steps.length, pct: 0, leftSec: 0, next: null as Step | null, step: null as Step | null };
  const index = Math.max(0, steps.findIndex((s) => t < s.startSec + s.sec));
  const step = steps[index];
  const into = Math.max(0, t - step.startSec);
  const pct = step.from + (step.to - step.from) * (into / step.sec);
  return { done: false as const, index, step, pct, leftSec: step.sec - into, next: steps[index + 1] ?? null };
}

/** Target in watts (ride) or m/s (run) for a percentage of threshold. */
export function targetFor(sport: WorkoutSport, pct: number, threshold: { ftpW: number; thresholdKmh: number }) {
  return sport === "ride" ? Math.round((threshold.ftpW * pct) / 100) : (threshold.thresholdKmh * pct) / 100 / 3.6;
}

/** Coggan's power zones, by share of FTP. Runners read them the same way. */
export function zoneOfPct(pct: number): 1 | 2 | 3 | 4 | 5 | 6 {
  return pct < 56 ? 1 : pct < 76 ? 2 : pct < 91 ? 3 : pct < 106 ? 4 : pct < 121 ? 5 : 6;
}
export const ZONE_LABEL = ["", "Recovery", "Endurance", "Tempo", "Threshold", "VO2 max", "Anaerobic"] as const;
export const ZONE_HEX = ["", "#9aa3ad", "#4aa3df", "#1fc76f", "#f2c14e", "#f08a3c", "#d9453d"] as const;
const ZONE_LABEL_FR = ["", "Récupération", "Endurance", "Tempo", "Seuil", "VO2 max", "Anaérobie"] as const;
/** A zone's name in the app's language. */
export const zoneName = (z: number) => tr(ZONE_LABEL_FR[z] ?? "", ZONE_LABEL[z] ?? "");
const zoneLabel = (pct: number) => zoneName(zoneOfPct(pct));

/** Training stress, the usual way: hours × intensity² × 100. */
export function stressScore(steps: Step[]) {
  let s = 0;
  for (const st of steps) {
    // Mean of squares over a linear ramp: (a² + ab + b²) / 3.
    const a = st.from / 100, b = st.to / 100;
    s += (st.sec / 3600) * ((a * a + a * b + b * b) / 3) * 100;
  }
  return Math.round(s);
}

/** A workout that can be ridden: at least one step, every number sane. */
export function sanitize(w: StructuredWorkout): StructuredWorkout {
  const pct = (v: number) => Math.min(200, Math.max(30, Math.round(v)));
  const sec = (v: number) => Math.min(4 * 3600, Math.max(10, Math.round(v)));
  return {
    ...w,
    name: w.name.trim().slice(0, 60) || tr("Mon entraînement", "My workout"),
    blocks: w.blocks.slice(0, 40).map((b) =>
      b.kind === "steady" ? { ...b, sec: sec(b.sec), pct: pct(b.pct) }
        : b.kind === "ramp" ? { ...b, sec: sec(b.sec), from: pct(b.from), to: pct(b.to) }
          : { ...b, repeat: Math.min(30, Math.max(1, Math.round(b.repeat))), onSec: sec(b.onSec), offSec: sec(b.offSec), onPct: pct(b.onPct), offPct: pct(b.offPct) }),
  };
}

/* ── thresholds when nobody has tested one ─────────────────── */

/** Threshold running speed, km/h, by level: roughly one-hour race pace. */
export function guessThresholdKmh(level: "new" | "returning" | "intermediate" | "advanced") {
  return { new: 9, returning: 10, intermediate: 12, advanced: 14.5 }[level] ?? 10;
}

/* ── the ones that ship ────────────────────────────────────── */

const WU = (sec = 600): Block => ({ kind: "ramp", sec, from: 45, to: 75 });
const CD = (sec = 300): Block => ({ kind: "ramp", sec, from: 65, to: 40 });

export const BUILT_IN_WORKOUTS: StructuredWorkout[] = [
  { id: "wo-sweetspot", name: "Sweet spot 3×10", sport: "ride", builtIn: true,
    blocks: [WU(), { kind: "intervals", repeat: 3, onSec: 600, onPct: 90, offSec: 300, offPct: 55 }, CD()] },
  { id: "wo-vo2", name: "VO2 max 5×3", sport: "ride", builtIn: true,
    blocks: [WU(), { kind: "intervals", repeat: 5, onSec: 180, onPct: 115, offSec: 180, offPct: 50 }, CD()] },
  { id: "wo-endurance", name: "Endurance hour", sport: "ride", builtIn: true,
    blocks: [WU(300), { kind: "steady", sec: 3000, pct: 68 }, CD()] },
  { id: "wo-over-under", name: "Over-unders", sport: "ride", builtIn: true,
    blocks: [WU(), { kind: "intervals", repeat: 6, onSec: 120, onPct: 105, offSec: 120, offPct: 92 }, { kind: "steady", sec: 300, pct: 50 }, CD()] },
  { id: "wo-run-tempo", name: "Tempo run 2×12", sport: "run", builtIn: true,
    blocks: [{ kind: "ramp", sec: 600, from: 65, to: 80 }, { kind: "intervals", repeat: 2, onSec: 720, onPct: 90, offSec: 180, offPct: 65 }, { kind: "steady", sec: 300, pct: 62 }] },
  { id: "wo-run-intervals", name: "Track 6×800", sport: "run", builtIn: true,
    blocks: [{ kind: "ramp", sec: 600, from: 65, to: 80 }, { kind: "intervals", repeat: 6, onSec: 180, onPct: 108, offSec: 120, offPct: 60 }, { kind: "steady", sec: 300, pct: 60 }] },
];
