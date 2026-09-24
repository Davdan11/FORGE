"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { addDays, db, todayISO } from "@/lib/db";
import { addToSession } from "@/lib/engine/custom";
import { motion, AnimatePresence, Press } from "./motion";
import { Toast } from "./ui";
import type { Exercise } from "@/lib/types";
import { exName } from "@/lib/data/exercises";
import { loc, locale, tr, useLang, useT } from "@/lib/i18n";

/* "Add to training" for a library movement: pick one of the next two weeks'
   sessions and the engine prescribes it there like anything it chose itself
   (sets, reps and load from the current block and what has been lifted). */
export function AddToTraining({ ex }: { ex: Pick<Exercise, "slug" | "name"> }) {
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const t = useT();
  const lang = useLang();
  const name = exName(ex, lang);
  const today = todayISO();
  const sessions = useLiveQuery(
    () => db.sessions.where("date").between(today, addDays(today, 14), true, true).filter((s) => s.status !== "done" && s.status !== "skipped").sortBy("date"),
    [today],
  ) ?? [];

  async function add(id: string, label: string) {
    const r = await addToSession(id, ex.slug);
    setOpen(false);
    setToast(r === "added" ? tr(`Ajouté à ${label}`, `Added to ${label}`) : r === "already" ? tr(`Déjà dans ${label}`, `Already in ${label}`) : tr("Cette séance n’existe plus.", "That session no longer exists."));
    setTimeout(() => setToast(null), 3000);
  }
  const day = (iso: string) => (iso === today ? t("Aujourd’hui", "Today") : new Date(iso + "T00:00:00").toLocaleDateString(locale(), { weekday: "long", month: "short", day: "numeric" }));

  return (
    <>
      <Press><button type="button" className="pill pill--volt" onClick={() => setOpen(true)}>{t("+ Ajouter à l’entraînement", "+ Add to training")}</button></Press>
      <AnimatePresence>{open && (
        <motion.div className="fixed inset-0 z-[80] grid items-end lg:place-items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <button type="button" aria-label={t("Fermer", "Close")} className="absolute inset-0 bg-ink/45 backdrop-blur-[2px]" onClick={() => setOpen(false)} />
          <motion.div role="dialog" aria-modal="true" aria-label={t(`Ajouter ${name} à une séance`, `Add ${ex.name} to a session`)}
            initial={{ y: 40 }} animate={{ y: 0 }} exit={{ y: 40 }} transition={{ type: "spring", stiffness: 380, damping: 36 }}
            className="relative bg-carbon rounded-t-[28px] lg:rounded-[28px] w-full lg:max-w-[460px] max-h-[80dvh] overflow-y-auto p-5 pb-[calc(var(--safe-bottom)+20px)] grid gap-4 shadow-[0_-20px_60px_-20px_rgba(0,0,0,.35)]">
            <span className="mx-auto w-10 h-1 rounded-full bg-ink/15 lg:hidden" aria-hidden />
            <div className="grid gap-1">
              <span className="meta">{t("Ajouter à l’entraînement", "Add to training")}</span>
              <p className="display text-2xl leading-none">{name}</p>
              <p className="text-sm text-smoke">{t("Choisis une séance. Séries, reps et charge sont calculées selon ton bloc actuel, et le mouvement reste là si le plan est réécrit.", "Pick a session. Sets, reps and load are set from your current block, and it stays there if the plan is rewritten.")}</p>
            </div>
            {sessions.length === 0 ? (
              <p className="text-sm text-smoke card p-4">{t("Aucune séance dans les deux prochaines semaines. Ton plan commence à son premier lundi.", "No sessions in the next two weeks. Your plan starts on its first Monday.")}</p>
            ) : (
              <ul className="grid gap-2">
                {sessions.map((s) => {
                  const inIt = s.exercises.some((e) => e.slug === ex.slug);
                  return (
                    <li key={s.id}>
                      <button type="button" disabled={inIt} onClick={() => add(s.id, `${day(s.date)} · ${loc(s.title)}`)}
                        className="w-full card p-3.5 flex items-center gap-3 text-left disabled:opacity-60">
                        <span className="grid min-w-0 flex-1">
                          <span className="text-sm font-medium">{day(s.date)}</span>
                          <span className="text-xs text-smoke truncate">{loc(s.title)} · {s.minutes} min · {lang === "fr" ? `${s.exercises.length} mouvement${s.exercises.length <= 1 ? "" : "s"}` : `${s.exercises.length} movements`}</span>
                        </span>
                        <span className={`chip shrink-0 ${inIt ? "" : "chip--volt"}`}>{inIt ? t("Déjà là", "Already in") : t("Ajouter", "Add")}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            <button type="button" className="pill" onClick={() => setOpen(false)}>{t("Annuler", "Cancel")}</button>
          </motion.div>
        </motion.div>
      )}</AnimatePresence>
      <Toast text={toast} />
    </>
  );
}
