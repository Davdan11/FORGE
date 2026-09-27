"use client";

import { useState, useSyncExternalStore } from "react";
import { connectHealth, disconnectHealth, healthConnected, healthSupported, healthToday, syncHealth } from "@/lib/health";
import { useT } from "@/lib/i18n";
import { Press } from "./motion";

const noop = () => () => {};

/* Settings → Connected apps. On the phone apps: Health Connect / Apple Health (steps, sleep, and the workouts a
   watch or another app recorded). On the web: how to bring an activity in from Strava or Garmin Connect. */
export function HealthPanel() {
  const t = useT();
  const native = useSyncExternalStore(noop, healthSupported, () => false);
  const [on, setOn] = useState(() => (typeof window !== "undefined" ? healthConnected() : false));
  const [note, setNote] = useState<string | null>(null);
  const day = on ? healthToday() : null;
  const store = typeof navigator !== "undefined" && /iphone|ipad/i.test(navigator.userAgent) ? "Apple Santé" : "Santé Connect";
  const storeEn = store === "Apple Santé" ? "Apple Health" : "Health Connect";

  async function connect() {
    setNote(null);
    try {
      const r = await connectHealth();
      if (!r.ok) { setNote(t("Santé Connect n’est pas installé sur ce téléphone. Installe « Santé Connect » depuis le Play Store, puis réessaie.", "Health Connect isn’t installed on this phone. Install “Health Connect” from the Play Store, then try again.")); return; }
      setOn(true);
      const n = await syncHealth();
      setNote(n ? t(`${n} entraînement${n > 1 ? "s" : ""} importé${n > 1 ? "s" : ""}.`, `${n} workout${n > 1 ? "s" : ""} imported.`) : t("Connecté. Rien de nouveau à importer.", "Connected. Nothing new to import."));
    } catch { setNote(t("La connexion a été refusée ou a échoué.", "Access was refused or failed.")); }
  }

  if (!native) return (
    <div className="card p-4 grid gap-1.5">
      <p className="text-sm font-medium">{t("Strava, Garmin, ta montre", "Strava, Garmin, your watch")}</p>
      <p className="text-xs text-smoke">{t("Exporte une sortie en GPX (Strava, la plupart des montres) ou en TCX (Garmin Connect), puis Bouge → « Importer une sortie ». Dans l’app sur téléphone, FORGE lit aussi directement Santé Connect et Apple Santé.", "Export an activity as GPX (Strava, most watches) or TCX (Garmin Connect), then Move → “Import an activity”. In the phone app, FORGE also reads Health Connect and Apple Health directly.")}</p>
    </div>
  );
  return (
    <div className="card p-4 grid gap-3">
      <div className="grid gap-0.5">
        <p className="text-sm font-medium">{t(store, storeEn)}</p>
        <p className="text-xs text-smoke">{t("Tes pas, ton sommeil et les entraînements de ta montre ou d’autres apps (Garmin, Strava, Samsung…) arrivent dans FORGE. Lecture seulement : FORGE n’écrit rien.", "Your steps, sleep and the workouts from your watch or other apps (Garmin, Strava, Samsung…) come into FORGE. Read only: FORGE writes nothing.")}</p>
        {day && <p className="text-xs"><strong>{day.steps?.toLocaleString() ?? "—"}</strong> {t("pas aujourd’hui", "steps today")}{day.sleepMin ? <> · <strong>{Math.floor(day.sleepMin / 60)} h {String(day.sleepMin % 60).padStart(2, "0")}</strong> {t("de sommeil", "of sleep")}</> : null}</p>}
      </div>
      <div className="flex gap-2">
        {on
          ? <><Press><button type="button" className="pill pill--sm pill--bone" onClick={async () => { const n = await syncHealth(); setNote(n ? t(`${n} nouveau${n > 1 ? "x" : ""}.`, `${n} new.`) : t("À jour.", "Up to date.")); }}>{t("Synchroniser", "Sync now")}</button></Press><button type="button" className="pill pill--sm" onClick={() => { disconnectHealth(); setOn(false); }}>{t("Déconnecter", "Disconnect")}</button></>
          : <Press><button type="button" className="pill pill--sm pill--volt" onClick={connect}>{t(`Connecter ${store}`, `Connect ${storeEn}`)}</button></Press>}
      </div>
      {note && <p className="text-xs text-smoke" role="status">{note}</p>}
    </div>
  );
}
