"use client";

import { Suspense, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { db, getProfile } from "@/lib/db";
import { elevationProfile } from "@/lib/geo";
import { shareCard } from "@/lib/share";
import { PostToFeed } from "@/components/PostToFeed";
import { WORKOUT_MAP, ZONE_LABEL } from "@/lib/data/workouts";
import { fmtDist, fmtDuration } from "@/lib/units";
import { rateFor } from "@/components/move-bits";
import { Screen, Section, Stat, Toast, ScreenSkeleton } from "@/components/ui";
import { Page, Stagger, Item, Press, motion } from "@/components/motion";
import { ElevationChart } from "@/components/charts";

const MapView = dynamic(() => import("@/components/MapView").then((m) => m.MapView), { ssr: false, loading: () => <div className="w-full h-full skeleton !rounded-none" /> });
const FEEL = ["", "Rough", "Meh", "OK", "Good", "Flying"];

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
  const say = (t: string) => { setToast(t); setTimeout(() => setToast(null), 3000); };
  if (!a || !profile) return <ScreenSkeleton />;
  const u = profile.units;
  const best = a.splits.length ? Math.min(...a.splits.map((s) => s.sec)) : undefined;
  const profileData = elevationProfile(a.points);
  const workout = a.workoutId ? WORKOUT_MAP[a.workoutId] : undefined;
  const speedKmh = a.maxSpeedMs ? a.maxSpeedMs * 3.6 : undefined;

  return (
    <Page>
      <Screen>
        <div className="bleed relative h-[46vh] min-h-[320px] -mt-[calc(var(--safe-top)+16px)] lg:-mt-10 lg:h-auto lg:min-h-[62vh] mb-8 lg:mb-[var(--stack-loose)]">
          <MapView points={a.points} />
          <div className="absolute inset-x-0 top-[calc(var(--safe-top)+12px)] lg:top-7">
            <div className="screen flex justify-between items-start gap-3">
              <Link href="/move" className="chip chip--live backdrop-blur-md shrink-0">← Back</Link>
              <div className="flex gap-2 shrink-0"><span className="chip chip--volt">+{a.xp} XP</span>{a.shared && <span className="chip chip--live backdrop-blur-md">On profile</span>}</div>
            </div>
          </div>
          <div className="on-photo absolute inset-x-0 bottom-0 pb-6 lg:pb-12 pt-24 bg-gradient-to-t from-ink to-transparent pointer-events-none">
            <div className="screen">
              <p className="eyebrow mb-4">{new Date(a.startedAt).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })} · <span className="capitalize">{a.type}</span>{a.feel ? ` · felt ${FEEL[a.feel].toLowerCase()}` : ""}</p>
              <h1 className="display display--lg leading-[0.92] max-w-[16ch]" style={{ fontSize: "var(--text-display-lg)" }}>{a.title}</h1>
            </div>
          </div>
        </div>
        <div>
          <Stagger>
            <Item>
              <div className="flex gap-3 mb-5">
                <Press className="flex-1"><button type="button" className="pill pill--volt pill--block" onClick={async () => { const r = await shareCard(a, u, profile.name); say(r === "shared" ? "Shared." : "Card downloaded."); }}>Share card</button></Press>
                <PostToFeed activity={a} say={say} />
              </div>
            </Item>
            <Item>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                <Stat label="Distance" value={fmtDist(a.distanceM, u)} accent />
                <Stat label="Time" value={fmtDuration(a.durationSec)} sub={a.movingSec ? `moving ${fmtDuration(a.movingSec)}` : undefined} />
                <Stat label={rateFor(a, u).label} value={rateFor(a, u).value} sub={rateFor(a, u).sub} />
                <Stat label="Elevation" count={Math.round(a.elevGainM)} suffix=" m" sub={a.elevLossM != null ? `↓ ${Math.round(a.elevLossM)} m` : "gain"} />
                {speedKmh ? <Stat label="Max speed" value={u.distance === "mi" ? `${(speedKmh / 1.609).toFixed(1)} mph` : `${speedKmh.toFixed(1)} km/h`} /> : null}
                {a.type === "swim" && a.meta?.laps ? <Stat label="Laps" count={a.meta.laps} sub={`${a.meta.poolM ?? 25} m pool`} /> : a.meta?.discipline ? <Stat label="Discipline" value={a.meta.discipline.replace("xc-", "XC ")} /> : a.meta?.bike ? <Stat label="Bike" value={a.meta.bike} /> : <Stat label="Points" count={a.points.length} sub="GPS samples" />}
              </div>
            </Item>
            <Item>
              <Section title="Elevation profile">
                <div className="card p-4"><ElevationChart profile={profileData} /></div>
              </Section>
            </Item>
            {a.laps && a.laps.length > 0 && (
              <Item>
                <Section title={`Laps · ${workout?.name ?? "guided"}`}>
                  <ul className="card px-4 divide-y divide-line">{a.laps.map((l, i) => (
                    <li key={i} className="py-2.5 grid grid-cols-[1fr_auto_auto] gap-3 text-sm tnum items-center">
                      <span><span className="chip mr-2" style={{ background: `rgba(212,255,58,${[0, .25, .45, .65, .85, 1][l.zone]})`, color: l.zone >= 3 ? "var(--ink)" : "var(--bone)", borderColor: "transparent" }}>Z{l.zone}</span>{l.label}</span>
                      <span className="text-smoke text-xs">{ZONE_LABEL[l.zone]}</span>
                      <span>{fmtDist(l.distanceM, u)} · {fmtDuration(l.seconds)}</span>
                    </li>))}</ul>
                </Section>
              </Item>
            )}
            <Item>
              <Section title="Splits">
                {a.splits.length === 0 ? <p className="text-sm text-smoke">Under a kilometre — no splits.</p> : (
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
            {a.note && <Item><Section title="Note"><p className="card p-4 text-sm">{a.note}</p></Section></Item>}
            <Item><button type="button" className="pill pill--danger pill--sm" onClick={async () => { if (confirm("Delete this activity?")) { await db.activities.delete(id); router.push("/move"); } }}>Delete activity</button></Item>
          </Stagger>
        </div>
        <Toast text={toast} />
      </Screen>
    </Page>
  );
}
