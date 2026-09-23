"use client";

import { motion, useReducedMotion, animate, useInView, AnimatePresence } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";

const EASE = [0.16, 1, 0.3, 1] as const;

/** Page-level wrapper: fades/rises the screen in. */
export function Page({ children, className = "" }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div initial={reduce ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, ease: EASE }} className={className}>
      {children}
    </motion.div>
  );
}

/** Staggers direct children. */
export function Stagger({ children, className = "", delay = 0.06 }: { children: ReactNode; className?: string; delay?: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.div className={className} initial={reduce ? false : "hidden"} animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: delay, delayChildren: 0.05 } } }}>
      {children}
    </motion.div>
  );
}
export function Item({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <motion.div className={className} variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } } }}>
      {children}
    </motion.div>
  );
}

/** Reveals when scrolled into view. */
export function Reveal({ children, className = "", delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10% 0px" });
  const reduce = useReducedMotion();
  return (
    <motion.div ref={ref} className={className} initial={reduce ? false : { opacity: 0, y: 18 }} animate={inView ? { opacity: 1, y: 0 } : undefined} transition={{ duration: 0.6, ease: EASE, delay }}>
      {children}
    </motion.div>
  );
}

/** Animated number. */
export function CountUp({ value, decimals = 0, suffix = "", prefix = "", duration = 1.2, className = "" }: { value: number; decimals?: number; suffix?: string; prefix?: string; duration?: number; className?: string }) {
  const [v, setV] = useState(0);
  const reduce = useReducedMotion();
  useEffect(() => {
    if (reduce) return;
    const c = animate(0, value, { duration, ease: [0.22, 1, 0.36, 1], onUpdate: (x) => setV(x) });
    return () => c.stop();
  }, [value, duration, reduce]);
  const shown = reduce ? value : v;
  return <span className={`tnum ${className}`}>{prefix}{shown.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}{suffix}</span>;
}

/** Circular progress ring (0–1). */
/** A progress ring. `color="grad"` draws it in the solid accent green. */
export function Ring({ value, size = 120, stroke = 8, children, color = "var(--volt)" }: { value: number; size?: number; stroke?: number; children?: ReactNode; color?: string }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const reduce = useReducedMotion();
  const grad = color === "grad";
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={stroke} />
        <motion.circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={grad ? "var(--green)" : color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c}
          initial={reduce ? false : { strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - Math.max(0, Math.min(1, value))) }} transition={{ duration: 1.1, ease: EASE }} />
      </svg>
      <div className="absolute inset-0 grid place-content-center text-center">{children}</div>
    </div>
  );
}

/** Press feedback for tappable cards. */
export function Press({ children, className = "", haptic = true }: { children: ReactNode; className?: string; haptic?: boolean }) {
  return (
    <motion.div whileTap={{ scale: 0.98 }} transition={{ type: "spring", stiffness: 600, damping: 30 }} className={className}
      onPointerDown={() => { if (haptic && typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(8); }}>
      {children}
    </motion.div>
  );
}

export { AnimatePresence, motion };
