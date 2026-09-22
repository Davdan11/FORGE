"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { flatten, sanitize, stressScore, totalSec, targetFor, zoneOfPct, ZONE_LABEL, ZONE_HEX, type Block, type StructuredWorkout } from "@/lib/indoor/workouts";
import { fmtDuration } from "@/lib/units";
import { Press } from "@/components/motion";
import { WorkoutChart } from "./WorkoutChart";

/* ─────────────────────────────────────────────────────────────
   Build your own workout.

   Blocks, top to bottom, the way the workout will be ridden.
   Every intensity is a percentage of threshold, and the watts or
   pace it means for you is shown beside it — so a block reads as
   "90 % · 207 W" rather than as an abstraction.
   ───────────────────────────────────────────────────────────── */

const NEW_BLOCK: Record<Block["kind"], Block> = {
  steady: { kind: "steady", sec: 300, pct: 75 },
  ramp: { kind: "ramp", sec: 600, from: 50, to: 80 },
  intervals: { kind: "intervals", repeat: 4, onSec: 120, onPct: 105, offSec: 120, offPct: 55 },
};

export function WorkoutBuilder({ initial, thresholds, onSave, onDelete, onCancel }: {
  initial: StructuredWorkout;
  thresholds: { ftpW: number; thresholdKmh: number };
  onSave: (w: StructuredWorkout) => void;
  onDelete?: () => void;
  onCancel: () => void;
}) {
  const [w, setW] = useState<StructuredWorkout>(initial);
  const steps = flatten(w);
  const set = (i: number, b: Block) => setW({ ...w, blocks: w.blocks.map((x, j) => (j === i ? b : x)) });
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= w.blocks.length) return;
    const blocks = [...w.blocks];
    [blocks[i], blocks[j]] = [blocks[j], blocks[i]];
    setW({ ...w, blocks });
  };
  const means = (pct: number) => {
    const t = targetFor(w.sport, pct, thresholds);
    return w.sport === "ride" ? `${t} W` : `${pace(t)} /km`;
  };

  return (
    <div className="grid gap-4">
      <label className="grid gap-1">
        <span className="meta">Name</span>
        <input className="input" value={w.name} maxLength={60} onChange={(e) => setW({ ...w, name: e.target.value })} placeholder="My workout" />
      </label>

      <div className="card p-3 grid gap-2">
        <WorkoutChart workout={w} className="h-20 w-full text-ink" />
        <p className="text-xs text-smoke tnum">{fmtDuration(totalSec(steps))} · stress {stressScore(steps)} · {w.sport === "ride" ? `FTP ${thresholds.ftpW} W` : `threshold ${thresholds.thresholdKmh} km/h`}</p>
      </div>

      <ol className="grid gap-2">
        {w.blocks.map((b, i) => (
          <li key={i} className="card p-3 grid gap-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: ZONE_HEX[zoneOfPct(b.kind === "steady" ? b.pct : b.kind === "ramp" ? Math.max(b.from, b.to) : b.onPct)] }} />
              <strong className="text-sm capitalize flex-1">{b.kind === "intervals" ? `${b.repeat} × intervals` : b.kind}</strong>
              <button type="button" aria-label="Move up" className="p-1.5 text-smoke disabled:opacity-30" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp className="w-4 h-4" /></button>
              <button type="button" aria-label="Move down" className="p-1.5 text-smoke disabled:opacity-30" disabled={i === w.blocks.length - 1} onClick={() => move(i, 1)}><ArrowDown className="w-4 h-4" /></button>
              <button type="button" aria-label="Remove block" className="p-1.5 text-danger" onClick={() => setW({ ...w, blocks: w.blocks.filter((_, j) => j !== i) })}><Trash2 className="w-4 h-4" /></button>
            </div>
            {b.kind === "steady" && (
              <div className="grid grid-cols-2 gap-2">
                <Num label="Minutes" value={b.sec / 60} step={0.5} onChange={(v) => set(i, { ...b, sec: v * 60 })} />
                <Num label={`% · ${means(b.pct)}`} value={b.pct} step={5} onChange={(v) => set(i, { ...b, pct: v })} />
              </div>
            )}
            {b.kind === "ramp" && (
              <div className="grid grid-cols-3 gap-2">
                <Num label="Minutes" value={b.sec / 60} step={0.5} onChange={(v) => set(i, { ...b, sec: v * 60 })} />
                <Num label={`From %`} value={b.from} step={5} onChange={(v) => set(i, { ...b, from: v })} />
                <Num label={`To %`} value={b.to} step={5} onChange={(v) => set(i, { ...b, to: v })} />
              </div>
            )}
            {b.kind === "intervals" && (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                <Num label="Repeats" value={b.repeat} step={1} onChange={(v) => set(i, { ...b, repeat: v })} />
                <Num label="On min" value={b.onSec / 60} step={0.5} onChange={(v) => set(i, { ...b, onSec: v * 60 })} />
                <Num label={`On % · ${means(b.onPct)}`} value={b.onPct} step={5} onChange={(v) => set(i, { ...b, onPct: v })} />
                <Num label="Off min" value={b.offSec / 60} step={0.5} onChange={(v) => set(i, { ...b, offSec: v * 60 })} />
                <Num label={`Off %`} value={b.offPct} step={5} onChange={(v) => set(i, { ...b, offPct: v })} />
              </div>
            )}
            {b.kind !== "intervals" && <p className="text-[11px] text-smoke">{ZONE_LABEL[zoneOfPct(b.kind === "steady" ? b.pct : Math.max(b.from, b.to))]}</p>}
          </li>
        ))}
      </ol>

      <div className="flex gap-2 flex-wrap">
        {(["steady", "ramp", "intervals"] as const).map((k) => (
          <button key={k} type="button" className="pill pill--sm capitalize" disabled={w.blocks.length >= 40} onClick={() => setW({ ...w, blocks: [...w.blocks, NEW_BLOCK[k]] })}>+ {k}</button>
        ))}
      </div>

      <div className="flex gap-2">
        <Press className="flex-1"><button type="button" className="pill pill--volt pill--block" disabled={!w.blocks.length} onClick={() => onSave(sanitize(w))}>Save workout</button></Press>
        <button type="button" className="pill" onClick={onCancel}>Cancel</button>
      </div>
      {onDelete && <button type="button" className="pill pill--danger pill--sm justify-self-start" onClick={() => { if (confirm("Delete this workout?")) onDelete(); }}>Delete workout</button>}
    </div>
  );
}

function Num({ label, value, step, onChange }: { label: string; value: number; step: number; onChange: (v: number) => void }) {
  return (
    <label className="grid gap-1 min-w-0">
      <span className="meta truncate">{label}</span>
      <input className="input tnum" type="number" inputMode="decimal" min={0} step={step} value={Number.isFinite(value) ? +value.toFixed(2) : ""}
        onChange={(e) => { const v = parseFloat(e.target.value); if (Number.isFinite(v)) onChange(v); }} />
    </label>
  );
}

/** m/s as minutes:seconds per kilometre. */
export function pace(ms: number) {
  if (ms < 0.3) return "—";
  const s = Math.round(1000 / ms);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
