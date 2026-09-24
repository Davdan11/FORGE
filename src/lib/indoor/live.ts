"use client";

import { supabase } from "../supabase/client";
import { tr } from "../i18n";

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
  /** Outfit code from the Unity game ("3.7.0.…"), when the peer rides it. */
  look?: string;
  /** Hex colour of the peer's name tag, when sent. */
  color?: string;
  /** How the peer's effort is measured, as their app says: "m" measured, "e" estimated, "d" declared. */
  quality?: "m" | "e" | "d";
  /** Race category from their FTP per kilo (Unity game). */
  category?: string;
  /** In proximity voice (they can be called). */
  voice?: boolean;
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
  /** My id in the room. */
  me: string;
  /** Who is in the room right now, other than me. */
  peers: Map<string, Peer>;
  /** How many people presence reports, me included. */
  count: () => number;
  /** `extra` rides along for the Unity game: outfit code and tag colour. */
  send: (distanceM: number, speedMs: number, extra?: { look?: string; color?: string; quality?: "m" | "e" | "d"; category?: string; voice?: boolean }) => void;
  /** A voice handshake message to one person in the room (see voice.ts). */
  signal: (toId: string, data: unknown) => void;
  /** Send a "bravo" to one person in the room. */
  kudos: (toId: string) => void;
  /** Say one of the game's ready-made lines to everyone in the room (see QUICK_LINES). */
  chat: (key: string) => void;
  leave: () => void;
}

/**
 * Join a room. Resolves to null when there is no account to join with: an
 * anonymous rider would be a name nobody can report, so riding with others
 * needs a sign-in. Riding alone never does.
 */
/**
 * The quick messages riders can send each other in the game. Only these keys
 * travel, never free text: each client shows the line in its own language, and
 * there is nothing to moderate.
 */
export const QUICK_LINES = ["go", "bravo", "together", "attack", "wait", "thanks", "goodrace", "gg"] as const;
export function quickLine(v: unknown): string | undefined {
  return typeof v === "string" && (QUICK_LINES as readonly string[]).includes(v) ? v : undefined;
}

export async function joinRoom(courseId: string, sport: "ride" | "run", name: string, onChange: () => void, onKudos?: (fromName: string) => void, onSignal?: (fromId: string, data: unknown) => void, onChat?: (fromId: string, fromName: string, key: string) => void): Promise<Room | null> {
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
      const p = payload as { id?: string; n?: string; d?: number; v?: number; lk?: unknown; c?: unknown; q?: unknown; cat?: unknown; vo?: unknown };
      if (!p?.id || p.id === me || typeof p.d !== "number" || typeof p.v !== "number") return;
      // Bounds, because this is another client's word: nobody rides 30 m/s.
      if (!Number.isFinite(p.d) || p.d < 0 || p.v < 0 || p.v > 30) return;
      const had = peers.has(p.id);
      peers.set(p.id, { id: p.id, name: (p.n ?? tr("Cycliste", "Rider")).slice(0, 24), distanceM: p.d, speedMs: p.v, at: Date.now(), look: lookCode(p.lk), color: hexColor(p.c), quality: p.q === "m" || p.q === "e" || p.q === "d" ? p.q : undefined, category: typeof p.cat === "string" && /^[ABCD]$/.test(p.cat) ? p.cat : undefined, voice: p.vo === 1 });
      if (!had) onChange();
    })
    .on("broadcast", { event: "kudos" }, ({ payload }) => {
      const k = payload as { to?: string; from?: string; n?: string };
      // Only the one it is for, and only from someone actually in the room.
      if (k?.to !== me || !k.from || !peers.has(k.from)) return;
      onKudos?.((k.n ?? tr("Cycliste", "Rider")).slice(0, 24));
    })
    .on("broadcast", { event: "chat" }, ({ payload }) => {
      const c = payload as { from?: string; n?: string; k?: unknown };
      // Only from someone riding in the room, and only a known line.
      const key = quickLine(c?.k);
      if (!c?.from || c.from === me || !peers.has(c.from) || !key) return;
      onChat?.(c.from, (c.n ?? tr("Cycliste", "Rider")).slice(0, 24), key);
    })
    .on("broadcast", { event: "rtc" }, ({ payload }) => {
      const m = payload as { to?: string; from?: string; s?: unknown };
      // Only for me, and only from someone riding in the room.
      if (m?.to !== me || !m.from || !peers.has(m.from)) return;
      onSignal?.(m.from, m.s);
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
  let lastChat = 0;
  return {
    me,
    peers,
    count: () => present,
    send: (d, v, extra) => { channel.send({ type: "broadcast", event: "pos", payload: { id: me, n: firstName, d: Math.round(d * 10) / 10, v: Math.round(v * 100) / 100, lk: extra?.look, c: extra?.color, q: extra?.quality, cat: extra?.category, vo: extra?.voice ? 1 : undefined } }); },
    signal: (to, data) => { if (peers.has(to)) channel.send({ type: "broadcast", event: "rtc", payload: { to, from: me, s: data } }); },
    kudos: (to) => { if (peers.has(to)) channel.send({ type: "broadcast", event: "kudos", payload: { to, from: me, n: firstName } }); },
    chat: (key) => {
      // One line every 2 s at most, whatever the game asks.
      const k = quickLine(key), now = Date.now();
      if (!k || now - lastChat < 2000) return;
      lastChat = now;
      channel.send({ type: "broadcast", event: "chat", payload: { from: me, n: firstName, k } });
    },
    leave: () => { channel.untrack().catch(() => {}); supabase?.removeChannel(channel); },
  };
}

/** Another client's word again: an outfit code is 14, 20 or 21 small numbers, nothing else. */
export function lookCode(v: unknown): string | undefined {
  // 14 numbers, 20 since the garage skins (outfit, helmet, shoes, glasses, frame, wheels), 21 with the rider (0 male, 1 female).
  return typeof v === "string" && /^-?\d{1,3}(\.-?\d{1,3}){13}((\.-?\d{1,3}){6}(\.[01])?)?$/.test(v) ? v : undefined;
}
export function hexColor(v: unknown): string | undefined {
  return typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v) ? v : undefined;
}
