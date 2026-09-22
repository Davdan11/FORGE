/* ─────────────────────────────────────────────────────────────
   Supplied artwork for badges and ranks.

   Drop `<badge-id>.png` into /public/badges (optionally
   `<badge-id>--locked.png` for the dimmed state), or
   `<tier-key>.png` into /public/ranks, then run `npm run art`.

   Anything without a file keeps the drawn emblem, so a set can be
   filled in one piece at a time without the app looking broken in
   between.
   ───────────────────────────────────────────────────────────── */
import badges from "../../../public/badges/manifest.json";
import ranks from "../../../public/ranks/manifest.json";

export type Art = {
  src: string; locked?: string;
  /** Per sub-rank artwork, when a tier has been drawn at each level. */
  sub1?: string; sub2?: string; sub3?: string; sub4?: string; sub5?: string;
  sub1Locked?: string; sub2Locked?: string; sub3Locked?: string; sub4Locked?: string; sub5Locked?: string;
};

const SUBS = ["I", "II", "III", "IV", "V"] as const;

const BADGES = badges as Record<string, Art>;
const RANKS = ranks as Record<string, Art>;

/** Artwork for a badge, or undefined to fall back to the drawn emblem. */
export function badgeArt(id: string, earned: boolean): string | undefined {
  const a = BADGES[id];
  if (!a) return undefined;
  return earned ? a.src : (a.locked ?? a.src);
}

/**
 * Artwork for a rank tier at a given sub-rank, falling back to the tier's
 * general file, then to the drawn shield. A set produced only at sub-rank I
 * still renders every level rather than leaving gaps.
 */
export function rankArt(tierKey: string, earned = true, sub?: string): string | undefined {
  const a = RANKS[tierKey];
  if (!a) return undefined;
  const i = sub ? SUBS.indexOf(sub as (typeof SUBS)[number]) + 1 : 0;
  const exact = i > 0 ? a[`sub${i as 1 | 2 | 3 | 4 | 5}`] : undefined;
  const exactLocked = i > 0 ? a[`sub${i as 1 | 2 | 3 | 4 | 5}Locked`] : undefined;
  return earned ? (exact ?? a.src) : (exactLocked ?? a.locked ?? exact ?? a.src);
}

/** True when a badge has supplied art and no separate locked version, so the
 *  component knows it must dim the image itself. */
export const badgeNeedsDimming = (id: string, earned: boolean) =>
  !earned && !!BADGES[id] && !BADGES[id].locked;

export const rankNeedsDimming = (tierKey: string, earned: boolean) =>
  !earned && !!RANKS[tierKey] && !RANKS[tierKey].locked;

export const artCount = () => ({ badges: Object.keys(BADGES).length, ranks: Object.keys(RANKS).length });
