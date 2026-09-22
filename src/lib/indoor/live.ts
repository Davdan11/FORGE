"use client";

import { supabase } from "../supabase/client";

/* ─────────────────────────────────────────────────────────────
   Riding with people who are really there.

   Every course has a room: a Supabase Realtime channel named
   after the course and the sport. Joining a ride joins the room,
   so "a game already in progress" is simply whoever is in that
   room right now — there is nothing to create or wait for.

   Presence says who is in the room (a first name, the sport).
   Broadcast carries each rider's position about once a second:
   metres along the course and speed. Between messages the other
   riders are extrapolated at their last speed, so they glide
   rather than jump.

   What is sent is a distance along a fictional road. No GPS, no
   location, nothing about where the person actually is — the
   privacy rule in HANDOVER holds. Positions are never stored.
   ───────────────────────────────────────────────────────────── */

export interface Peer {
  id: string;
  name: string;
  /** Metres along the course at `at`. */
  distanceM: number;
  speedMs: number;
  /** Local clock (ms) when this position was received. */
  at: number;
}

/** A rider not heard from in this long has left, whatever presence says. */
export const PEER_TIMEOUT_MS = 8000;

/** Where a peer is now, from where they were and how fast they were going. */
export function extrapolate(p: Peer, now: number): number {
  // Capped: a rider whose phone froze should stop, not ride off at 40 km/h
  // for the next eight seconds.
  const dt = Math.min(Math.max(0, now - p.at), 3000) / 1000;
  return p.distanceM + p.speedMs * dt;
}

/** Drop the silent ones. Returns the ids that were removed. */
export function prune(peers: Map<string, Peer>, now: number): string[] {
  const gone: string[] = [];
  for (const [id, p] of peers) if (now - p.at > PEER_TIMEOUT_MS) { peers.delete(id); gone.push(id); }
  return gone;
}

/** The room for a course and sport. Riders and runners have separate rooms. */
export const roomName = (courseId: string, sport: "ride" | "run") => `indoor:${sport}:${courseId}`.slice(0, 120);

/**
 * How many people are in a room, without joining it: subscribed but not
 * tracked, so looking does not add you to the count. Returns the unsubscribe.
 */
export function peekRoom(courseId: string, sport: "ride" | "run", onCount: (n: number) => void): () => void {
  if (!supabase) return () => {};
  const channel = supabase.channel(roomName(courseId, sport));
  channel.on("presence", { event: "sync" }, () => onCount(Object.keys(channel.presenceState()).length)).subscribe();
  return () => { supabase?.removeChannel(channel); };
}

export interface Room {
  /** Who is in the room right now, other than me. */
  peers: Map<string, Peer>;
  /** How many people presence reports, me included. */
  count: () => number;
  send: (distanceM: number, speedMs: number) => void;
  leave: () => void;
}

/**
 * Join a room. Resolves to null when there is no account to join with: an
 * anonymous rider would be a name nobody can report, so riding with others
 * needs a sign-in. Riding alone never does.
 */
export async function joinRoom(courseId: string, sport: "ride" | "run", name: string, onChange: () => void): Promise<Room | null> {
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const me = user.id;
  const peers = new Map<string, Peer>();
  let present = 1;

  const channel = supabase.channel(roomName(courseId, sport), {
    config: { presence: { key: me }, broadcast: { self: false, ack: false } },
  });

  channel
    .on("broadcast", { event: "pos" }, ({ payload }) => {
      const p = payload as { id?: string; n?: string; d?: number; v?: number };
      if (!p?.id || p.id === me || typeof p.d !== "number" || typeof p.v !== "number") return;
      // Bounds, because this is another client's word: nobody rides 30 m/s.
      if (!Number.isFinite(p.d) || p.d < 0 || p.v < 0 || p.v > 30) return;
      const had = peers.has(p.id);
      peers.set(p.id, { id: p.id, name: (p.n ?? "Rider").slice(0, 24), distanceM: p.d, speedMs: p.v, at: Date.now() });
      if (!had) onChange();
    })
    .on("presence", { event: "sync" }, () => {
      const state = channel.presenceState();
      present = Object.keys(state).length || 1;
      // Someone presence no longer lists has left the room: take them off the road now.
      for (const id of [...peers.keys()]) if (!state[id]) peers.delete(id);
      onChange();
    });

  await new Promise<void>((resolve) => {
    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({ name: name.slice(0, 24), sport, since: new Date().toISOString() });
        resolve();
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") resolve();
    });
  });

  const firstName = name.trim().split(/\s+/)[0]?.slice(0, 24) || "Rider";
  return {
    peers,
    count: () => present,
    send: (d, v) => { channel.send({ type: "broadcast", event: "pos", payload: { id: me, n: firstName, d: Math.round(d * 10) / 10, v: Math.round(v * 100) / 100 } }); },
    leave: () => { channel.untrack().catch(() => {}); supabase?.removeChannel(channel); },
  };
}
