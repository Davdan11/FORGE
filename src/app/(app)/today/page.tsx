"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { db, getProfile, getStats, todayISO, addDays } from "@/lib/db";
import { readinessScore, autoRegulate, PAIN_LABEL } from "@/lib/engine/readiness";
import { buildNutritionDay, dayTotals, nudgesFor } from "@/lib/nutrition/engine";
import { getMeal } from "@/lib/nutrition/recipes";
import { awardReadiness, bestE1rmBySlug } from "@/lib/progress";
import { levelFromXp, rankFor } from "@/lib/gamification";
import { getExercise } from "@/lib/data/exercises";
import { sessionImage, IMG } from "@/lib/data/images";
import { MoveMedia } from "@/components/MoveMedia";
import { MobilityFlow } from "@/components/MobilityFlow";
import { Check, ChevronRight, Flame } from "lucide-react";
import { dailyQuests, markFlowDone } from "@/lib/quests";
import { fmtLoad, e1rm } from "@/lib/units";
import { Screen, Hero, Section, Seg, MultiSeg, Bar, Toast, Photo, ScreenSkeleton } from "@/components/ui";
import { Page, Stagger, Item, Ring, CountUp, Press, motion, AnimatePresence } from "@/components/motion";
import { Sparkline } from "@/components/charts";
import { atTime, ensureNotificationPermission, scheduleLocal } from "@/lib/notify";
import type { NutritionDay, PainArea, Readiness, Session } from "@/lib/types";

export default function Today() {
  const today = todayISO();
  const profile = useLiveQuery(() => getProfile(), []);
  const stats = useLiveQuery(() => getStats(), []);
  const session = useLiveQuery(() => db.sessions.where("date").equals(today).first(), [today]);
  const readiness = useLiveQuery(() => db.readiness.get(today), [today]);
  const readinessWeek = useLiveQuery(() => db.readiness.where("date").between(addDays(today, -6), today, true, true).sortBy("date"), [today]) ?? [];
  const nutrition = useLiveQuery(() => db.nutrition.get(today), [today]);
  const logs = useLiveQuery(() => db.logs.orderBy("startedAt").reverse().limit(12).toArray(), []) ?? [];
  const activities = useLiveQuery(() => db.activities.orderBy("startedAt").reverse().limit(5).toArray(), []) ?? [];
  const best = useLiveQuery(() => bestE1rmBySlug(), []) ?? {};
  const [toast, setToast] = useState<string | null>(null);
  const [flow, setFlow] = useState(false);
  const [now] = useState(() => Date.now());
  const say = (t: string, ms = 3500) => { setToast(t); setTimeout(() => setToast(null), ms); };

  useEffect(() => {
    if (!profile || nutrition !== null) return;
    (async () => {
      const yesterday = await db.nutrition.get(addDays(today, -1));
      const recent = (await db.nutrition.where("date").between(addDays(today, -3), addDays(today, -1), true, true).toArray()).flatMap((d) => d.meals.map((m) => m.mealId));
      await db.nutrition.put({ ...buildNutritionDay(profile, today, session ?? null, yesterday ?? undefined, recent), dirty: 1 });
    })();
  }, [profile, nutrition, session, today]);

  // Week ring: planned vs done (sessions + activities) this ISO week.
  const week = useMemo(() => { const d = new Date(today + "T00:00:00"); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); const mon = d.toISOString().slice(0, 10); return { mon, sun: addDays(mon, 6) }; }, [today]);
  const weekSessions = useLiveQuery(() => db.sessions.where("date").between(week.mon, week.sun, true, true).toArray(), [week.mon]) ?? [];

  if (!profile || !stats || session === undefined) return <ScreenSkeleton />;
  const lvl = levelFromXp(stats.xp);
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Morning" : hour < 18 ? "Afternoon" : "Evening";
  const weekday = new Date().toLocaleDateString("en-US", { weekday: "long" });
  const doneThisWeek = weekSessions.filter((s) => s.status === "done").length;
  const lastLog = logs[0];
  const sinceLast = lastLog ? Math.round((now - new Date(lastLog.startedAt).getTime()) / 3600000) : null;
  const activitiesToday = activities.filter((a) => a.startedAt.slice(0, 10) === today);
  const quests = dailyQuests({ date: today, readiness, session, nutrition, activitiesToday });
  const questsDone = quests.filter((q) => q.done).length;
  const questXp = quests.filter((q) => q.done).reduce((a, q) => a + q.xp, 0);
  const sleepDebt = readinessWeek.length ? Math.round(readinessWeek.reduce((a, r) => a + Math.max(0, 8 - r.sleepHours), 0) * 10) / 10 : 0;

  return (
    <Page>
      <Screen>
        <Hero image={session ? sessionImage(session.kind) : IMG.restDay} height="h-[360px]" eyebrow={`${greet}, ${profile.name} · ${weekday}`}
          title={<>{session ? session.title : "Rest day"}<br /><em>{session ? (session.status === "done" ? "done." : session.status === "adjusted" ? "adjusted for today." : `week ${session.week} · ${session.minutes} min`) : "move, gently."}</em></>}
          right={<Link href="/progress" className="flex items-center gap-3 chip chip--live backdrop-blur-md py-1.5"><Ring value={lvl.into / lvl.need} size={34} stroke={3}><span className="text-[11px] font-semibold tnum">{lvl.level}</span></Ring><span className="grid leading-tight text-left"><span className="text-[10px] text-smoke">{rankFor(lvl.level)}</span><span className="text-xs tnum">{lvl.into.toLocaleString("en-US")} / {lvl.need.toLocaleString("en-US")} XP</span></span></Link>}>
          <div className="flex gap-1.5 flex-wrap mt-3">
            <span className="chip chip--live backdrop-blur-md tnum">{doneThisWeek}/{weekSessions.length} this week</span>
            <span className="chip chip--live backdrop-blur-md tnum">{stats.streakWeeks} wk streak</span>
            {nutrition && <span className="chip chip--live backdrop-blur-md tnum">{nutrition.targets.kcal} kcal</span>}
            {readiness && <span className="chip chip--volt tnum">Readiness {readiness.score}</span>}
          </div>
        </Hero>

        <Stagger className="lg:grid lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-x-10 lg:items-start">
          <div className="min-w-0">
          {/* Player card + daily quests: the game loop, visible */}
          <Item>
            <div className="card overflow-hidden mb-6 lg:mb-8">
              <div className="p-4 lg:p-5 grid grid-cols-[auto_1fr_auto] gap-4 items-center">
                <Ring value={lvl.into / lvl.need} size={72} stroke={6}><span className="display text-2xl tnum">{lvl.level}</span></Ring>
                <div className="grid gap-1 min-w-0">
                  <span className="meta">{rankFor(lvl.level)} · level {lvl.level}</span>
                  <div className="bar"><i style={{ width: `${(lvl.into / lvl.need) * 100}%` }} /></div>
                  <span className="text-xs text-smoke tnum">{(lvl.need - lvl.into).toLocaleString("en-US")} XP to level {lvl.level + 1}</span>
                </div>
                <div className="text-right"><span className="flex items-center gap-1 justify-end text-sm font-semibold tnum"><Flame className="w-4 h-4 text-volt" strokeWidth={2} />{stats.streakWeeks} wk</span><span className="meta">streak</span></div>
              </div>
              <ul className="divide-y divide-line border-t border-line">
                {quests.map((qst) => {
                  const inner = (
                    <>
                      <span className={`w-7 h-7 rounded-full grid place-items-center border shrink-0 ${qst.done ? "bg-volt border-volt text-ink" : "border-line-strong text-transparent"}`}><Check className="w-4 h-4" strokeWidth={3} /></span>
                      <span className="min-w-0 flex-1"><span className={`block text-sm font-medium truncate ${qst.done ? "line-through text-smoke" : ""}`}>{qst.label}</span><span className="block text-xs text-smoke truncate">{qst.progress && !qst.done ? `${qst.progress[0]} / ${qst.progress[1]} · ` : ""}{qst.detail}</span></span>
                      <span className={`chip tnum ${qst.done ? "chip--volt" : ""}`}>+{qst.xp} XP</span>
                      {!qst.done && <ChevronRight className="w-4 h-4 text-smoke shrink-0" />}
                    </>
                  );
                  const cls = "flex items-center gap-3 px-4 py-3 w-full text-left";
                  return <li key={qst.id}>{qst.action === "flow" ? <button type="button" className={cls} onClick={() => setFlow(true)}>{inner}</button> : qst.href === "#readiness" ? <a href="#readiness" className={cls}>{inner}</a> : <Link href={qst.href ?? "/today"} className={cls}>{inner}</Link>}</li>;
                })}
              </ul>
              <div className="px-4 py-2.5 border-t border-line flex justify-between text-xs text-smoke tnum"><span>Today’s quests</span><span>{questsDone}/{quests.length} · +{questXp} XP earned</span></div>
            </div>
          </Item>

          <Item>
            <AnimatePresence mode="wait">
              {!readiness ? (
                <motion.div key="check" id="readiness" exit={{ opacity: 0, y: -10 }}>
                  <ReadinessCheck session={session ?? null} onDone={async (r) => { const xp = await awardReadiness(); say(`Checked in. +${xp} XP. ${r.score >= 65 ? "Green light — train as planned." : r.score >= 40 ? "Amber — session adjusted." : "Red — session rewritten, easier day."}`); }} />
                </motion.div>
              ) : (
                <motion.div key="score" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                  <Section title="Readiness" aside={<button className="text-xs text-smoke underline" onClick={() => db.readiness.delete(today)}>Redo</button>}>
                    <div className="card p-4 grid gap-4">
                      <div className="grid grid-cols-[auto_1fr] gap-4 items-center">
                        <Ring value={readiness.score / 100} size={92} stroke={7} color={readiness.score >= 65 ? "var(--volt)" : readiness.score >= 40 ? "var(--bone)" : "var(--danger)"}><strong className="display text-3xl"><CountUp value={readiness.score} /></strong></Ring>
                        <div className="grid gap-1 text-sm">
                          <span>Sleep {readiness.sleepHours} h · soreness {readiness.soreness}/5 · stress {readiness.stress}/5</span>
                          <span className="text-smoke text-xs">{session?.adjustment?.reason ?? "Train as planned. Chase the target RPE, not a number."}</span>
                          {sleepDebt > 0 && <span className="text-xs"><span className="chip mr-1">Sleep debt</span>{sleepDebt} h under 8 h over the last {readinessWeek.length} day{readinessWeek.length > 1 ? "s" : ""}.</span>}
                        </div>
                      </div>
                      {readinessWeek.length > 1 && <div><span className="meta block mb-1">7-day trend</span><Sparkline values={readinessWeek.map((r) => r.score)} labels={readinessWeek.map((r) => r.date.slice(5))} height={44} format={(v) => `${Math.round(v)} / 100`} /></div>}
                    </div>
                  </Section>
                </motion.div>
              )}
            </AnimatePresence>
          </Item>

          <Item>
            {session ? <SessionCard session={session} units={profile.units} best={best} /> : (
              <Section title="Rest day · guided mobility">
                <Press>
                  <button type="button" onClick={() => setFlow(true)} className="card--photo block w-full text-left">
                    <Photo src={IMG.restDay} veil className="h-44" />
                    <div className="card__body p-5 grid gap-2 -mt-16">
                      <p className="display text-2xl">Twelve minutes of <em>mobility.</em></p>
                      <p className="text-sm text-smoke">Six moves, two minutes each, the app counts and buzzes at every switch: 90/90 · couch · thoracic · deep squat · WGS · hamstring floss.</p>
                      <span className="pill pill--sm pill--volt justify-self-start mt-1">Start the flow · +66 XP</span>
                    </div>
                  </button>
                </Press>
              </Section>
            )}
          </Item>

          </div>
          <div className="min-w-0">
          <Item>
            <Section title="Recovery">
              <div className="card p-4 grid grid-cols-[auto_1fr] gap-4 items-center">
                <Ring value={sinceLast == null ? 1 : Math.min(1, sinceLast / 48)} size={72} stroke={6} color={sinceLast != null && sinceLast < 24 ? "var(--bone)" : "var(--volt)"}><span className="text-sm font-semibold tnum">{sinceLast == null ? "—" : sinceLast < 48 ? `${sinceLast}h` : `${Math.round(sinceLast / 24)}d`}</span></Ring>
                <div className="grid gap-1 text-sm">
                  <span className="font-medium">{sinceLast == null ? "No session logged yet" : sinceLast < 24 ? "Trained today — recovery in progress" : sinceLast < 48 ? "Recovering — legs and back need 48 h between heavy days" : "Fully recovered. Go."}</span>
                  <span className="text-xs text-smoke">{lastLog ? `Last: ${lastLog.startedAt.slice(0, 10)} · ${Math.round((lastLog.durationSec ?? 0) / 60)} min · ${Math.round(lastLog.volumeKg ?? 0).toLocaleString("en-US")} kg` : "Your first session unlocks the recovery clock."}{activities[0] ? ` · last route ${activities[0].startedAt.slice(0, 10)}` : ""}</span>
                </div>
              </div>
            </Section>
          </Item>

          <Item>{nutrition && <FoodToday nutrition={nutrition} notifications={profile.notifications} sessionTitle={session?.title} onNotify={async () => {
            const perm = await ensureNotificationPermission();
            if (perm !== "granted") { say(perm === "denied" ? "Notifications are blocked in your browser settings." : "Notifications aren’t supported here."); return; }
            await db.profile.update(profile.id, { notifications: true, dirty: 1 });
            const tomorrow = await db.nutrition.get(addDays(today, 1));
            nudgesFor(nutrition, session ?? null, tomorrow ?? undefined).forEach((n, i) => scheduleLocal(`nudge-${today}-${i}`, atTime(today, n.time), n.title, n.body));
            say("Nudges scheduled around today’s session.");
          }} />}</Item>

          <Item>
            <Section title="This week" aside={<Link href="/plan" className="text-xs text-smoke underline">Block</Link>}>
              <WeekStrip today={today} sessions={weekSessions} mon={week.mon} />
            </Section>
          </Item>
          </div>
        </Stagger>
        <Toast text={toast} />
        <AnimatePresence>{flow && <MobilityFlow onClose={(xp) => { setFlow(false); if (xp) { markFlowDone(today); say(`Flow logged. +${xp} XP.`); } }} />}</AnimatePresence>
      </Screen>
    </Page>
  );
}


function SessionCard({ session, units, best }: { session: Session; units: "metric" | "imperial"; best: Record<string, number> }) {
  const muscles = [...new Set(session.exercises.flatMap((e) => getExercise(e.slug)?.primary ?? []))].slice(0, 6);
  const plannedVolume = session.exercises.reduce((a, e) => a + e.sets.reduce((b, s) => b + (s.loadKg ?? 0) * (s.reps ?? 0), 0), 0);
  const main = session.exercises.find((e) => e.block === "main");
  const mainMeta = main ? getExercise(main.slug) : undefined;
  const mainSet = main?.sets[0];
  const mainBest = main ? best[main.slug] : undefined;
  const delta = mainSet?.loadKg && mainSet.reps && mainBest ? e1rm(mainSet.loadKg, mainSet.reps) - mainBest : undefined;
  return (
    <Section title="Today’s session" aside={<Link href="/plan" className="text-xs text-smoke underline">Week {session.week} · block</Link>}>
      <div className="card overflow-hidden">
        {mainMeta && mainSet && (
          <div className="relative h-[220px] lg:h-[300px] border-b border-line overflow-hidden">
            <MoveMedia ex={mainMeta} fill />
            <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/40 to-transparent" />
            <div className="on-photo absolute inset-x-0 bottom-0 p-4 lg:p-6">
            <span className="meta">Main lift</span>
            <p className="display text-3xl lg:text-4xl mt-1">{mainMeta.name}</p>
            <p className="text-sm tnum mt-1">{main!.sets.length} × {mainSet.reps ?? `${mainSet.seconds}s`}{mainSet.loadKg ? ` · ${fmtLoad(mainSet.loadKg, units)}` : ""}{mainSet.rpe ? ` · RPE ${mainSet.rpe}` : ""}</p>
            {delta != null && Math.abs(delta) >= 1 && <p className={`text-xs mt-1 ${delta >= 0 ? "text-volt" : "text-smoke"}`}>{delta >= 0 ? "▲" : "▼"} {fmtLoad(Math.abs(delta), units)} e1RM vs your best</p>}
            </div>
          </div>
        )}
        <div className="px-4 pt-3 flex flex-wrap items-center gap-1.5"><span className="meta mr-1">Muscles</span>{muscles.map((m) => <span key={m} className="chip">{m.replace("_", " ")}</span>)}<span className="chip chip--live tnum ml-auto">{Math.round(plannedVolume).toLocaleString("en-US")} kg planned</span></div>
        {session.adjustment && <div className="px-4 pt-3"><span className="chip chip--volt">Adjusted today</span><ul className="grid gap-1 text-xs text-smoke mt-2">{session.adjustment.changes.map((c) => <li key={c}>· {c}</li>)}</ul></div>}
        {session.cardio && <div className="px-4 pt-3 flex items-center justify-between gap-3"><div><span className="meta">Cardio · Zone {session.cardio.zone}</span><p className="display text-xl">{session.cardio.minutes} min{session.cardio.structure ? ` · ${session.cardio.structure}` : ""}</p></div><Link href="/move" className="pill pill--sm">Record</Link></div>}
        <ul className="grid divide-y divide-line mt-3 border-t border-line">
          {session.exercises.map((ex) => {
            const meta = getExercise(ex.slug); if (!meta) return null;
            const first = ex.sets[0];
            return (
              <li key={ex.id}>
                <Link href={`/library/${ex.slug}`} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="thumb !w-14 !h-14 relative overflow-hidden"><MoveMedia ex={meta} fill /></span>
                  <span className="min-w-0 flex-1"><span className="block font-medium truncate">{meta.name}</span><span className="meta">{ex.block}{meta.tempo ? ` · ${meta.tempo}` : ""}</span></span>
                  <span className="tnum text-right text-sm"><span className="block">{ex.sets.length} × {first.seconds ? `${first.seconds}s` : first.reps}</span>{first.loadKg && <span className="text-xs text-smoke">{fmtLoad(first.loadKg, units)}</span>}</span>
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="p-4 grid gap-3 border-t border-line">
          <p className="text-xs text-smoke">{session.why}</p>
          <Press><Link href={`/session/${session.id}`} className="pill pill--volt pill--block pill--lg">{session.status === "done" ? "Review session" : "Start session"}</Link></Press>
        </div>
      </div>
    </Section>
  );
}

function WeekStrip({ today, sessions, mon }: { today: string; sessions: Session[]; mon: string }) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(mon, i));
  return (
    <div className="grid grid-cols-7 gap-1.5">
      {days.map((d) => {
        const s = sessions.find((x) => x.date === d);
        const on = d === today;
        return (
          <Link key={d} href={s ? `/session/${s.id}` : "/library?pattern=mobility"} className={`card p-2 grid justify-items-center gap-1 text-center ${on ? "border-volt" : ""} ${s?.status === "done" ? "bg-[rgba(212,255,58,.06)]" : ""}`}>
            <span className="meta">{new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "narrow" })}</span>
            <span className={`w-2 h-2 rounded-full ${s?.status === "done" ? "bg-volt" : s ? "bg-ink" : "bg-line-strong"}`} />
            <span className="text-[10px] text-smoke truncate w-full">{s ? s.title.split(" ")[0] : "Mob."}</span>
          </Link>
        );
      })}
    </div>
  );
}

function ReadinessCheck({ session, onDone }: { session: Session | null; onDone: (r: Readiness) => void }) {
  const [sleep, setSleep] = useState(7);
  const [quality, setQuality] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [soreness, setSoreness] = useState<1 | 2 | 3 | 4 | 5>(2);
  const [stress, setStress] = useState<1 | 2 | 3 | 4 | 5>(2);
  const [mood, setMood] = useState<1 | 2 | 3 | 4 | 5>(4);
  const [hrv, setHrv] = useState("");
  const [minutes, setMinutes] = useState<number | undefined>(undefined);
  const [gear, setGear] = useState<Readiness["equipmentToday"]>("full");
  const [pain, setPain] = useState<PainArea[]>([]);
  const [open, setOpen] = useState(false);
  const five = [1, 2, 3, 4, 5].map((n) => ({ v: n as 1 | 2 | 3 | 4 | 5, label: String(n) }));
  const preview = readinessScore({ sleepHours: sleep, sleepQuality: quality, soreness, stress, mood });

  async function submit() {
    const profile = await getProfile(); if (!profile) return;
    const base = { sleepHours: sleep, sleepQuality: quality, soreness, stress, mood, hrv: hrv ? Number(hrv) : undefined, minutesAvailable: minutes, equipmentToday: gear, painToday: pain };
    const r: Readiness = { id: todayISO(), date: todayISO(), ...base, score: readinessScore(base) };
    await db.readiness.put({ ...r, dirty: 1 });
    if (session && session.status === "planned") { const adj = autoRegulate(profile, session, r); await db.sessions.put({ ...adj.session, dirty: 1 }); }
    onDone(r);
  }

  return (
    <Section title="Check in" aside={<span className="text-xs text-smoke">20 s · +20 XP</span>}>
      <div className="card p-4 grid gap-4">
        <div className="flex items-center gap-4">
          <Ring value={preview / 100} size={64} stroke={5} color={preview >= 65 ? "var(--volt)" : preview >= 40 ? "var(--bone)" : "var(--danger)"}><span className="text-sm font-semibold tnum">{preview}</span></Ring>
          <p className="text-sm text-smoke">How you slept and feel decides today’s load. Honest answers make a better session.</p>
        </div>
        <div className="field"><span className="meta">Sleep last night · {sleep} h</span><input type="range" min={3} max={11} step={0.5} value={sleep} onChange={(e) => setSleep(Number(e.target.value))} style={{ ["--fill" as string]: `${((sleep - 3) / 8) * 100}%` }} className="w-full" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="field"><span className="meta">Sleep quality</span><Seg value={quality} onChange={setQuality} options={five} /></div>
          <div className="field"><span className="meta">Soreness</span><Seg value={soreness} onChange={setSoreness} options={five} /></div>
          <div className="field"><span className="meta">Stress</span><Seg value={stress} onChange={setStress} options={five} /></div>
          <div className="field"><span className="meta">Mood</span><Seg value={mood} onChange={setMood} options={five} /></div>
        </div>
        <button type="button" className="text-left text-xs text-smoke underline" onClick={() => setOpen(!open)}>{open ? "Hide" : "Real-life mode: time, gear, pain, HRV"}</button>
        <AnimatePresence>{open && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="grid gap-4 overflow-hidden">
            <div className="field"><span className="meta">Minutes I actually have</span><Seg value={minutes ?? 0} onChange={(v) => setMinutes(v || undefined)} options={[{ v: 0, label: "As planned" }, { v: 25, label: "25" }, { v: 40, label: "40" }, { v: 60, label: "60" }]} /></div>
            <div className="field"><span className="meta">Gear today</span><Seg value={gear ?? "full"} onChange={setGear} options={[{ v: "full", label: "Full gym" }, { v: "dumbbells", label: "Dumbbells" }, { v: "bodyweight", label: "Nothing" }]} /></div>
            <div className="field"><span className="meta">Anything talking?</span><MultiSeg value={pain} onChange={setPain} options={(Object.keys(PAIN_LABEL) as PainArea[]).map((k) => ({ v: k, label: PAIN_LABEL[k] }))} /></div>
            <label className="field"><span className="meta">HRV (ms, optional)</span><input className="input tnum" inputMode="numeric" value={hrv} onChange={(e) => setHrv(e.target.value)} placeholder="From your watch" /></label>
          </motion.div>
        )}</AnimatePresence>
        <Press><button type="button" className="pill pill--bone pill--block" onClick={submit}>{session ? "Check in & adjust today" : "Check in"}</button></Press>
      </div>
    </Section>
  );
}

function FoodToday({ nutrition, notifications, sessionTitle, onNotify }: { nutrition: NutritionDay; notifications: boolean; sessionTitle?: string; onNotify: () => void }) {
  const t = dayTotals(nutrition);
  const next = nutrition.meals.find((m) => !m.done);
  const meal = next ? getMeal(next.mealId) : undefined;
  return (
    <Section title="Food" aside={<Link href="/food" className="text-xs text-smoke underline">Full day</Link>}>
      <div className="card overflow-hidden">
        {meal && next && (
          <Link href={`/food/${encodeURIComponent(meal.id)}?date=${nutrition.date}`} className="block relative">
            <Photo src={meal.image} veil color className="h-44" />
            <div className="on-photo absolute inset-x-0 bottom-0 p-4 grid gap-0.5">
              <span className="meta text-bone/80">Next · {next.time} · {next.slot}</span>
              <span className="display text-2xl">{meal.name.split(" with ")[0]}</span>
              <span className="text-xs text-smoke tnum">{Math.round(meal.kcal * next.scale)} kcal · {Math.round(meal.protein * next.scale)} g protein · {Math.round(meal.sugar * next.scale)} g sugar · {meal.minutes} min</span>
            </div>
          </Link>
        )}
        <div className="p-4 grid gap-3">
          <div className="flex items-baseline justify-between text-sm"><span>{nutrition.dayType === "rest" ? "Rest day" : nutrition.dayType === "hard" ? "Hard day" : "Training day"}{sessionTitle ? ` · ${sessionTitle}` : ""}</span><span className="tnum text-xs text-smoke">{nutrition.meals.filter((m) => m.done).length}/{nutrition.meals.length} meals · {nutrition.targets.kcal} kcal</span></div>
          <Bar value={nutrition.meals.filter((m) => m.done).length} max={nutrition.meals.length} />
          <div className="grid grid-cols-4 gap-2 text-xs text-smoke tnum"><span>P {Math.round(t.protein)} g</span><span>C {Math.round(t.carbs)} g</span><span>F {Math.round(t.fat)} g</span><span>S {Math.round(t.sugar)} g</span></div>
          {!notifications && <button type="button" className="pill pill--sm justify-self-start" onClick={onNotify}>Enable meal nudges</button>}
        </div>
      </div>
    </Section>
  );
}
