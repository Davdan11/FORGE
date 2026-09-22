import type { Badge, Stats } from "./types";

/* ─────────────────────────────────────────────────────────────
   THE LADDER.

   Seventy levels across seven tiers. The cost of a level grows
   linearly, so the cumulative cost grows as a square — steep
   enough that the top is a real commitment, flat enough that the
   top is actually reachable.

   Measured against a committed athlete (four sessions a week,
   meals logged, daily check-in ≈ 2,100 XP a week):

     Bronze    ~1 month        Platinum  ~13 months
     Silver    ~3.5 months     Diamond   ~20 months
     Gold      ~7.5 months     Forge     ~28 months

   Roughly 1.7× those figures for someone training less often.
   Reaching Gold in a fortnight would take 4,900 XP a day against
   about 360 that a real day produces, so the tiers that carry a
   physical reward cannot be rushed.
   ───────────────────────────────────────────────────────────── */

export const LEVELS_PER_TIER = 10;
export const MAX_LEVEL = 70;

/** XP needed to go from `level` to the next one. */
export const xpForLevel = (level: number) => 280 + 130 * level;

/** Total XP needed to arrive at `level` from zero. */
export function xpToReach(level: number) {
  let total = 0;
  for (let n = 1; n < level; n++) total += xpForLevel(n);
  return total;
}

export function levelFromXp(xp: number) {
  let level = 1;
  let remaining = Math.max(0, xp);
  while (level < MAX_LEVEL && remaining >= xpForLevel(level)) {
    remaining -= xpForLevel(level);
    level++;
  }
  return { level, into: remaining, need: xpForLevel(level) };
}

export interface Reward {
  /** What the athlete actually receives. */
  item: string;
  /** One line on why it exists, shown under the item. */
  note: string;
  /** Needs a shipping address rather than being granted in-app. */
  physical: boolean;
}

export interface Tier {
  key: string;
  name: string;
  /** First level in the tier. */
  from: number;
  /** Emblem colours: rim, face, and the light that catches the bevel. */
  metal: { rim: string; face: string; shine: string };
  reward?: Reward;
}

export const TIERS: Tier[] = [
  { key: "iron", name: "Iron", from: 1,
    metal: { rim: "#4a4c50", face: "#7e8288", shine: "#bfc3c8" } },
  { key: "copper", name: "Copper", from: 11,
    metal: { rim: "#6e3315", face: "#b0592c", shine: "#e59a63" },
    reward: { item: "Enamel pin + sticker set", note: "A month in. The first thing you own that says you train here.", physical: true } },
  { key: "bronze", name: "Bronze", from: 21,
    metal: { rim: "#7a441d", face: "#b9743a", shine: "#e6ab73" },
    reward: { item: "Insulated water bottle", note: "Three months. You are not experimenting any more.", physical: true } },
  { key: "silver", name: "Silver", from: 31,
    metal: { rim: "#6f7883", face: "#aab4c0", shine: "#e8eef5" },
    reward: { item: "Training tee", note: "Half a year of work. Earned, not bought.", physical: true } },
  { key: "gold", name: "Gold", from: 41,
    metal: { rim: "#8a6410", face: "#d7a327", shine: "#fbe08a" },
    reward: { item: "Gym bag", note: "A full year. Most people never see this tier.", physical: true } },
  { key: "emerald", name: "Emerald", from: 51,
    metal: { rim: "#134f33", face: "#2f9c66", shine: "#8fe3b6" },
    reward: { item: "Gift card, store of your choice", note: "Two years of showing up. Spend it on whatever you train for.", physical: true } },
  { key: "platine", name: "Platine", from: 61,
    metal: { rim: "#5f6c72", face: "#b6c9cb", shine: "#f0fbfb" },
    reward: { item: "Forge jacket", note: "The last tier. There is nothing after this but the work.", physical: true } },
];

export const tierForLevel = (level: number): Tier =>
  [...TIERS].reverse().find((t) => level >= t.from) ?? TIERS[0];

/** Sub-ranks per tier. The rank artwork is drawn at five, I to V. */
export const SUB_RANKS = ["I", "II", "III", "IV", "V"] as const;

/** Roman sub-rank inside a tier: I at the bottom, V at the top, two levels each. */
export function subRankFor(level: number) {
  const tier = tierForLevel(level);
  const into = Math.min(LEVELS_PER_TIER - 1, level - tier.from);
  return SUB_RANKS[Math.floor(into / (LEVELS_PER_TIER / SUB_RANKS.length))] ?? "V";
}

export function rankFor(level: number) {
  return `${tierForLevel(level).name} ${subRankFor(level)}`;
}

/** The next tier that carries a reward, and how far away it is. */
export function nextRewardFor(level: number, xp: number) {
  const tier = TIERS.find((t) => t.from > level && t.reward);
  if (!tier) return null;
  return { tier, levelsAway: tier.from - level, xpAway: Math.max(0, xpToReach(tier.from) - xp) };
}

/** Tiers the athlete has reached, newest first — what they can claim. */
export const earnedTiers = (level: number) => TIERS.filter((t) => t.reward && level >= t.from).reverse();

/** Legacy alias: some screens still read the plain list of names. */
export const RANKS = TIERS.map((t) => t.name);

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
