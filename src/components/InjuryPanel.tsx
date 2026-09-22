"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ShieldAlert, TriangleAlert } from "lucide-react";
import { db, todayISO, uid } from "@/lib/db";
import { PAIN_LABEL } from "@/lib/engine/readiness";
import { AREA_LABEL, RED_FLAGS, adaptationFor, activeInjuries } from "@/lib/engine/injury";
import { rebuildRemaining } from "@/lib/engine/rebuild";
import { Section, Seg } from "./ui";
import { Press } from "./motion";
import type { Injury, InjurySeverity, PainArea } from "@/lib/types";

const PHASE_LABEL = { protect: "Protecting", reload: "Reloading", return: "Returning", clear: "Clear" } as const;
const SEVERITY: { v: InjurySeverity; label: string }[] = [
  { v: 1, label: "A niggle" },
  { v: 2, label: "Limits training" },
  { v: 3, label: "Limits daily life" },
];

/** Log an injury, report a flare-up, clear it when it settles. */
export function InjuryPanel({ onSay }: { onSay?: (t: string) => void }) {
  const injuries = useLiveQuery(() => db.injuries.toArray(), []) ?? [];
  const active = activeInjuries(injuries);
  const today = todayISO();
  const [adding, setAdding] = useState(false);
  const [area, setArea] = useState<PainArea>("knee");
  const [severity, setSeverity] = useState<InjurySeverity>(2);

  async function add() {
    const row: Injury = { id: uid(), area, severity, since: today };
    await db.injuries.put({ ...row, dirty: 1, updatedAt: new Date().toISOString() });
    setAdding(false);
    // The point of logging it is that the upcoming sessions change. Finished
    // sessions are left alone; only what hasn't happened yet is rewritten.
    await rebuildRemaining();
    onSay?.(`${AREA_LABEL[area]} logged. The rest of your block has been rewritten around it.`);
  }
  async function touch(id: string, patch: Partial<Injury>) {
    await db.injuries.update(id, { ...patch, dirty: 1, updatedAt: new Date().toISOString() });
    await rebuildRemaining();
  }

  return (
    <Section title="Injuries" aside={!adding ? <button type="button" className="text-xs text-smoke underline" onClick={() => setAdding(true)}>Log one</button> : undefined}>
      <div className="grid gap-3">
        {active.length === 0 && !adding && (
          <div className="card p-4 grid gap-1">
            <p className="text-sm font-medium">Nothing flagged</p>
            <p className="text-xs text-smoke">If something starts hurting, log it here. The block keeps running — only the movements that load that area are held back, and they come back as it settles.</p>
          </div>
        )}

        {adding && (
          <div className="card p-4 grid gap-4">
            <div className="field">
              <span className="meta">Where</span>
              <Seg scroll value={area} onChange={setArea} options={(Object.keys(PAIN_LABEL) as PainArea[]).map((k) => ({ v: k, label: PAIN_LABEL[k] }))} />
            </div>
            <div className="field">
              <span className="meta">How much is it limiting you</span>
              <Seg fill value={severity} onChange={setSeverity} options={SEVERITY} />
            </div>
            <p className="text-xs text-smoke">FORGE adapts your training around it. It doesn’t diagnose or treat anything — if any of the signs below apply, see a professional first.</p>
            <div className="flex gap-2">
              <Press><button type="button" className="pill pill--sm pill--bone" onClick={add}>Log it</button></Press>
              <button type="button" className="pill pill--sm" onClick={() => setAdding(false)}>Cancel</button>
            </div>
          </div>
        )}

        {active.map((i) => {
          const a = adaptationFor(i, today);
          return (
            <div key={i.id} className="card overflow-hidden">
              <div className="p-4 grid gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className="meta flex items-center gap-1.5"><ShieldAlert className="w-3.5 h-3.5" strokeWidth={2} />{PHASE_LABEL[a.phase]}</span>
                    <p className="display text-2xl mt-1 capitalize">{AREA_LABEL[i.area]}</p>
                  </div>
                  <span className="chip tnum shrink-0">{a.quietDays} quiet day{a.quietDays === 1 ? "" : "s"}</span>
                </div>

                <div>
                  <div className="flex justify-between text-xs text-smoke mb-1.5 tnum">
                    <span>Load allowed</span><span>{Math.round(a.loadCap * 100)}%</span>
                  </div>
                  <span className="block h-[3px] rounded-full bg-[var(--line)]">
                    <span className="block h-full rounded-full bg-volt" style={{ width: `${Math.max(3, a.loadCap * 100)}%` }} />
                  </span>
                  {a.nextStepInDays != null && (
                    <p className="text-xs text-smoke mt-2">{a.nextStepInDays === 0 ? "Ready to step up at your next session." : `${a.nextStepInDays} more quiet day${a.nextStepInDays === 1 ? "" : "s"} to the next step.`}</p>
                  )}
                </div>

                <ul className="grid gap-1.5 text-sm">{a.guidance.map((g) => <li key={g}>{g}</li>)}</ul>

                <div className="flex gap-2 flex-wrap">
                  <button type="button" className="pill pill--sm" onClick={async () => { await touch(i.id, { lastFlareAt: today }); onSay?.("Flare-up noted — load steps back down and the block is rewritten."); }}>It flared up today</button>
                  <button type="button" className="pill pill--sm" onClick={async () => { await touch(i.id, { resolvedAt: today }); onSay?.(`${AREA_LABEL[i.area]} cleared. Full load returns to the remaining weeks.`); }}>It’s better</button>
                </div>
              </div>

              <details className="border-t border-line">
                <summary className="px-4 py-3 text-xs flex items-center gap-2 cursor-pointer text-danger"><TriangleAlert className="w-3.5 h-3.5" strokeWidth={2} />When to stop and see a professional</summary>
                <ul className="px-4 pb-4 grid gap-1.5 text-xs text-smoke">{RED_FLAGS.map((f) => <li key={f}>· {f}</li>)}</ul>
              </details>
            </div>
          );
        })}
      </div>
    </Section>
  );
}
