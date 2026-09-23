"use client";

import type { Reading } from "./ble-parse";
import { transport, type Availability, type ConnectOptions, type Sensor, type SensorKind } from "./transport";

export { SENSOR_LABEL, type Availability, type ConnectOptions, type Sensor, type SensorKind } from "./transport";

/* ─────────────────────────────────────────────────────────────
   What the ride reads from.

   The transport decides how bytes arrive — Web Bluetooth in a
   browser, CoreBluetooth or the Android stack inside the app.
   Nothing above this line needs to know which.
   ───────────────────────────────────────────────────────────── */

/** Whether a sensor can be reached at all, and if not, why — in words that
 *  say what to do rather than what failed. */
export const sensorAvailability = (): Promise<Availability> => transport().available();

/**
 * Ask the person to pick a sensor, then stream readings from it.
 *
 * Bounded, because the alternative is what the simulator does: no Bluetooth
 * hardware, so the native plugin's initialize never settles, the button looks
 * dead and nothing is ever said. Real pairing takes seconds and occasionally
 * fails the same silent way — a strap out of range, a trainer already claimed
 * by another app. A connect that cannot end is not a connect.
 */
export async function connectSensor(
  kind: SensorKind,
  onReading: (r: Reading) => void,
  onDisconnect?: () => void,
  /** For kind "trainer": the rider's mass, for trainers that simulate slope themselves. */
  opts?: ConnectOptions,
): Promise<Sensor> {
  return Promise.race([
    transport().connect(kind, onReading, onDisconnect, opts),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("No answer from Bluetooth. Check it is on, the sensor is awake, and no other app is holding it.")), CONNECT_TIMEOUT_MS),
    ),
  ]);
}

/** Long enough for a chooser, a pairing and a service discovery on a cold
 *  radio; short enough that a dead end is reported rather than waited on. */
const CONNECT_TIMEOUT_MS = 20_000;

/**
 * Several sensors at once, merged.
 *
 * Somebody can have a strap AND a trainer AND a cadence sensor, reporting at
 * different rates and overlapping. This holds the newest value for each field
 * and, crucially, forgets values that have gone stale — a heart rate frozen at
 * 148 because the strap died is worse than no heart rate, since it keeps the
 * avatar moving on a reading from four minutes ago.
 */
export class SensorFusion {
  private last: Record<keyof Reading, { value: number; at: number }> = Object.create(null);
  /** How long a reading stays believable, in ms. Straps send at 1 Hz; a gap of
   *  five seconds means something is wrong. */
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
