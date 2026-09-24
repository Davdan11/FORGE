import { db } from "./db";
import { locale, tr } from "./i18n";

/* ─────────────────────────────────────────────────────────────
   Local backup: one JSON file holding every table.

   This is the floor under the whole local-first promise. Sync
   needs an account and a network; this needs neither, and it is
   the only route that works when someone simply wants their data
   out of the app.
   ───────────────────────────────────────────────────────────── */

const TABLES = ["profile", "plans", "sessions", "sets", "logs", "readiness", "activities", "nutrition", "stats", "weights", "injuries"] as const;

export const BACKUP_VERSION = 1;

export type Backup = {
  app: "forge";
  version: number;
  exportedAt: string;
  tables: Record<string, unknown[]>;
};

export async function buildBackup(): Promise<Backup> {
  const tables: Record<string, unknown[]> = {};
  for (const t of TABLES) tables[t] = await db.table(t).toArray();
  return { app: "forge", version: BACKUP_VERSION, exportedAt: new Date().toISOString(), tables };
}

/** Serialise every table and hand the browser a dated .json file. */
export async function downloadBackup(): Promise<string> {
  const backup = await buildBackup();
  const count = Object.values(backup.tables).reduce((a, rows) => a + rows.length, 0);
  const blob = new Blob([JSON.stringify(backup)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `forge-backup-${backup.exportedAt.slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke on the next tick: Safari needs the URL alive through the click.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  const n = count.toLocaleString(locale());
  return tr(`${n} enregistrement${count > 1 ? "s" : ""} exporté${count > 1 ? "s" : ""}.`, `Exported ${n} record${count === 1 ? "" : "s"}.`);
}

export function parseBackup(text: string): Backup {
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { throw new Error(tr("Ce fichier n’est pas un JSON valide.", "That file isn’t valid JSON.")); }
  const b = parsed as Partial<Backup>;
  if (!b || b.app !== "forge" || !b.tables) throw new Error(tr("Ce n’est pas une sauvegarde FORGE.", "That isn’t a FORGE backup."));
  if (typeof b.version !== "number" || b.version > BACKUP_VERSION) throw new Error(tr("Cette sauvegarde vient d’une version plus récente de FORGE.", "That backup comes from a newer version of FORGE."));
  return b as Backup;
}

/** Replace local data with a backup. Rows come back dirty so the next sync
 *  pushes them to the account too. */
export async function restoreBackup(text: string): Promise<string> {
  const backup = parseBackup(text);
  let restored = 0;
  for (const t of TABLES) {
    const rows = backup.tables[t];
    if (!Array.isArray(rows)) continue;
    const table = db.table(t);
    await table.clear();
    if (rows.length) {
      await table.bulkPut(rows.map((r) => ({ ...(r as Record<string, unknown>), dirty: 1 })));
      restored += rows.length;
    }
  }
  const n = restored.toLocaleString(locale());
  return tr(`${n} enregistrement${restored > 1 ? "s" : ""} restauré${restored > 1 ? "s" : ""}.`, `Restored ${n} record${restored === 1 ? "" : "s"}.`);
}
