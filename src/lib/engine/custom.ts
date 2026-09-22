import type { PrescribedExercise, Session } from "../types";
import { db, getProfile } from "../db";
import { getExercise } from "../data/exercises";
import { bestE1rmBySlug } from "../progress";
import { prescribeAdded } from "./plan";

/* ─────────────────────────────────────────────────────────────
   What the athlete adds by hand.

   A movement added from the library is marked `added`. The engine
   rewrites planned sessions often — a new block, a changed goal, a
   bad night's check-in — and every one of those rewrites would
   silently throw the athlete's choice away. These helpers carry the
   added movements across any rewrite of the same day.
   ───────────────────────────────────────────────────────────── */

export const addedOf = (s: Pick<Session, "exercises"> | undefined) => (s?.exercises ?? []).filter((e) => e.added);

/**
 * Put an added movement into a session: after the last accessory, before the
 * finisher, so the session still ends the way it was built to.
 */
export function insertAdded(exercises: PrescribedExercise[], add: PrescribedExercise[]): PrescribedExercise[] {
  const fresh = add.filter((a) => !exercises.some((e) => e.slug === a.slug));
  if (!fresh.length) return exercises;
  const lastAccessory = exercises.map((e) => e.block).lastIndexOf("accessory");
  const finisher = exercises.findIndex((e) => e.block === "finisher" || e.block === "cooldown");
  const i = lastAccessory >= 0 ? lastAccessory + 1 : finisher >= 0 ? finisher : exercises.length;
  return [...exercises.slice(0, i), ...fresh, ...exercises.slice(i)];
}

/** Rebuilt sessions, with what the athlete had added to the same days put back. */
export function carryAdded<S extends Session>(rebuilt: S[], previous: Session[]): S[] {
  const byDate = new Map<string, PrescribedExercise[]>();
  for (const s of previous) { const a = addedOf(s); if (a.length) byDate.set(s.date, [...(byDate.get(s.date) ?? []), ...a]); }
  if (!byDate.size) return rebuilt;
  return rebuilt.map((s) => (byDate.has(s.date) ? { ...s, exercises: insertAdded(s.exercises, byDate.get(s.date)!) } : s));
}

/** Add a library movement to a planned session, prescribed like the rest. */
export async function addToSession(sessionId: string, slug: string): Promise<"added" | "already" | "missing"> {
  const [session, profile, ex] = [await db.sessions.get(sessionId), await getProfile(), getExercise(slug)];
  if (!session || !profile || !ex) return "missing";
  if (session.exercises.some((e) => e.slug === slug)) return "already";
  const added = prescribeAdded(ex, profile, session.week, session.minutes, await bestE1rmBySlug());
  await db.sessions.update(sessionId, { exercises: insertAdded(session.exercises, [added]), dirty: 1, updatedAt: new Date().toISOString() });
  return "added";
}

/** Take a movement the athlete added back out. Engine movements stay. */
export async function removeAdded(sessionId: string, exerciseId: string) {
  const session = await db.sessions.get(sessionId);
  if (!session) return;
  await db.sessions.update(sessionId, { exercises: session.exercises.filter((e) => !(e.added && e.id === exerciseId)), dirty: 1, updatedAt: new Date().toISOString() });
}
