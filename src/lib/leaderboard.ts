"use client";

import { supabase } from "./supabase/client";

/* ─────────────────────────────────────────────────────────────
   World segment boards for the Unity indoor game.

   Every climb and sprint in the game has a stable key ("c8:3000":
   route c8, starting at metre 3000). When a rider finishes one
   with MEASURED power, the time is posted to segment_efforts, and
   the board answers where it ranks — worldwide and in the rider's
   race category. The rules that matter (own rows only, measured
   only, physically possible, rate limit) live in the database:
   supabase/segments.sql. Estimated and typed efforts never post.
   ───────────────────────────────────────────────────────────── */

export type Category = "A" | "B" | "C" | "D";

export interface BoardRow { rank: number; user_id: string; name: string; seconds: number; category: string; riders: number }

/** Only a measured effort, on a real segment, in a real time, goes on a board. */
export function canPost(e: { quality: string; seconds: number; lengthM: number; segment: string }): boolean {
  return e.quality === "measured" && e.seconds >= 10 && e.lengthM >= 100 && e.lengthM / e.seconds <= 25 && /^[cg][\w-]*:\d+$/.test(e.segment);
}

/** Post a time. Returns false when it was not posted (not measured, not signed in, refused). */
export async function postSegment(e: { segment: string; lengthM: number; seconds: number; category: Category; name: string; quality: string }): Promise<boolean> {
  if (!supabase || !canPost(e)) return false;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { error } = await supabase.from("segment_efforts").insert({
    segment: e.segment, length_m: Math.round(e.lengthM), seconds: Math.round(e.seconds * 10) / 10,
    category: e.category, quality: "measured", name: e.name.trim().split(/\s+/)[0]?.slice(0, 24) || "Rider",
  });
  return !error;
}

export async function segmentBoard(segment: string, category: Category | null = null): Promise<BoardRow[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("segment_board", { seg: segment, cat: category, top: 10 });
  return error || !data ? [] : (data as BoardRow[]);
}

/** The game's "leaderboard" message: where I rank, and the top of the board. */
export function boardMessage(rows: BoardRow[], me: string, segment: string, name: string, category: Category | null) {
  const mine = rows.find((r) => r.user_id === me);
  return {
    type: "leaderboard",
    segment, name,
    place: mine?.rank ?? -1,
    of: rows[0]?.riders ?? 0,
    category: category ?? "",
    entries: rows.slice(0, 10).map((r) => ({ rank: r.rank, name: r.name, seconds: r.seconds, category: r.category, you: r.user_id === me })),
  };
}
