"use client";

import { useId } from "react";
import type { Tier } from "@/lib/gamification";
import { rankArt, rankNeedsDimming } from "@/lib/data/art";

/* ─────────────────────────────────────────────────────────────
   The rank emblem.

   Depth comes from lighting a flat shape, not from a 3D engine:
   a rim that is darker at the bottom than the top, a face lit
   from the upper left, a specular sweep across the bevel, and a
   contact shadow underneath. Same trick a struck medal uses.
   ───────────────────────────────────────────────────────────── */

export function RankEmblem({ tier, sub, size = 128, locked = false, className = "" }: {
  tier: Tier; sub?: string; size?: number; locked?: boolean; className?: string;
}) {
  const id = useId().replace(/:/g, "");
  const art = rankArt(tier.key, !locked, sub);
  if (art) {
    return (
      // The supplied shields are square, so they render square — stretching
      // them to the drawn shield's 1:1.1 would distort the sculpt.
      <img src={art} alt={`${tier.name}${sub ? ` ${sub}` : ""}`} width={size} height={size} decoding="async"
        className={`object-contain ${className}`} style={{ width: size, height: size, ...(rankNeedsDimming(tier.key, !locked) ? { filter: "grayscale(1) brightness(.62)", opacity: 0.75 } : {}) }} />
    );
  }
  const { rim, face, shine } = locked ? { rim: "#6b6862", face: "#8d8a84", shine: "#b6b3ac" } : tier.metal;

  return (
    <svg viewBox="0 0 120 132" width={size} height={size * 1.1} className={className}
      role="img" aria-label={`${tier.name}${sub ? ` ${sub}` : ""}${locked ? ", locked" : ""}`}>
      <defs>
        {/* Face: lit from the upper left, falling away to the lower right. */}
        <linearGradient id={`face${id}`} x1="0.18" y1="0" x2="0.85" y2="1">
          <stop offset="0" stopColor={shine} />
          <stop offset="0.42" stopColor={face} />
          <stop offset="1" stopColor={rim} />
        </linearGradient>
        {/* Rim: inverted, so the bottom edge reads as thickness. */}
        <linearGradient id={`rim${id}`} x1="0.5" y1="0" x2="0.5" y2="1">
          <stop offset="0" stopColor={shine} />
          <stop offset="0.5" stopColor={rim} />
          <stop offset="1" stopColor={shine} stopOpacity="0.75" />
        </linearGradient>
        {/* The specular sweep that sells the bevel. */}
        <linearGradient id={`sweep${id}`} x1="0" y1="0" x2="1" y2="0.7">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.42" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="0.56" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={`floor${id}`} cx="0.5" cy="0.5">
          <stop offset="0" stopColor="#0b0c0d" stopOpacity="0.32" />
          <stop offset="1" stopColor="#0b0c0d" stopOpacity="0" />
        </radialGradient>
        <clipPath id={`clip${id}`}>
          <path d="M60 6 L108 30 V74 C108 96 86 114 60 126 C34 114 12 96 12 74 V30 Z" />
        </clipPath>
      </defs>

      {/* Contact shadow: the emblem sits on something. */}
      <ellipse cx="60" cy="126" rx="34" ry="6" fill={`url(#floor${id})`} />

      {/* Outer rim, then the inset face — the gap between them is the bevel. */}
      <path d="M60 6 L108 30 V74 C108 96 86 114 60 126 C34 114 12 96 12 74 V30 Z" fill={`url(#rim${id})`} />
      <path d="M60 14 L100 34 V73 C100 91 82 106 60 117 C38 106 20 91 20 73 V34 Z" fill={`url(#face${id})`} />

      {/* Specular sweep, clipped to the shield so it reads as a polished surface. */}
      <g clipPath={`url(#clip${id})`}>
        <rect x="-30" y="0" width="120" height="132" fill={`url(#sweep${id})`} transform="rotate(-14 60 66)" />
      </g>

      {/* Engraved sub-rank. The dark copy sits one pixel low, which is what
          makes lettering look cut into metal rather than printed on it. */}
      {sub && (
        <g textAnchor="middle" fontWeight={800} fontSize="34" fontStretch="125%" style={{ fontFamily: "var(--font-sans)" }}>
          <text x="60" y="80.5" fill="#000" opacity="0.38">{sub}</text>
          <text x="60" y="79" fill={shine} opacity={locked ? 0.55 : 0.95}>{sub}</text>
        </g>
      )}

      {locked && <path d="M60 6 L108 30 V74 C108 96 86 114 60 126 C34 114 12 96 12 74 V30 Z" fill="#0b0c0d" opacity="0.42" />}
    </svg>
  );
}
