import { db, getProfile, getStats, todayISO, addDays } from "./db";
import { supabase } from "./supabase/client";
import { levelFromXp, rankFor } from "./gamification";
import { sparks } from "./shop";
import { sessionTitle } from "./engine/plan";
import { exName, getExercise } from "./data/exercises";
import { getMeal } from "./nutrition/recipes";
import { mealTitle } from "./nutrition/cookbook";
import { eatenTotals } from "./nutrition/engine";
import { bilingual, getLang, loc, type Lang } from "./i18n";
import type { MealSlot, NutritionDay, Profile, Session, Stats, WeightUnit } from "./types";

/* ─────────────────────────────────────────────────────────────
   FORGE on a Garmin watch.

   The watch cannot read this phone's database, so the phone publishes a
   small summary of the day (the "watch feed") to Supabase, in the table
   `watch_feed` (see supabase/watch.sql). The watch app then asks for it
   with a pairing code, through the `watch_feed_for(code)` function, which
   only ever returns this one JSON document.

   The feed is built from local data only, in the language the app shows,
   and kept well under 8 KB: a watch parses it in a few dozen kilobytes of
   memory, and a background refresh can hand at most ~8 KB to the app.
   ───────────────────────────────────────────────────────────── */

export interface WatchExercise { name: string; sets: number; reps: number | null; sec: number | null; loadKg: number | null }
export interface WatchSession { title: string; minutes: number; done: boolean; zone: number | null; exercises: WatchExercise[] }
export interface WatchMeal { time: string; slot: string; name: string; kcal: number; protein: number; done: boolean }
export interface WatchFeed {
  v: 1;
  lang: Lang;
  /** ISO timestamp of the build, and the same as Unix seconds (easier on the watch). */
  updatedAt: string;
  ts: number;
  /** The phone's local date the feed describes ("2026-09-29"): the watch flags a feed from another day. */
  date: string;
  name: string;
  units: WeightUnit;
  rank: string;
  level: number;
  /** XP into the current level, and the XP that level needs. */
  xp: number;
  xpNext: number;
  xpTotal: number;
  /** The garage currency (sparks), shown on the watch as gems. */
  gems: number;
  streakWeeks: number;
  today: {
    session: WatchSession | null;
    meals: WatchMeal[];
    targets: { kcal: number; protein: number };
    eaten: { kcal: number; protein: number };
  };
  tomorrow: { session: string | null };
}

export interface WatchInput {
  profile: Pick<Profile, "name" | "units"> | null;
  stats: Pick<Stats, "xp" | "streakWeeks" | "badges" | "coinsSpent" | "testSparks">;
  today: Session | null;
  tomorrow: Session | null;
  nutrition: NutritionDay | null;
  lang: Lang;
  now?: Date;
}

/** The feed's size limit, bytes of JSON. */
export const WATCH_FEED_MAX_BYTES = 8000;
const MAX_EXERCISES = 8;

const SLOT: Record<MealSlot, [fr: string, en: string]> = {
  breakfast: ["Déjeuner", "Breakfast"], lunch: ["Dîner", "Lunch"], snack: ["Collation", "Snack"],
  dinner: ["Souper", "Dinner"], pre: ["Pré-entraînement", "Pre-workout"], post: ["Récupération", "Recovery"],
};

/** A session's name in a given language (the engine's own names, whatever language the app shows now). */
const titleIn = (s: Session, lang: Lang) => loc(bilingual(() => sessionTitle(s.kind), true), lang);

// The watch's built-in fonts have accented letters but not every typographic sign: curly quotes,
// long dashes and the ellipsis become their plain versions.
const plain = (s: string) => s.replace(/[\u2018\u2019\u02BC]/g, "'").replace(/[\u201C\u201D\u00AB\u00BB]/g, '"').replace(/[\u2013\u2014]/g, "-").replace(/\u2026/g, "...").replace(/[\u00A0\u202F]/g, " ");
const clip = (raw: string, n: number) => { const s = plain(raw); return s.length > n ? s.slice(0, n - 3).trimEnd() + "..." : s; };

function exerciseFor(e: Session["exercises"][number], lang: Lang): WatchExercise {
  const ex = getExercise(e.slug);
  const first = e.sets[0];
  const loads = e.sets.map((s) => s.loadKg).filter((l): l is number => typeof l === "number" && l > 0);
  return {
    name: clip(ex ? exName(ex, lang) : e.slug.replace(/-/g, " "), 32),
    sets: e.sets.length,
    reps: first?.reps ?? null,
    sec: first?.seconds ?? null,
    loadKg: loads.length ? Math.round(Math.max(...loads) * 10) / 10 : null,
  };
}

function sessionFor(s: Session | null, lang: Lang): WatchSession | null {
  if (!s || s.kind === "rest") return null;
  // The warm-up and cool-down are the first to go when the list is long: the watch shows the work.
  const work = s.exercises.filter((e) => e.block !== "prep" && e.block !== "cooldown");
  const list = (work.length ? work : s.exercises).slice(0, MAX_EXERCISES);
  return {
    title: plain(titleIn(s, lang)),
    minutes: s.minutes,
    done: s.status === "done",
    zone: s.cardio?.zone ?? null,
    exercises: list.map((e) => exerciseFor(e, lang)),
  };
}

function mealsFor(day: NutritionDay | null, lang: Lang, nameLen: number): WatchMeal[] {
  if (!day) return [];
  return [...day.meals].sort((a, b) => a.time.localeCompare(b.time)).map((m) => {
    const meal = getMeal(m.mealId);
    const [fr, en] = SLOT[m.slot] ?? [m.slot, m.slot];
    return {
      time: m.time,
      slot: lang === "fr" ? fr : en,
      name: clip(meal ? mealTitle(meal, lang)[0] : "-", nameLen),
      kcal: meal ? Math.round(meal.kcal * m.scale) : 0,
      protein: meal ? Math.round(meal.protein * m.scale) : 0,
      done: !!m.done,
    };
  });
}

/** Bytes of the feed once sent (UTF-8). */
export const feedBytes = (f: WatchFeed) => new TextEncoder().encode(JSON.stringify(f)).length;

/** Builds the feed from plain data (no database, no network): what the tests call. */
export function buildWatchFeed(input: WatchInput): WatchFeed {
  const { profile, stats, nutrition, lang } = input;
  const now = input.now ?? new Date();
  const lvl = levelFromXp(stats.xp);
  const eaten = nutrition ? eatenTotals(nutrition) : { kcal: 0, protein: 0 };
  const make = (nameLen: number, maxEx: number): WatchFeed => {
    const session = sessionFor(input.today, lang);
    if (session) session.exercises = session.exercises.slice(0, maxEx);
    return {
      v: 1,
      lang,
      updatedAt: now.toISOString(),
      ts: Math.floor(now.getTime() / 1000),
      date: todayISO(now),
      name: clip(profile?.name?.trim() || "FORGE", 20),
      units: profile?.units?.weight === "lb" ? "lb" : "kg",
      rank: plain(rankFor(lvl.level, lang)),
      level: lvl.level,
      xp: Math.round(lvl.into),
      xpNext: lvl.need,
      xpTotal: Math.round(stats.xp),
      gems: sparks(stats),
      streakWeeks: stats.streakWeeks ?? 0,
      today: {
        session,
        meals: mealsFor(nutrition, lang, nameLen),
        targets: { kcal: Math.round(nutrition?.targets.kcal ?? 0), protein: Math.round(nutrition?.targets.protein ?? 0) },
        eaten: { kcal: Math.round(eaten.kcal), protein: Math.round(eaten.protein) },
      },
      tomorrow: { session: input.tomorrow && input.tomorrow.kind !== "rest" ? plain(titleIn(input.tomorrow, lang)) : null },
    };
  };
  // Normally the first try fits by far (~2 KB). The later ones only guard against a very unusual day.
  for (const [nameLen, maxEx] of [[48, MAX_EXERCISES], [28, 6], [18, 4]] as const) {
    const feed = make(nameLen, maxEx);
    if (feedBytes(feed) <= WATCH_FEED_MAX_BYTES) return feed;
  }
  const feed = make(14, 3);
  feed.today.meals = feed.today.meals.slice(0, 6);
  return feed;
}

/** Reads today's data from this device and builds the feed, in the language the app shows. */
export async function collectWatchFeed(now = new Date()): Promise<WatchFeed> {
  const today = todayISO(now);
  const [profile, stats, todaySession, tomorrowSession, nutrition] = await Promise.all([
    getProfile(),
    getStats(),
    db.sessions.where("date").equals(today).first(),
    db.sessions.where("date").equals(addDays(today, 1)).first(),
    db.nutrition.get(today),
  ]);
  return buildWatchFeed({ profile, stats, today: todaySession ?? null, tomorrow: tomorrowSession ?? null, nutrition: nutrition ?? null, lang: getLang(), now });
}

/* ── Publishing ───────────────────────────────────────────── */

export type PublishResult =
  | { ok: true; at: string; bytes: number; skipped?: "unchanged" }
  | { ok: false; reason: "not_configured" | "signed_out" | "not_paired" | "throttled" | "error"; message?: string };

/** At most one upload every two minutes, unless forced (the "send now" button). */
export const WATCH_PUBLISH_GAP_MS = 2 * 60 * 1000;
/** An unchanged feed is still re-sent after this long, so the watch sees a fresh time. */
const RESEND_UNCHANGED_MS = 30 * 60 * 1000;

const K_AT = "forge.watch.publishedAt";
const K_SIG = "forge.watch.signature";
const K_PAIRED = "forge.watch.paired";
const EVENT = "forge:watch";

const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string | null) => {
  try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* status only */ }
};

let lastAttempt = 0;
let inflight: Promise<PublishResult> | null = null;

/** When the feed last reached Supabase from this device (ISO), or null. */
export function lastWatchPublish(): string | null {
  return read(K_AT);
}

/** Fires whenever the publish time or the pairing changes (for the settings panel). */
export function onWatchChange(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => { window.removeEventListener(EVENT, cb); window.removeEventListener("storage", cb); };
}
const changed = () => { try { window.dispatchEvent(new Event(EVENT)); } catch { /* not in a browser */ } };

/** Whether this device knows of a pairing code (so it is worth publishing). Asked once, then remembered. */
let unpairedChecked = false;
async function isPaired(userId: string): Promise<boolean> {
  if (read(K_PAIRED) === "1") return true;
  // "No code" is only trusted for this app run: a code made on another device is found next launch.
  if (unpairedChecked || !supabase) return false;
  unpairedChecked = true;
  const { data, error } = await supabase.from("watch_pairing").select("user_id").eq("user_id", userId).maybeSingle();
  if (error) return false;   // table not created yet: nothing to publish to
  write(K_PAIRED, data ? "1" : "0");
  return !!data;
}

/**
 * Sends the day's summary to Supabase for the watch. Safe to call often and from anywhere:
 * it does nothing when accounts are off, when signed out, when no watch is paired (unless forced),
 * or when the last upload was less than two minutes ago (unless forced).
 */
export function publishWatchFeed(opts: { force?: boolean } = {}): Promise<PublishResult> {
  if (inflight) return inflight;
  inflight = doPublish(!!opts.force).finally(() => { inflight = null; });
  return inflight;
}

async function doPublish(force: boolean): Promise<PublishResult> {
  if (!supabase) return { ok: false, reason: "not_configured" };
  if (!force && Date.now() - lastAttempt < WATCH_PUBLISH_GAP_MS) return { ok: false, reason: "throttled" };
  lastAttempt = Date.now();
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) return { ok: false, reason: "signed_out" };
    if (!force && !(await isPaired(user.id))) return { ok: false, reason: "not_paired" };

    const feed = await collectWatchFeed();
    const { updatedAt: _at, ts: _ts, ...rest } = feed;
    void _at; void _ts;
    const sig = `${user.id}:${JSON.stringify(rest)}`;
    const prevAt = read(K_AT);
    if (!force && read(K_SIG) === sig && prevAt && Date.now() - new Date(prevAt).getTime() < RESEND_UNCHANGED_MS) {
      return { ok: true, at: prevAt, bytes: feedBytes(feed), skipped: "unchanged" };
    }
    const { error } = await supabase.from("watch_feed").upsert({ user_id: user.id, data: feed, updated_at: feed.updatedAt }, { onConflict: "user_id" });
    if (error) return { ok: false, reason: "error", message: error.message };
    write(K_AT, feed.updatedAt);
    write(K_SIG, sig);
    changed();
    return { ok: true, at: feed.updatedAt, bytes: feedBytes(feed) };
  } catch (e) {
    return { ok: false, reason: "error", message: e instanceof Error ? e.message : String(e) };
  }
}

/* ── Pairing code (owner side) ────────────────────────────── */

export interface WatchPairing { code: string; createdAt: string; lastUsedAt: string | null }

const needSb = () => {
  if (!supabase) throw new Error("Supabase is not configured");
  return supabase;
};

/** "ABCD2345WXYZ" → "ABCD-2345-WXYZ", easier to read and to type. */
export const formatPairingCode = (code: string) => code.replace(/[^A-Z0-9]/gi, "").toUpperCase().replace(/(.{4})(?=.)/g, "$1-");

/** The signed-in user's current code, or null when there is none. */
export async function myPairing(): Promise<WatchPairing | null> {
  const sb = needSb();
  const { data: { session } } = await sb.auth.getSession();
  if (!session?.user) return null;
  const { data, error } = await sb.from("watch_pairing").select("code, created_at, last_used_at").eq("user_id", session.user.id).maybeSingle();
  if (error) throw new Error(error.message);
  write(K_PAIRED, data ? "1" : "0");
  changed();
  return data ? { code: data.code as string, createdAt: data.created_at as string, lastUsedAt: (data.last_used_at as string | null) ?? null } : null;
}

/** Makes a new code (the old one stops working at once) and publishes the feed so the watch has something to read. */
export async function rotatePairing(): Promise<WatchPairing> {
  const sb = needSb();
  const { data, error } = await sb.rpc("watch_pairing_rotate");
  if (error) throw new Error(error.message);
  write(K_PAIRED, "1");
  changed();
  await publishWatchFeed({ force: true });
  return { code: String(data), createdAt: new Date().toISOString(), lastUsedAt: null };
}

/** Deletes the code and the published feed: the watch then gets nothing. */
export async function revokePairing(): Promise<void> {
  const sb = needSb();
  const { error } = await sb.rpc("watch_pairing_revoke");
  if (error) throw new Error(error.message);
  write(K_PAIRED, "0");
  write(K_AT, null);
  write(K_SIG, null);
  changed();
}
