"use client";

import { useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Check, FileUp, Loader2, Mountain, Timer, X, Zap } from "lucide-react";
import { db, uid } from "@/lib/db";
import { parseFit, type FitRide } from "@/lib/import/fit";
import { PLATFORMS, detectPlatform, importedActivity, isDuplicate, platform, platformTotals, type PlatformId } from "@/lib/import/platforms";
import { useLang, useT } from "@/lib/i18n";
import type { Activity } from "@/lib/types";

/* Your other platforms, next to FORGE Ride: import the .fit files
   Zwift, MyWhoosh, Rouvy and the others let you download, and each
   platform gets its own card (never one big total). The import shows
   what was found in each file, and which platform wrote it, before
   anything is saved; the rider can correct the platform. Imported
   rides give no XP: they were ridden and rewarded elsewhere. */

const PINK = "#FF2E78", ORANGE = "#FF5A3D";

type Pending = { file: string; ride?: FitRide; platform: PlatformId | null; error?: string; duplicate?: boolean };

export function Platforms({ forge, say }: { forge: { rides: number; km: number; hours: number; climbM: number }; say: (m: string) => void }) {
  const t = useT(), lang = useLang(), locale = lang === "fr" ? "fr-CA" : "en-US";
  const imported = useLiveQuery(() => db.activities.filter((a) => !!a.meta?.imported).toArray(), []);
  const totals = platformTotals(imported ?? []);
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Pending[] | null>(null);
  const [reading, setReading] = useState(false);
  const n = (x: number, d = 0) => x.toLocaleString(locale, { maximumFractionDigits: d });

  async function pick(files: FileList | null) {
    if (!files?.length) return;
    setReading(true);
    const existing = imported ?? [];
    const list: Pending[] = [];
    for (const f of Array.from(files).slice(0, 50)) {
      try {
        if (f.size > 30 * 1024 * 1024) throw new Error("big");
        const ride = parseFit(await f.arrayBuffer());
        const id = detectPlatform(ride, f.name);
        const probe = { startedAt: ride.start.toISOString(), meta: { imported: { platform: id ?? "other", file: f.name } } };
        list.push({ file: f.name, ride, platform: id, duplicate: isDuplicate(probe, existing) });
      } catch {
        list.push({ file: f.name, platform: null, error: t("Ce n'est pas un fichier .fit lisible.", "Not a readable .fit file.") });
      }
    }
    setReading(false);
    setPending(list);
    if (input.current) input.current.value = "";
  }

  async function save() {
    if (!pending) return;
    const now = new Date().toISOString();
    const rows: Activity[] = [];
    const saved = [...(imported ?? [])];
    for (const p of pending) {
      if (!p.ride || p.duplicate) continue;
      const a = importedActivity(p.ride, p.platform ?? "other", p.file, uid());
      if (isDuplicate(a, saved)) continue;
      rows.push({ ...a, dirty: 1, updatedAt: now } as Activity);
      saved.push(a);
    }
    if (rows.length) await db.activities.bulkPut(rows);
    const byPlatform = new Map<string, number>();
    for (const r of rows) { const name = platform(r.meta?.imported?.platform).name; byPlatform.set(name, (byPlatform.get(name) ?? 0) + 1); }
    say(rows.length
      ? t(`${rows.length} sortie${rows.length > 1 ? "s" : ""} importée${rows.length > 1 ? "s" : ""} · `, `${rows.length} ride${rows.length > 1 ? "s" : ""} imported · `) + [...byPlatform].map(([k, v]) => `${v} ${k}`).join(", ")
      : t("Rien de nouveau à importer.", "Nothing new to import."));
    setPending(null);
  }

  const ready = pending?.filter((p) => p.ride && !p.duplicate).length ?? 0;

  return (
    <section className="mb-16">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
        <div>
          <p className="text-[11px] tracking-[.24em] uppercase font-semibold" style={{ color: PINK }}>{t("Zwift, MyWhoosh, Rouvy…", "Zwift, MyWhoosh, Rouvy…")}</p>
          <h2 className="mt-1 text-3xl md:text-5xl font-black italic uppercase tracking-tight leading-none">{t("Tes autres plateformes", "Your other platforms")}</h2>
        </div>
        <input ref={input} type="file" accept=".fit,application/octet-stream" multiple className="hidden" onChange={(e) => pick(e.target.files)} />
        <button type="button" onClick={() => input.current?.click()} disabled={reading}
          className="fr-skew h-12 px-6 text-white font-black italic uppercase tracking-tight shadow-[0_12px_40px_rgba(255,46,120,.35)] hover:brightness-110 transition disabled:opacity-60"
          style={{ background: `linear-gradient(90deg, ${PINK}, ${ORANGE})` }}>
          <span className="inline-flex items-center gap-2">{reading ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileUp className="w-5 h-5" />}{t("Importer des sorties (.fit)", "Import rides (.fit)")}</span>
        </button>
      </div>

      {/* Review: what each file holds, and which platform wrote it (the rider can correct it). */}
      {pending && (
        <div className="rounded-2xl bg-white/[.05] border border-white/15 p-4 md:p-5 mb-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <p className="font-black italic uppercase tracking-tight text-lg">{t(`${pending.length} fichier${pending.length > 1 ? "s" : ""} lu${pending.length > 1 ? "s" : ""}`, `${pending.length} file${pending.length > 1 ? "s" : ""} read`)}</p>
            <button type="button" aria-label={t("Annuler", "Cancel")} onClick={() => setPending(null)} className="w-9 h-9 grid place-items-center rounded-lg bg-white/10 hover:bg-white/20"><X className="w-4 h-4" /></button>
          </div>
          <ul className="space-y-2">
            {pending.map((p, i) => (
              <li key={i} className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl bg-black/25 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate">{p.file}</p>
                  <p className="text-xs text-bone/60">
                    {p.error ?? (p.ride ? `${p.ride.start.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" })} · ${n(p.ride.distanceM / 1000, 1)} km · ${Math.round(p.ride.movingSec / 60)} min${p.ride.avgW ? ` · ${p.ride.avgW} W` : ""}` : "")}
                    {p.duplicate && <span className="ml-2 text-[#FFD23F]">{t("déjà importée", "already imported")}</span>}
                  </p>
                </div>
                {p.ride && !p.duplicate && (
                  <select value={p.platform ?? ""} onChange={(e) => setPending(pending.map((q, j) => (j === i ? { ...q, platform: (e.target.value || null) as PlatformId | null } : q)))}
                    className="h-9 rounded-lg bg-white/10 border border-white/20 px-2 text-sm font-semibold">
                    {!p.platform && <option value="">{t("Quelle plateforme ?", "Which platform?")}</option>}
                    {PLATFORMS.map((x) => <option key={x.id} value={x.id} className="text-ink">{x.id === "other" ? t("Autre", "Other") : x.name}</option>)}
                  </select>
                )}
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-bone/55">{t("Les sorties importées ne donnent pas d'XP : elles ont déjà été roulées ailleurs.", "Imported rides earn no XP: they were ridden elsewhere.")}</p>
            <button type="button" onClick={save} disabled={!ready || pending.some((p) => p.ride && !p.duplicate && !p.platform)}
              className="pill pill--volt disabled:opacity-50">
              <Check className="w-4 h-4" />{t(`Importer ${ready} sortie${ready > 1 ? "s" : ""}`, `Import ${ready} ride${ready > 1 ? "s" : ""}`)}
            </button>
          </div>
        </div>
      )}

      {/* One card per platform, FORGE Ride first. */}
      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
        <Card name="FORGE Ride" color={PINK} ink="#fff" gradient rides={forge.rides} km={forge.km} hours={forge.hours} climbM={forge.climbM} t={t} n={n} />
        {totals.map((p) => (
          <Card key={p.platform.id} name={p.platform.id === "other" ? t("Autre", "Other") : p.platform.name} color={p.platform.color} ink={p.platform.ink}
            rides={p.rides} km={p.km} hours={p.hours} climbM={p.climbM} avgW={p.avgW} best20={p.best20min}
            last={p.last ? new Date(p.last).toLocaleDateString(locale, { day: "numeric", month: "short" }) : undefined} t={t} n={n} />
        ))}
        {totals.length === 0 && (
          <div className="rounded-2xl border border-dashed border-white/20 p-5 flex flex-col justify-center">
            <p className="font-black italic uppercase tracking-tight text-lg">{t("Tu roules aussi ailleurs ?", "Ride somewhere else too?")}</p>
            <p className="mt-1.5 text-sm text-bone/70 leading-snug">
              {t("Dans Zwift, MyWhoosh, Rouvy ou Wahoo, ouvre une sortie et choisis « Exporter » ou « Télécharger le fichier .fit ». Importe-le ici : chaque plateforme a sa propre carte.",
                "In Zwift, MyWhoosh, Rouvy or Wahoo, open a ride and pick \"Export\" or \"Download .fit file\". Import it here: each platform gets its own card.")}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

function Card({ name, color, ink, gradient, rides, km, hours, climbM, avgW, best20, last, t, n }: {
  name: string; color: string; ink: string; gradient?: boolean; rides: number; km: number; hours: number; climbM: number;
  avgW?: number; best20?: number; last?: string; t: (fr: string, en: string) => string; n: (x: number, d?: number) => string;
}) {
  return (
    <div className="rounded-2xl overflow-hidden bg-white/[.04] border border-white/10">
      <div className="h-[3px]" style={{ background: gradient ? `linear-gradient(90deg, ${PINK}, ${ORANGE})` : color }} />
      <div className="p-5">
        <div className="flex items-center justify-between gap-3">
          <span className="fr-skew px-3 py-1 text-[12px] font-black italic uppercase whitespace-nowrap" style={{ background: gradient ? `linear-gradient(90deg, ${PINK}, ${ORANGE})` : color, color: ink }}><span>{name}</span></span>
          {last && <span className="text-[11px] text-bone/55">{t("dernière", "last")} · {last}</span>}
        </div>
        <div className="mt-4 flex items-end gap-5">
          <p><span className="block text-4xl font-black italic tabular-nums leading-none">{n(rides)}</span><span className="text-[11px] tracking-[.14em] uppercase text-bone/55">{t("sorties", "rides")}</span></p>
          <p><span className="block text-4xl font-black italic tabular-nums leading-none">{n(km)}</span><span className="text-[11px] tracking-[.14em] uppercase text-bone/55">km</span></p>
          <p><span className="block text-4xl font-black italic tabular-nums leading-none">{n(hours, 1)}</span><span className="text-[11px] tracking-[.14em] uppercase text-bone/55">{t("heures", "hours")}</span></p>
        </div>
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm text-bone/80">
          <span className="inline-flex items-center gap-1.5"><Mountain className="w-4 h-4 text-bone/50" />{n(climbM)} m</span>
          {avgW !== undefined && <span className="inline-flex items-center gap-1.5"><Zap className="w-4 h-4 text-bone/50" />{avgW} W {t("moy.", "avg")}</span>}
          {best20 !== undefined && <span className="inline-flex items-center gap-1.5"><Timer className="w-4 h-4 text-bone/50" />{best20} W · 20 min</span>}
        </div>
      </div>
    </div>
  );
}
