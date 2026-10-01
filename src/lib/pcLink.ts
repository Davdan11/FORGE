import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";

/* ─────────────────────────────────────────────────────────────
   Signing in the Windows game (FORGE Ride on a computer).

   The game cannot show Google's button or receive an email link,
   so it opens /pc-login/ in the browser with a port on this
   computer and a one-time state. The sign-in made there is its
   OWN session, through a separate client and storage key: never
   the web app's session, whose refresh token would then be used
   from two places and revoked by Supabase's reuse detection.

   Once signed in, the page posts that session's refresh token to
   http://127.0.0.1:<port>/callback (a form POST, so the token is
   never in a URL or the browser's history) and forgets it.
   ───────────────────────────────────────────────────────────── */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const STORAGE_KEY = "forge-pc-link";
const PENDING_KEY = "forge.pclink";
/** An email link followed more than this long after the request is not the game's any more. */
const PENDING_MS = 60 * 60_000;

export interface PcPending { port: number; state: string; at: number }

let client: SupabaseClient | null = null;
/** The game's own Supabase client (its session is never the web app's). */
export function pcClient(): SupabaseClient | null {
  if (!url || !key || typeof window === "undefined") return null;
  client ??= createClient(url, key, {
    auth: { storageKey: STORAGE_KEY, flowType: "pkce", persistSession: true, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return client;
}

/** The port and state from /pc-login/?port=…&state=…, when they look like the game's. */
export function parsePending(search: string): PcPending | null {
  const q = new URLSearchParams(search);
  const port = Number(q.get("port")), state = q.get("state") ?? "";
  if (!Number.isInteger(port) || port < 1024 || port > 65535 || !/^[A-Za-z0-9_-]{16,64}$/.test(state)) return null;
  return { port, state, at: Date.now() };
}

export function savePending(p: PcPending) {
  try { localStorage.setItem(PENDING_KEY, JSON.stringify(p)); } catch { /* private window: the code typed in still works */ }
}

/** The game's sign-in waiting in this browser, if recent. */
export function readPending(): PcPending | null {
  try {
    const p = JSON.parse(localStorage.getItem(PENDING_KEY) ?? "null") as PcPending | null;
    return p && typeof p.port === "number" && typeof p.state === "string" && Date.now() - p.at < PENDING_MS ? p : null;
  } catch { return null; }
}

/** True when an email link coming back belongs to the game's sign-in (its PKCE verifier is in this browser). */
export function isPcLinkReturn(): boolean {
  try { return !!readPending() && localStorage.getItem(`${STORAGE_KEY}-code-verifier`) != null; } catch { return false; }
}

/** Hand the session to the game on this computer, then forget it here. */
export function handOver(session: Session, p: PcPending) {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = `http://127.0.0.1:${p.port}/callback`;
  for (const [name, value] of [["state", p.state], ["refresh_token", session.refresh_token]]) {
    const input = document.createElement("input");
    input.type = "hidden"; input.name = name; input.value = value;
    form.appendChild(input);
  }
  document.body.appendChild(form);
  try {
    for (const k of Object.keys(localStorage)) if (k === PENDING_KEY || k.startsWith(STORAGE_KEY)) localStorage.removeItem(k);
  } catch { /* nothing kept */ }
  form.submit();
}
