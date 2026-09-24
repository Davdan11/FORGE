"use client";

import { supabase } from "../supabase/client";
import type { RaceCategory } from "../indoor/rating";
import { clubTagsFor } from "./clubs";

/* ─────────────────────────────────────────────────────────────
   Following riders (supabase/social.sql, table follows).

   Following is one-way, like a subscription: you choose whose
   rides you want to see, and they do not have to agree. "Friends"
   in the app are the people you follow. Nothing here reveals more
   than a handle, a rating and a club tag, which are public already.

   Every function answers something harmless ([] or false) when
   the app runs offline or nobody is signed in, and never throws:
   the page that calls them is a list, not a place for errors.
   ───────────────────────────────────────────────────────────── */

export interface RiderCard { user_id: string; handle: string; rating?: number; races?: number; category?: RaceCategory; club_tag?: string }

/** The signed-in user's id, or null (offline, signed out). */
export async function myId(): Promise<string | null> {
  if (!supabase) return null;
  try {
    const { data } = await supabase.auth.getUser();
    return data.user?.id ?? null;
  } catch { return null; }
}

export async function follow(userId: string): Promise<boolean> {
  const me = await myId();
  if (!me || !supabase || me === userId) return false;
  const { error } = await supabase.from("follows").insert({ follower: me, followee: userId });
  // 23505: already following, from a double tap. That is the state wanted.
  return !error || error.code === "23505";
}

export async function unfollow(userId: string): Promise<boolean> {
  const me = await myId();
  if (!me || !supabase) return false;
  const { error } = await supabase.from("follows").delete().eq("follower", me).eq("followee", userId);
  return !error;
}

/** The ids I follow. */
export async function following(): Promise<string[]> {
  const me = await myId();
  if (!me || !supabase) return [];
  const { data, error } = await supabase.from("follows").select("followee").eq("follower", me);
  return error || !data ? [] : data.map((r: { followee: string }) => r.followee);
}

/** The ids following me. */
export async function followers(): Promise<string[]> {
  const me = await myId();
  if (!me || !supabase) return [];
  const { data, error } = await supabase.from("follows").select("follower").eq("followee", me);
  return error || !data ? [] : data.map((r: { follower: string }) => r.follower);
}

/**
 * What someone typed, as a LIKE prefix, or null when there is nothing to look
 * for. Handles are lowercase letters, digits and underscore, so anything else
 * is dropped rather than sent; the underscore is escaped because LIKE reads it
 * as "any one character".
 */
export function searchPattern(query: string): string | null {
  const q = query.trim().toLowerCase().replace(/^@/, "").replace(/[^a-z0-9_]/g, "").slice(0, 20);
  return q ? `${q.replace(/_/g, "\\_")}%` : null;
}

/** Riders whose handle starts with the query, me excluded. */
export async function findRiders(query: string): Promise<{ user_id: string; handle: string }[]> {
  const pattern = searchPattern(query);
  const me = await myId();
  if (!pattern || !me || !supabase) return [];
  const { data, error } = await supabase.from("handles").select("user_id, handle").like("handle", pattern).neq("user_id", me).order("handle").limit(10);
  return error || !data ? [] : (data as { user_id: string; handle: string }[]);
}

/**
 * Handles, ratings and club tags for these riders, in one round of queries.
 * A rider with no handle has nothing public to show, so they are left out.
 * The club tag comes from the membership itself rather than the rating row,
 * which only learns about a new club the next time a race is posted.
 */
export async function profilesFor(ids: string[]): Promise<RiderCard[]> {
  const unique = [...new Set(ids)].slice(0, 200);
  if (!unique.length || !supabase || !(await myId())) return [];
  const [handles, ratings, tags] = await Promise.all([
    supabase.from("handles").select("user_id, handle").in("user_id", unique),
    supabase.from("rider_ratings").select("user_id, rating, races, category").in("user_id", unique),
    clubTagsFor(unique),
  ]);
  if (handles.error || !handles.data) return [];
  const rated = new Map((ratings.data ?? []).map((r: { user_id: string; rating: number; races: number; category: RaceCategory }) => [r.user_id, r]));
  return (handles.data as { user_id: string; handle: string }[]).map((h) => {
    const r = rated.get(h.user_id);
    const tag = tags.get(h.user_id);
    return { user_id: h.user_id, handle: h.handle, ...(r ? { rating: r.rating, races: r.races, category: r.category } : {}), ...(tag ? { club_tag: tag } : {}) };
  });
}

/** Rated riders first, strongest first; then the rest by handle. */
export function byRating<T extends { handle: string; rating?: number }>(a: T, b: T): number {
  return (b.rating ?? -1) - (a.rating ?? -1) || a.handle.localeCompare(b.handle);
}
