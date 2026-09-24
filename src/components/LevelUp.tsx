"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { rankFor, subRankFor, tierForLevel, xpForLevel } from "@/lib/gamification";
import { locale, useLang, useT } from "@/lib/i18n";
import { RankEmblem } from "./RankEmblem";
import { LEVEL_UP_EVENT } from "@/lib/progress";

/* ─────────────────────────────────────────────────────────────
   Levelling up is the one moment the app gets to say well done.

   It listens for an event the award path fires, so it works
   wherever the XP came from — a session, a route, a meal — and
   nothing has to poll or remember which level it last saw.

   The moment, in order: the old level number rolls over to the
   new one, the rank badge slams in and the screen jolts, two
   shockwave rings go out, confetti falls. Solid colours only —
   lime, white, a little ink — no gradients.
   ───────────────────────────────────────────────────────────── */

export function LevelUpWatcher() {
  const [level, setLevel] = useState<number | null>(null);

  useEffect(() => {
    const onLevelUp = (e: Event) => {
      setLevel((e as CustomEvent<number>).detail);
      navigator.vibrate?.([30, 60, 120, 40, 200]);
    };
    window.addEventListener(LEVEL_UP_EVENT, onLevelUp);
    return () => window.removeEventListener(LEVEL_UP_EVENT, onLevelUp);
  }, []);

  return <AnimatePresence>{level != null && <LevelUpCard level={level} onClose={() => setLevel(null)} />}</AnimatePresence>;
}

const COLORS = ["#c6f432", "#c6f432", "#ffffff", "#1fc76f", "#c6f432", "#f6f3ec"];

export function LevelUpCard({ level, onClose }: { level: number; onClose: () => void }) {
  const reduce = useReducedMotion();
  const t = useT();
  const lang = useLang();
  const need = xpForLevel(level);

  // The level number rolls from the previous one to the new one.
  const n = useMotionValue(Math.max(1, level - 1));
  const shown = useTransform(n, (v) => String(Math.round(v)).padStart(2, "0"));
  useEffect(() => {
    if (reduce) { n.set(level); return; }
    const c = animate(n, level, { duration: 0.9, delay: 0.35, ease: [0.16, 1, 0.3, 1] });
    return () => c.stop();
  }, [level, n, reduce]);

  // Confetti: fixed per open, so a re-render does not reshuffle it mid-fall.
  const bits = useMemo(() => Array.from({ length: 44 }, (_, i) => {
    const r = (k: number) => { const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x); };
    return { left: r(1) * 100, delay: 0.55 + r(2) * 0.5, dur: 2.2 + r(3) * 1.6, drift: (r(4) - 0.5) * 140, spin: (r(5) - 0.5) * 900, w: 6 + r(6) * 6, h: 10 + r(7) * 10, color: COLORS[i % COLORS.length], round: r(8) > 0.7 };
  }), []);

  // Dismiss on Escape as well as the button — this covers the whole screen.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <motion.div
      role="dialog" aria-modal="true" aria-label={t(`Niveau ${level} atteint`, `Level ${level} reached`)}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}
      className="on-photo fixed inset-0 z-[60] grid place-items-center px-6 text-bone overflow-hidden"
      style={{ background: "#08090a" }}
      onClick={onClose}
    >
      {/* Confetti */}
      {!reduce && bits.map((b, i) => (
        <motion.span key={i} aria-hidden="true" className="absolute top-0"
          style={{ left: `${b.left}%`, width: b.w, height: b.round ? b.w : b.h, background: b.color, borderRadius: b.round ? 999 : 2 }}
          initial={{ y: -40, x: 0, rotate: 0, opacity: 1 }}
          animate={{ y: "110vh", x: b.drift, rotate: b.spin, opacity: [1, 1, 0.9, 0] }}
          transition={{ duration: b.dur, delay: b.delay, ease: [0.3, 0.1, 0.4, 1] }} />
      ))}

      {/* The jolt: the whole card kicks once as the badge lands. */}
      <motion.div className="relative grid justify-items-center text-center" onClick={(e) => e.stopPropagation()}
        animate={reduce ? undefined : { x: [0, -8, 7, -5, 3, 0], y: [0, 4, -3, 2, 0, 0] }}
        transition={{ duration: 0.45, delay: 0.62 }}>

        <motion.p initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="eyebrow mb-2">{t("Niveau supérieur", "Level up")}</motion.p>

        <motion.span initial={reduce ? false : { opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }}
          className="numeral !text-[6.5rem] leading-none tnum" style={{ color: "#c6f432" }}>{shown}</motion.span>

        <div className="relative mt-4 grid place-items-center">
          {/* Shockwaves */}
          {!reduce && [0, 1].map((k) => (
            <motion.span key={k} aria-hidden="true" className="absolute rounded-full border-[3px]"
              style={{ width: 170, height: 170, borderColor: "#c6f432" }}
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: [0.4, 2.6], opacity: [0, 0.9, 0] }}
              transition={{ duration: 1.1, delay: 0.62 + k * 0.18, ease: "easeOut" }} />
          ))}
          <motion.div initial={reduce ? false : { scale: 2.2, opacity: 0, rotate: -12 }} animate={{ scale: 1, opacity: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 14, delay: 0.45 }} className="relative">
            <RankEmblem tier={tierForLevel(level)} sub={subRankFor(level)} size={170} />
          </motion.div>
        </div>

        <motion.p initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.95, duration: 0.5 }}
          className="display text-3xl mt-7">{t("Tu es", "You are")} <em>{rankFor(level, lang)}.</em></motion.p>

        <motion.p initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.1 }}
          className="text-sm text-smoke mt-3 max-w-[34ch] tnum">
          {t(
            `${need.toLocaleString(locale())} XP jusqu’au niveau ${level + 1}. Chaque série, chaque parcours et chaque check-in honnête compte.`,
            `${need.toLocaleString("en-US")} XP to level ${level + 1}. Every set, route and honest check-in counts toward it.`,
          )}
        </motion.p>

        <motion.button type="button" onClick={onClose}
          initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.25 }}
          className="pill pill--volt pill--lg mt-8">{t("On continue", "Keep going")}</motion.button>
      </motion.div>
    </motion.div>
  );
}
