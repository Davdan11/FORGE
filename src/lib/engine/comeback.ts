import type { Plan, Session } from "../types";
import { addDays, db, getProfile, todayISO } from "../db";
import { roundLoad } from "../units";
import { bilingual, tr } from "../i18n";

/* ─────────────────────────────────────────────────────────────
   Coming back after a break.

   Two weeks off costs a little strength and more of the tolerance
   for heavy work; a month costs more. A coach does not pick up
   where the athlete left off — they give a lighter week (or two)
   and let the loads climb back from there. So when the last
   training is 14+ days old, the next week of planned sessions is
   rewritten: loads down, effort eased, one set fewer on the main
   lifts, and a note on each session saying why.

   Pure functions first (tested), then the one that touches the
   database, called when the app opens.
   ───────────────────────────────────────────────────────────── */

export interface Comeback {
  /** Days since the last training (session or activity). */
  daysAway: number;
  /** Multiplier on prescribed loads for the comeback period. */
  loadMul: number;
  /** How many days of planned sessions are eased. */
  easeDays: number;
}

/** What a break of this length calls for, or null when there was no break. */
export function comebackFor(lastTrained: string | null, today: string): Comeback | null {
  if (!lastTrained) return null;
  const daysAway = Math.round((Date.parse(today) - Date.parse(lastTrained.slice(0, 10))) / 86_400_000);
  if (daysAway < 14) return null;
  if (daysAway < 28) return { daysAway, loadMul: 0.9, easeDays: 7 };
  if (daysAway < 56) return { daysAway, loadMul: 0.85, easeDays: 7 };
  return { daysAway, loadMul: 0.8, easeDays: 14 };
}

/** The planned sessions of the comeback period, eased. Others are untouched. */
export function easeSessions(sessions: Session[], today: string, c: Comeback, units: "kg" | "lb"): Session[] {
  const until = addDays(today, c.easeDays - 1);
  const pct = Math.round((1 - c.loadMul) * 100);
  return sessions
    .filter((s) => s.status === "planned" && s.date >= today && s.date <= until)
    .map((s) => ({
      ...s,
      exercises: s.exercises.map((e) => ({
        ...e,
        // One set fewer on the main lifts: the heaviest work is where tolerance goes first.
        sets: (e.block === "main" && e.sets.length > 2 ? e.sets.slice(0, -1) : e.sets).map((set) => ({
          ...set,
          loadKg: set.loadKg != null ? roundLoad(set.loadKg * c.loadMul, units) : undefined,
          rpe: set.rpe != null ? Math.max(5, set.rpe - 1) : undefined,
        })),
      })),
      adjustment: {
        reason: tr(`Bon retour — ${c.daysAway} jours d’absence. ${c.easeDays === 7 ? "Cette semaine" : "Ces deux semaines"} te remet${c.easeDays === 7 ? "" : "tent"} en douceur : charges ${pct} % plus légères, effort d’un point plus facile, une série de moins sur les mouvements principaux. Tes charges remontent à partir d’ici.`, `Welcome back — ${c.daysAway} days away. This ${c.easeDays === 7 ? "week" : "fortnight"} eases you in: loads ${pct} % lighter, effort one point easier, one set fewer on the main lifts. Your loads climb back from here.`),
        from: "comeback",
        changes: [tr(`Charges −${pct} %`, `Loads −${pct} %`), "RPE −1", tr("Mouvements principaux : une série de moins", "Main lifts: one set fewer")],
      },
    }));
}

/** The date of the most recent training: a logged session or a recorded activity. */
export async function lastTrainedDate(): Promise<string | null> {
  const [log, act] = await Promise.all([
    db.logs.orderBy("startedAt").last(),
    db.activities.orderBy("startedAt").last(),
  ]);
  const dates = [log?.startedAt, act?.startedAt].filter(Boolean) as string[];
  return dates.length ? dates.sort().at(-1)!.slice(0, 10) : null;
}

/**
 * Ease the coming week after a break, once per break. The plan remembers the
 * last break it eased (by its start date), so opening the app twice does not
 * lighten the loads twice.
 */
export async function applyComeback(today = todayISO()): Promise<Comeback | null> {
  const profile = await getProfile();
  const plan = await db.plans.orderBy("startDate").last();
  if (!profile || !plan) return null;
  const last = await lastTrainedDate();
  const c = comebackFor(last, today);
  if (!c || plan.comeback?.lastTrained === last) return null;
  const sessions = await db.sessions.where("planId").equals(plan.id).toArray();
  const eased = bilingual(() => easeSessions(sessions, today, c, profile.units.weight));
  const now = new Date().toISOString();
  const marker: NonNullable<Plan["comeback"]> = { lastTrained: last!, at: today, daysAway: c.daysAway, until: addDays(today, c.easeDays - 1), loadMul: c.loadMul };
  await db.transaction("rw", db.plans, db.sessions, async () => {
    await db.sessions.bulkPut(eased.map((s) => ({ ...s, dirty: 1, updatedAt: now })));
    await db.plans.put({ ...plan, comeback: marker, dirty: 1, updatedAt: now });
  });
  return c;
}
