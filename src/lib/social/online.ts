"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "../supabase/client";
import { myId } from "./friends";

/* ─────────────────────────────────────────────────────────────
   Who is riding right now.

   One Supabase Realtime presence channel, "indoor:online", and no
   table: a rider in the game announces a handle and the route
   they are on, and the announcement disappears by itself when
   they stop or their connection drops. Nothing is stored.

   What is shared is a handle and the name of a fictional route.
   No position, no speed, nothing about the real world.

   Presence comes from other people's devices, so everything read
   from it is checked before it reaches the screen: a handle the
   database would refuse, a route key that is not a game route, or
   a name too long for a card is dropped, not displayed.

   The Realtime client hands back the same channel for the same
   name, so announcing and watching share one here, counted:
   closing one does not cut the other.
   ───────────────────────────────────────────────────────────── */

export interface OnlineRider { user_id: string; handle: string; routeKey: string; routeName: string; since: string }
type Info = { handle: string; routeKey: string; routeName: string };

const TOPIC = "indoor:online";
const HANDLE_RE = /^[a-z0-9_]{3,20}$/;
const ROUTE_RE = /^[cg][\w-]{0,40}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** One presence entry as we accept it, or null. */
export function cleanRider(userId: string, meta: unknown): OnlineRider | null {
  if (!UUID_RE.test(userId) || !meta || typeof meta !== "object") return null;
  const m = meta as Record<string, unknown>;
  const { handle, routeKey, routeName, since } = m;
  if (typeof handle !== "string" || !HANDLE_RE.test(handle)) return null;
  if (typeof routeKey !== "string" || !ROUTE_RE.test(routeKey)) return null;
  if (typeof routeName !== "string") return null;
  const name = routeName.trim();
  if (!name || name.length > 40) return null;
  // A start time from the future (a wrong clock) reads as "just now".
  const t = typeof since === "string" ? Date.parse(since) : NaN;
  const at = Number.isFinite(t) ? new Date(Math.min(t, Date.now())).toISOString() : new Date().toISOString();
  return { user_id: userId.toLowerCase(), handle, routeKey, routeName: name, since: at };
}

/** A presence state (key → metas) as riders: one per person, longest riding first. */
export function readPresence(state: Record<string, unknown[]>): OnlineRider[] {
  const out: OnlineRider[] = [];
  for (const [key, metas] of Object.entries(state)) {
    if (!Array.isArray(metas)) continue;
    // Several tabs share a key; the newest announcement is the route they are on now.
    const riders = metas.map((m) => cleanRider(key, m)).filter((r): r is OnlineRider => !!r);
    if (riders.length) out.push(riders.reduce((a, b) => (b.since > a.since ? b : a)));
  }
  return out.sort((a, b) => a.since.localeCompare(b.since));
}

/* ── the shared channel ─────────────────────────────────────── */

interface Hub { channel: RealtimeChannel; refs: number; ready: boolean; listeners: Set<(r: OnlineRider[]) => void>; last: OnlineRider[]; track: (Info & { since: string }) | null }
let hub: Promise<Hub | null> | null = null;
let current: Hub | null = null;

function open(): Promise<Hub | null> {
  if (hub) return hub;
  hub = (async () => {
    const me = await myId();
    if (!me || !supabase) return null;
    // The presence key is the user id, so two tabs are one rider, not two.
    const channel = supabase.channel(TOPIC, { config: { presence: { key: me } } });
    const h: Hub = { channel, refs: 0, ready: false, listeners: new Set(), last: [], track: null };
    current = h;
    channel.on("presence", { event: "sync" }, () => {
      h.last = readPresence(channel.presenceState() as Record<string, unknown[]>);
      h.listeners.forEach((cb) => cb(h.last));
    }).subscribe((status) => {
      h.ready = status === "SUBSCRIBED";
      if (h.ready && h.track) channel.track(h.track);
    });
    return h;
  })().catch(() => null);
  // Signed out now is not signed out forever: try again next time.
  hub.then((h) => { if (!h) hub = null; });
  return hub;
}

function release(h: Hub) {
  h.refs -= 1;
  if (h.refs > 0) return;
  if (current === h) { hub = null; current = null; }
  supabase?.removeChannel(h.channel);
}

/** Announce that I am riding this route. Returns the function that stops it. */
export function announceRiding(info: Info): () => void {
  const payload = { handle: info.handle.trim().toLowerCase(), routeKey: info.routeKey, routeName: info.routeName.trim().slice(0, 40), since: new Date().toISOString() };
  // Refuse to announce what every watcher would drop anyway.
  if (!HANDLE_RE.test(payload.handle) || !ROUTE_RE.test(payload.routeKey) || !payload.routeName || !supabase) return () => {};
  let stopped = false, held: Hub | null = null;
  open().then((h) => {
    if (!h) return;
    h.refs += 1;
    // Stopped before the channel was ready: give it straight back.
    if (stopped) return release(h);
    held = h;
    h.track = payload;
    if (h.ready) h.channel.track(payload);
  });
  return () => {
    if (stopped) return;
    stopped = true;
    if (!held) return;
    held.track = null;
    if (held.ready) held.channel.untrack();
    release(held);
  };
}

/** Everyone riding now, whenever it changes. Returns the unsubscribe. */
export function watchOnline(cb: (riders: OnlineRider[]) => void): () => void {
  if (!supabase) return () => {};
  let stopped = false, held: Hub | null = null;
  open().then((h) => {
    if (!h) return;
    h.refs += 1;
    if (stopped) return release(h);
    held = h;
    h.listeners.add(cb);
    if (h.ready) cb(h.last);
  });
  return () => {
    if (stopped) return;
    stopped = true;
    if (!held) return;
    held.listeners.delete(cb);
    release(held);
  };
}
