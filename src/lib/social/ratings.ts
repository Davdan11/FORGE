"use client";

import { supabase } from "../supabase/client";
import type { RaceCategory, Rating } from "../indoor/rating";

/* ─────────────────────────────────────────────────────────────
   The world board of FORGE ratings (supabase/social.sql,
   table rider_ratings). A rider appears under their public
   handle once they have one; the rules (own row only, 120 points
   a move at most, rate limit) live in the database.
   ───────────────────────────────────────────────────────────── */

export interface RatingRow { user_id: string; handle: string; rating: number; races: number; category: RaceCategory; club_tag: string | null }

/** Put my rating on the board. Quietly does nothing offline, signed out or without a handle. */
export async function postRating(r: Rating, category: RaceCategory, clubTag: string | null = null): Promise<boolean> {
  if (!supabase) return false;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: h } = await supabase.from("handles").select("handle").eq("user_id", user.id).maybeSingle();
  if (!h?.handle) return false;
  const { error } = await supabase.from("rider_ratings").upsert({
    user_id: user.id, handle: h.handle, rating: Math.round(r.value), races: r.races, category, club_tag: clubTag,
  });
  return !error;
}

/** The best riders, and optionally only these people (friends, a club's members). */
export async function ratingBoard(top = 50, only?: string[]): Promise<RatingRow[]> {
  if (!supabase) return [];
  let q = supabase.from("rider_ratings").select("user_id, handle, rating, races, category, club_tag").order("rating", { ascending: false }).limit(top);
  if (only) { if (!only.length) return []; q = q.in("user_id", only); }
  const { data, error } = await q;
  return error || !data ? [] : (data as RatingRow[]);
}

/** Where a rating sits in the world: how many riders are above it. */
export async function ratingPlace(rating: number): Promise<{ place: number; of: number } | null> {
  if (!supabase) return null;
  const above = await supabase.from("rider_ratings").select("user_id", { count: "exact", head: true }).gt("rating", rating);
  const all = await supabase.from("rider_ratings").select("user_id", { count: "exact", head: true });
  if (above.error || all.error) return null;
  return { place: (above.count ?? 0) + 1, of: Math.max(all.count ?? 0, 1) };
}
