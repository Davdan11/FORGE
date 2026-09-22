import type { BlockReview, Plan, Profile, Session, SessionLog } from "../types";
import { BLOCK_WEEKS, NEUTRAL_TUNING, blockMeta, buildWeeks, type BlockTuning, type MeasuredE1rm } from "./plan";
import { adaptationsFor, type InjuryAdaptation } from "./injury";
import { db, getProfile, todayISO } from "../db";
import { bestE1rmBySlug } from "../progress";

/* ─────────────────────────────────────────────────────────────
   The programme between blocks.

   At the start of every block the one before it is reviewed —
   how many sessions happened, and how hard they felt against
   what was prescribed — and the road ahead is rebuilt from that
   and from the heaviest sets actually logged. Then the programme
   is extended so there are always at least two blocks ahead.
   There is no week 13 cliff: a programme ends when the athlete
   stops, not when a counter runs out.

   Everything here is pure except `advanceProgramme` at the bottom.
   ───────────────────────────────────────────────────────────── */

/** Weeks of programme kept ahead of the current one. */
export const HORIZON_WEEKS = 2 * BLOCK_WEEKS;

/** 1-based week of `plan` containing `date`; 0 before the plan starts. */
export function weekOf(plan: Pick<Plan, "startDate">, date: string) {
  const days = Math.floor((new Date(date + "T00:00:00").getTime() - new Date(plan.startDate + "T00:00:00").getTime()) / 86400000);
  return days < 0 ? 0 : Math.floor(days / 7) + 1;
}
export const blockOfWeek = (week: number) => Math.ceil(week / BLOCK_WEEKS);
export const firstWeekOf = (block: number) => (block - 1) * BLOCK_WEEKS + 1;

/** What a finished block showed. Only sessions dated before `today` count:
 *  the future has not been missed yet. */
export function reviewBlock(block: number, sessions: Session[], logs: SessionLog[], today: string): Omit<BlockReview, "changes" | "tuning" | "at"> {
  const first = firstWeekOf(block), last = first + BLOCK_WEEKS - 1;
  const inBlock = sessions.filter((s) => s.week >= first && s.week <= last && s.date < today);
  const done = inBlock.filter((s) => s.status === "done");
  const logBySession = new Map(logs.map((l) => [l.sessionId, l]));
  const gaps: number[] = [];
  for (const s of done) {
    const felt = logBySession.get(s.id)?.avgRpe;
    const target = s.exercises.find((e) => e.block === "main")?.sets[0]?.rpe;
    if (felt != null && target != null) gaps.push(felt - target);
  }
  return {
    sessionsDone: done.length,
    sessionsPlanned: inBlock.length,
    rpeGap: gaps.length ? Math.round((gaps.reduce((a, b) => a + b, 0) / gaps.length) * 10) / 10 : undefined,
  };
}

/** Turn a review into the next block's adjustments, and say why in plain words.
 *  Worked out fresh each block rather than compounded: logged loads already
 *  carry the long-term progress, so the tuning only corrects the last month. */
export function tuningFrom(r: Omit<BlockReview, "changes" | "tuning" | "at">): { tuning: BlockTuning; changes: string[] } {
  const tuning: BlockTuning = { ...NEUTRAL_TUNING };
  const changes: string[] = [];
  const rate = r.sessionsPlanned ? r.sessionsDone / r.sessionsPlanned : 1;

  if (r.sessionsPlanned && rate < 0.5) {
    tuning.accessorySets -= 1;
    tuning.loadMul *= 0.95;
    changes.push(`You made ${r.sessionsDone} of ${r.sessionsPlanned} sessions. This block has shorter sessions and 5% lighter loads, so it fits your week and your body can catch up.`);
  } else if (r.sessionsPlanned && rate < 0.8) {
    changes.push(`${r.sessionsDone} of ${r.sessionsPlanned} sessions. Loads keep climbing; showing up more often is now what will move them fastest.`);
  }

  if (r.rpeGap != null && r.sessionsDone >= 3) {
    if (r.rpeGap >= 1) {
      tuning.loadMul *= 0.95;
      tuning.rpe -= 0.5;
      changes.push(`Sessions felt harder than planned (RPE +${r.rpeGap}). Loads are down 5% and the targets are eased by half a point.`);
    } else if (r.rpeGap >= 0.5) {
      tuning.loadMul *= 0.975;
      changes.push(`Sessions ran a little hot (RPE +${r.rpeGap}). Loads are down 2.5%.`);
    } else if (r.rpeGap <= -1 && rate >= 0.8) {
      tuning.loadMul *= 1.03;
      if (r.sessionsDone >= 8) tuning.accessorySets += 1;
      changes.push(`Sessions felt easier than planned (RPE ${r.rpeGap}). Loads are up 3%${r.sessionsDone >= 8 ? " and there is one more accessory set" : ""}.`);
    }
  }

  if (!changes.length) changes.push(r.sessionsPlanned ? "On track. The loads follow the heaviest sets you logged." : "Nothing to review yet.");
  tuning.loadMul = Math.round(tuning.loadMul * 1000) / 1000;
  return { tuning, changes };
}

/**
 * Bring a programme up to date on `today`. Pure: takes the rows, returns the
 * new plan, the planned sessions to delete, and the sessions to add.
 */
export function advance(
  plan: Plan, sessions: Session[], logs: SessionLog[], profile: Profile, today: string,
  measured: MeasuredE1rm = {}, injuries: InjuryAdaptation[] = [],
): { plan: Plan; remove: string[]; add: Session[] } | null {
  const week = weekOf(plan, today);
  if (week === 0) return null;
  const block = blockOfWeek(week);
  const blocks = [...plan.blocks];
  let weeks = plan.weeks;
  const remove: string[] = [];
  const add: Session[] = [];
  const taken = new Set(sessions.filter((s) => s.status !== "planned").map((s) => s.date));
  const fresh = (list: Session[]) => list.filter((s) => s.date >= today && !taken.has(s.date));

  // The tuning in force: the latest review's, or neutral before the first.
  let tuning: BlockTuning = [...blocks].reverse().find((b) => b.review)?.review?.tuning ?? NEUTRAL_TUNING;

  // 1. A block has begun that has not been rebuilt from the one before it.
  if (block >= 2 && blocks[block - 1] && !blocks[block - 1].review) {
    const facts = reviewBlock(block - 1, sessions, logs, today);
    const t = tuningFrom(facts);
    tuning = t.tuning;
    blocks[block - 1] = { ...blocks[block - 1], review: { ...facts, changes: t.changes, tuning, at: today } };
    const from = firstWeekOf(block);
    for (const s of sessions) if (s.status === "planned" && s.week >= from && s.date >= today) remove.push(s.id);
    add.push(...fresh(buildWeeks(profile, plan.id, plan.startDate, from, weeks, measured, injuries, tuning)));
  }

  // 2. Keep the horizon full. Past-dated weeks (someone away for months) are
  //    not back-filled: nobody can do a session last Tuesday.
  while (weeks < week + HORIZON_WEEKS) {
    const n = weeks / BLOCK_WEEKS + 1;
    blocks.push(blockMeta(profile.goal, n));
    add.push(...fresh(buildWeeks(profile, plan.id, plan.startDate, weeks + 1, weeks + BLOCK_WEEKS, measured, injuries, tuning)));
    weeks += BLOCK_WEEKS;
  }

  if (!remove.length && !add.length && weeks === plan.weeks) return null;
  return { plan: { ...plan, weeks, blocks }, remove, add };
}

/** Run `advance` against the database. Called once when the app opens. */
export async function advanceProgramme(): Promise<boolean> {
  const profile = await getProfile();
  const plan = await db.plans.orderBy("startDate").last();
  if (!profile || !plan) return false;
  const today = todayISO();
  const [sessions, logs, measured, injuryRows] = await Promise.all([
    db.sessions.where("planId").equals(plan.id).toArray(), db.logs.toArray(), bestE1rmBySlug(), db.injuries.toArray(),
  ]);
  const next = advance(plan, sessions, logs, profile, today, measured, adaptationsFor(injuryRows, today));
  if (!next) return false;
  const now = new Date().toISOString();
  await db.transaction("rw", db.plans, db.sessions, async () => {
    if (next.remove.length) await db.sessions.bulkDelete(next.remove);
    await db.plans.put({ ...next.plan, dirty: 1, updatedAt: now });
    await db.sessions.bulkPut(next.add.map((s) => ({ ...s, dirty: 1, updatedAt: now })));
  });
  return true;
}
