"use client";

import { supabase } from "../supabase/client";
import { tr } from "../i18n";
import type { Outcome } from "./feed";
import { byRating, myId, profilesFor, type RiderCard } from "./friends";

/* ─────────────────────────────────────────────────────────────
   Clubs (supabase/social.sql, tables clubs and club_members).

   A club is a name, a 2 to 4 character tag that rides next to
   your handle in the game, and a colour. One club per rider: the
   membership row is keyed by the rider, so joining another club
   means leaving this one first. The owner is the only one who can
   change or delete it; deleting takes the memberships with it.

   The rules below exist twice on purpose, like the handle's: here
   so the form can say what is wrong before a round trip, and as
   CHECK constraints in Postgres so they hold for any client.
   ───────────────────────────────────────────────────────────── */

export interface Club { id: string; owner: string; name: string; tag: string; color: string; about: string | null; created_at: string; members: number; owned: boolean }

/** The six colours a club can wear. Picked to read on paper and on the game's dark HUD. */
export const CLUB_COLORS = ["#FF2E78", "#FF5A3D", "#FFB020", "#1FC76F", "#2E8BFF", "#8B5CF6"] as const;

const TAG_RE = /^[A-Z0-9]{2,4}$/;
const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

/** What the tag field holds once cleaned: uppercase, no spaces. */
export const normalTag = (tag: string) => tag.trim().toUpperCase().replace(/\s+/g, "");

/** What is wrong with a club before it is sent, or null. */
export function clubProblem({ name, tag, about, color }: { name: string; tag: string; about?: string; color?: string }): string | null {
  const n = name.trim();
  if (n.length < 3) return tr("Le nom du club fait au moins trois caractères.", "The club name needs three characters or more.");
  if (n.length > 32) return tr("Le nom du club fait 32 caractères au plus.", "The club name is 32 characters at most.");
  const t = normalTag(tag);
  if (t.length < 2 || t.length > 4) return tr("Le sigle fait de 2 à 4 caractères.", "The tag is 2 to 4 characters.");
  if (!TAG_RE.test(t)) return tr("Le sigle : lettres et chiffres seulement.", "The tag: letters and numbers only.");
  if (about && about.trim().length > 160) return tr("La description fait 160 caractères au plus.", "The description is 160 characters at most.");
  if (color && !HEX_RE.test(color)) return tr("Couleur inconnue.", "Unknown colour.");
  return null;
}

/** Most members first, then by name: a list sorted the way people look for a club. */
export function sortClubs<T extends { members: number; name: string }>(clubs: T[]): T[] {
  return [...clubs].sort((a, b) => b.members - a.members || a.name.localeCompare(b.name));
}

/** The average of the ratings present, rounded, or null when nobody is rated. */
export function averageRating(rows: { rating?: number | null }[]): number | null {
  const r = rows.map((x) => x.rating).filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  return r.length ? Math.round(r.reduce((a, b) => a + b, 0) / r.length) : null;
}

/** Dark or light text on a club colour, whichever reads (WCAG relative luminance). */
export function inkOn(hex: string): "#0b120e" | "#ffffff" {
  if (!HEX_RE.test(hex)) return "#0b120e";
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  // Contrast with white is 1.05/(l+.05), with ink about (l+.05)/.056: pick the larger.
  return 1.05 / (l + 0.05) >= (l + 0.05) / 0.056 ? "#ffffff" : "#0b120e";
}

const off = (): Outcome<never> => ({ ok: false, reason: tr("Connecte-toi pour utiliser les clubs.", "Sign in to use clubs.") });

type ClubRow = Omit<Club, "members" | "owned"> & { club_members?: { count: number }[] };
const toClub = (r: ClubRow, me: string | null, members?: number): Club => ({
  id: r.id, owner: r.owner, name: r.name, tag: r.tag, color: r.color, about: r.about, created_at: r.created_at,
  members: members ?? r.club_members?.[0]?.count ?? 0, owned: !!me && r.owner === me,
});

/** Every club, with how many riders it has. */
export async function listClubs(): Promise<Club[]> {
  const me = await myId();
  if (!me || !supabase) return [];
  const { data, error } = await supabase.from("clubs").select("id, owner, name, tag, color, about, created_at, club_members(count)").limit(200);
  return error || !data ? [] : sortClubs((data as ClubRow[]).map((r) => toClub(r, me)));
}

/** The club I belong to, or null. */
export async function myClub(): Promise<Club | null> {
  const me = await myId();
  if (!me || !supabase) return null;
  const { data } = await supabase.from("club_members").select("club_id").eq("user_id", me).maybeSingle();
  if (!data?.club_id) return null;
  const { data: club } = await supabase.from("clubs").select("id, owner, name, tag, color, about, created_at, club_members(count)").eq("id", data.club_id).maybeSingle();
  return club ? toClub(club as ClubRow, me) : null;
}

/** Club tags by rider, for putting a tag next to handles. */
export async function clubTagsFor(ids: string[]): Promise<Map<string, string>> {
  if (!supabase || !ids.length) return new Map();
  const { data, error } = await supabase.from("club_members").select("user_id, clubs(tag)").in("user_id", ids.slice(0, 200));
  if (error || !data) return new Map();
  // One-to-one through the foreign key, but the generated shape can be either.
  return new Map((data as unknown as { user_id: string; clubs: { tag: string } | { tag: string }[] | null }[])
    .map((r) => [r.user_id, Array.isArray(r.clubs) ? r.clubs[0]?.tag : r.clubs?.tag] as const)
    .filter((x): x is readonly [string, string] => !!x[1]));
}

/**
 * Keep the tag on my rating row in step with my club, so the world board and
 * the game show it without waiting for the next race. Nothing happens if I am
 * not on the board yet. It costs one of the thirty rating writes an hour.
 */
async function syncRatingTag(me: string, tag: string | null) {
  await supabase?.from("rider_ratings").update({ club_tag: tag }).eq("user_id", me);
}

/** Found a club and join it (leaving any club I was in). */
export async function createClub(input: { name: string; tag: string; color: string; about?: string }): Promise<Outcome<Club>> {
  const me = await myId();
  if (!me || !supabase) return off();
  const problem = clubProblem(input);
  if (problem) return { ok: false, reason: problem };
  const row = { owner: me, name: input.name.trim(), tag: normalTag(input.tag), color: input.color.toUpperCase(), about: input.about?.trim() || null };

  const { data, error } = await supabase.from("clubs").insert(row).select("id, owner, name, tag, color, about, created_at").single();
  if (error || !data) {
    if (error?.code === "23505") return { ok: false, reason: tr("Ce sigle est déjà pris.", "That tag is taken.") };
    if (error?.message.includes("too many clubs")) return { ok: false, reason: tr("Trois clubs par jour au plus. Réessaie demain.", "Three clubs a day at most. Try again tomorrow.") };
    return { ok: false, reason: error?.message ?? tr("Le club n’a pas pu être créé.", "The club could not be created.") };
  }
  const joined = await joinClub(data.id as string);
  return { ok: true, value: toClub(data as ClubRow, me, joined.ok ? 1 : 0) };
}

/** Join a club. One club per rider, so the current one is left first. */
export async function joinClub(id: string): Promise<Outcome<true>> {
  const me = await myId();
  if (!me || !supabase) return off();
  // No update policy on memberships: a move is a leave and a join.
  const left = await supabase.from("club_members").delete().eq("user_id", me);
  if (left.error) return { ok: false, reason: left.error.message };
  const { error } = await supabase.from("club_members").insert({ user_id: me, club_id: id });
  if (error) return { ok: false, reason: error.code === "23503" ? tr("Ce club n’existe plus.", "That club no longer exists.") : error.message };
  const { data: club } = await supabase.from("clubs").select("tag").eq("id", id).maybeSingle();
  await syncRatingTag(me, (club?.tag as string) ?? null);
  return { ok: true, value: true };
}

export async function leaveClub(): Promise<Outcome<true>> {
  const me = await myId();
  if (!me || !supabase) return off();
  const { error } = await supabase.from("club_members").delete().eq("user_id", me);
  if (error) return { ok: false, reason: error.message };
  await syncRatingTag(me, null);
  return { ok: true, value: true };
}

/** Delete a club I own. Its memberships go with it (on delete cascade). */
export async function deleteClub(id: string): Promise<Outcome<true>> {
  const me = await myId();
  if (!me || !supabase) return off();
  // RLS would quietly delete nothing for someone else's club; asking for the
  // deleted rows back tells "done" apart from "not yours".
  const { data, error } = await supabase.from("clubs").delete().eq("id", id).eq("owner", me).select("id");
  if (error) return { ok: false, reason: error.message };
  if (!data?.length) return { ok: false, reason: tr("Seul le fondateur peut supprimer ce club.", "Only the founder can delete this club.") };
  // The founder may have moved to another club since; only clear a tag that just lost its club.
  const { data: still } = await supabase.from("club_members").select("user_id").eq("user_id", me).maybeSingle();
  if (!still) await syncRatingTag(me, null);
  return { ok: true, value: true };
}

/** A club's riders with their handles and ratings, strongest first. */
export async function clubMembers(id: string): Promise<RiderCard[]> {
  if (!supabase || !(await myId())) return [];
  const { data, error } = await supabase.from("club_members").select("user_id").eq("club_id", id).limit(200);
  if (error || !data?.length) return [];
  return (await profilesFor(data.map((r: { user_id: string }) => r.user_id))).sort(byRating);
}
