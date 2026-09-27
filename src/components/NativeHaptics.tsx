"use client";

import { useEffect } from "react";
import { isNativeShell } from "@/lib/native";

/* The app buzzes through navigator.vibrate everywhere (taps, rest timers, level ups). In the phone apps that call
   does nothing (iOS never had it, Android's WebView needs a permission it doesn't get), so there it is routed to the
   system's own haptics: a light tap for short buzzes, a real vibration for patterns and long ones. */
export function NativeHaptics() {
  useEffect(() => {
    if (!isNativeShell()) return;
    let cancelled = false;
    import("@capacitor/haptics").then(({ Haptics, ImpactStyle }) => {
      if (cancelled) return;
      const vibrate = (pattern: VibratePattern) => {
        const steps = Array.isArray(pattern) ? pattern : [pattern];
        const total = steps.filter((_, i) => i % 2 === 0).reduce((a, b) => a + b, 0);
        if (total <= 0) return true;
        if (steps.length === 1 && total <= 15) Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
        else if (steps.length === 1 && total <= 40) Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {});
        else Haptics.vibrate({ duration: Math.min(total, 600) }).catch(() => {});
        return true;
      };
      try { Object.defineProperty(navigator, "vibrate", { value: vibrate, configurable: true }); } catch { /* read-only: keep the browser's */ }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);
  return null;
}
