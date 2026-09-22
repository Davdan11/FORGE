import { supabase } from "../supabase/client";
import { db } from "../db";
import { verifyActivity } from "../verify";
import { cellOf, cellsAround, publishableRoute, type PublicRoute } from "./privacy";
import type { Activity, ActivityType } from "../types";

/* ─────────────────────────────────────────────────────────────
   The feed.

   Publishing is an act, never a setting. There is no "share
   everything" switch here, and no background job that posts on
   someone's behalf: a post exists because a person pressed a
   button on a finished activity, and it stops existing the moment
   they press the other one.

   Nothing in this file can run while a recording is in progress.
   `publish` takes an Activity, which only exists once the
   activity has ended — that is the real-time guarantee, enforced
   by the shape of the data rather than by a promise in a comment.
   ───────────────────────────────────────────────────────────── */

export interface FeedPost {
  id: string;
  handle: string;
  createdAt: string;
  sport: ActivityType;
  title: string;
  distanceM: number;
  durationSec: number;
  movingSec: number;
  elevM: number;
  /** What the track supported. Advisory — see the note on `publish`. */
  verdict: "verified" | "partial" | "unverified";
  route: PublicRoute;
  likeCount: number;
  likedByMe: boolean;
  mine: boolean;
}

type Row = {
  id: string; user_id: string; handle: string; created_at: string; cell: string;
  sport: ActivityType; title: string; distance_m: number; duration_sec: number;
  moving_sec: number; elev_m: number; verdict: FeedPost["verdict"];
  route: PublicRoute | null; like_count: number;
};

export type Outcome<T> = { ok: true; value: T } | { ok: false; reason: string };

const off = (): Outcome<never> => ({ ok: false, reason: "Sign in to use the feed." });

async function me() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

/* ── handle ────────────────────────────────────────────────────
   A post carries a handle the athlete chose, never the name they
   gave the app during onboarding. Those are often real names, and
   a real name was given so the app could greet them — not so it
   could be published beside a map of where they run. */

const HANDLE_RE = /^[a-z0-9_]{3,20}$/;

export function handleProblem(handle: string): string | null {
  const h = handle.trim().toLowerCase();
  if (h.length < 3) return "Three characters or more.";
  if (h.length > 20) return "Twenty characters at most.";
  if (!HANDLE_RE.test(h)) return "Lowercase letters, numbers and underscore only.";
  return null;
}

export async function getHandle(): Promise<string | null> {
  const user = await me();
  if (!user || !supabase) return null;
  const { data } = await supabase.from("handles").select("handle").eq("user_id", user.id).maybeSingle();
  return (data?.handle as string) ?? null;
}

export async function setHandle(handle: string): Promise<Outcome<string>> {
  const user = await me();
  if (!user || !supabase) return off();
  const problem = handleProblem(handle);
  if (problem) return { ok: false, reason: problem };
  const h = handle.trim().toLowerCase();

  const { error } = await supabase.from("handles").upsert({ user_id: user.id, handle: h }, { onConflict: "user_id" });
  // 23505 is Postgres' unique violation: somebody already answers to this.
  if (error) return { ok: false, reason: error.code === "23505" ? "That handle is taken." : error.message };

  // Posts carry the handle so the feed is one query. Renaming has to catch up
  // with them, or old posts keep a name their author has abandoned.
  await supabase.from("posts").update({ handle: h }).eq("user_id", user.id);
  return { ok: true, value: h };
}

/* ── publishing ──────────────────────────────────────────────── */

/**
 * Publish a finished activity.
 *
 * The verdict is computed here, from the full local track, before the track
 * is trimmed. Be clear about what that is worth: it is computed on the client,
 * so a determined person could send whatever verdict they liked. What they
 * cannot do is get past the bounds the database itself enforces — a post whose
 * distance and duration do not describe something a body can do is rejected by
 * Postgres, not by this function. The verdict makes honest data legible; the
 * constraints make dishonest data fail.
 */
export async function publish(a: Activity): Promise<Outcome<string>> {
  const user = await me();
  if (!user || !supabase) return off();

  const handle = await getHandle();
  if (!handle) return { ok: false, reason: "Choose a handle before your first post." };

  const v = verifyActivity(a.points, a.type, a.durationSec);
  const { route, cell } = publishableRoute(a.points);

  // No cell means the route was too short to trim, so it has no map and no
  // neighbourhood. It can still be posted — as numbers. What it cannot do is
  // appear in a local feed, because we do not know where it happened without
  // looking at the part we deliberately threw away.
  const fallbackCell = cell ?? (await lastKnownCell());
  if (!fallbackCell) return { ok: false, reason: "This route is too short to place on a map without revealing where it started." };

  const row = {
    id: a.id,
    user_id: user.id,
    handle,
    cell: fallbackCell,
    sport: a.type,
    title: a.title,
    distance_m: Math.round(a.distanceM),
    duration_sec: Math.round(a.durationSec),
    moving_sec: Math.round(a.movingSec ?? v.movingSec),
    elev_m: Math.round(a.elevGainM),
    verdict: v.verdict,
    route,
  };

  const { error } = await supabase.from("posts").upsert(row, { onConflict: "id" });
  if (error) return { ok: false, reason: error.message };
  return { ok: true, value: a.id };
}

/** Take a post down. The row is deleted, not hidden — and its likes go with it. */
export async function unpublish(activityId: string): Promise<Outcome<true>> {
  const user = await me();
  if (!user || !supabase) return off();
  const { error } = await supabase.from("posts").delete().eq("id", activityId).eq("user_id", user.id);
  if (error) return { ok: false, reason: error.message };
  return { ok: true, value: true };
}

/* ── reading ─────────────────────────────────────────────────── */

/**
 * The cell of the most recent activity that had one.
 *
 * Used so the feed can open on somewhere meaningful without asking the browser
 * for a position. Asking would be defensible — only the cell would ever be
 * sent — but a permission prompt on a screen that is just a list of other
 * people's runs is a poor trade, and the answer is usually already on the
 * device.
 */
export async function lastKnownCell(): Promise<string | null> {
  const recent = await db.activities.orderBy("startedAt").reverse().limit(12).toArray();
  for (const a of recent) {
    const { cell } = publishableRoute(a.points);
    if (cell) return cell;
    const mid = a.points[Math.floor(a.points.length / 2)];
    if (mid) return cellOf(mid.lat, mid.lng);
  }
  return null;
}

/** Posts from a cell and the eight around it, newest first. */
export async function nearby(cell: string, limit = 40): Promise<Outcome<FeedPost[]>> {
  if (!supabase) return off();
  const [la, ln] = cell.split(":").map(Number);
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return { ok: false, reason: "Unknown area." };

  // cellsAround takes coordinates, so step back into the middle of this cell.
  const cells = cellsAround((la + 0.5) * 0.1, (ln + 0.5) * 0.1);
  return query((q) => q.in("cell", cells).order("created_at", { ascending: false }).limit(limit));
}

/** Everything you have posted, newest first. */
export async function mine(limit = 40): Promise<Outcome<FeedPost[]>> {
  const user = await me();
  if (!user || !supabase) return off();
  return query((q) => q.eq("user_id", user.id).order("created_at", { ascending: false }).limit(limit));
}

type Q = ReturnType<NonNullable<typeof supabase>["from"]>["select"] extends (...a: never[]) => infer R ? R : never;

async function query(shape: (q: Q) => Q): Promise<Outcome<FeedPost[]>> {
  if (!supabase) return off();
  const user = await me();

  const { data, error } = await shape(supabase.from("posts").select("*") as Q) as unknown as { data: Row[] | null; error: { message: string } | null };
  if (error) return { ok: false, reason: error.message };
  const rows = data ?? [];
  if (!rows.length) return { ok: true, value: [] };

  // Which of these have I liked? One query for the page, not one per post.
  let liked = new Set<string>();
  if (user) {
    const { data: likes } = await supabase.from("post_likes").select("post_id").eq("user_id", user.id).in("post_id", rows.map((r) => r.id));
    liked = new Set((likes ?? []).map((l: { post_id: string }) => l.post_id));
  }

  return {
    ok: true,
    value: rows.map((r) => ({
      id: r.id,
      handle: r.handle,
      createdAt: r.created_at,
      sport: r.sport,
      title: r.title,
      distanceM: r.distance_m,
      durationSec: r.duration_sec,
      movingSec: r.moving_sec,
      elevM: r.elev_m,
      verdict: r.verdict,
      route: r.route ?? [],
      likeCount: r.like_count,
      likedByMe: liked.has(r.id),
      mine: !!user && r.user_id === user.id,
    })),
  };
}

/* ── likes ───────────────────────────────────────────────────── */

/**
 * Like or unlike. Returns the new state so the caller can settle its optimistic
 * update against what actually happened rather than assuming it worked.
 *
 * The count itself is maintained by a trigger in Postgres. Incrementing it from
 * here would race with every other person pressing the same button.
 */
export async function toggleLike(postId: string, liked: boolean): Promise<Outcome<boolean>> {
  const user = await me();
  if (!user || !supabase) return off();

  if (liked) {
    const { error } = await supabase.from("post_likes").delete().eq("post_id", postId).eq("user_id", user.id);
    if (error) return { ok: false, reason: error.message };
    return { ok: true, value: false };
  }

  const { error } = await supabase.from("post_likes").insert({ post_id: postId, user_id: user.id });
  // 23505: already liked, from a double tap or a second tab. That is the state
  // the person wanted, so it is not an error to report to them.
  if (error && error.code !== "23505") return { ok: false, reason: error.message };
  return { ok: true, value: true };
}
