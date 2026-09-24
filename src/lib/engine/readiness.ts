import type { PainArea, Profile, Readiness, Session } from "../types";
import { buildSession, type MeasuredE1rm } from "./plan";
import { AREA_LABEL, type InjuryAdaptation } from "./injury";
import { tr } from "../i18n";
import { roundLoad } from "../units";
import { getExercise } from "../data/exercises";
import { addedOf, insertAdded } from "./custom";

/* ─────────────────────────────────────────────────────────────
   Readiness → daily auto-regulation.
   The score is a weighted blend of sleep, soreness, stress, mood and
   (optionally) HRV / resting HR deltas. Then the day's session is
   rewritten BEFORE the athlete walks in — with a one-line why.
   ───────────────────────────────────────────────────────────── */

export function readinessScore(r: Omit<Readiness, "score" | "id" | "date">, baselineHrv?: number, baselineRhr?: number) {
  const sleep = Math.min(1, Math.max(0, (r.sleepHours - 4) / 4.5));   // 4h → 0, 8.5h → 1
  const quality = (r.sleepQuality - 1) / 4;
  const soreness = 1 - (r.soreness - 1) / 4;
  const stress = 1 - (r.stress - 1) / 4;
  const mood = (r.mood - 1) / 4;
  let score = sleep * 0.32 + quality * 0.18 + soreness * 0.2 + stress * 0.18 + mood * 0.12;
  if (r.hrv && baselineHrv) score += Math.max(-0.15, Math.min(0.1, (r.hrv - baselineHrv) / baselineHrv * 0.5));
  if (r.restingHr && baselineRhr) score -= Math.max(-0.05, Math.min(0.15, (r.restingHr - baselineRhr) / baselineRhr));
  return Math.round(Math.max(0, Math.min(1, score)) * 100);
}

export interface Adjustment { session: Session; changes: string[]; reason: string; level: "green" | "amber" | "red" }

/**
 * Rewrite today's session from readiness + real-life constraints.
 * Keeps the *intent* of the block; changes the means.
 */
export function autoRegulate(profile: Profile, planned: Session, r: Readiness, measured: MeasuredE1rm = {}, injuries: InjuryAdaptation[] = []): Adjustment {
  const changes: string[] = [];
  let session: Session = structuredClone(planned);
  const minutes = r.minutesAvailable ?? planned.minutes;
  const pain = r.painToday ?? [];
  const equipmentToday = r.equipmentToday ?? "full";

  /* 1. Real-life constraints: equipment / pain / time → rebuild with a constrained profile. */
  const constrained = equipmentToday !== "full" || pain.length > 0 || minutes < planned.minutes - 10;
  if (constrained) {
    const p: Profile = {
      ...profile,
      equipment: equipmentToday === "full" ? profile.equipment : equipmentToday === "dumbbells" ? ["dumbbell", "bench", "band", "bodyweight"] : ["bodyweight", "band"],
      pain: [...new Set([...profile.pain, ...pain])],
    };
    const rebuilt = buildSession(p, planned.planId, planned.week, planned.day, planned.date, planned.kind, minutes, pain, measured, injuries);
    // What the athlete added stays, unless today's pain rules it out.
    const kept = addedOf(planned).filter((e) => !(getExercise(e.slug)?.painFlags ?? []).some((f) => p.pain.includes(f)));
    session = { ...rebuilt, exercises: insertAdded(rebuilt.exercises, kept), id: planned.id };
    if (equipmentToday !== "full") changes.push(tr(`Réécrite pour ${equipmentToday === "dumbbells" ? "haltères seulement" : "aucun équipement"} — mêmes mouvements de base, autres outils.`, `Rewritten for ${equipmentToday === "dumbbells" ? "dumbbells only" : "no equipment"} — same patterns, different tools.`));
    if (pain.length) changes.push(tr(`Mouvements qui sollicitent : ${pain.map((a) => AREA_LABEL[a]).join(", ")} — remplacés pour aujourd’hui.`, `Movements loading the ${pain.join(", ")} swapped out for today.`));
    if (minutes < planned.minutes - 10) changes.push(tr(`Coupée à ${minutes} min : accessoires réduits, mouvement principal gardé.`, `Cut to ${minutes} min: accessories trimmed, main lift kept.`));
  }

  /* 2. Time trim without a full rebuild. */
  if (!constrained && minutes < planned.minutes) {
    session.exercises = session.exercises.filter((e) => e.block !== "accessory" || session.exercises.indexOf(e) < 3);
    session.minutes = minutes;
    changes.push(tr(`Réduite à ${minutes} min — un accessoire en moins.`, `Trimmed to ${minutes} min — one accessory dropped.`));
  }

  /* 3. Readiness scaling of load and volume. */
  let level: Adjustment["level"] = "green";
  let loadMul = 1, volDrop = 0, reason = tr("Ta forme est bonne. Entraîne-toi comme prévu; vise le RPE cible, pas un chiffre.", "Readiness is good. Train as planned; chase the target RPE, not a number.");
  if (r.score < 40) {
    level = "red"; loadMul = 0.8; volDrop = 1;
    reason = tr(`Forme ${r.score}/100 — sommeil ${r.sleepHours} h${r.soreness >= 4 ? ", grosses courbatures" : ""}${r.stress >= 4 ? ", stress élevé" : ""}. Charge −20 %, une série de moins par exercice. Tu te présentes quand même; le bloc avance.`, `Readiness ${r.score}/100 — sleep ${r.sleepHours}h${r.soreness >= 4 ? ", heavy soreness" : ""}${r.stress >= 4 ? ", high stress" : ""}. Load −20%, one set fewer per exercise. You still show up; the block still moves.`);
  } else if (r.score < 65) {
    level = "amber"; loadMul = 0.92;
    reason = tr(`Forme ${r.score}/100. Charge −8 % sur les mouvements principaux, même volume. Arrête chaque série une rep plus tôt que tu penses.`, `Readiness ${r.score}/100. Load −8% on the main lifts, same volume. Stop each set one rep earlier than you think.`);
  }
  if (loadMul < 1 || volDrop) {
    session.exercises = session.exercises.map((ex) => {
      const meta = getExercise(ex.slug);
      const sets = ex.sets.slice(0, Math.max(1, ex.sets.length - (ex.block === "main" || ex.block === "accessory" ? volDrop : 0)))
        .map((s) => (s.loadKg && meta?.loadable ? { ...s, loadKg: roundLoad(s.loadKg * loadMul, profile.units), rpe: s.rpe ? Math.max(5, s.rpe - (level === "red" ? 1 : 0.5)) : s.rpe } : s));
      return { ...ex, sets };
    });
    if (session.cardio && level === "red") { session.cardio = { ...session.cardio, zone: 2, minutes: Math.round(session.cardio.minutes * 0.7), structure: undefined }; changes.push(tr("Intervalles remplacés par de la zone 2 facile.", "Intervals replaced by easy Zone 2.")); }
    changes.push(level === "red" ? tr("Charge −20 %, une série de moins.", "Load −20%, one set fewer.") : tr("Charge −8 % sur le travail chargé.", "Load −8% on loaded work."));
  }

  if (changes.length) {
    session.status = "adjusted";
    session.adjustment = { reason, from: planned.title, changes };
  }
  session.readinessAtStart = r.score;
  return { session, changes, reason, level };
}

/* Getters: the language is picked when a label is read, not at module load. */
const PAIN_WORDS: Record<PainArea, [string, string]> = { knee: ["Genou", "Knee"], back: ["Bas du dos", "Lower back"], shoulder: ["Épaule", "Shoulder"], hip: ["Hanche", "Hip"], wrist: ["Poignet", "Wrist"], ankle: ["Cheville", "Ankle"], elbow: ["Coude", "Elbow"] };
export const PAIN_LABEL: Record<PainArea, string> = Object.defineProperties({} as Record<PainArea, string>,
  Object.fromEntries((Object.keys(PAIN_WORDS) as PainArea[]).map((k) => [k, { get: () => tr(...PAIN_WORDS[k]), enumerable: true }])));
