/* The owner's panel: Windows game downloads (lib/admin/downloads), from the
   web server's own logs. Admins only: the caller's session is checked with
   Supabase (is_admin, supabase/rewards.sql) before any log is read; only
   counts are returned. Web build only (a `.web.ts` route, see next.config.ts). */

import { readdir, readFile, stat } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { downloadStats } from "@/lib/admin/downloads";

const LOGS = process.env.FORGE_ACCESS_LOGS ?? "/var/log/nginx";
const DOWNLOADS = process.env.FORGE_DOWNLOADS_DIR ?? "/var/www/forgeachieve.com/downloads";
const SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function isAdmin(token: string): Promise<boolean> {
  if (!SUPABASE || !KEY || !token) return false;
  try {
    const res = await fetch(`${SUPABASE}/rest/v1/rpc/is_admin`, {
      method: "POST",
      headers: { apikey: KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: "{}",
      signal: AbortSignal.timeout(8000),
    });
    return res.ok && (await res.json()) === true;
  } catch { return false; }
}

export async function GET(request: Request) {
  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!(await isAdmin(token))) return Response.json({ error: "admins only" }, { status: 403 });

  const lines: string[] = [];
  try {
    for (const name of await readdir(/* turbopackIgnore: true */ LOGS)) {
      if (!name.startsWith("access.log")) continue;
      const raw = await readFile(`${LOGS}/${name}`);
      const text = name.endsWith(".gz") ? gunzipSync(raw).toString("utf8") : raw.toString("utf8");
      for (const l of text.split("\n")) if (l.includes("/downloads/")) lines.push(l);
    }
  } catch { return Response.json({ error: "logs unreadable" }, { status: 500 }); }

  const sizes: Record<string, number> = {};
  try {
    for (const name of await readdir(/* turbopackIgnore: true */ DOWNLOADS)) if (name.endsWith(".exe")) sizes[name] = (await stat(`${DOWNLOADS}/${name}`)).size;
  } catch { /* the default size then */ }

  // Addresses to leave out (the owner's own tests), comma-separated, in the server's environment.
  const exclude = (process.env.FORGE_ADMIN_EXCLUDE_IPS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return Response.json(downloadStats(lines, sizes, exclude), { headers: { "Cache-Control": "no-store" } });
}
