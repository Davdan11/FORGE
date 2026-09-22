import type { Badge, Stats } from "./types";

/* XP curve: level n needs 400·n^1.35 XP to reach n+1. */
export const xpForLevel = (level: number) => Math.round(400 * Math.pow(level, 1.35));

export function levelFromXp(xp: number) {
  let level = 1;
  let remaining = xp;
  while (remaining >= xpForLevel(level)) {
    remaining -= xpForLevel(level);
    level++;
  }
  return { level, into: remaining, need: xpForLevel(level) };
}

export const RANKS = ["Iron", "Bronze", "Silver", "Gold", "Platinum", "Diamond", "Forge"] as const;
export function rankFor(level: number) {
  const tier = Math.min(RANKS.length - 1, Math.floor((level - 1) / 10));
  const sub = 4 - Math.floor(((level - 1) % 10) / 2.5);
  return `${RANKS[tier]} ${["I", "II", "III", "IV"][Math.max(0, Math.min(3, sub - 1))]}`;
}

/* XP sources. Deliberately rewards the boring, compounding stuff. */
export const XP = {
  sessionDone: 120,
  sessionAdjustedDone: 140,      // showing up on a bad day is worth more
  perSetLogged: 6,
  rpeHonest: 4,                  // logging RPE on every set
  mobilityMinute: 3,
  cardioMinute: 4,
  readinessCheckIn: 20,
  mealLogged: 15,
  fullNutritionDay: 60,
  weekStreak: 250,
  personalRecord: 200,
  activityBase: 60,              // finishing any recorded activity
  elevPer100m: 15,               // every 100 m of climb
  guidedWorkout: 50,             // completing a guided workout's structure
  shareActivity: 40,             // sharing to your profile
  weighIn: 10,
};

export const BADGES: Badge[] = [
  { id: "first_session", name: "Day one", desc: "First session logged.", pillar: "all", check: (s) => s.totals.sessions >= 1, progress: (s) => [s.totals.sessions, 1] },
  { id: "ten_sessions", name: "Ten deep", desc: "Ten sessions logged.", pillar: "strength", check: (s) => s.totals.sessions >= 10, progress: (s) => [s.totals.sessions, 10] },
  { id: "fifty_sessions", name: "Fifty", desc: "Fifty sessions logged.", pillar: "strength", check: (s) => s.totals.sessions >= 50, progress: (s) => [s.totals.sessions, 50] },
  { id: "streak_4", name: "One month", desc: "Four consecutive weeks.", pillar: "recovery", check: (s) => s.streakWeeks >= 4, progress: (s) => [s.streakWeeks, 4] },
  { id: "streak_12", name: "One block", desc: "Twelve consecutive weeks.", pillar: "recovery", check: (s) => s.streakWeeks >= 12, progress: (s) => [s.streakWeeks, 12] },
  { id: "streak_52", name: "One year", desc: "Fifty-two consecutive weeks.", pillar: "recovery", check: (s) => s.streakWeeks >= 52, progress: (s) => [s.streakWeeks, 52] },
  { id: "volume_100k", name: "100 tonnes", desc: "100,000 kg lifted.", pillar: "strength", check: (s) => s.totals.volumeKg >= 100000, progress: (s) => [Math.round(s.totals.volumeKg), 100000] },
  { id: "bw_squat", name: "Bodyweight squat", desc: "Squat e1RM ≥ 1× bodyweight.", pillar: "strength", check: (_s, c) => (c.bestE1rm["back-squat"] ?? 0) >= c.bodyweightKg, progress: (_s, c) => [Math.round(c.bestE1rm["back-squat"] ?? 0), Math.round(c.bodyweightKg)] },
  { id: "2x_deadlift", name: "2× deadlift", desc: "Deadlift e1RM ≥ 2× bodyweight.", pillar: "strength", check: (_s, c) => (c.bestE1rm["deadlift"] ?? 0) >= 2 * c.bodyweightKg, progress: (_s, c) => [Math.round(c.bestE1rm["deadlift"] ?? 0), Math.round(2 * c.bodyweightKg)] },
  { id: "first_pullup", name: "First pull-up", desc: "One strict pull-up logged.", pillar: "strength", check: (_s, c) => (c.bestE1rm["pull-up"] ?? 0) > 0 },
  { id: "first_route", name: "First route", desc: "First activity recorded.", pillar: "endurance", check: (s) => (s.totals.activities ?? 0) >= 1, progress: (s) => [s.totals.activities ?? 0, 1] },
  { id: "dist_100k", name: "100 km", desc: "100 km recorded.", pillar: "endurance", check: (s) => s.totals.distanceM >= 100000, progress: (s) => [Math.round(s.totals.distanceM / 1000), 100] },
  { id: "dist_1000k", name: "1,000 km", desc: "1,000 km recorded.", pillar: "endurance", check: (s) => s.totals.distanceM >= 1000000, progress: (s) => [Math.round(s.totals.distanceM / 1000), 1000] },
  { id: "everest", name: "Everest", desc: "8,849 m of climbing recorded.", pillar: "endurance", check: (s) => (s.totals.elevGainM ?? 0) >= 8849, progress: (s) => [Math.round(s.totals.elevGainM ?? 0), 8849] },
  { id: "sub20_5k", name: "Sub-20 5K", desc: "5 km under 20 minutes.", pillar: "endurance", check: (_s, c) => (c.best5kSec ?? Infinity) < 1200 },
  { id: "zone2_100h", name: "100 h Zone 2", desc: "One hundred hours of easy aerobic work.", pillar: "endurance", check: (_s, c) => c.zone2Min >= 6000, progress: (_s, c) => [Math.round(c.zone2Min / 60), 100] },
  { id: "shared_10", name: "Out loud", desc: "Ten activities shared to your profile.", pillar: "endurance", check: (s) => (s.totals.shared ?? 0) >= 10, progress: (s) => [s.totals.shared ?? 0, 10] },
  { id: "mobility_10h", name: "Ten hours of mobility", desc: "600 minutes of mobility done.", pillar: "mobility", check: (s) => s.totals.mobilityMin >= 600, progress: (s) => [Math.round(s.totals.mobilityMin), 600] },
  { id: "meals_100", name: "Fed", desc: "100 meals logged.", pillar: "nutrition", check: (s) => s.totals.mealsLogged >= 100, progress: (s) => [s.totals.mealsLogged, 100] },
];

export function evaluateBadges(stats: Stats, ctx: Parameters<Badge["check"]>[1]) {
  return BADGES.filter((b) => !stats.badges.includes(b.id) && b.check(stats, ctx)).map((b) => b.id);
}
