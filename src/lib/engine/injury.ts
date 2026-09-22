import type { Exercise, Injury, InjuryPhase, PainArea, Pattern } from "../types";
import { getExercise } from "../data/exercises";

/* ─────────────────────────────────────────────────────────────
   TRAINING AROUND AN INJURY.

   This is not medical advice and the app never says otherwise. It
   does one job a coach does: keep training the parts that are fine,
   protect the part that is not, and bring it back gradually instead
   of all at once.

   Three principles drive everything below.

   1. An injury is local. A sore knee is not a reason to stop
      pressing. Only the patterns that load the area are touched;
      the rest of the block runs at full load, which is what keeps
      people training through an injury instead of disappearing.

   2. Progress is earned by quiet days, not by the calendar. The
      ladder advances on days since the last flare-up. Report a
      flare and it steps back down.

   3. Some things are not ours to handle. Red flags send the athlete
      to a professional, and that message is never softened.
   ───────────────────────────────────────────────────────────── */

/** Patterns that meaningfully load each area. */
const LOADS: Record<PainArea, Pattern[]> = {
  knee: ["squat", "lunge", "power"],
  back: ["hinge", "squat", "carry", "power"],
  shoulder: ["push_v", "push_h", "pull_v"],
  hip: ["hinge", "squat", "lunge", "power"],
  wrist: ["push_h", "push_v", "carry"],
  ankle: ["squat", "lunge", "cardio", "power"],
  elbow: ["push_h", "push_v", "pull_h", "pull_v"],
};

/** What still trains well while an area is protected. */
const KEEP_TRAINING: Record<PainArea, string> = {
  knee: "Everything above the waist stays at full load — press, pull and carry as planned. Hinge patterns are usually fine when the knee stays tall.",
  back: "Arms and legs keep working with the spine supported: machine and single-leg work, seated presses, supported rows.",
  shoulder: "Legs and hips lose nothing. Lower-body work runs at full load all the way through.",
  hip: "Upper body runs as planned, and core work continues where it doesn't put the hip into end range.",
  wrist: "Legs, hinges and pulling with straps carry on. Pressing moves to a neutral grip or a machine.",
  ankle: "Upper body is untouched. Seated and supported leg work keeps the quads and hamstrings loaded.",
  elbow: "Legs and trunk run in full. Pressing and pulling volume comes back as the elbow settles.",
};

export const AREA_LABEL: Record<PainArea, string> = {
  knee: "knee", back: "lower back", shoulder: "shoulder", hip: "hip", wrist: "wrist", ankle: "ankle", elbow: "elbow",
};

/** Days without a flare needed to reach each phase. */
const LADDER: { phase: InjuryPhase; minQuietDays: number; loadCap: number; volumeCap: number }[] = [
  { phase: "protect", minQuietDays: 0, loadCap: 0, volumeCap: 0.6 },
  { phase: "reload", minQuietDays: 4, loadCap: 0.55, volumeCap: 0.8 },
  { phase: "return", minQuietDays: 14, loadCap: 0.8, volumeCap: 1 },
  { phase: "clear", minQuietDays: 28, loadCap: 1, volumeCap: 1 },
];

export interface InjuryAdaptation {
  area: PainArea;
  phase: InjuryPhase;
  quietDays: number;
  /** Multiplier applied to prescribed load on affected patterns. 0 = unloaded. */
  loadCap: number;
  /** Multiplier applied to set count on affected patterns. */
  volumeCap: number;
  affectedPatterns: Pattern[];
  /** Plain-language lines for the athlete. */
  guidance: string[];
  /** Shown whenever an injury is active. Never softened. */
  redFlags: string[];
  /** Quiet days still needed before the next step up, null once clear. */
  nextStepInDays: number | null;
}

const dayDiff = (fromISO: string, toISO: string) =>
  Math.max(0, Math.round((new Date(toISO + "T00:00:00").getTime() - new Date(fromISO + "T00:00:00").getTime()) / 86400000));

export const RED_FLAGS = [
  "Numbness, pins and needles, or weakness that doesn’t pass.",
  "Pain that wakes you at night, or that is worse at rest than when you move.",
  "You can’t put weight on it, or the joint gives way.",
  "Swelling or bruising that keeps getting worse after 48 hours.",
  "It started with a fall, a collision or a sudden pop.",
];

/**
 * Where this injury sits today, and what that means for the prescription.
 * `today` is passed in so the engine stays pure and testable.
 */
export function adaptationFor(injury: Injury, today: string): InjuryAdaptation {
  const since = injury.lastFlareAt ?? injury.since;
  const quietDays = dayDiff(since, today);

  // Severity 3 never climbs past protect on its own: that is a conversation
  // with a professional, not a ladder the app walks up.
  const reachable = injury.severity === 3 ? LADDER.slice(0, 1)
    : injury.severity === 2 ? LADDER.slice(0, 3)
    : LADDER;
  let step = reachable[0];
  for (const s of reachable) if (quietDays >= s.minQuietDays) step = s;

  const idx = LADDER.findIndex((s) => s.phase === step.phase);
  const next = reachable[idx + 1];
  const affectedPatterns = step.phase === "clear" ? [] : LOADS[injury.area];
  const label = AREA_LABEL[injury.area];

  const guidance: string[] = [];
  if (step.phase === "protect") {
    guidance.push(`Your ${label} is being protected: nothing that loads it is prescribed right now.`);
    guidance.push(KEEP_TRAINING[injury.area]);
    guidance.push("Move it through whatever range is comfortable every day. Complete rest stiffens a joint; it rarely settles it.");
  } else if (step.phase === "reload") {
    guidance.push(`${quietDays} quiet days. Your ${label} goes back under light load — about half of what you were lifting — to remind the tissue what work feels like.`);
    guidance.push("Aim for a 2 out of 10 during the set that settles by the next morning. If it climbs above that, mark a flare-up and we step back.");
  } else if (step.phase === "return") {
    guidance.push(`${quietDays} quiet days. Load is back to roughly four fifths, full sets. This is the last step before normal.`);
    guidance.push("Keep the reps smooth. If a lift still feels guarded, stay here another week — nothing is lost by taking it.");
  } else {
    guidance.push(`Four quiet weeks. Your ${label} is back on full load and out of the way of the block.`);
    guidance.push("Clear it in Settings when you’re confident, and the prescription forgets it entirely.");
  }
  if (injury.severity === 3) {
    guidance.push("You’ve marked this as limiting daily life. The app will hold here and not add load — please get it looked at by a professional.");
  }

  return {
    area: injury.area,
    phase: step.phase,
    quietDays,
    loadCap: step.loadCap,
    volumeCap: step.volumeCap,
    affectedPatterns,
    guidance,
    redFlags: RED_FLAGS,
    nextStepInDays: next ? Math.max(0, next.minQuietDays - quietDays) : null,
  };
}

/** Active injuries only, worst first, so the strictest rule wins a tie. */
export const activeInjuries = (all: Injury[]) =>
  all.filter((i) => !i.resolvedAt).sort((a, b) => b.severity - a.severity);

export function adaptationsFor(injuries: Injury[], today: string): InjuryAdaptation[] {
  return activeInjuries(injuries).map((i) => adaptationFor(i, today));
}

/** Areas that must not be loaded at all right now. */
export function protectedAreas(adaptations: InjuryAdaptation[]): PainArea[] {
  return adaptations.filter((a) => a.loadCap === 0).map((a) => a.area);
}

/**
 * How an exercise should be treated today. The strictest adaptation that
 * touches it wins; anything it doesn't touch is left completely alone.
 */
export function limitFor(ex: Exercise | string, adaptations: InjuryAdaptation[]): { blocked: boolean; loadCap: number; volumeCap: number; because?: PainArea } {
  const meta = typeof ex === "string" ? getExercise(ex) : ex;
  if (!meta) return { blocked: false, loadCap: 1, volumeCap: 1 };

  let loadCap = 1, volumeCap = 1, because: PainArea | undefined;
  for (const a of adaptations) {
    const flags = meta.painFlags ?? [];
    const touchesArea = flags.includes(a.area);
    const touchesPattern = a.affectedPatterns.includes(meta.pattern);
    if (!touchesArea && !touchesPattern) continue;

    // A movement explicitly flagged for this joint is held to the strictest
    // reading; one that merely shares a pattern gets the softer cap.
    const cap = touchesArea ? a.loadCap : Math.min(1, a.loadCap + 0.2);
    if (cap < loadCap) { loadCap = cap; because = a.area; }
    volumeCap = Math.min(volumeCap, a.volumeCap);
  }
  return { blocked: loadCap === 0, loadCap, volumeCap, because };
}
