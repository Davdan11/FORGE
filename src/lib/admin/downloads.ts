/* ─────────────────────────────────────────────────────────────
   The Windows game's downloads, read from the web server's logs
   (nginx "combined" lines) for the owner's panel. Counts only:
   no address ever leaves the server.

   A download is complete when one address received at least 90 %
   of the installer that day (browsers and download managers often
   fetch it in several pieces). The game's own updater asks with a
   "UnityPlayer" user agent: those are updates, not new players,
   and its look at version.json at each start says how many
   installed games were opened that day.
   ───────────────────────────────────────────────────────────── */

export interface DownloadStats {
  /** Complete installer downloads by people (not the updater). */
  complete: number;
  /** Started and abandoned. */
  partial: number;
  /** Installers fetched by the game's updater. */
  updates: number;
  /** Per day: downloads, updates, and Windows games opened (distinct addresses asking version.json). */
  byDay: { day: string; downloads: number; updates: number; launches: number }[];
  byFile: Record<string, number>;
  /** The oldest day the logs still hold (they rotate after about two weeks). */
  since: string | null;
}

const LINE = /^(\S+) \S+ \S+ \[(\d{2})\/(\w{3})\/(\d{4}):[^\]]*\] "(?:GET|HEAD) (\S+) [^"]*" (\d{3}) (\d+|-) "[^"]*" "([^"]*)"/;
const MONTHS: Record<string, string> = { Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06", Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12" };
const DEFAULT_SIZE = 500_000_000;

export function downloadStats(lines: Iterable<string>, sizes: Record<string, number>, exclude: string[] = []): DownloadStats {
  const fetched = new Map<string, { bytes: number; file: string; day: string; updater: boolean }>();
  const launches = new Map<string, Set<string>>();
  let since: string | null = null;
  for (const line of lines) {
    const m = LINE.exec(line);
    if (!m) continue;
    const [, ip, dd, mon, yyyy, rawPath, status, bytes, agent] = m;
    if (exclude.includes(ip)) continue;
    const path = rawPath.split("?")[0];
    if (!path.startsWith("/downloads/")) continue;
    const day = `${yyyy}-${MONTHS[mon] ?? "01"}-${dd}`;
    if (!since || day < since) since = day;
    const updater = /UnityPlayer/i.test(agent);
    if (path === "/downloads/version.json") {
      if (updater && status === "200") { if (!launches.has(day)) launches.set(day, new Set()); launches.get(day)!.add(ip); }
      continue;
    }
    if (!/^\/downloads\/FORGE-Ride-Setup[\w.-]*\.exe$/.test(path) || (status !== "200" && status !== "206")) continue;
    const file = path.slice("/downloads/".length);
    const key = `${ip} ${file} ${day}`;
    const f = fetched.get(key) ?? { bytes: 0, file, day, updater };
    f.bytes += bytes === "-" ? 0 : Number(bytes);
    f.updater ||= updater;
    fetched.set(key, f);
  }

  const days = new Map<string, { downloads: number; updates: number; launches: number }>();
  const dayOf = (d: string) => { if (!days.has(d)) days.set(d, { downloads: 0, updates: 0, launches: 0 }); return days.get(d)!; };
  const stats: DownloadStats = { complete: 0, partial: 0, updates: 0, byDay: [], byFile: {}, since };
  for (const f of fetched.values()) {
    const done = f.bytes >= 0.9 * (sizes[f.file] ?? DEFAULT_SIZE);
    if (!done) { if (!f.updater) stats.partial++; continue; }
    if (f.updater) { stats.updates++; dayOf(f.day).updates++; continue; }
    stats.complete++; dayOf(f.day).downloads++;
    stats.byFile[f.file] = (stats.byFile[f.file] ?? 0) + 1;
  }
  for (const [d, ips] of launches) dayOf(d).launches = ips.size;
  stats.byDay = [...days.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, v]) => ({ day, ...v }));
  return stats;
}
