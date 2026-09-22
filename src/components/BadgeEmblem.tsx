"use client";

import { useId } from "react";
import type { Pillar } from "@/lib/types";
import { badgeArt, badgeNeedsDimming } from "@/lib/data/art";

/* ─────────────────────────────────────────────────────────────
   Badge emblems.

   Same lighting trick as the rank shields — a darker rim, a face
   lit from the upper left, a specular sweep — but round rather
   than a shield, so the two never read as the same object. Locked
   badges keep their shape and lose their colour, and carry a
   progress ring so the athlete can see how close they are.
   ───────────────────────────────────────────────────────────── */

export type BadgePillar = Pillar | "all";

const METAL: Record<BadgePillar, { rim: string; face: string; shine: string }> = {
  strength:  { rim: "#7a3a14", face: "#c2702f", shine: "#f0b477" },
  endurance: { rim: "#134c56", face: "#2f97a8", shine: "#9fe3ee" },
  mobility:  { rim: "#4a3570", face: "#8a6fc4", shine: "#d2c0f5" },
  nutrition: { rim: "#2b6134", face: "#57a866", shine: "#aee7b8" },
  recovery:  { rim: "#6b5a12", face: "#c0a52c", shine: "#f3e08a" },
  all:       { rim: "#3a3d42", face: "#7b8086", shine: "#c6cbd1" },
};

/** One glyph per pillar, drawn on the 24-grid the sport icons use. */
const GLYPH: Record<BadgePillar, React.ReactNode> = {
  strength:  <path d="M4 12h2m12 0h2M7 8.5v7m10-7v7M9.5 10v4h5v-4" />,
  endurance: <path d="M12 3.6a8.4 8.4 0 1 0 8.4 8.4M12 7.4V12l3.2 2" />,
  mobility:  <path d="M8 4.5c4 1.6 4 6.4 0 8s-4 6.4 0 8M16 4.5c-4 1.6-4 6.4 0 8s4 6.4 0 8" />,
  nutrition: <path d="M12 21c-3.6 0-6-2.9-6-7 0-3.4 2-6 4.4-6 1 0 1.6.5 1.6.5s.6-.5 1.6-.5C16 8 18 10.6 18 14c0 4.1-2.4 7-6 7zM12 8V4.2M12 4.2c2 0 3.4-1 3.6-2.2-2 0-3.4 1-3.6 2.2z" />,
  recovery:  <path d="M12 20s-7-4.3-7-9a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 4.7-7 9-7 9z" />,
  all:       <path d="M12 3l2.6 5.6 6 .8-4.4 4.2 1.1 6-5.3-2.9-5.3 2.9 1.1-6L3.4 9.4l6-.8z" />,
};

export function BadgeEmblem({ id: badgeId, pillar, earned, progress, size = 72, className = "" }: {
  id?: string; pillar: BadgePillar; earned: boolean; progress?: [number, number]; size?: number; className?: string;
}) {
  const id = useId().replace(/:/g, "");
  const art = badgeId ? badgeArt(badgeId, earned) : undefined;

  // Supplied artwork wins. The progress ring still draws around it, so a
  // designed badge keeps telling the athlete how close they are.
  if (art) {
    const pct = progress && progress[1] > 0 ? Math.min(1, progress[0] / progress[1]) : earned ? 1 : 0;
    const R = 46, C = 2 * Math.PI * R;
    return (
      <span className={`relative inline-grid place-items-center ${className}`} style={{ width: size, height: size }}>
        {!earned && pct > 0 && (
          <svg viewBox="0 0 104 104" className="absolute inset-0 w-full h-full" aria-hidden="true">
            <circle cx="52" cy="52" r={R} fill="none" stroke="var(--line)" strokeWidth="3" />
            <circle cx="52" cy="52" r={R} fill="none" stroke="var(--volt)" strokeWidth="3" strokeLinecap="round"
              strokeDasharray={C} strokeDashoffset={C * (1 - pct)} transform="rotate(-90 52 52)" />
          </svg>
        )}
        <img src={art} alt="" width={size} height={size} decoding="async"
          className="w-[82%] h-[82%] object-contain"
          style={badgeNeedsDimming(badgeId!, earned) ? { filter: "grayscale(1) brightness(.62)", opacity: 0.75 } : undefined} />
      </span>
    );
  }

  const { rim, face, shine } = earned ? METAL[pillar] : { rim: "#67645e", face: "#8b8880", shine: "#b2afa8" };
  const pct = progress && progress[1] > 0 ? Math.min(1, progress[0] / progress[1]) : earned ? 1 : 0;
  const R = 44, C = 2 * Math.PI * R;

  return (
    <svg viewBox="0 0 104 104" width={size} height={size} className={className} role="img"
      aria-label={earned ? "Earned" : progress ? `${Math.round(pct * 100)}% of the way there` : "Locked"}>
      <defs>
        <linearGradient id={`f${id}`} x1="0.2" y1="0" x2="0.85" y2="1">
          <stop offset="0" stopColor={shine} /><stop offset="0.45" stopColor={face} /><stop offset="1" stopColor={rim} />
        </linearGradient>
        <linearGradient id={`r${id}`} x1="0.5" y1="0" x2="0.5" y2="1">
          <stop offset="0" stopColor={shine} /><stop offset="0.55" stopColor={rim} /><stop offset="1" stopColor={shine} stopOpacity="0.7" />
        </linearGradient>
        <linearGradient id={`s${id}`} x1="0" y1="0" x2="1" y2="0.8">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.44" stopColor="#fff" stopOpacity="0.5" />
          <stop offset="0.58" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <clipPath id={`c${id}`}><circle cx="52" cy="52" r="38" /></clipPath>
      </defs>

      {/* Progress ring sits outside the medal, so a locked badge still shows the climb. */}
      {!earned && pct > 0 && (
        <>
          <circle cx="52" cy="52" r={R} fill="none" stroke="var(--line)" strokeWidth="3" />
          <circle cx="52" cy="52" r={R} fill="none" stroke="var(--volt)" strokeWidth="3" strokeLinecap="round"
            strokeDasharray={C} strokeDashoffset={C * (1 - pct)} transform="rotate(-90 52 52)" />
        </>
      )}

      <circle cx="52" cy="52" r="38" fill={`url(#r${id})`} />
      <circle cx="52" cy="52" r="32" fill={`url(#f${id})`} />
      <g clipPath={`url(#c${id})`}>
        <rect x="-10" y="0" width="124" height="104" fill={`url(#s${id})`} transform="rotate(-16 52 52)" />
      </g>

      {/* The lock veil goes under the glyph: over it, the engraving disappeared
          and every locked badge became an anonymous grey disc. */}
      {!earned && <circle cx="52" cy="52" r="38" fill="#0b0c0d" opacity="0.28" />}

      {/* Glyph engraved: a dark copy one pixel low under the light one. */}
      <g transform="translate(52 52) scale(1.45) translate(-12 -12)" fill="none" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <g stroke="#000" opacity="0.4" transform="translate(0 0.8)">{GLYPH[pillar]}</g>
        <g stroke={earned ? shine : "#e8e5de"} opacity={earned ? 0.95 : 0.8}>{GLYPH[pillar]}</g>
      </g>
    </svg>
  );
}
