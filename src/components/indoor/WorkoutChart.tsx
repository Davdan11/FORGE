"use client";

import { flatten, totalSec, zoneOfPct, ZONE_HEX, type StructuredWorkout } from "@/lib/indoor/workouts";

/**
 * A workout drawn the way cyclists read them: time across, intensity up,
 * every block in its zone's colour. `atSec` draws where the rider is now.
 */
export function WorkoutChart({ workout, atSec, className = "h-12 w-full" }: { workout: Pick<StructuredWorkout, "blocks">; atSec?: number; className?: string }) {
  const steps = flatten(workout);
  const total = Math.max(1, totalSec(steps));
  const H = 100;
  const top = Math.max(130, ...steps.map((s) => Math.max(s.from, s.to)));
  const y = (pct: number) => H - (pct / top) * H;
  return (
    <svg viewBox={`0 0 ${total} ${H}`} preserveAspectRatio="none" className={className} aria-hidden="true">
      {steps.map((s, i) => (
        <polygon key={i}
          points={`${s.startSec},${H} ${s.startSec},${y(s.from)} ${s.startSec + s.sec},${y(s.to)} ${s.startSec + s.sec},${H}`}
          fill={ZONE_HEX[zoneOfPct(Math.max(s.from, s.to))]} fillOpacity={atSec != null && s.startSec + s.sec <= atSec ? 0.45 : 0.9}
          stroke="rgba(0,0,0,.18)" strokeWidth={total / 400} vectorEffect="non-scaling-stroke" />
      ))}
      {/* FTP line: everything above it is harder than an hour's effort. */}
      <line x1={0} x2={total} y1={y(100)} y2={y(100)} stroke="currentColor" strokeOpacity={0.35} strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
      {atSec != null && <line x1={atSec} x2={atSec} y1={0} y2={H} stroke="currentColor" strokeWidth={2} vectorEffect="non-scaling-stroke" />}
    </svg>
  );
}
