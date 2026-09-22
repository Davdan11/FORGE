"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { rankFor, subRankFor, tierForLevel, xpForLevel } from "@/lib/gamification";
import { RankEmblem } from "./RankEmblem";
import { LEVEL_UP_EVENT } from "@/lib/progress";

/* ─────────────────────────────────────────────────────────────
   Levelling up is the one moment the app gets to say well done.

   It listens for an event the award path fires, so it works
   wherever the XP came from — a session, a route, a meal — and
   nothing has to poll or remember which level it last saw.
   ───────────────────────────────────────────────────────────── */

const RAYS = Array.from({ length: 12 }, (_, i) => i * 30);

export function LevelUpWatcher() {
  const [level, setLevel] = useState<number | null>(null);

  useEffect(() => {
    const onLevelUp = (e: Event) => {
      setLevel((e as CustomEvent<number>).detail);
      navigator.vibrate?.([30, 60, 120]);
    };
    window.addEventListener(LEVEL_UP_EVENT, onLevelUp);
    return () => window.removeEventListener(LEVEL_UP_EVENT, onLevelUp);
  }, []);

  return <AnimatePresence>{level != null && <LevelUpCard level={level} onClose={() => setLevel(null)} />}</AnimatePresence>;
}

export function LevelUpCard({ level, onClose }: { level: number; onClose: () => void }) {
  const reduce = useReducedMotion();
  const need = xpForLevel(level);

  // Dismiss on Escape as well as the button — this covers the whole screen.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <motion.div
      role="dialog" aria-modal="true" aria-label={`Level ${level} reached`}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}
      className="fixed inset-0 z-[60] grid place-items-center px-6 text-bone"
      style={{ background: "radial-gradient(120% 90% at 50% 40%, rgba(31,199,111,.22), rgba(8,9,10,.97) 62%), #08090a" }}
      onClick={onClose}
    >
      <div className="relative grid justify-items-center text-center" onClick={(e) => e.stopPropagation()}>
        {/* Rays fire outward once, then hold — a burst, not a loop. */}
        {!reduce && RAYS.map((deg, i) => (
          <motion.span key={deg} aria-hidden="true"
            initial={{ scaleY: 0, opacity: 0 }}
            animate={{ scaleY: 1, opacity: [0, 0.9, 0] }}
            transition={{ duration: 1.1, delay: 0.12 + i * 0.02, ease: [0.16, 1, 0.3, 1] }}
            className="absolute left-1/2 top-[86px] h-[190px] w-px origin-top bg-gradient-to-b from-volt to-transparent"
            style={{ rotate: `${deg}deg`, translate: "-50% 0" }} />
        ))}

        <motion.p initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="eyebrow mb-6">Level up</motion.p>

        <motion.div initial={reduce ? false : { scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }} className="relative">
          <RankEmblem tier={tierForLevel(level)} sub={subRankFor(level)} size={190} />
        </motion.div>

        <motion.p initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, duration: 0.6 }}
          className="display text-3xl mt-8">You are <em>{rankFor(level)}.</em></motion.p>

        <motion.p initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
          className="text-sm text-smoke mt-3 max-w-[34ch] tnum">
          {need.toLocaleString("en-US")} XP to level {level + 1}. Every set, route and honest check-in counts toward it.
        </motion.p>

        <motion.button type="button" onClick={onClose}
          initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.65 }}
          className="pill pill--volt pill--lg mt-9">Keep going</motion.button>
      </div>
    </motion.div>
  );
}
