"use client";

import { useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { db, getProfile, todayISO, type SessionRow } from "@/lib/db";
import { goalLabel, phaseOf, sessionTitle } from "@/lib/engine/plan";
import { useT, locale, loc } from "@/lib/i18n";
import { blockOfWeek, firstWeekOf, weekOf } from "@/lib/engine/progression";
import { getExercise } from "@/lib/data/exercises";
import { sessionImage } from "@/lib/data/images";
import { Screen, Hero, Section, Photo, ScreenSkeleton, Rail } from "@/components/ui";
import { Page, Stagger, Item, Ring, CountUp, motion, AnimatePresence } from "@/components/motion";

export default function PlanPage() {
  const profile = useLiveQuery(() => getProfile(), []);
  const plan = useLiveQuery(() => db.plans.orderBy("startDate").last(), []);
  const sessions = useLiveQuery(async (): Promise<SessionRow[]> => (plan ? db.sessions.where("planId").equals(plan.id).sortBy("date") : []), [plan?.id]) ?? [];
  const [picked, setPicked] = useState<number | null>(null);
  const t = useT();
  if (!profile || !plan) return <ScreenSkeleton />;
  const today = todayISO();
  const currentWeek = Math.max(1, Math.min(plan.weeks, weekOf(plan, today)));
  const currentBlock = plan.blocks[blockOfWeek(currentWeek) - 1];
  // The programme is open-ended: show the block before this one onwards.
  const firstShown = Math.max(1, firstWeekOf(blockOfWeek(currentWeek) - 1));
  const shownWeeks = Array.from({ length: plan.weeks - firstShown + 1 }, (_, i) => firstShown + i);
  const shownBlocks = plan.blocks.filter((b) => b.weeks[b.weeks.length - 1] >= firstShown);
  const week = picked ?? currentWeek;
  const doneCount = sessions.filter((s) => s.status === "done").length;
  const ws = sessions.filter((s) => s.week === week);
  const block = plan.blocks.find((b) => b.weeks.includes(week));
  const fmtDay = (d: string) => new Date(d + "T00:00:00").toLocaleDateString(locale(), { weekday: "long", month: "short", day: "numeric" });
  // Block names and intents in the current language, from the goal and the block's first week.
  const bName = (b: { name: string; weeks: number[] }) => phaseOf(plan.goal, b.weeks[0]).name;
  const bIntent = (b: { intent: string; weeks: number[] }) => phaseOf(plan.goal, b.weeks[0]).intent;

  return (
    <Page>
      <Screen>
        <Hero image={sessionImage("full")} height="h-[300px]" back="/today" eyebrow={t(`${goalLabel(plan.goal)} · ${profile.daysPerWeek} jours · ${profile.sessionMinutes} min · depuis le ${plan.startDate}`, `${goalLabel(plan.goal)} · ${profile.daysPerWeek} days · ${profile.sessionMinutes} min · since ${plan.startDate}`)} title={<>{t("Ton entraînement.", "Your training.")}<br /><em>{t(`Bloc ${currentBlock ? bName(currentBlock) : ""}.`, `${currentBlock ? bName(currentBlock) : "Block"} block.`)}</em></>}
          right={<span className="chip chip--live backdrop-blur-md tnum">{doneCount}/{sessions.length} {t(doneCount > 1 ? "faites" : "faite", "done")}</span>}>
          {/* Read-only progress indicator. It used to be 12 buttons 8px tall —
              an unhittable duplicate of the week row below, which is 44px. */}
          <div className="grid gap-1 mt-4 max-w-[520px]" style={{ gridTemplateColumns: `repeat(${shownWeeks.length}, minmax(0, 1fr))` }} role="presentation">{shownWeeks.map((n) => <span key={n} className={`h-2 rounded-full ${n < currentWeek ? "bg-volt" : n === currentWeek ? "bg-bone" : "bg-[rgba(236,231,223,.2)]"} ${n === week ? "outline outline-2 outline-offset-2 outline-bone/60" : ""}`} />)}</div>
        </Hero>

        <Stagger className="xl:grid xl:grid-cols-[minmax(0,1fr)_var(--rail)] xl:gap-x-12 xl:items-start">
          <div className="min-w-0">
            <Item>
              <Rail active={week} gutter className="gap-2 pb-3 mb-4 lg:mx-0 lg:px-0 lg:flex-wrap lg:overflow-visible">
                {shownWeeks.map((n) => { const wsn = sessions.filter((s) => s.week === n); const done = wsn.length > 0 && wsn.every((s) => s.status === "done"); return (
                  <button key={n} type="button" aria-pressed={n === week} onClick={() => setPicked(n)} className={`shrink-0 h-11 px-4 rounded-full border text-sm tnum transition-colors ${n === week ? "bg-volt border-volt text-ink font-medium" : done ? "border-line-strong text-bone" : n === currentWeek ? "border-ink text-ink" : "border-line-strong text-smoke"}`}>{t("S", "W")}{n}{n % 4 === 0 ? " ·" : ""}{n === currentWeek ? t(" en cours", " now") : ""}</button>); })}
              </Rail>
            </Item>

            <AnimatePresence mode="wait">
              <motion.div key={week} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}>
                <Section title={t(`Semaine ${week}${week % 4 === 0 ? " · décharge" : ""}${week === currentWeek ? " · en cours" : ""}`, `Week ${week}${week % 4 === 0 ? " · deload" : ""}${week === currentWeek ? " · now" : ""}`)} aside={block ? <span className="text-xs text-smoke">{bName(block)} · {block.intensity}</span> : undefined}>
                  {block && <p className="text-sm text-smoke mb-4 max-w-[60ch]">{bIntent(block)}</p>}
                  <div className="grid gap-3 sm:grid-cols-2">
                    {ws.map((s) => {
                      const main = s.exercises.find((e) => e.block === "main");
                      const mainMeta = main ? getExercise(main.slug) : undefined;
                      const isToday = s.date === today;
                      return (
                        <Link key={s.id} href={`/session?id=${s.id}`} className={`card overflow-hidden block ${isToday ? "border-volt" : ""}`}>
                          <div className="relative h-36 lg:h-40">
                            <Photo src={sessionImage(s.kind, 800, 500)} veil className="absolute inset-0" />
                            <div className="on-photo absolute top-3 left-3 flex gap-1.5">{s.status === "done" ? <span className="chip chip--volt">{t("Faite", "Done")}</span> : isToday ? <span className="chip chip--live backdrop-blur-md">{t("Aujourd’hui", "Today")}</span> : s.status === "adjusted" ? <span className="chip chip--live backdrop-blur-md">{t("Ajustée", "Adjusted")}</span> : null}</div>
                            <div className="on-photo absolute inset-x-0 bottom-0 p-4"><span className="meta text-bone/80">{fmtDay(s.date)}</span><p className="display text-2xl leading-none mt-1">{sessionTitle(s.kind)}</p></div>
                          </div>
                          <div className="px-4 py-3 flex items-center justify-between text-xs text-smoke tnum">
                            <span>{s.minutes} min · {s.exercises.length} {t(s.exercises.length > 1 ? "mouvements" : "mouvement", "movements")}{s.cardio ? ` · Z${s.cardio.zone} ${s.cardio.minutes} min` : ""}</span>
                            {mainMeta && <span className="text-ink font-medium">{mainMeta.name}</span>}
                          </div>
                        </Link>
                      );
                    })}
                    {ws.length === 0 && <p className="text-sm text-smoke">{t("Semaine de repos — enchaînements de mobilité dans Aujourd’hui.", "Rest week — mobility flows on Today.")}</p>}
                  </div>
                </Section>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="min-w-0">
            <Item>
              <Section title={t("Le bloc", "The block")}>
                <div className="card p-4 grid gap-4">
                  <div className="flex items-center gap-4">
                    <Ring value={doneCount / Math.max(1, sessions.length)} size={72} stroke={6}><span className="text-sm font-semibold tnum"><CountUp value={Math.round((doneCount / Math.max(1, sessions.length)) * 100)} suffix="%" /></span></Ring>
                    <div className="grid gap-0.5 text-sm"><span className="font-medium">{t(`Semaine ${currentWeek} · bloc ${blockOfWeek(currentWeek)}`, `Week ${currentWeek} · block ${blockOfWeek(currentWeek)}`)}</span><span className="text-xs text-smoke">{t(`${doneCount} séance${doneCount > 1 ? "s" : ""} sur ${sessions.length} · décharge toutes les 4 semaines`, `${doneCount} of ${sessions.length} sessions · deload every 4th week`)}</span></div>
                  </div>
                  {currentBlock?.review && (
                    <div className="grid gap-1.5 border-t border-line pt-3">
                      <span className="meta">{t("Ce qui a changé ce bloc-ci", "What changed this block")}</span>
                      {currentBlock.review.changes.map((x) => loc(x)).map((c) => <p key={c} className="text-sm">{c}</p>)}
                    </div>
                  )}
                  <ul className="grid divide-y divide-line border-t border-line">
                    {shownBlocks.map((b) => { const on = b.weeks.includes(currentWeek); return (
                      <li key={b.weeks[0]} className="py-3 grid gap-1">
                        <div className="flex justify-between items-baseline"><span className={`text-sm font-medium ${on ? "text-volt" : ""}`}>{bName(b)}</span><span className="text-xs text-smoke tnum">{t("S", "W")}{b.weeks[0]}–{b.weeks[b.weeks.length - 1]} · {b.intensity}</span></div>
                        <span className="text-xs text-smoke">{bIntent(b)}</span>
                      </li>); })}
                  </ul>
                </div>
              </Section>
            </Item>
            {plan.season && (
              <Item>
                <Section title={t(`Saison → ${plan.season.eventName}`, `Season → ${plan.season.eventName}`)} aside={<span className="text-xs text-smoke tnum">{plan.season.eventDate}</span>}>
                  <ul className="card divide-y divide-line px-4">{plan.season.phases.map((p) => <li key={p.name} className="py-3 flex justify-between text-sm"><span>{loc(p.name)}</span><span className="text-smoke tnum text-xs">{p.from} → {p.to}</span></li>)}</ul>
                </Section>
              </Item>
            )}
            <Item>
              <Section title={t("Pourquoi c’est bâti comme ça", "Why it is built this way")}>
                <div className="card p-4 grid gap-2 text-sm text-smoke">
                  <p>{t("Des blocs de quatre semaines, trois par cycle, chacun avec sa job. L’intensité monte dans chaque bloc; la quatrième semaine relâche pour que le prochain parte plus haut.", "Four-week blocks, three per cycle, each with its own job. Intensity climbs inside each block; the fourth week backs off so the next one can start higher.")}</p>
                  <p>{t("Au début de chaque bloc, le précédent est revu : combien de séances ont eu lieu et à quel point elles ont semblé dures. Les charges, le volume et les exercices sont réécrits à partir de ça. Le prochain bloc est toujours prêt avant que t’en aies besoin.", "At the start of every block, the one before it is reviewed: how many sessions happened and how hard they felt. The loads, the volume and the exercises are rewritten from that. The next block is always ready before you need it.")}</p>
                  <p>{t("Chaque bilan du matin peut plier une séance — moins de temps, pas d’équipement, une articulation sensible — sans briser le bloc.", "Every morning check-in can bend a session — less time, missing gear, a sore joint — without breaking the block.")}</p>
                  <p>{t("Change l’objectif dans les Réglages et les semaines restantes sont rebâties; ce qui est fait reste fait.", "Change the goal in Settings and the remaining weeks are rebuilt; what is done stays done.")}</p>
                </div>
              </Section>
            </Item>
          </div>
        </Stagger>
      </Screen>
    </Page>
  );
}
