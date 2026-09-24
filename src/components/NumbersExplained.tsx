"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { explainTargets, projection, type DayType } from "@/lib/nutrition/science";
import { kgToLb } from "@/lib/units";
import type { Profile } from "@/lib/types";
import { motion, AnimatePresence } from "@/components/motion";
import { locale, useT } from "@/lib/i18n";

/**
 * "Why these numbers?" — the working behind the day's targets, step by step,
 * and what the scale should realistically do. Shown in Food and at the end of
 * onboarding, so nobody is handed a number without the reason for it.
 */
export function NumbersExplained({ profile, dayType, open: initiallyOpen = false }: { profile: Profile; dayType: DayType; open?: boolean }) {
  const [open, setOpen] = useState(initiallyOpen);
  const t = useT();
  const ex = explainTargets(profile, dayType);
  const proj = projection(profile);
  const lb = profile.units.weight === "lb";
  const w = (kg: number) => (lb ? `${Math.abs(Math.round(kgToLb(kg) * 10) / 10)} lb` : `${Math.abs(Math.round(kg * 10) / 10)} kg`);
  const losing = proj.perWeekKg < -0.05, gaining = proj.perWeekKg > 0.05;

  return (
    <div className="card overflow-hidden">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="w-full p-4 flex items-center gap-3 text-left">
        <span className="min-w-0 flex-1">
          <span className="meta block">{t("Pourquoi ces chiffres", "Why these numbers")}</span>
          <span className="text-sm font-semibold">
            {losing ? t(`Environ ${w(proj.perWeekKg)} de moins par semaine`, `About ${w(proj.perWeekKg)} a week, down`) : gaining ? t(`Environ ${w(proj.perWeekKg)} de plus par semaine`, `About ${w(proj.perWeekKg)} a week, up`) : t("Poids stable, du carburant pour t’entraîner", "Weight steady, fuel for training")}
            <span className="text-smoke font-normal"> · {ex.kcal.toLocaleString(locale())} {t("kcal aujourd’hui", "kcal today")}</span>
          </span>
        </span>
        <ChevronDown className={`w-5 h-5 text-smoke transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.35 }} className="overflow-hidden">
            <ol className="border-t border-line divide-y divide-line">
              {ex.steps.map((s, i) => (
                <li key={s.label} className="px-4 py-3 grid grid-cols-[28px_minmax(0,1fr)_auto] gap-x-3 gap-y-0.5 items-baseline">
                  <span className="meta text-volt font-bold">{String(i + 1).padStart(2, "0")}</span>
                  <span className="text-sm font-semibold">{s.label}</span>
                  <span className="text-sm font-bold tnum text-right">{s.value}</span>
                  <span className="col-start-2 col-span-2 text-xs text-smoke leading-relaxed">{s.why}</span>
                </li>
              ))}
            </ol>
            <div className="border-t border-line p-4 grid gap-1.5 bg-[rgba(198,244,50,.14)]">
              <span className="meta">{t("À quoi t’attendre", "What to expect")}</span>
              <p className="text-sm">
                {losing || gaining ? (
                  <>{t(`Dans ${proj.weeks} semaines, environ`, `In ${proj.weeks} weeks, about`)} <strong className="tnum">{w(Math.min(Math.abs(proj.lowKg), Math.abs(proj.highKg)))}–{w(Math.max(Math.abs(proj.lowKg), Math.abs(proj.highKg)))}</strong> {losing ? t("de moins", "down") : t("de plus", "up")}. {t(`La première semaine bouge plus (eau et glucides stockés); après, environ ${w(proj.perWeekKg)} par semaine, c’est dans la cible.`, `The first week moves more (water and stored carbs); after that, about ${w(proj.perWeekKg)} a week is on track.`)}</>
                ) : (
                  <>{t("Ton poids devrait rester stable à un kilo ou deux près. C’est ta force et ta forme qui bougent.", "Your weight should hold within a kilo or two. Strength and fitness are what move.")}</>
                )}
              </p>
              {proj.floored && <p className="text-xs text-smoke">{t("Ton alimentation est déjà à un plancher sécuritaire. Pour perdre plus vite, bouge plus (une marche par jour, une troisième séance) au lieu de manger moins.", "Your food is already at a safe floor. To lose faster, add movement — a daily walk, a third session — rather than eating less.")}</p>}
              <p className="text-[11px] text-smoke">{t("Pèse-toi une fois par semaine, même matin, même balance : le plan revérifie tes chiffres à chaque fois.", "Weigh in once a week, same morning, same scale: the plan re-checks your numbers every time.")}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
