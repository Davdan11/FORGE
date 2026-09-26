import type { Stats } from "./types";

/* ─────────────────────────────────────────────────────────────
   Sparks: the currency of the FORGE Ride garage.

   Every XP earned anywhere in the app (sessions, runs, meals, rides…) is also a
   spark, and every badge adds a bonus, so the balance never needs its own award
   path: it is what was earned minus what was spent. Being derived from XP, it is
   as honest as XP (a ride typed on a slider earns neither).

   The app is the authority: the game asks to buy, the app checks the level and
   the balance, records the purchase and tells the game what is owned. The
   catalogue mirrors RigSkins.cs in the Unity project, index for index.
   ───────────────────────────────────────────────────────────── */

export type SkinSlot = "outfit" | "helmet" | "shoes" | "glasses" | "frame" | "wheels";
export type Rarity = "common" | "rare" | "epic" | "legendary";
export interface ShopItem { slot: SkinSlot; index: number; en: string; fr: string; rarity: Rarity; level: number; golds: number; routes: number }

export const BADGE_SPARKS = 100;
export const PRICE: Record<Rarity, number> = { common: 250, rare: 750, epic: 2000, legendary: 5000 };

// [fr, en, rarity, level, golds, routes], in RigSkins.cs order.
type Row = [string, string, Rarity, number, number?, number?];
const ROWS: Record<SkinSlot, Row[]> = {
  outfit: [
    ["ÉQUIPE DYNAMICC", "TEAM DYNAMICC", "common", 0], ["QUÉBEC", "QUÉBEC", "common", 0], ["ROUGE COURSE", "RACE RED", "common", 2],
    ["NUIT BLANCHE", "WHITE NIGHT", "rare", 4], ["BLEU MARINE", "NAVY", "rare", 6], ["ÉMERAUDE", "EMERALD", "epic", 9],
    ["ROSE MAILLOT", "PINK JERSEY", "epic", 12], ["OR NOIR", "BLACK GOLD", "legendary", 15, 3], ["CHAMPION", "CHAMPION", "legendary", 20, 5, 3],
    ["VAGUE BLEUE", "BLUE WAVE", "rare", 3], ["VIPÈRE", "VIPER", "rare", 5], ["CYBER VIOLET", "CYBER VIOLET", "epic", 7],
    ["BLIZZARD", "BLIZZARD", "epic", 9], ["ÉCLAIR ROUGE", "RED BOLT", "epic", 11], ["AILES D'OR", "GOLDEN WINGS", "legendary", 13, 1],
    ["COURONNE NOIRE", "BLACK CROWN", "legendary", 16, 3], ["FLEUR-DE-LYS", "FLEUR-DE-LYS", "legendary", 18, 3],
  ],
  helmet: [
    ["D'ORIGINE", "ORIGINAL", "common", 0], ["BLANC", "WHITE", "common", 2], ["NOIR MAT", "MATTE BLACK", "common", 3],
    ["ROUGE", "RED", "rare", 5], ["BLEU ROI", "ROYAL BLUE", "rare", 7], ["OR", "GOLD", "legendary", 15, 3],
  ],
  shoes: [
    ["D'ORIGINE", "ORIGINAL", "common", 0], ["BLANCHES", "WHITE", "common", 2], ["ROUGES", "RED", "rare", 4],
    ["FLUO", "FLUO", "rare", 6], ["BLEU GLACIER", "GLACIER BLUE", "epic", 10], ["OR", "GOLD", "legendary", 15, 3],
  ],
  glasses: [
    ["BRONZE", "BRONZE", "common", 0], ["NOIR", "BLACK", "common", 0], ["BLEU MIROIR", "BLUE MIRROR", "rare", 3],
    ["ROUGE MIROIR", "RED MIRROR", "rare", 5], ["VERT", "GREEN", "epic", 8], ["OR", "GOLD", "legendary", 15, 3],
  ],
  frame: [
    ["WADOO CIEL", "WADOO SKY", "common", 0], ["ROUGE CORSA", "CORSA RED", "common", 2], ["MENTHE", "MINT", "common", 3],
    ["ORANGE FLUO", "FLUO ORANGE", "rare", 5], ["VIOLET", "VIOLET", "rare", 7], ["NOIR TOTAL", "ALL BLACK", "epic", 10],
    ["BLANC PUR", "PURE WHITE", "epic", 12], ["OR", "GOLD", "legendary", 18, 5],
    ["AÉRO ROUGE", "AERO RED", "legendary", 20, 5],
  ],
  wheels: [
    ["CARBONE", "CARBON", "common", 0], ["LOGOS ROUGES", "RED DECALS", "common", 2], ["LOGOS BLEUS", "BLUE DECALS", "rare", 4],
    ["NÉON", "NEON", "rare", 6], ["GRAPHITE", "GRAPHITE", "epic", 10], ["LOGOS OR", "GOLD DECALS", "legendary", 15, 3],
    ["ROUES PLEINES QUÉBEC", "QUÉBEC DISC WHEELS", "legendary", 20, 5],
  ],
};
export const SLOTS = Object.keys(ROWS) as SkinSlot[];
export const CATALOGUE: ShopItem[] = SLOTS.flatMap((slot) =>
  ROWS[slot].map(([fr, en, rarity, level, golds = 0, routes = 0], index) => ({ slot, index, fr, en, rarity, level, golds, routes })));

export const itemKey = (slot: SkinSlot, index: number) => `skin:${slot}:${index}`;
export function findItem(key: string): ShopItem | undefined {
  const m = /^skin:([a-z]+):(\d+)$/.exec(key);
  return m ? CATALOGUE.find((i) => i.slot === m[1] && i.index === Number(m[2])) : undefined;
}
/** Free items: nothing to reach, nothing to pay. */
/**
 * Opening: the whole garage is free and open to everyone (no price, no level). Set to false when the shop
 * starts charging (the game's RiderUnlocks.LaunchFree too).
 */
export const LAUNCH_FREE = true;
export const isFree = (i: ShopItem) => LAUNCH_FREE || i.level + i.golds + i.routes === 0;
export const priceOf = (i: ShopItem) => (isFree(i) ? 0 : PRICE[i.rarity]);

export function sparks(stats: Pick<Stats, "xp" | "badges" | "coinsSpent" | "testSparks">) {
  // testSparks: TEMPORARY owner's test bonus (see TEST_BONUS), remove before launch.
  return Math.max(0, Math.round(stats.xp + BADGE_SPARKS * stats.badges.length + (stats.testSparks ?? 0) - (stats.coinsSpent ?? 0)));
}

/** Everything owned: the free items plus what was bought. */
export function ownedKeys(stats: Pick<Stats, "owned">): string[] {
  return [...new Set([...CATALOGUE.filter(isFree).map((i) => itemKey(i.slot, i.index)), ...(stats.owned ?? [])])];
}

/** The skins in a look code (its last six numbers), as item keys. */
export function lookItems(code: string | undefined): string[] {
  const p = (code ?? "").split(".");
  if (p.length < 20) return [];
  return SLOTS.map((slot, i) => itemKey(slot, Number(p[14 + i]))).filter((k) => findItem(k));
}

export type BuyResult = { ok: true; item: ShopItem; price: number } | { ok: false; reason: "unknown" | "owned" | "level" | "sparks"; need?: number };

/** Checks a purchase against the level and the balance. Pure: the caller saves the change. */
export function tryBuy(stats: Pick<Stats, "xp" | "badges" | "coinsSpent" | "owned" | "testSparks">, level: number, key: string): BuyResult {
  const item = findItem(key);
  if (!item) return { ok: false, reason: "unknown" };
  if (ownedKeys(stats).includes(key)) return { ok: false, reason: "owned" };
  // TEMPORARY: the owner's test bonus also lifts the level requirement (remove with TEST_BONUS).
  if (level < item.level && !stats.testSparks && !LAUNCH_FREE) return { ok: false, reason: "level", need: item.level };
  const price = priceOf(item);
  if (sparks(stats) < price) return { ok: false, reason: "sparks", need: price - sparks(stats) };
  return { ok: true, item, price };
}

/**
 * TEMPORARY, remove before launch: a test bonus for the owner to try the garage before earning the sparks.
 * Opening /indoor?bonus=<code> once adds it to this device's stats; while it is there, levels and medals do not lock
 * anything (the game is told with "wallet".test).
 */
export const TEST_BONUS = { code: "forge-garage-test", sparks: 20000 } as const;
