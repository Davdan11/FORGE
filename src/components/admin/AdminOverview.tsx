"use client";

import { useEffect, useMemo, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";
import { watchLobby, type LobbySnapshot } from "@/lib/indoor/lobby";
import { roomName } from "@/lib/indoor/live";
import type { DownloadStats } from "@/lib/admin/downloads";
import { Section, StatRow } from "@/components/ui";
import { tr, useT } from "@/lib/i18n";

/* ─────────────────────────────────────────────────────────────
   The owner's dashboard (/admin → "Tableau de bord"):
   · who is online now and where (lib/indoor/lobby: counts only);
   · a room opened as a spectator: the riders in it, live, without
     joining it (nothing is sent, nobody sees the owner there);
   · the accounts (supabase/admin-overview.sql, admins only);
   · the Windows game's downloads (api/admin/downloads, admins only).
   ───────────────────────────────────────────────────────────── */

interface Account { id: string; email: string | null; name: string | null; provider: string; created_at: string; last_sign_in_at: string | null }
interface Overview { total: number; new_7d: number; active_7d: number; active_1d: number; signups_by_day: { day: string; n: number }[]; users: Account[] }

const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("fr-CA", { month: "short", day: "numeric" }) + " " + new Date(iso).toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" }) : "—");

export function AdminOverview() {
  const t = useT();
  const [lobby, setLobby] = useState<LobbySnapshot | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [downloads, setDownloads] = useState<DownloadStats | null>(null);
  const [downloadsError, setDownloadsError] = useState<string | null>(null);
  const [room, setRoom] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  useEffect(() => watchLobby(setLobby), []);

  useEffect(() => {
    if (!supabase) return;
    const sb = supabase;
    let alive = true;
    (async () => {
      const { data, error } = await sb.rpc("admin_overview");
      if (!alive) return;
      if (error) setOverviewError(/admin_overview|function/i.test(error.message) && !/admins only/i.test(error.message)
        ? tr("Il manque la fonction SQL : lance supabase/admin-overview.sql dans Supabase → SQL Editor.", "The SQL function is missing: run supabase/admin-overview.sql in Supabase → SQL Editor.")
        : error.message);
      else setOverview(data as Overview);
      const token = (await sb.auth.getSession()).data.session?.access_token;
      try {
        const res = await fetch("/api/admin/downloads", { headers: { Authorization: `Bearer ${token ?? ""}` }, cache: "no-store" });
        if (!alive) return;
        if (res.ok) setDownloads(await res.json()); else setDownloadsError(res.status === 404 ? tr("Seulement sur le site web (app.forgeachieve.com).", "Only on the website (app.forgeachieve.com).") : `HTTP ${res.status}`);
      } catch { if (alive) setDownloadsError(tr("Serveur injoignable.", "Server unreachable.")); }
    })();
    return () => { alive = false; };
  }, []); // once: `t` is a new function every render, and depending on it asked the server in a loop

  const rooms = useMemo(() => [...(lobby?.rooms ?? new Map<string, number>()).entries()].sort((a, b) => b[1] - a[1]), [lobby]);
  const users = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return (overview?.users ?? []).filter((u) => !q || (u.email ?? "").toLowerCase().includes(q) || (u.name ?? "").toLowerCase().includes(q));
  }, [overview, filter]);
  const last7 = (downloads?.byDay ?? []).slice(-7);

  return (
    <div className="grid gap-6">
      <Section title={t("En ligne maintenant", "Online now")}>
        <StatRow items={[
          { label: t("En ligne", "Online"), value: String(lobby?.online ?? 0) },
          { label: t("Dans l’app", "In the app"), value: String(lobby?.byWhere.app ?? 0) },
          { label: t("Jeu web", "Web game"), value: String(lobby?.byWhere.web ?? 0) },
          { label: t("Jeu Windows", "Windows game"), value: String(lobby?.byWhere.pc ?? 0) },
        ]} />
        <p className="text-xs text-smoke mt-2">{t("Compte les onglets et les jeux connectés à un compte, en direct. Une personne avec deux onglets compte deux fois.", "Counts signed-in tabs and games, live. Someone with two tabs counts twice.")}</p>
      </Section>

      <Section title={t("Salles (routes et événements)", "Rooms (roads and events)")}>
        {rooms.length === 0 ? <p className="text-sm text-smoke">{t("Personne ne roule en ce moment.", "Nobody is riding right now.")}</p> : (
          <div className="grid gap-2">
            {rooms.map(([r, n]) => (
              <button key={r} type="button" className={`card p-3 flex items-center justify-between text-left ${room === r ? "ring-2 ring-volt" : ""}`} onClick={() => setRoom(room === r ? null : r)}>
                <span className="grid"><strong>{r.replace(/^unity:/, "").replace(/^unity-event:/, t("événement ", "event "))}</strong><span className="text-xs text-smoke">{t("Clique pour voir qui est où (invisible)", "Click to see who is where (invisible)")}</span></span>
                <span className="display text-2xl tnum">{n}</span>
              </button>
            ))}
          </div>
        )}
        {room && <RoomWatch room={room} />}
      </Section>

      <Section title={t("Comptes", "Accounts")}>
        {overviewError ? <p className="text-sm text-[#b42318]">{overviewError}</p> : !overview ? <p className="text-sm text-smoke">{t("Chargement…", "Loading…")}</p> : (
          <div className="grid gap-3">
            <StatRow items={[
              { label: t("Comptes", "Accounts"), value: String(overview.total) },
              { label: t("Nouveaux 7 j", "New 7 d"), value: String(overview.new_7d) },
              { label: t("Actifs 24 h", "Active 24 h"), value: String(overview.active_1d) },
              { label: t("Actifs 7 j", "Active 7 d"), value: String(overview.active_7d) },
            ]} />
            <input className="input" placeholder={t("Chercher un courriel ou un nom…", "Search an email or a name…")} value={filter} onChange={(e) => setFilter(e.target.value)} />
            <div className="card overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-smoke"><th className="p-2">{t("Compte", "Account")}</th><th className="p-2">{t("Méthode", "Method")}</th><th className="p-2">{t("Créé", "Created")}</th><th className="p-2">{t("Dernière connexion", "Last sign-in")}</th></tr></thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-t border-line">
                      <td className="p-2"><span className="grid"><strong>{u.name || "—"}</strong><span className="text-xs text-smoke">{u.email ?? "—"}</span></span></td>
                      <td className="p-2 capitalize">{u.provider}</td>
                      <td className="p-2 tnum whitespace-nowrap">{day(u.created_at)}</td>
                      <td className="p-2 tnum whitespace-nowrap">{day(u.last_sign_in_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Section>

      <Section title={t("Jeu Windows : téléchargements", "Windows game: downloads")}>
        {downloadsError ? <p className="text-sm text-[#b42318]">{downloadsError}</p> : !downloads ? <p className="text-sm text-smoke">{t("Chargement…", "Loading…")}</p> : (
          <div className="grid gap-3">
            <StatRow items={[
              { label: t("Complets", "Complete"), value: String(downloads.complete) },
              { label: t("Abandonnés", "Abandoned"), value: String(downloads.partial) },
              { label: t("Mises à jour", "Updates"), value: String(downloads.updates) },
            ]} />
            <div className="card overflow-x-auto">
              <table className="w-full text-sm tnum">
                <thead><tr className="text-left text-xs text-smoke"><th className="p-2">{t("Jour", "Day")}</th><th className="p-2">{t("Téléchargements", "Downloads")}</th><th className="p-2">{t("Mises à jour", "Updates")}</th><th className="p-2">{t("Jeux ouverts", "Games opened")}</th></tr></thead>
                <tbody>{last7.map((d) => <tr key={d.day} className="border-t border-line"><td className="p-2">{d.day}</td><td className="p-2">{d.downloads}</td><td className="p-2">{d.updates}</td><td className="p-2">{d.launches}</td></tr>)}</tbody>
              </table>
            </div>
            <p className="text-xs text-smoke">{t(`Selon les registres du serveur depuis le ${downloads.since ?? "—"} (ils gardent environ deux semaines). « Jeux ouverts » : ordinateurs différents qui ont lancé le jeu ce jour-là.`, `From the server's logs since ${downloads.since ?? "—"} (they keep about two weeks). "Games opened": different computers that started the game that day.`)}</p>
          </div>
        )}
      </Section>
    </div>
  );
}

/** A room seen from outside: its riders' positions as they broadcast them, without joining it as a rider. */
function RoomWatch({ room }: { room: string }) {
  const t = useT();
  const [riders, setRiders] = useState<{ id: string; name: string; d: number; v: number; q?: string; at: number }[]>([]);
  useEffect(() => {
    if (!supabase) return;
    const sb = supabase;
    const seen = new Map<string, { id: string; name: string; d: number; v: number; q?: string; at: number }>();
    // Subscribed only: no presence tracked, nothing broadcast, so the riders don't see a spectator.
    const ch: RealtimeChannel = sb.channel(roomName(room, "ride"), { config: { broadcast: { self: false, ack: false } } });
    ch.on("broadcast", { event: "pos" }, ({ payload }) => {
      const p = payload as { id?: string; n?: string; d?: number; v?: number; q?: string };
      if (!p?.id || typeof p.d !== "number" || typeof p.v !== "number") return;
      seen.set(p.id, { id: p.id, name: (p.n ?? "?").slice(0, 24), d: p.d, v: p.v, q: p.q, at: Date.now() });
    }).subscribe();
    const timer = setInterval(() => {
      const now = Date.now();
      for (const [id, r] of seen) if (now - r.at > 8000) seen.delete(id);
      setRiders([...seen.values()].sort((a, b) => b.d - a.d));
    }, 1000);
    return () => { clearInterval(timer); sb.removeChannel(ch); };
  }, [room]);
  return (
    <div className="card p-3 mt-3 grid gap-2">
      <p className="meta">{t("Dans la salle", "In the room")} {room.replace(/^unity:/, "")}</p>
      {riders.length === 0 ? <p className="text-sm text-smoke">{t("En attente des positions (une par seconde)…", "Waiting for positions (one a second)…")}</p> : (
        <table className="w-full text-sm tnum">
          <thead><tr className="text-left text-xs text-smoke"><th className="p-1">{t("Cycliste", "Rider")}</th><th className="p-1">km</th><th className="p-1">km/h</th><th className="p-1">{t("Mesure", "Data")}</th></tr></thead>
          <tbody>{riders.map((r) => <tr key={r.id} className="border-t border-line"><td className="p-1">{r.name}</td><td className="p-1">{(r.d / 1000).toFixed(2)}</td><td className="p-1">{(r.v * 3.6).toFixed(1)}</td><td className="p-1">{r.q === "m" ? t("capteur", "sensor") : r.q === "e" ? t("estimée", "estimated") : t("déclarée", "declared")}</td></tr>)}</tbody>
        </table>
      )}
    </div>
  );
}
