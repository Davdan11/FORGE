import { db, getStats } from "./db";
import { levelFromXp } from "./gamification";
import { lookItems, ownedKeys, sparks, tryBuy, type BuyResult } from "./shop";

/* The garage purchases, saved on the stats row (so they sync with it). */

export async function wallet() {
  const stats = await getStats();
  return { sparks: sparks(stats), owned: ownedKeys(stats) };
}

export async function buy(key: string): Promise<BuyResult> {
  const stats = await getStats();
  const r = tryBuy(stats, levelFromXp(stats.xp).level, key);
  if (!r.ok) return r;
  await db.stats.put({ ...stats, coinsSpent: (stats.coinsSpent ?? 0) + r.price, owned: [...(stats.owned ?? []), key], dirty: 1, updatedAt: new Date().toISOString() });
  return r;
}

/**
 * Riders who dressed before the shop existed keep what they wear: the skins in
 * their saved look become theirs, free, once.
 */
export async function keepWorn(look: string | undefined) {
  const stats = await getStats();
  if (stats.owned) return;   // already done (the list exists from the first ready on)
  const have = new Set(ownedKeys(stats));
  const add = lookItems(look).filter((k) => !have.has(k));
  await db.stats.put({ ...stats, owned: add, dirty: 1, updatedAt: new Date().toISOString() });
}
