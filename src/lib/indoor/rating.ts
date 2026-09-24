/* ─────────────────────────────────────────────────────────────
   The FORGE rating ("cote FORGE"): one number that says how well
   a rider races, like a chess rating.

   Every finished race moves it. What the rider scored (first of a
   field = 1, last = 0) is compared with what their rating expected
   against that field, whose strength is the category's baseline
   (a C field rates about 1200). Beating the expectation raises it,
   falling short lowers it: winning a D race moves a strong rider
   little, a good place in an A race moves them a lot. The first
   five races count double, so a new rider finds their level fast.
   The database caps each move at 120 points (supabase/social.sql).
   ───────────────────────────────────────────────────────────── */

export type RaceCategory = "A" | "B" | "C" | "D";

export interface Rating {
  value: number;
  races: number;
  best: number;
  /** The last few races, newest first. */
  history: { at: string; value: number; delta: number; place: number; of: number; category: RaceCategory }[];
}

/** The strength of a field in each category, and where a new rider starts. */
export const FIELD: Record<RaceCategory, number> = { A: 1700, B: 1450, C: 1200, D: 950 };

export function startRating(category: RaceCategory): Rating {
  return { value: FIELD[category], races: 0, best: FIELD[category], history: [] };
}

/** How likely this rating beats that field's typical rider (0..1). */
export function expected(value: number, field: number): number {
  return 1 / (1 + Math.pow(10, (field - value) / 400));
}

/** The rating after a finished race: `place` of `of` riders (1 = won). */
export function rateRace(before: Rating | undefined, category: RaceCategory, place: number, of: number, at = new Date().toISOString()): Rating {
  const r = before ?? startRating(category);
  if (!(of >= 2) || !(place >= 1) || place > of) return r;
  const score = (of - place) / (of - 1);
  const k = r.races < 5 ? 64 : 32;
  const delta = Math.max(-120, Math.min(120, Math.round(k * (score - expected(r.value, FIELD[category])))));
  const value = Math.max(100, Math.min(3500, r.value + delta));
  return {
    value, races: r.races + 1, best: Math.max(r.best, value),
    history: [{ at, value, delta, place, of, category }, ...r.history].slice(0, 10),
  };
}

/** A name for the level a rating shows (for the chip next to the number). */
export function ratingTier(value: number, en = false): string {
  if (value >= 1900) return en ? "Elite" : "Élite";
  if (value >= 1600) return "Expert";
  if (value >= 1300) return en ? "Strong" : "Confirmé";
  if (value >= 1000) return en ? "Rising" : "Espoir";
  return en ? "Rookie" : "Recrue";
}
