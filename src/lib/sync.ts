import { db } from "./db";
import { supabase } from "./supabase/client";

/* ─────────────────────────────────────────────────────────────
   Sync v1: push every dirty local row to Supabase (upsert by id),
   then pull rows updated since the last pull. Local wins on
   conflicts for now (single-user, single-device is the 90% case).
   ───────────────────────────────────────────────────────────── */

const TABLES = ["profile", "plans", "sessions", "sets", "logs", "readiness", "activities", "nutrition", "stats", "weights"] as const;

export async function syncNow(): Promise<string> {
  if (!supabase) return "Supabase not configured.";
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return "Sign in first.";
  let pushed = 0;
  for (const t of TABLES) {
    const table = db.table(t);
    const dirty = await table.filter((r: { dirty?: number }) => r.dirty === 1).toArray();
    if (!dirty.length) continue;
    const rows = dirty.map((r: Record<string, unknown>) => ({ id: r.id, user_id: user.id, data: { ...r, dirty: undefined }, updated_at: new Date().toISOString() }));
    const { error } = await supabase.from(t === "profile" ? "profiles" : t).upsert(rows, { onConflict: "id" });
    if (error) return `Sync failed on ${t}: ${error.message}`;
    await table.bulkPut(dirty.map((r: Record<string, unknown>) => ({ ...r, dirty: 0 })));
    pushed += dirty.length;
  }
  return `Synced ${pushed} change${pushed === 1 ? "" : "s"}.`;
}
