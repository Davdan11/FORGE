"use client";

import { parseHeartRate, parseCyclingPower, parseCsc, parseIndoorBike, type Reading, type Rev, type CscState } from "./ble-parse";

/* ─────────────────────────────────────────────────────────────
   Talking to the hardware.

   Web Bluetooth is a browser API with a hard edge: it does not
   exist in Safari, on any Apple device. Apple has never shipped
   it. That is not a bug to work around in JavaScript — on iPhone
   and iPad the PWA simply cannot see a trainer or a heart-rate
   strap, and the only way through is the native shell (Capacitor
   over CoreBluetooth).

   So this module's first job is to say so plainly, early, rather
   than let somebody press Connect and watch nothing happen.
   ───────────────────────────────────────────────────────────── */

export type SensorKind = "heart_rate" | "cycling_power" | "csc" | "fitness_machine";

/** Bluetooth SIG assigned numbers. */
const SERVICE: Record<SensorKind, number> = {
  heart_rate: 0x180d,
  cycling_power: 0x1818,
  csc: 0x1816,
  fitness_machine: 0x1826,
};

const CHARACTERISTIC: Record<SensorKind, number> = {
  heart_rate: 0x2a37,       // Heart Rate Measurement
  cycling_power: 0x2a63,    // Cycling Power Measurement
  csc: 0x2a5b,              // CSC Measurement
  fitness_machine: 0x2ad2,  // Indoor Bike Data
};

export const SENSOR_LABEL: Record<SensorKind, string> = {
  heart_rate: "Heart rate strap",
  cycling_power: "Power meter",
  csc: "Speed & cadence sensor",
  fitness_machine: "Smart trainer",
};

/* ── availability ─────────────────────────────────────────── */

export type Availability =
  | { ok: true }
  | { ok: false; reason: string; nativeWouldFix: boolean };

/**
 * Whether this browser can talk to a sensor at all, and if not, why — in
 * words that tell the person what to do rather than what failed.
 */
export function bluetoothAvailability(): Availability {
  if (typeof navigator === "undefined") return { ok: false, reason: "Not in a browser.", nativeWouldFix: false };

  if (!("bluetooth" in navigator)) {
    // Distinguish the two reasons it is missing, because the answers differ:
    // one is "use a different browser", the other is "this browser will never
    // have it, wait for the app".
    const ua = navigator.userAgent;
    const apple = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && "ontouchend" in document);
    const safari = /^((?!chrome|android|crios|fxios|edgios).)*safari/i.test(ua);
    if (apple || safari) {
      return {
        ok: false,
        nativeWouldFix: true,
        reason: "Safari has no Bluetooth support, on any Apple device. Sensors will work in the FORGE app once it ships to the App Store — in the browser, use Chrome on Android, Mac or Windows.",
      };
    }
    return { ok: false, nativeWouldFix: false, reason: "This browser has no Bluetooth support. Chrome, Edge or Opera will work." };
  }

  // Web Bluetooth needs a secure context. localhost counts, which is why it
  // works in development and then does not on a plain-http staging box.
  if (!window.isSecureContext) {
    return { ok: false, nativeWouldFix: false, reason: "Bluetooth needs a secure connection. Open the app over https." };
  }

  return { ok: true };
}

/* ── the live connection ──────────────────────────────────── */

export interface Sensor {
  kind: SensorKind;
  name: string;
  disconnect: () => void;
}

type MinimalCharacteristic = {
  startNotifications: () => Promise<unknown>;
  stopNotifications: () => Promise<unknown>;
  addEventListener: (t: string, fn: (e: Event) => void) => void;
  removeEventListener: (t: string, fn: (e: Event) => void) => void;
  value?: DataView;
};
type MinimalDevice = {
  name?: string;
  gatt?: { connect: () => Promise<{ getPrimaryService: (s: number) => Promise<{ getCharacteristic: (c: number) => Promise<MinimalCharacteristic> }> }>; connected: boolean; disconnect: () => void };
  addEventListener: (t: string, fn: () => void) => void;
};
type MinimalBluetooth = { requestDevice: (o: unknown) => Promise<MinimalDevice> };

/**
 * Ask the person to pick a sensor, then stream readings from it.
 *
 * The browser shows its own chooser here — the page never sees the list of
 * devices nearby, only the one that was picked. That is the API's design and
 * it is the right one: a page that could enumerate Bluetooth devices could
 * fingerprint a room.
 */
export async function connectSensor(
  kind: SensorKind,
  onReading: (r: Reading) => void,
  onDisconnect?: () => void,
): Promise<Sensor> {
  const available = bluetoothAvailability();
  if (!available.ok) throw new Error(available.reason);

  const bt = (navigator as unknown as { bluetooth: MinimalBluetooth }).bluetooth;
  const device = await bt.requestDevice({
    filters: [{ services: [SERVICE[kind]] }],
    // Many trainers also carry a heart-rate relay; asking for it up front
    // avoids a second pairing prompt later.
    optionalServices: [SERVICE.heart_rate],
  });

  const server = await device.gatt?.connect();
  if (!server) throw new Error("Could not connect to the sensor.");
  const service = await server.getPrimaryService(SERVICE[kind]);
  const characteristic = await service.getCharacteristic(CHARACTERISTIC[kind]);

  // Cumulative counters live across notifications; without holding them the
  // cadence and speed derived from them are never more than undefined.
  let crank: Rev | undefined;
  let csc: CscState | undefined;

  const handler = (e: Event) => {
    const v = (e.target as unknown as MinimalCharacteristic).value;
    if (!v) return;
    if (kind === "heart_rate") return onReading(parseHeartRate(v));
    if (kind === "fitness_machine") return onReading(parseIndoorBike(v));
    if (kind === "cycling_power") {
      const out = parseCyclingPower(v, crank);
      crank = out.crank ?? crank;
      return onReading(out);
    }
    const out = parseCsc(v, csc);
    csc = out.csc ?? csc;
    onReading(out);
  };

  characteristic.addEventListener("characteristicvaluechanged", handler);
  await characteristic.startNotifications();

  // A strap that slides off, a trainer unplugged mid-ride: the ride must
  // notice and say so, not sit there showing the last number it ever saw.
  device.addEventListener("gattserverdisconnected", () => onDisconnect?.());

  return {
    kind,
    name: device.name ?? SENSOR_LABEL[kind],
    disconnect: () => {
      characteristic.removeEventListener("characteristicvaluechanged", handler);
      characteristic.stopNotifications().catch(() => {});
      if (device.gatt?.connected) device.gatt.disconnect();
    },
  };
}

/* ── merging several sensors ──────────────────────────────── */

/**
 * What the ride actually reads from.
 *
 * Somebody can have a strap AND a trainer AND a cadence sensor, all reporting
 * at different rates and some of them overlapping. This holds the newest value
 * for each field and, crucially, forgets values that have gone stale — a heart
 * rate frozen at 148 because the strap died is worse than no heart rate, since
 * it keeps the avatar moving on a reading from four minutes ago.
 */
export class SensorFusion {
  private last: Record<keyof Reading, { value: number; at: number }> = Object.create(null);
  /** How long a reading stays believable, in ms. Straps send at 1 Hz; a gap
   *  of five seconds means something is wrong. */
  constructor(private staleMs = 5000) {}

  accept(r: Reading, now = Date.now()) {
    for (const [k, v] of Object.entries(r)) {
      if (typeof v === "number") this.last[k as keyof Reading] = { value: v, at: now };
    }
  }

  get(field: keyof Reading, now = Date.now()): number | undefined {
    const hit = this.last[field];
    if (!hit) return undefined;
    return now - hit.at <= this.staleMs ? hit.value : undefined;
  }

  /** True when nothing at all has been heard recently. */
  silent(now = Date.now()): boolean {
    return Object.values(this.last).every((h) => now - h.at > this.staleMs);
  }
}
