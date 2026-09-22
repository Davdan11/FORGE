"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { motion, AnimatePresence, CountUp } from "./motion";
import { useScroll, useTransform, useReducedMotion } from "motion/react";

/* ─────────────────────────────────────────────────────────────
   Horizontal rail.

   A row of chips wider than its box gets clipped, and a word
   sliced down the middle reads as a broken layout — not as
   "there is more this way". So the rail fades the edge it can
   actually scroll toward, and only that edge: a fade on the left
   when you are already at the start is a lie about the content.

   It also keeps the selected chip in view, because a picker whose
   current value sits off-screen is a picker you cannot read.
   ───────────────────────────────────────────────────────────── */
type Edge = "none" | "start" | "end" | "both";

export function Rail({ children, className = "", active, gutter }: {
  children: ReactNode;
  className?: string;
  /** Changing this scrolls the element marked aria-pressed / aria-selected back into view. */
  active?: string | number;
  /** Bleed to the screen edges so the clip lands on the viewport, not mid-card. */
  gutter?: boolean;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [edge, setEdge] = useState<Edge>("none");

  const measure = useCallback((el: HTMLElement) => {
    const max = el.scrollWidth - el.clientWidth;
    // Sub-pixel layout means scrollLeft rarely lands exactly on 0 or max.
    if (max <= 2) return setEdge("none");
    const x = el.scrollLeft;
    setEdge(x <= 2 ? "end" : x >= max - 2 ? "start" : "both");
  }, []);

  // A ref callback rather than an effect: it runs once the node has its real
  // size, and it is allowed to set state. React 19 runs the returned cleanup
  // when the node goes away.
  const attach = useCallback((el: HTMLDivElement | null) => {
    ref.current = el;
    if (!el) return;
    measure(el);
    const ro = new ResizeObserver(() => measure(el));
    ro.observe(el);
    for (const child of Array.from(el.children)) ro.observe(child);
    return () => ro.disconnect();
  }, [measure]);

  useEffect(() => {
    const on = ref.current?.querySelector<HTMLElement>('[aria-pressed="true"],[aria-selected="true"]');
    on?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  }, [active]);

  return (
    <div ref={attach} data-edge={edge} onScroll={(e) => measure(e.currentTarget)}
      className={`rail ${gutter ? "rail--gutter" : ""} ${className}`}>
      {children}
    </div>
  );
}

export function Screen({ children, className = "" }: { children?: ReactNode; className?: string }) {
  return <div className={`screen flex-1 pb-nav pt-[calc(var(--safe-top)+16px)] lg:pt-10 ${className}`}>{children}</div>;
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
export function Hero({ image, eyebrow, title, right, back, height = "h-[300px]", color, stats, children }: { image: string; eyebrow?: ReactNode; title: ReactNode; right?: ReactNode; back?: string; height?: string; color?: boolean; stats?: { label: string; value: ReactNode }[]; children?: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollY } = useScroll();
  const y = useTransform(scrollY, [0, 400], [0, reduce ? 0 : 120]);
  const fade = useTransform(scrollY, [0, 260], [1, reduce ? 1 : 0.25]);
  return (
    <header ref={ref} className={`on-photo bleed relative overflow-hidden -mt-[calc(var(--safe-top)+16px)] lg:-mt-10 ${height} lg:h-auto lg:min-h-[78vh] mb-8 lg:mb-[var(--stack-section)]`}>
      <motion.div style={{ y }} className="absolute inset-0 scale-[1.06]">
        <Photo src={image} className="absolute inset-0" color={color} />
        <div className="photo__veil photo__veil--hero" />
      </motion.div>
      <div className="absolute inset-x-0 top-0 pt-[calc(var(--safe-top)+16px)] lg:pt-8">
        <div className="screen flex justify-between items-start">
          {back ? <Link href={back} className="chip chip--live backdrop-blur-md">← Back</Link> : <span />}
          {right}
        </div>
      </div>
      <motion.div style={{ opacity: fade }} className="absolute inset-x-0 bottom-0 pb-7 lg:pb-14">
        <div className="screen">
          {eyebrow && <motion.p initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.05 }} className="eyebrow mb-5">{eyebrow}</motion.p>}
          <div className="overflow-hidden pb-[.14em] -mb-[.14em]">
            <motion.h1 initial={reduce ? false : { y: "115%" }} animate={{ y: 0 }} transition={{ duration: 1.15, ease: [0.16, 1, 0.3, 1] }} className="display display--xl leading-[0.9] max-w-[14ch]" style={{ fontSize: "var(--text-display-xl)" }}>{title}</motion.h1>
          </div>
          {children && <motion.div initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.35 }} className="mt-6">{children}</motion.div>}
          {stats && stats.length > 0 && (
            <motion.dl initial={reduce ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.5 }}
              className="hidden lg:flex mt-12 border-t border-[rgba(246,243,236,.28)] pt-5 w-fit">
              {stats.map((s) => (
                <div key={s.label} className="flex flex-col px-8 first:pl-0 border-l border-[rgba(246,243,236,.18)] first:border-l-0">
                  <dd className="display leading-none tnum order-1" style={{ fontSize: "var(--text-display-md)" }}>{s.value}</dd>
                  <dt className="eyebrow order-2 mt-2.5 before:hidden">{s.label}</dt>
                </div>
              ))}
            </motion.dl>
          )}
        </div>
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
        <h1 className="display display--lg leading-[0.92]" style={{ fontSize: "var(--text-display-md)" }}>{title}</h1>
      </div>
      {right}
    </header>
  );
}

export function Section({ title, aside, children, className = "", space = "base" }: { title?: ReactNode; aside?: ReactNode; children: ReactNode; className?: string; space?: "tight" | "base" | "loose" }) {
  const gap = { tight: "var(--stack-tight)", base: "var(--stack)", loose: "var(--stack-loose)" }[space];
  return (
    <section className={`min-w-0 ${className}`} style={{ marginBottom: gap }}>
      {(title || aside) && (
        <div className="section-head">
          {title && <h2 className="meta text-ink shrink-0">{title}</h2>}
          <span className="section-head__rule" />
          {aside}
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
export function Seg<T extends string | number>({ value, options, onChange, fill, scroll }: { value: T; options: { v: T; label: string }[]; onChange: (v: T) => void; fill?: boolean; scroll?: boolean }) {
  const group = useId();
  return (
    <div className={`seg ${fill ? "seg--fill" : ""} ${scroll ? "seg--scroll" : ""}`} role="group">
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

/**
 * A 1–5 self-rating as five rising bars, named in words.
 *
 * A row of the digits 1 to 5 asks people to translate how they feel into a
 * number and says nothing back. Here the bars rise like a signal, the chosen
 * word is shown ("Light", "Great"), and the colour says whether that is good
 * news for today's session. `better` says which end is good: soreness and
 * stress are better low, sleep quality and mood better high.
 */
export function RatingScale<T extends 1 | 2 | 3 | 4 | 5>({ label, value, onChange, words, better }: {
  label: string; value: T; onChange: (v: T) => void;
  words: [string, string, string, string, string]; better: "high" | "low";
}) {
  const id = useId();
  const good = better === "high" ? (value - 1) / 4 : (5 - value) / 4;
  const tone = good >= 0.75 ? "var(--volt)" : good >= 0.5 ? "var(--ink)" : good >= 0.25 ? "#c9892b" : "var(--danger)";
  const text = good >= 0.75 ? "var(--volt-deep)" : good >= 0.5 ? "var(--ink)" : good >= 0.25 ? "#9a6414" : "var(--danger)";
  return (
    <div className="grid gap-2 min-w-0">
      <div className="flex items-baseline justify-between gap-3">
        <span className="meta" id={id}>{label}</span>
        <AnimatePresence mode="wait" initial={false}>
          <motion.span key={value} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.18 }}
            className="text-sm font-semibold" style={{ color: text }}>{words[value - 1]}</motion.span>
        </AnimatePresence>
      </div>
      <div role="radiogroup" aria-labelledby={id} className="grid grid-cols-5 gap-1.5">
        {([1, 2, 3, 4, 5] as T[]).map((n) => {
          const on = n <= value;
          return (
            <button key={n} type="button" role="radio" aria-checked={n === value} aria-label={words[n - 1]} onClick={() => onChange(n)}
              className="h-11 flex items-end rounded-xl focus-visible:outline-offset-1">
              <motion.span className="block w-full rounded-lg" initial={false}
                animate={{ height: 10 + n * 6, backgroundColor: on ? tone : "rgba(16,16,16,.08)" }}
                transition={{ type: "spring", stiffness: 420, damping: 32 }} />
            </button>
          );
        })}
      </div>
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
