"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

/* ─────────────────────────────────────────────────────────────
   Three seconds between pressing start and the first GPS point.

   It is not decoration: it is the beat that turns "the app is
   recording" into "I am starting". It also gives the receiver a
   moment to settle before the first fix is taken seriously, and
   gives the athlete time to put the phone away.
   ───────────────────────────────────────────────────────────── */

export function StartCountdown({ label, onDone }: { label: string; onDone: () => void }) {
  const reduce = useReducedMotion();
  const [n, setN] = useState(3);

  useEffect(() => {
    // Reduced motion still gets the countdown, just without the scaling.
    navigator.vibrate?.(40);
    const tick = setInterval(() => setN((v) => v - 1), 700);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    if (n > 0) { navigator.vibrate?.(40); return; }
    navigator.vibrate?.([80, 60, 160]);
    const t = setTimeout(onDone, 560);
    return () => clearTimeout(t);
  }, [n, onDone]);

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}
      className="fixed inset-0 z-[60] grid place-items-center text-bone"
      style={{ background: "#08090a" }}
      role="status" aria-live="assertive" aria-label={n > 0 ? `Starting in ${n}` : `Go — ${label} started`}
    >
      <div className="grid justify-items-center text-center">
        <p className="eyebrow mb-8">{label}</p>
        <AnimatePresence mode="wait">
          <motion.p
            key={n}
            initial={reduce ? { opacity: 0 } : { scale: 0.45, opacity: 0 }}
            animate={reduce ? { opacity: 1 } : { scale: 1, opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { scale: 1.5, opacity: 0 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className={n > 0 ? "numeral text-bone" : "display text-volt"}
            style={n > 0 ? { fontSize: "clamp(7rem, 34vw, 13rem)" } : { fontSize: "clamp(4.5rem, 22vw, 9rem)", letterSpacing: "-0.04em" }}
          >
            {n > 0 ? n : "GO"}
          </motion.p>
        </AnimatePresence>

        {/* A ring that empties as the count runs down. */}
        {!reduce && (
          <motion.span aria-hidden="true" className="mt-10 block h-[3px] w-[180px] rounded-full bg-[rgba(246,243,236,.22)] overflow-hidden">
            <motion.i className="block h-full bg-volt" initial={{ width: "100%" }} animate={{ width: "0%" }} transition={{ duration: 2.1, ease: "linear" }} />
          </motion.span>
        )}
      </div>
    </motion.div>
  );
}
