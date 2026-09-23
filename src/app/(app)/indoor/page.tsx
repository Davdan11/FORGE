"use client";

import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Pencil, Users } from "lucide-react";
import { db, getProfile, uid } from "@/lib/db";
import { generateCourse, courseFromActivity, at, type Course } from "@/lib/indoor/course";
import { guessFtp } from "@/lib/indoor/physics";
import { BUILT_IN_WORKOUTS, flatten, guessThresholdKmh, stressScore, totalSec, type StructuredWorkout } from "@/lib/indoor/workouts";
import { peekRoom } from "@/lib/indoor/live";
import { activityKcal, hrSummary } from "@/lib/heart";
import { awardChallenges, awardIndoor, indoorXpBreakdown } from "@/lib/progress";
import { isConfigured, supabase } from "@/lib/supabase/client";
import { fmtDist, fmtDuration } from "@/lib/units";
import { Screen, Hero, Photo, Section, ScreenSkeleton, Toast, Seg, Stat } from "@/components/ui";
import { ART } from "@/lib/data/images";
import { Page, Press } from "@/components/motion";
import { Ride, type RideResult, type Sport } from "@/components/indoor/Ride";
import { UnityRide } from "@/components/indoor/UnityRide";
import { WorkoutBuilder, pace } from "@/components/indoor/WorkoutBuilder";
import { WorkoutChart } from "@/components/indoor/WorkoutChart";
import type { Activity, Profile as AthleteProfile, UnitPrefs } from "@/lib/types";

const BUILT_IN = [
  { id: "vallee", name: "Vallée", lengthM: 12_000, hilliness: 0.35 },
  { id: "mont-royal", name: "La Montagne", lengthM: 9_000, hilliness: 0.95 },
  { id: "plaine", name: "La Plaine", lengthM: 20_000, hilliness: 0.08 },
];

type View = { v: "pick" } | { v: "ride" } | { v: "unity" } | { v: "build"; w: StructuredWorkout; isNew: boolean } | { v: "summary"; r: RideResult };

export default function IndoorPage() {
  const profile = useLiveQuery(() => getProfile(), []);
  const ridesRaw = useLiveQuery(() => db.activities.where("type").anyOf("ride", "run", "trail").reverse().limit(12).toArray(), []);
  // Indoor sessions have no track to turn into a course.
  const rides = useMemo(() => (ridesRaw ?? []).filter((r) => !r.meta?.indoor), [ridesRaw]);

  const [sport, setSport] = useState<Sport>("ride");
  const [courseId, setCourseId] = useState("vallee");
  const [workoutId, setWorkoutId] = useState<string | null>(null);
  const [view, setView] = useState<View>({ v: "pick" });
  const [toast, setToast] = useState<string | null>(null);
  const say = (m: string) => { setToast(m); setTimeout(() => setToast(null), 3400); };

  const course = useMemo<Course | null>(() => {
    const built = BUILT_IN.find((c) => c.id === courseId);
    if (built) return generateCourse(built);
    const ride = rides.find((r) => r.id === courseId);
    return ride ? courseFromActivity(ride) : null;
  }, [courseId, rides]);

  const ftpW = profile?.ftpW ?? (profile ? guessFtp(profile.weightKg, profile.level) : 200);
  const thresholdKmh = profile?.thresholdKmh ?? (profile ? guessThresholdKmh(profile.level) : 10);
  // One object for the whole ride: the ride loop restarts when this changes.
  const thresholds = useMemo(() => ({ ftpW, thresholdKmh }), [ftpW, thresholdKmh]);

  const mine = useMemo(() => profile?.indoorWorkouts ?? [], [profile?.indoorWorkouts]);
  const workouts = useMemo(() => [...mine, ...BUILT_IN_WORKOUTS].filter((w) => w.sport === sport), [mine, sport]);
  const workout = workouts.find((w) => w.id === workoutId) ?? null;

  // Who is on the selected course right now, without joining it.
  // Keyed by room, so switching course never shows the previous room's count.
  const [live, setLive] = useState({ room: "", n: 0 });
  const roomKey = course ? `${sport}:${course.id}` : "";
  const liveCount = live.room === roomKey ? live.n : 0;
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    supabase?.auth.getUser().then(({ data }) => setSignedIn(!!data.user)).catch(() => {});
  }, []);
  useEffect(() => {
    if (view.v !== "pick" || !course) return;
    const key = `${sport}:${course.id}`;
    return peekRoom(course.id, sport, (n) => setLive({ room: key, n }));
  }, [course, sport, view.v]);

  if (!profile) return <ScreenSkeleton />;

  async function saveProfile(patch: Partial<AthleteProfile>) {
    await db.profile.update(profile!.id, { ...patch, dirty: 1, updatedAt: new Date().toISOString() });
  }

  async function saveWorkout(w: StructuredWorkout) {
    const next = [w, ...mine.filter((x) => x.id !== w.id)];
    await saveProfile({ indoorWorkouts: next });
    setWorkoutId(w.id);
    setView({ v: "pick" });
    say("Workout saved.");
  }

  async function deleteWorkout(id: string) {
    await saveProfile({ indoorWorkouts: mine.filter((x) => x.id !== id) });
    if (workoutId === id) setWorkoutId(null);
    setView({ v: "pick" });
  }

  if (view.v === "ride" && course) {
    return (
      <Page>
        <Ride course={course} profile={profile} sport={sport} workout={workout} thresholds={thresholds} say={say}
          onEnd={(r) => { if (r) setView({ v: "summary", r }); else { setView({ v: "pick" }); say("Too short to save."); } }} />
        <Toast text={toast} />
      </Page>
    );
  }

  if (view.v === "unity") {
    return (
      <Page>
        <UnityRide profile={profile} ftpW={ftpW} say={say} onExit={(msg) => { setView({ v: "pick" }); if (msg) say(msg); }} />
        <Toast text={toast} />
      </Page>
    );
  }

  if (view.v === "summary") {
    return (
      <Page>
        <Summary r={view.r} profile={profile}
          onDone={(msg) => { setView({ v: "pick" }); if (msg) say(msg); }} />
        <Toast text={toast} />
      </Page>
    );
  }

  if (view.v === "build") {
    return (
      <Page>
        <Screen>
          <Hero image={ART.indoor} color height="h-[220px]" eyebrow="Indoor · workout" title={view.isNew ? <>Build a<br /><em>workout.</em></> : <>Edit<br /><em>{view.w.name}.</em></>} />
          <WorkoutBuilder initial={view.w} thresholds={thresholds}
            onSave={saveWorkout} onCancel={() => setView({ v: "pick" })}
            onDelete={view.isNew ? undefined : () => deleteWorkout(view.w.id)} />
        </Screen>
        <Toast text={toast} />
      </Page>
    );
  }

  const verb = sport === "ride" ? "Ride" : "Run";

  return (
    <Page>
      <Screen>
        <Hero image={ART.indoor} color height="h-[340px]" eyebrow="Indoor"
          title={sport === "ride" ? <>Ride the hill<br /><em>from your basement.</em></> : <>Run the hill<br /><em>on your treadmill.</em></>}>
          <p className="text-sm text-bone/80 max-w-[48ch]">
            {sport === "ride"
              ? "Your effort moves you. Gradient, drag and your own weight decide how fast — and a smart trainer makes you feel every climb."
              : "Your belt speed moves you. A smart treadmill can follow the hills; a footpod or a strap works on any treadmill."}
          </p>
        </Hero>

        <div className="mb-6"><Seg fill value={sport} onChange={(v) => { setSport(v); setWorkoutId(null); }} options={[{ v: "ride", label: "Ride" }, { v: "run", label: "Run" }]} /></div>

        {sport === "ride" && (
          <Press className="block mb-6">
            <button type="button" onClick={() => setView({ v: "unity" })} className="card p-4 w-full text-left flex items-center gap-4 !border-volt">
              <span className="w-11 h-11 rounded-xl grid place-items-center shrink-0 bg-volt text-ink"><Users className="w-5 h-5" strokeWidth={2} /></span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">FORGE Ride · 3D world, online</span>
                <span className="block text-xs text-smoke mt-0.5">Nine routes in six countries, group rides every 30 minutes, drafting, medals. Everyone on the same road rides with you.</span>
              </span>
            </button>
          </Press>
        )}

        <Section title="Pick a course">
          <div className="grid gap-2">
            {BUILT_IN.map((c) => {
              const built = generateCourse(c);
              return <CourseRow key={c.id} id={c.id} name={c.name} course={built} on={courseId === c.id} onPick={setCourseId} units={profile.units} image={ART.course[c.id]} />;
            })}
          </div>
        </Section>

        {rides.length > 0 && (
          <Section title="Your own routes" aside={<span className="text-xs text-smoke">recorded outside</span>}>
            <p className="text-xs text-smoke mb-3 max-w-[54ch]">
              Any route you recorded becomes a course. The ends are trimmed the same way a published route is, so a course you share is not a map to your door.
            </p>
            <div className="grid gap-2">
              {rides.map((r) => {
                const c = courseFromActivity(r);
                if (!c) return null;
                return <CourseRow key={r.id} id={r.id} name={r.title} course={c} on={courseId === r.id} onPick={setCourseId} units={profile.units} />;
              })}
            </div>
          </Section>
        )}

        <Section title="Workout" aside={<button type="button" className="text-xs underline text-smoke" onClick={() => setView({ v: "build", isNew: true, w: { id: uid(), name: "", sport, blocks: [{ kind: "ramp", sec: 600, from: 45, to: 75 }, { kind: "steady", sec: 1200, pct: 80 }, { kind: "ramp", sec: 300, from: 65, to: 40 }] } })}>+ Build your own</button>}>
          <div className="grid gap-2">
            <button type="button" aria-pressed={workoutId === null} onClick={() => setWorkoutId(null)}
              className={`card p-4 text-left transition-colors ${workoutId === null ? "!border-volt" : ""}`}>
              <p className="font-semibold">Free {sport === "ride" ? "ride" : "run"}</p>
              <p className="text-xs text-smoke mt-0.5">{sport === "ride" ? "The road sets the resistance." : "Your pace, your call."}</p>
            </button>
            {workouts.map((w) => {
              const steps = flatten(w);
              return (
                <div key={w.id} className={`card p-4 grid gap-2 transition-colors ${workoutId === w.id ? "!border-volt" : ""}`}>
                  <button type="button" aria-pressed={workoutId === w.id} onClick={() => setWorkoutId(w.id)} className="text-left grid gap-2">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="font-semibold truncate">{w.name}</p>
                      <p className="text-xs text-smoke tnum shrink-0">{fmtDuration(totalSec(steps))} · stress {stressScore(steps)}</p>
                    </div>
                    <WorkoutChart workout={w} className="h-10 w-full text-ink" />
                  </button>
                  {!w.builtIn
                    ? <button type="button" className="text-xs text-smoke underline justify-self-start flex items-center gap-1" onClick={() => setView({ v: "build", isNew: false, w })}><Pencil className="w-3 h-3" />Edit</button>
                    : <button type="button" className="text-xs text-smoke underline justify-self-start" onClick={() => setView({ v: "build", isNew: true, w: { ...w, id: uid(), name: `${w.name} (mine)`, builtIn: false } })}>Copy and edit</button>}
                </div>
              );
            })}
          </div>
          <Thresholds sport={sport} ftpW={ftpW} thresholdKmh={thresholdKmh} tested={sport === "ride" ? profile.ftpW != null : profile.thresholdKmh != null}
            onChange={(patch) => saveProfile(patch)} />
        </Section>

        {course && isConfigured && (
          <div className="card mt-6 p-4 flex items-start gap-3 text-sm">
            <span className={`w-9 h-9 rounded-xl grid place-items-center shrink-0 ${liveCount > 0 ? "bg-volt text-ink" : "bg-graphite text-smoke"}`}><Users className="w-4 h-4" strokeWidth={2} /></span>
            <span className="min-w-0">
              {liveCount > 0
                ? <><strong className="tnum">{liveCount}</strong> {liveCount === 1 ? "person is" : "people are"} {sport === "ride" ? "riding" : "running"} {course.name} right now{signedIn ? " — you'll join them." : "."}</>
                : <span className="text-smoke">Nobody on {course.name} right now. Start, and anyone who joins will appear on the road.</span>}
              {!signedIn && <span className="block text-xs text-smoke mt-1">Sign in to appear to others.</span>}
            </span>
          </div>
        )}

        <Press className="mt-4 block">
          <button type="button" className="pill pill--volt pill--block pill--lg" disabled={!course} onClick={() => setView({ v: "ride" })}>
            {course ? `${verb} ${course.name}${workout ? ` · ${workout.name}` : ""}` : "Pick a course"}
          </button>
        </Press>
      </Screen>
      <Toast text={toast} />
    </Page>
  );
}

/** FTP and threshold pace: guessed from level until the athlete enters a real one. */
function Thresholds({ sport, ftpW, thresholdKmh, tested, onChange }: { sport: Sport; ftpW: number; thresholdKmh: number; tested: boolean; onChange: (p: Partial<AthleteProfile>) => void }) {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState(String(sport === "ride" ? ftpW : thresholdKmh));
  return (
    <div className="mt-3 text-xs text-smoke">
      {!open ? (
        <p>
          Targets use {sport === "ride" ? <>an FTP of <strong className="text-ink tnum">{ftpW} W</strong></> : <>a threshold of <strong className="text-ink tnum">{thresholdKmh} km/h</strong> ({pace(thresholdKmh / 3.6)} /km)</>}
          {tested ? "" : ", guessed from your level"}. <button type="button" className="underline" onClick={() => { setV(String(sport === "ride" ? ftpW : thresholdKmh)); setOpen(true); }}>Change</button>
        </p>
      ) : (
        <form className="flex items-center gap-2" onSubmit={(e) => {
          e.preventDefault();
          const n = parseFloat(v);
          if (sport === "ride" && n >= 50 && n <= 600) onChange({ ftpW: Math.round(n) });
          if (sport === "run" && n >= 5 && n <= 25) onChange({ thresholdKmh: Math.round(n * 10) / 10 });
          setOpen(false);
        }}>
          <input className="input !h-9 w-24 tnum" type="number" inputMode="decimal" value={v} onChange={(e) => setV(e.target.value)} autoFocus />
          <span>{sport === "ride" ? "W" : "km/h"}</span>
          <button type="submit" className="pill pill--sm">Save</button>
        </form>
      )}
    </div>
  );
}

/* ── after the session ────────────────────────────────────── */

function Summary({ r, profile, onDone }: { r: RideResult; profile: AthleteProfile; onDone: (msg?: string) => void }) {
  const [busy, setBusy] = useState(false);
  const xp = indoorXpBreakdown({ durationSec: r.durationSec, movingSec: r.movingSec, elevGainM: r.elevGainM, workout: r.workoutDone }, r.credit);
  const u = profile.units;
  const hrs = hrSummary(r.hr);

  async function save() {
    setBusy(true);
    const k = activityKcal({ type: r.sport, movingMin: r.movingSec / 60, distanceM: r.distanceM, profile, hr: r.hr });
    // Measured watts give the energy directly: ~1 kcal of food per kJ of work,
    // since the body is about 24 % efficient and 1 kcal is 4.184 kJ.
    const kcal = r.avgW && r.quality === "measured" && k.source !== "heart_rate" ? Math.round((r.avgW * r.movingSec) / 1000) : k.kcal;
    const a: Activity = {
      id: uid(),
      type: r.sport,
      startedAt: r.startedAt,
      endedAt: r.endedAt,
      distanceM: r.distanceM,
      durationSec: r.durationSec,
      movingSec: r.movingSec,
      avgPaceSecKm: r.distanceM > 0 ? r.movingSec / (r.distanceM / 1000) : undefined,
      elevGainM: r.elevGainM,
      points: [],
      splits: r.splits,
      title: `${r.course.name} · indoor ${r.sport === "ride" ? "ride" : "run"}`,
      shared: false,
      xp: 0,
      meta: { discipline: "indoor", indoor: { course: r.course.name, quality: r.quality, avgW: r.avgW, workout: r.workout, workoutDone: r.workoutDone || undefined, with: r.withPeople || undefined } },
      hrSeries: r.hr.length ? r.hr : undefined,
      avgHr: hrs?.avg,
      maxHr: hrs?.max,
      kcal,
      kcalSource: k.source,
    };
    const { xp: got, earned } = await awardIndoor(a, r.credit);
    await db.activities.put({ ...a, xp: got, dirty: 1, updatedAt: new Date().toISOString() } as Activity);
    const won = r.credit > 0 ? await awardChallenges(r.sport, u.distance) : { xp: 0, titles: [] as string[] };
    onDone(`Saved. +${got + won.xp} XP${won.titles.length ? ` · challenge: ${won.titles.join(", ")}` : ""}${earned.length ? ` · badge: ${earned.join(", ")}` : ""}`);
  }

  return (
    <Screen>
      <Hero image={ART.indoor} color height="h-[240px]" eyebrow={`Indoor ${r.sport === "ride" ? "ride" : "run"} · ${r.course.name}`} title={<>Session<br /><em>done.</em></>} />
      <div className="grid grid-cols-2 gap-3 mb-6">
        <Stat label="Distance" value={fmtDist(r.distanceM, u)} accent />
        <Stat label="Time" value={fmtDuration(r.durationSec)} sub={`moving ${fmtDuration(r.movingSec)}`} />
        {r.sport === "ride"
          ? <Stat label="Avg power" value={r.avgW != null ? `${r.avgW} W` : "—"} sub={r.quality} />
          : <Stat label="Avg pace" value={`${pace(r.distanceM / Math.max(1, r.movingSec))} /km`} sub={r.quality} />}
        <Stat label="Climb" count={r.elevGainM} suffix=" m" />
        {hrs && <Stat label="Heart rate" count={hrs.avg} suffix=" bpm" sub={`avg · max ${hrs.max}`} />}
        {r.withPeople > 0 && <Stat label="Rode with" count={r.withPeople} sub={r.withPeople === 1 ? "person" : "people"} />}
      </div>
      <Section title={`+${xp.total} XP`} aside={<span className="text-xs text-smoke">{Math.round(r.credit * 100)} % credit</span>}>
        <ul className="card px-4 divide-y divide-line text-sm">
          {xp.parts.map((p) => <li key={p.label} className="py-2.5 flex justify-between"><span>{p.label}</span><span className="tnum text-smoke">+{Math.round(p.xp * r.credit)}</span></li>)}
        </ul>
        {r.credit < 1 && (
          <p className="text-xs text-smoke mt-2 max-w-[56ch]">
            {r.credit === 0 ? "Effort was set by hand, so it counts as a session but earns no XP." : "Part of the effort was estimated from heart rate, which earns 60 %. A power meter, smart trainer or treadmill earns it all."}
          </p>
        )}
      </Section>
      <div className="flex gap-2 mt-6">
        <Press className="flex-1"><button type="button" className="pill pill--volt pill--block pill--lg" disabled={busy} onClick={save}>Save session</button></Press>
        <button type="button" className="pill pill--lg" disabled={busy} onClick={() => { if (confirm("Discard this session?")) onDone("Discarded."); }}>Discard</button>
      </div>
    </Screen>
  );
}

function CourseRow({ id, name, course, on, onPick, units, image }: { id: string; name: string; course: Course; on: boolean; onPick: (v: string) => void; units: UnitPrefs; image?: string }) {
  return (
    <button type="button" aria-pressed={on} onClick={() => onPick(id)}
      className={`card p-4 flex items-center justify-between gap-4 text-left transition-colors ${on ? "!border-volt" : ""}`}>
      {image && <Photo src={image} color className="thumb !w-16 !h-16 shrink-0" />}
      <div className="min-w-0 flex-1">
        <p className="font-semibold truncate">{name}</p>
        <p className="text-xs text-smoke tnum mt-0.5">
          {fmtDist(course.lengthM, units)} · ↑ {Math.round(course.elevGainM)} m{course.loop ? " · loop" : ""}
        </p>
      </div>
      <Profile course={course} />
    </button>
  );
}

/** The course drawn as its own elevation profile. */
function Profile({ course }: { course: Course }) {
  const n = 64;
  const alts = Array.from({ length: n }, (_, i) => at(course, (i / (n - 1)) * course.lengthM).alt);
  const hi = Math.max(...alts, 1);
  const d = alts.map((a, i) => `${i ? "L" : "M"}${(i / (n - 1)) * 100} ${28 - (a / hi) * 24}`).join(" ");
  return (
    <svg viewBox="0 0 100 30" className="w-[110px] h-8 shrink-0 text-volt" preserveAspectRatio="none" aria-hidden="true">
      <path d={`${d} L100 30 L0 30 Z`} fill="currentColor" fillOpacity={0.16} />
      <path d={d} fill="none" stroke="currentColor" strokeWidth={1.4} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
