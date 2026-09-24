"use client";

import { Suspense, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { db, getProfile } from "@/lib/db";
import { elevationProfile } from "@/lib/geo";
import { shareCard } from "@/lib/share";
import { downloadTcx, toTcx } from "@/lib/tcx";
import { PostToFeed } from "@/components/PostToFeed";
import { WORKOUT_MAP, ZONE_LABEL, localizeWorkout, segmentLabel } from "@/lib/data/workouts";
import { fmtDist, fmtDuration } from "@/lib/units";
import { rateFor, sportName, ZONE_LABEL_FR } from "@/components/move-bits";
import { locale, tr, useLang, useT } from "@/lib/i18n";
import { Screen, Section, Stat, Toast, ScreenSkeleton, Photo } from "@/components/ui";
import { ART } from "@/lib/data/images";
import { Page, Stagger, Item, Press, motion } from "@/components/motion";
import { ElevationChart } from "@/components/charts";

const MapView = dynamic(() => import("@/components/MapView").then((m) => m.MapView), { ssr: false, loading: () => <div className="w-full h-full skeleton !rounded-none" /> });
const FEEL = ["", "Rough", "Meh", "OK", "Good", "Flying"];
const FEEL_FR = ["", "dur", "bof", "correct", "bien", "en feu"];
const DISCIPLINE_FR: Record<string, string> = { "xc-classic": "Fond classique", "xc-skate": "Fond pas de patin", alpine: "Alpin", touring: "Randonnée alpine" };
const BIKE_FR: Record<string, string> = { road: "route", gravel: "gravel", mtb: "montagne", indoor: "intérieur" };

/* The id arrives as a query parameter, not as a path segment.

   A static export writes one file per route, and these ids only exist once
   somebody has trained — there is nothing to pre-render. A query parameter
   needs no file of its own, so the same page serves every id and the iOS and
   Android builds get a route they can actually ship. */
export default function ActivityPage() {
  return <Suspense fallback={<ScreenSkeleton />}><ActivityDetail /></Suspense>;
}

function ActivityDetail() {
  const id = useSearchParams().get("id") ?? "";
  const router = useRouter();
  const a = useLiveQuery(() => db.activities.get(id), [id]);
  const profile = useLiveQuery(() => getProfile(), []);
  const [toast, setToast] = useState<string | null>(null);
  const t = useT();
  const lang = useLang();
  const say = (t: string) => { setToast(t); setTimeout(() => setToast(null), 3000); };
  if (!a || !profile) return <ScreenSkeleton />;
  const u = profile.units;
  const best = a.splits.length ? Math.min(...a.splits.map((s) => s.sec)) : undefined;
  const profileData = elevationProfile(a.points);
  const workout = a.workoutId && WORKOUT_MAP[a.workoutId] ? localizeWorkout(WORKOUT_MAP[a.workoutId], lang) : undefined;
  const speedKmh = a.maxSpeedMs ? a.maxSpeedMs * 3.6 : undefined;
  // An indoor session rode a virtual road: no map, no GPS, nothing to post as a route.
  const indoor = a.meta?.indoor;

  return (
    <Page>
      <Screen>
        <div className="bleed relative h-[46vh] min-h-[320px] -mt-[calc(var(--safe-top)+16px)] lg:-mt-10 lg:h-auto lg:min-h-[62vh] mb-8 lg:mb-[var(--stack-loose)]">
          {indoor ? <Photo src={ART.course[indoor.course === "La Montagne" ? "mont-royal" : indoor.course === "La Plaine" ? "plaine" : "vallee"] ?? ART.indoor} color className="absolute inset-0 w-full h-full" /> : <MapView points={a.points} />}
          <div className="absolute inset-x-0 top-[calc(var(--safe-top)+12px)] lg:top-7">
            <div className="screen flex justify-between items-start gap-3">
              <Link href="/move" className="chip chip--live backdrop-blur-md shrink-0">{t("← Retour", "← Back")}</Link>
              <div className="flex gap-2 shrink-0"><span className="chip chip--volt">+{a.xp} XP</span>{a.shared && <span className="chip chip--live backdrop-blur-md">{t("Sur le profil", "On profile")}</span>}</div>
            </div>
          </div>
          <div className="on-photo absolute inset-x-0 bottom-0 pb-6 lg:pb-12 pt-24 bg-gradient-to-t from-ink to-transparent pointer-events-none">
            <div className="screen">
              <p className="eyebrow mb-4">{new Date(a.startedAt).toLocaleString(locale(), { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })} · <span className="capitalize">{lang === "fr" ? sportName(a.type, lang).toLowerCase() : a.type}</span>{a.feel ? (lang === "fr" ? ` · ressenti : ${FEEL_FR[a.feel]}` : ` · felt ${FEEL[a.feel].toLowerCase()}`) : ""}</p>
              <h1 className="display display--lg leading-[0.92] max-w-[16ch]" style={{ fontSize: "var(--text-display-lg)" }}>{a.title}</h1>
            </div>
          </div>
        </div>
        <div>
          <Stagger>
            <Item>
              <div className="flex gap-3 mb-5">
                <Press className="flex-1"><button type="button" className="pill pill--volt pill--block" onClick={async () => { const r = await shareCard(a, u, profile.name); say(r === "shared" ? tr("Partagé.", "Shared.") : tr("Carte téléchargée.", "Card downloaded.")); }}>{t("Partager la carte", "Share card")}</button></Press>
                {!indoor && <PostToFeed activity={a} say={say} />}
                {a.streams && <Press className="flex-1"><button type="button" className="pill pill--block" onClick={async () => { const r = await downloadTcx(a.title, toTcx(a, a.streams!)); say(r === "shared" ? tr("Partagé.", "Shared.") : tr("TCX enregistré : téléverse-le sur Strava ou Garmin Connect.", "TCX saved: upload it to Strava or Garmin Connect.")); }}>{t("Exporter pour Strava (TCX)", "Export for Strava (TCX)")}</button></Press>}
              </div>
            </Item>
            <Item>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                <Stat label={t("Distance", "Distance")} value={fmtDist(a.distanceM, u)} accent />
                <Stat label={t("Temps", "Time")} value={fmtDuration(a.durationSec)} sub={a.movingSec ? t(`en mouvement ${fmtDuration(a.movingSec)}`, `moving ${fmtDuration(a.movingSec)}`) : undefined} />
                <Stat label={rateFor(a, u).label} value={rateFor(a, u).value} sub={rateFor(a, u).sub} />
                <Stat label={t("Dénivelé", "Elevation")} count={Math.round(a.elevGainM)} suffix=" m" sub={a.elevLossM != null ? `↓ ${Math.round(a.elevLossM)} m` : t("montée", "gain")} />
                {a.kcal != null ? <Stat label={t("Calories", "Calories")} count={a.kcal} suffix=" kcal" sub={a.kcalSource === "heart_rate" ? t("selon le cardio", "from heart rate") : t("estimé", "estimated")} /> : null}
                {a.avgHr ? <Stat label={t("Fréq. cardiaque", "Heart rate")} count={a.avgHr} suffix=" bpm" sub={a.maxHr ? t(`moy. · max ${a.maxHr}`, `avg · max ${a.maxHr}`) : t("moy.", "avg")} /> : null}
                {speedKmh ? <Stat label={t("Vitesse max", "Max speed")} value={u.distance === "mi" ? `${(speedKmh / 1.609).toFixed(1)} mph` : `${speedKmh.toFixed(1)} km/h`} /> : null}
                {indoor?.avgW ? <Stat label={t("Puissance moy.", "Avg power")} count={indoor.avgW} suffix=" W" sub={indoor.quality} /> : null}
                {indoor ? <Stat label={t("Intérieur", "Indoor")} value={indoor.workout ?? indoor.course} sub={indoor.with ? t(`avec ${indoor.with} en direct`, `with ${indoor.with} live`) : indoor.quality === "declared" ? t("effort réglé à la main", "effort set by hand") : indoor.quality} /> : a.type === "swim" && a.meta?.laps ? <Stat label={t("Longueurs", "Laps")} count={a.meta.laps} sub={t(`bassin de ${a.meta.poolM ?? 25} m`, `${a.meta.poolM ?? 25} m pool`)} /> : a.meta?.discipline ? <Stat label={t("Discipline", "Discipline")} value={lang === "fr" ? DISCIPLINE_FR[a.meta.discipline] ?? a.meta.discipline : a.meta.discipline.replace("xc-", "XC ")} /> : a.meta?.bike ? <Stat label={t("Vélo", "Bike")} value={lang === "fr" ? BIKE_FR[a.meta.bike] ?? a.meta.bike : a.meta.bike} /> : <Stat label={t("Points", "Points")} count={a.points.length} sub={t("points GPS", "GPS samples")} />}
              </div>
            </Item>
            {a.points.length > 1 && <Item>
              <Section title={t("Profil d’élévation", "Elevation profile")}>
                <div className="card p-4"><ElevationChart profile={profileData} /></div>
              </Section>
            </Item>}
            {a.laps && a.laps.length > 0 && (
              <Item>
                <Section title={t(`Tours · ${workout?.name ?? "guidé"}`, `Laps · ${workout?.name ?? "guided"}`)}>
                  <ul className="card px-4 divide-y divide-line">{a.laps.map((l, i) => (
                    <li key={i} className="py-2.5 grid grid-cols-[1fr_auto_auto] gap-3 text-sm tnum items-center">
                      <span><span className="chip mr-2" style={{ background: `rgba(31,199,111,${[0, .18, .32, .5, .7, 1][l.zone]})`, color: "var(--ink)", borderColor: "transparent" }}>Z{l.zone}</span>{segmentLabel(l.label, lang)}</span>
                      <span className="text-smoke text-xs">{lang === "fr" ? ZONE_LABEL_FR[l.zone] : ZONE_LABEL[l.zone]}</span>
                      <span>{fmtDist(l.distanceM, u)} · {fmtDuration(l.seconds)}</span>
                    </li>))}</ul>
                </Section>
              </Item>
            )}
            <Item>
              <Section title={t("Temps au km", "Splits")}>
                {a.splits.length === 0 ? <p className="text-sm text-smoke">{t("Moins d’un kilomètre — pas de temps au km.", "Under a kilometre — no splits.")}</p> : (
                  <ul className="card px-4 divide-y divide-line">{a.splits.map((s, i) => (
                    <li key={s.km} className="grid grid-cols-[48px_1fr_auto] items-center gap-3 text-sm tnum py-2.5">
                      <span className="meta">{s.km} km</span>
                      <div className="bar"><motion.i initial={{ width: 0 }} animate={{ width: `${(best! / s.sec) * 100}%` }} transition={{ duration: 0.8, delay: i * 0.06 }} style={{ background: s.sec === best ? "var(--volt)" : "rgba(236,231,223,.6)" }} /></div>
                      <span className={s.sec === best ? "text-volt" : ""}>{fmtDuration(s.sec)}</span>
                    </li>
                  ))}</ul>
                )}
              </Section>
            </Item>
            {a.note && <Item><Section title={t("Note", "Note")}><p className="card p-4 text-sm">{a.note}</p></Section></Item>}
            <Item><button type="button" className="pill pill--danger pill--sm" onClick={async () => { if (confirm(tr("Supprimer cette activité ?", "Delete this activity?"))) { await db.activities.delete(id); router.push("/move"); } }}>{t("Supprimer l’activité", "Delete activity")}</button></Item>
          </Stagger>
        </div>
        <Toast text={toast} />
      </Screen>
    </Page>
  );
}
