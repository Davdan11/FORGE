import { db, getStats, getProfile, isoWeek, todayISO } from "./db";
import { XP, levelFromXp, evaluateBadges } from "./gamification";
import { e1rm } from "./units";
import type { Activity, SessionLog } from "./types";

/* ─────────────────────────────────────────────────────────────
   Progress: XP, levels, streaks, badges, personal records.
   Every award goes through here so the numbers stay honest.
   ───────────────────────────────────────────────────────────── */

export async function bestE1rmBySlug(): Promise<Record<string, number>> {
  const sets = await db.sets.toArray();
  const best: Record<string, number> = {};
  for (const s of sets) {
    if (s.loadKg && s.reps) best[s.slug] = Math.max(best[s.slug] ?? 0, e1rm(s.loadKg, s.reps));
    else if (s.reps && !s.loadKg) best[s.slug] = Math.max(best[s.slug] ?? 0, s.reps); // bodyweight reps
  }
  return best;
}

async function touchStreak() {
  const stats = await getStats();
  const week = isoWeek(todayISO());
  if (stats.lastActiveWeek === week) return stats;
  const prev = stats.lastActiveWeek;
  const prevWeekOf = (w: string) => { const d = new Date(todayISO() + "T00:00:00"); d.setDate(d.getDate() - 7); return isoWeek(d.toISOString().slice(0, 10)) === w; };
  stats.streakWeeks = prev && prevWeekOf(prev) ? stats.streakWeeks + 1 : 1;
  stats.lastActiveWeek = week;
  if (stats.streakWeeks > 1) stats.xp += XP.weekStreak;
  await db.stats.put({ ...stats, dirty: 1, updatedAt: new Date().toISOString() });
  return stats;
}

async function finalize(newBadgesExtra: { activityDistanceM?: number } = {}) {
  const stats = await getStats();
  const profile = await getProfile();
  const best = await bestE1rmBySlug();
  const acts = await db.activities.toArray();
  const best5k = acts.filter((a) => a.type === "run" && a.distanceM >= 5000).map((a) => (a.durationSec * 5000) / a.distanceM).sort((a, b) => a - b)[0];
  const zone2Min = (await db.logs.toArray()).length * 0; // filled by cardio sessions below
  const ctx = { bestE1rm: best, bodyweightKg: profile?.weightKg ?? 80, best5kSec: best5k, zone2Min: zone2Min + acts.reduce((a, b) => a + b.durationSec / 60, 0) };
  const earned = evaluateBadges(stats, ctx);
  stats.badges.push(...earned);
  stats.level = levelFromXp(stats.xp).level;
  await db.stats.put({ ...stats, dirty: 1, updatedAt: new Date().toISOString() });
  void newBadgesExtra;
  return { stats, earned };
}

export async function awardSession(log: SessionLog, opts: { adjusted: boolean; setsLogged: number; rpeLogged: number; mobilityMin: number; cardioMin: number; prBefore: Record<string, number> }) {
  const stats = await getStats();
  let xp = opts.adjusted ? XP.sessionAdjustedDone : XP.sessionDone;
  xp += opts.setsLogged * XP.perSetLogged + opts.rpeLogged * XP.rpeHonest + opts.mobilityMin * XP.mobilityMinute + opts.cardioMin * XP.cardioMinute;
  const after = await bestE1rmBySlug();
  const prs = Object.keys(after).filter((k) => after[k] > (opts.prBefore[k] ?? 0) && (opts.prBefore[k] ?? 0) > 0);
  xp += prs.length * XP.personalRecord;
  stats.xp += xp;
  stats.totals.sessions += 1;
  stats.totals.volumeKg += log.volumeKg ?? 0;
  stats.totals.mobilityMin += opts.mobilityMin;
  await db.stats.put({ ...stats, dirty: 1, updatedAt: new Date().toISOString() });
  await touchStreak();
  const { earned } = await finalize();
  return { xp, prs, earned };
}

export function activityXpBreakdown(a: Pick<Activity, "durationSec" | "elevGainM" | "workoutId" | "shared">) {
  const parts = [
    { label: "Activity", xp: XP.activityBase },
    { label: `${Math.round(a.durationSec / 60)} min moving`, xp: Math.round((a.durationSec / 60) * XP.cardioMinute) },
  ];
  if (a.elevGainM >= 100) parts.push({ label: `${Math.round(a.elevGainM)} m climbed`, xp: Math.floor(a.elevGainM / 100) * XP.elevPer100m });
  if (a.workoutId) parts.push({ label: "Guided workout", xp: XP.guidedWorkout });
  if (a.shared) parts.push({ label: "Shared to profile", xp: XP.shareActivity });
  return { parts, total: parts.reduce((s, p) => s + p.xp, 0) };
}

export async function awardActivity(a: Activity) {
  const stats = await getStats();
  const { total: xp } = activityXpBreakdown(a);
  stats.xp += xp;
  stats.totals.distanceM += a.distanceM;
  stats.totals.activities = (stats.totals.activities ?? 0) + 1;
  stats.totals.elevGainM = (stats.totals.elevGainM ?? 0) + a.elevGainM;
  if (a.shared) stats.totals.shared = (stats.totals.shared ?? 0) + 1;
  await db.stats.put({ ...stats, dirty: 1, updatedAt: new Date().toISOString() });
  await touchStreak();
  const { earned } = await finalize();
  return { xp, earned };
}

/** Share an already-saved activity to the profile feed. */
export async function shareActivity(id: string) {
  const a = await db.activities.get(id);
  if (!a || a.shared) return 0;
  await db.activities.update(id, { shared: true, sharedAt: new Date().toISOString(), xp: a.xp + XP.shareActivity, dirty: 1 });
  const stats = await getStats();
  stats.xp += XP.shareActivity;
  stats.totals.shared = (stats.totals.shared ?? 0) + 1;
  await db.stats.put({ ...stats, dirty: 1, updatedAt: new Date().toISOString() });
  await finalize();
  return XP.shareActivity;
}

export async function logWeighIn(kg: number, date: string) {
  await db.weights.put({ id: date, date, kg, dirty: 1, updatedAt: new Date().toISOString() });
  const p = await getProfile();
  if (p) await db.profile.update(p.id, { weightKg: kg, dirty: 1 });
  const stats = await getStats();
  stats.xp += XP.weighIn;
  await db.stats.put({ ...stats, dirty: 1, updatedAt: new Date().toISOString() });
  return XP.weighIn;
}

/** Guided mobility flow: minutes × mobility XP, counts toward totals and the streak. */
export async function awardMobility(minutes: number) {
  const stats = await getStats();
  const xp = Math.round(minutes * XP.mobilityMinute) + 30;
  stats.xp += xp;
  stats.totals.mobilityMin += minutes;
  await db.stats.put({ ...stats, dirty: 1, updatedAt: new Date().toISOString() });
  await touchStreak();
  await finalize();
  return xp;
}

export async function awardReadiness() {
  const stats = await getStats();
  stats.xp += XP.readinessCheckIn;
  await db.stats.put({ ...stats, dirty: 1, updatedAt: new Date().toISOString() });
  return XP.readinessCheckIn;
}

export async function awardMeal(fullDay: boolean) {
  const stats = await getStats();
  const xp = XP.mealLogged + (fullDay ? XP.fullNutritionDay : 0);
  stats.xp += xp;
  stats.totals.mealsLogged += 1;
  await db.stats.put({ ...stats, dirty: 1, updatedAt: new Date().toISOString() });
  await finalize();
  return xp;
}
