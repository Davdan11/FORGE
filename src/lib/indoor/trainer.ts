/* ─────────────────────────────────────────────────────────────
   One "Trainer" button for every brand.

   A trainer is recognised by the services it actually exposes,
   never by its name: the same Tacx Neo speaks FE-C on old
   firmware and FTMS on new, and a Wahoo KICKR likewise. The name
   only decorates the label ("Tacx Neo 2T · FE-C").

   Best protocol first:
     ftms          Fitness Machine 0x1826 — every modern smart trainer
     tacx-fec      Tacx FE-C over BLE (6e40fec1…) — Tacx before FTMS
     wahoo-legacy  Cycling Power 0x1818 + Wahoo a026e005… — KICKR before FTMS
     power-only    Cycling Power 0x1818, no control — power meters, basic trainers
     speed-only    CSC 0x1816 — a dumb trainer with a speed sensor

   Callers drive a trainer through TrainerControl (setGrade,
   setTargetPower, start, stop) and never see bytes.
   ───────────────────────────────────────────────────────────── */

import { cmdRequestControl, cmdSimulation, cmdStart, cmdStop, cmdTargetPower } from "./ftms";
import { FEC_SERVICE, fecTargetPower, fecTrackResistance, fecUserConfig } from "./fec";
import { wahooErg, wahooGrade, wahooSimInit, wahooUnlock } from "./wahoo";
import { powerFromSpeed } from "./physics";

export type TrainerProtocol = "ftms" | "tacx-fec" | "wahoo-legacy" | "power-only" | "speed-only";

/** A 16-bit Bluetooth SIG UUID in its full 128-bit, lowercase form — the form
 *  both transports report and accept. */
export const uuid16 = (n: number) => `0000${n.toString(16).padStart(4, "0")}-0000-1000-8000-00805f9b34fb`;
export const normUuid = (u: string | number) => (typeof u === "number" ? uuid16(u) : u.length <= 8 ? uuid16(parseInt(u, 16)) : u.toLowerCase());

export const FTMS_SERVICE = uuid16(0x1826);
export const CP_SERVICE = uuid16(0x1818);
export const CSC_SERVICE = uuid16(0x1816);
export { FEC_SERVICE };

/** Every service a trainer might be found by, best protocol first. */
export const TRAINER_SERVICES = [FTMS_SERVICE, FEC_SERVICE, CP_SERVICE, CSC_SERVICE];

export interface Discovered {
  /** Service UUIDs found on the device, any form. */
  services: Iterable<string>;
  /** Whether the Wahoo control characteristic sits in the Cycling Power service. */
  wahooControl: boolean;
}

/** The protocol to use, from what the device actually has; null if nothing usable. */
export function chooseProtocol(d: Discovered): TrainerProtocol | null {
  const s = new Set([...d.services].map(normUuid));
  if (s.has(FTMS_SERVICE)) return "ftms";
  if (s.has(FEC_SERVICE)) return "tacx-fec";
  if (s.has(CP_SERVICE) && d.wahooControl) return "wahoo-legacy";
  if (s.has(CP_SERVICE)) return "power-only";
  if (s.has(CSC_SERVICE)) return "speed-only";
  return null;
}

export const canControl = (p: TrainerProtocol) => p === "ftms" || p === "tacx-fec" || p === "wahoo-legacy";

/* ── the brand, for the label only ────────────────────────── */

const BRANDS: [RegExp, string][] = [
  [/wahoo|kickr/i, "Wahoo"],
  [/tacx|\bneo\b|\bflux|vortex|bushido|genius|satori/i, "Tacx"],
  [/\belite\b|direto|suito|justo|zumo|\btuo\b|drivo|avanti/i, "Elite"],
  [/saris|cycleops|\bh3\b|\bm2\b|hammer|magnus/i, "Saris"],
  [/zwift|\bhub\b/i, "Zwift"],
  [/van ?rysel|\bd100\b|\bd500\b|decathlon/i, "Van Rysel"],
  [/jet ?black/i, "JetBlack"],
  [/magene/i, "Magene"],
  [/thinkrider/i, "Thinkrider"],
  [/wattbike/i, "Wattbike"],
  [/stages/i, "Stages"],
  [/keiser/i, "Keiser"],
  [/kinetic|\bkurt\b/i, "Kinetic"],
  [/bkool/i, "Bkool"],
  [/technogym/i, "Technogym"],
  [/schwinn/i, "Schwinn"],
  [/echelon/i, "Echelon"],
  [/assioma|favero/i, "Favero"],
  [/4iiii/i, "4iiii"],
  [/quarq/i, "Quarq"],
];

export function guessBrand(name: string | undefined | null): string | null {
  if (!name) return null;
  for (const [re, brand] of BRANDS) if (re.test(name)) return brand;
  return null;
}

/** The advertised name without the serial most trainers append
 *  ("Tacx Neo 2T 12345", "KICKR CORE 5A2B"). A token counts as a serial
 *  when it has four or more hex characters including a digit. */
export function cleanName(name: string): string {
  return name.trim().replace(/\s+(?=[0-9a-f]*\d)[0-9a-f]{4,}$/i, "").trim();
}

export const PROTOCOL_LABEL: Record<TrainerProtocol, string> = {
  ftms: "FTMS",
  "tacx-fec": "FE-C",
  "wahoo-legacy": "Wahoo",
  "power-only": "power only",
  "speed-only": "speed only",
};

/** "Tacx Neo 2T · FE-C". Display only. */
export function trainerLabel(name: string | undefined | null, protocol: TrainerProtocol, labels: Record<TrainerProtocol, string> = PROTOCOL_LABEL): string {
  const brand = guessBrand(name);
  const base = name ? cleanName(name) : "";
  const shown = !base ? brand ?? "Trainer" : brand && !base.toLowerCase().includes(brand.toLowerCase()) ? `${brand} ${base}` : base;
  return `${shown} · ${labels[protocol]}`;
}

/* ── control, whatever the protocol ───────────────────────── */

/** Same shape as the FTMS control point's answer: `result` is the FTMS result
 *  code (1 = OK, see RESULT_TEXT), or 0 when there was no answer. The vendor
 *  protocols have no answer to read, so for them 1 means "written". */
export interface ControlResult { ok: boolean; result: number }

export interface TrainerControl {
  /** Take control: FTMS request-control + start, Wahoo unlock + sim init,
   *  FE-C user configuration. */
  start(): Promise<ControlResult>;
  stop(): Promise<ControlResult>;
  /** Slope mode, percent. */
  setGrade(pct: number): Promise<ControlResult>;
  /** ERG mode, watts. */
  setTargetPower(watts: number): Promise<ControlResult>;
}

export interface TrainerInfo {
  protocol: TrainerProtocol;
  /** The advertised name, as the device gave it. */
  deviceName?: string;
  brand: string | null;
  label: string;
  canControl: boolean;
}

export interface ControlOptions {
  /** Rider mass for the trainer's own slope physics. */
  riderKg?: number;
  bikeKg?: number;
}

/** FTMS: the existing control point, byte for byte what the rides sent before. */
export function ftmsControl(send: (b: Uint8Array) => Promise<ControlResult>): TrainerControl {
  return {
    async start() {
      const r = await send(cmdRequestControl());
      if (!r.ok) return r;
      await send(cmdStart());
      return r;
    },
    stop: () => send(cmdStop()),
    setGrade: (pct) => send(cmdSimulation(pct)),
    setTargetPower: (w) => send(cmdTargetPower(w)),
  };
}

/** Writes one at a time, in order; a failed write is reported, not thrown. */
function serial(write: (b: Uint8Array) => Promise<void>) {
  let chain: Promise<unknown> = Promise.resolve();
  return (b: Uint8Array): Promise<ControlResult> => {
    const next = chain.then(() => write(b)).then(() => ({ ok: true, result: 1 }), () => ({ ok: false, result: 0 }));
    chain = next;
    return next;
  };
}

/** Tacx FE-C: stateless pages, no handshake. Spec-tested, not hardware-tested. */
export function fecControl(write: (b: Uint8Array) => Promise<void>, opts: ControlOptions = {}): TrainerControl {
  const send = serial(write);
  return {
    start: () => (opts.riderKg ? send(fecUserConfig(opts.riderKg, opts.bikeKg)) : Promise.resolve({ ok: true, result: 1 })),
    // Leave the trainer flat rather than holding the last ERG target.
    stop: () => send(fecTrackResistance(0)),
    setGrade: (pct) => send(fecTrackResistance(pct)),
    setTargetPower: (w) => send(fecTargetPower(w)),
  };
}

/** Wahoo legacy: unlock, then simulation or ERG. Switching back from ERG to a
 *  grade re-sends the simulation init. Opcodes from reverse-engineering notes,
 *  not verified on hardware. */
export function wahooControl(write: (b: Uint8Array) => Promise<void>, opts: ControlOptions = {}): TrainerControl {
  const send = serial(write);
  const mass = (opts.riderKg ?? 75) + (opts.bikeKg ?? 8);
  let mode: "none" | "sim" | "erg" = "none";
  const sim = async () => {
    if (mode === "sim") return { ok: true, result: 1 };
    const r = await send(wahooSimInit(mass));
    if (r.ok) mode = "sim";
    return r;
  };
  const setGrade = async (pct: number) => {
    const r = await sim();
    return r.ok ? send(wahooGrade(pct)) : r;
  };
  return {
    async start() {
      const r = await send(wahooUnlock());
      return r.ok ? sim() : r;
    },
    stop: () => setGrade(0),
    setGrade,
    async setTargetPower(w) {
      const r = await send(wahooErg(w));
      if (r.ok) mode = "erg";
      return r;
    },
  };
}

/* ── dumb trainers: speed into watts ──────────────────────── */

export type SpeedCurveId = "generic" | "generic-fluid" | "generic-magnetic" | "kurt-kinetic-road-machine";

export interface SpeedCurve {
  id: SpeedCurveId;
  name: string;
  /** Where the formula comes from. */
  source: string;
  watts: (mph: number) => number;
}

/**
 * Only the Kurt Kinetic curve is a manufacturer-published formula. The two
 * "generic" shapes are FORGE approximations of a typical fluid unit (power
 * rising with the cube of speed) and a typical magnetic unit (closer to linear,
 * flattening at speed) — labelled as such. Every result is "estimated".
 */
export const SPEED_CURVES: SpeedCurve[] = [
  { id: "generic", name: "Generic", source: "FORGE default (powerFromSpeed)", watts: (mph) => { const kmh = mph * 1.609344; return 0.0115 * kmh ** 3 * 0.08 + 2.2 * kmh; } },
  { id: "generic-fluid", name: "Generic fluid", source: "FORGE approximation, not a manufacturer curve", watts: (mph) => 4 * mph + 0.02 * mph ** 3 },
  { id: "generic-magnetic", name: "Generic magnetic", source: "FORGE approximation, not a manufacturer curve", watts: (mph) => 8 * mph + 0.12 * mph ** 2 },
  { id: "kurt-kinetic-road-machine", name: "Kinetic Road Machine", source: "Kurt Kinetic published formula", watts: (mph) => 5.244820 * mph + 0.019168 * mph ** 3 },
];

/** Watts from wheel speed on a chosen curve. Always "estimated". */
export function powerFromCurve(speedMs: number, id: SpeedCurveId): { watts: number; quality: "estimated" } {
  if (id === "generic") return { watts: powerFromSpeed(speedMs).watts, quality: "estimated" };
  const curve = SPEED_CURVES.find((c) => c.id === id) ?? SPEED_CURVES[0];
  const mph = Math.max(0, speedMs) * 2.2369362920544;
  return { watts: Math.round(Math.min(900, Math.max(0, curve.watts(mph)))), quality: "estimated" };
}
