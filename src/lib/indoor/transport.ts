"use client";

import { parseHeartRate, parseCyclingPower, parseCsc, parseIndoorBike, parseTreadmill, parseRsc, type Reading, type Rev, type CscState } from "./ble-parse";
import { parseResponse } from "./ftms";
import { isNativeShell } from "../native";

/* ─────────────────────────────────────────────────────────────
   Two ways to reach a sensor, one way to read it.

   In a browser that is Web Bluetooth. In the iOS and Android
   shells it is CoreBluetooth and the Android BLE stack, reached
   through a Capacitor plugin — because wrapping a web app in a
   native shell does NOT hand the WebView a Bluetooth API. That
   was assumed here for a day and it was wrong.

   What both have in common is everything that matters: the bytes
   arrive as a DataView and go into the same decoders, which are
   pure and tested. A transport's whole job is to produce those
   DataViews and to say honestly whether it can.
   ───────────────────────────────────────────────────────────── */

export type SensorKind = "heart_rate" | "cycling_power" | "csc" | "fitness_machine" | "treadmill" | "footpod";

/** Bluetooth SIG assigned numbers. */
export const SERVICE: Record<SensorKind, number> = {
  heart_rate: 0x180d,
  cycling_power: 0x1818,
  csc: 0x1816,
  fitness_machine: 0x1826,
  treadmill: 0x1826,        // same Fitness Machine service, different data
  footpod: 0x1814,          // Running Speed and Cadence
};

export const CHARACTERISTIC: Record<SensorKind, number> = {
  heart_rate: 0x2a37,       // Heart Rate Measurement
  cycling_power: 0x2a63,    // Cycling Power Measurement
  csc: 0x2a5b,              // CSC Measurement
  fitness_machine: 0x2ad2,  // Indoor Bike Data
  treadmill: 0x2acd,        // Treadmill Data
  footpod: 0x2a53,          // RSC Measurement
};

/** Fitness Machine Control Point: where commands are written. */
const CONTROL_POINT = 0x2ad9;
const CONTROLLABLE: SensorKind[] = ["fitness_machine", "treadmill"];

export const SENSOR_LABEL: Record<SensorKind, string> = {
  heart_rate: "Heart rate strap",
  cycling_power: "Power meter",
  csc: "Speed & cadence sensor",
  fitness_machine: "Smart trainer",
  treadmill: "Smart treadmill",
  footpod: "Footpod",
};

export type Availability =
  | { ok: true; via: "web" | "native" }
  | { ok: false; reason: string; nativeWouldFix: boolean };

export interface Sensor {
  kind: SensorKind;
  name: string;
  disconnect: () => void;
  /**
   * Send one FTMS Control Point command and wait for the machine's answer.
   * Only on trainers and treadmills that expose the control point; a machine
   * that only reports (many older ones) has no `control`, and the ride runs
   * in read-only mode.
   */
  control?: (command: Uint8Array) => Promise<{ ok: boolean; result: number }>;
}

/**
 * One command at a time, each waiting for its indication.
 *
 * The control point answers every write with an indication naming the op code
 * it answers. Two writes in flight make those answers ambiguous, and most
 * trainers reject the second with "operation failed" anyway — so commands
 * queue. A machine that never answers is given three seconds, not forever.
 */
function makeController(write: (b: Uint8Array) => Promise<void>) {
  let waiting: { op: number; done: (r: { ok: boolean; result: number }) => void } | null = null;
  let chain: Promise<unknown> = Promise.resolve();

  const onIndication = (v: DataView) => {
    const r = parseResponse(v);
    if (r && waiting && r.op === waiting.op) { const w = waiting; waiting = null; w.done(r); }
  };

  const control = (command: Uint8Array) => {
    const next = chain.then(() => new Promise<{ ok: boolean; result: number }>((resolve) => {
      const timer = setTimeout(() => { waiting = null; resolve({ ok: false, result: 0 }); }, 3000);
      waiting = { op: command[0], done: (r) => { clearTimeout(timer); resolve(r); } };
      write(command).catch(() => { clearTimeout(timer); waiting = null; resolve({ ok: false, result: 0 }); });
    }));
    chain = next.catch(() => {});
    return next;
  };

  return { onIndication, control };
}

export interface Transport {
  available(): Promise<Availability>;
  connect(kind: SensorKind, onReading: (r: Reading) => void, onDisconnect?: () => void): Promise<Sensor>;
}

/* ── decoding, shared by both transports ──────────────────────
   The cycling profiles report running totals rather than rates, so a decoder
   has to remember the previous notification. That state belongs to one
   connection, which is why this is a factory and not a function. */
export function decoderFor(kind: SensorKind): (v: DataView) => Reading {
  let crank: Rev | undefined;
  let csc: CscState | undefined;

  return (v) => {
    if (kind === "heart_rate") return parseHeartRate(v);
    if (kind === "fitness_machine") return parseIndoorBike(v);
    if (kind === "treadmill") return parseTreadmill(v);
    if (kind === "footpod") return parseRsc(v);
    if (kind === "cycling_power") {
      const out = parseCyclingPower(v, crank);
      crank = out.crank ?? crank;
      return out;
    }
    const out = parseCsc(v, csc);
    csc = out.csc ?? csc;
    return out;
  };
}

/* ── the browser ──────────────────────────────────────────── */

type MinimalCharacteristic = {
  startNotifications: () => Promise<unknown>;
  stopNotifications: () => Promise<unknown>;
  addEventListener: (t: string, fn: (e: Event) => void) => void;
  removeEventListener: (t: string, fn: (e: Event) => void) => void;
  value?: DataView;
  writeValueWithResponse?: (b: BufferSource) => Promise<void>;
  writeValue?: (b: BufferSource) => Promise<void>;
};
type MinimalDevice = {
  name?: string;
  gatt?: { connect: () => Promise<{ getPrimaryService: (s: number) => Promise<{ getCharacteristic: (c: number) => Promise<MinimalCharacteristic> }> }>; connected: boolean; disconnect: () => void };
  addEventListener: (t: string, fn: () => void) => void;
};
type MinimalBluetooth = { requestDevice: (o: unknown) => Promise<MinimalDevice> };

const webTransport: Transport = {
  async available() {
    if (typeof navigator === "undefined") return { ok: false, reason: "Not in a browser.", nativeWouldFix: false };
    // Read before the `in` check: that check narrows `navigator` away entirely
    // in its false branch, and the useful properties go with it.
    const ua = navigator.userAgent;

    if (!("bluetooth" in navigator)) {
      // Two reasons it can be missing, and the answers differ: one is "use a
      // different browser", the other is "this browser will never have it".
      const apple = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && "ontouchend" in document);
      const safari = /^((?!chrome|android|crios|fxios|edgios).)*safari/i.test(ua);
      if (apple || safari) {
        return { ok: false, nativeWouldFix: true, reason: "Safari has no Bluetooth support, on any Apple device. Use Chrome on Android, Mac or Windows — or the FORGE app, which talks to sensors natively." };
      }
      return { ok: false, nativeWouldFix: false, reason: "This browser has no Bluetooth support. Chrome, Edge or Opera will work." };
    }

    // Web Bluetooth needs a secure context: localhost counts, which is why it
    // works in development and then does not on a plain-http staging box.
    if (!window.isSecureContext) {
      return { ok: false, nativeWouldFix: false, reason: "Bluetooth needs a secure connection. Open the app over https." };
    }

    return { ok: true, via: "web" };
  },

  async connect(kind, onReading, onDisconnect) {
    const bt = (navigator as unknown as { bluetooth: MinimalBluetooth }).bluetooth;
    // The browser shows its own chooser: the page never sees what is nearby,
    // only what was picked. That is the API's design, and the right one — a
    // page that could enumerate Bluetooth devices could fingerprint a room.
    const device = await bt.requestDevice({
      filters: [{ services: [SERVICE[kind]] }],
      optionalServices: [SERVICE.heart_rate],
    });

    const server = await device.gatt?.connect();
    if (!server) throw new Error("Could not connect to the sensor.");
    const service = await server.getPrimaryService(SERVICE[kind]);
    const characteristic = await service.getCharacteristic(CHARACTERISTIC[kind]);

    const decode = decoderFor(kind);
    const handler = (e: Event) => {
      const v = (e.target as unknown as MinimalCharacteristic).value;
      if (v) onReading(decode(v));
    };

    characteristic.addEventListener("characteristicvaluechanged", handler);
    await characteristic.startNotifications();
    device.addEventListener("gattserverdisconnected", () => onDisconnect?.());

    // Control, when the machine offers it. Indications must be on before the
    // first write, or the answer to it is lost.
    let control: Sensor["control"];
    let cp: MinimalCharacteristic | null = null;
    let cpHandler: ((e: Event) => void) | null = null;
    if (CONTROLLABLE.includes(kind)) {
      try {
        cp = await service.getCharacteristic(CONTROL_POINT);
        const c = cp;
        const ctl = makeController(async (b) => {
          const buf = b.slice().buffer as ArrayBuffer;
          if (c.writeValueWithResponse) await c.writeValueWithResponse(buf);
          else await c.writeValue!(buf);
        });
        cpHandler = (e: Event) => { const v = (e.target as unknown as MinimalCharacteristic).value; if (v) ctl.onIndication(v); };
        c.addEventListener("characteristicvaluechanged", cpHandler);
        await c.startNotifications();
        control = ctl.control;
      } catch { cp = null; /* reports only */ }
    }

    return {
      kind,
      name: device.name ?? SENSOR_LABEL[kind],
      control,
      disconnect: () => {
        if (cp && cpHandler) { cp.removeEventListener("characteristicvaluechanged", cpHandler); cp.stopNotifications().catch(() => {}); }
        characteristic.removeEventListener("characteristicvaluechanged", handler);
        characteristic.stopNotifications().catch(() => {});
        if (device.gatt?.connected) device.gatt.disconnect();
      },
    };
  },
};

/* ── the native shells ────────────────────────────────────── */

/** Imported only inside the shell: the plugin is dead weight in a web bundle
 *  that can never use it. */
async function ble() {
  const m = await import("@capacitor-community/bluetooth-le");
  return m;
}

const nativeTransport: Transport = {
  async available() {
    // Deliberately does NOT initialize. On iOS that is what creates the
    // central manager and can put the system Bluetooth prompt on screen — and
    // a permission dialog that appears merely because somebody opened a screen
    // is a dialog most people decline. It is asked for on the first connect
    // instead, when the request has an obvious reason behind it.
    return { ok: true, via: "native" };
  },

  async connect(kind, onReading, onDisconnect) {
    const { BleClient, numberToUUID } = await ble();

    await BleClient.initialize();
    if (!(await BleClient.isEnabled())) throw new Error("Bluetooth is off. Turn it on and try again.");

    const service = numberToUUID(SERVICE[kind]);
    const characteristic = numberToUUID(CHARACTERISTIC[kind]);

    const device = await BleClient.requestDevice({ services: [service], optionalServices: [numberToUUID(SERVICE.heart_rate)] });
    await BleClient.connect(device.deviceId, () => onDisconnect?.());

    const decode = decoderFor(kind);
    await BleClient.startNotifications(device.deviceId, service, characteristic, (v) => onReading(decode(v)));

    let control: Sensor["control"];
    const cp = numberToUUID(CONTROL_POINT);
    let cpOn = false;
    if (CONTROLLABLE.includes(kind)) {
      try {
        const ctl = makeController((b) => BleClient.write(device.deviceId, service, cp, new DataView(b.slice().buffer)));
        // The plugin subscribes to indications or notifications, whichever the
        // characteristic declares; the control point declares indications.
        await BleClient.startNotifications(device.deviceId, service, cp, (v) => ctl.onIndication(v));
        cpOn = true;
        control = ctl.control;
      } catch { /* reports only */ }
    }

    return {
      kind,
      name: device.name ?? SENSOR_LABEL[kind],
      control,
      disconnect: () => {
        if (cpOn) BleClient.stopNotifications(device.deviceId, service, cp).catch(() => {});
        BleClient.stopNotifications(device.deviceId, service, characteristic).catch(() => {});
        BleClient.disconnect(device.deviceId).catch(() => {});
      },
    };
  },
};

export const transport = (): Transport => (isNativeShell() ? nativeTransport : webTransport);
