"use client";

import { APP_NAME } from "@/lib/brand";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { db, getProfile, todayISO, uid } from "@/lib/db";
import { acceptPoint, summarise } from "@/lib/geo";
import { clearDraft, openLocationSettings, readDraft, saveDraft, startGps, type StopGps, type TrackDraft } from "@/lib/gps";
import { isNativeShell } from "@/lib/native";
import { useHeartRate } from "@/components/useHeartRate";
import { activityKcal, hrSummary, maxHrFor, zoneOf, zoneName, type HrSeries } from "@/lib/heart";
import { activityXpBreakdown, awardActivity, awardChallenges } from "@/lib/progress";
import { SportChallenges } from "@/components/Challenges";
import { sportSpec } from "@/lib/data/sports";
import { ART } from "@/lib/data/images";
import { WORKOUTS, WORKOUT_MAP, ZONE_LABEL, expandSegments, localizeWorkout, segmentLabel } from "@/lib/data/workouts";
import { fmtDist, fmtDuration, fmtPace } from "@/lib/units";
import { Screen, Section, Toast, Photo, ScreenSkeleton, Seg, RadioField, Toggle, Rail, StatRow } from "@/components/ui";
import { Page, Stagger, Item, Press, CountUp, Ring, motion, AnimatePresence } from "@/components/motion";
import { Bars } from "@/components/charts";
import { TYPES, SegmentBar, MiniRoute, ActivityRow, rateFor, sportIcon, sportName, ZONE_LABEL_FR, WORKOUT_KIND_FR } from "@/components/move-bits";
import { locale, tr, useLang, useT } from "@/lib/i18n";
import { SPORT_GROUPS, groupLabel } from "@/lib/data/sports";
import { LocateFixed, Bike } from "lucide-react";
import { StartCountdown } from "@/components/StartCountdown";
import type { Activity, ActivityType, CardioWorkout, Lap, TrackPoint, UnitPrefs } from "@/lib/types";

/** The native "location refused" message; also recognised below to offer the settings button. */
const deniedNative = () => tr(`${APP_NAME} n’a pas accès à ta position. Autorise-la dans Réglages → Applications → ${APP_NAME} → Position.`, `${APP_NAME} can't use your location. Allow it in Settings → Apps → ${APP_NAME} → Location.`);

const MapView = dynamic(() => import("@/components/MapView").then((m) => m.MapView), { ssr: false, loading: () => <div className="w-full h-full skeleton !rounded-none" /> });

export default function MovePage() {
  return <Suspense fallback={<ScreenSkeleton />}><Move /></Suspense>;
}

function Move() {
  const params = useSearchParams();
  const t = useT();
  const lang = useLang();
  const workout = params.get("workout") ? WORKOUT_MAP[params.get("workout")!] : undefined;
  const profile = useLiveQuery(() => getProfile(), []);
  const activities = useLiveQuery(() => db.activities.orderBy("startedAt").reverse().toArray(), []) ?? [];
  const [type, setType] = useState<ActivityType>(workout?.type ?? "run");
  const [rec, setRec] = useState<"idle" | "live" | "paused">("idle");
  const [points, setPoints] = useState<TrackPoint[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [locateKey, setLocateKey] = useState(0);
  const [loc, setLoc] = useState<"ok" | "denied" | "unavailable" | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [pending, setPending] = useState<Activity | null>(null);
  const [counting, setCounting] = useState(false);
  const [group, setGroup] = useState(() => SPORT_GROUPS.find((g) => g.sports.some((sp) => sp.v === (workout?.type ?? "run")))?.key ?? "run");
  const [tab, setTab] = useState<"record" | "workouts" | "history">("record");
  const gps = useRef<StopGps | null>(null);
  const heart = useHeartRate();
  const hrSeries = useRef<HrSeries>([]);
  const lastDraft = useRef(0);
  // A run the system killed before it was saved (see lib/gps).
  // Read once on mount. Safe to read during render: the page shows a skeleton
  // until the profile loads, so nothing here is in the prerendered HTML.
  const [draft, setDraft] = useState<TrackDraft | null>(() => (typeof window === "undefined" ? null : readDraft()));
  const startedAt = useRef<string>("");
  const pausedAt = useRef<number>(0);
  const pausedTotal = useRef<number>(0);
  const wake = useRef<WakeLockSentinel | null>(null);
  const segments = useMemo(() => (workout ? expandSegments(workout) : []), [workout]);
  const [segIdx, setSegIdx] = useState(0);
  const [segLeft, setSegLeft] = useState(0);
  const lapsRef = useRef<Lap[]>([]);
  const lapStartDist = useRef(0);
  const distRef = useRef(0);
  const segStartRef = useRef<number>(0);

  // Guided playback: derive the current segment from elapsed time (robust to pauses).
  useEffect(() => {
    if (rec !== "live") return;
    const t = setInterval(() => {
      const e = Math.round((Date.now() - new Date(startedAt.current).getTime() - pausedTotal.current) / 1000);
      setElapsed(e);
      if (!segments.length) return;
      let acc = 0, idx = segments.length - 1, left = 0;
      for (let i = 0; i < segments.length; i++) { if (e < acc + segments[i].seconds) { idx = i; left = acc + segments[i].seconds - e; break; } acc += segments[i].seconds; }
      setSegLeft(left);
      setSegIdx((prev) => {
        if (idx !== prev) {
          const seg = segments[prev];
          if (seg) lapsRef.current.push({ label: seg.label, seconds: seg.seconds, distanceM: Math.max(0, distRef.current - lapStartDist.current), zone: seg.zone });
          lapStartDist.current = distRef.current; segStartRef.current = e;
          if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
          if (idx === segments.length - 1 && left === 0) { setToast(tr("Structure terminée — finis quand tu veux.", "Structure complete — finish when you're ready.")); setTimeout(() => setToast(null), 4000); }
        }
        return idx;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [rec, segments]);

  useEffect(() => {
    if (rec !== "live") return;
    const t = setInterval(() => {
      const b = heart.fresh();
      if (b == null) return;
      const sec = Math.round((Date.now() - new Date(startedAt.current).getTime() - pausedTotal.current) / 1000);
      hrSeries.current.push([sec, b]);
    }, 5000);
    return () => clearInterval(t);
  }, [rec, heart]);

  function start() {
    clearDraft(); setDraft(null);
    hrSeries.current = [];
    setErr(null); setPoints([]); setElapsed(0); pausedTotal.current = 0; lapsRef.current = []; distRef.current = 0; lapStartDist.current = 0; setSegIdx(0); setSegLeft(segments[0]?.seconds ?? 0);
    startedAt.current = new Date().toISOString();
    setRec("live"); setTab("record");
    // In a browser the screen has to stay on or the GPS stops. The app records
    // from a background service instead, so the phone can go in a pocket.
    if (!isNativeShell()) navigator.wakeLock?.request("screen").then((w) => (wake.current = w)).catch(() => {});
    const began = startedAt.current, sport = type, workoutId = workout?.id;
    const label = sportName(type, lang);
    startGps(
      (p) => setPoints((prev) => {
        const bpm = heart.fresh();
        if (bpm != null) p = { ...p, hr: bpm };
        if (!acceptPoint(prev[prev.length - 1], p)) return prev;
        const next = [...prev, p];
        distRef.current = summarise(next).distanceM;
        // Every 15 s is plenty: a crash costs at most 15 s of track.
        if (p.t - lastDraft.current > 15000) { lastDraft.current = p.t; saveDraft({ type: sport, startedAt: began, pausedMs: pausedTotal.current, points: next, workoutId, hr: hrSeries.current }); }
        return next;
      }),
      (problem) => setErr(problem === "denied"
        ? (isNativeShell() ? deniedNative() : tr("Accès à la position refusé. Autorise-le dans les réglages de ton navigateur.", "Location permission denied. Allow it in your browser settings."))
        : problem === "unavailable" ? tr("Aucun GPS sur cet appareil.", "No GPS available on this device.") : tr("Signal GPS perdu — continue de bouger, il va revenir.", "GPS signal lost — keep moving, it'll pick up.")),
      { title: tr(`${APP_NAME} · ${label} en cours`, `${APP_NAME} · ${label} recording`), message: tr(`Ton parcours est en train d’être enregistré. Touche pour revenir à ${APP_NAME}.`, `Your route is being recorded. Tap to return to ${APP_NAME}.`) },
    ).then((stopFn) => { gps.current = stopFn; }).catch(() => setErr(tr("Impossible de démarrer le GPS. Vérifie que la localisation est activée.", "Couldn't start the GPS. Check that location is on.")));
  }
  function pause() { if (rec === "live") { pausedAt.current = Date.now(); setRec("paused"); } else { pausedTotal.current += Date.now() - pausedAt.current; setRec("live"); } }
  function stop() {
    gps.current?.().catch(() => {}); gps.current = null;
    wake.current?.release().catch(() => {});
    const s = summarise(points);
    const durationSec = Math.round((Date.now() - new Date(startedAt.current).getTime() - pausedTotal.current) / 1000);
    setRec("idle");
    // A rink, a wall or a mat has no route to draw: those sports are saved on
    // time alone. Everything else needs a real track.
    const timeOnly = !sportSpec(type).gps;
    if (timeOnly ? durationSec < 300 : points.length < 2 || s.distanceM < 50) { setToast(timeOnly ? tr("Moins de cinq minutes — pas enregistré.", "Under five minutes — not saved.") : tr("Trop court pour être enregistré.", "Too short to save.")); setTimeout(() => setToast(null), 2500); return; }
    const seg = segments[segIdx];
    if (seg) lapsRef.current.push({ label: seg.label, seconds: Math.max(0, durationSec - segStartRef.current), distanceM: Math.max(0, distRef.current - lapStartDist.current), zone: seg.zone });
    const label = sportName(type, lang);
    const hour = new Date().getHours();
    const when = hour < 12 ? "Morning" : hour < 18 ? "Afternoon" : "Evening";
    const whenFr = hour < 12 ? "du matin" : hour < 18 ? "de l’après-midi" : "du soir";
    setPending({ id: uid(), type, startedAt: startedAt.current, endedAt: new Date().toISOString(), distanceM: s.distanceM, durationSec, movingSec: s.movingSec, avgPaceSecKm: s.distanceM > 0 ? durationSec / (s.distanceM / 1000) : undefined, maxSpeedMs: s.maxSpeedMs, elevGainM: s.elevGainM, elevLossM: s.elevLossM, points, splits: s.splits, laps: lapsRef.current.length ? lapsRef.current : undefined, title: workout ? localizeWorkout(workout, lang).name : lang === "fr" ? `${label} ${whenFr}` : `${when} ${label}`, workoutId: workout?.id, shared: true, xp: 0, ...effort(type, s.movingSec || durationSec, s.distanceM, hrSeries.current) });
  }
  /** Heart rate and calories for the save sheet. */
  function effort(t: ActivityType, movingSec: number, distanceM: number, hr: HrSeries): Pick<Activity, "hrSeries" | "avgHr" | "maxHr" | "kcal" | "kcalSource"> {
    const sum = hrSummary(hr);
    const k = activityKcal({ type: t, movingMin: movingSec / 60, distanceM, profile: profile!, hr });
    return { hrSeries: hr.length ? hr : undefined, avgHr: sum?.avg, maxHr: sum?.max, kcal: k.kcal, kcalSource: k.source };
  }

  /** Turn a run the system killed into the usual save sheet. */
  function recover(d: TrackDraft) {
    const s = summarise(d.points);
    const last = d.points[d.points.length - 1].t;
    const durationSec = Math.max(1, Math.round((last - new Date(d.startedAt).getTime() - d.pausedMs) / 1000));
    const label = sportName(d.type, lang);
    setType(d.type);
    setDraft(null);
    setPending({ id: uid(), type: d.type, startedAt: d.startedAt, endedAt: new Date(last).toISOString(), distanceM: s.distanceM, durationSec, movingSec: s.movingSec, avgPaceSecKm: s.distanceM > 0 ? durationSec / (s.distanceM / 1000) : undefined, maxSpeedMs: s.maxSpeedMs, elevGainM: s.elevGainM, elevLossM: s.elevLossM, points: d.points, splits: s.splits, title: tr(`${label} (récupérée)`, `${label} (recovered)`), workoutId: d.workoutId, shared: true, xp: 0, ...effort(d.type, s.movingSec || durationSec, s.distanceM, d.hr ?? []) });
  }

  async function save(a: Activity) {
    const today = todayISO();
    const session = await db.sessions.where("date").equals(today).first();
    const withSession: Activity = { ...a, sessionId: session?.kind.startsWith("cardio") ? session.id : undefined, sharedAt: a.shared ? new Date().toISOString() : undefined };
    const { xp, earned } = await awardActivity(withSession);
    await db.activities.put({ ...withSession, xp, dirty: 1 });
    // After the write: challenges read the saved activities.
    const won = await awardChallenges(withSession.type, profile?.units.distance ?? "km");
    if (session?.kind.startsWith("cardio") && session.status !== "done") await db.sessions.update(session.id, { status: "done", dirty: 1 });
    setPending(null); setPoints([]); setTab("history"); clearDraft();
    setToast(tr(
      `Enregistré. +${xp + won.xp} XP${won.titles.length ? ` · défi : ${won.titles.join(", ")}` : ""}${earned.length ? ` · badge : ${earned.join(", ")}` : ""}${session?.kind.startsWith("cardio") ? " · cardio du jour fait" : ""}`,
      `Saved. +${xp + won.xp} XP${won.titles.length ? ` · challenge: ${won.titles.join(", ")}` : ""}${earned.length ? ` · badge: ${earned.join(", ")}` : ""}${session?.kind.startsWith("cardio") ? " · today's cardio done" : ""}`,
    ));
    setTimeout(() => setToast(null), 4500);
  }

  if (!profile) return <ScreenSkeleton />;
  const live = summarise(points);
  const units = profile.units;
  const totalM = activities.reduce((a, b) => a + b.distanceM, 0);
  const typeLabel = sportName(type, lang);
  const rate = rateFor({ type, distanceM: live.distanceM, durationSec: Math.max(1, elapsed) }, units);
  const seg = segments[segIdx];
  const weekly = weeklyDistance(activities, units);

  return (
    <Page>
      <Screen className="px-0">
        <div className="bleed relative h-[56vh] min-h-[400px] -mt-[calc(var(--safe-top)+16px)] overflow-hidden lg:-mt-10 lg:h-[72vh] lg:min-h-[560px] mb-8 lg:mb-[var(--stack-loose)]">
          {rec === "idle" && points.length === 0 ? (
            <>
              <MapView points={[]} locate locateKey={locateKey} onLocate={setLoc} />
              <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(180deg,rgba(243,246,242,.55)_0%,transparent_22%,transparent_62%,rgba(243,246,242,.85)_100%)]" />
              <div className="absolute inset-x-0 top-[calc(var(--safe-top)+12px)] lg:top-7 pointer-events-none">
                <div className="screen flex justify-between items-start gap-3">
                <div className="flex gap-2 pointer-events-auto"><span className="chip chip--live backdrop-blur-md"><i className="live-dot" /> {loc === "ok" ? t("Localisé", "Located") : loc === "denied" ? t("Position bloquée", "Location blocked") : loc === "unavailable" ? t("Pas de GPS", "No GPS") : t("GPS · prêt", "GPS · ready")}</span><button type="button" className="chip chip--live backdrop-blur-md" onClick={() => setLocateKey((k) => k + 1)} aria-label={t("Me localiser", "Locate me")}><LocateFixed className="w-4 h-4" strokeWidth={2} /> {t("Me localiser", "Locate me")}</button></div>
                {/* The totals chip duplicates the cards below, so it gives way on a
                    phone rather than pushing the GPS controls off-screen. Hiding it
                    needs a wrapper: `.chip` sets display in globals.css, which wins
                    over Tailwind's `hidden` utility in this project's layer order. */}
                {workout ? <Link href="/move" className="chip chip--live backdrop-blur-md pointer-events-auto shrink-0">{t("✕ Enregistrement libre", "✕ Free record")}</Link> : <span className="hidden sm:block shrink-0"><span className="chip chip--live backdrop-blur-md tnum">{activities.length} {lang === "fr" ? (activities.length <= 1 ? "activité" : "activités") : `activit${activities.length === 1 ? "y" : "ies"}`} · {fmtDist(totalM, units)}</span></span>}
                </div>
              </div>
              {/* The start panel keeps a readable width instead of stretching the
                  full bleed: a 600px-wide primary button reads as a banner, not a control. */}
              <div className="absolute inset-x-0 bottom-3 lg:bottom-7">
                <div className="screen">
                <div className="card p-3 lg:p-4 grid gap-3 backdrop-blur-xl !bg-[rgba(255,255,255,.9)] lg:max-w-[520px]">
                {workout ? (
                  <div className="grid gap-2">
                    <div className="flex items-start justify-between gap-3"><div><span className="meta">{t("Guidé", "Guided")} · {workout.minutes} min · Zone {workout.zone} {lang === "fr" ? ZONE_LABEL_FR[workout.zone] : ZONE_LABEL[workout.zone]}</span><p className="display text-2xl leading-none mt-1">{localizeWorkout(workout, lang).name.split(" · ")[0]}</p></div><Link href={`/move/workout/${workout.id}`} className="chip chip--live">{t("Détails", "Details")}</Link></div>
                    <SegmentBar segments={segments} />
                  </div>
                ) : (
                  // Twenty-eight sports don't fit in one grid, so they come in
                  // groups: pick the family, then the sport. Two rows, never more.
                  <div className="grid gap-2">
                    <Rail active={group} className="gap-1.5">
                      {SPORT_GROUPS.map((g) => (
                        <button key={g.key} type="button" aria-pressed={group === g.key} onClick={() => setGroup(g.key)}
                          className={`shrink-0 h-9 px-3 rounded-full border text-xs transition-colors ${group === g.key ? "bg-ink border-ink text-bone" : "border-line text-smoke hover:border-ink hover:text-ink"}`}>
                          {groupLabel(g, lang)}
                        </button>
                      ))}
                    </Rail>
                    <div className="grid grid-cols-5 gap-1.5">
                      {(SPORT_GROUPS.find((g) => g.key === group)?.sports ?? []).map((sp) => {
                        const Icon = sportIcon(sp.v);
                        return (
                          <button key={sp.v} type="button" aria-pressed={type === sp.v} onClick={() => setType(sp.v)}
                            className={`grid justify-items-center gap-1 py-2 px-1 min-h-[58px] rounded-xl border transition-colors ${type === sp.v ? "bg-volt border-volt text-ink font-medium" : "border-line-strong text-ink hover:border-ink"}`}>
                            <Icon className="w-[18px] h-[18px]" strokeWidth={1.8} /><span className="text-[10px] leading-none tracking-wide text-center">{sportName(sp.v, lang)}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                <Press><button type="button" className="pill pill--volt pill--block pill--lg" onClick={() => { setErr(null); setCounting(true); }}>{workout ? t("Lancer l’entraînement guidé", "Start guided workout") : t(`Démarrer · ${typeLabel.toLowerCase()}`, `Start ${typeLabel.toLowerCase()}`)}</button></Press>
                <HeartChip heart={heart} maxHr={maxHrFor(profile.age)} />
                <AnimatePresence>{err && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-xs text-danger">{err}{isNativeShell() && err === deniedNative() && <> <button type="button" className="underline" onClick={() => openLocationSettings()}>{t("Ouvrir les réglages", "Open settings")}</button></>}</motion.p>}</AnimatePresence>
                </div>
                </div>
              </div>
            </>
          ) : (
            <>
              <MapView points={points} follow />
              <div className="absolute left-3 right-3 top-[calc(var(--safe-top)+12px)] flex justify-between pointer-events-none">
                <div className="card px-3 py-2 grid backdrop-blur-md !bg-[rgba(255,255,255,.88)]"><span className="meta">{t("Distance", "Distance")}</span><strong className="display text-2xl tnum">{fmtDist(live.distanceM, units)}</strong></div>
                <div className="card px-3 py-2 grid text-center backdrop-blur-md !bg-[rgba(255,255,255,.88)]"><span className="meta">{t("Temps", "Time")}</span><strong className="display text-2xl tnum">{fmtDuration(elapsed)}</strong></div>
                <div className="card px-3 py-2 grid text-right backdrop-blur-md !bg-[rgba(255,255,255,.88)]"><span className="meta">{rate.label}{rate.sub ? ` · ${rate.sub}` : ""}</span><strong className="display text-2xl tnum">{rate.value}</strong></div>
              </div>
              <div className="absolute left-3 right-3 bottom-3 flex items-end justify-between gap-3 pointer-events-none">
                <span className="chip chip--live backdrop-blur-md"><i className="live-dot" /> {rec === "live" ? t("Enregistrement", "Recording") : t("En pause", "Paused")} · ↑{Math.round(live.elevGainM)} m</span>
                {seg && (
                  <div className="card px-3 py-2 flex items-center gap-3 backdrop-blur-md !bg-[rgba(255,255,255,.9)]">
                    <Ring value={seg.seconds ? 1 - segLeft / seg.seconds : 0} size={44} stroke={4}><span className="text-[11px] tnum font-semibold">{fmtDuration(segLeft)}</span></Ring>
                    <div className="grid"><span className="meta">{segmentLabel(seg.label, lang)} · Z{seg.zone} {lang === "fr" ? ZONE_LABEL_FR[seg.zone] : ZONE_LABEL[seg.zone]}</span><span className="text-xs max-w-[200px] leading-tight">{workout ? expandSegments(localizeWorkout(workout, lang))[segIdx]?.cue ?? seg.cue : seg.cue}</span>{segments[segIdx + 1] && <span className="text-[10px] text-smoke">{t("Ensuite :", "Next:")} {segmentLabel(segments[segIdx + 1].label, lang)}</span>}</div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <div className="px-5 pt-4 min-w-0 overflow-x-clip lg:px-0">
          {rec === "idle" ? (
            <>
              {/* Indoor lives here rather than in the bottom bar. The bar already holds
                  six items and a seventh crowds a phone — and this is the more honest
                  home anyway: Move is movement, outside or in the basement. Without
                  this the whole indoor mode was unreachable on a phone, which is how
                  it was found. */}
              <div className="mb-4 flex items-center gap-2 flex-wrap">
                <Seg value={tab} onChange={setTab} options={[{ v: "record", label: t("Enregistrer", "Record") }, { v: "workouts", label: t("Entraînements", "Workouts") }, { v: "history", label: t("Historique", "History") }]} />
                <Link href="/indoor" className="chip ml-auto"><Bike className="w-3.5 h-3.5" strokeWidth={2} />{t("Intérieur", "Indoor")}</Link>
              </div>
              <AnimatePresence mode="wait">
                {tab === "record" && (
                  <motion.div key="rec" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="grid gap-4 min-w-0">
                    {draft && rec === "idle" && (
                      <div className="card p-4 grid gap-3 !border-volt" role="status">
                        <div className="grid gap-0.5">
                          <span className="meta">{t("Activité inachevée", "Unfinished activity")}</span>
                          <p className="text-sm">{lang === "fr"
                            ? <>Ton activité ({sportName(draft.type, lang).toLowerCase()}) de {new Date(draft.startedAt).toLocaleTimeString(locale(), { hour: "numeric", minute: "2-digit" })} s’est arrêtée avant d’être enregistrée — {fmtDist(summarise(draft.points).distanceM, units)} enregistrés.</>
                            : <>Your {(TYPES.find((x) => x.v === draft.type)?.label ?? "activity").toLowerCase()} from {new Date(draft.startedAt).toLocaleTimeString(locale(), { hour: "numeric", minute: "2-digit" })} stopped before it was saved — {fmtDist(summarise(draft.points).distanceM, units)} recorded.</>}</p>
                        </div>
                        <div className="flex gap-2"><button type="button" className="pill pill--sm pill--volt" onClick={() => recover(draft)}>{t("L’enregistrer", "Save it")}</button><button type="button" className="pill pill--sm" onClick={() => { clearDraft(); setDraft(null); }}>{t("Supprimer", "Discard")}</button></div>
                      </div>
                    )}
                    <StatRow items={[
                      { label: t("Cette semaine", "This week"), value: fmtDist(weekly[weekly.length - 1]?.raw ?? 0, units) },
                      { label: t("Activités", "Activities"), value: <CountUp value={activities.length} /> },
                      { label: t("Dénivelé", "Climbed"), value: <CountUp value={Math.round(activities.reduce((a, b) => a + b.elevGainM, 0))} />, unit: "m" },
                    ]} />
                    <SportChallenges sport={type} units={units.distance} />
                    <button type="button" className="text-xs text-smoke underline justify-self-start" onClick={() => setTab("workouts")}>{t(`Envie de structure ? ${WORKOUTS.length} entraînements guidés →`, `Prefer structure? ${WORKOUTS.length} guided workouts →`)}</button>
                  </motion.div>
                )}
                {tab === "workouts" && (
                  <motion.div key="wk" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="grid gap-4"><WorkoutsList /></motion.div>
                )}
                {tab === "history" && (
                  <motion.div key="hist" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="grid gap-5">
                    <div className="card p-4"><span className="meta block mb-2">{t("Distance par semaine · 8 semaines", "Weekly distance · 8 weeks")}</span><Bars data={weekly} format={(v) => `${(Math.round(v * 10) / 10).toLocaleString(locale())} ${units.distance}`} /></div>
                    <Section title={t("Activités", "Activities")} aside={<span className="text-xs text-smoke tnum">{activities.length}</span>}>
                      {activities.length === 0 ? (
                        <div className="card--photo"><Photo src={ART.move} color veil soft className="h-40" /><div className="card__body p-5 grid gap-2 -mt-14"><p className="display text-2xl">{lang === "fr" ? <>Pas encore de <em>parcours.</em></> : <>No routes <em>yet.</em></>}</p><p className="text-sm text-smoke">{t("Choisis un sport, appuie sur démarrer, garde l’écran allumé. Ton premier parcours s’affiche ici avec les temps au km et le dénivelé — et il compte pour le cardio du jour.", "Pick a sport, press start, keep the screen on. Your first route is drawn here with splits and elevation — and it counts toward today’s cardio.")}</p></div></div>
                      ) : (
                        <Stagger className="grid gap-2" delay={0.04}>{activities.map((a) => <Item key={a.id}><ActivityRow a={a} units={units} /></Item>)}</Stagger>
                      )}
                    </Section>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          ) : (
            <div className="grid gap-3">
              <div className="flex gap-3">
                <button type="button" className="pill flex-1" onClick={pause}>{rec === "live" ? t("Pause", "Pause") : t("Reprendre", "Resume")}</button>
                <Press className="flex-1"><button type="button" className="pill pill--bone pill--block" onClick={stop}>{t("Terminer", "Finish")}</button></Press>
              </div>
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="card p-2 grid"><span className="meta">{t("Montée", "Climb")}</span><strong className="tnum">{Math.round(live.elevGainM)} m</strong></div>
                <div className="card p-2 grid"><span className="meta">{t("Dernier km", "Last km")}</span><strong className="tnum">{live.splits.length ? fmtDuration(live.splits[live.splits.length - 1].sec) : "—"}</strong></div>
                <div className="card p-2 grid" style={heart.bpm ? { borderColor: ZONE_COLOR[zoneOf(heart.bpm, maxHrFor(profile.age))] } : undefined}>
                  <span className="meta">{t("Cœur", "Heart")}</span>
                  <strong className="tnum">{heart.bpm ?? "—"}</strong>
                  {heart.bpm && <span className="text-[10px] text-smoke">Z{zoneOf(heart.bpm, maxHrFor(profile.age))} · {zoneName(zoneOf(heart.bpm, maxHrFor(profile.age)), lang)}</span>}
                </div>
                {segments.length
                  ? <div className="card p-2 grid"><span className="meta">{t("Segment", "Segment")}</span><strong className="tnum">{segIdx + 1}/{segments.length}</strong></div>
                  : <div className="card p-2 grid"><span className="meta">kcal</span><strong className="tnum">{activityKcal({ type, movingMin: (live.movingSec || elapsed) / 60, distanceM: live.distanceM, profile, hr: hrSeries.current }).kcal}</strong></div>}
              </div>
              {err && <p className="text-xs text-danger">{err}</p>}
            </div>
          )}
        </div>

        <AnimatePresence>{pending && <SaveSheet a={pending} units={units} onCancel={() => { setPending(null); clearDraft(); }} onSave={save} onChange={setPending} />}</AnimatePresence>
        <AnimatePresence>{counting && <StartCountdown label={workout ? localizeWorkout(workout, lang).name.split(" · ")[0] : typeLabel} onDone={() => { setCounting(false); start(); }} />}</AnimatePresence>
        <Toast text={toast} />
      </Screen>
    </Page>
  );
}

function WorkoutCard({ w, narrow }: { w: CardioWorkout; narrow?: boolean }) {
  const lang = useLang();
  return (
    <Press className={narrow ? "shrink-0 w-[220px]" : ""}>
      <Link href={`/move/workout/${w.id}`} className="card--photo block aspect-[4/5]">
        <Photo src={w.image} veil className="absolute inset-0" />
        <div className="card__body absolute inset-x-0 bottom-0 p-3 grid gap-1">
          <span className="flex gap-1"><span className="chip chip--volt">Z{w.zone}</span><span className="chip chip--live backdrop-blur-md">{w.minutes} min</span></span>
          <span className="font-semibold leading-tight">{localizeWorkout(w, lang).name}</span>
          <span className="text-[11px] text-smoke capitalize">{lang === "fr" ? `${sportName(w.type, lang).toLowerCase()} · ${WORKOUT_KIND_FR[w.kind] ?? w.kind}` : <>{w.type} · {w.kind}</>}</span>
        </div>
      </Link>
    </Press>
  );
}

function WorkoutsList() {
  const [type, setType] = useState<string>("");
  const t = useT();
  const lang = useLang();
  const list = WORKOUTS.filter((w) => !type || w.type === type);
  return (
    <>
      <Seg scroll value={type} onChange={setType} options={[{ v: "", label: t("Tous", "All") }, ...TYPES.filter((x) => WORKOUTS.some((w) => w.type === x.v)).map((x) => ({ v: x.v as string, label: sportName(x.v, lang) }))]} />
      <Stagger className="grid grid-cols-2 md:grid-cols-3 gap-3 lg:gap-4" delay={0.04}>{list.map((w) => <Item key={w.id}><WorkoutCard w={w} /></Item>)}</Stagger>
    </>
  );
}

function weeklyDistance(acts: Activity[], units: UnitPrefs) {
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const monday = new Date(now); monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  return Array.from({ length: 8 }, (_, i) => {
    const start = new Date(monday); start.setDate(monday.getDate() - (7 - i) * 7);
    const end = new Date(start); end.setDate(start.getDate() + 7);
    const raw = acts.filter((a) => { const d = new Date(a.startedAt); return d >= start && d < end; }).reduce((s, a) => s + a.distanceM, 0);
    return { label: i === 7 ? tr("auj.", "now") : start.toLocaleDateString(locale(), { month: "short", day: "numeric" }), value: units.distance === "mi" ? raw / 1609.344 : raw / 1000, raw };
  });
}

function SaveSheet({ a, units, onCancel, onSave, onChange }: { a: Activity; units: UnitPrefs; onCancel: () => void; onSave: (a: Activity) => void; onChange: (a: Activity) => void }) {
  const xp = activityXpBreakdown(a);
  const t = useT();
  const lang = useLang();
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] bg-ink/80 backdrop-blur-md grid items-end">
      <motion.div initial={{ y: 60 }} animate={{ y: 0 }} exit={{ y: 60 }} transition={{ type: "spring", stiffness: 300, damping: 30 }} className="bg-carbon border-t border-line rounded-t-3xl p-5 pb-[calc(var(--safe-bottom)+20px)] grid gap-4 max-h-[88vh] overflow-y-auto max-w-[560px] w-full mx-auto">
        <div className="flex items-center gap-3"><MiniRoute points={a.points} size={64} /><div className="flex-1"><span className="meta">{t("Enregistrer l’activité", "Save activity")}</span><p className="display text-2xl">{fmtDist(a.distanceM, units)} · {fmtDuration(a.durationSec)}</p><p className="text-xs text-smoke">{fmtPace(a.avgPaceSecKm, units)} · ↑{Math.round(a.elevGainM)} m · {lang === "fr" ? `${a.splits.length} temps au km${a.laps ? ` · ${a.laps.length} tours` : ""}` : `${a.splits.length} km splits${a.laps ? ` · ${a.laps.length} laps` : ""}`}</p></div></div>
        <label className="field"><span className="meta">{t("Titre", "Title")}</span><input className="input" value={a.title} onChange={(e) => onChange({ ...a, title: e.target.value })} /></label>
        <RadioField label={t("Sport", "Sport")} value={a.type} onChange={(type) => onChange({ ...a, type })} options={TYPES.map((x) => ({ v: x.v, label: sportName(x.v, lang) }))} />
        {a.type === "swim" && (
          <div className="grid grid-cols-2 gap-3">
            <RadioField label={t("Piscine", "Pool")} value={a.meta?.poolM ?? 25} onChange={(poolM) => onChange({ ...a, meta: { ...a.meta, poolM }, distanceM: (a.meta?.laps ?? 0) * poolM || a.distanceM })} options={[{ v: 25 as const, label: "25 m" }, { v: 50 as const, label: "50 m" }]} />
            <label className="field"><span className="meta">{t("Longueurs", "Laps")}</span><input className="input tnum" inputMode="numeric" value={a.meta?.laps ?? ""} placeholder={t("ex. 40", "e.g. 40")} onChange={(e) => { const laps = Number(e.target.value) || 0; onChange({ ...a, meta: { ...a.meta, laps }, distanceM: laps ? laps * (a.meta?.poolM ?? 25) : a.distanceM }); }} /></label>
          </div>
        )}
        {a.type === "ski" && <RadioField label={t("Discipline", "Discipline")} value={a.meta?.discipline ?? "xc-classic"} onChange={(discipline) => onChange({ ...a, meta: { ...a.meta, discipline } })} options={[{ v: "xc-classic", label: t("Fond classique", "XC classic") }, { v: "xc-skate", label: t("Fond pas de patin", "XC skate") }, { v: "alpine", label: t("Alpin", "Alpine") }, { v: "touring", label: t("Randonnée alpine", "Touring") }]} />}
        {a.type === "ride" && <RadioField label={t("Vélo", "Bike")} value={a.meta?.bike ?? "road"} onChange={(bike) => onChange({ ...a, meta: { ...a.meta, bike } })} options={[{ v: "road", label: t("Route", "Road") }, { v: "gravel", label: t("Gravel", "Gravel") }, { v: "mtb", label: t("Montagne", "MTB") }, { v: "indoor", label: t("Intérieur", "Indoor") }]} />}
        <RadioField label={t("Comment tu te sentais ?", "How did it feel?")} value={a.feel ?? 0} onChange={(v) => onChange({ ...a, feel: (v || undefined) as Activity["feel"] })} options={[{ v: 1, label: t("Dur", "Rough") }, { v: 2, label: t("Bof", "Meh") }, { v: 3, label: t("Correct", "OK") }, { v: 4, label: t("Bien", "Good") }, { v: 5, label: t("En feu", "Flying") }]} />
        <label className="field"><span className="meta">{t("Note (facultatif)", "Note (optional)")}</span><input className="input" placeholder={t("Venteux, nouveaux souliers, fort dans la côte…", "Windy, new shoes, felt strong on the hill…")} value={a.note ?? ""} onChange={(e) => onChange({ ...a, note: e.target.value })} /></label>
        <div className="card p-3 flex items-center justify-between gap-3">
          <span><span className="block text-sm font-medium">{t("Partager sur mon profil", "Share to my profile")}</span><span className="text-xs text-smoke">{t("S’affiche dans ton fil avec la carte du parcours. +40 XP.", "Shows in your feed with the route card. +40 XP.")}</span></span>
          <Toggle on={!!a.shared} label={t("Partager sur mon profil", "Share to my profile")} onChange={(v) => onChange({ ...a, shared: v })} />
        </div>
        <div className="card p-3 grid gap-1">{xp.parts.map((p) => <div key={p.label} className="flex justify-between text-xs"><span className="text-smoke">{p.label}</span><span className="tnum">+{p.xp}</span></div>)}<div className="flex justify-between text-sm font-semibold border-t border-line pt-2 mt-1"><span>{t("Total", "Total")}</span><span className="text-volt tnum">+{xp.total} XP</span></div></div>
        <div className="flex gap-3"><button type="button" className="pill" onClick={onCancel}>{t("Supprimer", "Discard")}</button><Press className="flex-1"><button type="button" className="pill pill--volt pill--block" onClick={() => onSave(a)}>{t("Enregistrer l’activité", "Save activity")}</button></Press></div>
      </motion.div>
    </motion.div>
  );
}

/* Zone colours: calm to hard, the same order a watch uses. */
const ZONE_COLOR = ["var(--line)", "#9ad0ec", "#1fc76f", "#f2c14e", "#f08a3c", "#d9453d"];

/** Connect a heart-rate strap or watch for this activity. */
function HeartChip({ heart, maxHr }: { heart: ReturnType<typeof useHeartRate>; maxHr: number }) {
  const t = useT();
  if (heart.sensor) {
    const z = heart.bpm ? zoneOf(heart.bpm, maxHr) : 0;
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className="chip tnum" style={{ borderColor: ZONE_COLOR[z] }}>♥ {heart.bpm ?? "…"} bpm{heart.bpm ? ` · Z${z}` : ""}</span>
        <span className="text-xs text-smoke truncate flex-1">{heart.sensor.name}</span>
        <button type="button" className="text-xs text-smoke underline" onClick={heart.disconnect}>{t("Déconnecter", "Disconnect")}</button>
      </div>
    );
  }
  return (
    <div className="grid gap-1">
      <button type="button" className="pill pill--sm justify-self-start" disabled={heart.busy} onClick={heart.connect}>{heart.busy ? t("Recherche d’une ceinture…", "Looking for a strap…") : t("♥ Connecter un cardio", "♥ Connect heart rate")}</button>
      {heart.error && <span className="text-xs text-danger">{heart.error}</span>}
    </div>
  );
}
