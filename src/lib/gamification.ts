import type { Badge, Stats, BadgeContext } from "./types";
import { getLang, type Lang } from "./i18n";
import { GAME_ROUTES } from "./indoor/forgeRide";

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
  itemFr: string;
  /** One line on why it exists, shown under the item. */
  note: string;
  noteFr: string;
  /** Needs a shipping address rather than being granted in-app. */
  physical: boolean;
}

export interface Tier {
  key: string;
  name: string;
  nameFr: string;
  /** First level in the tier. */
  from: number;
  /** Emblem colours: rim, face, and the light that catches the bevel. */
  metal: { rim: string; face: string; shine: string };
  reward?: Reward;
}

export const TIERS: Tier[] = [
  { key: "iron", name: "Iron", nameFr: "Fer", from: 1,
    metal: { rim: "#4a4c50", face: "#7e8288", shine: "#bfc3c8" } },
  { key: "copper", name: "Copper", nameFr: "Cuivre", from: 11,
    metal: { rim: "#6e3315", face: "#b0592c", shine: "#e59a63" },
    reward: { item: "Enamel pin + sticker set", itemFr: "Épinglette émaillée + autocollants", note: "A month in. The first thing you own that says you train here.", noteFr: "Un mois. La première chose à toi qui dit que tu t’entraînes ici.", physical: true } },
  { key: "bronze", name: "Bronze", nameFr: "Bronze", from: 21,
    metal: { rim: "#7a441d", face: "#b9743a", shine: "#e6ab73" },
    reward: { item: "Insulated water bottle", itemFr: "Gourde isotherme", note: "Three months. You are not experimenting any more.", noteFr: "Trois mois. T’es plus en train d’essayer.", physical: true } },
  { key: "silver", name: "Silver", nameFr: "Argent", from: 31,
    metal: { rim: "#6f7883", face: "#aab4c0", shine: "#e8eef5" },
    reward: { item: "Training tee", itemFr: "T-shirt d’entraînement", note: "Half a year of work. Earned, not bought.", noteFr: "Six mois de travail. Gagné, pas acheté.", physical: true } },
  { key: "gold", name: "Gold", nameFr: "Or", from: 41,
    metal: { rim: "#8a6410", face: "#d7a327", shine: "#fbe08a" },
    reward: { item: "Gym bag", itemFr: "Sac de sport", note: "A full year. Most people never see this tier.", noteFr: "Une année complète. La plupart du monde ne voit jamais ce palier.", physical: true } },
  { key: "emerald", name: "Emerald", nameFr: "Émeraude", from: 51,
    metal: { rim: "#134f33", face: "#2f9c66", shine: "#8fe3b6" },
    reward: { item: "Gift card, store of your choice", itemFr: "Carte-cadeau, magasin de ton choix", note: "Two years of showing up. Spend it on whatever you train for.", noteFr: "Deux ans à être là. Dépense-la pour ce qui te fait t’entraîner.", physical: true } },
  { key: "platine", name: "Platine", nameFr: "Platine", from: 61,
    metal: { rim: "#5f6c72", face: "#b6c9cb", shine: "#f0fbfb" },
    reward: { item: "Forge jacket", itemFr: "Manteau FORGE", note: "The last tier. There is nothing after this but the work.", noteFr: "Le dernier palier. Après ça, il reste juste le travail.", physical: true } },
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

/** A tier's name in the given language (the current one by default). */
export const tierName = (t: Pick<Tier, "name" | "nameFr">, lang: Lang = getLang()) => (lang === "fr" ? t.nameFr : t.name);
export const rewardItem = (r: Reward, lang: Lang = getLang()) => (lang === "fr" ? r.itemFr : r.item);
export const rewardNote = (r: Reward, lang: Lang = getLang()) => (lang === "fr" ? r.noteFr : r.note);

export function rankFor(level: number, lang: Lang = getLang()) {
  return `${tierName(tierForLevel(level), lang)} ${subRankFor(level)}`;
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

/* ── Badge families ───────────────────────────────────────────
   The badges added after the first 27 are declared through `count`
   and `once`, which keep the English, the French and the family
   side by side. The original ones keep their literal entries. */

export type BadgeGroup = "training" | "outside" | "ride" | "habits" | "body";

/** The sections of the badge list, in order, with their names. */
export const BADGE_GROUPS: { key: BadgeGroup; name: string; nameFr: string }[] = [
  { key: "training", name: "Training", nameFr: "Entraînement" },
  { key: "outside", name: "Outside", nameFr: "Dehors" },
  { key: "ride", name: "FORGE Ride", nameFr: "FORGE Ride" },
  { key: "habits", name: "Food and habits", nameFr: "Alimentation et habitudes" },
  { key: "body", name: "Body", nameFr: "Corps" },
];
export const badgeGroupName = (g: Pick<(typeof BADGE_GROUPS)[number], "name" | "nameFr">, lang: Lang = getLang()) => (lang === "fr" ? g.nameFr : g.name);

const MORE_FR: Record<string, { name: string; desc: string }> = {};
const GROUP_OF: Record<string, BadgeGroup> = {
  first_route: "outside", dist_100k: "outside", dist_1000k: "outside", everest: "outside", sub20_5k: "outside", zone2_100h: "outside", shared_10: "outside",
  down_1lb: "body", down_5lb: "body", down_10lb: "body", down_20lb: "body", up_2lb: "body", up_5lb: "body",
  meals_100: "habits",
};
/** The family a badge is listed under (training when not said otherwise). */
export const badgeGroup = (b: Pick<Badge, "id">): BadgeGroup => GROUP_OF[b.id] ?? "training";

type Metric = (s: Stats, c: BadgeContext) => number;
function once(group: BadgeGroup, id: string, pillar: Badge["pillar"], en: [string, string], fr: [string, string], check: Badge["check"]): Badge {
  MORE_FR[id] = { name: fr[0], desc: fr[1] };
  GROUP_OF[id] = group;
  return { id, name: en[0], desc: en[1], pillar, check };
}
/** A count toward a target: unlocks on reaching it, with a progress ring on the way. */
function count(group: BadgeGroup, id: string, pillar: Badge["pillar"], value: Metric, target: number, en: [string, string], fr: [string, string]): Badge {
  const b = once(group, id, pillar, en, fr, (s, c) => value(s, c) >= target);
  return { ...b, progress: (s, c) => [Math.floor(value(s, c)), target] };
}

/* Sources. Counts kept in the stats row and counts derived from saved rows
   both exist for some of them; the larger wins, so history recorded before a
   total existed still counts and a cleared table does not take a badge away. */
const sessionsDone: Metric = (s) => s.totals.sessions;
const prs: Metric = (s) => s.totals.prs ?? 0;
const adjusted: Metric = (s) => s.totals.adjustedSessions ?? 0;
const checkIns: Metric = (s, c) => Math.max(s.totals.checkIns ?? 0, c.checkIns ?? 0);
const fullDays: Metric = (s, c) => Math.max(s.totals.fullDays ?? 0, c.fullDays ?? 0);
const weighIns: Metric = (s, c) => Math.max(s.totals.weighIns ?? 0, c.weighIns ?? 0);
const indoor = <K extends keyof NonNullable<BadgeContext["indoor"]>>(k: K): Metric => (_s, c) => c.indoor?.[k] ?? 0;
const medals = <K extends keyof NonNullable<BadgeContext["medals"]>>(k: K): Metric => (_s, c) => c.medals?.[k] ?? 0;
const outdoor = <K extends keyof NonNullable<BadgeContext["outdoor"]>>(k: K): Metric => (_s, c) => c.outdoor?.[k] ?? 0;
const routeDone = (key: string) => (s: Stats) => (s.routesDone ?? []).includes(key);
/** Keys of the routes that must all be finished for a "complete the set" badge. */
const REAL_ROUTES = GAME_ROUTES.filter((r) => r.real && r.country.fr === "France").map((r) => r.key); // "La vraie France": its cols and stages
const WORLD_ROUTES = GAME_ROUTES.filter((r) => !r.real && !r.free).map((r) => r.key);
const routesOf = (keys: string[]): Metric => (s) => keys.filter((k) => (s.routesDone ?? []).includes(k)).length;

const TRAINING_BADGES: Badge[] = [
  count("training", "sessions_25", "strength", sessionsDone, 25, ["Twenty-five", "25 sessions logged."], ["Vingt-cinq", "25 séances enregistrées."]),
  count("training", "sessions_100", "strength", sessionsDone, 100, ["Century", "100 sessions logged."], ["La centaine", "100 séances enregistrées."]),
  count("training", "sessions_250", "strength", sessionsDone, 250, ["Part of the furniture", "250 sessions logged."], ["Partie des meubles", "250 séances enregistrées."]),
  count("training", "sessions_500", "strength", sessionsDone, 500, ["Five hundred", "500 sessions logged."], ["Cinq cents", "500 séances enregistrées."]),
  count("training", "streak_26", "recovery", (s) => s.streakWeeks, 26, ["Half a year", "Twenty-six consecutive weeks."], ["Six mois", "Vingt-six semaines de suite."]),
  count("training", "streak_104", "recovery", (s) => s.streakWeeks, 104, ["Two years", "104 consecutive weeks."], ["Deux ans", "104 semaines de suite."]),
  count("training", "volume_250k", "strength", (s) => s.totals.volumeKg, 250000, ["250 tonnes", "250,000 kg lifted."], ["250 tonnes", "250 000 kg soulevés."]),
  count("training", "volume_1m", "strength", (s) => s.totals.volumeKg, 1000000, ["A thousand tonnes", "1,000,000 kg lifted."], ["Mille tonnes", "1 000 000 kg soulevés."]),
  count("training", "pr_1", "strength", prs, 1, ["New best", "First personal record set."], ["Nouveau record", "Premier record personnel battu."]),
  count("training", "pr_25", "strength", prs, 25, ["Record keeper", "25 personal records set."], ["Collectionneur de records", "25 records personnels battus."]),
  count("training", "mobility_1h", "mobility", (s) => s.totals.mobilityMin, 60, ["First hour of mobility", "60 minutes of mobility done."], ["Première heure de mobilité", "60 minutes de mobilité faites."]),
  count("training", "mobility_25h", "mobility", (s) => s.totals.mobilityMin, 1500, ["Supple", "1,500 minutes of mobility done."], ["Souple", "1 500 minutes de mobilité faites."]),
  count("training", "adjusted_1", "recovery", adjusted, 1, ["Showed up anyway", "A session done in its adjusted version, on a hard day."], ["Présent quand même", "Une séance faite en version ajustée, un jour difficile."]),
  count("training", "full_weeks_12", "all", (_s, c) => c.fullWeeks ?? 0, 12, ["Full block", "Twelve weeks with every planned session done."], ["Bloc complet", "Douze semaines avec toutes les séances prévues faites."]),
];

const OUTSIDE_BADGES: Badge[] = [
  count("outside", "run_10k", "endurance", outdoor("longestRunM"), 9950, ["Ten K", "A 10 km run."], ["Le 10 km", "Une course de 10 km."]),
  count("outside", "run_half", "endurance", outdoor("longestRunM"), 21050, ["Half marathon", "A 21.1 km run."], ["Demi-marathon", "Une course de 21,1 km."]),
  count("outside", "run_marathon", "endurance", outdoor("longestRunM"), 42100, ["Marathoner", "A 42.2 km run."], ["Marathonien", "Une course de 42,2 km."]),
  count("outside", "run_km_100", "endurance", outdoor("runKm"), 100, ["100 km on foot", "100 km run outdoors."], ["100 km à pied", "100 km de course dehors."]),
  count("outside", "run_km_1000", "endurance", outdoor("runKm"), 1000, ["1,000 km on foot", "1,000 km run outdoors."], ["1 000 km à pied", "1 000 km de course dehors."]),
  count("outside", "early_bird", "endurance", outdoor("earlyStarts"), 1, ["Early bird", "An activity started before 7 a.m."], ["Lève-tôt", "Une activité commencée avant 7 h."]),
  count("outside", "climb_out_25k", "endurance", outdoor("climbM"), 25000, ["Mountain legs", "25,000 m climbed outdoors."], ["Jambes de montagne", "25 000 m grimpés dehors."]),
  count("outside", "activities_50", "endurance", (s) => s.totals.activities ?? 0, 50, ["Fifty outings", "50 activities recorded."], ["Cinquante sorties", "50 activités enregistrées."]),
  count("outside", "activities_250", "endurance", (s) => s.totals.activities ?? 0, 250, ["Out the door", "250 activities recorded."], ["Toujours dehors", "250 activités enregistrées."]),
  count("outside", "sports_3", "endurance", outdoor("sports"), 3, ["Cross-trainer", "Three different sports recorded."], ["Touche-à-tout", "Trois sports différents enregistrés."]),
  count("outside", "sports_6", "endurance", outdoor("sports"), 6, ["All-rounder", "Six different sports recorded."], ["Polyvalent", "Six sports différents enregistrés."]),
];

const RIDE_BADGES: Badge[] = [
  count("ride", "ride_first", "endurance", indoor("rides"), 1, ["First spin", "First indoor ride."], ["Premier tour de roue", "Première sortie de vélo intérieur."]),
  count("ride", "ride_km_100", "endurance", indoor("km"), 100, ["100 km indoors", "100 km ridden indoors."], ["100 km à l’intérieur", "100 km roulés à l’intérieur."]),
  count("ride", "ride_km_500", "endurance", indoor("km"), 500, ["500 km indoors", "500 km ridden indoors."], ["500 km à l’intérieur", "500 km roulés à l’intérieur."]),
  count("ride", "ride_km_1000", "endurance", indoor("km"), 1000, ["1,000 km indoors", "1,000 km ridden indoors."], ["1 000 km à l’intérieur", "1 000 km roulés à l’intérieur."]),
  count("ride", "ride_km_5000", "endurance", indoor("km"), 5000, ["5,000 km indoors", "5,000 km ridden indoors."], ["5 000 km à l’intérieur", "5 000 km roulés à l’intérieur."]),
  count("ride", "ride_everest", "endurance", indoor("climbM"), 8849, ["Everest indoors", "8,849 m climbed indoors."], ["L’Everest à l’intérieur", "8 849 m grimpés à l’intérieur."]),
  count("ride", "ride_climb_25k", "endurance", indoor("climbM"), 25000, ["Above the clouds", "25,000 m climbed indoors."], ["Au-dessus des nuages", "25 000 m grimpés à l’intérieur."]),
  count("ride", "ride_climb_100k", "endurance", indoor("climbM"), 100000, ["Stratosphere", "100,000 m climbed indoors."], ["Stratosphère", "100 000 m grimpés à l’intérieur."]),
  count("ride", "ride_hours_10", "endurance", indoor("hours"), 10, ["Ten hours in the saddle", "Ten hours ridden indoors."], ["Dix heures en selle", "Dix heures roulées à l’intérieur."]),
  count("ride", "ride_hours_100", "endurance", indoor("hours"), 100, ["A hundred hours in the saddle", "100 hours ridden indoors."], ["Cent heures en selle", "100 heures roulées à l’intérieur."]),
  once("ride", "col_alpe", "endurance", ["Alpe d’Huez", "All 21 hairpins of the real Alpe d’Huez, to the top."], ["Alpe d’Huez", "Les 21 lacets de la vraie Alpe d’Huez, jusqu’en haut."], routeDone("c14")),
  once("ride", "col_ventoux", "endurance", ["Giant of Provence", "Mont Ventoux from Bédoin, finished."], ["Géant de Provence", "Le mont Ventoux depuis Bédoin, terminé."], routeDone("c15")),
  once("ride", "col_tourmalet", "endurance", ["Tourmalet", "Col du Tourmalet from Luz-Saint-Sauveur, finished."], ["Tourmalet", "Le col du Tourmalet depuis Luz-Saint-Sauveur, terminé."], routeDone("c16")),
  once("ride", "col_galibier", "endurance", ["Galibier", "Col du Galibier from Valloire, finished."], ["Galibier", "Le col du Galibier depuis Valloire, terminé."], routeDone("c17")),
  once("ride", "col_izoard", "endurance", ["Izoard", "Col d’Izoard from Briançon, finished."], ["Izoard", "Le col d’Izoard depuis Briançon, terminé."], routeDone("c18")),
  once("ride", "col_madeleine", "endurance", ["Madeleine", "Col de la Madeleine from La Chambre, finished."], ["Madeleine", "Le col de la Madeleine depuis La Chambre, terminé."], routeDone("c19")),
  once("ride", "stage_alps", "endurance", ["Queen stage", "The 112 km queen stage of the Alps, finished."], ["Étape reine", "L’étape reine des Alpes, 112 km, terminée."], routeDone("c20")),
  once("ride", "stage_tourmalet", "endurance", ["Lourdes to the Tourmalet", "The 49 km Tourmalet stage, finished."], ["De Lourdes au Tourmalet", "L’étape du Tourmalet, 49 km, terminée."], routeDone("c21")),
  once("ride", "tour_montreal", "endurance", ["Tour of Montréal", "Old Port to the Olympic Stadium over Mount Royal, finished."], ["Tour de Montréal", "Du Vieux-Port au Stade olympique par le mont Royal, terminé."], routeDone("c22")),
  count("ride", "real_all", "endurance", routesOf(REAL_ROUTES), REAL_ROUTES.length, ["Real France", "Every real climb and stage finished."], ["La vraie France", "Tous les cols et étapes réels terminés."]),
  count("ride", "worlds_all", "endurance", routesOf(WORLD_ROUTES), WORLD_ROUTES.length, ["World tour", "Every FORGE Ride world, circuit and challenge finished."], ["Tour du monde", "Tous les mondes, circuits et défis de FORGE Ride terminés."]),
  count("ride", "medal_gold", "endurance", medals("gold"), 1, ["Top step", "First gold medal on a segment."], ["Plus haute marche", "Première médaille d’or sur un segment."]),
  count("ride", "medal_gold_10", "endurance", medals("gold"), 10, ["Ten golds", "Ten segment gold medals."], ["Dix fois l’or", "Dix médailles d’or sur des segments."]),
  count("ride", "medal_kom", "endurance", medals("climbGold"), 1, ["King of the mountain", "Gold on a climb segment."], ["Roi de la montagne", "L’or sur un segment de montée."]),
  count("ride", "medal_sprint", "endurance", medals("sprintGold"), 1, ["Fast finish", "Gold on a sprint segment."], ["Pointe de vitesse", "L’or sur un segment de sprint."]),
  count("ride", "medals_25", "endurance", medals("any"), 25, ["Trophy case", "25 segment medals, any colour."], ["Vitrine à trophées", "25 médailles de segment, toutes couleurs."]),
  count("ride", "ride_workout_1", "endurance", indoor("workouts"), 1, ["By the plan", "First structured indoor workout ridden to the end."], ["Selon le plan", "Premier entraînement structuré fait jusqu’au bout à l’intérieur."]),
  count("ride", "ride_workout_10", "endurance", indoor("workouts"), 10, ["Structured", "Ten structured indoor workouts done."], ["Structuré", "Dix entraînements structurés faits à l’intérieur."]),
  count("ride", "ride_ftp_test", "endurance", indoor("ftpTests"), 1, ["Tested", "An FTP or ramp test ridden to the end."], ["Testé", "Un test FTP ou rampe fait jusqu’au bout."]),
  count("ride", "ride_group", "endurance", indoor("groupRides"), 1, ["In the bunch", "An indoor ride with other people."], ["Dans le peloton", "Une sortie intérieure avec d’autres cyclistes."]),
  count("ride", "ride_power", "endurance", indoor("powerRides"), 1, ["Measured", "An indoor ride with measured power."], ["Mesuré", "Une sortie intérieure avec la puissance mesurée."]),
];

const HABIT_BADGES: Badge[] = [
  count("habits", "meals_500", "nutrition", (s) => s.totals.mealsLogged, 500, ["Well fed", "500 meals logged."], ["Bonne fourchette", "500 repas enregistrés."]),
  count("habits", "meals_1000", "nutrition", (s) => s.totals.mealsLogged, 1000, ["A thousand meals", "1,000 meals logged."], ["Mille repas", "1 000 repas enregistrés."]),
  count("habits", "fullday_1", "nutrition", fullDays, 1, ["Full plate", "Every meal of a day logged."], ["Assiette pleine", "Tous les repas d’une journée enregistrés."]),
  count("habits", "fullday_30", "nutrition", fullDays, 30, ["A month of eating right", "30 full nutrition days."], ["Un mois à bien manger", "30 journées de repas complètes."]),
  count("habits", "fullday_100", "nutrition", fullDays, 100, ["Fuel discipline", "100 full nutrition days."], ["Discipline dans l’assiette", "100 journées de repas complètes."]),
  count("habits", "checkin_7", "recovery", checkIns, 7, ["Checked in", "Seven morning check-ins."], ["Présent", "Sept check-ins du matin."]),
  count("habits", "checkin_30", "recovery", checkIns, 30, ["Listening in", "30 morning check-ins."], ["À l’écoute", "30 check-ins du matin."]),
  count("habits", "checkin_100", "recovery", checkIns, 100, ["Self-aware", "100 morning check-ins."], ["Lucide", "100 check-ins du matin."]),
  count("habits", "checkin_365", "recovery", checkIns, 365, ["Every morning", "365 morning check-ins."], ["Chaque matin", "365 check-ins du matin."]),
  count("habits", "weighin_10", "nutrition", weighIns, 10, ["On the scale", "Ten weigh-ins logged."], ["Sur la balance", "Dix pesées enregistrées."]),
  count("habits", "weighin_100", "nutrition", weighIns, 100, ["The long view", "100 weigh-ins logged."], ["Vue d’ensemble", "100 pesées enregistrées."]),
];

/** The emblem a badge wears: its pillar, or the bike for FORGE Ride badges. */
export type EmblemKind = Badge["pillar"] | "ride";
export const badgeEmblem = (b: Pick<Badge, "id" | "pillar">): EmblemKind => (badgeGroup(b) === "ride" ? "ride" : b.pillar);

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
  /* Body change, counted from the day the plan was built. Loss badges for fat-loss goals,
     gain badges for muscle-gain goals: nobody is congratulated for the opposite of what they asked for. */
  { id: "down_1lb", name: "First pound down", desc: "1 lb (0.45 kg) lighter than day one.", pillar: "nutrition", check: (_s, c) => isLoss(c) && (c.weightChangeKg ?? 0) <= -0.45, progress: (_s, c) => [lost(c, 0.45), 1] },
  { id: "down_5lb", name: "Five down", desc: "5 lb (2.3 kg) lighter than day one.", pillar: "nutrition", check: (_s, c) => isLoss(c) && (c.weightChangeKg ?? 0) <= -2.27, progress: (_s, c) => [lost(c, 0.45), 5] },
  { id: "down_10lb", name: "Ten down", desc: "10 lb (4.5 kg) lighter than day one.", pillar: "nutrition", check: (_s, c) => isLoss(c) && (c.weightChangeKg ?? 0) <= -4.54, progress: (_s, c) => [lost(c, 0.45), 10] },
  { id: "down_20lb", name: "Twenty down", desc: "20 lb (9 kg) lighter than day one.", pillar: "nutrition", check: (_s, c) => isLoss(c) && (c.weightChangeKg ?? 0) <= -9.07, progress: (_s, c) => [lost(c, 0.45), 20] },
  { id: "up_2lb", name: "First gains", desc: "2 lb (0.9 kg) heavier than day one, on a muscle-gain plan.", pillar: "strength", check: (_s, c) => isGain(c) && (c.weightChangeKg ?? 0) >= 0.9, progress: (_s, c) => [gained(c, 0.45), 2] },
  { id: "up_5lb", name: "Five up", desc: "5 lb (2.3 kg) heavier than day one, on a muscle-gain plan.", pillar: "strength", check: (_s, c) => isGain(c) && (c.weightChangeKg ?? 0) >= 2.27, progress: (_s, c) => [gained(c, 0.45), 5] },
  { id: "full_week", name: "Full week", desc: "Every planned session of a week, done.", pillar: "all", check: (_s, c) => (c.fullWeeks ?? 0) >= 1, progress: (_s, c) => [Math.min(1, c.fullWeeks ?? 0), 1] },
  { id: "full_month", name: "Four full weeks", desc: "Four weeks with every planned session done.", pillar: "all", check: (_s, c) => (c.fullWeeks ?? 0) >= 4, progress: (_s, c) => [Math.min(4, c.fullWeeks ?? 0), 4] },
  { id: "meals_100", name: "Fed", desc: "100 meals logged.", pillar: "nutrition", check: (s) => s.totals.mealsLogged >= 100, progress: (s) => [s.totals.mealsLogged, 100] },
  ...TRAINING_BADGES,
  ...OUTSIDE_BADGES,
  ...RIDE_BADGES,
  ...HABIT_BADGES,
];

/** Badge names and descriptions in French, by id. */
const BADGE_FR: Record<string, { name: string; desc: string }> = {
  first_session: { name: "Jour un", desc: "Première séance enregistrée." },
  ten_sessions: { name: "Dix de suite", desc: "Dix séances enregistrées." },
  fifty_sessions: { name: "Cinquante", desc: "Cinquante séances enregistrées." },
  streak_4: { name: "Un mois", desc: "Quatre semaines de suite." },
  streak_12: { name: "Un bloc", desc: "Douze semaines de suite." },
  streak_52: { name: "Un an", desc: "Cinquante-deux semaines de suite." },
  volume_100k: { name: "100 tonnes", desc: "100 000 kg soulevés." },
  bw_squat: { name: "Squat au poids du corps", desc: "e1RM au squat ≥ 1× ton poids." },
  "2x_deadlift": { name: "Soulevé de terre 2×", desc: "e1RM au soulevé de terre ≥ 2× ton poids." },
  first_pullup: { name: "Première traction", desc: "Une traction stricte enregistrée." },
  first_route: { name: "Premier parcours", desc: "Première activité enregistrée." },
  dist_100k: { name: "100 km", desc: "100 km enregistrés." },
  dist_1000k: { name: "1 000 km", desc: "1 000 km enregistrés." },
  everest: { name: "Everest", desc: "8 849 m de dénivelé enregistrés." },
  sub20_5k: { name: "5 km sous 20 min", desc: "5 km en moins de 20 minutes." },
  zone2_100h: { name: "100 h en zone 2", desc: "Cent heures d’aérobie facile." },
  shared_10: { name: "À voix haute", desc: "Dix activités partagées sur ton profil." },
  mobility_10h: { name: "Dix heures de mobilité", desc: "600 minutes de mobilité faites." },
  down_1lb: { name: "Première livre en moins", desc: "1 lb (0,45 kg) de moins qu’au jour un." },
  down_5lb: { name: "Cinq de moins", desc: "5 lb (2,3 kg) de moins qu’au jour un." },
  down_10lb: { name: "Dix de moins", desc: "10 lb (4,5 kg) de moins qu’au jour un." },
  down_20lb: { name: "Vingt de moins", desc: "20 lb (9 kg) de moins qu’au jour un." },
  up_2lb: { name: "Premiers gains", desc: "2 lb (0,9 kg) de plus qu’au jour un, sur un plan de prise de muscle." },
  up_5lb: { name: "Cinq de plus", desc: "5 lb (2,3 kg) de plus qu’au jour un, sur un plan de prise de muscle." },
  full_week: { name: "Semaine complète", desc: "Toutes les séances prévues d’une semaine, faites." },
  full_month: { name: "Quatre semaines complètes", desc: "Quatre semaines avec toutes les séances prévues faites." },
  meals_100: { name: "Bien nourri", desc: "100 repas enregistrés." },
};

/** A badge's name and description in the given language (the current one by default). */
export const badgeName = (b: Pick<Badge, "id" | "name">, lang: Lang = getLang()) => (lang === "fr" ? (BADGE_FR[b.id] ?? MORE_FR[b.id])?.name ?? b.name : b.name);
export const badgeDesc = (b: Pick<Badge, "id" | "desc">, lang: Lang = getLang()) => (lang === "fr" ? (BADGE_FR[b.id] ?? MORE_FR[b.id])?.desc ?? b.desc : b.desc);

function isLoss(c: BadgeContext) { return c.goal === "cut" || c.goal === "recomp"; }
function isGain(c: BadgeContext) { return c.goal === "build" || c.goal === "strength"; }
/** Pounds lost / gained so far, for progress bars (whole pounds). */
function lost(c: BadgeContext, perLb: number) { return Math.max(0, Math.floor(-(c.weightChangeKg ?? 0) / perLb)); }
function gained(c: BadgeContext, perLb: number) { return Math.max(0, Math.floor((c.weightChangeKg ?? 0) / perLb)); }

export function evaluateBadges(stats: Stats, ctx: Parameters<Badge["check"]>[1]) {
  return BADGES.filter((b) => !stats.badges.includes(b.id) && b.check(stats, ctx)).map((b) => b.id);
}
