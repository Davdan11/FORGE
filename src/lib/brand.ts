/* ─────────────────────────────────────────────────────────────
   The name, and the promises that go with it, in one place.

   The app will be renamed before launch — FORGE is taken — so
   nothing on screen should spell it out by hand. Change it here.
   (The native app name lives in capacitor.config.ts, strings.xml
   and Info.plist; the web title in app/layout.tsx.)
   ───────────────────────────────────────────────────────────── */

export const APP_NAME = "FORGE";

/** Youngest age the app accepts. 13 is the US floor (COPPA); some EU
 *  countries set 16 for consent to data processing — check before launching there. */
export const MIN_AGE = 13;

/** Shown before the first plan is built, and in Settings. */
export const HEALTH_NOTICE =
  `${APP_NAME} gives general fitness and nutrition guidance. It is not medical advice and does not diagnose or treat anything. ` +
  "Check with a doctor before starting a new program — especially if you have a health condition, an injury, are pregnant, or haven’t exercised in a while. " +
  "Stop and get help if you feel chest pain, dizziness or sharp pain.";
