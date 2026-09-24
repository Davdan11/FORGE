/* ─────────────────────────────────────────────────────────────
   The name, and the promises that go with it, in one place.

   The app will be renamed before launch — FORGE is taken — so
   nothing on screen should spell it out by hand. Change it here.
   (The native app name lives in capacitor.config.ts, strings.xml
   and Info.plist; the web title in app/layout.tsx.)
   ───────────────────────────────────────────────────────────── */

export const APP_NAME = "FORGE";

/** Youngest age the app accepts outside Europe: the US floor (COPPA). */
export const MIN_AGE = 13;
/** In the EU/EEA and Switzerland. GDPR lets each country set its own age of
 *  digital consent between 13 and 16; taking the highest everywhere there is
 *  the one answer that is right in every one of them. */
export const MIN_AGE_EUROPE = 16;

const EEA = new Set(["AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE", "IS", "LI", "NO", "CH"]);
/** Time zones inside the EEA and Switzerland. The UK (13) and non-EU Europe are left out. */
const EEA_ZONES = new Set([
  "Europe/Vienna", "Europe/Brussels", "Europe/Sofia", "Europe/Zagreb", "Asia/Nicosia", "Asia/Famagusta", "Europe/Nicosia", "Europe/Prague",
  "Europe/Copenhagen", "Europe/Tallinn", "Europe/Helsinki", "Europe/Mariehamn", "Europe/Paris", "Europe/Berlin", "Europe/Busingen", "Europe/Athens",
  "Europe/Budapest", "Europe/Dublin", "Europe/Rome", "Europe/Riga", "Europe/Vilnius", "Europe/Luxembourg", "Europe/Malta", "Europe/Amsterdam",
  "Europe/Warsaw", "Europe/Lisbon", "Atlantic/Madeira", "Atlantic/Azores", "Europe/Bucharest", "Europe/Bratislava", "Europe/Ljubljana",
  "Europe/Madrid", "Africa/Ceuta", "Atlantic/Canary", "Europe/Stockholm", "Atlantic/Reykjavik", "Europe/Vaduz", "Europe/Oslo", "Europe/Zurich",
]);

/**
 * The youngest age accepted where this phone is. Either signal is enough —
 * the language region (fr-FR) or the clock's time zone (Europe/Paris) — so
 * an American phone set up in Berlin still gets the European rule.
 */
export function minimumAge(locale?: string, timeZone?: string): number {
  const tag = locale ?? (typeof navigator !== "undefined" ? navigator.language : "");
  const region = (tag.split(/[-_]/)[1] ?? "").toUpperCase();
  let zone = timeZone;
  if (zone === undefined) { try { zone = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { zone = ""; } }
  return EEA.has(region) || EEA_ZONES.has(zone ?? "") ? MIN_AGE_EUROPE : MIN_AGE;
}

/**
 * Who stands behind the app, for the privacy policy and the terms.
 *
 * `draft` stays true until every bracketed value is filled in AND a lawyer
 * has read both documents: while it is true, both pages say so at the top.
 */
export const LEGAL = {
  draft: true,
  company: "[COMPANY LEGAL NAME]",
  address: "[MAILING ADDRESS]",
  email: "[PRIVACY CONTACT EMAIL]",
  effective: "[EFFECTIVE DATE]",
  governingLaw: "[STATE / PROVINCE AND COUNTRY]",
  /** Where the Supabase project stores data (Project Settings → General). */
  dataRegion: "[DATA REGION, e.g. United States (us-east-1)]",
};

/** Shown before the first plan is built, and in Settings. */
export const HEALTH_NOTICE: { fr: string; en: string } = {
  fr:
    `${APP_NAME} donne des conseils généraux d’entraînement et de nutrition. Ce n’est pas un avis médical : l’app ne pose aucun diagnostic et ne traite rien. ` +
    "Parles-en à un médecin avant de commencer un nouveau programme — surtout si tu as un problème de santé, une blessure, si tu es enceinte ou si ça fait longtemps que tu ne t’es pas entraîné·e. " +
    "Arrête et va chercher de l’aide si tu ressens une douleur à la poitrine, un étourdissement ou une douleur vive.",
  en:
    `${APP_NAME} gives general fitness and nutrition guidance. It is not medical advice and does not diagnose or treat anything. ` +
    "Check with a doctor before starting a new program — especially if you have a health condition, an injury, are pregnant, or haven’t exercised in a while. " +
    "Stop and get help if you feel chest pain, dizziness or sharp pain.",
};
