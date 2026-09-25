"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Bluetooth, BluetoothOff, Check, Users, X, SlidersHorizontal, Mic, MicOff, Volume2, VolumeX, Flag } from "lucide-react";
import { powerFromHr, declaredPower, maxHrFor, XP_CREDIT, type Effort } from "@/lib/indoor/physics";
import { sensorAvailability, connectSensor, SensorFusion, sensorName, type Availability, type Sensor, type SensorKind } from "@/lib/indoor/sensors";
import { shouldSendGrade, resultText } from "@/lib/indoor/ftms";
import { curveName, powerFromCurve, trainerLabel, PROTOCOL_LABEL, PROTOCOL_LABEL_FR, SPEED_CURVES, type ControlResult, type SpeedCurveId, type TrainerControl, type TrainerProtocol } from "@/lib/indoor/trainer";
import { extrapolate, joinRoom, prune, type Room } from "@/lib/indoor/live";
import { DROP_AT, VoiceChat, reportVoice, voiceSignal, type ReportReason } from "@/lib/indoor/voice";
import { RadioCards, RadioField } from "@/components/ui";
import { addSplits, profileMessage, rewardMessage, ridersMessage, unityRoom, type UnityMessage, type UnitySummary } from "@/lib/indoor/unity";
import { boardMessage, postSegment, segmentBoard, type Category } from "@/lib/leaderboard";
import { emptyStreams, pushSample } from "@/lib/tcx";
import { supabase } from "@/lib/supabase/client";
import { activityKcal, hrSummary } from "@/lib/heart";
import { awardChallenges, awardIndoor, awardRouteBadge } from "@/lib/progress";
import { db, getStats, uid } from "@/lib/db";
import { buy, keepWorn, wallet } from "@/lib/wallet";
import type { Activity, Profile } from "@/lib/types";
import { rateRace, type RaceCategory } from "@/lib/indoor/rating";
import { postRating } from "@/lib/social/ratings";
import { announceRiding } from "@/lib/social/online";
import { myClub } from "@/lib/social/clubs";
import { getHandle } from "@/lib/social/feed";
import { getLang } from "@/lib/i18n";

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

/* Sensors outlive one ride. Web Bluetooth can only pair from a tap on the device list, so quitting the game
   and coming back must not drop the trainer: the links live here, and their readings go to whichever ride is
   open (none while the rider is elsewhere in the app). */
const kept = {
  sensors: [] as Sensor[],
  sink: null as ((r: Parameters<SensorFusion["accept"]>[0]) => void) | null,
  lost: null as ((kind: SensorKind) => void) | null,
};

const PROTOCOL_FR: Record<TrainerProtocol, string> = PROTOCOL_LABEL_FR;

/**
 * The indoor ride drawn by the Unity game. This component is the app's half of
 * the game: it feeds the sensors in, drives the trainer from the game's grade
 * and ERG targets, puts the rider in the room with the people on the same road,
 * and saves the ride with its XP when the game says it is over.
 */
export function UnityRide({ profile, ftpW, startRoute, onExit, say }: {
  profile: Profile;
  ftpW: number;
  /** Open on this road (a route key from the Social page's "Join"). */
  startRoute?: string | null;
  onExit: (message?: string) => void;
  say: (m: string) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const unity = useRef<UnityInstance | null>(null);
  const [progress, setProgress] = useState(0);
  const [failed, setFailed] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  // The overlay starts in the app's language, then speaks the game's once it is loaded (the game follows the
  // device, or the rider's choice in its menu).
  const [en, setEn] = useState(() => getLang() === "en");
  const enRef = useRef(en);
  useEffect(() => { enRef.current = en; }, [en]);
  const t = (fr: string, english: string) => (en ? english : fr);
  const tr = (fr: string, english: string) => (enRef.current ? english : fr);

  const fusion = useRef(new SensorFusion());
  const [sensors, setSensorList] = useState<Sensor[]>(() => kept.sensors);
  const setSensors = (next: (cur: Sensor[]) => Sensor[]) => setSensorList((cur) => (kept.sensors = next(cur)));
  const [connecting, setConnecting] = useState<SensorKind | null>(null);
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [panel, setPanel] = useState(false);
  const [manual, setManual] = useState(0);
  const [curve, setCurve] = useState<SpeedCurveId>("generic");
  const [people, setPeople] = useState(0);
  // What the sensors actually send, shown in the panel (so a trainer that never reports cadence is plain to see).
  const [readout, setReadout] = useState<{ w?: number; rpm?: number; kph?: number } | null>(null);
  const maxHr = useMemo(() => maxHrFor(profile.age), [profile.age]);

  const controller = useRef<TrainerControl | null>(null);
  const controlOk = useRef(false);
  const [control, setControl] = useState<"none" | "asking" | "ok" | string>("none");

  // What the game last told us, read by the timers.
  const game = useRef({ category: "D" as Category, quality: "declared" as string, watts: 0, hr: null as number | null, cadence: null as number | null, eventRoom: null as string | null, route: "", event: null as string | null, distance: 0, speedKph: 0, elapsed: 0, grade: 0, erg: null as number | null });
  const live = useRef({ manual: 0, hasSensor: false, curve: "generic" as SpeedCurveId });
  useEffect(() => { live.current = { manual, hasSensor: sensors.length > 0, curve }; }, [manual, sensors, curve]);
  // The game's home screen shows what is paired: the names, and whether one of them is a trainer.
  useEffect(() => {
    if (!ready) return;
    send({ type: "sensors", items: sensors.map((s) => sensorLabel(s, en) ?? sensorName(s.kind, en)), ok: sensors.some((s) => !!s.trainer) });
  }, [ready, sensors, en]); // eslint-disable-line react-hooks/exhaustive-deps
  const acc = useRef(freshRide());
  const room = useRef<Room | null>(null);
  const roomKey = useRef("");
  const look = useRef<string | undefined>(profile.indoorGame?.look);
  const sayRef = useRef(say);
  useEffect(() => { sayRef.current = say; }, [say]);
  const exitRef = useRef<(() => void) | null>(null);

  /* Proximity voice: off until the rider turns it on (see lib/indoor/voice.ts). */
  const voice = useRef<VoiceChat | null>(null);
  const voiceLive = useRef(false);
  const [voiceOn, setVoiceOn] = useState(false);
  const [inRoom, setInRoom] = useState(true);
  const [voiceMic, setVoiceMic] = useState(true);
  const [voicePanel, setVoicePanel] = useState(false);
  const [openMic, setOpenMic] = useState(() => readPref("forge.voice.open") === "1");
  const [held, setHeld] = useState(false);
  const [talking, setTalking] = useState(false);
  const [heard, setHeard] = useState<Heard[]>([]);
  const [muted, setMuted] = useState<Set<string>>(() => new Set(parseIds(readPref("forge.voice.muted"))));
  const [reporting, setReporting] = useState<{ id: string; name: string; reason: ReportReason } | null>(null);

  const send = (msg: object) => unity.current?.SendMessage("ForgeBridge", "Receive", JSON.stringify(msg));
  /** The garage balance and what is owned (the game shows prices, locks and the buy button from it). */
  const sendWallet = () => wallet().then((w) => { send({ type: "wallet", sparks: w.sparks, test: w.test }); send({ type: "unlocks", items: w.owned }); });

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
        // A phone (or "Normal" graphics) keeps its frame rate at 1.5×; a computer on "High" (the game's default
        // there) gets the screen's full sharpness, up to 2×.
        // A Retina screen at 2x is four times the pixels: 1.5x stays sharp and is far lighter (1x on Normal graphics).
        devicePixelRatio: Math.min(window.devicePixelRatio || 1, highGraphics() ? 1.5 : 1),
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
    voice.current?.setRoom("", null);
    const r = await joinRoom(key, "ride", profile.name, () => {
      const n = room.current?.peers.size ?? 0;
      setPeople(n);
      acc.current.maxPeople = Math.max(acc.current.maxPeople, n);
    }, (from) => send({ type: "kudos", from }), (from, data) => {
      const sig = voiceSignal(data);
      if (sig) void voice.current?.receive(from, sig);
    }, (from, name, key) => send({ type: "chat", id: `p-${from}`, from: name, key }));
    if (roomKey.current !== key) { r?.leave(); return; }
    room.current = r; setInRoom(!!r);
    voice.current?.setRoom(r?.me ?? "", r ? (to, sig) => r.signal(to, sig) : null);
    if (!r) sayRef.current(tr("Connecte-toi à ton compte pour rouler avec les autres.", "Sign in to ride with other people."));
  }
  useEffect(() => () => { voice.current?.stop(); voice.current = null; room.current?.leave(); room.current = null; }, []);

  /* ── the loop: effort into the game, the room into the game, the game into the trainer ── */
  useEffect(() => {
    if (!ready) return;
    const sent = { grade: null as number | null, gradeAt: 0, erg: -1, ergAt: 0 };
    let busy = false;
    let lastBeat = 0, lastReadout = 0;
    const control = (command: (c: TrainerControl) => Promise<ControlResult>) => {
      const c = controller.current;
      if (!c) return;
      busy = true;
      command(c).then((r) => { if (!r.ok && r.result) sayRef.current(`Trainer${enRef.current ? "" : " "}: ${resultText(r.result, enRef.current) ?? tr("commande refusée", "command refused")}.`); }).finally(() => { busy = false; });
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
      if (now - lastReadout >= 1000) { lastReadout = now; setReadout(L.hasSensor ? { w: power, rpm: cadence, kph: machineSpeed != null ? machineSpeed * 3.6 : undefined } : null); }
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
        if (now - lastBeat >= 1000) { lastBeat = now; r.send(g.distance, g.speedKph / 3.6, { look: look.current, quality: g.quality === "measured" ? "m" : g.quality === "estimated" ? "e" : "d", category: g.category, voice: voiceLive.current }); }
        const v = voice.current;
        if (v && voiceLive.current) {
          const list = [...r.peers.values()].map((p) => ({ id: p.id, name: p.name, distance: extrapolate(p, now), voice: !!p.voice }));
          const st = v.update(g.distance, list);
          setTalking(st.talking);
          setHeard(list.filter((p) => p.voice && Math.abs(p.distance - g.distance) <= DROP_AT)
            .map((p) => ({ id: p.id, name: p.name, gap: Math.round(Math.abs(p.distance - g.distance)), gain: st.linked.get(p.id) ?? 0, linked: st.linked.has(p.id), speaking: st.speaking.has(p.id) }))
            .sort((a, b) => a.gap - b.gap));
        }
      }
    }, 250);
    return () => clearInterval(timer);
  }, [ready, maxHr, ftpW]);

  // This ride takes the readings of the sensors already paired (and gives them back when it closes).
  useEffect(() => {
    kept.sink = (r) => fusion.current.accept(r);
    kept.lost = (kind) => {
      setSensorList((cur) => (kept.sensors = cur.filter((x) => x.kind !== kind)));
      if (kind === "trainer") { controller.current = null; controlOk.current = false; setControl("none"); }
      sayRef.current(tr(`${sensorName(kind, false)} : déconnecté.`, `${sensorName(kind, true)} disconnected.`));
    };
    return () => { kept.sink = null; kept.lost = null; };
  }, []);
  // A trainer paired during an earlier ride: take control of it again for this one.
  useEffect(() => {
    const commands = kept.sensors.find((x) => x.trainer?.commands)?.trainer?.commands;
    if (!ready || !commands || controller.current) return;
    controller.current = commands; setControl("asking");
    commands.start().then((r) => {
      if (!r.ok) { setControl(r.result ? resultText(r.result, enRef.current) ?? tr("refusé", "refused") : tr("pas de réponse", "no answer")); return; }
      controlOk.current = true; setControl("ok");
    }).catch(() => setControl(tr("pas de réponse", "no answer")));
  }, [ready]);

  /* ── the end: save the ride, count the XP, tell the game ── */
  async function saveRide(s: UnitySummary) {
    const a = acc.current;
    if (a.saved) return;
    a.saved = true;
    if (s.distance < 50 || a.moving < 30) { send(rewardMessage(0, (await getStats()).xp)); return; }
    // A race ridden to the line moves the FORGE rating (only with a real power reading: typed watts don't race).
    const race = s.race;
    if (race && /^[ABCD]$/.test(race.category) && race.of >= 2 && race.place >= 1 && race.place <= race.of && game.current.quality !== "declared") {
      const cat = race.category as RaceCategory;
      const next = rateRace(profile.rating, cat, race.place, race.of);
      const delta = next.history[0]?.delta ?? 0;
      await db.profile.update(profile.id, { rating: next, dirty: 1, updatedAt: new Date().toISOString() } as Partial<Profile>);
      send({ type: "rating", rating: next.value, delta, place: race.place, of: race.of });
      void myClub().then((c) => postRating(next, cat, c?.tag ?? null));
    }
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
      title: tr(`${routeName} · sortie indoor`, `${routeName} · indoor ride`), shared: false, xp: 0,
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
    sendWallet();
    exitRef.current?.();
  }
  const routeNames = useRef<Record<string, string>>({});
  const onlineRoute = useRef(""), onlineStop = useRef<(() => void) | null>(null), handle = useRef<Promise<string | null> | null>(null);
  useEffect(() => () => onlineStop.current?.(), []);
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
          if (m.gfx) writePref("forge.gfx", m.gfx);
          if (m.lang === "en" || m.lang === "fr") setEn(m.lang === "en");
          g.route = m.route;
          getStats().then((s) => send({ ...profileMessage({ name: profile.name, weightKg: profile.weightKg, ftpW, ftpGuessed: profile.ftpW == null, rating: profile.rating?.value }, s.xp), lang: navigator.language }));
          if (profile.indoorGame?.look) send({ type: "look", look: profile.indoorGame.look });
          // Joining a friend: onto their road (catalog routes only; a generated one can't be rebuilt from its key here).
          { const id = startRoute ? m.routes.find((r) => r.key === startRoute)?.id : undefined; if (id != null && id !== m.routeId) send({ type: "command", action: "route", value: String(id) }); }
          keepWorn(profile.indoorGame?.look).then(sendWallet);
          if (profile.indoorGame?.palmares) send({ type: "palmares", data: JSON.parse(profile.indoorGame.palmares) });
          enterRoom(unityRoom(g.route, g.event));
          break;
        case "position":
          // Friends see where I ride (Social page): announced once pedalling, again on a new road.
          if (!m.paused && m.speedKph > 1 && m.route !== onlineRoute.current) {
            onlineRoute.current = m.route; onlineStop.current?.(); onlineStop.current = null;
            const key = m.route, name = routeTitle(m.route);
            void (handle.current ??= getHandle()).then((h) => { if (h && onlineRoute.current === key) onlineStop.current = announceRiding({ handle: h, routeKey: key, routeName: name }); });
          }
          // Another route, or the same one restarted: a new ride to count and save.
          if (m.route !== g.route || m.elapsed + 1 < g.elapsed) { g.route = m.route; acc.current = freshRide(); }
          g.distance = m.distance; g.speedKph = m.speedKph; g.elapsed = m.elapsed;
          if (m.category === "A" || m.category === "B" || m.category === "C" || m.category === "D") g.category = m.category;
          if (!m.paused) pushSample(acc.current.streams, { t: m.elapsed, d: m.distance, alt: m.altitude, w: g.watts, hr: g.hr, cad: g.cadence });
          acc.current.lastSplit = addSplits(acc.current.splits, m.distance, m.elapsed, acc.current.lastSplit);
          enterRoom(unityRoom(g.route, g.event, g.eventRoom));
          break;
        case "graphics": writePref("forge.gfx", m.gfx); break;
        case "openSensors": setPanel(true); setVoicePanel(false); break;
        case "grade": g.grade = m.grade; break;
        case "ergTarget": g.erg = m.watts; break;
        case "event":
          g.event = m.action === "leave" ? null : m.id;
          g.eventRoom = m.action !== "leave" && m.kind === "race" ? m.category : null;
          enterRoom(unityRoom(g.route, g.event, g.eventRoom));
          break;
        case "chat":
          room.current?.chat(m.key);
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
        case "buy":
          buy(m.item).then((r) => {
            send({ type: "bought", item: m.item, ok: r.ok, reason: r.ok ? "" : r.reason, need: r.ok ? 0 : r.need ?? 0 });
            if (r.ok) sayRef.current(tr(`Acheté : ${r.item.fr} · −${r.price} étincelles`, `Bought: ${r.item.en} · −${r.price} sparks`));
            sendWallet();
          });
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
      const s = await connectSensor(kind, (r) => kept.sink?.(r), () => { kept.sensors = kept.sensors.filter((x) => x.kind !== kind); kept.lost?.(kind); }, { riderKg: profile.weightKg });
      setSensors((cur) => [...cur.filter((x) => x.kind !== kind), s]);
      // Paired: the panel gets out of the way (it opens again from "Capteurs").
      if (!s.trainer?.commands) window.setTimeout(() => setPanel(false), 1200);
      say(s.trainer ? tr(`Trainer détecté : ${sensorLabel(s, false)}`, `Trainer found: ${sensorLabel(s, true)}`) : tr(`${s.name} connecté.`, `${s.name} connected.`));
      const commands = s.trainer?.commands;
      if (commands) {
        // FTMS: request control then start, exactly as before. Wahoo: unlock
        // and simulation init. FE-C: rider weight.
        controller.current = commands; setControl("asking");
        const r = await commands.start();
        if (!r.ok) { setControl(r.result ? resultText(r.result, enRef.current) ?? tr("refusé", "refused") : tr("pas de réponse", "no answer")); return; }
        controlOk.current = true; setControl("ok");
        window.setTimeout(() => setPanel(false), 1500);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!/cancelled|User cancelled/i.test(msg)) say(msg);
    } finally { setConnecting(null); }
  }

  /* ── voice ── */
  async function voiceStart() {
    const v = voice.current ?? (voice.current = new VoiceChat());
    const { mic } = await v.start();
    v.setOpenMic(openMic);
    for (const id of muted) v.setMuted(id, true);
    const r = room.current;
    v.setRoom(r?.me ?? "", r ? (to, sig) => r.signal(to, sig) : null);
    voiceLive.current = true; setVoiceOn(true); setVoiceMic(mic);
    if (!mic) say(tr("Micro refusé : tu entends les autres, mais eux ne t'entendent pas.", "Microphone blocked: you hear the others, they don't hear you."));
  }
  function voiceStop() {
    voice.current?.stop(); voice.current = null;
    voiceLive.current = false; setVoiceOn(false); setHeard([]); setTalking(false); setHeld(false);
  }
  function chooseOpenMic(open: boolean) {
    setOpenMic(open); writePref("forge.voice.open", open ? "1" : "0");
    voice.current?.setOpenMic(open);
  }
  function toggleMute(id: string) {
    const next = new Set(muted);
    if (next.has(id)) next.delete(id); else next.add(id);
    setMuted(next); writePref("forge.voice.muted", JSON.stringify([...next].slice(-200)));
    voice.current?.setMuted(id, next.has(id));
  }
  async function sendReport() {
    if (!reporting) return;
    const { id, name, reason } = reporting;
    setReporting(null);
    if (!muted.has(id)) toggleMute(id);
    const ok = await reportVoice(id, name, roomKey.current, reason);
    say(ok ? tr(`${name} est signalé et coupé pour toi.`, `${name} is reported and muted for you.`) : tr(`${name} est coupé pour toi. Le signalement n'a pas pu partir.`, `${name} is muted for you. The report could not be sent.`));
  }
  // Push to talk: hold B (V and T are the game's) or the on-screen button.
  useEffect(() => { voice.current?.setHeld(held); }, [held]);
  useEffect(() => {
    if (!voiceOn || openMic) return;
    const typing = (e: KeyboardEvent) => e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement;
    const down = (e: KeyboardEvent) => { if (e.code === "KeyB" && !e.repeat && !typing(e)) setHeld(true); };
    const up = (e: KeyboardEvent) => { if (e.code === "KeyB") setHeld(false); };
    const blur = () => setHeld(false);
    window.addEventListener("keydown", down); window.addEventListener("keyup", up); window.addEventListener("blur", blur);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); window.removeEventListener("blur", blur); setHeld(false); };
  }, [voiceOn, openMic]);

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

      {/* The app's own controls: a column of round buttons at the left edge, halfway down, where the game's HUD has
          nothing (its map, grade, profile and power gauge fill the bottom, even more so on a phone). Panels open beside it. */}
      <div className="absolute left-0 top-1/2 -translate-y-1/2 pl-[calc(env(safe-area-inset-left,0px)+8px)] flex items-center gap-2 pointer-events-none">
        <div className="flex flex-col items-start gap-2 pointer-events-auto">
          {voiceOn && !openMic && voiceMic && (
            <button type="button" className={`${ROUND} !h-14 !w-14 select-none touch-none ${held ? "!bg-volt !border-volt" : ""}`}
              onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); setHeld(true); }} onPointerUp={() => setHeld(false)} onPointerCancel={() => setHeld(false)} onLostPointerCapture={() => setHeld(false)}
              onContextMenu={(e) => e.preventDefault()} aria-pressed={held} aria-label={t("Maintenir pour parler (B)", "Hold to talk (B)")} title={t("Maintenir pour parler (B)", "Hold to talk (B)")}>
              <Mic className="w-6 h-6" strokeWidth={2.2} />
            </button>
          )}
          <button type="button" onClick={() => { setVoicePanel((v) => !v); setPanel(false); }} className={`${ROUND} ${voicePanel ? "!border-volt" : ""}`} aria-expanded={voicePanel} aria-label={t("Voix", "Voice")} title={t("Voix", "Voice")}>
            {voiceOn ? <Mic className="w-5 h-5 text-volt-deep" strokeWidth={2.2} /> : <MicOff className="w-5 h-5" strokeWidth={2.2} />}
            {voiceOn && heard.length > 0 && <span className={BADGE}>{heard.length}</span>}
          </button>
          <button type="button" onClick={() => { setPanel((v) => !v); setVoicePanel(false); }} className={`${ROUND} ${panel ? "!border-volt" : ""}`} aria-expanded={panel} aria-label={t("Capteurs", "Sensors")} title={t("Capteurs", "Sensors")}>
            <SlidersHorizontal className="w-5 h-5" strokeWidth={2.2} />
            {sensors.length > 0 && <span className={BADGE}>{sensors.length}</span>}
          </button>
          {people > 0 && <span className={`${ROUND} cursor-default`} role="status" aria-label={`${people} ${t("en ligne", "online")}`} title={`${people} ${t("en ligne", "online")}`}><Users className="w-5 h-5" strokeWidth={2.2} /><span className={BADGE}>{people}</span></span>}
          <button type="button" onClick={quit} className={ROUND} aria-label={t("Quitter", "Quit")} title={t("Quitter", "Quit")}><X className="w-5 h-5" strokeWidth={2.2} /></button>
          {voiceOn && (heard.some((h) => h.speaking) || talking) && (
            <div className="grid gap-1 max-w-[40vw]" aria-live="polite">
              {talking && <span className="chip chip--volt h-8"><Mic className="w-3.5 h-3.5" strokeWidth={2.4} />{t("Tu parles", "You're talking")}</span>}
              {heard.filter((h) => h.speaking).map((h) => <span key={h.id} className="chip chip--live backdrop-blur-md h-8 !text-ink truncate"><Mic className="w-3.5 h-3.5 text-volt-deep shrink-0" strokeWidth={2.4} />{h.name}</span>)}
            </div>
          )}
        </div>
        {voicePanel && (
          <div className={PANEL}>
            {!voiceOn ? (
              <>
                <p className="text-sm">{t("Parle aux coureurs proches de toi : fort à moins de 20 m, de moins en moins jusqu'à 100 m, puis plus rien. Rien n'est enregistré.", "Talk to the riders around you: clear within 20 m, fading out by 100 m. Nothing is recorded.")}</p>
                {!inRoom && <p className="text-xs text-smoke">{t("Connecte-toi à ton compte pour parler aux autres.", "Sign in to talk to other riders.")}</p>}
                <button type="button" className="pill pill--volt pill--sm" onClick={() => void voiceStart()}><Mic className="w-4 h-4" strokeWidth={2.2} />{t("Activer la voix", "Turn voice on")}</button>
              </>
            ) : (
              <>
                <RadioField label={t("Micro", "Microphone")} value={openMic ? "open" : "ptt"} onChange={(v) => chooseOpenMic(v === "open")}
                  options={[{ v: "ptt", label: t("Appuyer pour parler (B)", "Push to talk (B)") }, { v: "open", label: t("Toujours ouvert", "Always on") }]} />
                {!voiceMic && <p className="text-xs text-smoke">{t("Micro refusé par le navigateur : tu entends les autres, mais eux ne t'entendent pas.", "The browser blocked the microphone: you hear the others, they don't hear you.")}</p>}
                <div className="grid gap-1">
                  <span className="meta">{t("À portée de voix", "Within earshot")}</span>
                  {heard.length === 0 && <p className="text-xs text-smoke">{t("Personne en vocal près de toi pour l'instant.", "Nobody in voice near you right now.")}</p>}
                  {heard.map((h) => (
                    <div key={h.id} className="flex items-center gap-2 min-h-11">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${h.speaking ? "bg-volt-deep" : "bg-line-strong"}`} aria-hidden="true" />
                      <span className="flex-1 min-w-0 truncate text-sm">{h.name}<span className="text-xs text-smoke tnum"> · {h.gap} m{h.gain === 0 && !muted.has(h.id) ? t(" · trop loin", " · too far") : ""}</span></span>
                      <button type="button" className="h-9 w-9 grid place-items-center rounded-full border border-line-strong" onClick={() => toggleMute(h.id)} aria-pressed={muted.has(h.id)} aria-label={muted.has(h.id) ? t(`Réactiver ${h.name}`, `Unmute ${h.name}`) : t(`Couper ${h.name}`, `Mute ${h.name}`)}>
                        {muted.has(h.id) ? <VolumeX className="w-4 h-4 text-danger" strokeWidth={2.2} /> : <Volume2 className="w-4 h-4" strokeWidth={2.2} />}
                      </button>
                      <button type="button" className="h-9 w-9 grid place-items-center rounded-full border border-line-strong" onClick={() => setReporting({ id: h.id, name: h.name, reason: "abuse" })} aria-label={t(`Signaler ${h.name}`, `Report ${h.name}`)}>
                        <Flag className="w-4 h-4" strokeWidth={2.2} />
                      </button>
                    </div>
                  ))}
                </div>
                {reporting && (
                  <div className="card p-3 grid gap-2 !border-danger">
                    <span className="meta">{t(`Signaler ${reporting.name}`, `Report ${reporting.name}`)}</span>
                    <RadioCards label={t("Raison", "Reason")} value={reporting.reason} onChange={(reason) => setReporting({ ...reporting, reason })}
                      options={[{ v: "abuse", label: t("Insultes", "Abuse") }, { v: "harassment", label: t("Harcèlement", "Harassment") }, { v: "hate", label: t("Haine", "Hate") }, { v: "sexual", label: t("Sexuel", "Sexual") }, { v: "spam", label: t("Spam, bruit", "Spam, noise") }, { v: "other", label: t("Autre", "Other") }]} />
                    <p className="text-xs text-smoke">{t("Il sera aussi coupé pour toi. Aucun son n'est envoyé : seulement qui, où et pourquoi.", "They will be muted for you too. No audio is sent: only who, where and why.")}</p>
                    <div className="flex gap-2">
                      <button type="button" className="pill pill--sm" onClick={() => setReporting(null)}>{t("Annuler", "Cancel")}</button>
                      <button type="button" className="pill pill--sm pill--volt" onClick={() => void sendReport()}>{t("Envoyer", "Send")}</button>
                    </div>
                  </div>
                )}
                <button type="button" className="pill pill--sm" onClick={voiceStop}><MicOff className="w-4 h-4" strokeWidth={2.2} />{t("Couper la voix", "Turn voice off")}</button>
              </>
            )}
          </div>
        )}
        {panel && (
          <div className={PANEL}>
            {availability && (availability.ok ? (
              <div className="flex gap-1.5 flex-wrap">
                {SENSORS.map((k) => {
                  const on = connected.has(k);
                  return (
                    <button key={k} type="button" onClick={() => !on && connect(k)} disabled={connecting !== null || on}
                      className={`h-9 px-3 rounded-full border text-xs flex items-center gap-1.5 ${on || connecting === k ? "border-volt text-volt-deep" : "border-line-strong text-ink"} ${connecting !== null && connecting !== k ? "opacity-40" : ""}`}>
                      {on ? <Check className="w-3.5 h-3.5" strokeWidth={2.4} /> : <Bluetooth className="w-3.5 h-3.5" strokeWidth={2} />}
                      {on ? sensorLabel(sensors.find((s) => s.kind === k), en) ?? sensorName(k, en) : sensorName(k, en)}
                    </button>
                  );
                })}
              </div>
            ) : <p className="text-xs text-smoke flex gap-2"><BluetoothOff className="w-4 h-4 shrink-0" strokeWidth={2} />{availability.reason}</p>)}
            {readout && (
              <p className="text-xs text-ink tnum">
                {t("Reçu", "Receiving")} : {readout.w != null ? `${Math.round(readout.w)} W` : "— W"} · {readout.rpm != null ? `${Math.round(readout.rpm)} rpm` : "— rpm"}{readout.kph != null ? ` · ${readout.kph.toFixed(1)} km/h` : ""}
              </p>
            )}
            {readout && readout.rpm == null && (readout.w ?? 0) > 20 && !connected.has("csc") && (
              <p className="text-xs text-smoke">{t("Ton trainer n'envoie pas la cadence (beaucoup n'en ont pas). Un capteur de cadence (bouton ci-dessus) l'ajoute.", "Your trainer doesn't report cadence (many don't). A cadence sensor (button above) adds it.")}</p>
            )}
            {trainer && <p className="text-xs text-ink">{t("Trainer détecté : ", "Trainer found: ")}{trainerLabel(trainer.deviceName, trainer.protocol, en ? PROTOCOL_LABEL : PROTOCOL_FR)}{trainer.canControl ? "" : t(" · lecture seule, pas de contrôle de la résistance", " · read-only, no resistance control")}</p>}
            {speedOnly && (
              <label className="flex items-center gap-2 text-xs">
                <span className="meta">{t("Courbe vitesse → puissance (estimée)", "Speed → power curve (estimated)")}</span>
                <select value={curve} onChange={(e) => setCurve(e.target.value as SpeedCurveId)} className="h-8 rounded-lg border border-line-strong px-2 bg-transparent">
                  {SPEED_CURVES.map((c) => <option key={c.id} value={c.id}>{curveName(c, en)}</option>)}
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
      </div>
    </div>
  );
}

/** A trainer's label with its protocol in the overlay's language; any other sensor's name. */
const sensorLabel = (s: Sensor | undefined, en: boolean) =>
  s?.trainer ? trainerLabel(s.trainer.deviceName, s.trainer.protocol, en ? PROTOCOL_LABEL : PROTOCOL_FR) : s?.name;

/* The overlay's round buttons, their count badge, and the panels that open beside them. */
const ROUND = "relative h-11 w-11 grid place-items-center rounded-full border border-line-strong bg-[rgba(255,255,255,.9)] text-ink shadow-[0_6px_18px_-8px_rgba(0,0,0,.5)] backdrop-blur-md";
const BADGE = "absolute -top-1 -right-1 min-w-5 h-5 px-1 grid place-items-center rounded-full bg-ink text-bone text-[11px] font-semibold tnum";
const PANEL = "card p-3 grid gap-3 w-[min(calc(100vw-80px),440px)] max-h-[80vh] overflow-y-auto backdrop-blur-xl !bg-[rgba(255,255,255,.94)] pointer-events-auto";

interface Heard { id: string; name: string; gap: number; gain: number; linked: boolean; speaking: boolean }
/* Per-device conveniences (mic mode, who is muted): storage may be blocked, and that is fine. */
function readPref(key: string): string | null { try { return typeof localStorage === "undefined" ? null : localStorage.getItem(key); } catch { return null; } }
function writePref(key: string, value: string) { try { localStorage.setItem(key, value); } catch { /* private mode */ } }
/** High graphics unless this is a phone or tablet, or the rider picked Normal in the game. */
function highGraphics() {
  const touch = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent));
  return !touch && readPref("forge.gfx") !== "normal";
}
function parseIds(v: string | null): string[] { try { const a = JSON.parse(v ?? "[]"); return Array.isArray(a) ? a.filter((x): x is string => typeof x === "string") : []; } catch { return []; } }

const freshRide = () => ({ streams: emptyStreams(), moving: 0, creditSec: 0, hr: [] as [number, number][], nextHrAt: 0, splits: [] as { km: number; sec: number }[], lastSplit: 0, maxPeople: 0, startedIso: new Date().toISOString(), saved: false });
const titleCase = (s: string) => s.toLowerCase().replace(/(^|[\s'-])\p{L}/gu, (m) => m.toUpperCase());
