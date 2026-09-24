import { bilingual } from "../i18n";
import { db, getProfile, todayISO } from "../db";
import { bestE1rmBySlug } from "../progress";
import { generatePlan } from "./plan";
import { adaptationsFor } from "./injury";
import type { Profile } from "../types";
import { carryAdded } from "./custom";

/* ─────────────────────────────────────────────────────────────
   Regenerate the part of the block that hasn't happened yet.

   Everything already done stays exactly as it was — a finished
   session is a record, not a plan. What changes is the road ahead,
   rebuilt from the current truth: what the athlete has actually
   lifted, and what is currently hurting.
   ───────────────────────────────────────────────────────────── */

export async function rebuildRemaining(patch: Partial<Profile> = {}): Promise<number> {
  const current = await getProfile();
  if (!current) return 0;
  const profile = { ...current, ...patch };
  const today = todayISO();

  const [measured, injuryRows] = await Promise.all([bestE1rmBySlug(), db.injuries.toArray()]);
  const injuries = adaptationsFor(injuryRows, today);
  const { plan, sessions: built } = bilingual(() => generatePlan(profile, today, measured, injuries));
  // Movements the athlete added by hand stay on their day.
  const sessions = carryAdded(built, await db.sessions.where("status").equals("planned").toArray());

  await db.transaction("rw", db.plans, db.sessions, async () => {
    await db.sessions.where("status").equals("planned").delete();
    await db.plans.put({ ...plan, dirty: 1, updatedAt: new Date().toISOString() });
    await db.sessions.bulkPut(sessions.map((s) => ({ ...s, dirty: 1, updatedAt: new Date().toISOString() })));
  });
  return sessions.length;
}
