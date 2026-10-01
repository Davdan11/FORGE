"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "../supabase/client";

/* ─────────────────────────────────────────────────────────────
   Who is online, and where: one Realtime presence channel that
   every signed-in FORGE screen joins ("the lobby").

   Each tab says only where it is — the app, a game room ("unity:
   <route>" or an event's room) and on what (web game or Windows
   game). No name, no account id, no position: a random key per
   tab. Rooms already show riders' first names to each other; the
   lobby only counts. It feeds the "N online" on each road and the
   owner's panel (/admin). The Windows game speaks the same
   channel (Assets/Scripts/PcLive.cs).
   ───────────────────────────────────────────────────────────── */

export const LOBBY = "indoor:lobby";

/** Where this tab is: the app, or riding in a game room (web or Windows). */
export interface Where { w: "app" | "web" | "pc"; r?: string; s?: "ride" | "run" }

export interface LobbySnapshot {
  /** Tabs and games online right now (a person with two tabs counts twice). */
  online: number;
  byWhere: { app: number; web: number; pc: number };
  /** Room → how many are riding in it. */
  rooms: Map<string, number>;
}

let channel: RealtimeChannel | null = null;
let ready: Promise<void> | null = null;
let current: Where | null = null;
const watchers = new Set<(s: LobbySnapshot) => void>();
let last: LobbySnapshot = { online: 0, byWhere: { app: 0, web: 0, pc: 0 }, rooms: new Map() };

/** What the presence state says, counted. Exported for tests. */
export function countLobby(state: Record<string, { w?: unknown; r?: unknown }[]>): LobbySnapshot {
  const snap: LobbySnapshot = { online: 0, byWhere: { app: 0, web: 0, pc: 0 }, rooms: new Map() };
  for (const metas of Object.values(state)) {
    for (const m of metas) {
      const w = m.w === "web" || m.w === "pc" ? m.w : "app";
      snap.online++; snap.byWhere[w]++;
      if (typeof m.r === "string" && m.r && w !== "app") snap.rooms.set(m.r, (snap.rooms.get(m.r) ?? 0) + 1);
    }
  }
  return snap;
}

function ensure(): Promise<void> {
  if (ready) return ready;
  if (!supabase) return Promise.resolve();
  const sb = supabase;
  const key = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Math.random()).slice(2);
  const ch = sb.channel(LOBBY, { config: { presence: { key } } });
  channel = ch;
  ch.on("presence", { event: "sync" }, () => {
    last = countLobby(ch.presenceState() as Record<string, { w?: unknown; r?: unknown }[]>);
    for (const fn of watchers) fn(last);
  });
  ready = new Promise<void>((resolve) => {
    ch.subscribe((status) => {
      if (status === "SUBSCRIBED") { if (current) void ch.track({ ...current }); resolve(); }
      else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") resolve();
    });
  });
  return ready;
}

/**
 * Say where this tab is (null: invisible). Only a signed-in person is counted:
 * someone just looking at the site is not "online".
 */
export async function setWhere(where: Where | null) {
  if (!supabase) return;
  const { data } = await supabase.auth.getSession();
  current = data.session ? where : null;
  await ensure();
  if (!channel) return;
  if (current) await channel.track({ ...current }).catch(() => {});
  else await channel.untrack().catch(() => {});
}

/** Follow the lobby's counts (called at once with the latest). Returns the unsubscribe. */
export function watchLobby(fn: (s: LobbySnapshot) => void): () => void {
  watchers.add(fn);
  fn(last);
  void ensure();
  return () => { watchers.delete(fn); };
}

/** The game's room key for a road, as the lobby lists it ("unity:<route key>"). */
export const routeOfRoom = (room: string) => (room.startsWith("unity:") ? room.slice(6) : null);
