"use client";

import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { addDays, db, getStats, todayISO } from "@/lib/db";
import { challengesFor, fmtTarget, type Challenge } from "@/lib/challenges";
import { sportLabel } from "@/lib/data/sports";
import { SportGlyph } from "./move-bits";
import { Section } from "./ui";
import type { ActivityType, DistanceUnit } from "@/lib/types";

/* Today's challenge and this week's three for the sport picked above. They
   complete themselves from saved activities; the XP is paid on save (see
   awardChallenges in lib/progress). */
export function SportChallenges({ sport, units }: { sport: ActivityType; units: DistanceUnit }) {
  const today = todayISO();
  // 28 days of baseline before this week's Monday, plus the week itself.
  const activities = useLiveQuery(() => db.activities.where("startedAt").aboveOrEqual(addDays(today, -40)).toArray(), [today]);
  const stats = useLiveQuery(() => getStats(), []);
  const set = useMemo(() => (activities ? challengesFor(sport, today, activities, units) : null), [activities, sport, today, units]);
  if (!set) return <div className="skeleton h-40" />;
  const paid = new Set(stats?.challengesDone ?? []);

  return (
    <Section title={`Challenges · ${sportLabel(sport)}`} aside={<span className="text-xs text-smoke">Weekly resets Monday</span>}>
      <div className="grid gap-3">
        <DailyCard c={set.daily} units={units} paid={paid.has(set.daily.id)} />
        <div className="card divide-y divide-line">
          {set.weekly.map((c) => <WeeklyRow key={c.id} c={c} units={units} paid={paid.has(c.id)} />)}
        </div>
      </div>
    </Section>
  );
}

function amount(c: Challenge, units: DistanceUnit) {
  if (c.unit === "done") return c.done ? "Done" : "Not yet";
  if (c.unit === "count") return `${c.progress} / ${c.target}`;
  if (c.unit === "min") return `${Math.floor(c.progress)} / ${c.target} min`;
  // Show progress in the target's own unit: 2.4 / 5.5 km, not 2,400 m / 5.5 km.
  const t = fmtTarget(c.kind, c.target, units);
  const unit = t.split(" ").pop()!;
  const p = unit === "km" ? (c.progress / 1000).toFixed(1) : unit === "mi" ? (c.progress / 1609.344).toFixed(1) : Math.round(c.progress).toLocaleString("en-US");
  return `${p} / ${t}`;
}

const share = (c: Challenge) => Math.min(1, c.target ? c.progress / c.target : 0);

function Reward({ c, paid }: { c: Challenge; paid: boolean }) {
  return c.done
    ? <span className="chip chip--volt shrink-0">{paid ? "✓ " : ""}+{c.xp} XP</span>
    : <span className="chip shrink-0 tnum">+{c.xp} XP</span>;
}

function DailyCard({ c, units, paid }: { c: Challenge; units: DistanceUnit; paid: boolean }) {
  return (
    <div className={`card p-4 grid gap-3 ${c.done ? "!border-volt" : ""}`}>
      <div className="flex items-start gap-3">
        <span className={`w-11 h-11 rounded-2xl grid place-items-center shrink-0 ${c.done ? "bg-volt text-ink" : "bg-[rgba(31,199,111,.12)] text-ink"}`}>
          <SportGlyph sport={c.sport} className="w-6 h-6" />
        </span>
        <div className="grid gap-0.5 min-w-0 flex-1">
          <span className="meta">Today’s challenge</span>
          <p className="display text-xl leading-tight">{c.title}</p>
        </div>
        <Reward c={c} paid={paid} />
      </div>
      <p className="text-sm text-smoke">{c.detail}</p>
      {c.unit !== "done" && (
        <div className="grid gap-1.5">
          <span className="bar"><i style={{ width: `${share(c) * 100}%` }} /></span>
          <span className="text-xs text-smoke tnum">{amount(c, units)}</span>
        </div>
      )}
    </div>
  );
}

function WeeklyRow({ c, units, paid }: { c: Challenge; units: DistanceUnit; paid: boolean }) {
  return (
    <div className="p-4 grid gap-2">
      <div className="flex items-center justify-between gap-3">
        <div className="grid min-w-0">
          <span className="text-sm font-medium">{c.title}</span>
          <span className="text-xs text-smoke tnum">{amount(c, units)}</span>
        </div>
        <Reward c={c} paid={paid} />
      </div>
      <span className="bar"><i style={{ width: `${share(c) * 100}%` }} /></span>
    </div>
  );
}
