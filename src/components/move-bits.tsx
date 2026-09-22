"use client";

import Link from "next/link";
import {
  RunIcon, TrailIcon, RideIcon, WalkIcon, HikeIcon, RuckIcon, RowIcon, SkiIcon, SwimIcon, OtherIcon,
  MtbIcon, GravelIcon, SkateIcon, SkiAlpineIcon, SnowboardIcon, IceSkateIcon, KayakIcon, SurfIcon,
  ClimbIcon, BoulderIcon, SoccerIcon, FootballIcon, HockeyIcon, BasketballIcon, TennisIcon, CombatIcon,
  SkydiveIcon, ParaglideIcon,
} from "./sport-icons";
import { SPORTS } from "@/lib/data/sports";
import type { SVGProps } from "react";

type SportIcon = (p: SVGProps<SVGSVGElement> & { strokeWidth?: number }) => React.ReactElement;
import type { Activity, ActivityType, TrackPoint, WorkoutSegment, UnitPrefs } from "@/lib/types";
import { fmtDist, fmtDuration } from "@/lib/units";

/** Icon per sport; the catalogue in lib/data/sports.ts is the source of truth
 *  for which sports exist, what they measure and how fast is plausible. */
const ICON: Record<ActivityType, SportIcon> = {
  run: RunIcon, trail: TrailIcon, walk: WalkIcon, hike: HikeIcon, ruck: RuckIcon,
  ride: RideIcon, mtb: MtbIcon, gravel: GravelIcon, skate: SkateIcon,
  ski: SkiIcon, ski_alpine: SkiAlpineIcon, snowboard: SnowboardIcon, ice_skate: IceSkateIcon,
  swim: SwimIcon, row: RowIcon, kayak: KayakIcon, surf: SurfIcon,
  climb: ClimbIcon, boulder: BoulderIcon,
  soccer: SoccerIcon, football: FootballIcon, hockey: HockeyIcon,
  basketball: BasketballIcon, tennis: TennisIcon, combat: CombatIcon,
  skydive: SkydiveIcon, paraglide: ParaglideIcon,
  other: OtherIcon,
};

export const sportIcon = (t: ActivityType): SportIcon => ICON[t] ?? OtherIcon;

export const TYPES: { v: ActivityType; label: string; icon: SportIcon }[] =
  SPORTS.map((s) => ({ v: s.v, label: s.label, icon: sportIcon(s.v) }));

/** Sports where speed reads better than pace. */
export const SPEED_SPORTS: ActivityType[] = ["ride", "ski", "row"];
export const isSpeedSport = (t: ActivityType) => SPEED_SPORTS.includes(t);
/** Primary rate metric for a sport: pace per km/mi, pace per 100 m (swim) or speed. */
export function rateFor(a: { type: ActivityType; distanceM: number; durationSec: number }, units: UnitPrefs): { label: string; value: string; sub: string } {
  if (a.distanceM < 10 || a.durationSec < 5) return { label: "Pace", value: "—", sub: "" };
  if (a.type === "swim") { const s = a.durationSec / (a.distanceM / 100); return { label: "Pace", value: `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`, sub: "per 100 m" }; }
  if (isSpeedSport(a.type)) { const kmh = (a.distanceM / a.durationSec) * 3.6; return { label: "Avg speed", value: units.distance === "mi" ? (kmh / 1.609).toFixed(1) : kmh.toFixed(1), sub: units.distance === "mi" ? "mph" : "km/h" }; }
  const secKm = a.durationSec / (a.distanceM / 1000); const s = units.distance === "mi" ? secKm * 1.609344 : secKm;
  return { label: "Avg pace", value: `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`, sub: units.distance === "mi" ? "per mile" : "per km" };
}

/** Segment timeline coloured by zone (single hue, opacity steps). */
export function SegmentBar({ segments }: { segments: WorkoutSegment[] }) {
  const total = segments.reduce((a, s) => a + s.seconds, 0) || 1;
  const op = { 1: 0.25, 2: 0.45, 3: 0.65, 4: 0.85, 5: 1 } as Record<number, number>;
  return (
    <div className="flex gap-[2px] h-4 rounded-md overflow-hidden">
      {segments.map((s, i) => <span key={i} title={`${s.label} · ${Math.round(s.seconds / 60)} min · Z${s.zone}`} style={{ width: `${(s.seconds / total) * 100}%`, background: `rgba(31,199,111,${op[s.zone]})` }} />)}
    </div>
  );
}

export function MiniRoute({ points, size = 56 }: { points: TrackPoint[]; size?: number }) {
  if (points.length < 2) return <span className="rounded-xl bg-graphite shrink-0" style={{ width: size, height: size }} />;
  const xs = points.map((p) => p.lng), ys = points.map((p) => p.lat);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const latScale = Math.cos(((minY + maxY) / 2) * Math.PI / 180);
  const w = Math.max((maxX - minX) * latScale, 1e-6), h = Math.max(maxY - minY, 1e-6), s = (size - 12) / Math.max(w, h);
  const ox = 6 + (size - 12 - w * s) / 2, oy = 6 + (size - 12 - h * s) / 2;
  const d = points.map((p, i) => `${i ? "L" : "M"}${(ox + (p.lng - minX) * latScale * s).toFixed(1)} ${(oy + (maxY - p.lat) * s).toFixed(1)}`).join(" ");
  return <svg viewBox={`0 0 ${size} ${size}`} className="rounded-xl bg-graphite border border-line shrink-0" style={{ width: size, height: size }}><path d={d} fill="none" stroke="var(--volt)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export function ActivityRow({ a, units }: { a: Activity; units: UnitPrefs }) {
  return (
    <Link href={`/move/activity?id=${a.id}`} className="card p-2 flex items-center gap-3">
      <MiniRoute points={a.points} />
      <span className="flex-1 min-w-0"><span className="block font-medium truncate">{a.title}</span><span className="text-xs text-smoke">{a.startedAt.slice(0, 10)} · <span className="capitalize">{a.type}</span>{a.shared ? " · shared" : ""} · <span className="text-volt">+{a.xp} XP</span></span></span>
      <span className="text-right tnum"><span className="block font-semibold">{fmtDist(a.distanceM, units)}</span><span className="text-xs text-smoke">{fmtDuration(a.durationSec)} · ↑{Math.round(a.elevGainM)} m</span></span>
    </Link>
  );
}

/** Sport glyph as a component.
 *
 *  `sportIcon(t)` hands back a component, and a component that arrives from a
 *  call cannot be told apart from one built during render — so reaching into
 *  the table here keeps call sites to a plain element. */
export function SportGlyph({ sport, className = "", strokeWidth = 1.8 }: { sport: ActivityType; className?: string; strokeWidth?: number }) {
  const Glyph = ICON[sport] ?? OtherIcon;
  return <Glyph className={className} strokeWidth={strokeWidth} />;
}
