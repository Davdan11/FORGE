"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Bluetooth, BluetoothOff, Gauge, Heart, Mountain, ChevronDown, ChevronUp, Users, Check } from "lucide-react";
import { at, type Course } from "@/lib/indoor/course";
import { step, ROAD_BIKE, powerFromHr, powerFromSpeed, declaredPower, maxHrFor, XP_CREDIT, type Effort, type EffortQuality } from "@/lib/indoor/physics";
import { sensorAvailability, connectSensor, SensorFusion, sensorName, type Availability, type Sensor, type SensorKind } from "@/lib/indoor/sensors";
import { cmdRequestControl, cmdStart, cmdStop, cmdSimulation, cmdTargetPower, cmdTargetIncline, cmdTargetSpeed, shouldSendGrade, resultText } from "@/lib/indoor/ftms";
import { flatten, positionAt, targetFor, zoneOfPct, zoneName, ZONE_HEX, type StructuredWorkout } from "@/lib/indoor/workouts";
import { startPacers, stepPacers, startRunPacers, stepRunPacers, placeInBunch, gapToNext } from "@/lib/indoor/pacers";
import { joinRoom, extrapolate, prune, type Room } from "@/lib/indoor/live";
import { fmtDist, fmtDuration } from "@/lib/units";
import { Press } from "@/components/motion";
import { RadioCards } from "@/components/ui";
import type { Rider } from "./World";
import { WorkoutChart } from "./WorkoutChart";
import { pace } from "./WorkoutBuilder";
import type { Profile } from "@/lib/types";
import { tr, useLang, useT } from "@/lib/i18n";

// Three.js is ~600 KB and cannot run on the server.
const World = dynamic(() => import("./World").then((m) => m.World), {
  ssr: false,
  loading: () => <div className="w-full h-full skeleton !rounded-none" />,
});

export type Sport = "ride" | "run";

/** Everything the save sheet needs, measured over the whole session. */
export interface RideResult {
  sport: Sport;
  course: Course;
  startedAt: string;
  endedAt: string;
  distanceM: number;
  durationSec: number;
  movingSec: number;
  elevGainM: number;
  splits: { km: number; sec: number }[];
  avgW?: number;
  /** Time-weighted XP credit over the moving time: 1 measured, 0.6 estimated, 0 declared. */
  credit: number;
  quality: EffortQuality;
  hr: [number, number][];
  workout?: string;
  /** Whether the workout was ridden to its last block. */
  workoutDone: boolean;
  /** Most real people seen on the course at once. */
  withPeople: number;
}

const SENSORS: Record<Sport, SensorKind[]> = {
  ride: ["fitness_machine", "heart_rate", "cycling_power", "csc"],
  run: ["treadmill", "footpod", "heart_rate"],
};

type ControlState = { state: "none" } | { state: "asking" } | { state: "ok" } | { state: "refused"; why: string };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function Ride({ course, profile, sport, workout, thresholds, onEnd, say }: {
  course: Course;
  profile: Profile;
  sport: Sport;
  workout: StructuredWorkout | null;
  thresholds: { ftpW: number; thresholdKmh: number };
  onEnd: (r: RideResult | null) => void;
  say: (m: string) => void;
}) {
  const bike = useMemo(() => ROAD_BIKE(profile.weightKg), [profile.weightKg]);
  const maxHr = useMemo(() => maxHrFor(profile.age), [profile.age]);
  const steps = useMemo(() => (workout ? flatten(workout) : []), [workout]);
  const t = useT();
  const fr = useLang() === "fr";

  const fusion = useRef(new SensorFusion());
  // The parent's toast function is a new function every render; the loop must
  // not restart (and reset its clock) because of it.
  const sayRef = useRef(say);
  useEffect(() => { sayRef.current = say; }, [say]);
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [connecting, setConnecting] = useState<SensorKind | null>(null);
  // Zero: nobody pedalling means nobody moving.
  const [manual, setManual] = useState(0);
  const [hudOpen, setHudOpen] = useState(true);

  /* ── trainer / treadmill control ── */
  const controller = useRef<Sensor | null>(null);
  const [control, setControl] = useState<ControlState>({ state: "none" });
  const controlOk = useRef(false);
  // With a workout the trainer holds the watts (ERG); riding a course it
  // follows the road (slope). Either can be switched mid-ride.
  const [trainerMode, setTrainerMode] = useState<"slope" | "erg">(workout && sport === "ride" ? "erg" : "slope");
  const [ergW, setErgW] = useState(Math.round(thresholds.ftpW * 0.65));
  // A treadmill that changes its own incline or speed under someone's feet is
  // a surprise nobody wants: both are off until asked for.
  const [followHills, setFollowHills] = useState(false);
  const [beltFollows, setBeltFollows] = useState(false);

  // Physics and accounting live in refs: sixty updates a second are not React's business.
  const speed = useRef(0);
  const distance = useRef(0);
  const started = useRef(0);
  const startedIso = useRef("");
  const acc = useRef({ moving: 0, creditSec: 0, wattSec: 0, climb: 0, lastAlt: 0, lastSplitT: 0, splits: [] as { km: number; sec: number }[], hr: [] as [number, number][], nextHrAt: 0, maxPeople: 0 });
  const riders = useRef<Rider[]>([{ id: "me", distanceM: 0, me: true }]);
  const bikePacers = useRef(startPacers());
  const runPacers = useRef(startRunPacers());
  const room = useRef<Room | null>(null);
  const [people, setPeople] = useState(0);

  // Read by the loop through refs, so the loop is never rebuilt mid-ride.
  const live = useRef({ manual, hasSensor: false, trainerMode, ergW, followHills, beltFollows });
  useEffect(() => { live.current = { manual, hasSensor: sensors.length > 0, trainerMode, ergW, followHills, beltFollows }; }, [manual, sensors, trainerMode, ergW, followHills, beltFollows]);

  const [dials, setDials] = useState({
    speedMs: 0, distanceM: 0, watts: 0, quality: "declared" as EffortQuality, hr: 0, cadence: 0, gradient: 0, elapsed: 0,
    position: 1, of: 1, gapM: null as number | null,
    wo: null as null | { label: string; pct: number; target: number; leftSec: number; next: string | null; done: boolean },
  });

  const [availability, setAvailability] = useState<Availability | null>(null);
  useEffect(() => {
    let alive = true;
    sensorAvailability().then((a) => { if (alive) setAvailability(a); });
    return () => { alive = false; };
  }, []);

  /* ── the room: real people on this course right now ── */
  useEffect(() => {
    let left = false;
    joinRoom(course.id, sport, profile.name, () => {
      const n = room.current?.peers.size ?? 0;
      setPeople(n);
      acc.current.maxPeople = Math.max(acc.current.maxPeople, n);
    }).then((r) => { if (left) r?.leave(); else room.current = r; });
    const beat = setInterval(() => room.current?.send(distance.current, speed.current), 1000);
    return () => { left = true; clearInterval(beat); room.current?.leave(); room.current = null; };
  }, [course.id, sport, profile.name]);

  /* ── the loop ── */
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let lastHud = 0;
    started.current = Date.now();
    startedIso.current = new Date().toISOString();
    acc.current.lastAlt = at(course, 0).alt;
    // What was last sent to the machine, and when.
    const sent = { grade: null as number | null, gradeAt: 0, erg: -1, ergAt: 0, belt: -1, beltAt: 0, mode: "" };
    let busy = false;

    const send = (bytes: Uint8Array) => {
      const c = controller.current;
      if (!c?.control) return;
      busy = true;
      c.control(bytes)
        .then((r) => { if (!r.ok && r.result) sayRef.current(tr(`Trainer : ${resultText(r.result) ?? "commande refusée"}.`, `Trainer: ${resultText(r.result) ?? "command refused"}.`)); })
        .finally(() => { busy = false; });
    };

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.max(0, Math.min((now - last) / 1000, 0.1));
      last = now;
      const nowMs = Date.now();
      const t = (nowMs - started.current) / 1000;
      const L = live.current;

      const here = at(course, distance.current);
      const wo = steps.length ? positionAt(steps, t) : null;
      const woTarget = wo && !wo.done ? targetFor(sport, wo.pct, thresholds) : null;
      const hr = fusion.current.get("hr");

      let effort: Effort;
      if (sport === "ride") {
        const power = fusion.current.get("power");
        const machineSpeed = fusion.current.get("speedMs");
        if (power != null) effort = { watts: power, quality: "measured" };
        else if (machineSpeed != null) effort = powerFromSpeed(machineSpeed);
        else if (hr != null) effort = powerFromHr(hr, 55, maxHr, thresholds.ftpW);
        // Paired but silent: coast rather than ride on a stale number.
        else if (L.hasSensor) effort = { watts: 0, quality: "measured" };
        else effort = declaredPower(L.manual);
        speed.current = step(speed.current, effort.watts, here.gradient, bike, dt);
      } else {
        // A runner's speed is measured directly: the belt or the footpod says it.
        const ms = fusion.current.get("speedMs");
        let v: number, q: EffortQuality;
        if (ms != null) { v = ms; q = "measured"; }
        else if (hr != null) { v = (thresholds.thresholdKmh / 3.6) * (powerFromHr(hr, 55, maxHr, 100).watts / 100); q = "estimated"; }
        else if (L.hasSensor) { v = 0; q = "measured"; }
        else { v = clamp(L.manual, 0, 22) / 3.6; q = "declared"; }
        // Ease toward it: a stride does not change speed in one frame.
        speed.current += (v - speed.current) * Math.min(1, dt * 3);
        effort = { watts: 0, quality: q };
      }
      distance.current = Math.max(0, distance.current + speed.current * dt);

      // ── accounting for the save sheet
      const a = acc.current;
      if (speed.current > 0.5) {
        a.moving += dt;
        a.creditSec += XP_CREDIT[effort.quality] * dt;
        a.wattSec += effort.watts * dt;
      }
      const alt = at(course, distance.current).alt;
      if (alt > a.lastAlt) a.climb += alt - a.lastAlt;
      a.lastAlt = alt;
      while (distance.current >= (a.splits.length + 1) * 1000) {
        a.splits.push({ km: a.splits.length + 1, sec: Math.round(t - a.lastSplitT) });
        a.lastSplitT = t;
      }
      if (hr != null && t >= a.nextHrAt) { a.hr.push([Math.round(t), Math.round(hr)]); a.nextHrAt = t + 5; }

      // ── tell the machine, one command at a time
      if (controlOk.current && !busy) {
        const gradePct = here.gradient * 100;
        if (sport === "ride") {
          if (sent.mode !== L.trainerMode) { sent.mode = L.trainerMode; sent.grade = null; sent.erg = -1; }
          if (L.trainerMode === "erg") {
            const target = Math.round(woTarget ?? L.ergW);
            if (Math.abs(target - sent.erg) >= 5 || nowMs - sent.ergAt > 10000) { sent.erg = target; sent.ergAt = nowMs; send(cmdTargetPower(target)); }
          } else if (shouldSendGrade(sent.grade, gradePct, sent.gradeAt, nowMs)) {
            sent.grade = gradePct; sent.gradeAt = nowMs; send(cmdSimulation(gradePct));
          }
        } else {
          const incline = clamp(gradePct, 0, 15);
          if (L.followHills && shouldSendGrade(sent.grade, incline, sent.gradeAt, nowMs)) {
            sent.grade = incline; sent.gradeAt = nowMs; send(cmdTargetIncline(incline));
          } else if (L.beltFollows && woTarget != null && (Math.abs(woTarget - sent.belt) > 0.05 || nowMs - sent.beltAt > 10000) && nowMs - sent.beltAt > 1500) {
            sent.belt = woTarget; sent.beltAt = nowMs; send(cmdTargetSpeed(woTarget));
          }
        }
      }

      // ── everyone on the road: me, the bots, and the people in the room
      riders.current[0].distanceM = distance.current;
      riders.current[0].cadence = fusion.current.get("cadence") ?? undefined;
      riders.current.length = 1;
      const others: { distanceM: number }[] = [];
      if (sport === "ride") {
        stepPacers(bikePacers.current, course, dt);
        for (const p of bikePacers.current) { riders.current.push({ id: p.spec.id, distanceM: p.distanceM, label: `${p.spec.name} · ${tr("robot", "bot")}`, cadence: 84, kind: "bot" }); others.push(p); }
      } else {
        stepRunPacers(runPacers.current, course, dt);
        for (const p of runPacers.current) { riders.current.push({ id: p.spec.id, distanceM: p.distanceM, label: `${p.spec.name} · ${tr("robot", "bot")}`, kind: "bot" }); others.push(p); }
      }
      const r = room.current;
      if (r) {
        prune(r.peers, nowMs);
        for (const p of r.peers.values()) {
          const d = extrapolate(p, nowMs);
          riders.current.push({ id: `p-${p.id}`, distanceM: d, label: p.name, kind: "person" });
          others.push({ distanceM: d });
        }
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
          elapsed: t,
          ...placeInBunch(distance.current, others),
          gapM: gapToNext(distance.current, others),
          wo: wo ? { label: wo.step?.label ?? tr("Terminé", "Done"), pct: wo.pct, target: woTarget ?? 0, leftSec: wo.leftSec, next: wo.next?.label ?? null, done: wo.done } : null,
        });
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [course, bike, maxHr, sport, steps, thresholds]);

  useEffect(() => () => { for (const s of sensors) s.disconnect(); }, [sensors]);

  // Say so once when the workout's last block ends.
  const doneSaid = useRef(false);
  useEffect(() => {
    if (dials.wo?.done && !doneSaid.current) { doneSaid.current = true; say(tr("Entraînement terminé. Continue à rouler, ou termine la séance.", "Workout complete. Ride on, or end the session.")); }
  }, [dials.wo?.done, say]);

  async function connect(kind: SensorKind) {
    setConnecting(kind);
    try {
      const s = await connectSensor(kind, (r) => fusion.current.accept(r), () => say(tr(`${sensorName(kind)} : déconnecté.`, `${sensorName(kind)} disconnected.`)));
      setSensors((cur) => [...cur.filter((x) => x.kind !== kind), s]);
      say(tr(`${s.name} : connecté.`, `${s.name} connected.`));
      if (s.control) await takeControl(s);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!/cancelled|User cancelled/i.test(msg)) say(msg);
    } finally {
      setConnecting(null);
    }
  }

  /** Ask the machine for control. Refused is not fatal: it still reports, the
   *  ride just runs read-only — usually another app is holding it. */
  async function takeControl(s: Sensor) {
    controller.current = s;
    setControl({ state: "asking" });
    const r = await s.control!(cmdRequestControl());
    if (!r.ok) {
      setControl({ state: "refused", why: r.result ? resultText(r.result) ?? tr("refusé", "refused") : tr("pas de réponse", "no answer") });
      return;
    }
    await s.control!(cmdStart());
    controlOk.current = true;
    setControl({ state: "ok" });
  }

  function end() {
    if (controlOk.current) controller.current?.control?.(cmdStop()).catch(() => {});
    controlOk.current = false;
    const a = acc.current;
    const durationSec = Math.round((Date.now() - started.current) / 1000);
    if (distance.current < 50 || a.moving < 30) { onEnd(null); return; }
    const credit = a.moving > 0 ? a.creditSec / a.moving : 0;
    onEnd({
      sport, course,
      startedAt: startedIso.current,
      endedAt: new Date().toISOString(),
      distanceM: Math.round(distance.current),
      durationSec,
      movingSec: Math.round(a.moving),
      elevGainM: Math.round(a.climb),
      splits: a.splits,
      avgW: sport === "ride" && a.moving > 0 ? Math.round(a.wattSec / a.moving) : undefined,
      credit: Math.round(credit * 100) / 100,
      quality: credit >= 0.95 ? "measured" : credit > 0 ? "estimated" : "declared",
      hr: a.hr,
      workout: workout?.name,
      workoutDone: steps.length > 0 && positionAt(steps, durationSec).done,
      withPeople: a.maxPeople,
    });
  }

  const kmh = dials.speedMs * 3.6;
  const credit = XP_CREDIT[dials.quality];
  const connectedKinds = new Set(sensors.map((s) => s.kind));

  return (
    <div className="fixed inset-0 z-50 bg-ink">
      <World course={course} riders={riders} mode={sport} className="absolute inset-0" />

      <div className="absolute inset-x-0 top-0 p-3 pt-[calc(var(--safe-top)+10px)] grid gap-2 justify-items-center pointer-events-none">
        <div className="flex gap-2">
          {sport === "ride" ? (
            <>
              <Dial label={t("Vitesse", "Speed")} value={kmh.toFixed(1)} unit="km/h" wide />
              <Dial label={t("Puissance", "Power")} value={String(Math.round(dials.watts))} unit="W" tone={credit === 1 ? "volt" : credit > 0 ? "plain" : "dim"} />
            </>
          ) : (
            <>
              <Dial label={t("Allure", "Pace")} value={pace(dials.speedMs)} unit="/km" wide tone={credit === 1 ? "volt" : credit > 0 ? "plain" : "dim"} />
              <Dial label={t("Vitesse", "Speed")} value={kmh.toFixed(1)} unit="km/h" />
            </>
          )}
          <Dial label={t("Pente", "Gradient")} value={`${(dials.gradient * 100).toFixed(1)}`} unit="%" />
        </div>

        {dials.wo && !dials.wo.done && workout && (
          <div className="card px-3 py-2 w-[min(92vw,420px)] backdrop-blur-md !bg-[rgba(255,255,255,.9)] grid gap-1.5">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: ZONE_HEX[zoneOfPct(dials.wo.pct)] }} />
              <strong className="text-sm flex-1 truncate">{dials.wo.label}</strong>
              <strong className="display tnum text-xl">{sport === "ride" ? `${Math.round(dials.wo.target)} W` : `${pace(dials.wo.target)}/km`}</strong>
              <span className="chip tnum">{fmtDuration(Math.ceil(dials.wo.leftSec))}</span>
            </div>
            <WorkoutChart workout={workout} atSec={dials.elapsed} className="h-8 w-full text-ink" />
            <p className="text-[11px] text-smoke">{Math.round(dials.wo.pct)} % · {zoneName(zoneOfPct(dials.wo.pct))}{dials.wo.next ? t(` · ensuite : ${dials.wo.next}`, ` · next: ${dials.wo.next}`) : t(" · dernier bloc", " · last block")}</p>
          </div>
        )}

        <div className="flex gap-1.5">
          <span className="chip chip--volt tnum">{fr ? `${dials.position}${dials.position === 1 ? "er" : "e"} sur ${dials.of}` : `${ordinal(dials.position)} of ${dials.of}`}</span>
          {dials.gapM != null && <span className="chip chip--live backdrop-blur-md tnum">{t(`${Math.round(dials.gapM)} m à reprendre`, `${Math.round(dials.gapM)} m to catch`)}</span>}
          {people > 0 && <span className="chip chip--live backdrop-blur-md tnum"><Users className="w-3 h-3" strokeWidth={2.4} />{t(`${people} en direct`, `${people} live`)}</span>}
        </div>
      </div>

      {!hudOpen && (
        <div className="absolute inset-x-0 bottom-0 p-3 pb-[calc(var(--safe-bottom)+12px)] flex justify-center">
          <Press><button type="button" onClick={() => setHudOpen(true)} className="chip chip--live backdrop-blur-md"><ChevronUp className="w-3.5 h-3.5" strokeWidth={2.4} />{t("Commandes", "Controls")}</button></Press>
        </div>
      )}
      {hudOpen && (
        <div className="absolute inset-x-0 bottom-0 p-3 pb-[calc(var(--safe-bottom)+12px)] grid gap-2">
          <div className="flex gap-2 justify-center flex-wrap">
            <span className="chip chip--live backdrop-blur-md tnum">{fmtDist(dials.distanceM, profile.units)}</span>
            <span className="chip chip--live backdrop-blur-md tnum">{fmtDuration(dials.elapsed)}</span>
            {dials.hr > 0 && <span className="chip chip--live backdrop-blur-md tnum"><Heart className="w-3 h-3" strokeWidth={2.4} />{Math.round(dials.hr)}</span>}
            {dials.cadence > 0 && <span className="chip chip--live backdrop-blur-md tnum"><Gauge className="w-3 h-3" strokeWidth={2.4} />{Math.round(dials.cadence)}</span>}
            {course.loop && <span className="chip chip--live backdrop-blur-md tnum"><Mountain className="w-3 h-3" strokeWidth={2.4} />{t("tour", "lap")} {Math.floor(dials.distanceM / course.lengthM) + 1}</span>}
          </div>

          <div className="card relative p-3 grid gap-3 backdrop-blur-xl !bg-[rgba(255,255,255,.92)] max-w-[520px] mx-auto w-full max-h-[48vh] overflow-y-auto">
            <button type="button" onClick={() => setHudOpen(false)} aria-label={t("Masquer les commandes", "Hide the controls")}
              className="absolute top-2 right-2 w-9 h-9 grid place-items-center rounded-full bg-carbon border border-line-strong shadow-sm">
              <ChevronDown className="w-4 h-4" strokeWidth={2.2} />
            </button>
            <Provenance quality={dials.quality} sport={sport} />

            {availability && (availability.ok ? (
              <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none] pr-10">
                {SENSORS[sport].map((k) => {
                  const on = connectedKinds.has(k);
                  return (
                    <button key={k} type="button" onClick={() => !on && connect(k)} disabled={connecting !== null || on}
                      className={`shrink-0 h-9 px-3 rounded-full border text-xs transition-colors flex items-center gap-1.5 ${on ? "border-volt text-volt-deep" : connecting === k ? "border-volt text-volt-deep" : "border-line-strong text-ink hover:border-ink"} ${connecting !== null && connecting !== k ? "opacity-40" : ""}`}>
                      {on ? <Check className="w-3.5 h-3.5" strokeWidth={2.4} /> : <Bluetooth className="w-3.5 h-3.5" strokeWidth={2} />}
                      {connecting === k ? t(`Recherche : ${sensorName(k).toLowerCase()}…`, `Looking for ${sensorName(k).toLowerCase()}…`) : on ? sensors.find((s) => s.kind === k)?.name ?? sensorName(k) : sensorName(k)}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-smoke flex gap-2"><BluetoothOff className="w-4 h-4 shrink-0" strokeWidth={2} />{availability.reason}</p>
            ))}

            {control.state !== "none" && (
              <div className="grid gap-2">
                {control.state === "asking" && <p className="text-xs text-smoke">{t("On demande le contrôle à l’appareil…", "Asking the machine for control…")}</p>}
                {control.state === "refused" && <p className="text-xs text-smoke">{t(`Lecture seule : l’appareil a refusé le contrôle (${control.why}). Ferme les autres applis qui l’utilisent, puis reconnecte-toi.`, `Read-only: the machine refused control (${control.why}). Close any other app using it, then reconnect.`)}</p>}
                {control.state === "ok" && sport === "ride" && (
                  <>
                    <div className="flex items-center gap-3">
                      <RadioCards label={t("Mode du trainer", "Trainer mode")} value={trainerMode} onChange={setTrainerMode} options={[{ v: "slope", label: t("Pente", "Slope") }, { v: "erg", label: "ERG" }]} />
                      <span className="text-[11px] text-smoke leading-tight">{trainerMode === "slope" ? t("La résistance suit la route.", "Resistance follows the road.") : workout ? t("Tient les watts de l’entraînement.", "Holding the workout's watts.") : t("Tient une puissance fixe.", "Holding a fixed power.")}</span>
                    </div>
                    {trainerMode === "erg" && !workout && (
                      <label className="grid gap-1">
                        <span className="meta">{t("Cible", "Target")} · {ergW} W</span>
                        <input type="range" min={50} max={500} step={5} value={ergW} onChange={(e) => setErgW(+e.target.value)} style={{ ["--fill" as string]: `${((ergW - 50) / 450) * 100}%` }} />
                      </label>
                    )}
                  </>
                )}
                {control.state === "ok" && sport === "run" && (
                  <div className="grid gap-1.5">
                    <Toggle on={followHills} onChange={setFollowHills} label={t("Suivre les côtes", "Follow the hills")} hint={t("Le tapis règle son inclinaison sur la route, 0–15 %.", "The treadmill sets its incline to the road, 0–15 %.")} />
                    {workout && <Toggle on={beltFollows} onChange={setBeltFollows} label={t("L’entraînement règle la vitesse du tapis", "Workout sets the belt speed")} hint={t("La vitesse change toute seule à chaque bloc. Garde la clé de sécurité.", "Speed changes on its own at each block. Keep the safety key on.")} />}
                  </div>
                )}
              </div>
            )}

            {!sensors.length && (
              sport === "ride" ? (
                <label className="grid gap-1">
                  <span className="meta">{t("Effort", "Effort")} · {manual} W</span>
                  <input type="range" min={0} max={400} step={10} value={manual} onChange={(e) => setManual(+e.target.value)} style={{ ["--fill" as string]: `${(manual / 400) * 100}%` }} />
                </label>
              ) : (
                <label className="grid gap-1">
                  <span className="meta">{t("Vitesse", "Speed")} · {manual.toFixed(1)} km/h{manual > 0 ? ` · ${pace(manual / 3.6)} /km` : ""}</span>
                  <input type="range" min={0} max={20} step={0.5} value={manual} onChange={(e) => setManual(+e.target.value)} style={{ ["--fill" as string]: `${(manual / 20) * 100}%` }} />
                </label>
              )
            )}

            <Press><button type="button" className="pill pill--block" onClick={end}>{sport === "ride" ? t("Terminer la sortie", "End ride") : t("Terminer la course", "End run")}</button></Press>
          </div>
        </div>
      )}
    </div>
  );
}

function Toggle({ on, onChange, label, hint }: { on: boolean; onChange: (v: boolean) => void; label: string; hint: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} className="flex items-center gap-3 text-left">
      <span className={`w-10 h-6 rounded-full relative shrink-0 transition-colors ${on ? "bg-volt" : "bg-line-strong"}`}>
        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${on ? "left-[18px]" : "left-0.5"}`} />
      </span>
      <span className="grid"><span className="text-sm font-medium">{label}</span><span className="text-[11px] text-smoke leading-tight">{hint}</span></span>
    </button>
  );
}

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

/** Where the number came from, every second: the alternative is estimates
 *  quietly becoming facts. */
function Provenance({ quality, sport }: { quality: EffortQuality; sport: Sport }) {
  const t = useT();
  const text = quality === "measured"
    ? sport === "ride" ? t("Puissance mesurée — crédit complet.", "Measured power — full credit.") : t("Vitesse mesurée — crédit complet.", "Measured speed — full credit.")
    : quality === "estimated"
      ? t("Estimé selon le cœur — 60 % du crédit. Le cœur suit l’effort avec jusqu’à une minute de retard.", "Estimated from heart rate — 60% credit. Heart rate lags effort by up to a minute.")
      : t("Effort réglé à la main. Le monde avance, mais rien ne compte pour l’XP.", "Effort you set yourself. The world moves; nothing counts toward XP.");
  return <p className={`text-[11px] leading-tight pr-10 ${quality === "measured" ? "text-volt-deep" : "text-smoke"}`}>{text}</p>;
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
