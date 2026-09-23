"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Bluetooth, BluetoothOff, Check, Users, X, SlidersHorizontal } from "lucide-react";
import { powerFromHr, declaredPower, maxHrFor, XP_CREDIT, type Effort } from "@/lib/indoor/physics";
import { sensorAvailability, connectSensor, SensorFusion, SENSOR_LABEL, type Availability, type Sensor, type SensorKind } from "@/lib/indoor/sensors";
import { shouldSendGrade, RESULT_TEXT } from "@/lib/indoor/ftms";
import { powerFromCurve, trainerLabel, PROTOCOL_LABEL, SPEED_CURVES, type ControlResult, type SpeedCurveId, type TrainerControl, type TrainerProtocol } from "@/lib/indoor/trainer";
import { joinRoom, prune, type Room } from "@/lib/indoor/live";
import { addSplits, profileMessage, rewardMessage, ridersMessage, unityRoom, type UnityMessage, type UnitySummary } from "@/lib/indoor/unity";
import { boardMessage, postSegment, segmentBoard, type Category } from "@/lib/leaderboard";
import { emptyStreams, pushSample } from "@/lib/tcx";
import { supabase } from "@/lib/supabase/client";
import { activityKcal, hrSummary } from "@/lib/heart";
import { awardChallenges, awardIndoor, awardRouteBadge } from "@/lib/progress";
import { db, getStats, uid } from "@/lib/db";
import type { Activity, Profile } from "@/lib/types";

/* The Unity Web build lives in public/unity (built from the FORGE-Unity repo,
   menu File > Build, target Web, output <this app>/public/unity). */
const BUILD = "/unity/Build/unity";

interface UnityInstance { SendMessage: (obj: string, method: string, arg: string) => void; Quit: () => Promise<void> }
declare global {
  interface Window { createUnityInstance?: (canvas: HTMLCanvasElement, config: Record<string, unknown>, progress: (p: number) => void) => Promise<UnityInstance> }
}

/* "trainer" finds any brand: FTMS, Tacx FE-C, Wahoo legacy, or a trainer that
   only reports power or speed (see lib/indoor/trainer.ts). */
const SENSORS: SensorKind[] = ["trainer", "heart_rate", "cycling_power", "csc"];

const PROTOCOL_FR: Record<TrainerProtocol, string> = {
  ftms: "FTMS",
  "tacx-fec": "FE-C",
  "wahoo-legacy": "Wahoo",
  "power-only": "puissance seule",
  "speed-only": "vitesse seule",
};

/**
 * The indoor ride drawn by the Unity game. This component is the app's half of
 * the game: it feeds the sensors in, drives the trainer from the game's grade
 * and ERG targets, puts the rider in the room with the people on the same road,
 * and saves the ride with its XP when the game says it is over.
 */
export function UnityRide({ profile, ftpW, onExit, say }: {
  profile: Profile;
  ftpW: number;
  onExit: (message?: string) => void;
  say: (m: string) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const unity = useRef<UnityInstance | null>(null);
  const [progress, setProgress] = useState(0);
  const [failed, setFailed] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  // The overlay speaks the game's language (the game follows the device, or the rider's choice in its menu).
  const [en, setEn] = useState(() => typeof navigator !== "undefined" && !navigator.language.toLowerCase().startsWith("fr"));
  const enRef = useRef(en);
  useEffect(() => { enRef.current = en; }, [en]);
  const t = (fr: string, english: string) => (en ? english : fr);
  const tr = (fr: string, english: string) => (enRef.current ? english : fr);

  const fusion = useRef(new SensorFusion());
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [connecting, setConnecting] = useState<SensorKind | null>(null);
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [panel, setPanel] = useState(false);
  const [manual, setManual] = useState(0);
  const [curve, setCurve] = useState<SpeedCurveId>("generic");
  const [people, setPeople] = useState(0);
  const maxHr = useMemo(() => maxHrFor(profile.age), [profile.age]);

  const controller = useRef<TrainerControl | null>(null);
  const controlOk = useRef(false);
  const [control, setControl] = useState<"none" | "asking" | "ok" | string>("none");

  // What the game last told us, read by the timers.
  const game = useRef({ category: "D" as Category, quality: "declared" as string, watts: 0, hr: null as number | null, cadence: null as number | null, eventRoom: null as string | null, route: "", event: null as string | null, distance: 0, speedKph: 0, elapsed: 0, grade: 0, erg: null as number | null });
  const live = useRef({ manual: 0, hasSensor: false, curve: "generic" as SpeedCurveId });
  useEffect(() => { live.current = { manual, hasSensor: sensors.length > 0, curve }; }, [manual, sensors, curve]);
  const acc = useRef(freshRide());
  const room = useRef<Room | null>(null);
  const roomKey = useRef("");
  const look = useRef<string | undefined>(profile.indoorGame?.look);
  const sayRef = useRef(say);
  useEffect(() => { sayRef.current = say; }, [say]);
  const exitRef = useRef<(() => void) | null>(null);

  const send = (msg: object) => unity.current?.SendMessage("ForgeBridge", "Receive", JSON.stringify(msg));

  useEffect(() => {
    let alive = true;
    sensorAvailability().then((a) => { if (alive) setAvailability(a); });
    return () => { alive = false; };
  }, []);

  /* ── load the game ── */
  useEffect(() => {
    let cancelled = false;
    const script = document.createElement("script");
    script.src = `${BUILD}.loader.js`;
    script.onerror = () => setFailed(tr("Le jeu n'est pas installé dans cette version de l'appli (public/unity manquant).", "The game is not installed in this build of the app (public/unity missing)."));
    script.onload = () => {
      if (cancelled || !canvas.current || !window.createUnityInstance) return;
      window.createUnityInstance(canvas.current, {
        dataUrl: `${BUILD}.data.unityweb`,
        frameworkUrl: `${BUILD}.framework.js.unityweb`,
        codeUrl: `${BUILD}.wasm.unityweb`,
        companyName: "FORGE", productName: "FORGE Ride", productVersion: "0.1.0",
        // Sharp enough, and a phone keeps its frame rate.
        devicePixelRatio: Math.min(window.devicePixelRatio || 1, 1.5),
      }, (p) => setProgress(p))
        .then((u) => {
          if (cancelled) { u.Quit(); return; }
          unity.current = u;
          // Development only: talk to the game from the console (window.forgeUnity.SendMessage(...)).
          if (process.env.NODE_ENV !== "production") (window as unknown as { forgeUnity?: UnityInstance }).forgeUnity = u;
        })
        .catch((e) => setFailed(String(e)));
    };
    document.body.appendChild(script);
    return () => {
      cancelled = true;
      unity.current?.Quit().catch(() => {});
      unity.current = null;
      script.remove();
    };
  }, []);

  /* ── the room: whoever rides the same road (or the same event) right now ── */
  async function enterRoom(key: string) {
    if (key === roomKey.current) return;
    roomKey.current = key;
    room.current?.leave(); room.current = null; setPeople(0);
    const r = await joinRoom(key, "ride", profile.name, () => {
      const n = room.current?.peers.size ?? 0;
      setPeople(n);
      acc.current.maxPeople = Math.max(acc.current.maxPeople, n);
    }, (from) => send({ type: "kudos", from }));
    if (roomKey.current !== key) { r?.leave(); return; }
    room.current = r;
    if (!r) sayRef.current(tr("Connecte-toi à ton compte pour rouler avec les autres.", "Sign in to ride with other people."));
  }
  useEffect(() => () => { room.current?.leave(); room.current = null; }, []);

  /* ── the loop: effort into the game, the room into the game, the game into the trainer ── */
  useEffect(() => {
    if (!ready) return;
    const sent = { grade: null as number | null, gradeAt: 0, erg: -1, ergAt: 0 };
    let busy = false;
    let lastBeat = 0;
    const control = (command: (c: TrainerControl) => Promise<ControlResult>) => {
      const c = controller.current;
      if (!c) return;
      busy = true;
      command(c).then((r) => { if (!r.ok && r.result) sayRef.current(`Trainer: ${RESULT_TEXT[r.result] ?? tr("commande refusée", "command refused")}.`); }).finally(() => { busy = false; });
    };
    const timer = setInterval(() => {
      const now = Date.now(), g = game.current, L = live.current, a = acc.current;
      const f = fusion.current;
      const power = f.get("power"), machineSpeed = f.get("speedMs"), hr = f.get("hr"), cadence = f.get("cadence");
      let effort: Effort;
      if (power != null) effort = { watts: power, quality: "measured" };
      else if (machineSpeed != null) effort = powerFromCurve(machineSpeed, L.curve);
      else if (hr != null) effort = powerFromHr(hr, 55, maxHr, ftpW);
      else if (L.hasSensor) effort = { watts: 0, quality: "measured" };
      else effort = declaredPower(L.manual);
      send({ type: "sample", watts: effort.watts, cadence: cadence ?? -1, heartRate: hr ?? -1, speedKph: -1, quality: effort.quality });
      g.quality = effort.quality; g.watts = effort.watts; g.hr = hr ?? null; g.cadence = cadence ?? null;

      // Credit is counted here, where the quality of every second is known.
      if (g.speedKph > 1.8) { a.moving += 0.25; a.creditSec += XP_CREDIT[effort.quality] * 0.25; }
      if (hr != null && g.elapsed >= a.nextHrAt) { a.hr.push([Math.round(g.elapsed), Math.round(hr)]); a.nextHrAt = g.elapsed + 5; }

      // The trainer: ERG while the game's workout holds a target, the road's grade otherwise.
      if (controlOk.current && !busy) {
        if (g.erg != null) {
          if (Math.abs(g.erg - sent.erg) >= 5 || now - sent.ergAt > 10000) { sent.erg = g.erg; sent.ergAt = now; const w = g.erg; control((c) => c.setTargetPower(w)); }
        } else if (shouldSendGrade(sent.grade, g.grade, sent.gradeAt, now)) {
          sent.grade = g.grade; sent.gradeAt = now; sent.erg = -1; const pct = g.grade; control((c) => c.setGrade(pct));
        }
      }

      const r = room.current;
      if (r) {
        prune(r.peers, now);
        send(ridersMessage(r.peers.values(), now));
        if (now - lastBeat >= 1000) { lastBeat = now; r.send(g.distance, g.speedKph / 3.6, { look: look.current, quality: g.quality === "measured" ? "m" : g.quality === "estimated" ? "e" : "d", category: g.category }); }
      }
    }, 250);
    return () => clearInterval(timer);
  }, [ready, maxHr, ftpW]);

  useEffect(() => () => { for (const s of sensors) s.disconnect(); }, [sensors]);

  /* ── the end: save the ride, count the XP, tell the game ── */
  async function saveRide(s: UnitySummary) {
    const a = acc.current;
    if (a.saved) return;
    a.saved = true;
    if (s.distance < 50 || a.moving < 30) { send(rewardMessage(0, (await getStats()).xp)); return; }
    const credit = a.moving > 0 ? Math.round((a.creditSec / a.moving) * 100) / 100 : 0;
    const quality = credit >= 0.95 ? "measured" : credit > 0 ? "estimated" : "declared";
    const hrs = hrSummary(a.hr);
    const movingSec = Math.round(a.moving);
    const k = activityKcal({ type: "ride", movingMin: movingSec / 60, distanceM: s.distance, profile, hr: a.hr });
    const avgW = s.avgWatts > 0 ? Math.round(s.avgWatts) : undefined;
    const kcal = avgW && quality === "measured" && k.source !== "heart_rate" ? Math.round(s.kilojoules) : k.kcal;
    const routeName = routeTitle(s.route);
    const activity: Activity = {
      id: uid(), type: "ride",
      startedAt: a.startedIso, endedAt: new Date().toISOString(),
      distanceM: Math.round(s.distance), durationSec: Math.round(s.elapsed), movingSec,
      avgPaceSecKm: s.distance > 0 ? movingSec / (s.distance / 1000) : undefined,
      elevGainM: Math.round(s.ascent), points: [], splits: a.splits,
      title: `${routeName} · indoor ride`, shared: false, xp: 0,
      meta: { discipline: "indoor", indoor: { course: routeName, quality, avgW, workout: s.workout ?? undefined, workoutDone: s.workoutDone || undefined, with: a.maxPeople || undefined } },
      hrSeries: a.hr.length ? a.hr : undefined, streams: a.streams.t.length ? a.streams : undefined, avgHr: hrs?.avg, maxHr: hrs?.max, kcal, kcalSource: k.source,
    };
    const before = (await getStats()).xp;
    const { xp } = await awardIndoor(activity, credit);
    await db.activities.put({ ...activity, xp, dirty: 1, updatedAt: new Date().toISOString() } as Activity);
    if (credit > 0) await awardChallenges("ride", profile.units.distance);
    // First time this route is finished (the rider may have carried on past the line): a one-off bonus.
    if (s.completed) await awardRouteBadge(s.route.replace(/x\d+$/, ""), routeKm(s.route), credit);
    // What the account actually gained — the session, the week's streak bonus and any challenge —
    // so the game shows exactly the XP and level the rest of the app shows.
    send(rewardMessage((await getStats()).xp - before, before));
    exitRef.current?.();
  }
  const routeNames = useRef<Record<string, string>>({});
  const routeLengths = useRef<Record<string, number>>({});
  // Catalog routes come with the game's "ready"; a generated route's key carries its km ("g2-40-1-123456").
  const routeKm = (key: string) => {
    const laps = /^(c\d+)x(\d+)$/.exec(key);
    if (laps) return (routeLengths.current[laps[1]] ?? 0) * Number(laps[2]);
    return routeLengths.current[key] ?? (Number(/^g\d+-(\d+)-/.exec(key)?.[1]) || 0);
  };
  useEffect(() => {
    const onReady = (e: Event) => {
      const m = (e as CustomEvent).detail as UnityMessage;
      if (m?.type === "ready") for (const r of m.routes) { routeNames.current[r.key] = titleCase(r.name); routeLengths.current[r.key] = r.lengthKm; }
    };
    window.addEventListener("forge-unity", onReady);
    return () => window.removeEventListener("forge-unity", onReady);
  }, []);
  const routeTitle = (key: string) => {
    const laps = /^(c\d+)x(\d+)$/.exec(key);
    if (laps && routeNames.current[laps[1]]) return `${routeNames.current[laps[1]]} · ${laps[2]} ${tr("tours", "laps")}`;
    return routeNames.current[key] ?? "FORGE Ride";
  };

  /* ── messages from the game ── */
  useEffect(() => {
    const onMessage = (e: Event) => {
      const m = (e as CustomEvent).detail as UnityMessage;
      if (!m || typeof m !== "object") return;
      const g = game.current;
      switch (m.type) {
        case "ready":
          setReady(true);
          if (m.lang === "en" || m.lang === "fr") setEn(m.lang === "en");
          g.route = m.route;
          getStats().then((s) => send({ ...profileMessage({ name: profile.name, weightKg: profile.weightKg, ftpW }, s.xp), lang: navigator.language }));
          if (profile.indoorGame?.look) send({ type: "look", look: profile.indoorGame.look });
          if (profile.indoorGame?.palmares) send({ type: "palmares", data: JSON.parse(profile.indoorGame.palmares) });
          enterRoom(unityRoom(g.route, g.event));
          break;
        case "position":
          // Another route, or the same one restarted: a new ride to count and save.
          if (m.route !== g.route || m.elapsed + 1 < g.elapsed) { g.route = m.route; acc.current = freshRide(); }
          g.distance = m.distance; g.speedKph = m.speedKph; g.elapsed = m.elapsed;
          if (m.category === "A" || m.category === "B" || m.category === "C" || m.category === "D") g.category = m.category;
          if (!m.paused) pushSample(acc.current.streams, { t: m.elapsed, d: m.distance, alt: m.altitude, w: g.watts, hr: g.hr, cad: g.cadence });
          acc.current.lastSplit = addSplits(acc.current.splits, m.distance, m.elapsed, acc.current.lastSplit);
          enterRoom(unityRoom(g.route, g.event, g.eventRoom));
          break;
        case "grade": g.grade = m.grade; break;
        case "ergTarget": g.erg = m.watts; break;
        case "event":
          g.event = m.action === "leave" ? null : m.id;
          g.eventRoom = m.action !== "leave" && m.kind === "race" ? m.category : null;
          enterRoom(unityRoom(g.route, g.event, g.eventRoom));
          break;
        case "kudos":
          room.current?.kudos(m.to.replace(/^p-/, ""));
          break;
        case "segment":
          // Measured efforts go on the world board; the game shows where they rank.
          if (g.quality === "measured") {
            const cat = g.category;
            postSegment({ segment: m.key, lengthM: m.length, seconds: m.seconds, category: cat, name: profile.name, quality: g.quality }).then(async (posted) => {
              if (!posted || !supabase) return;
              const { data: { user } } = await supabase.auth.getUser();
              const rows = await segmentBoard(m.key, cat);
              if (user && rows.length) send(boardMessage(rows, user.id, m.key, m.name, cat));
            });
          }
          break;
        // The line is not the end any more: the rider may keep riding on the open road. The ride is saved on "end"
        // (the game sends it when the rider stops, switches route or restarts), with "completed" if the line was crossed.
        case "finish": break;
        case "end": saveRide(m); break;
        case "profileUpdate":
          db.profile.update(profile.id, { weightKg: m.weightKg, ftpW: m.ftp, dirty: 1, updatedAt: new Date().toISOString() });
          break;
        case "look":
          look.current = m.look;
          db.profile.update(profile.id, { indoorGame: { ...profile.indoorGame, look: m.look }, dirty: 1, updatedAt: new Date().toISOString() });
          break;
        case "palmares":
          db.profile.update(profile.id, { indoorGame: { ...profile.indoorGame, look: look.current, palmares: JSON.stringify(m.data) }, dirty: 1, updatedAt: new Date().toISOString() });
          break;
      }
    };
    window.addEventListener("forge-unity", onMessage);
    return () => window.removeEventListener("forge-unity", onMessage);
    // The handlers read refs; the profile only matters at "ready".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.id]);

  /* ── sensors ── */
  async function connect(kind: SensorKind) {
    setConnecting(kind);
    try {
      const s = await connectSensor(kind, (r) => fusion.current.accept(r), () => say(tr(`${SENSOR_LABEL[kind]} déconnecté.`, `${SENSOR_LABEL[kind]} disconnected.`)), { riderKg: profile.weightKg });
      setSensors((cur) => [...cur.filter((x) => x.kind !== kind), s]);
      say(s.trainer ? tr(`Trainer détecté : ${sensorLabel(s, false)}`, `Trainer found: ${sensorLabel(s, true)}`) : tr(`${s.name} connecté.`, `${s.name} connected.`));
      const commands = s.trainer?.commands;
      if (commands) {
        // FTMS: request control then start, exactly as before. Wahoo: unlock
        // and simulation init. FE-C: rider weight.
        controller.current = commands; setControl("asking");
        const r = await commands.start();
        if (!r.ok) { setControl(r.result ? RESULT_TEXT[r.result] ?? tr("refusé", "refused") : tr("pas de réponse", "no answer")); return; }
        controlOk.current = true; setControl("ok");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!/cancelled|User cancelled/i.test(msg)) say(msg);
    } finally { setConnecting(null); }
  }

  /** Leave: a ride in progress is ended (and saved) by the game first. */
  function quit() {
    const done = () => {
      exitRef.current = null;
      if (controlOk.current) controller.current?.stop().catch(() => {});
      controlOk.current = false;
      onExit(acc.current.saved ? tr("Sortie enregistrée.", "Ride saved.") : undefined);
    };
    if (!unity.current || acc.current.saved || game.current.elapsed < 1) { done(); return; }
    exitRef.current = done;
    send({ type: "command", action: "end" });
    setTimeout(() => { if (exitRef.current) done(); }, 2500); // never trap the rider in the game
  }

  const connected = new Set(sensors.map((s) => s.kind));
  const trainer = sensors.find((s) => s.trainer)?.trainer;
  // A curve only matters when watts come from wheel speed.
  const speedOnly = !sensors.some((s) => s.kind === "cycling_power" || (s.trainer && s.trainer.protocol !== "speed-only"))
    && (connected.has("csc") || trainer?.protocol === "speed-only");

  return (
    <div className="fixed inset-0 z-50 bg-black">
      <canvas ref={canvas} id="unity-canvas" className="absolute inset-0 w-full h-full" tabIndex={-1} />

      {!ready && !failed && (
        <div className="absolute inset-0 grid place-items-center text-bone">
          <div className="grid gap-3 w-[min(80vw,360px)] text-center">
            <p className="display text-2xl">FORGE Ride</p>
            <div className="h-2 rounded-full bg-white/15 overflow-hidden"><div className="h-full bg-volt transition-all" style={{ width: `${Math.round(progress * 100)}%` }} /></div>
            <p className="text-xs text-bone/70 tnum">{t("Chargement du monde…", "Loading the world…")} {Math.round(progress * 100)} %</p>
          </div>
        </div>
      )}
      {failed && (
        <div className="absolute inset-0 grid place-items-center p-6 text-bone text-center">
          <div className="grid gap-4 max-w-[420px]">
            <p className="text-sm">{failed}</p>
            <button type="button" className="pill pill--volt" onClick={() => onExit()}>{t("Retour", "Back")}</button>
          </div>
        </div>
      )}

      {/* The app's own controls: small, at the bottom centre where the game's HUD leaves room. */}
      <div className="absolute inset-x-0 bottom-0 pb-[calc(var(--safe-bottom)+8px)] flex flex-col items-center gap-2 pointer-events-none">
        {panel && (
          <div className="card p-3 grid gap-3 w-[min(94vw,520px)] backdrop-blur-xl !bg-[rgba(255,255,255,.94)] pointer-events-auto">
            {availability && (availability.ok ? (
              <div className="flex gap-1.5 flex-wrap">
                {SENSORS.map((k) => {
                  const on = connected.has(k);
                  return (
                    <button key={k} type="button" onClick={() => !on && connect(k)} disabled={connecting !== null || on}
                      className={`h-9 px-3 rounded-full border text-xs flex items-center gap-1.5 ${on || connecting === k ? "border-volt text-volt-deep" : "border-line-strong text-ink"} ${connecting !== null && connecting !== k ? "opacity-40" : ""}`}>
                      {on ? <Check className="w-3.5 h-3.5" strokeWidth={2.4} /> : <Bluetooth className="w-3.5 h-3.5" strokeWidth={2} />}
                      {on ? sensorLabel(sensors.find((s) => s.kind === k), en) ?? SENSOR_LABEL[k] : SENSOR_LABEL[k]}
                    </button>
                  );
                })}
              </div>
            ) : <p className="text-xs text-smoke flex gap-2"><BluetoothOff className="w-4 h-4 shrink-0" strokeWidth={2} />{availability.reason}</p>)}
            {trainer && <p className="text-xs text-ink">{t("Trainer détecté : ", "Trainer found: ")}{trainerLabel(trainer.deviceName, trainer.protocol, en ? PROTOCOL_LABEL : PROTOCOL_FR)}{trainer.canControl ? "" : t(" · lecture seule, pas de contrôle de la résistance", " · read-only, no resistance control")}</p>}
            {speedOnly && (
              <label className="flex items-center gap-2 text-xs">
                <span className="meta">{t("Courbe vitesse → puissance (estimée)", "Speed → power curve (estimated)")}</span>
                <select value={curve} onChange={(e) => setCurve(e.target.value as SpeedCurveId)} className="h-8 rounded-lg border border-line-strong px-2 bg-transparent">
                  {SPEED_CURVES.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
            )}
            {control === "asking" && <p className="text-xs text-smoke">{t("Le trainer demande l’accès…", "Asking the trainer for control…")}</p>}
            {control === "ok" && <p className="text-xs text-volt-deep">{t("Trainer contrôlé : la résistance suit la route (ou ta séance).", "Trainer in control: resistance follows the road (or your workout).")}</p>}
            {control !== "none" && control !== "asking" && control !== "ok" && <p className="text-xs text-smoke">{t(`Lecture seule : le trainer a refusé le contrôle (${control}). Ferme les autres applis qui l’utilisent.`, `Read-only: the trainer refused control (${control}). Close any other app using it.`)}</p>}
            {!sensors.length && (
              <label className="grid gap-1">
                <span className="meta">{t(`Effort sans capteur · ${manual} W · ne compte pas pour l’XP`, `Effort without a sensor · ${manual} W · earns no XP`)}</span>
                <input type="range" min={0} max={400} step={10} value={manual} onChange={(e) => setManual(+e.target.value)} style={{ ["--fill" as string]: `${(manual / 400) * 100}%` }} />
              </label>
            )}
          </div>
        )}
        <div className="flex gap-2 pointer-events-auto">
          <button type="button" onClick={() => setPanel((v) => !v)} className="chip chip--live backdrop-blur-md h-9">
            <SlidersHorizontal className="w-3.5 h-3.5" strokeWidth={2.2} />{t("Capteurs", "Sensors")}{sensors.length ? ` · ${sensors.length}` : ""}
          </button>
          {people > 0 && <span className="chip chip--live backdrop-blur-md h-9 tnum"><Users className="w-3.5 h-3.5" strokeWidth={2.2} />{people} {t("en ligne", "online")}</span>}
          <button type="button" onClick={quit} className="chip chip--live backdrop-blur-md h-9"><X className="w-3.5 h-3.5" strokeWidth={2.2} />{t("Quitter", "Quit")}</button>
        </div>
      </div>
    </div>
  );
}

/** A trainer's label with its protocol in the overlay's language; any other sensor's name. */
const sensorLabel = (s: Sensor | undefined, en: boolean) =>
  s?.trainer ? trainerLabel(s.trainer.deviceName, s.trainer.protocol, en ? PROTOCOL_LABEL : PROTOCOL_FR) : s?.name;

const freshRide = () => ({ streams: emptyStreams(), moving: 0, creditSec: 0, hr: [] as [number, number][], nextHrAt: 0, splits: [] as { km: number; sec: number }[], lastSplit: 0, maxPeople: 0, startedIso: new Date().toISOString(), saved: false });
const titleCase = (s: string) => s.toLowerCase().replace(/(^|[\s'-])\p{L}/gu, (m) => m.toUpperCase());
