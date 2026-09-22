import { db } from "./db";
import { supabase } from "./supabase/client";
import { SYNCED_TABLES, syncNow } from "./sync";
import { isNativeShell } from "./native";

/* ─────────────────────────────────────────────────────────────
   Saving to the account without anyone pressing a button.

   Every write the app makes is marked dirty; a few seconds after
   the last one, the dirty rows go up and anything newer comes down.
   It also runs when the app opens, comes back to the foreground,
   regains a connection, and every few minutes while open. Offline,
   nothing is lost: rows stay dirty until the next chance.

   Deletions travel too. The engine deletes planned sessions when it
   rewrites a plan; without telling the server, a second phone would
   pull them back and show every session twice. Each deleted id is
   queued here and removed on the server before the next push.
   ───────────────────────────────────────────────────────────── */

const QUIET_MS = 4000;
const EVERY_MS = 5 * 60 * 1000;
const DELETES = "forge.pendingDeletes";
const STATUS = "forge.syncStatus";

export interface SyncStatus { at: string; ok: boolean; message: string }

export function readSyncStatus(): SyncStatus | null {
  try { return JSON.parse(localStorage.getItem(STATUS) ?? "null"); } catch { return null; }
}

/* ── deletions ─────────────────────────────────────────────── */

type Pending = Record<string, string[]>;
export function pendingDeletes(): Pending {
  try { return JSON.parse(localStorage.getItem(DELETES) ?? "{}"); } catch { return {}; }
}
function queueDelete(table: string, id: string) {
  const p = pendingDeletes();
  const list = (p[table] ??= []);
  if (!list.includes(id)) list.push(id);
  // Before an account exists nothing is sent; don't let the list grow forever.
  if (p[table].length > 2000) p[table] = p[table].slice(-2000);
  try { localStorage.setItem(DELETES, JSON.stringify(p)); } catch { /* storage full: the row stays on the server */ }
}
/** Drop ids the server has confirmed deleted. */
export function clearDeletes(table: string, ids: string[]) {
  const p = pendingDeletes();
  p[table] = (p[table] ?? []).filter((x) => !ids.includes(x));
  if (!p[table].length) delete p[table];
  try { localStorage.setItem(DELETES, JSON.stringify(p)); } catch { /* retried next sync */ }
}

/* ── scheduling ────────────────────────────────────────────── */

let timer: ReturnType<typeof setTimeout> | null = null;
let running = false;
let again = false;

/** Sync soon. Many calls in a burst become one sync. */
export function scheduleSync(delay = QUIET_MS) {
  if (!supabase || typeof window === "undefined") return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(run, delay);
}

async function run() {
  timer = null;
  if (running) { again = true; return; }
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;
  running = true;
  try {
    const message = await syncNow();
    // "Sign in first" is not a failure: there is simply no account yet.
    if (message !== "Sign in first." && message !== "Supabase not configured.") {
      const ok = !message.startsWith("Sync failed");
      try { localStorage.setItem(STATUS, JSON.stringify({ at: new Date().toISOString(), ok, message } satisfies SyncStatus)); } catch { /* status only */ }
    }
  } catch (e) {
    try { localStorage.setItem(STATUS, JSON.stringify({ at: new Date().toISOString(), ok: false, message: e instanceof Error ? e.message : "Sync failed." })); } catch { /* status only */ }
  } finally {
    running = false;
    if (again) { again = false; scheduleSync(1000); }
  }
}

let started = false;
/** Watch every synced table and the app's lifecycle. Call once. */
export function startAutoSync() {
  if (started || !supabase || typeof window === "undefined") return;
  started = true;
  for (const name of SYNCED_TABLES) {
    const table = db.table(name);
    // Only the app's own edits (dirty) start a sync: rows written by a pull
    // are clean, so a sync never triggers another one.
    table.hook("creating", (_pk, obj: { dirty?: number }) => { if (obj.dirty === 1) scheduleSync(); });
    table.hook("updating", (mods: { dirty?: number }) => { if (mods.dirty === 1) scheduleSync(); });
    table.hook("deleting", (pk) => { queueDelete(name, String(pk)); scheduleSync(); });
  }
  window.addEventListener("online", () => scheduleSync(500));
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") scheduleSync(500); });
  setInterval(() => scheduleSync(0), EVERY_MS);
  if (isNativeShell()) {
    import("@capacitor/app").then(({ App }) => App.addListener("resume", () => scheduleSync(500))).catch(() => {});
  }
  scheduleSync(500);
}
