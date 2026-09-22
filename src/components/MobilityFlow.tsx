"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { getExercise } from "@/lib/data/exercises";
import { awardMobility } from "@/lib/progress";
import { fmtDuration } from "@/lib/units";
import { MoveMedia } from "./MoveMedia";
import { Ring, CountUp, Press } from "./motion";

/* 12-minute guided mobility flow: six moves, two minutes each,
   side switch at halfway on unilateral moves, vibration on change. */
export const FLOW = ["90-90-hip-switch", "couch-stretch", "thoracic-rotation", "deep-squat-hold", "world-greatest-stretch", "hamstring-floss"];
const PER = 120;

export function MobilityFlow({ onClose }: { onClose: (xp: number | null) => void }) {
  const [i, setI] = useState(0);
  const [left, setLeft] = useState(PER);
  const [running, setRunning] = useState(true);
  const [done, setDone] = useState<number | null>(null);
  const ex = getExercise(FLOW[i])!;
  const half = ex.unilateral && left === PER / 2;

  useEffect(() => {
    if (!running || done != null) return;
    const t = setInterval(() => setLeft((l) => {
      if (l <= 1) {
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
        setI((k) => { if (k + 1 >= FLOW.length) { setRunning(false); awardMobility(FLOW.length * PER / 60).then(setDone); return k; } return k + 1; });
        return PER;
      }
      if (ex.unilateral && l === PER / 2 + 1 && navigator.vibrate) navigator.vibrate(120);
      return l - 1;
    }), 1000);
    return () => clearInterval(t);
  }, [running, done, ex.unilateral]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[70] bg-ink text-bone flex flex-col">
      <div className="flex items-center justify-between px-5 pt-[calc(var(--safe-top)+16px)] pb-3">
        <button type="button" className="chip chip--live" onClick={() => onClose(null)}>✕ Close</button>
        <span className="meta">Mobility · {i + 1} / {FLOW.length}</span>
        <span className="chip">{FLOW.length * 2} min</span>
      </div>
      <div className="px-5 flex gap-1">{FLOW.map((_, k) => <span key={k} className="flex-1 h-1 rounded-full" style={{ background: k < i ? "var(--volt)" : k === i ? `linear-gradient(90deg, var(--volt) ${((PER - left) / PER) * 100}%, var(--line) 0)` : "var(--line)" }} />)}</div>

      <AnimatePresence mode="wait">
        {done == null ? (
          <motion.div key={i} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }} className="flex-1 grid content-center justify-items-center gap-4 px-6 text-center">
            <div className="bg-[radial-gradient(60%_60%_at_50%_45%,rgba(212,255,58,.1),transparent_70%)] rounded-full"><MoveMedia ex={ex} size={260} label={false} /></div>
            <p className="meta">{ex.primary.join(" · ")}{ex.unilateral ? " · switch sides at 1:00" : ""}</p>
            <h2 className="display text-4xl">{ex.name}</h2>
            <p className="text-sm text-smoke max-w-[36ch]">{ex.cues[0]}</p>
            <Ring value={1 - left / PER} size={110} stroke={8} color={half ? "var(--bone)" : "var(--volt)"}><span className="display text-2xl tnum">{fmtDuration(left)}</span></Ring>
            <AnimatePresence>{half && <motion.span initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="chip chip--volt">Switch sides</motion.span>}</AnimatePresence>
          </motion.div>
        ) : (
          <motion.div key="done" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex-1 grid content-center justify-items-center gap-4 px-6 text-center">
            <p className="meta">Flow complete</p>
            <p className="numeral text-volt">+<CountUp value={done} /><span className="text-2xl"> XP</span></p>
            <p className="text-sm text-smoke max-w-[34ch]">Twelve minutes banked. Hips, shoulders and ankles will thank you at the next heavy session.</p>
            <Press><button type="button" className="pill pill--bone pill--lg" onClick={() => onClose(done)}>Back to today</button></Press>
          </motion.div>
        )}
      </AnimatePresence>

      {done == null && (
        <div className="flex gap-3 p-5 pb-[calc(var(--safe-bottom)+20px)]">
          <button type="button" className="pill flex-1" onClick={() => setRunning(!running)}>{running ? "Pause" : "Resume"}</button>
          <button type="button" className="pill pill--volt flex-1" onClick={() => { setLeft(1); setRunning(true); }}>Next move</button>
        </div>
      )}
    </motion.div>
  );
}
