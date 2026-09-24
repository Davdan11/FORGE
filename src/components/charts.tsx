"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { useT } from "@/lib/i18n";

/* ─────────────────────────────────────────────────────────────
   Small, single-hue charts (volt on ink). Thin marks, rounded
   data-ends, recessive grid, tap tooltips, text in text tokens.
   ───────────────────────────────────────────────────────────── */

export function Bars({ data, format = (v) => String(Math.round(v)), height = 120, highlightLast = true }: { data: { label: string; value: number; sub?: string }[]; format?: (v: number) => string; height?: number; highlightLast?: boolean }) {
  const [sel, setSel] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));
  const active = sel ?? (highlightLast ? data.length - 1 : null);
  return (
    <div className="grid gap-2">
      <div className="h-5 text-xs tnum text-ink">{active != null && data[active] ? <><span className="text-smoke">{data[active].label}{data[active].sub ? ` · ${data[active].sub}` : ""} · </span>{format(data[active].value)}</> : null}</div>
      <div className="relative" style={{ height }}>
        <div className="absolute inset-x-0 top-1/2 border-t border-line" /><div className="absolute inset-x-0 bottom-0 border-t border-line-strong" />
        <div className="absolute inset-0 flex items-end gap-[6px]">
          {data.map((d, i) => (
            <button key={d.label + i} type="button" aria-label={`${d.label}: ${format(d.value)}`} onClick={() => setSel(i === sel ? null : i)} className="flex-1 h-full flex items-end min-w-0">
              <motion.span initial={{ height: 0 }} animate={{ height: `${Math.max(2, (d.value / max) * 100)}%` }} transition={{ duration: 0.7, delay: i * 0.04, ease: [0.16, 1, 0.3, 1] }}
                className="block w-full rounded-t-[4px]" style={{ background: i === active ? "var(--volt)" : "rgba(31,199,111,.35)" }} />
            </button>
          ))}
        </div>
      </div>
      <div className="flex gap-[6px]">{data.map((d, i) => <span key={d.label + i} className="flex-1 text-[10px] text-smoke text-center truncate">{d.label}</span>)}</div>
    </div>
  );
}

export function Sparkline({ values, height = 56, format = (v) => String(Math.round(v)), color = "var(--volt)", labels }: { values: number[]; height?: number; format?: (v: number) => string; color?: string; labels?: string[] }) {
  const [sel, setSel] = useState<number | null>(null);
  const t = useT();
  if (values.length < 2) return <div className="text-xs text-smoke">{t("Pas encore assez de données.", "Not enough data yet.")}</div>;
  const w = 300, h = height, pad = 6;
  const min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
  const x = (i: number) => pad + (i / (values.length - 1)) * (w - pad * 2);
  const y = (v: number) => h - pad - ((v - min) / span) * (h - pad * 2);
  const d = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const area = `${d} L${x(values.length - 1)} ${h} L${x(0)} ${h} Z`;
  const i = sel ?? values.length - 1;
  return (
    <div className="grid gap-1">
      <div className="flex justify-between text-xs tnum"><span className="text-smoke">{labels?.[i] ?? ""}</span><span>{format(values[i])}</span></div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height }} onPointerMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); setSel(Math.round(((e.clientX - r.left) / r.width) * (values.length - 1))); }} onPointerLeave={() => setSel(null)}>
        <defs><linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={color} stopOpacity=".25" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
        <path d={area} fill="url(#spark-fill)" />
        <motion.path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }} />
        <line x1={x(i)} x2={x(i)} y1={pad} y2={h - pad} stroke="var(--line-strong)" strokeDasharray="2 3" />
        <circle cx={x(i)} cy={y(values[i])} r="4.5" fill={color} stroke="var(--ink)" strokeWidth="2" />
      </svg>
    </div>
  );
}

/** 12-week consistency grid: weeks as columns, days as rows. value 0..3 */
export function Heatmap({ cells, weeks = 12 }: { cells: Record<string, number>; weeks?: number }) {
  const t = useT();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const dow = (today.getDay() + 6) % 7;
  const start = new Date(today); start.setDate(today.getDate() - dow - (weeks - 1) * 7);
  const cols = Array.from({ length: weeks }, (_, w) => Array.from({ length: 7 }, (_, d) => { const dt = new Date(start); dt.setDate(start.getDate() + w * 7 + d); return dt; }));
  const iso = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  // Drawn for the paper theme: empty days are a faint ink tint so the grid
  // reads as a calendar even before anything is logged.
  const op = [0.08, 0.35, 0.65, 1];
  return (
    <div className="grid gap-2">
      <div className="flex gap-[3px]">
        {cols.map((col, w) => (
          <div key={w} className="flex-1 grid gap-[3px]">
            {col.map((d) => { const k = iso(d); const v = Math.min(3, cells[k] ?? 0); const future = d > today; return (
              <motion.span key={k} title={`${k}: ${v ? t("actif", "active") : t("repos", "rest")}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: w * 0.03 }} className="block aspect-square rounded-[3px]" style={{ background: future ? "transparent" : v ? `rgba(31,199,111,${op[v]})` : "rgba(16,16,16,.07)", boxShadow: iso(today) === k ? "inset 0 0 0 1.5px var(--ink)" : undefined }} />); })}
          </div>
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-smoke"><span>{t(`Il y a ${weeks} semaines`, `${weeks} weeks ago`)}</span><span>{t("Lun → dim par colonne", "Mon → Sun per column")}</span><span>{t("Aujourd’hui", "Today")}</span></div>
    </div>
  );
}

export function ElevationChart({ profile, height = 90 }: { profile: { d: number; alt: number }[]; height?: number }) {
  const t = useT();
  if (profile.length < 2) return <p className="text-xs text-smoke">{t("Pas de données d’altitude sur ce parcours.", "No altitude data on this route.")}</p>;
  const w = 300, h = height, pad = 4;
  const min = Math.min(...profile.map((p) => p.alt)), max = Math.max(...profile.map((p) => p.alt)), span = Math.max(10, max - min);
  const total = profile[profile.length - 1].d || 1;
  const x = (d: number) => pad + (d / total) * (w - pad * 2);
  const y = (a: number) => h - pad - ((a - min) / span) * (h - pad * 2);
  const line = profile.map((p, i) => `${i ? "L" : "M"}${x(p.d).toFixed(1)} ${y(p.alt).toFixed(1)}`).join(" ");
  return (
    <div className="grid gap-1">
      <div className="flex justify-between text-[10px] text-smoke tnum"><span>{Math.round(max)} m</span><span>{Math.round(min)} m</span></div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height }}>
        <path d={`${line} L${x(total)} ${h} L${x(0)} ${h} Z`} fill="rgba(31,199,111,.18)" />
        <path d={line} fill="none" stroke="var(--volt)" strokeWidth="1.8" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

