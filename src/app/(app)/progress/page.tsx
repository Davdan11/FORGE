"use client";

import { useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { db, getProfile, getStats, todayISO } from "@/lib/db";
import { BADGES, RANKS, levelFromXp, rankFor, subRankFor, tierForLevel } from "@/lib/gamification";
import { RankEmblem } from "@/components/RankEmblem";
import { BadgeEmblem } from "@/components/BadgeEmblem";
import { bestE1rmBySlug, logWeighIn } from "@/lib/progress";
import { blockOfWeek, firstWeekOf, weekOf } from "@/lib/engine/progression";
import { getExercise } from "@/lib/data/exercises";
import { ART, exerciseImage, sessionImage, IMG } from "@/lib/data/images";
import { e1rm, fmtDist, fmtLoad, kgToLb, lbToKg, fmtDuration } from "@/lib/units";
import { Screen, Hero, Section, Photo, Toast, ScreenSkeleton, Seg } from "@/components/ui";
import { Page, Stagger, Item , CountUp, Reveal, Press } from "@/components/motion";
import { Bars, Sparkline, Heatmap } from "@/components/charts";
import { MiniRoute } from "@/components/move-bits";
import { FeedIcon } from "@/components/NavIcons";

export default function ProgressPage() {
  const profile = useLiveQuery(() => getProfile(), []);
  const stats = useLiveQuery(() => getStats(), []);
  const best = useLiveQuery(() => bestE1rmBySlug(), []) ?? {};
  const logs = useLiveQuery(() => db.logs.orderBy("startedAt").toArray(), []) ?? [];
  const sessions = useLiveQuery(() => db.sessions.toArray(), []) ?? [];
  const plan = useLiveQuery(() => db.plans.orderBy("startDate").last(), []);
  const sets = useLiveQuery(() => db.sets.orderBy("at").toArray(), []) ?? [];
  const activities = useLiveQuery(() => db.activities.orderBy("startedAt").toArray(), []) ?? [];
  const readiness = useLiveQuery(() => db.readiness.orderBy("date").toArray(), []) ?? [];
  const weights = useLiveQuery(() => db.weights.orderBy("date").toArray(), []) ?? [];
  const nutrition = useLiveQuery(() => db.nutrition.toArray(), []) ?? [];
  const [tab, setTab] = useState<"stats" | "feed" | "badges">("stats");
  const [w, setW] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  if (!profile || !stats) return <ScreenSkeleton />;
  const lvl = levelFromXp(stats.xp);
  const rankIdx = Math.min(RANKS.length - 1, Math.floor((lvl.level - 1) / 10));
  const units = profile.units;
  const ctx = { bestE1rm: best, bodyweightKg: profile.weightKg, best5kSec: activities.filter((a) => a.type === "run" && a.distanceM >= 5000).map((a) => (a.durationSec * 5000) / a.distanceM).sort((x, y) => x - y)[0], zone2Min: activities.reduce((s, a) => s + a.durationSec / 60, 0) };

  /* ── derived ── */
  const cells: Record<string, number> = {};
  logs.forEach((l) => { const k = l.startedAt.slice(0, 10); cells[k] = (cells[k] ?? 0) + 2; });
  activities.forEach((a) => { const k = a.startedAt.slice(0, 10); cells[k] = (cells[k] ?? 0) + 2; });
  readiness.forEach((r) => { cells[r.date] = (cells[r.date] ?? 0) + 1; });
  nutrition.filter((n) => n.meals.length && n.meals.every((m) => m.done)).forEach((n) => { cells[n.date] = (cells[n.date] ?? 0) + 1; });
  const activeDays = Object.keys(cells).length;
  const weekly = weeklyMinutes(logs, activities);
  const weeksWithData = weekly.filter((x) => x.value > 0).length;
  const lifts = Object.entries(best).filter(([slug]) => getExercise(slug)?.loadable).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const trend = (slug: string) => sets.filter((s) => s.slug === slug && s.loadKg && s.reps).map((s) => e1rm(s.loadKg!, s.reps!));
  // "Outside" counts what was ridden or run outdoors, like the distance beside it (indoor rides have their own page).
  const outside = activities.filter((a) => a.meta?.discipline !== "indoor");
  const shared = activities.filter((a) => a.shared).sort((a, b) => (b.sharedAt ?? b.startedAt).localeCompare(a.sharedAt ?? a.startedAt));
  const readySeries = readiness.slice(-14);
  const wSeries = weights.slice(-30);
  const wDelta = wSeries.length > 1 ? wSeries[wSeries.length - 1].kg - wSeries[0].kg : 0;
  const toUnitW = (kg: number) => (units.weight === "lb" ? `${Math.round(kgToLb(kg) * 10) / 10} lb` : `${Math.round(kg * 10) / 10} kg`);
  const today = todayISO();
  const week = plan ? Math.max(1, Math.min(plan.weeks, weekOf(plan, today))) : 1;
  const meso = blockOfWeek(week);
  const blockName = plan?.blocks[meso - 1]?.name;
  const doneSessions = sessions.filter((s) => s.status === "done").length;
  const earned = BADGES.filter((b) => stats.badges.includes(b.id));
  const recent = logs.slice(-5).reverse().map((l) => ({ l, s: sessions.find((s) => s.id === l.sessionId) }));

  async function weigh() {
    const v = Number(w); if (!v) return;
    const kg = units.weight === "lb" ? lbToKg(v) : v;
    const xp = await logWeighIn(Math.round(kg * 10) / 10, todayISO());
    setW(""); setToast(`Logged ${toUnitW(kg)}. +${xp} XP.`); setTimeout(() => setToast(null), 3000);
  }

  return (
    <Page>
      <Screen>
        <Hero image={ART.profile} color height="h-[380px]" eyebrow={`${rankFor(lvl.level)} · level ${lvl.level} · ${stats.streakWeeks} week streak`} title={<>{profile.name}<br /><em>{goalLine(profile.goal)}</em></>}
          right={<Link href="/settings" className="chip chip--live backdrop-blur-md">Settings</Link>}>
          <div className="flex items-center gap-4 mt-4">
            <Link href="/ranks" aria-label="Your rank and rewards"><RankEmblem tier={tierForLevel(lvl.level)} sub={subRankFor(lvl.level)} size={64} /></Link>
            <div className="grid gap-1 flex-1 max-w-[420px]">
              <div className="flex justify-between text-xs"><span className="text-bone/80">{lvl.into.toLocaleString("en-US")} / {lvl.need.toLocaleString("en-US")} XP</span><span className="text-smoke">next: {RANKS[Math.min(RANKS.length - 1, rankIdx + 1)]} at level {(rankIdx + 1) * 10 + 1}</span></div>
              <div className="bar"><i style={{ width: `${(lvl.into / lvl.need) * 100}%` }} /></div>
              <span className="flex gap-4"><Link href="/journey" className="text-xs underline text-bone/80">Your journey</Link><Link href="/trends" className="text-xs underline text-bone/80">See your progress</Link><Link href="/ranks" className="text-xs underline text-bone/80">Rank and rewards</Link></span>
            </div>
          </div>
        </Hero>

        <div className="mb-6 max-w-[420px]"><Seg value={tab} onChange={setTab} options={[{ v: "stats", label: "Overview" }, { v: "feed", label: `Feed · ${shared.length}` }, { v: "badges", label: `Badges · ${earned.length}/${BADGES.length}` }]} /></div>

        {tab === "stats" && (
          <Stagger className="xl:grid xl:grid-cols-[minmax(0,1fr)_var(--rail)] xl:gap-x-12 xl:items-start">
            <div className="min-w-0">
              {/* The block: where you are in the current four weeks */}
              <Item>
                <Section title="This block" aside={<Link href="/plan" className="text-xs text-smoke underline">Full plan</Link>}>
                  <div className="card overflow-hidden">
                    <div className="relative h-40 lg:h-48"><Photo src={sessionImage("full")} veil className="absolute inset-0" /><div className="on-photo absolute inset-x-0 bottom-0 p-4 lg:p-5"><span className="meta text-bone/80">Block {meso}{blockName ? ` · ${blockName}` : ""} · {week % 4 === 0 ? "recovery week" : `recovery week in ${4 - (week % 4)}`}</span><p className="display text-3xl lg:text-4xl">Week {week - firstWeekOf(meso) + 1} <em>of 4.</em></p></div></div>
                    <div className="grid grid-cols-4 gap-1 p-4 pb-3">{Array.from({ length: 4 }, (_, i) => { const n = firstWeekOf(meso) + i; return <span key={n} className={`h-1.5 rounded-full ${n < week ? "bg-volt" : n === week ? "bg-[var(--green)]" : "bg-line-strong"} ${i === 3 ? "opacity-60" : ""}`} />; })}</div>
                    <div className="grid grid-cols-3 divide-x divide-line border-t border-line text-center tnum">
                      <span className="py-4 grid gap-1.5"><strong className="numeral !text-[1.9rem] leading-none"><CountUp value={doneSessions} /></strong><span className="meta">sessions done</span></span>
                      <span className="py-4 grid gap-1.5"><strong className="numeral !text-[1.9rem] leading-none">{units.weight === "lb" ? <CountUp value={Math.round(kgToLb(stats.totals.volumeKg))} suffix=" lb" /> : <CountUp value={Math.round(stats.totals.volumeKg / 1000 * 10) / 10} decimals={1} suffix=" t" />}</strong><span className="meta">lifted</span></span>
                      <span className="py-4 grid gap-1.5"><strong className="numeral !text-[1.9rem] leading-none"><CountUp value={activeDays} /></strong><span className="meta">active days</span></span>
                    </div>
                  </div>
                </Section>
              </Item>

              <Item>
                <Section title="Records" aside={<span className="text-xs text-smoke">estimated 1RM from your best set</span>}>
                  {lifts.length === 0 ? <p className="text-sm text-smoke">Log a loaded set and your estimated maxes appear here with their trend.</p> : (
                    <ul className="grid gap-2">{lifts.map(([slug, v], i) => { const m = getExercise(slug)!; const t = trend(slug); const ratio = profile.weightKg ? v / profile.weightKg : 0; return (
                      <li key={slug} className="card overflow-hidden grid grid-cols-[72px_1fr_auto] items-center gap-4 pr-4">
                        <Link href={`/library/${slug}`} className="relative h-[72px]"><Photo src={exerciseImage(m, 240, 240)} className="absolute inset-0" /></Link>
                        <div className="min-w-0 py-3"><span className="meta">{i === 0 ? "Best lift" : m.pattern}</span><Link href={`/library/${slug}`} className="block font-medium truncate">{m.name}</Link>{t.length > 1 ? <Sparkline values={t} height={28} format={(x) => fmtLoad(x, units)} /> : <span className="text-[11px] text-smoke">{ratio ? `${ratio.toFixed(2)}× bodyweight` : `${t.length} set logged`}</span>}</div>
                        <span className="display text-2xl text-volt tnum">{fmtLoad(v, units)}</span>
                      </li>); })}</ul>
                  )}
                </Section>
              </Item>

              <Item>
                <Section title="Recent sessions">
                  {recent.length === 0 ? <p className="text-sm text-smoke">Nothing yet — your first logged session lands here.</p> : (
                    <ul className="grid gap-2 sm:grid-cols-2">{recent.map(({ l, s }) => (
                      <li key={l.id}><Link href={s ? `/session?id=${s.id}` : "/today"} className="card overflow-hidden block">
                        <div className="relative h-24"><Photo src={sessionImage(s?.kind ?? "full", 600, 300)} veil className="absolute inset-0" /><div className="on-photo absolute inset-x-0 bottom-0 p-3 flex items-end justify-between"><span className="display text-lg leading-none">{s?.title ?? "Session"}</span><span className="chip chip--volt tnum">+{l.xp} XP</span></div></div>
                        <div className="px-3 py-2 flex justify-between text-xs text-smoke tnum"><span>{l.startedAt.slice(0, 10)}</span><span>{Math.round((l.durationSec ?? 0) / 60)} min · {Math.round(l.volumeKg ?? 0).toLocaleString("en-US")} kg{l.avgRpe ? ` · RPE ${l.avgRpe.toFixed(1)}` : ""}</span></div>
                      </Link></li>))}</ul>
                  )}
                </Section>
              </Item>
            </div>

            <div className="min-w-0">
              <Item>
                <Section title="Consistency" aside={<span className="text-xs text-smoke tnum">{activeDays} active day{activeDays === 1 ? "" : "s"}</span>}>
                  <div className="card p-4 grid gap-3">
                    <Heatmap cells={cells} />
                    {weeksWithData >= 2 ? <div className="pt-2 border-t border-line"><span className="meta block mb-2">Training minutes · 8 weeks</span><Bars data={weekly} height={80} format={(v) => `${Math.round(v)} min`} /></div> : <p className="text-xs text-smoke">Sessions, routes, check-ins and full food days all count. Two weeks in, the minutes chart appears here.</p>}
                  </div>
                </Section>
              </Item>

              <Item>
                <Section title="Body" aside={wSeries.length > 1 ? <span className={`text-xs tnum ${wDelta <= 0 ? "text-volt" : "text-bone"}`}>{wDelta > 0 ? "+" : ""}{toUnitW(wDelta)} · {wSeries.length} weigh-ins</span> : undefined}>
                  <div className="card p-4 grid gap-3">
                    <div className="flex items-baseline justify-between"><span className="meta">Current</span><span className="display text-3xl tnum">{toUnitW(wSeries[wSeries.length - 1]?.kg ?? profile.weightKg)}</span></div>
                    {wSeries.length > 1 && <Sparkline values={wSeries.map((x) => (units.weight === "lb" ? kgToLb(x.kg) : x.kg))} labels={wSeries.map((x) => x.date)} height={48} format={(v) => `${Math.round(v * 10) / 10} ${units.weight}`} />}
                    <div className="flex gap-2"><input className="input tnum flex-1" inputMode="decimal" placeholder={`This morning · ${units.weight}`} value={w} onChange={(e) => setW(e.target.value)} /><Press><button type="button" className="pill pill--bone" onClick={weigh} disabled={!Number(w)}>Log</button></Press></div>
                    {readySeries.length > 1 && <div className="pt-2 border-t border-line"><div className="flex justify-between items-baseline mb-1"><span className="meta">Readiness · 14 check-ins</span><span className="text-xs tnum">{Math.round(readySeries.reduce((a, r) => a + r.score, 0) / readySeries.length)} avg</span></div><Sparkline values={readySeries.map((r) => r.score)} labels={readySeries.map((r) => r.date)} height={40} format={(v) => `${Math.round(v)} / 100`} /></div>}
                  </div>
                </Section>
              </Item>

              <Item>
                <Section title="Outside" aside={<Link href="/move" className="text-xs text-smoke underline">Move</Link>}>
                  <div className="card grid grid-cols-2 divide-x divide-line text-center tnum">
                    <span className="py-4 grid gap-1.5"><strong className="numeral !text-[1.9rem] leading-none">{fmtDist(stats.totals.distanceM, units)}</strong><span className="meta">{outside.length} activit{outside.length === 1 ? "y" : "ies"}</span></span>
                    <span className="py-4 grid gap-1.5"><strong className="numeral !text-[1.9rem] leading-none"><CountUp value={Math.round(stats.totals.elevGainM ?? 0)} suffix=" m" /></strong><span className="meta">climbed · {Math.round(((stats.totals.elevGainM ?? 0) / 8849) * 100)}% of Everest</span></span>
                  </div>
                </Section>
              </Item>

              {earned.length > 0 && (
                <Item>
                  <Section title="Latest badges" aside={<button type="button" className="text-xs text-smoke underline" onClick={() => setTab("badges")}>All</button>}>
                    <div className="flex gap-3 flex-wrap">{earned.slice(-6).map((b) => <span key={b.id} className="grid justify-items-center gap-1.5 w-[84px]"><BadgeEmblem id={b.id} pillar={b.pillar} earned size={56} /><span className="text-[11px] leading-tight text-center">{b.name}</span></span>)}</div>
                  </Section>
                </Item>
              )}
            </div>
          </Stagger>
        )}

        {tab === "feed" && (
          <Stagger className="grid gap-3 lg:grid-cols-2 lg:gap-4">
            {/* The community feed left the bottom bar; this is its door. */}
            <Item className="lg:col-span-2">
              <Link href="/feed" className="card p-4 flex items-center gap-3">
                <span className="w-10 h-10 rounded-full bg-[rgba(31,199,111,.14)] grid place-items-center shrink-0"><FeedIcon className="w-5 h-5" /></span>
                <span className="grid min-w-0 flex-1"><span className="font-medium">Community</span><span className="text-xs text-smoke">Who else showed up today</span></span>
                <span aria-hidden className="text-smoke">→</span>
              </Link>
            </Item>
            {shared.length === 0 ? (
              <Item><div className="card--photo"><Photo src={IMG.moveHero} veil soft className="h-40" /><div className="card__body p-5 grid gap-2 -mt-14"><p className="display text-2xl">Your <em>feed.</em></p><p className="text-sm text-smoke">Record an activity on Move and post it to your profile. Each one shows here with its route, splits and the XP it earned.</p><Link href="/move" className="pill pill--sm pill--volt justify-self-start">Record something</Link></div></div></Item>
            ) : shared.map((a) => (
              <Item key={a.id}>
                <Link href={`/move/activity?id=${a.id}`} className="card overflow-hidden block">
                  <div className="flex items-center gap-3 p-3"><span className="w-9 h-9 rounded-full bg-volt text-ink grid place-items-center font-bold text-sm">{profile.name.slice(0, 1).toUpperCase()}</span><span className="grid"><span className="text-sm font-medium">{profile.name}</span><span className="text-[11px] text-smoke">{(a.sharedAt ?? a.startedAt).slice(0, 10)} · <span className="capitalize">{a.type}</span></span></span><span className="ml-auto chip chip--volt tnum">+{a.xp} XP</span></div>
                  <div className="relative h-44 bg-graphite grid place-items-center"><MiniRoute points={a.points} size={160} /><div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(10,10,10,.6))] pointer-events-none" /></div>
                  <div className="p-3 grid gap-2"><p className="font-semibold">{a.title}</p><div className="grid grid-cols-4 gap-2 text-center"><span className="grid"><span className="meta">Dist</span><span className="tnum text-sm">{fmtDist(a.distanceM, units)}</span></span><span className="grid"><span className="meta">Time</span><span className="tnum text-sm">{fmtDuration(a.durationSec)}</span></span><span className="grid"><span className="meta">Climb</span><span className="tnum text-sm">{Math.round(a.elevGainM)} m</span></span><span className="grid"><span className="meta">Feel</span><span className="tnum text-sm">{a.feel ? `${a.feel}/5` : "—"}</span></span></div></div>
                </Link>
              </Item>
            ))}
          </Stagger>
        )}

        {tab === "badges" && (
          <>
            <p className="text-sm text-smoke mb-5 max-w-[60ch]">
              {earned.length} of {BADGES.length} earned. Locked badges show how far along you are — most of them come from simply continuing.
            </p>
            <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {BADGES.map((b, i) => {
                const on = stats.badges.includes(b.id);
                const p = b.progress?.(stats, ctx);
                return (
                  <Reveal key={b.id} delay={i * 0.02}>
                    <li className={`card h-full p-4 grid justify-items-center text-center gap-2 ${on ? "border-line-strong" : ""}`}>
                      <BadgeEmblem id={b.id} pillar={b.pillar} earned={on} progress={p} size={76} />
                      <span className="text-sm font-medium leading-tight">{b.name}</span>
                      <span className="text-xs text-smoke leading-tight">{b.desc}</span>
                      {on
                        ? <span className="chip chip--volt mt-1">Earned</span>
                        : p && <span className="text-[11px] text-smoke tnum mt-1">{Math.round(p[0]).toLocaleString("en-US")} / {p[1].toLocaleString("en-US")}</span>}
                    </li>
                  </Reveal>
                );
              })}
            </ul>
          </>
        )}
        <Toast text={toast} />
      </Screen>
    </Page>
  );
}

function goalLine(goal: string) {
  return ({ strength: "getting strong.", build: "building muscle.", recomp: "recomposition.", cut: "getting lean.", endurance: "going long.", perform: "training for a date." } as Record<string, string>)[goal] ?? "in training.";
}

function weeklyMinutes(logs: { startedAt: string; durationSec?: number }[], acts: { startedAt: string; durationSec: number }[]) {
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const monday = new Date(now); monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  return Array.from({ length: 8 }, (_, i) => {
    const start = new Date(monday); start.setDate(monday.getDate() - (7 - i) * 7);
    const end = new Date(start); end.setDate(start.getDate() + 7);
    const inWeek = (d: string) => { const x = new Date(d); return x >= start && x < end; };
    const min = logs.filter((l) => inWeek(l.startedAt)).reduce((s, l) => s + (l.durationSec ?? 0) / 60, 0) + acts.filter((a) => inWeek(a.startedAt)).reduce((s, a) => s + a.durationSec / 60, 0);
    return { label: i === 7 ? "now" : start.toLocaleDateString("en-US", { month: "short", day: "numeric" }), value: Math.round(min) };
  });
}
