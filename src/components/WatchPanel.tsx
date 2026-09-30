"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, getStats, todayISO } from "@/lib/db";
import { isConfigured, supabase } from "@/lib/supabase/client";
import { locale, useT } from "@/lib/i18n";
import {
  formatPairingCode, lastWatchPublish, myPairing, onWatchChange, publishWatchFeed, revokePairing, rotatePairing,
  WATCH_PUBLISH_GAP_MS, type WatchPairing,
} from "@/lib/watch";
import { Section } from "./ui";
import { Press } from "./motion";

/**
 * Keeps the watch feed fresh while it is mounted: publishes on mount, when the day's data changes
 * (a meal ticked, a session done, XP earned), when the app comes back to the front, and every few
 * minutes. publishWatchFeed() throttles itself (two minutes) and does nothing when signed out or
 * when no watch is paired, so this is cheap to mount anywhere (the app layout would suit it).
 */
export function WatchFeedSync() {
  const today = todayISO();
  // A small signature of what the watch shows; when it changes, the feed is sent again.
  const sig = useLiveQuery(async () => {
    const [s, n, st] = await Promise.all([db.sessions.where("date").equals(today).first(), db.nutrition.get(today), getStats()]);
    return [s?.id, s?.status, s?.minutes, n?.meals.map((m) => `${m.mealId}${m.done ? 1 : 0}`).join(","), n?.targets.kcal, st.xp, st.streakWeeks].join("|");
  }, [today]);
  const trailing = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (sig === undefined) return;
    void publishWatchFeed().then((r) => {
      // Throttled: try once more when the window reopens, so the last change is not lost.
      if (!r.ok && r.reason === "throttled") {
        if (trailing.current) clearTimeout(trailing.current);
        trailing.current = setTimeout(() => { void publishWatchFeed(); }, WATCH_PUBLISH_GAP_MS + 1000);
      }
    });
  }, [sig]);

  useEffect(() => {
    const onShow = () => { if (document.visibilityState === "visible") void publishWatchFeed(); };
    document.addEventListener("visibilitychange", onShow);
    const every = setInterval(() => { void publishWatchFeed(); }, 5 * 60 * 1000);
    return () => {
      document.removeEventListener("visibilitychange", onShow);
      clearInterval(every);
      if (trailing.current) clearTimeout(trailing.current);
    };
  }, []);

  return null;
}

const lastPublished = () => lastWatchPublish();

/* Settings → Garmin watch: the pairing code, the last time the watch data was sent, and how to set it up. */
export function WatchPanel() {
  const t = useT();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [pairing, setPairing] = useState<WatchPairing | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [confirmRotate, setConfirmRotate] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [missing, setMissing] = useState(false);
  const at = useSyncExternalStore(onWatchChange, lastPublished, () => null);

  const load = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase.auth.getSession();
    const inNow = !!data.session?.user;
    setSignedIn(inNow);
    if (!inNow) { setPairing(null); return; }
    try { setPairing(await myPairing()); setMissing(false); }
    catch { setPairing(null); setMissing(true); }
  }, []);

  useEffect(() => {
    if (!supabase) return;
    // Fires once at once (INITIAL_SESSION), then on every sign-in and sign-out. The load runs after the
    // callback returns: Supabase asks not to call it back from inside its own auth callback.
    const { data } = supabase.auth.onAuthStateChange(() => { setTimeout(() => { void load(); }, 0); });
    return () => data.subscription.unsubscribe();
  }, [load]);

  async function rotate() {
    setBusy(true); setNote(null); setConfirmRotate(false);
    try { setPairing(await rotatePairing()); setNote(t("Nouveau code prêt. Colle-le dans Garmin Connect.", "New code ready. Paste it in Garmin Connect.")); }
    catch (e) { setNote(t("Impossible de créer le code : ", "Could not create the code: ") + (e instanceof Error ? e.message : "")); }
    finally { setBusy(false); }
  }

  async function revoke() {
    setBusy(true); setNote(null); setConfirmRevoke(false);
    try { await revokePairing(); setPairing(null); setNote(t("Montre déjumelée. Elle ne reçoit plus rien.", "Watch unpaired. It no longer receives anything.")); }
    catch (e) { setNote(t("Échec : ", "Failed: ") + (e instanceof Error ? e.message : "")); }
    finally { setBusy(false); }
  }

  async function sendNow() {
    setBusy(true); setNote(null);
    const r = await publishWatchFeed({ force: true });
    setBusy(false);
    setNote(r.ok ? t("Envoyé à ta montre.", "Sent to your watch.") : r.reason === "signed_out" ? t("Connecte-toi d’abord.", "Sign in first.") : t("L’envoi a échoué. Réessaie plus tard.", "Sending failed. Try again later."));
  }

  async function copy(code: string) {
    try { await navigator.clipboard.writeText(code); setNote(t("Code copié.", "Code copied.")); }
    catch { setNote(t("Copie impossible : sélectionne le code à la main.", "Could not copy: select the code by hand.")); }
  }

  const when = at ? new Date(at).toLocaleString(locale(), { weekday: "short", hour: "2-digit", minute: "2-digit" }) : null;
  const code = pairing ? formatPairingCode(pairing.code) : null;

  return (
    <Section title={t("Montre Garmin", "Garmin watch")}>
      <div className="card p-4 grid gap-3">
        <p className="text-sm">{t(
          "Vois ta séance du jour, ton prochain repas (heure, calories, protéines), ton rang, tes XP, tes gemmes et ta série directement sur ta montre Garmin (Forerunner 165 et autres).",
          "See today’s session, your next meal (time, calories, protein), your rank, XP, gems and streak right on your Garmin watch (Forerunner 165 and others).")}</p>

        {!isConfigured ? (
          <p className="text-xs text-smoke">{t("Les comptes ne sont pas configurés dans cette version : la montre a besoin d’un compte FORGE.", "Accounts are not set up in this build: the watch needs a FORGE account.")}</p>
        ) : signedIn === false ? (
          <p className="text-xs text-smoke">{t("Connecte-toi (section Compte ci-dessus) pour jumeler ta montre.", "Sign in (Account section above) to pair your watch.")}</p>
        ) : signedIn === null || pairing === undefined ? (
          <p className="text-xs text-smoke">{t("Chargement…", "Loading…")}</p>
        ) : (
          <div className="grid gap-2">
            {code ? (
              <div className="grid gap-1">
                <p className="text-xs text-smoke">{t("Ton code de jumelage (garde-le pour toi : il ouvre ton résumé du jour)", "Your pairing code (keep it to yourself: it opens your day’s summary)")}</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <code className="display text-2xl tracking-widest select-all tnum">{code}</code>
                  <button type="button" className="pill pill--sm" onClick={() => copy(code)}>{t("Copier", "Copy")}</button>
                </div>
                <p className="text-xs text-smoke">
                  {when ? t(`Dernier envoi à la montre : ${when}`, `Last sent to the watch: ${when}`) : t("Rien d’envoyé encore.", "Nothing sent yet.")}
                  {pairing?.lastUsedAt ? t(` · lu par la montre : ${new Date(pairing.lastUsedAt).toLocaleString(locale(), { weekday: "short", hour: "2-digit", minute: "2-digit" })}`, ` · read by the watch: ${new Date(pairing.lastUsedAt).toLocaleString(locale(), { weekday: "short", hour: "2-digit", minute: "2-digit" })}`) : ""}
                </p>
              </div>
            ) : (
              <p className="text-xs text-smoke">{t("Aucune montre jumelée. Crée un code, puis colle-le dans Garmin Connect.", "No watch paired. Create a code, then paste it in Garmin Connect.")}</p>
            )}
            <div className="flex gap-2 flex-wrap">
              {!code && <Press><button type="button" disabled={busy} className="pill pill--sm pill--volt" onClick={rotate}>{t("Créer mon code", "Create my code")}</button></Press>}
              {code && <Press><button type="button" disabled={busy} className="pill pill--sm pill--bone" onClick={sendNow}>{t("Envoyer maintenant", "Send now")}</button></Press>}
              {code && !confirmRotate && <button type="button" disabled={busy} className="pill pill--sm" onClick={() => { setConfirmRotate(true); setConfirmRevoke(false); }}>{t("Nouveau code", "New code")}</button>}
              {code && !confirmRevoke && <button type="button" disabled={busy} className="pill pill--sm" onClick={() => { setConfirmRevoke(true); setConfirmRotate(false); }}>{t("Déjumeler", "Unpair")}</button>}
            </div>
            {confirmRotate && (
              <div className="grid gap-2">
                <p className="text-xs">{t("L’ancien code arrêtera de marcher tout de suite : il faudra coller le nouveau dans Garmin Connect.", "The old code stops working at once: you will need to paste the new one in Garmin Connect.")}</p>
                <div className="flex gap-2"><button type="button" className="pill pill--sm pill--bone" onClick={rotate}>{t("Oui, nouveau code", "Yes, new code")}</button><button type="button" className="pill pill--sm" onClick={() => setConfirmRotate(false)}>{t("Annuler", "Cancel")}</button></div>
              </div>
            )}
            {confirmRevoke && (
              <div className="grid gap-2">
                <p className="text-xs">{t("Le code et le résumé envoyé seront effacés. La montre n’affichera plus rien de neuf.", "The code and the sent summary will be erased. The watch will show nothing new.")}</p>
                <div className="flex gap-2"><button type="button" className="pill pill--sm pill--bone" onClick={revoke}>{t("Oui, déjumeler", "Yes, unpair")}</button><button type="button" className="pill pill--sm" onClick={() => setConfirmRevoke(false)}>{t("Annuler", "Cancel")}</button></div>
              </div>
            )}

          </div>
        )}

        {missing && <p className="text-xs text-smoke">{t("Le jumelage n’est pas encore activé sur le serveur (supabase/watch.sql à exécuter).", "Pairing is not set up on the server yet (supabase/watch.sql must be run).")}</p>}
        {note && <p className="text-xs text-smoke" role="status">{note}</p>}

        <details className="grid gap-2">
          <summary className="text-sm font-medium cursor-pointer">{t("Comment l’installer (5 minutes)", "How to set it up (5 minutes)")}</summary>
          <ol className="text-xs text-smoke grid gap-1.5 list-decimal pl-4 mt-2">
            <li>{t("Installe l’app FORGE sur ta montre : depuis le Connect IQ Store quand elle y sera publiée, ou pour l’instant par câble USB (voir le guide du projet FORGE-watch).", "Install the FORGE app on your watch: from the Connect IQ Store once it is published there, or for now over USB (see the FORGE-watch project guide).")}</li>
            <li>{t("Ici, touche « Créer mon code » et copie-le.", "Here, tap “Create my code” and copy it.")}</li>
            <li>{t("Ouvre l’app Garmin Connect sur ton téléphone → Appareils Garmin → ta montre → Activités et applications (ou Applications Connect IQ) → FORGE → Paramètres.", "Open the Garmin Connect app on your phone → Garmin Devices → your watch → Activities & Apps (or Connect IQ Apps) → FORGE → Settings.")}</li>
            <li>{t("Colle le code dans « Code de jumelage » et enregistre. Les tirets et les majuscules n’ont pas d’importance.", "Paste the code in “Pairing code” and save. Dashes and capitals don’t matter.")}</li>
            <li>{t("Sur la montre, ouvre FORGE (ou son aperçu dans la liste des widgets). Garde le Bluetooth du téléphone actif : la montre passe par Garmin Connect pour lire tes données.", "On the watch, open FORGE (or its glance in the widget list). Keep the phone’s Bluetooth on: the watch reads your data through Garmin Connect.")}</li>
            <li>{t("La montre se met à jour à l’ouverture et environ toutes les 30 minutes. Pour forcer : « Envoyer maintenant » ici, puis le bouton Start sur la montre.", "The watch refreshes when opened and about every 30 minutes. To force it: “Send now” here, then the Start button on the watch.")}</li>
          </ol>
          <p className="text-xs text-smoke mt-2">{t(
            "Rappels sur la montre : les notifications de FORGE (repas, séance) s’affichent aussi sur ta montre. Dans Garmin Connect → Appareils Garmin → ta montre → Notifications et alertes → Notifications des applications, active FORGE.",
            "Reminders on the watch: FORGE’s notifications (meals, session) also show on your watch. In Garmin Connect → Garmin Devices → your watch → Notifications & Alerts → App Notifications, turn on FORGE.")}</p>
        </details>
      </div>
    </Section>
  );
}
