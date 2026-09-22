import { db } from "./db";
import { supabase } from "./supabase/client";

/* ─────────────────────────────────────────────────────────────
   Sync v2: push every dirty local row, then pull everything the
   server has seen since our last pull.

   Conflict rule is last-write-wins on `updatedAt`, with one
   exception: a local row still marked dirty is never overwritten,
   because it holds an edit the server has not been told about yet.
   It goes up on the next push instead.

   The pull is what makes an account worth having — without it a
   new device, cleared site data or an evicted store means the
   block is gone even though every row is sitting in Postgres.
   ───────────────────────────────────────────────────────────── */

const TABLES = ["profile", "plans", "sessions", "sets", "logs", "readiness", "activities", "nutrition", "stats", "weights", "injuries"] as const;
type Table = (typeof TABLES)[number];

/** Local store names and Postgres table names differ for one table only. */
const remoteName = (t: Table) => (t === "profile" ? "profiles" : t);

const CURSOR = "forge.lastPulledAt";
const readCursor = () => { try { return localStorage.getItem(CURSOR) ?? "1970-01-01T00:00:00.000Z"; } catch { return "1970-01-01T00:00:00.000Z"; } };
const writeCursor = (v: string) => { try { localStorage.setItem(CURSOR, v); } catch { /* private mode: we just re-pull next time */ } };

type RemoteRow = { id: string; data: Record<string, unknown>; updated_at: string };

export async function syncNow(): Promise<string> {
  if (!supabase) return "Supabase not configured.";
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return "Sign in first.";

  let pushed = 0;
  let pulled = 0;
  const since = readCursor();
  // Advance the cursor from the newest row the server actually hands us, not
  // from this device's clock — the two can disagree by minutes.
  let newest = since;

  for (const t of TABLES) {
    const table = db.table(t);

    // ── push ──────────────────────────────────────────────────
    const dirty = await table.filter((r: { dirty?: number }) => r.dirty === 1).toArray();
    if (dirty.length) {
      const stamped = dirty.map((r: Record<string, unknown>) => ({ ...r, updatedAt: (r.updatedAt as string) ?? new Date().toISOString() }));
      const rows = stamped.map((r: Record<string, unknown>) => ({ id: r.id, user_id: user.id, data: { ...r, dirty: undefined }, updated_at: r.updatedAt as string }));
      // The key is (user_id, id): see supabase/schema.sql.
      const { error } = await supabase.from(remoteName(t)).upsert(rows, { onConflict: "user_id,id" });
      if (error) return `Sync failed pushing ${t}: ${error.message}`;
      await table.bulkPut(stamped.map((r: Record<string, unknown>) => ({ ...r, dirty: 0 })));
      pushed += dirty.length;
    }

    // ── pull ──────────────────────────────────────────────────
    const { data, error } = await supabase
      .from(remoteName(t))
      .select("id, data, updated_at")
      .gt("updated_at", since)
      .order("updated_at", { ascending: true });
    if (error) return `Sync failed pulling ${t}: ${error.message}`;

    for (const row of (data ?? []) as RemoteRow[]) {
      if (row.updated_at > newest) newest = row.updated_at;
      const local = await table.get(row.id) as { dirty?: number; updatedAt?: string } | undefined;
      // A pending local edit wins; it has not been pushed yet.
      if (local?.dirty === 1) continue;
      if (local?.updatedAt && local.updatedAt >= row.updated_at) continue;
      await table.put({ ...row.data, id: row.id, dirty: 0, updatedAt: row.updated_at });
      pulled += 1;
    }
  }

  writeCursor(newest);
  if (!pushed && !pulled) return "Everything is already up to date.";
  const up = pushed ? `${pushed} change${pushed === 1 ? "" : "s"} up` : "";
  const down = pulled ? `${pulled} record${pulled === 1 ? "" : "s"} down` : "";
  return `Synced — ${[up, down].filter(Boolean).join(", ")}.`;
}

/** Forget the pull cursor so the next sync restores the whole account. */
export function forgetSyncCursor() {
  try { localStorage.removeItem(CURSOR); } catch { /* nothing to forget */ }
}
