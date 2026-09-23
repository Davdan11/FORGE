"use client";

import { useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { getStats } from "@/lib/db";
import { AnimatePresence, motion } from "@/components/motion";

/*
 * Every XP gain, made visible: a lime "+60 XP" that pops up above the tab bar,
 * throws a few sparks and floats away. It watches the stats row rather than
 * each award function, so every source of XP — sessions, activities,
 * check-ins, meals, challenges, indoor — gets it without being wired in.
 *
 * Only gains made on this device count: rows written by a sync pull are clean
 * (dirty 0), so restoring an account on a new phone does not fire a burst of
 * ten thousand.
 */
type Burst = { id: number; xp: number };

export function XpBurst() {
  const stats = useLiveQuery(() => getStats(), []);
  const last = useRef<number | null>(null);
  const [bursts, setBursts] = useState<Burst[]>([]);

  useEffect(() => {
    if (!stats) return;
    const xp = stats.xp;
    const prev = last.current;
    last.current = xp;
    if (prev == null || xp <= prev || (stats as { dirty?: number }).dirty !== 1) return;
    const b = { id: Date.now(), xp: xp - prev };
    navigator.vibrate?.([12, 40, 18]);
    // Set from the subscription's callback, not the effect body: the burst is
    // an event, and it clears itself after it has played.
    queueMicrotask(() => setBursts((cur) => [...cur, b]));
    // Not cleared on the next change: two awards in a row must both play out.
    setTimeout(() => setBursts((cur) => cur.filter((x) => x.id !== b.id)), 1800);
  }, [stats]);

  return (
    <div aria-live="polite" className="fixed inset-x-0 bottom-[calc(var(--safe-bottom)+96px)] z-[65] grid justify-items-center pointer-events-none lg:bottom-10">
      <AnimatePresence>
        {bursts.map((b) => (
          <motion.div key={b.id} className="relative col-start-1 row-start-1"
            initial={{ opacity: 0, y: 16, scale: 0.6 }}
            animate={{ opacity: [0, 1, 1, 0], y: [16, 0, -8, -70], scale: [0.6, 1.12, 1, 0.96] }}
            transition={{ duration: 1.7, times: [0, 0.18, 0.62, 1], ease: "easeOut" }}>
            {Array.from({ length: 8 }, (_, i) => {
              const a = (i / 8) * Math.PI * 2;
              return (
                <motion.span key={i} className="absolute left-1/2 top-1/2 w-2 h-2 -ml-1 -mt-1 rounded-full bg-volt"
                  initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                  animate={{ x: Math.cos(a) * 58, y: Math.sin(a) * 34, opacity: 0, scale: 0.4 }}
                  transition={{ duration: 0.75, ease: "easeOut", delay: 0.08 }} />
              );
            })}
            <span className="relative inline-flex items-center gap-2 px-4 h-11 rounded-2xl bg-volt text-ink font-extrabold tnum shadow-[var(--e4)]" style={{ fontStretch: "125%" }}>
              +{b.xp.toLocaleString("en-US")} <span className="font-[family-name:var(--font-mono)] text-xs font-bold tracking-[.14em]">XP</span>
            </span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
