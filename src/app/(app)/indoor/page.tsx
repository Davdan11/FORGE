"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useLiveQuery } from "dexie-react-hooks";
import { Bluetooth, BluetoothOff, Gauge, Heart, Mountain, ChevronDown, ChevronUp } from "lucide-react";
import { db, getProfile } from "@/lib/db";
import { generateCourse, courseFromActivity, at, type Course } from "@/lib/indoor/course";
import { step, ROAD_BIKE, powerFromHr, powerFromSpeed, declaredPower, guessFtp, maxHrFor, XP_CREDIT, type Effort } from "@/lib/indoor/physics";
import { sensorAvailability, connectSensor, SensorFusion, SENSOR_LABEL, type Availability, type Sensor, type SensorKind } from "@/lib/indoor/sensors";
import { fmtDist, fmtDuration } from "@/lib/units";
import { Screen, Section, ScreenSkeleton, Toast } from "@/components/ui";
import { Page, Press } from "@/components/motion";
import type { Rider } from "@/components/indoor/World";
import { startPacers, stepPacers, placeInBunch, gapToNext, type PacerState } from "@/lib/indoor/pacers";
import type { Profile as AthleteProfile, UnitPrefs } from "@/lib/types";

// Three.js is ~600 KB. It has no business in the bundle of anyone who never
// opens this screen, and it cannot run on the server at all.
const World = dynamic(() => import("@/components/indoor/World").then((m) => m.World), {
  ssr: false,
  loading: () => <div className="w-full h-full skeleton !rounded-none" />,
});

const BUILT_IN = [
  { id: "vallee", name: "Vallée", lengthM: 12_000, hilliness: 0.35 },
  { id: "mont-royal", name: "La Montagne", lengthM: 9_000, hilliness: 0.95 },
  { id: "plaine", name: "La Plaine", lengthM: 20_000, hilliness: 0.08 },
];

export default function IndoorPage() {
  const profile = useLiveQuery(() => getProfile(), []);
  const ridesRaw = useLiveQuery(() => db.activities.where("type").anyOf("ride", "run", "trail").reverse().limit(12).toArray(), []);
  const rides = useMemo(() => ridesRaw ?? [], [ridesRaw]);

  const [courseId, setCourseId] = useState("vallee");
  const [riding, setRiding] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const say = (m: string) => { setToast(m); setTimeout(() => setToast(null), 3400); };

  const course = useMemo<Course | null>(() => {
    const built = BUILT_IN.find((c) => c.id === courseId);
    if (built) return generateCourse(built);
    const ride = rides.find((r) => r.id === courseId);
    return ride ? courseFromActivity(ride) : null;
  }, [courseId, rides]);

  if (!profile) return <ScreenSkeleton />;

  return (
    <Page>
      {riding && course ? (
        <Ride course={course} profile={profile} onStop={() => setRiding(false)} say={say} />
      ) : (
        <Screen>
          <header className="mb-6">
            <span className="eyebrow">Indoor</span>
            <h1 className="display text-4xl lg:text-5xl mt-2 leading-none">Ride the hill<br /><em>from your basement.</em></h1>
            <p className="text-sm text-smoke mt-3 max-w-[48ch]">
              Your effort moves you. Gradient, drag and your own weight decide how fast — so the climb is a climb.
            </p>
          </header>

          <Section title="Pick a course">
            <div className="grid gap-2">
              {BUILT_IN.map((c) => {
                const built = generateCourse(c);
                return <CourseRow key={c.id} id={c.id} name={c.name} course={built} on={courseId === c.id} onPick={setCourseId} units={profile.units} />;
              })}
            </div>
          </Section>

          {rides.length > 0 && (
            <Section title="Your own routes" aside={<span className="text-xs text-smoke">ridden outside</span>}>
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

          <Press className="mt-6 block">
            <button type="button" className="pill pill--volt pill--block pill--lg" disabled={!course} onClick={() => setRiding(true)}>
              {course ? `Ride ${course.name}` : "Pick a course"}
            </button>
          </Press>
        </Screen>
      )}
      <Toast text={toast} />
    </Page>
  );
}

function CourseRow({ id, name, course, on, onPick, units }: { id: string; name: string; course: Course; on: boolean; onPick: (v: string) => void; units: UnitPrefs }) {
  return (
    <button type="button" aria-pressed={on} onClick={() => onPick(id)}
      className={`card p-4 flex items-center justify-between gap-4 text-left transition-colors ${on ? "!border-volt" : ""}`}>
      <div className="min-w-0">
        <p className="font-semibold truncate">{name}</p>
        <p className="text-xs text-smoke tnum mt-0.5">
          {fmtDist(course.lengthM, units)} · ↑ {Math.round(course.elevGainM)} m{course.loop ? " · loop" : ""}
        </p>
      </div>
      <Profile course={course} />
    </button>
  );
}

/** The course drawn as its own elevation profile — the shape you are about to
 *  ride, visible before you commit to riding it. */
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

/* ── the ride itself ──────────────────────────────────────── */

function Ride({ course, profile, onStop, say }: {
  course: Course;
  profile: AthleteProfile;
  onStop: () => void;
  say: (m: string) => void;
}) {
  const bike = useMemo(() => ROAD_BIKE(profile.weightKg), [profile.weightKg]);
  const ftp = useMemo(() => guessFtp(profile.weightKg, profile.level), [profile.weightKg, profile.level]);
  const maxHr = useMemo(() => maxHrFor(profile.age), [profile.age]);

  const fusion = useRef(new SensorFusion());
  const [sensors, setSensors] = useState<Sensor[]>([]);
  // Which sensor is mid-connect. A button that looks identical while it is
  // working reads as a button that did nothing.
  const [connecting, setConnecting] = useState<SensorKind | null>(null);
  // Zero, not 150. A rider who sets off down the road on their own the moment
  // the screen opens, with nothing connected and nobody pedalling, is the app
  // inventing an effort — and it reads exactly as wrong as it is.
  const [manualW, setManualW] = useState(0);

  // Physics state lives in refs: it changes sixty times a second and React
  // has no business seeing most of those.
  const speed = useRef(0);
  const distance = useRef(0);
  // Set when the loop starts, not during render — Date.now() in a render is a
  // different answer every time React happens to re-run it.
  const started = useRef(0);
  const riders = useRef<Rider[]>([{ id: "me", distanceM: 0, me: true }]);
  const pacers = useRef<PacerState[]>(startPacers());
  // The panel covers a third of the screen. On a phone that is most of the
  // world, and the one thing you never see is your own rider.
  const [hudOpen, setHudOpen] = useState(true);

  // The loop reads these through refs so it never has to be rebuilt; restarting
  // it would reset its clock and stutter the ride. Synced in an effect rather
  // than assigned during render, which React forbids for good reason.
  const manualRef = useRef(manualW);
  const hasSensorRef = useRef(false);
  useEffect(() => { manualRef.current = manualW; }, [manualW]);
  useEffect(() => { hasSensorRef.current = sensors.length > 0; }, [sensors]);

  // The dial, sampled at a rate a person can read.
  const [dials, setDials] = useState({ speedMs: 0, distanceM: 0, watts: 0, quality: "declared" as Effort["quality"], hr: 0, cadence: 0, gradient: 0, elapsed: 0, position: 1, of: 1, gapM: null as number | null });

  // Reaching a sensor is an async question now: the native transport has to
  // load a plugin before it can answer. Null means "still asking".
  const [availability, setAvailability] = useState<Availability | null>(null);
  useEffect(() => {
    let alive = true;
    sensorAvailability().then((a) => { if (alive) setAvailability(a); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let lastHud = 0;
    started.current = Date.now();

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      // Clamped at both ends. The ceiling covers a backgrounded tab returning
      // with a huge gap; the floor covers a clock that steps backwards, which
      // ran the physics in reverse and put the ride at "-0.00 km, lap 0"
      // before anybody had turned a pedal.
      const dt = Math.max(0, Math.min((now - last) / 1000, 0.1));
      last = now;

      // Where does the effort come from, and what is it worth?
      const power = fusion.current.get("power");
      const hr = fusion.current.get("hr");
      const machineSpeed = fusion.current.get("speedMs");

      let effort: Effort;
      if (power != null) effort = { watts: power, quality: "measured" };
      else if (machineSpeed != null) effort = powerFromSpeed(machineSpeed);
      else if (hr != null) effort = powerFromHr(hr, 55, maxHr, ftp);
      else if (hasSensorRef.current) {
        // A sensor is paired but has gone quiet: a strap off the chest, a
        // trainer unplugged. Coast. Falling back to the slider here would keep
        // the avatar rolling at whatever it was last set to, which is a ride
        // nobody is doing.
        effort = { watts: 0, quality: "measured" };
      }
      else effort = declaredPower(manualRef.current);

      const here = at(course, distance.current);
      speed.current = step(speed.current, effort.watts, here.gradient, bike, dt);
      distance.current = Math.max(0, distance.current + speed.current * dt);
      riders.current[0].distanceM = distance.current;
      riders.current[0].cadence = fusion.current.get("cadence") ?? undefined;

      stepPacers(pacers.current, course, dt);
      // Rebuild rather than mutate: the world diffs this list by id to add and
      // remove avatars, and a stale entry leaves a ghost on the road.
      riders.current.length = 1;
      for (const p of pacers.current) {
        riders.current.push({ id: p.spec.id, distanceM: p.distanceM, label: p.spec.name, cadence: 84 });
      }

      if (now - lastHud > 120) {
        lastHud = now;
        setDials({
          speedMs: speed.current,
          distanceM: distance.current,
          watts: effort.watts,
          quality: effort.quality,
          hr: hr ?? 0,
          cadence: fusion.current.get("cadence") ?? 0,
          gradient: here.gradient,
          elapsed: (Date.now() - started.current) / 1000,
          ...placeInBunch(distance.current, pacers.current),
          gapM: gapToNext(distance.current, pacers.current),
        });
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [course, bike, ftp, maxHr]);

  useEffect(() => () => { for (const s of sensors) s.disconnect(); }, [sensors]);

  async function connect(kind: SensorKind) {
    setConnecting(kind);
    try {
      const s = await connectSensor(kind, (r) => fusion.current.accept(r), () => say(`${SENSOR_LABEL[kind]} disconnected.`));
      setSensors((cur) => [...cur.filter((x) => x.kind !== kind), s]);
      say(`${s.name} connected.`);
    } catch (e) {
      // A person closing the chooser is not an error worth shouting about.
      const msg = e instanceof Error ? e.message : String(e);
      if (!/cancelled|User cancelled/i.test(msg)) say(msg);
    } finally {
      setConnecting(null);
    }
  }

  const kmh = dials.speedMs * 3.6;
  const credit = XP_CREDIT[dials.quality];

  // z-50 sits above .nav-float (z-40), which otherwise covers the End ride
  // button, and below the level-up card (z-60) and the post sheet (z-70) — a
  // personal best reached mid-ride should still be allowed to interrupt.
  return (
    <div className="fixed inset-0 z-50 bg-ink">
      <World course={course} riders={riders} className="absolute inset-0" />

      {/* Dials, then the standings beneath them. Side by side they collided:
          the position chip landed on top of the speed. */}
      <div className="absolute inset-x-0 top-0 p-3 pt-[calc(var(--safe-top)+10px)] grid gap-2 justify-items-center pointer-events-none">
        <div className="flex gap-2">
          <Dial label="Speed" value={kmh.toFixed(1)} unit="km/h" wide />
          <Dial label="Power" value={String(Math.round(dials.watts))} unit="W" tone={credit === 1 ? "volt" : credit > 0 ? "plain" : "dim"} />
          <Dial label="Gradient" value={`${(dials.gradient * 100).toFixed(1)}`} unit="%" />
        </div>
        <div className="flex gap-1.5">
          <span className="chip chip--volt tnum">{ordinal(dials.position)} of {dials.of}</span>
          {dials.gapM != null && <span className="chip chip--live backdrop-blur-md tnum">{Math.round(dials.gapM)} m to catch</span>}
        </div>
      </div>

      {/* bottom: state and controls, or a single button when put away */}
      {!hudOpen && (
        <div className="absolute inset-x-0 bottom-0 p-3 pb-[calc(var(--safe-bottom)+12px)] flex justify-center">
          <Press><button type="button" onClick={() => setHudOpen(true)}
            className="chip chip--live backdrop-blur-md"><ChevronUp className="w-3.5 h-3.5" strokeWidth={2.4} />Controls</button></Press>
        </div>
      )}
      {hudOpen && (
      <div className="absolute inset-x-0 bottom-0 p-3 pb-[calc(var(--safe-bottom)+12px)] grid gap-2">
        <div className="flex gap-2 justify-center flex-wrap">
          <span className="chip chip--live backdrop-blur-md tnum">{fmtDist(dials.distanceM, profile.units)}</span>
          <span className="chip chip--live backdrop-blur-md tnum">{fmtDuration(dials.elapsed)}</span>
          {dials.hr > 0 && <span className="chip chip--live backdrop-blur-md tnum"><Heart className="w-3 h-3" strokeWidth={2.4} />{Math.round(dials.hr)}</span>}
          {dials.cadence > 0 && <span className="chip chip--live backdrop-blur-md tnum"><Gauge className="w-3 h-3" strokeWidth={2.4} />{Math.round(dials.cadence)}</span>}
          {course.loop && <span className="chip chip--live backdrop-blur-md tnum"><Mountain className="w-3 h-3" strokeWidth={2.4} />lap {Math.floor(dials.distanceM / course.lengthM) + 1}</span>}
        </div>

        <div className="card relative p-3 grid gap-3 backdrop-blur-xl !bg-[rgba(255,255,255,.92)] max-w-[520px] mx-auto w-full">
          {/* Collapse, because the panel covers a third of the screen and the
              one thing it hides is your own rider. Riding is the point; the
              controls are what you touch twice. */}
          <button type="button" onClick={() => setHudOpen(false)} aria-label="Hide the controls"
            className="absolute -top-3 right-3 w-9 h-9 grid place-items-center rounded-full bg-carbon border border-line-strong shadow-sm">
            <ChevronDown className="w-4 h-4" strokeWidth={2.2} />
          </button>
          <Provenance quality={dials.quality} />

          {/* null while the transport is still being asked — the native one has
              to load a plugin before it can answer. */}
          {!sensors.length && availability && (
            availability.ok ? (
              <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none]">
                {(["heart_rate", "fitness_machine", "cycling_power", "csc"] as SensorKind[]).map((k) => (
                  <button key={k} type="button" onClick={() => connect(k)} disabled={connecting !== null}
                    className={`shrink-0 h-9 px-3 rounded-full border text-xs transition-colors flex items-center gap-1.5 ${connecting === k ? "border-volt text-volt-deep" : "border-line-strong text-ink hover:border-ink"} ${connecting !== null && connecting !== k ? "opacity-40" : ""}`}>
                    <Bluetooth className="w-3.5 h-3.5" strokeWidth={2} />{connecting === k ? `Looking for ${SENSOR_LABEL[k].toLowerCase()}…` : SENSOR_LABEL[k]}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-smoke flex gap-2"><BluetoothOff className="w-4 h-4 shrink-0" strokeWidth={2} />{availability.reason}</p>
            )
          )}

          {!sensors.length && (
            <label className="grid gap-1">
              <span className="meta">Effort · {manualW} W</span>
              <input type="range" min={0} max={400} step={10} value={manualW}
                onChange={(e) => setManualW(+e.target.value)}
                style={{ ["--fill" as string]: `${(manualW / 400) * 100}%` }} />
            </label>
          )}

          <div className="flex gap-2">
            <Press className="flex-1"><button type="button" className="pill pill--block" onClick={onStop}>End ride</button></Press>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}

/** 1st, 2nd, 3rd, 4th — the suffix English refuses to make regular. */
function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

/** Says where the number came from, every second of the ride. The alternative
 *  is a screen that looks identical whether it is reading a power meter or a
 *  slider, which is how estimates quietly become facts. */
function Provenance({ quality }: { quality: Effort["quality"] }) {
  const text = quality === "measured"
    ? "Measured power — full credit."
    : quality === "estimated"
      ? "Estimated from your sensor — 60% credit. Heart rate lags effort by up to a minute."
      : "Effort you set yourself. The world moves; nothing counts toward XP.";
  return <p className={`text-[11px] leading-tight ${quality === "measured" ? "text-volt-deep" : "text-smoke"}`}>{text}</p>;
}

function Dial({ label, value, unit, wide, tone = "plain" }: { label: string; value: string; unit: string; wide?: boolean; tone?: "volt" | "plain" | "dim" }) {
  return (
    <div className={`card px-3 py-2 grid text-center backdrop-blur-md !bg-[rgba(255,255,255,.88)] ${wide ? "min-w-[108px]" : "min-w-[84px]"}`}>
      <span className="meta">{label}</span>
      <strong className={`display tnum leading-none ${wide ? "text-3xl" : "text-2xl"} ${tone === "volt" ? "text-volt-deep" : tone === "dim" ? "text-smoke" : ""}`}>{value}</strong>
      <span className="meta">{unit}</span>
    </div>
  );
}
