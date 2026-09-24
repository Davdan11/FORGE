import { addDays, db, getStats, getProfile, isoWeek, todayISO } from "./db";
import { challengesFor, unpaid } from "./challenges";
import { XP, levelFromXp, evaluateBadges } from "./gamification";
import { verifyActivity, type Verification } from "./verify";
import { badgeContext } from "./badgeFacts";

export const LEVEL_UP_EVENT = "forge:levelup";
export const BADGES_EVENT = "forge:badges";
/** Fired with the ids of badges just earned, for the celebration card. */
function announceBadges(ids: string[]) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<string[]>(BADGES_EVENT, { detail: ids }));
}
/** Fired when an award pushes the athlete past a level boundary. */
function announceLevelUp(level: number) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<number>(LEVEL_UP_EVENT, { detail: level }));
}
import { e1rm } from "./units";
import { tr } from "./i18n";
import type { Activity, ActivityType, DistanceUnit, SessionLog, Stats } from "./types";

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

/**
 * Everything the badges look at, from the saved rows (see lib/badgeFacts.ts).
 * `pending` is an activity being awarded before it is written: the indoor
 * ride is paid first and saved after, and its own badges must not wait for
 * the next award to notice it.
 */
export async function loadBadgeContext(pending?: Activity) {
  const profile = await getProfile();
  const saved = await db.activities.toArray();
  const activities = pending && !saved.some((a) => a.id === pending.id) ? [...saved, pending] : saved;
  const readinessDays = new Set((await db.readiness.toArray()).map((r) => r.date)).size;
  return badgeContext({
    best: await bestE1rmBySlug(),
    profile: profile ?? undefined,
    activities,
    weighIns: await db.weights.orderBy("date").toArray(),
    sessions: await db.sessions.toArray(),
    readinessCount: readinessDays,
    nutrition: await db.nutrition.toArray(),
  });
}

async function finalize(opts: { pending?: Activity } = {}) {
  const stats = await getStats();
  const ctx = await loadBadgeContext(opts.pending);
  const earned = evaluateBadges(stats, ctx);
  if (earned.length) announceBadges(earned);
  stats.badges.push(...earned);
  // The award path is the one place that knows a level was crossed, so it
  // announces it here rather than having the UI poll the stats row.
  const levelBefore = stats.level;
  stats.level = levelFromXp(stats.xp).level;
  if (stats.level > levelBefore) announceLevelUp(stats.level);
  await db.stats.put({ ...stats, dirty: 1, updatedAt: new Date().toISOString() });
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
  if (prs.length) stats.totals.prs = (stats.totals.prs ?? 0) + prs.length;
  if (opts.adjusted) stats.totals.adjustedSessions = (stats.totals.adjustedSessions ?? 0) + 1;
  await db.stats.put({ ...stats, dirty: 1, updatedAt: new Date().toISOString() });
  await touchStreak();
  const { earned } = await finalize();
  return { xp, prs, earned };
}

/**
 * XP for a recorded activity, paid on verified effort rather than elapsed time.
 *
 * A route that was driven earns the base and nothing else; twenty minutes spent
 * sitting in a café is simply not in `movingSec`. The breakdown is returned so
 * the save sheet can show exactly what counted and what did not.
 */
export function activityXpBreakdown(
  a: Pick<Activity, "durationSec" | "elevGainM" | "workoutId" | "shared" | "type"> & { points?: Activity["points"] },
  verification?: Verification,
) {
  const v = verification ?? verifyActivity(a.points ?? [], a.type, a.durationSec);
  const minutes = Math.round(v.movingSec / 60);
  const parts = [
    { label: tr("Activité", "Activity"), xp: XP.activityBase },
    { label: tr(`${minutes} min en mouvement`, `${minutes} min moving`), xp: Math.round(minutes * XP.cardioMinute) },
  ];
  // Climbing credit follows the same rule: only the part that was verified.
  const climbed = Math.round(a.elevGainM * v.credit);
  if (climbed >= 100) parts.push({ label: tr(`${climbed} m grimpés`, `${climbed} m climbed`), xp: Math.floor(climbed / 100) * XP.elevPer100m });
  if (a.workoutId) parts.push({ label: tr("Entraînement guidé", "Guided workout"), xp: XP.guidedWorkout });
  if (a.shared) parts.push({ label: tr("Partagé sur le profil", "Shared to profile"), xp: XP.shareActivity });
  const skipped = v.flags.map((f) => f.message);
  return { parts, skipped, verification: v, total: parts.reduce((s, p) => s + p.xp, 0) };
}

export async function awardActivity(a: Activity) {
  const stats = await getStats();
  const { total: xp, verification } = activityXpBreakdown(a);
  stats.xp += xp;
  // Lifetime distance counts what the track supports, so leaderboards and
  // badges cannot be reached by driving.
  stats.totals.distanceM += verification.verifiedDistanceM || (verification.credit > 0 ? a.distanceM : 0);
  stats.totals.activities = (stats.totals.activities ?? 0) + 1;
  stats.totals.elevGainM = (stats.totals.elevGainM ?? 0) + Math.round(a.elevGainM * verification.credit);
  if (a.shared) stats.totals.shared = (stats.totals.shared ?? 0) + 1;
  await db.stats.put({ ...stats, dirty: 1, updatedAt: new Date().toISOString() });
  await touchStreak();
  const { earned } = await finalize({ pending: a });
  return { xp, earned, verification };
}

/**
 * XP for an indoor session.
 *
 * There is no GPS track to verify, so `verifyActivity` would pay nothing. The
 * effort's provenance stands in for it instead: measured power or belt speed
 * pays in full, an estimate from heart rate pays 60 %, and effort typed on a
 * slider pays nothing — the same rule the ride screen shows while riding.
 */
export function indoorXpBreakdown(a: Pick<Activity, "durationSec" | "elevGainM"> & { movingSec?: number; workout?: boolean }, credit: number) {
  const minutes = Math.round((a.movingSec ?? a.durationSec) / 60);
  const parts = [
    { label: tr("Séance intérieure", "Indoor session"), xp: XP.activityBase },
    { label: tr(`${minutes} min en mouvement`, `${minutes} min moving`), xp: Math.round(minutes * XP.cardioMinute) },
  ];
  if (a.elevGainM >= 100) parts.push({ label: tr(`${Math.round(a.elevGainM)} m grimpés`, `${Math.round(a.elevGainM)} m climbed`), xp: Math.floor(a.elevGainM / 100) * XP.elevPer100m });
  if (a.workout) parts.push({ label: tr("Entraînement structuré", "Structured workout"), xp: XP.guidedWorkout });
  const raw = parts.reduce((s, p) => s + p.xp, 0);
  return { parts, credit, total: Math.round(raw * credit) };
}

export async function awardIndoor(a: Activity, credit: number) {
  const { total: xp } = indoorXpBreakdown({ ...a, workout: !!a.meta?.indoor?.workoutDone }, credit);
  const stats = await getStats();
  stats.xp += xp;
  // Lifetime distance and climb count in proportion to how well they were
  // measured: a slider can move the avatar, not the totals.
  stats.totals.distanceM += Math.round(a.distanceM * credit);
  stats.totals.activities = (stats.totals.activities ?? 0) + 1;
  stats.totals.elevGainM = (stats.totals.elevGainM ?? 0) + Math.round(a.elevGainM * credit);
  await db.stats.put({ ...stats, dirty: 1, updatedAt: new Date().toISOString() });
  if (credit > 0) await touchStreak();
  const { earned } = await finalize({ pending: a });
  return { xp, earned };
}

/** XP for finishing a FORGE Ride route for the first time: 100, plus 4 per km. */
export const routeBadgeXp = (km: number) => 100 + 4 * Math.max(0, Math.round(km));

/**
 * The first finish of each FORGE Ride route pays a bonus, once (its key goes into
 * `stats.routesDone`). Paid like the ride itself: in proportion to how well the
 * effort was measured, and nothing for effort typed on a slider.
 */
export async function awardRouteBadge(route: string, km: number, credit: number) {
  const stats = await getStats();
  const done = stats.routesDone ?? [];
  if (!route || credit <= 0 || done.includes(route)) return { xp: 0, first: false };
  const xp = Math.round(routeBadgeXp(km) * credit);
  stats.xp += xp;
  stats.routesDone = [...done, route];
  await db.stats.put({ ...stats, dirty: 1, updatedAt: new Date().toISOString() });
  await finalize();
  return { xp, first: true };
}

/**
 * Pay for any sport challenge an activity has just completed. Reads the saved
 * activities, so call it after the activity is written. Each challenge is paid
 * once: its id goes into `stats.challengesDone`.
 */
export async function awardChallenges(sport: ActivityType, units: DistanceUnit) {
  const today = todayISO();
  const since = addDays(today, -40);
  const activities = await db.activities.where("startedAt").aboveOrEqual(since).toArray();
  const stats = await getStats();
  const paid = unpaid(challengesFor(sport, today, activities, units), stats.challengesDone ?? []);
  if (!paid.length) return { xp: 0, titles: [] as string[] };
  const xp = paid.reduce((t, c) => t + c.xp, 0);
  stats.xp += xp;
  // Only the recent ones can still be earned; older ids are dead weight.
  stats.challengesDone = [...(stats.challengesDone ?? []), ...paid.map((c) => c.id)].slice(-200);
  await db.stats.put({ ...stats, dirty: 1, updatedAt: new Date().toISOString() });
  await finalize();
  return { xp, titles: paid.map((c) => c.title) };
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

/**
 * Take an activity off the feed locally.
 *
 * The XP stays. It was earned by the training, and the share bonus was earned
 * by the act of posting, which did happen. Clawing it back would make taking a
 * post down feel like a punishment — and a privacy control you are punished
 * for using is not a control at all.
 */
export async function unshareActivity(id: string) {
  const a = await db.activities.get(id);
  if (!a || !a.shared) return;
  await db.activities.update(id, { shared: false, sharedAt: undefined, dirty: 1 });
  const stats = await getStats();
  stats.totals.shared = Math.max(0, (stats.totals.shared ?? 1) - 1);
  await db.stats.put({ ...stats, dirty: 1, updatedAt: new Date().toISOString() });
}

export async function logWeighIn(kg: number, date: string) {
  await db.weights.put({ id: date, date, kg, dirty: 1, updatedAt: new Date().toISOString() });
  const p = await getProfile();
  // The first weigh-in of an older profile becomes its start line.
  if (p) await db.profile.update(p.id, { weightKg: kg, ...(p.startWeightKg == null ? { startWeightKg: p.weightKg } : {}), dirty: 1 });
  const stats = await getStats();
  // Once a day: re-entering the weight is a correction, not another reward.
  const xp = payOnce(stats, date, "weighin") ? XP.weighIn : 0;
  stats.xp += xp;
  if (xp) stats.totals.weighIns = (stats.totals.weighIns ?? 0) + 1;
  await db.stats.put({ ...stats, dirty: 1, updatedAt: new Date().toISOString() });
  await finalize();   // weight badges are checked on every weigh-in
  return xp;
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

/**
 * Mark a daily reward as paid. Returns false when it was already paid today,
 * which is what stops "Redo, check in again" or unticking and re-ticking a
 * meal from paying every time. Pure, so it is tested without a database.
 */
export function payOnce(stats: Pick<Stats, "paidDay">, date: string, key: string): boolean {
  const day = stats.paidDay?.date === date ? stats.paidDay : { date, keys: [] };
  if (day.keys.includes(key)) return false;
  stats.paidDay = { date, keys: [...day.keys, key] };
  return true;
}

export async function awardReadiness(date = todayISO()) {
  const stats = await getStats();
  if (!payOnce(stats, date, "readiness")) return 0;
  stats.xp += XP.readinessCheckIn;
  stats.totals.checkIns = (stats.totals.checkIns ?? 0) + 1;
  await db.stats.put({ ...stats, dirty: 1, updatedAt: new Date().toISOString() });
  await finalize();   // check-in badges
  return XP.readinessCheckIn;
}

/** XP for logging one meal of the day (`slot` is its place in the day's plan),
 *  plus the full-day bonus once. Each is paid at most once per day. */
export async function awardMeal(fullDay: boolean, slot: number, date = todayISO()) {
  const stats = await getStats();
  let xp = 0;
  if (payOnce(stats, date, `meal:${slot}`)) { xp += XP.mealLogged; stats.totals.mealsLogged += 1; }
  if (fullDay && payOnce(stats, date, "fullday")) { xp += XP.fullNutritionDay; stats.totals.fullDays = (stats.totals.fullDays ?? 0) + 1; }
  if (!xp) return 0;
  stats.xp += xp;
  await db.stats.put({ ...stats, dirty: 1, updatedAt: new Date().toISOString() });
  await finalize();
  return xp;
}
