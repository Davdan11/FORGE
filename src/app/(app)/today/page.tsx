"use client";

import { APP_NAME } from "@/lib/brand";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { db, getProfile, getStats, todayISO, addDays } from "@/lib/db";
import { readinessScore, autoRegulate, PAIN_LABEL } from "@/lib/engine/readiness";
import { adaptationsFor } from "@/lib/engine/injury";
import { buildNutritionDay, eatenTotals } from "@/lib/nutrition/engine";
import { getMeal } from "@/lib/nutrition/recipes";
import { awardReadiness, bestE1rmBySlug } from "@/lib/progress";
import { levelFromXp, rankFor, subRankFor, tierForLevel } from "@/lib/gamification";
import { RankEmblem } from "@/components/RankEmblem";
import { getExercise } from "@/lib/data/exercises";
import { ART, IMG } from "@/lib/data/images";
import { MoveMedia } from "@/components/MoveMedia";
import { MobilityFlow } from "@/components/MobilityFlow";
import { Check, ChevronRight, Flame } from "lucide-react";
import { dailyQuests, markFlowDone } from "@/lib/quests";
import { fmtLoad, e1rm } from "@/lib/units";
import { Screen, Hero, Section, RadioField, MultiSeg, RatingScale, Bar, Toast, Photo, ScreenSkeleton } from "@/components/ui";
import { Page, Stagger, Item, Ring, CountUp, Press, motion, AnimatePresence } from "@/components/motion";
import { Sparkline } from "@/components/charts";
import { ensureNotificationPermission } from "@/lib/notify";
import { syncReminders } from "@/lib/remindersSync";
import { sessionTitle } from "@/lib/engine/plan";
import { useT, useLang, locale, bilingual, loc } from "@/lib/i18n";
import type { MealSlot, NutritionDay, PainArea, PrescribedExercise, Readiness, Session, UnitPrefs } from "@/lib/types";

/* Labels for data keys that reach the screen. English shows the key itself, as before. */
const BLOCK_FR: Record<PrescribedExercise["block"], string> = { prep: "préparation", main: "principal", accessory: "accessoire", finisher: "finition", cooldown: "retour au calme" };
const SLOT_FR: Record<MealSlot, string> = { breakfast: "déjeuner", lunch: "dîner", snack: "collation", dinner: "souper", pre: "pré-entraînement", post: "post-entraînement" };

export default function Today() {
  const today = todayISO();
  const profile = useLiveQuery(() => getProfile(), []);
  const stats = useLiveQuery(() => getStats(), []);
  const session = useLiveQuery(() => db.sessions.where("date").equals(today).first().then((s) => s ?? null), [today]);
  const readiness = useLiveQuery(() => db.readiness.get(today), [today]);
  const readinessWeek = useLiveQuery(() => db.readiness.where("date").between(addDays(today, -6), today, true, true).sortBy("date"), [today]) ?? [];
  const nutrition = useLiveQuery(() => db.nutrition.get(today).then((n) => n ?? null), [today]);
  const logs = useLiveQuery(() => db.logs.orderBy("startedAt").reverse().limit(12).toArray(), []) ?? [];
  const activities = useLiveQuery(() => db.activities.orderBy("startedAt").reverse().limit(5).toArray(), []) ?? [];
  const best = useLiveQuery(() => bestE1rmBySlug(), []) ?? {};
  const [toast, setToast] = useState<string | null>(null);
  const [flow, setFlow] = useState(false);
  const [now] = useState(() => Date.now());
  const t = useT();
  const lang = useLang();
  const say = (msg: string, ms = 3500) => { setToast(msg); setTimeout(() => setToast(null), ms); };

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
  const plan = useLiveQuery(() => db.plans.orderBy("startDate").last().then((p) => p ?? null), []);
  const weekSessions = useLiveQuery(() => db.sessions.where("date").between(week.mon, week.sun, true, true).toArray(), [week.mon]) ?? [];

  if (!profile || !stats || session === undefined) return <ScreenSkeleton />;
  const lvl = levelFromXp(stats.xp);
  const hour = new Date().getHours();
  const greet = hour < 12 ? t("Bonjour", "Morning") : hour < 18 ? t("Bon après-midi", "Afternoon") : t("Bonsoir", "Evening");
  const weekday = new Date().toLocaleDateString(locale(), { weekday: "long" });
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
        <Hero image={ART.today} color height="h-[420px]" eyebrow={`${greet}, ${profile.name} · ${weekday}`}
          title={<>{session ? sessionTitle(session.kind) : t("Jour de repos", "Rest day")}<br /><em className="slab">{session ? (session.status === "done" ? t("faite.", "done.") : session.status === "adjusted" ? t("ajustée pour aujourd’hui.", "adjusted for today.") : t(`semaine ${session.week}.`, `week ${session.week}.`)) : t("bouge en douceur.", "move, gently.")}</em></>}
          right={<Link href="/ranks" className="flex items-center gap-3 chip chip--live backdrop-blur-md py-1.5"><RankEmblem tier={tierForLevel(lvl.level)} sub={subRankFor(lvl.level)} size={32} className="shrink-0" /><span className="grid leading-tight text-left"><span className="text-[10px] text-smoke">{rankFor(lvl.level, lang)}</span><span className="text-xs tnum">{lvl.into.toLocaleString(locale())} / {lvl.need.toLocaleString(locale())} XP</span></span></Link>}
          stats={[
            { label: t("Cette semaine", "This week"), value: `${doneThisWeek}/${weekSessions.length}` },
            { label: t("Semaines d’affilée", "Week streak"), value: stats.streakWeeks },
            ...(nutrition ? [{ label: t("Kcal aujourd’hui", "Kcal today"), value: nutrition.targets.kcal.toLocaleString(locale()) }] : []),
            ...(readiness ? [{ label: t("Forme", "Readiness"), value: readiness.score }] : []),
          ]}>
          <div className="flex gap-1.5 flex-wrap lg:hidden">
            <span className="chip chip--live backdrop-blur-md tnum">{weekSessions.length === 0 && plan && plan.startDate > todayISO()
              ? t(`Le plan commence ${new Date(plan.startDate + "T00:00:00").toLocaleDateString(locale(), { weekday: "long" })}`, `Plan starts ${new Date(plan.startDate + "T00:00:00").toLocaleDateString("en-US", { weekday: "long" })}`)
              : t(`${doneThisWeek}/${weekSessions.length} cette semaine`, `${doneThisWeek}/${weekSessions.length} this week`)}</span>
            {nutrition && <span className="chip chip--live backdrop-blur-md tnum">{nutrition.targets.kcal.toLocaleString(locale())} kcal</span>}
            {readiness && <span className="chip chip--volt tnum">{t("Forme", "Readiness")} {readiness.score}</span>}
          </div>
        </Hero>

        <Stagger className="xl:grid xl:grid-cols-[minmax(0,1fr)_var(--rail)] xl:gap-x-12 xl:items-start">
          <div className="min-w-0">
          {/* Back after a break: say so, ease the week, and point to the story so far. */}
          {plan?.comeback && today <= plan.comeback.until && (
            <Item>
              <div className="card p-4 mb-4 grid gap-2 border-l-4" style={{ borderLeftColor: "var(--volt)" }}>
                <span className="meta text-volt font-bold">{t("Bon retour", "Welcome back")}</span>
                <p className="display text-2xl leading-tight">{t("Content de te revoir, ", "Good to see you, ")}<em>{profile.name}.</em></p>
                <p className="text-sm text-smoke">{t(`${plan.comeback.daysAway} jours d’absence. Jusqu’à ${new Date(plan.comeback.until + "T00:00:00").toLocaleDateString(locale(), { weekday: "long" })}, tes charges sont ${Math.round((1 - plan.comeback.loadMul) * 100)} % plus légères et l’effort d’un point plus facile, pour que tu reprennes sans te blesser. Monte sur la balance cette semaine : tes cibles alimentaires suivent ton poids.`, `${plan.comeback.daysAway} days away. Until ${new Date(plan.comeback.until + "T00:00:00").toLocaleDateString("en-US", { weekday: "long" })}, your loads are ${Math.round((1 - plan.comeback.loadMul) * 100)} % lighter and the effort a point easier, so you rebuild without getting hurt. Step on the scale this week: your food targets follow your weight.`)}</p>
                <div className="flex gap-2 flex-wrap mt-1"><Link href="/journey" className="pill pill--sm">{t("Ton parcours", "Your journey")}</Link><Link href="/progress" className="pill pill--sm">{t("Noter ton poids", "Log your weight")}</Link></div>
              </div>
            </Item>
          )}

          {/* The numbers that move: readiness as a ring, the streak, the next level. */}
          <Item>
            <div className="grid grid-cols-[1.12fr_1fr] gap-3 mb-6 lg:mb-8">
              <a href="#readiness" className="card p-4 grid justify-items-center gap-2 text-center">
                <Ring value={readiness ? readiness.score / 100 : 0} size={128} stroke={11} color="grad">
                  {readiness
                    ? <><strong className="numeral !text-[2.6rem] tnum"><CountUp value={readiness.score} /></strong><span className="meta !text-[.62rem] mt-1">{t("Forme", "Readiness")}</span></>
                    : <><strong className="numeral !text-[2.4rem]">—</strong><span className="meta !text-[.62rem] mt-1">{t("Forme", "Readiness")}</span></>}
                </Ring>
                <span className="text-[11px] font-bold tracking-[.12em] uppercase" style={{ color: !readiness ? "var(--smoke)" : readiness.score >= 65 ? "var(--volt-deep)" : readiness.score >= 40 ? "#9a6414" : "var(--danger)" }}>
                  {!readiness ? t("Fais ton bilan", "Check in to score") : readiness.score >= 65 ? t("Feu vert", "Good to train") : readiness.score >= 40 ? t("Vas-y plus mollo", "Take it easier") : t("Journée récup", "Recovery day")}
                </span>
              </a>
              <div className="grid gap-3">
                <div className="card p-4 grid content-between">
                  <span className="meta">{t("Série", "Streak")}</span>
                  <span className="flex items-center gap-2 mt-2"><Flame className="w-7 h-7 flicker text-[#ff6a3d]" strokeWidth={2.2} fill="#ffb347" /><strong className="numeral !text-[2.2rem] tnum"><CountUp value={stats.streakWeeks} /></strong><span className="text-sm text-smoke font-semibold">{t("sem.", "wk")}</span></span>
                </div>
                <Link href="/ranks" className="card p-4 grid gap-2">
                  <span className="flex items-center justify-between gap-2"><span className="meta truncate">{rankFor(lvl.level, lang)} · {t("niv.", "lvl")} {lvl.level}</span><RankEmblem tier={tierForLevel(lvl.level)} sub={subRankFor(lvl.level)} size={30} className="shrink-0" /></span>
                  <span className="flex items-baseline gap-1"><strong className="numeral !text-[2rem] tnum"><CountUp value={lvl.need - lvl.into} /></strong><span className="text-sm text-smoke font-semibold">{t("XP à faire", "xp to go")}</span></span>
                  <div className="bar"><i style={{ width: `${(lvl.into / lvl.need) * 100}%` }} /></div>
                </Link>
              </div>
            </div>
          </Item>

          {/* Daily quests: the game loop, visible */}
          <Item>
            <div className="card overflow-hidden mb-6 lg:mb-8">
              <div className="px-4 pt-4 pb-3 flex items-baseline justify-between"><h2 className="display text-xl">{t("Quêtes", "Today’s")} <em>{t("du jour", "quests")}</em></h2><span className="text-xs font-bold tnum text-volt">+{quests.reduce((a, q) => a + q.xp, 0)} XP</span></div>
              <ul className="divide-y divide-line border-t border-line">
                {quests.map((qst) => {
                  const inner = (
                    <>
                      <motion.span key={qst.done ? "done" : "todo"} initial={qst.done ? { scale: 0.3, rotate: -40 } : false} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 520, damping: 16 }}
                        className={`w-7 h-7 rounded-full grid place-items-center border-2 shrink-0 ${qst.done ? "border-transparent text-[#06240f]" : "border-line-strong text-transparent"}`} style={qst.done ? { background: "var(--grad)" } : undefined}><Check className="w-4 h-4" strokeWidth={3} /></motion.span>
                      <span className="min-w-0 flex-1"><span className={`block text-sm font-medium truncate ${qst.done ? "line-through text-smoke" : ""}`}>{qst.label}</span><span className="block text-xs text-smoke truncate">{qst.progress && !qst.done ? `${qst.progress[0]} / ${qst.progress[1]} · ` : ""}{qst.detail}</span></span>
                      <span className={`chip tnum ${qst.done ? "chip--volt" : ""}`}>+{qst.xp} XP</span>
                      {!qst.done && <ChevronRight className="w-4 h-4 text-smoke shrink-0" />}
                    </>
                  );
                  const cls = "flex items-center gap-3 px-4 py-3 w-full text-left";
                  return <li key={qst.id}>{qst.action === "flow" ? <button type="button" className={cls} onClick={() => setFlow(true)}>{inner}</button> : qst.href === "#readiness" ? <a href="#readiness" className={cls}>{inner}</a> : <Link href={qst.href ?? "/today"} className={cls}>{inner}</Link>}</li>;
                })}
              </ul>
              <div className="px-4 py-2.5 border-t border-line flex justify-between text-xs text-smoke tnum"><span>{t("Quêtes du jour", "Today’s quests")}</span><span>{questsDone}/{quests.length} · +{questXp} {t("XP gagnés", "XP earned")}</span></div>
            </div>
          </Item>

          <Item>
            <AnimatePresence mode="wait">
              {!readiness ? (
                <motion.div key="check" id="readiness" exit={{ opacity: 0, y: -10 }}>
                  <ReadinessCheck session={session ?? null} onDone={async (r) => { const xp = await awardReadiness(today); say(t(`Bilan fait.${xp ? ` +${xp} XP.` : ""} ${r.score >= 65 ? "Feu vert — entraîne-toi comme prévu." : r.score >= 40 ? "Orange — séance ajustée." : "Rouge — séance réécrite, journée plus facile."}`, `Checked in.${xp ? ` +${xp} XP.` : ""} ${r.score >= 65 ? "Green light — train as planned." : r.score >= 40 ? "Amber — session adjusted." : "Red — session rewritten, easier day."}`)); }} />
                </motion.div>
              ) : (
                <motion.div key="score" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                  <Section title={t("Forme", "Readiness")} aside={<button className="text-xs text-smoke underline" onClick={() => db.readiness.delete(today)}>{t("Refaire", "Redo")}</button>}>
                    <div className="card p-4 grid gap-4">
                      <div className="grid grid-cols-[auto_1fr] gap-4 items-center">
                        <Ring value={readiness.score / 100} size={92} stroke={8} color={readiness.score >= 40 ? "grad" : "var(--danger)"}><strong className="display text-3xl"><CountUp value={readiness.score} /></strong></Ring>
                        <div className="grid gap-1 text-sm">
                          <span>{t("Sommeil", "Sleep")} {readiness.sleepHours} h · {t("courbatures", "soreness")} {readiness.soreness}/5 · stress {readiness.stress}/5</span>
                          <span className="text-smoke text-xs">{loc(session?.adjustment?.reason) ?? t("Entraîne-toi comme prévu. Vise le RPE cible, pas un chiffre.", "Train as planned. Chase the target RPE, not a number.")}</span>
                          {sleepDebt > 0 && <span className="text-xs"><span className="chip mr-1">{t("Dette de sommeil", "Sleep debt")}</span>{t(`${sleepDebt} h sous les 8 h ${readinessWeek.length > 1 ? `sur les ${readinessWeek.length} derniers jours` : "sur la dernière journée"}.`, `${sleepDebt} h under 8 h over the last ${readinessWeek.length} day${readinessWeek.length > 1 ? "s" : ""}.`)}</span>}
                        </div>
                      </div>
                      {readinessWeek.length > 1 && <div><span className="meta block mb-1">{t("Tendance 7 jours", "7-day trend")}</span><Sparkline values={readinessWeek.map((r) => r.score)} labels={readinessWeek.map((r) => r.date.slice(5))} height={44} format={(v) => `${Math.round(v)} / 100`} /></div>}
                    </div>
                  </Section>
                </motion.div>
              )}
            </AnimatePresence>
          </Item>

          <Item>
            {session ? <SessionCard session={session} units={profile.units} best={best} /> : (
              <Section title={t("Jour de repos · mobilité guidée", "Rest day · guided mobility")}>
                <Press>
                  <button type="button" onClick={() => setFlow(true)} className="card--photo block w-full text-left">
                    {/* The title sits on the photo, the copy below it: pulled up
                        over the photo, the copy's first line ran into the title. */}
                    <div className="relative">
                      <Photo src={IMG.restDay} veil className="h-48" />
                      <p className="on-photo absolute inset-x-0 bottom-0 p-5 display text-2xl leading-[0.95]">{t("Douze minutes", "Twelve minutes")}<br />{t("de ", "of ")}<em>{t("mobilité.", "mobility.")}</em></p>
                    </div>
                    <div className="card__body p-5 grid gap-3">
                      <p className="text-sm text-smoke">{t("Six mouvements, deux minutes chacun. L’app les chronomètre et vibre à chaque changement : hanches 90/90 · étirement du divan · rotation du haut du dos · squat profond · « world’s greatest stretch » · glissés des ischios.", "Six moves, two minutes each. The app times them and buzzes at every switch: 90/90 hips · couch stretch · upper-back rotation · deep squat · world’s greatest stretch · hamstring floss.")}</p>
                      <span className="pill pill--sm pill--volt justify-self-start mt-1">{t("Lancer l’enchaînement · +66 XP", "Start the flow · +66 XP")}</span>
                    </div>
                  </button>
                </Press>
              </Section>
            )}
          </Item>

          </div>
          <div className="min-w-0">
          <Item>
            <Section title={t("Récupération", "Recovery")}>
              <div className="card p-4 grid grid-cols-[auto_1fr] gap-4 items-center">
                <Ring value={sinceLast == null ? 1 : Math.min(1, sinceLast / 48)} size={72} stroke={6} color={sinceLast != null && sinceLast < 24 ? "var(--bone)" : "var(--volt)"}><span className="text-sm font-semibold tnum">{sinceLast == null ? "—" : sinceLast < 48 ? `${sinceLast}h` : t(`${Math.round(sinceLast / 24)} j`, `${Math.round(sinceLast / 24)}d`)}</span></Ring>
                <div className="grid gap-1 text-sm">
                  <span className="font-medium">{sinceLast == null ? t("Aucune séance enregistrée", "No session logged yet") : sinceLast < 24 ? t("Entraîné aujourd’hui — récup en cours", "Trained today — recovery in progress") : sinceLast < 48 ? t("En récup — jambes et dos ont besoin de 48 h entre les grosses journées", "Recovering — legs and back need 48 h between heavy days") : t("Complètement récupéré. Go.", "Fully recovered. Go.")}</span>
                  <span className="text-xs text-smoke">{lastLog ? t(`Dernière : ${lastLog.startedAt.slice(0, 10)} · ${Math.round((lastLog.durationSec ?? 0) / 60)} min · ${Math.round(lastLog.volumeKg ?? 0).toLocaleString(locale())} kg`, `Last: ${lastLog.startedAt.slice(0, 10)} · ${Math.round((lastLog.durationSec ?? 0) / 60)} min · ${Math.round(lastLog.volumeKg ?? 0).toLocaleString("en-US")} kg`) : t("Ta première séance démarre le chrono de récup.", "Your first session unlocks the recovery clock.")}{activities[0] ? t(` · dernier parcours ${activities[0].startedAt.slice(0, 10)}`, ` · last route ${activities[0].startedAt.slice(0, 10)}`) : ""}</span>
                </div>
              </div>
            </Section>
          </Item>

          <Item>{nutrition && <FoodToday nutrition={nutrition} notifications={profile.notifications} sessionName={session ? sessionTitle(session.kind) : undefined} onNotify={async () => {
            const perm = await ensureNotificationPermission();
            if (perm !== "granted") { say(perm === "denied" ? t(`Les notifications sont désactivées pour ${APP_NAME}. Active-les dans les réglages de ton téléphone.`, `Notifications are off for ${APP_NAME}. Turn them on in your phone's settings.`) : t("Les notifications ne sont pas prises en charge ici.", "Notifications aren’t supported here.")); return; }
            await db.profile.update(profile.id, { notifications: true, dirty: 1 });
            await syncReminders();
            say(t("Rappels activés : bilan, séances et repas.", "Reminders on: check-in, sessions and meals."));
          }} />}</Item>

          <Item>
            <Section title={t("Cette semaine", "This week")} aside={<Link href="/plan" className="text-xs text-smoke underline">{t("Bloc", "Block")}</Link>}>
              <WeekStrip today={today} sessions={weekSessions} mon={week.mon} />
            </Section>
          </Item>
          </div>
        </Stagger>
        <Toast text={toast} />
        <AnimatePresence>{flow && <MobilityFlow onClose={(xp) => { setFlow(false); if (xp) { markFlowDone(today); say(t(`Enchaînement enregistré. +${xp} XP.`, `Flow logged. +${xp} XP.`)); } }} />}</AnimatePresence>
      </Screen>
    </Page>
  );
}


function SessionCard({ session, units, best }: { session: Session; units: UnitPrefs; best: Record<string, number> }) {
  const muscles = [...new Set(session.exercises.flatMap((e) => getExercise(e.slug)?.primary ?? []))].slice(0, 6);
  const plannedVolume = session.exercises.reduce((a, e) => a + e.sets.reduce((b, s) => b + (s.loadKg ?? 0) * (s.reps ?? 0), 0), 0);
  const main = session.exercises.find((e) => e.block === "main");
  const mainMeta = main ? getExercise(main.slug) : undefined;
  const mainSet = main?.sets[0];
  const mainBest = main ? best[main.slug] : undefined;
  const delta = mainSet?.loadKg && mainSet.reps && mainBest ? e1rm(mainSet.loadKg, mainSet.reps) - mainBest : undefined;
  const t = useT();
  return (
    <Section title={t("Séance du jour", "Today’s session")} aside={<Link href="/plan" className="text-xs text-smoke underline">{t(`Semaine ${session.week} · bloc`, `Week ${session.week} · block`)}</Link>}>
      <div className="card overflow-hidden">
        {mainMeta && mainSet && (
          <div className="relative h-[220px] lg:h-[300px] border-b border-line overflow-hidden">
            <MoveMedia ex={mainMeta} fill />
            <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/40 to-transparent" />
            <div className="on-photo absolute inset-x-0 bottom-0 p-4 lg:p-6">
            <span className="meta">{t("Mouvement principal", "Main lift")}</span>
            <p className="display text-3xl lg:text-4xl mt-1">{mainMeta.name}</p>
            <p className="text-sm tnum mt-1">{main!.sets.length} × {mainSet.reps ?? `${mainSet.seconds}s`}{mainSet.loadKg ? ` · ${fmtLoad(mainSet.loadKg, units)}` : ""}{mainSet.rpe ? ` · RPE ${mainSet.rpe}` : ""}</p>
            {delta != null && Math.abs(delta) >= 1 && <p className={`text-xs mt-1 ${delta >= 0 ? "text-volt" : "text-smoke"}`}>{delta >= 0 ? "▲" : "▼"} {fmtLoad(Math.abs(delta), units)} {t("e1RM vs ton record", "e1RM vs your best")}</p>}
            </div>
          </div>
        )}
        <div className="px-4 pt-3 flex flex-wrap items-center gap-1.5"><span className="meta mr-1">{t("Muscles", "Muscles")}</span>{muscles.map((m) => <span key={m} className="chip">{m.replace("_", " ")}</span>)}<span className="chip chip--live tnum ml-auto">{Math.round(plannedVolume).toLocaleString(locale())} {t("kg prévus", "kg planned")}</span></div>
        {session.adjustment && <div className="px-4 pt-3"><span className="chip chip--volt">{t("Ajustée aujourd’hui", "Adjusted today")}</span><ul className="grid gap-1 text-xs text-smoke mt-2">{session.adjustment.changes.map((x) => loc(x)).map((c) => <li key={c}>· {c}</li>)}</ul></div>}
        {session.cardio && <div className="px-4 pt-3 flex items-center justify-between gap-3"><div><span className="meta">Cardio · {t("zone", "Zone")} {session.cardio.zone}</span><p className="display text-xl">{session.cardio.minutes} min{session.cardio.structure ? ` · ${loc(session.cardio.structure)}` : ""}</p></div><Link href="/move" className="pill pill--sm">{t("Enregistrer", "Record")}</Link></div>}
        <ul className="grid divide-y divide-line mt-3 border-t border-line">
          {session.exercises.map((ex) => {
            const meta = getExercise(ex.slug); if (!meta) return null;
            const first = ex.sets[0];
            return (
              <li key={ex.id}>
                <Link href={`/library/${ex.slug}`} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="thumb !w-14 !h-14 relative overflow-hidden"><MoveMedia ex={meta} fill thumb /></span>
                  <span className="min-w-0 flex-1"><span className="block font-medium truncate">{meta.name}</span><span className="meta">{t(BLOCK_FR[ex.block], ex.block)}{meta.tempo ? ` · ${meta.tempo}` : ""}</span></span>
                  <span className="tnum text-right text-sm"><span className="block">{ex.sets.length} × {first.seconds ? `${first.seconds}s` : first.reps}</span>{first.loadKg && <span className="text-xs text-smoke">{fmtLoad(first.loadKg, units)}</span>}</span>
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="p-4 grid gap-3 border-t border-line">
          <p className="text-xs text-smoke">{loc(session.why)}</p>
          <Press><Link href={`/session?id=${session.id}`} className="pill pill--volt pill--block pill--lg">{session.status === "done" ? t("Revoir la séance", "Review session") : t("Commencer la séance", "Start session")}</Link></Press>
        </div>
      </div>
    </Section>
  );
}

function WeekStrip({ today, sessions, mon }: { today: string; sessions: Session[]; mon: string }) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(mon, i));
  const t = useT();
  return (
    // One row per day rather than seven narrow columns: a full weekday name and
    // the actual session title don't fit in a seventh of the rail, and "M T W T
    // F S S" with "Mob." under it tells you nothing at a glance.
    <ul className="card divide-y divide-line px-4">
      {days.map((d) => {
        const s = sessions.find((x) => x.date === d);
        const on = d === today;
        const date = new Date(d + "T00:00:00");
        return (
          <li key={d}>
            <Link href={s ? `/session?id=${s.id}` : "/library?pattern=mobility"}
              className="py-2.5 flex items-center gap-3 text-sm">
              <span className={`w-2 h-2 rounded-full shrink-0 ${s?.status === "done" ? "bg-volt" : s ? "bg-ink" : "bg-line-strong"}`} />
              <span className={`w-[4.5rem] shrink-0 ${on ? "font-semibold" : ""}`}>{date.toLocaleDateString(locale(), { weekday: "long" })}</span>
              <span className="min-w-0 flex-1 truncate text-smoke">{s ? sessionTitle(s.kind) : t("Mobilité", "Mobility")}</span>
              {on && <span className="chip chip--volt shrink-0">{t("Aujourd’hui", "Today")}</span>}
            </Link>
          </li>
        );
      })}
    </ul>
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
  const t = useT();
  const preview = readinessScore({ sleepHours: sleep, sleepQuality: quality, soreness, stress, mood });

  async function submit() {
    const profile = await getProfile(); if (!profile) return;
    const base = { sleepHours: sleep, sleepQuality: quality, soreness, stress, mood, hrv: hrv ? Number(hrv) : undefined, minutesAvailable: minutes, equipmentToday: gear, painToday: pain };
    const r: Readiness = { id: todayISO(), date: todayISO(), ...base, score: readinessScore(base) };
    await db.readiness.put({ ...r, dirty: 1 });
    if (session && session.status === "planned") { const measured = await bestE1rmBySlug(), injuries = adaptationsFor(await db.injuries.toArray(), todayISO()); const adj = bilingual(() => autoRegulate(profile, session, r, measured, injuries)); await db.sessions.put({ ...adj.session, dirty: 1 }); }
    onDone(r);
    syncReminders().catch(() => {}); // today's check-in reminder is no longer needed
  }

  return (
    <Section title={t("Bilan", "Check in")} aside={<span className="text-xs text-smoke">20 s · +20 XP</span>}>
      <div className="card p-4 grid gap-4">
        <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:gap-8 sm:items-end">
          <div className="min-w-[8rem]">
            <span className="eyebrow before:hidden mb-2 block">{t("Forme", "Readiness")}</span>
            <span className="numeral block" style={{ fontSize: "clamp(3.25rem, 7vw, 4.75rem)", color: preview >= 65 ? "var(--volt-deep)" : preview >= 40 ? "var(--ink)" : "var(--danger)" }}>{preview}</span>
            <span className="block h-[3px] mt-3 rounded-full" style={{ background: "var(--line)" }}>
              <motion.i className="block h-full rounded-full" animate={{ width: `${preview}%` }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                style={{ background: preview >= 65 ? "var(--volt)" : preview >= 40 ? "var(--ink)" : "var(--danger)" }} />
            </span>
          </div>
          <p className="text-sm text-smoke max-w-[38ch] sm:pb-1">{t("Ton sommeil et ton état décident de la charge du jour. Des réponses honnêtes font une meilleure séance.", "How you slept and feel decides today’s load. Honest answers make a better session.")}</p>
        </div>
        <div className="field"><span className="meta">{t("Sommeil cette nuit", "Sleep last night")} · {sleep} h</span><input type="range" min={3} max={11} step={0.5} value={sleep} onChange={(e) => setSleep(Number(e.target.value))} style={{ ["--fill" as string]: `${((sleep - 3) / 8) * 100}%` }} className="w-full" /></div>
        {/* minmax(0,1fr): a plain 1fr track has an auto minimum, so the segments
            would push the columns wider than the card instead of compressing. */}
        <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-x-6 gap-y-5">
          <RatingScale label={t("Qualité du sommeil", "Sleep quality")} value={quality} onChange={setQuality} better="high" words={[t("Affreux", "Awful"), t("Mauvais", "Poor"), t("Correct", "OK"), t("Bon", "Good"), t("Excellent", "Great")]} />
          <RatingScale label={t("Courbatures", "Soreness")} value={soreness} onChange={setSoreness} better="low" words={[t("Aucune", "None"), t("Légères", "Light"), t("Moyennes", "Moderate"), t("Fortes", "Heavy"), t("Démoli", "Wrecked")]} />
          <RatingScale label={t("Stress", "Stress")} value={stress} onChange={setStress} better="low" words={[t("Calme", "Calm"), t("Bas", "Low"), t("Moyen", "Moderate"), t("Élevé", "High"), t("Au max", "Maxed out")]} />
          <RatingScale label={t("Humeur", "Mood")} value={mood} onChange={setMood} better="high" words={[t("Basse", "Low"), t("Plate", "Flat"), t("Correcte", "OK"), t("Bonne", "Good"), t("Excellente", "Great")]} />
        </div>
        <button type="button" className="text-left text-xs text-smoke underline" onClick={() => setOpen(!open)}>{open ? t("Masquer", "Hide") : t("Ajuster la séance du jour : temps, équipement, douleur", "Adjust today’s workout: time, equipment, pain")}</button>
        <AnimatePresence>{open && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="grid gap-4 overflow-hidden">
            <RadioField label={t("Minutes que j’ai vraiment", "Minutes I actually have")} value={minutes ?? 0} onChange={(v) => setMinutes(v || undefined)} options={[{ v: 0, label: t("Comme prévu", "As planned") }, { v: 25, label: "25" }, { v: 40, label: "40" }, { v: 60, label: "60" }]} />
            <RadioField label={t("Équipement aujourd’hui", "Gear today")} value={gear ?? "full"} onChange={setGear} options={[{ v: "full", label: t("Gym complet", "Full gym") }, { v: "dumbbells", label: t("Haltères", "Dumbbells") }, { v: "bodyweight", label: t("Rien", "Nothing") }]} />
            <div className="field"><span className="meta">{t("Quelque chose te fait mal?", "Anything talking?")}</span><MultiSeg value={pain} onChange={setPain} options={(Object.keys(PAIN_LABEL) as PainArea[]).map((k) => ({ v: k, label: PAIN_LABEL[k] }))} /></div>
            <label className="field"><span className="meta">{t("VFC (ms, facultatif)", "HRV (ms, optional)")}</span><input className="input tnum" inputMode="numeric" value={hrv} onChange={(e) => setHrv(e.target.value)} placeholder={t("De ta montre", "From your watch")} /></label>
          </motion.div>
        )}</AnimatePresence>
        <Press><button type="button" className="pill pill--bone pill--block" onClick={submit}>{session ? t("Faire le bilan et ajuster", "Check in & adjust today") : t("Faire le bilan", "Check in")}</button></Press>
      </div>
    </Section>
  );
}

function FoodToday({ nutrition, notifications, sessionName, onNotify }: { nutrition: NutritionDay; notifications: boolean; sessionName?: string; onNotify: () => void }) {
  const t = useT();
  const tot = eatenTotals(nutrition);
  const next = nutrition.meals.find((m) => !m.done);
  const meal = next ? getMeal(next.mealId) : undefined;
  return (
    <Section title={t("Bouffe", "Food")} aside={<Link href="/food" className="text-xs text-smoke underline">{t("Journée complète", "Full day")}</Link>}>
      <div className="card overflow-hidden">
        {meal && next && (
          <Link href={`/food/meal?id=${encodeURIComponent(meal.id)}&date=${nutrition.date}`} className="block relative">
            <Photo src={meal.image} veil color className="h-52" />
            <div className="on-photo absolute inset-x-0 bottom-0 p-4 grid gap-1">
              <span className="meta text-bone/80">{t("Prochain", "Next")} · {next.time} · {t(SLOT_FR[next.slot], next.slot)}</span>
              <span className="display text-xl leading-[0.95] line-clamp-2">{meal.name.split(" with ")[0]}</span>
              <span className="text-xs text-bone/75 tnum">{Math.round(meal.kcal * next.scale)} kcal · {Math.round(meal.protein * next.scale)} {t("g protéines", "g protein")} · {Math.round(meal.sugar * next.scale)} {t("g sucre", "g sugar")} · {meal.minutes} min</span>
            </div>
          </Link>
        )}
        <div className="p-4 grid gap-3">
          <div className="flex items-baseline justify-between text-sm"><span>{nutrition.dayType === "rest" ? t("Jour de repos", "Rest day") : nutrition.dayType === "hard" ? t("Grosse journée", "Hard day") : t("Jour d’entraînement", "Training day")}{sessionName ? ` · ${sessionName}` : ""}</span><span className="tnum text-xs text-smoke">{nutrition.meals.filter((m) => m.done).length}/{nutrition.meals.length} {t("repas", "meals")} · {nutrition.targets.kcal.toLocaleString(locale())} kcal</span></div>
          <Bar value={nutrition.meals.filter((m) => m.done).length} max={nutrition.meals.length} />
          {/* Spelled out: a single letter next to a number is only legible to
              someone who already knows what the app is telling them. */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-smoke">
            <span className="flex justify-between gap-2"><span>{t("Protéines", "Protein")}</span><span className="tnum text-ink">{Math.round(tot.protein)} g</span></span>
            <span className="flex justify-between gap-2"><span>{t("Glucides", "Carbs")}</span><span className="tnum text-ink">{Math.round(tot.carbs)} g</span></span>
            <span className="flex justify-between gap-2"><span>{t("Lipides", "Fat")}</span><span className="tnum text-ink">{Math.round(tot.fat)} g</span></span>
            <span className="flex justify-between gap-2"><span>{t("Sucre", "Sugar")}</span><span className="tnum text-ink">{Math.round(tot.sugar)} g</span></span>
          </div>
          {!notifications && <button type="button" className="pill pill--sm justify-self-start" onClick={onNotify}>{t("Activer les rappels", "Turn on reminders")}</button>}
        </div>
      </div>
    </Section>
  );
}
