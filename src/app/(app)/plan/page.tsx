"use client";

import { useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { db, getProfile, todayISO, type SessionRow } from "@/lib/db";
import { goalLabel } from "@/lib/engine/plan";
import { getExercise } from "@/lib/data/exercises";
import { sessionImage } from "@/lib/data/images";
import { Screen, Hero, Section, Photo, ScreenSkeleton, Rail } from "@/components/ui";
import { Page, Stagger, Item, Ring, CountUp, motion, AnimatePresence } from "@/components/motion";

export default function PlanPage() {
  const profile = useLiveQuery(() => getProfile(), []);
  const plan = useLiveQuery(() => db.plans.orderBy("startDate").last(), []);
  const sessions = useLiveQuery(async (): Promise<SessionRow[]> => (plan ? db.sessions.where("planId").equals(plan.id).sortBy("date") : []), [plan?.id]) ?? [];
  const [picked, setPicked] = useState<number | null>(null);
  if (!profile || !plan) return <ScreenSkeleton />;
  const today = todayISO();
  const currentWeek = Math.max(1, Math.min(12, Math.floor((new Date(today).getTime() - new Date(plan.startDate).getTime()) / 86400000 / 7) + 1));
  const week = picked ?? currentWeek;
  const doneCount = sessions.filter((s) => s.status === "done").length;
  const ws = sessions.filter((s) => s.week === week);
  const block = plan.blocks.find((b) => b.weeks.includes(week));
  const endDate = new Date(new Date(plan.startDate).getTime() + 12 * 7 * 86400000).toISOString().slice(0, 10);
  const fmtDay = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });

  return (
    <Page>
      <Screen>
        <Hero image={sessionImage("full")} height="h-[300px]" back="/today" eyebrow={`${goalLabel(plan.goal)} · ${profile.daysPerWeek} days · ${profile.sessionMinutes} min · ${plan.startDate} → ${endDate}`} title={<>Twelve weeks.<br /><em>One block.</em></>}
          right={<span className="chip chip--live backdrop-blur-md tnum">{doneCount}/{sessions.length} done</span>}>
          {/* Read-only progress indicator. It used to be 12 buttons 8px tall —
              an unhittable duplicate of the W1…W12 row below, which is 44px. */}
          <div className="grid grid-cols-12 gap-1 mt-4 max-w-[520px]" role="presentation">{Array.from({ length: 12 }, (_, i) => <span key={i} className={`h-2 rounded-full ${i + 1 < currentWeek ? "bg-volt" : i + 1 === currentWeek ? "bg-bone" : "bg-[rgba(236,231,223,.2)]"} ${i + 1 === week ? "outline outline-2 outline-offset-2 outline-bone/60" : ""}`} />)}</div>
        </Hero>

        <Stagger className="xl:grid xl:grid-cols-[minmax(0,1fr)_var(--rail)] xl:gap-x-12 xl:items-start">
          <div className="min-w-0">
            <Item>
              <Rail active={week} gutter className="gap-2 pb-3 mb-4 lg:mx-0 lg:px-0 lg:flex-wrap lg:overflow-visible">
                {Array.from({ length: 12 }, (_, i) => { const n = i + 1; const wsn = sessions.filter((s) => s.week === n); const done = wsn.length > 0 && wsn.every((s) => s.status === "done"); return (
                  <button key={n} type="button" aria-pressed={n === week} onClick={() => setPicked(n)} className={`shrink-0 h-11 px-4 rounded-full border text-sm tnum transition-colors ${n === week ? "bg-volt border-volt text-ink font-medium" : done ? "border-line-strong text-bone" : n === currentWeek ? "border-ink text-ink" : "border-line-strong text-smoke"}`}>W{n}{n % 4 === 0 ? " ·" : ""}{n === currentWeek ? " now" : ""}</button>); })}
              </Rail>
            </Item>

            <AnimatePresence mode="wait">
              <motion.div key={week} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}>
                <Section title={`Week ${week}${week % 4 === 0 ? " · deload" : ""}${week === currentWeek ? " · now" : ""}`} aside={block ? <span className="text-xs text-smoke">{block.name} · {block.intensity}</span> : undefined}>
                  {block && <p className="text-sm text-smoke mb-4 max-w-[60ch]">{block.intent}</p>}
                  <div className="grid gap-3 sm:grid-cols-2">
                    {ws.map((s) => {
                      const main = s.exercises.find((e) => e.block === "main");
                      const mainMeta = main ? getExercise(main.slug) : undefined;
                      const isToday = s.date === today;
                      return (
                        <Link key={s.id} href={`/session?id=${s.id}`} className={`card overflow-hidden block ${isToday ? "border-volt" : ""}`}>
                          <div className="relative h-36 lg:h-40">
                            <Photo src={sessionImage(s.kind, 800, 500)} veil className="absolute inset-0" />
                            <div className="on-photo absolute top-3 left-3 flex gap-1.5">{s.status === "done" ? <span className="chip chip--volt">Done</span> : isToday ? <span className="chip chip--live backdrop-blur-md">Today</span> : s.status === "adjusted" ? <span className="chip chip--live backdrop-blur-md">Adjusted</span> : null}</div>
                            <div className="on-photo absolute inset-x-0 bottom-0 p-4"><span className="meta text-bone/80">{fmtDay(s.date)}</span><p className="display text-2xl leading-none mt-1">{s.title}</p></div>
                          </div>
                          <div className="px-4 py-3 flex items-center justify-between text-xs text-smoke tnum">
                            <span>{s.minutes} min · {s.exercises.length} movements{s.cardio ? ` · Z${s.cardio.zone} ${s.cardio.minutes} min` : ""}</span>
                            {mainMeta && <span className="text-ink font-medium">{mainMeta.name}</span>}
                          </div>
                        </Link>
                      );
                    })}
                    {ws.length === 0 && <p className="text-sm text-smoke">Rest week — mobility flows on Today.</p>}
                  </div>
                </Section>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="min-w-0">
            <Item>
              <Section title="The block">
                <div className="card p-4 grid gap-4">
                  <div className="flex items-center gap-4">
                    <Ring value={doneCount / Math.max(1, sessions.length)} size={72} stroke={6}><span className="text-sm font-semibold tnum"><CountUp value={Math.round((doneCount / Math.max(1, sessions.length)) * 100)} suffix="%" /></span></Ring>
                    <div className="grid gap-0.5 text-sm"><span className="font-medium">Week {currentWeek} of 12</span><span className="text-xs text-smoke">{doneCount} of {sessions.length} sessions · deload every 4th week</span></div>
                  </div>
                  <ul className="grid divide-y divide-line border-t border-line">
                    {plan.blocks.map((b) => { const on = b.weeks.includes(currentWeek); return (
                      <li key={b.name} className="py-3 grid gap-1">
                        <div className="flex justify-between items-baseline"><span className={`text-sm font-medium ${on ? "text-volt" : ""}`}>{b.name}</span><span className="text-xs text-smoke tnum">W{b.weeks[0]}–{b.weeks[b.weeks.length - 1]} · {b.intensity}</span></div>
                        <span className="text-xs text-smoke">{b.intent}</span>
                      </li>); })}
                  </ul>
                </div>
              </Section>
            </Item>
            {plan.season && (
              <Item>
                <Section title={`Season → ${plan.season.eventName}`} aside={<span className="text-xs text-smoke tnum">{plan.season.eventDate}</span>}>
                  <ul className="card divide-y divide-line px-4">{plan.season.phases.map((p) => <li key={p.name} className="py-3 flex justify-between text-sm"><span>{p.name}</span><span className="text-smoke tnum text-xs">{p.from} → {p.to}</span></li>)}</ul>
                </Section>
              </Item>
            )}
            <Item>
              <Section title="Why it is built this way">
                <div className="card p-4 grid gap-2 text-sm text-smoke">
                  <p>Three mesocycles. Intensity climbs inside each one; the fourth week backs off so the next one can start higher.</p>
                  <p>Every morning check-in can bend a session — less time, missing gear, a sore joint — without breaking the block.</p>
                  <p>Change the goal in Settings and the remaining weeks are rebuilt; what is done stays done.</p>
                </div>
              </Section>
            </Item>
          </div>
        </Stagger>
      </Screen>
    </Page>
  );
}
