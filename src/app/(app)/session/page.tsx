"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { db, getProfile, uid } from "@/lib/db";
import { getExercise } from "@/lib/data/exercises";
import { sessionImage } from "@/lib/data/images";
import { MoveMedia } from "@/components/MoveMedia";
import { nextSetFromRpe } from "@/lib/engine/autoregulate";
import { awardSession, bestE1rmBySlug } from "@/lib/progress";
import { fmtLoad, kgToLb, lbToKg, fmtDuration, platesFor, roundLoad, e1rm } from "@/lib/units";
import { Screen, Hero, Toast, ScreenSkeleton, Rail, Empty } from "@/components/ui";
import { removeAdded } from "@/lib/engine/custom";
import { Page, Ring, CountUp, Press, motion, AnimatePresence } from "@/components/motion";
import type { LoggedSet, PrescribedExercise, PrescribedSet, UnitPrefs } from "@/lib/types";

/* The id arrives as a query parameter, not as a path segment.

   A static export writes one file per route, and these ids only exist once
   somebody has trained — there is nothing to pre-render. A query parameter
   needs no file of its own, so the same page serves every id and the iOS and
   Android builds get a route they can actually ship. */
export default function SessionPage() {
  return <Suspense fallback={<ScreenSkeleton />}><SessionDetail /></Suspense>;
}

function SessionDetail() {
  const id = useSearchParams().get("id") ?? "";
  const router = useRouter();
  const profile = useLiveQuery(() => getProfile(), []);
  // `?? null`: useLiveQuery returns undefined while loading AND when the row
  // does not exist, and a skeleton that waits for a missing row never ends.
  const session = useLiveQuery(async () => (await db.sessions.get(id)) ?? null, [id]);
  const loggedRaw = useLiveQuery(() => db.sets.where("sessionId").equals(id).toArray(), [id]);
  const logged = useMemo(() => loggedRaw ?? [], [loggedRaw]);
  const [active, setActive] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [rest, setRest] = useState<number | null>(null);
  const [restTotal, setRestTotal] = useState(0);
  const [startedAt] = useState(() => new Date().toISOString());
  const [prBefore, setPrBefore] = useState<Record<string, number>>({});
  const [swapOpen, setSwapOpen] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [summary, setSummary] = useState<{ xp: number; sets: number; volume: number; prs: string[]; badges: string[]; minutes: number; muscles: string[] } | null>(null);
  const restRef = useRef<number | null>(null);

  useEffect(() => { bestE1rmBySlug().then(setPrBefore); }, []);
  const resting = rest != null;
  useEffect(() => {
    if (!resting) return;
    restRef.current = window.setInterval(() => {
      setRest((r) => { if (r == null) return null; if (r <= 1) { if (navigator.vibrate) navigator.vibrate([120, 60, 120]); return null; } return r - 1; });
    }, 1000);
    return () => { if (restRef.current) clearInterval(restRef.current); };
  }, [resting]);

  const byEx = useMemo(() => {
    const m: Record<string, LoggedSet[]> = {};
    for (const s of logged) (m[s.exerciseId] ??= []).push(s);
    for (const k in m) m[k].sort((a, b) => a.setIndex - b.setIndex);
    return m;
  }, [logged]);
  const tonnage = useMemo(() => logged.reduce((a, s) => a + (s.loadKg ?? 0) * (s.reps ?? 0), 0), [logged]);

  if (session === null) return <Screen><Empty title="Session not found" body="It may have been rebuilt after a change to your plan. Today always has the current one." cta="Back to today" href="/today" /></Screen>;
  if (!session || !profile) return <ScreenSkeleton />;
  const ex = session.exercises[active];
  const nextEx = session.exercises[active + 1];
  const done = session.status === "done";
  const totalSets = session.exercises.reduce((a, e) => a + e.sets.length, 0);

  async function logSet(exercise: PrescribedExercise, setIndex: number, values: { reps?: number; seconds?: number; loadKg?: number; rpe?: number }) {
    if (!session) return;
    const prev = exercise.sets[setIndex];
    const entry: LoggedSet = { id: uid(), sessionId: session.id, exerciseId: exercise.id, slug: exercise.slug, setIndex, at: new Date().toISOString(), ...values };
    const nextIdx = setIndex + 1;
    let why: string | null = null;
    if (nextIdx < exercise.sets.length) {
      const out = nextSetFromRpe(prev, values, exercise.sets[nextIdx], profile!.units);
      why = out.why;
      const sets = exercise.sets.slice(); sets[nextIdx] = out.next;
      await db.sessions.update(session.id, { exercises: session.exercises.map((e) => (e.id === exercise.id ? { ...e, sets } : e)), dirty: 1 });
      if (why) entry.adjusted = why;
    }
    await db.sets.put({ ...entry, dirty: 1 });
    if (navigator.vibrate) navigator.vibrate(12);
    if (why) { setToast(why); setTimeout(() => setToast(null), 5000); }
    if (prev.restSec > 0 && nextIdx < exercise.sets.length) { setRestTotal(prev.restSec); setRest(prev.restSec); }
    if (nextIdx >= exercise.sets.length && active < session.exercises.length - 1) setTimeout(() => setActive(active + 1), 500);
  }

  async function swap(exercise: PrescribedExercise, toSlug: string) {
    if (!session) return;
    const from = getExercise(exercise.slug), to = getExercise(toSlug); if (!to || !from) return;
    const sets = exercise.sets.map((s) => ({ ...s, loadKg: to.loadable && s.loadKg && from.ratio && to.ratio ? Math.round((s.loadKg / from.ratio) * to.ratio / 2.5) * 2.5 : to.loadable ? s.loadKg : undefined }));
    await db.sessions.update(session.id, { exercises: session.exercises.map((e) => (e.id === exercise.id ? { ...e, slug: toSlug, sets, why: `Swapped from ${from.name}: same pattern, a tool you have.` } : e)), dirty: 1 });
    setSwapOpen(null);
  }

  async function finish() {
    if (!session) return;
    const sets = await db.sets.where("sessionId").equals(session.id).toArray();
    const volume = sets.reduce((a, s) => a + (s.loadKg ?? 0) * (s.reps ?? 0), 0);
    const rpes = sets.filter((s) => s.rpe != null);
    const durationSec = Math.round((Date.now() - new Date(startedAt).getTime()) / 1000);
    const mobilityMin = session.exercises.filter((e) => getExercise(e.slug)?.pillar === "mobility").reduce((a, e) => a + e.sets.reduce((b, s) => b + (s.seconds ?? 0), 0), 0) / 60;
    const cardioMin = (session.cardio?.minutes ?? 0) + session.exercises.filter((e) => getExercise(e.slug)?.pattern === "cardio").reduce((a, e) => a + e.sets.reduce((b, s) => b + (s.seconds ?? 0), 0), 0) / 60;
    const log = { id: uid(), sessionId: session.id, startedAt, endedAt: new Date().toISOString(), durationSec, volumeKg: volume, avgRpe: rpes.length ? rpes.reduce((a, s) => a + (s.rpe ?? 0), 0) / rpes.length : undefined, notes: note || undefined, xp: 0 };
    const { xp, prs, earned } = await awardSession(log, { adjusted: session.status === "adjusted", setsLogged: sets.length, rpeLogged: rpes.length, mobilityMin, cardioMin, prBefore });
    await db.logs.put({ ...log, xp, dirty: 1 });
    await db.sessions.update(session.id, { status: "done", dirty: 1 });
    const muscles = [...new Set(sets.flatMap((s) => getExercise(s.slug)?.primary ?? []))];
    setSummary({ xp, sets: sets.length, volume, prs: prs.map((p) => getExercise(p)?.name ?? p), badges: earned, minutes: Math.round(durationSec / 60), muscles });
  }

  return (
    <Page>
      <Screen>
        <Hero image={sessionImage(session.kind)} height="h-[250px]" back="/today" title={<>{session.title}<br /><em>{done ? "done." : `week ${session.week}`}</em></>}
          right={<span className="chip chip--live backdrop-blur-md tnum"><Clock from={startedAt} /></span>}>
          <div className="flex items-center gap-3 mt-3">
            <div className="flex-1"><div className="bar"><motion.i animate={{ width: `${(logged.length / Math.max(1, totalSets)) * 100}%` }} /></div></div>
            <span className="text-xs tnum text-smoke">{logged.length}/{totalSets} sets</span>
            <span className="chip chip--live backdrop-blur-md tnum"><CountUp value={Math.round(tonnage)} /> kg</span>
          </div>
        </Hero>

        {session.adjustment && <div className="card p-4 mb-5 grid gap-2"><span className="chip chip--volt justify-self-start">Adjusted today</span><p className="text-sm">{session.adjustment.reason}</p></div>}
        {session.cardio && (
          <div className="card p-4 mb-5 grid gap-1">
            <span className="meta">Cardio · Zone {session.cardio.zone}</span>
            <p className="display text-2xl">{session.cardio.minutes} min{session.cardio.structure ? ` · ${session.cardio.structure}` : ""}</p>
            <p className="text-xs text-smoke">Record it on the Move tab with GPS — it closes this session automatically.</p>
            <Link href="/move" className="pill pill--sm justify-self-start mt-1">Open Move</Link>
          </div>
        )}

        <div className="xl:grid xl:grid-cols-[var(--rail-nav)_minmax(0,1fr)] xl:gap-10 xl:items-start">
        <Rail active={active} gutter className="gap-2 pb-3 mb-3 xl:flex-col xl:overflow-visible xl:mx-0 xl:px-0 xl:sticky xl:top-10">
          {session.exercises.map((e, i) => {
            const n = byEx[e.id]?.length ?? 0; const meta = getExercise(e.slug);
            return (
              <button key={e.id} type="button" aria-pressed={i === active} onClick={() => setActive(i)} className={`shrink-0 flex items-center gap-2 pl-1 pr-3 py-1 min-h-11 rounded-full border transition-colors xl:w-full xl:min-h-14 xl:pl-1.5 xl:pr-4 ${i === active ? "bg-volt border-volt text-ink" : n >= e.sets.length ? "border-line-strong" : "border-line text-smoke"}`}>
                {meta && <span className="w-9 h-9 rounded-full overflow-hidden relative shrink-0"><MoveMedia ex={meta} fill thumb /></span>}
                <span className="text-xs xl:text-sm font-medium whitespace-nowrap xl:flex-1 xl:text-left xl:min-w-0 xl:truncate">{meta?.name}</span>
                <span className="text-[10px] tnum opacity-70">{n}/{e.sets.length}</span>
              </button>
            );
          })}
        </Rail>

        <div className="min-w-0">
        <AnimatePresence mode="wait">
          {ex && <motion.div key={ex.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}>
            <ExerciseCard ex={ex} logged={byEx[ex.id] ?? []} units={profile.units} disabled={done} sessionId={session.id} onLog={(i, v) => logSet(ex, i, v)} onSwap={() => setSwapOpen(ex.id)} onRemove={ex.added && !(byEx[ex.id]?.length) ? () => removeAdded(session.id, ex.id) : undefined} />
          </motion.div>}
        </AnimatePresence>

        {nextEx && !done && (() => { const m = getExercise(nextEx.slug); if (!m) return null; return (
          <button type="button" onClick={() => setActive(active + 1)} className="card mt-3 p-2 flex items-center gap-3 w-full text-left">
            <span className="thumb !w-14 !h-14 relative overflow-hidden"><MoveMedia ex={m} fill thumb /></span>
            <span className="flex-1 min-w-0"><span className="meta">Next up</span><span className="block font-medium truncate">{m.name}</span></span>
            <span className="tnum text-xs text-smoke">{nextEx.sets.length} × {nextEx.sets[0].reps ?? `${nextEx.sets[0].seconds}s`}{nextEx.sets[0].loadKg ? ` · ${fmtLoad(nextEx.sets[0].loadKg, profile.units)}` : ""}</span>
          </button>); })()}

        <AnimatePresence>{swapOpen && ex && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="card p-4 mt-4 grid gap-2">
            <span className="meta">Swap {getExercise(ex.slug)?.name} for</span>
            {(getExercise(ex.slug)?.swaps ?? []).map((s) => { const m = getExercise(s); if (!m) return null; return (
              <button key={s} type="button" className="flex items-center gap-3 p-2 rounded-xl border border-line text-left" onClick={() => swap(ex, s)}>
                <span className="thumb !w-14 !h-14 relative overflow-hidden"><MoveMedia ex={m} fill thumb /></span><span className="flex-1"><span className="block text-sm font-medium">{m.name}</span><span className="text-xs text-smoke">{m.equipment.join(" · ")}</span></span>
              </button>); })}
            <button type="button" className="text-xs text-smoke underline text-left" onClick={() => setSwapOpen(null)}>Cancel</button>
          </motion.div>
        )}</AnimatePresence>

        <AnimatePresence>{rest != null && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="fixed left-1/2 -translate-x-1/2 bottom-[calc(var(--safe-bottom)+92px)] z-40 card px-4 py-3 flex items-center gap-4 shadow-[0_20px_50px_-20px_rgba(0,0,0,.9)]">
            <Ring value={1 - rest / Math.max(1, restTotal)} size={52} stroke={5}><span className="text-xs tnum font-semibold">{fmtDuration(rest)}</span></Ring>
            <span className="meta">Rest</span>
            <button type="button" className="pill pill--sm" onClick={() => setRest((r) => (r ?? 0) + 30)}>+30</button>
            <button type="button" className="pill pill--sm pill--bone" onClick={() => setRest(null)}>Skip</button>
          </motion.div>
        )}</AnimatePresence>

        {!done && (
          <div className="grid gap-3 mt-8">
            <label className="field"><span className="meta">Session note (optional)</span><input className="input" placeholder="Felt strong on the press; left knee fine." value={note} onChange={(e) => setNote(e.target.value)} /></label>
            <Press><button type="button" className="pill pill--volt pill--block pill--lg" onClick={finish} disabled={logged.length === 0}>Finish session{logged.length ? ` · ${logged.length} sets · ${Math.round(tonnage).toLocaleString("en-US")} kg` : ""}</button></Press>
          </div>
        )}
        </div>
        </div>
        <Toast text={toast} />

        <AnimatePresence>{summary && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-[60] bg-ink/95 text-bone backdrop-blur-md grid place-items-center p-6 overflow-y-auto">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} transition={{ type: "spring", stiffness: 260, damping: 22 }} className="w-full max-w-[420px] grid gap-5 text-center justify-items-center">
              <p className="meta">Session logged</p>
              <p className="numeral text-volt">+<CountUp value={summary.xp} duration={1.4} /><span className="text-2xl"> XP</span></p>
              <div className="grid grid-cols-3 gap-3 w-full">
                <div className="card p-3"><span className="meta">Sets</span><strong className="display text-2xl block"><CountUp value={summary.sets} /></strong></div>
                <div className="card p-3"><span className="meta">Volume</span><strong className="display text-2xl block"><CountUp value={Math.round(summary.volume)} suffix=" kg" /></strong></div>
                <div className="card p-3"><span className="meta">Time</span><strong className="display text-2xl block"><CountUp value={summary.minutes} suffix=" min" /></strong></div>
              </div>
              <div className="flex flex-wrap gap-1.5 justify-center">{summary.muscles.map((m) => <span key={m} className="chip chip--live">{m.replace("_", " ")}</span>)}</div>
              {summary.prs.length > 0 && <p className="text-sm"><span className="chip chip--volt mr-2">PR</span>{summary.prs.join(", ")}</p>}
              {summary.badges.length > 0 && <p className="text-sm"><span className="chip chip--live mr-2">Badge</span>{summary.badges.join(", ")}</p>}
              <Press><button type="button" className="pill pill--bone pill--lg" onClick={() => router.push("/today")}>Back to today</button></Press>
            </motion.div>
          </motion.div>
        )}</AnimatePresence>
      </Screen>
    </Page>
  );
}

function Clock({ from }: { from: string }) {
  const [s, setS] = useState(0);
  useEffect(() => { const t = setInterval(() => setS(Math.round((Date.now() - new Date(from).getTime()) / 1000)), 1000); return () => clearInterval(t); }, [from]);
  return <>{fmtDuration(s)}</>;
}

function ExerciseCard({ ex, logged, units, disabled, sessionId, onLog, onSwap, onRemove }: { ex: PrescribedExercise; logged: LoggedSet[]; units: UnitPrefs; disabled: boolean; sessionId: string; onLog: (i: number, v: { reps?: number; seconds?: number; loadKg?: number; rpe?: number }) => void; onSwap: () => void; onRemove?: () => void }) {
  const meta = getExercise(ex.slug);
  const [showWhy, setShowWhy] = useState(false);
  const [tempo, setTempo] = useState(false);
  const [warm, setWarm] = useState(false);
  const [plates, setPlates] = useState(false);
  const history = useLiveQuery(() => db.sets.where("slug").equals(ex.slug).reverse().sortBy("at"), [ex.slug]) ?? [];
  if (!meta) return null;
  const last = history.find((s) => s.sessionId !== sessionId);
  const lastBest = history.filter((s) => s.sessionId !== sessionId && s.loadKg && s.reps).reduce((a, s) => Math.max(a, e1rm(s.loadKg!, s.reps!)), 0);
  const top = ex.sets[0];
  const tempoDigits = meta.tempo ? meta.tempo.split("-").map((d) => (Number.isFinite(Number(d)) ? Number(d) : 1)) : null;
  const tempoMs = tempoDigits ? tempoDigits.reduce((a, b) => a + b, 0) * 1000 : undefined;
  const barbell = meta.equipment.includes("barbell") && meta.loadable;
  const ramp = ex.block === "main" && top.loadKg && top.loadKg >= 40 ? [0.5, 0.7, 0.85].map((pct, i) => ({ pct, kg: roundLoad(top.loadKg! * pct, units), reps: [5, 3, 1][i] })) : null;

  return (
    <div className="card overflow-hidden">
      <div className="relative h-[240px] lg:h-[320px] overflow-hidden">
        <MoveMedia ex={meta} fill periodMs={tempo ? tempoMs : undefined} />
        <div className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-ink/90 via-ink/45 to-transparent" />
        <div className="on-photo absolute inset-x-0 bottom-0 p-4 lg:p-6 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <span className="meta">{ex.added ? "added by you" : ex.block}{meta.tempo ? ` · tempo ${meta.tempo}` : ""}</span>
            <p className="display text-3xl lg:text-5xl">{meta.name}</p>
            <p className="text-xs text-bone/75">{meta.primary.join(", ")}{last ? ` · last: ${last.seconds ? `${last.seconds}s` : `${last.reps} reps`}${last.loadKg ? ` · ${fmtLoad(last.loadKg, units)}` : ""}${last.rpe ? ` @${last.rpe}` : ""}` : ""}</p>
          </div>
          <div className="grid gap-1.5 justify-items-end shrink-0 relative z-10"><Link href={`/library/${meta.slug}`} className="chip chip--live">Cues</Link>{!disabled && (onRemove ? <button type="button" className="chip chip--live" onClick={onRemove}>Remove</button> : <button type="button" className="chip chip--live" onClick={onSwap}>Swap</button>)}</div>
        </div>
      </div>

      <div className="flex gap-1.5 flex-wrap px-4 py-3 border-b border-line">
        {tempoDigits && <button type="button" className={`chip ${tempo ? "chip--volt" : ""}`} aria-pressed={tempo} onClick={() => setTempo(!tempo)}>Tempo coach {tempoDigits.join("·")}</button>}
        {ramp && <button type="button" className={`chip ${warm ? "chip--volt" : ""}`} aria-pressed={warm} onClick={() => setWarm(!warm)}>Warm-up ramp</button>}
        {barbell && top.loadKg && <button type="button" className={`chip ${plates ? "chip--volt" : ""}`} aria-pressed={plates} onClick={() => setPlates(!plates)}>Plates</button>}
        {lastBest > 0 && <span className="chip tnum ml-auto">Best e1RM {fmtLoad(lastBest, units)}</span>}
      </div>

      <AnimatePresence>{warm && ramp && (
        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-b border-line">
          <div className="px-4 py-3 grid gap-1.5 text-sm">
            <span className="meta">Ramp to {fmtLoad(top.loadKg, units)} · not logged as work</span>
            <div className="grid grid-cols-4 gap-2 tnum"><span className="card p-2 text-center">Bar × 10</span>{ramp.map((r) => <span key={r.pct} className="card p-2 text-center">{fmtLoad(r.kg, units, false)} × {r.reps}</span>)}</div>
            <span className="text-xs text-smoke">Rest 60–90 s between ramp sets. The last single should feel crisp, not heavy.</span>
          </div>
        </motion.div>
      )}</AnimatePresence>
      <AnimatePresence>{plates && top.loadKg && (
        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-b border-line">
          <PlateCalc loadKg={top.loadKg} units={units} />
        </motion.div>
      )}</AnimatePresence>

      <ul className="grid">
        {ex.sets.map((set, i) => <SetRow key={`${i}-${set.loadKg ?? ""}-${set.reps ?? ""}-${set.seconds ?? ""}`} i={i} set={set} logged={logged.find((l) => l.setIndex === i)} units={units} disabled={disabled || (i > 0 && !logged.find((l) => l.setIndex === i - 1))} timed={!!set.seconds} loadable={meta.loadable} onLog={(v) => onLog(i, v)} />)}
      </ul>
      <div className="p-4 border-t border-line">
        <div className="grid gap-1.5 min-w-0">
          <span className="text-xs"><span className="text-danger font-medium">{meta.primary.join(", ")}</span>{meta.secondary.length ? <span className="text-smoke"> · {meta.secondary.join(", ")}</span> : null}</span>
        <button type="button" className="text-left text-xs text-smoke underline" onClick={() => setShowWhy(!showWhy)}>Why this?</button>
        <AnimatePresence>{showWhy && <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="text-sm overflow-hidden">{ex.why}</motion.p>}</AnimatePresence>
        <p className="text-xs text-smoke">{meta.cues[0]}</p>
        </div>
      </div>
    </div>
  );
}

function PlateCalc({ loadKg, units }: { loadKg: number; units: UnitPrefs }) {
  const p = platesFor(loadKg, units);
  return (
    <div className="px-4 py-3 grid gap-2 text-sm">
      <span className="meta">{fmtLoad(loadKg, units)} · {p.bar} · per side</span>
      {p.short ? <span className="text-xs text-smoke">Lighter than the bar — use dumbbells or a lighter bar.</span> : (
        <div className="flex items-end gap-1 h-14">
          {p.perSide.map((pl, i) => <span key={i} className="rounded-sm bg-ink text-bone text-[10px] font-bold grid place-items-end pb-0.5 justify-items-center" style={{ width: 22, height: `${40 + Math.min(60, Number(pl) * 2)}%`, opacity: 1 - i * 0.08 }}>{pl}</span>)}
          {p.perSide.length === 0 && <span className="text-xs text-smoke">Empty bar.</span>}
        </div>
      )}
    </div>
  );
}

function SetRow({ i, set, logged, units, disabled, timed, loadable, onLog }: { i: number; set: PrescribedSet; logged?: LoggedSet; units: UnitPrefs; disabled: boolean; timed: boolean; loadable: boolean; onLog: (v: { reps?: number; seconds?: number; loadKg?: number; rpe?: number }) => void }) {
  const toUnit = (kg?: number) => (kg == null ? 0 : units.weight === "lb" ? Math.round(kgToLb(kg)) : Math.round(kg * 2) / 2);
  const step = units.weight === "lb" ? 5 : 2.5;
  const [load, setLoad] = useState<number>(toUnit(set.loadKg));
  const [reps, setReps] = useState<number>(set.reps ?? set.seconds ?? 0);
  const [rpe, setRpe] = useState<number | null>(null);

  if (logged) {
    return (
      <motion.li initial={{ backgroundColor: "rgba(31,199,111,.18)" }} animate={{ backgroundColor: "rgba(31,199,111,0)" }} transition={{ duration: 1.2 }} className="grid grid-cols-[28px_1fr_auto_auto] items-center gap-3 text-sm px-4 py-3 border-b border-line">
        <span className="meta">{i + 1}</span>
        <span className="tnum">{logged.seconds ? `${logged.seconds}s` : `${logged.reps} reps`}{logged.loadKg ? ` · ${fmtLoad(logged.loadKg, units)}` : ""}{logged.adjusted && <span className="block text-[11px] text-volt">next set adjusted</span>}</span>
        <span className={`chip chip--rpe rpe-${logged.rpe ?? 6}`} aria-pressed={logged.rpe != null}>RPE {logged.rpe ?? "—"}</span>
        <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 18 }} className="w-4 h-4 rounded-full bg-volt" aria-label="logged" />
      </motion.li>
    );
  }
  const commit = () => {
    const v: { reps?: number; seconds?: number; loadKg?: number; rpe?: number } = { rpe: rpe ?? undefined };
    if (timed) v.seconds = reps || set.seconds; else v.reps = reps || set.reps;
    if (loadable && load > 0) v.loadKg = units.weight === "lb" ? lbToKg(load) : load;
    onLog(v);
  };
  return (
    <li className={`grid gap-3 px-4 py-4 border-b border-line transition-opacity ${disabled ? "opacity-35" : ""}`}>
      <div className="flex items-center gap-2.5">
        <span className="w-7 h-7 rounded-full bg-ink text-bone grid place-items-center text-xs font-semibold tnum shrink-0">{i + 1}</span>
        <span className="text-sm font-medium">Set {i + 1}</span>
        <span className="text-xs text-smoke tnum ml-auto">{[loadable ? (set.pct ? `${Math.round(set.pct * 100)}% of max` : null) : "bodyweight", set.rpe ? `target RPE ${set.rpe}` : null].filter(Boolean).join(" · ")}</span>
      </div>
      <div className={`grid gap-2 ${loadable ? "grid-cols-2" : ""}`}>
        {loadable && <Stepper disabled={disabled} value={load} onChange={setLoad} delta={step} label={units.weight} />}
        <Stepper disabled={disabled} value={reps} onChange={setReps} delta={timed ? 5 : 1} label={timed ? "seconds" : "reps"} />
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="meta mr-1">RPE</span>
        {[6, 7, 8, 9, 10].map((n) => <button key={n} type="button" disabled={disabled} aria-pressed={rpe === n} onClick={() => setRpe(n)} className={`chip chip--rpe rpe-${n}`}>{n}</button>)}
        <Press className="ml-auto"><button type="button" className="pill pill--sm pill--bone" disabled={disabled} onClick={commit}>Log set</button></Press>
      </div>
    </li>
  );
}

function Stepper({ value, onChange, delta, label, hint, disabled }: { value: number; onChange: (v: number) => void; delta: number; label: string; hint?: string; disabled: boolean }) {
  return (
    <div className="grid gap-1">
      <span className="meta">{label}{hint ? ` · ${hint}` : ""}</span>
      <div className="flex items-stretch gap-1">
        <button type="button" disabled={disabled} className="w-11 rounded-l-xl bg-graphite border border-line text-lg" onClick={() => onChange(Math.max(0, Math.round((value - delta) * 100) / 100))} aria-label={`minus ${delta}`}>−</button>
        <input className="input tnum text-center !rounded-none !px-1 flex-1 min-w-0 text-lg" inputMode="decimal" value={value} onChange={(e) => onChange(Number(e.target.value) || 0)} disabled={disabled} />
        <button type="button" disabled={disabled} className="w-11 rounded-r-xl bg-graphite border border-line text-lg" onClick={() => onChange(Math.round((value + delta) * 100) / 100)} aria-label={`plus ${delta}`}>+</button>
      </div>
    </div>
  );
}
