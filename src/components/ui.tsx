"use client";

import Link from "next/link";
import { useId, useRef, useState, type ReactNode } from "react";
import { motion, AnimatePresence, CountUp } from "./motion";
import { useScroll, useTransform, useReducedMotion } from "motion/react";

export function Screen({ children, className = "" }: { children?: ReactNode; className?: string }) {
  return <div className={`flex-1 w-full max-w-[560px] lg:max-w-[1200px] mx-auto px-5 lg:px-10 pb-nav pt-[calc(var(--safe-top)+16px)] lg:pt-8 ${className}`}>{children}</div>;
}

/** Remote photo with fade-in once loaded. */
export function Photo({ src, alt = "", className = "", veil, soft, color, kb, style }: { src: string; alt?: string; className?: string; veil?: boolean; soft?: boolean; color?: boolean; kb?: boolean; style?: React.CSSProperties }) {
  const [loaded, setLoaded] = useState(false);
  const pos = /\b(absolute|fixed)\b/.test(className) ? "" : "relative";
  return (
    <div className={`photo ${veil ? "photo--veil" : ""} ${color ? "photo--color" : ""} ${kb ? "photo--kb" : ""} ${pos} ${className}`} style={style}>
      <img src={src} alt={alt} loading="lazy" decoding="async" data-loaded={loaded} onLoad={() => setLoaded(true)} onError={() => setLoaded(true)}
        ref={(el) => { if (el && el.complete && el.naturalWidth > 0 && !loaded) setLoaded(true); }} />
      {veil && <div className={`photo__veil ${soft ? "photo__veil--soft" : ""}`} />}
    </div>
  );
}

/** Full-bleed photo header: parallax on scroll, title rises from a mask. */
export function Hero({ image, eyebrow, title, right, back, height = "h-[300px]", color, children }: { image: string; eyebrow?: ReactNode; title: ReactNode; right?: ReactNode; back?: string; height?: string; color?: boolean; children?: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollY } = useScroll();
  const y = useTransform(scrollY, [0, 400], [0, reduce ? 0 : 120]);
  const fade = useTransform(scrollY, [0, 260], [1, reduce ? 1 : 0.25]);
  return (
    <header ref={ref} className={`on-photo relative overflow-hidden -mx-5 -mt-[calc(var(--safe-top)+16px)] lg:mx-0 lg:mt-0 lg:rounded-[28px] lg:border lg:border-line ${height} lg:min-h-[420px] mb-6 lg:mb-8`}>
      <motion.div style={{ y }} className="absolute inset-0 scale-[1.06]"><Photo src={image} className="absolute inset-0" veil color={color} /></motion.div>
      <div className="absolute inset-x-0 top-0 pt-[calc(var(--safe-top)+16px)] lg:pt-6 px-5 lg:px-8 flex justify-between items-start">
        {back ? <Link href={back} className="chip chip--live backdrop-blur-md">← Back</Link> : <span />}
        {right}
      </div>
      <motion.div style={{ opacity: fade }} className="absolute inset-x-0 bottom-0 px-5 pb-5 lg:px-8 lg:pb-8">
        {eyebrow && <motion.p initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.05 }} className="meta text-bone/80 mb-2">{eyebrow}</motion.p>}
        <div className="overflow-hidden pb-[.08em] -mb-[.08em]">
          <motion.h1 initial={reduce ? false : { y: "105%" }} animate={{ y: 0 }} transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }} className="display text-[2.4rem] lg:text-[4.2rem] leading-[0.92]">{title}</motion.h1>
        </div>
        {children && <motion.div initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.25 }}>{children}</motion.div>}
      </motion.div>
    </header>
  );
}

export function TopBar({ title, eyebrow, right, back }: { title: ReactNode; eyebrow?: string; right?: ReactNode; back?: string }) {
  return (
    <header className="flex items-end justify-between gap-4 mb-6">
      <div className="min-w-0">
        {back && <Link href={back} className="meta inline-flex items-center gap-1 mb-2 text-ink min-h-11">← Back</Link>}
        {eyebrow && !back && <p className="meta mb-2">{eyebrow}</p>}
        <h1 className="display text-[2.2rem] leading-[0.92]">{title}</h1>
      </div>
      {right}
    </header>
  );
}

export function Section({ title, aside, children, className = "" }: { title?: ReactNode; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`mb-8 min-w-0 ${className}`}>
      {(title || aside) && (
        <div className="grid gap-2 mb-3">
          <div className="flex items-baseline justify-between gap-3">
            {title && <h2 className="meta text-ink">{title}</h2>}
            {aside}
          </div>
          <div className="section-rule" />
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, sub, accent, count, decimals = 0, suffix = "" }: { label: string; value?: ReactNode; sub?: string; accent?: boolean; count?: number; decimals?: number; suffix?: string }) {
  return (
    <div className="card p-4 grid gap-1">
      <span className="meta">{label}</span>
      <strong className={`display text-3xl tnum ${accent ? "text-volt" : ""}`}>{count != null ? <CountUp value={count} decimals={decimals} suffix={suffix} /> : value}</strong>
      {sub && <span className="text-xs text-smoke">{sub}</span>}
    </div>
  );
}

export function Bar({ value, max = 100, color }: { value: number; max?: number; color?: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="bar">
      <motion.i initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }} style={color ? { background: color, boxShadow: "none" } : undefined} />
    </div>
  );
}

export function Empty({ title, body, cta, href, image }: { title: string; body: string; cta?: string; href?: string; image?: string }) {
  return (
    <div className="card--photo">
      {image && <Photo src={image} veil soft className="h-56" />}
      <div className="card__body p-5 grid gap-3">
        <p className="display text-2xl">{title}</p>
        <p className="text-sm text-smoke max-w-[40ch]">{body}</p>
        {cta && href && <Link href={href} className="pill pill--volt pill--sm justify-self-start">{cta}</Link>}
      </div>
    </div>
  );
}

export function Toast({ text }: { text: string | null }) {
  return (
    <AnimatePresence>
      {text && (
        <motion.div key={text} initial={{ opacity: 0, y: 16, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8 }} transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="fixed left-1/2 -translate-x-1/2 bottom-[calc(var(--safe-bottom)+92px)] z-50">
          <div className="bg-ink text-bone text-sm font-medium px-4 py-3 rounded-full shadow-[0_20px_40px_-16px_rgba(0,0,0,.5)] max-w-[90vw]">{text}</div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Segmented control with a sliding indicator. */
export function Seg<T extends string | number>({ value, options, onChange }: { value: T; options: { v: T; label: string }[]; onChange: (v: T) => void }) {
  const group = useId();
  return (
    <div className="seg" role="group">
      {options.map((o) => {
        const on = value === o.v;
        return (
          <button key={String(o.v)} type="button" aria-pressed={on} onClick={() => onChange(o.v)}>
            {on && <motion.span layoutId={`seg-${group}`} className="seg__ind" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
            <span className="seg__label">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function MultiSeg<T extends string>({ value, options, onChange }: { value: T[]; options: { v: T; label: string }[]; onChange: (v: T[]) => void }) {
  const toggle = (v: T) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  return (
    <div className="seg seg--multi" role="group">
      {options.map((o) => <button key={o.v} type="button" aria-pressed={value.includes(o.v)} onClick={() => toggle(o.v)}><span className="seg__label">{o.label}</span></button>)}
    </div>
  );
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} className="toggle" onClick={() => onChange(!on)}>
      <motion.i animate={{ x: on ? 20 : 0 }} transition={{ type: "spring", stiffness: 500, damping: 30 }} />
    </button>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

export function ScreenSkeleton() {
  return (
    <Screen>
      <Skeleton className="h-8 w-40 mb-3" />
      <Skeleton className="h-64 mb-4" />
      <Skeleton className="h-24 mb-3" />
      <Skeleton className="h-24" />
    </Screen>
  );
}

export function Check({ on, onToggle, label }: { on: boolean; onToggle: () => void; label?: string }) {
  return (
    <button type="button" role="checkbox" aria-checked={on} aria-label={label} onClick={onToggle} className="check">
      <svg viewBox="0 0 24 24"><path d="M5 12.5 10 17l9-10" /></svg>
    </button>
  );
}
