"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { connectSensor, sensorAvailability, type Sensor } from "@/lib/indoor/sensors";
import { tr } from "@/lib/i18n";

/* A heart-rate strap or watch for an outdoor activity. Same Bluetooth path as
   the indoor rides (the standard Heart Rate service every strap and most
   watches broadcast), so anything that works indoors works here. */

/** A reading older than this is a strap that stopped talking, not a heartbeat. */
const STALE_MS = 5000;

export function useHeartRate() {
  const [sensor, setSensor] = useState<Sensor | null>(null);
  const [bpm, setBpm] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const last = useRef<{ bpm: number; at: number } | null>(null);

  const connect = useCallback(async () => {
    setError(null);
    const a = await sensorAvailability();
    if (!a.ok) { setError(a.reason); return; }
    setBusy(true);
    try {
      const s = await connectSensor("heart_rate", (r) => {
        if (r.hr == null || r.hr < 30 || r.hr > 230) return;
        last.current = { bpm: r.hr, at: Date.now() };
        setBpm(r.hr);
      }, () => { setSensor(null); setBpm(null); last.current = null; setError(tr("Cardio déconnecté.", "Heart rate disconnected.")); });
      setSensor(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : tr("Connexion impossible.", "Couldn't connect."));
    } finally {
      setBusy(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    sensor?.disconnect();
    setSensor(null); setBpm(null); last.current = null;
  }, [sensor]);

  /** The current heart rate if it is recent, otherwise null. */
  const fresh = useCallback(() => (last.current && Date.now() - last.current.at < STALE_MS ? last.current.bpm : null), []);

  // Let go of the strap when the screen goes away.
  useEffect(() => () => { sensor?.disconnect(); }, [sensor]);

  return { sensor, bpm, busy, error, connect, disconnect, fresh };
}
