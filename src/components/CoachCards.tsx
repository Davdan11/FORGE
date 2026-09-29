"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, todayISO } from "@/lib/db";
import { coachSnapshot, previewCheckIn, applyCheckIn } from "@/lib/nutrition/coachStore";
import { checkTarget, goalTimeline, lowestHealthyKg } from "@/lib/nutrition/coach";
import { kgToLb, lbToKg } from "@/lib/units";
import { locale, useLang, useT } from "@/lib/i18n";
import { Section } from "@/components/ui";
import { Press } from "@/components/motion";
import type { Adherence, CoachCheckIn, Profile } from "@/lib/types";

/* The goal with its date, and the weekly check-in: the two cards that make
   the plan answer to the scale. Logic in lib/nutrition/coach.ts. */

const useWeight = (p: Profile | undefined) => {
  const lb = p?.units.weight === "lb";
  const show = (kg: number, digits = 1) => (lb ? `${(Math.round(kgToLb(kg) * 10 ** digits) / 10 ** digits).toLocaleString(locale())} lb` : `${(Math.round(kg * 10 ** digits) / 10 ** digits).toLocaleString(locale())} kg`);
  const signed = (kg: number) => `${kg > 0 ? "+" : kg < 0 ? "−" : "±"}${show(Math.abs(kg))}`;
  return { lb, show, signed, toKg: (v: number) => (lb ? lbToKg(v) : v), fromKg: (kg: number) => (lb ? kgToLb(kg) : kg) };
};
const longDate = (iso: string) => new Date(iso + "T12:00:00").toLocaleDateString(locale(), { day: "numeric", month: "long", year: "numeric" });

/** The target weight, the road to it and the date — or the question that sets it. */
export function GoalCard() {
  const t = useT(), lang = useLang();
  const snap = useLiveQuery(() => coachSnapshot(), []);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const p = snap?.profile;
  const w = useWeight(p);
  if (!snap || !p) return null;
  const movesScale = p.goal === "cut" || p.goal === "recomp" || p.goal === "build";
  if (!movesScale) return null;
  const now = snap.trendKg ?? p.weightKg;
  const target = p.targetWeightKg;

  const typed = Number(draft.replace(",", "."));
  const draftKg = typed > 0 ? w.toKg(typed) : null;
  const check = draftKg ? checkTarget({ ...p, weightKg: now }, draftKg) : null;
  const preview = draftKg && check?.ok ? goalTimeline({ ...p, targetWeightKg: draftKg, startWeightKg: now }, todayISO(), now) : null;
  const save = async () => {
    if (!draftKg || !check?.ok) return;
    await db.profile.update(p.id, { targetWeightKg: Math.round(draftKg * 10) / 10, ...(p.startWeightKg == null ? { startWeightKg: now } : {}), dirty: 1, updatedAt: new Date().toISOString() });
    setEditing(false); setDraft("");
  };

  if (!target || editing) {
    return (
      <Section title={t("Ton objectif", "Your goal")}>
        <div className="card p-4 grid gap-3">
          <p className="text-sm">{p.goal === "build" ? t("Combien tu veux peser au bout de ta prise de masse?", "What do you want to weigh at the end of the build?") : t("Combien tu veux peser? Le plan calcule le temps réaliste et la date où tu vas y arriver.", "What do you want to weigh? The plan works out a realistic time and the date you will get there.")}</p>
          <div className="flex gap-2 items-end">
            <label className="field flex-1"><span className="meta">{t("Poids visé", "Target weight")} ({w.lb ? "lb" : "kg"})</span>
              <input className="input tnum" inputMode="decimal" value={draft} placeholder={String(Math.round(w.fromKg(p.goal === "build" ? now + 4 : Math.max(lowestHealthyKg(p.heightCm), now - 7))))} onChange={(e) => setDraft(e.target.value)} />
            </label>
            <Press><button type="button" className="pill pill--volt" disabled={!preview} onClick={save}>{t("Fixer", "Set")}</button></Press>
          </div>
          {check && !check.ok && <p className="text-xs text-danger">{lang === "fr" ? check.fr : check.en}</p>}
          {preview && (
            <p className="text-sm">
              {t("Environ", "About")} <strong className="tnum">{preview.weeks} {t("semaines", "weeks")}</strong> · {t("arrivée vers le", "arriving around")} <strong>{longDate(preview.date)}</strong>
              <span className="text-smoke"> · {w.signed(preview.perWeekKg)} {t("par semaine au début", "a week to start")}</span>
              {preview.slow && <span className="block text-xs text-smoke mt-1">{t("C’est long à ce rythme. En perte de gras (« Perdre »), ça irait plus vite.", "That is slow at this pace. On a fat-loss goal (\"Cut\") it would go faster.")}</span>}
            </p>
          )}
          {editing && <button type="button" className="text-xs text-smoke underline justify-self-start" onClick={() => setEditing(false)}>{t("Annuler", "Cancel")}</button>}
        </div>
      </Section>
    );
  }

  const tl = snap.timeline;
  const start = p.startWeightKg ?? now;
  const done = tl ? tl.done : 1;
  return (
    <Section title={t("Ton objectif", "Your goal")} aside={<button type="button" className="text-xs text-smoke underline" onClick={() => { setDraft(String(Math.round(w.fromKg(target)))); setEditing(true); }}>{t("Changer", "Change")}</button>}>
      <div className="card p-4 grid gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <span className="display text-3xl tnum">{w.show(now)}</span>
          <span className="text-sm text-smoke">→ <strong className="text-ink tnum">{w.show(target)}</strong></span>
        </div>
        <div className="bar"><i style={{ width: `${Math.round(done * 100)}%` }} /></div>
        <div className="flex justify-between text-xs text-smoke tnum"><span>{t("Départ", "Start")} {w.show(start)}</span><span>{Math.round(done * 100)} %</span></div>
        {tl ? (
          <p className="text-sm">
            {t("Encore", "Still")} <strong className="tnum">{w.show(Math.abs(tl.toGoKg))}</strong> · {t("environ", "about")} <strong className="tnum">{tl.weeks} {t("semaines", "weeks")}</strong> · {t("arrivée prévue vers le", "on course for")} <strong>{longDate(tl.date)}</strong>.
            <span className="block text-xs text-smoke mt-1">{t("Le rythme ralentit un peu en chemin : un corps plus léger dépense moins. La date est recalculée à chaque pesée.", "The pace eases a little on the way: a lighter body burns less. The date is recalculated at every weigh-in.")}</span>
          </p>
        ) : (
          <p className="text-sm"><strong>{t("Objectif atteint.", "Goal reached.")}</strong> {t("On mange maintenant au maintien pour garder ce poids — c’est ce qui rend le résultat permanent.", "Now eating at maintenance to hold it — that is what makes the result last.")}</p>
        )}
      </div>
    </Section>
  );
}

const VERDICT: Record<CoachCheckIn["verdict"], { fr: string; en: string }> = {
  on_track: { fr: "Dans la cible. On ne touche à rien : ce qui marche, on le garde.", en: "On target. Nothing changes: what works, stays." },
  too_slow: { fr: "Ça avance moins vite que prévu. Ton corps ne dépense pas exactement ce que la formule prédisait, alors on ajuste la bouffe pour revenir au rythme.", en: "Slower than planned. Your body does not burn exactly what the formula predicted, so the food is adjusted to get back on pace." },
  too_fast: { fr: "Ça va plus vite que prévu. Trop vite, c’est du muscle qui part en perte, ou du gras qui s’ajoute en prise : on ajuste pour revenir au bon rythme.", en: "Faster than planned. Too fast costs muscle on a cut, or adds fat on a build: the food is adjusted back to the right pace." },
  no_data: { fr: "Pas assez de pesées pour mesurer ton rythme. Pèse-toi 3 matins par semaine (au réveil, après la toilette) et le coach ajustera au prochain bilan.", en: "Not enough weigh-ins to measure your pace. Weigh in 3 mornings a week (on waking, after the bathroom) and the coach adjusts at the next check-in." },
  off_plan: { fr: "Semaine difficile, ça arrive. On ne change rien aux calories : le plan n’a pas été testé cette semaine. Vise juste les repas principaux la semaine prochaine.", en: "A hard week happens. Calories stay as they are: the plan was not really tested. Aim for the main meals next week." },
  reached: { fr: "Objectif atteint et poids stable. On garde le maintien.", en: "Goal reached and weight steady. Holding maintenance." },
};

/** The weekly check-in: three taps, a verdict with the numbers, and what changes. */
export function WeeklyCheckIn() {
  const t = useT(), lang = useLang();
  const snap = useLiveQuery(() => coachSnapshot(), []);
  const [adherence, setAdherence] = useState<Adherence | null>(null);
  const [preview, setPreview] = useState<CoachCheckIn | null>(null);
  const [saved, setSaved] = useState<CoachCheckIn | null>(null);
  const p = snap?.profile;
  const w = useWeight(p);
  if (!snap || !p) return null;

  const pick = async (a: Adherence) => { setAdherence(a); setPreview(await previewCheckIn(a)); };
  const apply = async () => { if (!adherence) return; setSaved(await applyCheckIn(adherence)); setPreview(null); };
  const shown = saved ?? preview;

  if (snap.dueIn > 0 && !shown) {
    const last = snap.last;
    return (
      <Section title={t("Bilan de la semaine", "Weekly check-in")} aside={<span className="text-xs text-smoke">{t(`dans ${snap.dueIn} j`, `in ${snap.dueIn} d`)}</span>}>
        <div className="card p-4 grid gap-1.5 text-sm">
          {last ? <><span className="meta">{t("Dernier bilan", "Last check-in")} · {longDate(last.date)}</span><p>{lang === "fr" ? VERDICT[last.verdict].fr : VERDICT[last.verdict].en}</p>{last.deltaKcal !== 0 && <p className="text-xs text-smoke">{t(`Calories ${last.deltaKcal > 0 ? "+" : "−"}${Math.abs(last.deltaKcal)} kcal par jour depuis.`, `Calories ${last.deltaKcal > 0 ? "+" : "−"}${Math.abs(last.deltaKcal)} kcal a day since.`)}</p>}</>
            : <p>{t("Chaque semaine, ton coach regarde ta balance, tes séances et tes repas, puis ajuste ton plan. Pèse-toi 3 matins par semaine d’ici là.", "Every week your coach reads your scale, sessions and meals, then adjusts the plan. Weigh in 3 mornings a week until then.")}</p>}
        </div>
      </Section>
    );
  }

  return (
    <Section title={t("Bilan de la semaine", "Weekly check-in")}>
      <div className="card p-4 grid gap-3">
        {!shown && (<>
          <p className="text-sm">{t("Honnêtement, cette semaine, t’as suivi ton plan de repas…", "Honestly, this week, you followed your meal plan…")}</p>
          <div className="grid grid-cols-3 gap-2">
            {([["all", t("Presque tout", "Nearly all")], ["most", t("La plupart", "Mostly")], ["some", t("Pas vraiment", "Not really")]] as [Adherence, string][]).map(([a, label]) => (
              <button key={a} type="button" aria-pressed={adherence === a} className={`pill ${adherence === a ? "pill--volt" : ""}`} onClick={() => pick(a)}>{label}</button>
            ))}
          </div>
          <p className="text-xs text-smoke">{t("Aucune mauvaise réponse : le coach s’en sert pour savoir si c’est ton corps ou ta semaine qui a changé.", "No wrong answer: the coach uses it to tell whether your body or your week changed.")}</p>
        </>)}
        {shown && (<>
          <ul className="grid gap-2 text-sm">
            <li className="flex justify-between gap-3"><span className="text-smoke">{t("Poids (tendance)", "Weight (trend)")}</span><strong className="tnum">{shown.trendKg != null ? w.show(shown.trendKg) : "—"}</strong></li>
            <li className="flex justify-between gap-3"><span className="text-smoke">{t("Rythme réel", "Real pace")}</span><strong className="tnum">{shown.actualPerWeekKg != null ? `${w.signed(shown.actualPerWeekKg)} ${t("/ sem.", "/ wk")}` : "—"}</strong></li>
            <li className="flex justify-between gap-3"><span className="text-smoke">{t("Rythme prévu", "Planned pace")}</span><strong className="tnum">{w.signed(shown.expectedPerWeekKg)} {t("/ sem.", "/ wk")}</strong></li>
            {shown.sessionsPlanned > 0 && <li className="flex justify-between gap-3"><span className="text-smoke">{t("Séances", "Sessions")}</span><strong className="tnum">{shown.sessionsDone} / {shown.sessionsPlanned}</strong></li>}
            {shown.mealsPlanned > 0 && <li className="flex justify-between gap-3"><span className="text-smoke">{t("Repas cochés", "Meals ticked")}</span><strong className="tnum">{shown.mealsDone} / {shown.mealsPlanned}</strong></li>}
          </ul>
          {!(shown.atFloor && shown.deltaKcal === 0) && <p className="text-sm">{lang === "fr" ? VERDICT[shown.verdict].fr : VERDICT[shown.verdict].en}</p>}
          {shown.atFloor && <p className="text-sm card p-3 bg-[rgba(255,46,120,.10)]"><strong>{t("Tes calories sont à ton plancher sécuritaire.", "Your calories are at your safe floor.")}</strong> {t("Manger encore moins te ferait perdre du muscle. Pour avancer plus vite, ajoute du mouvement : 30 à 45 min de marche par jour (≈ 150–250 kcal), ou une séance de cardio de plus par semaine.", "Eating even less would cost muscle. To move faster, add movement: a 30–45 min walk a day (≈ 150–250 kcal), or one more cardio session a week.")}</p>}
          {shown.deltaKcal !== 0 && <p className="text-sm"><strong className="tnum">{shown.deltaKcal > 0 ? "+" : "−"}{Math.abs(shown.deltaKcal)} kcal {t("par jour", "a day")}</strong> <span className="text-smoke">{t("dès aujourd’hui, surtout en glucides et en gras; les protéines restent.", "from today, mostly carbs and fat; protein stays.")}</span></p>}
          {shown.sessionsPlanned > 0 && shown.sessionsDone < shown.sessionsPlanned && <p className="text-xs text-smoke">{t(`${shown.sessionsPlanned - shown.sessionsDone} séance(s) manquée(s) : le bilan de fin de bloc en tient compte pour la suite.`, `${shown.sessionsPlanned - shown.sessionsDone} session(s) missed: the end-of-block review accounts for it.`)}</p>}
          {!saved ? (
            <div className="flex gap-2">
              <Press><button type="button" className="pill pill--volt" onClick={apply}>{shown.deltaKcal !== 0 ? t("Appliquer", "Apply") : t("Enregistrer le bilan", "Save check-in")}</button></Press>
              <button type="button" className="pill" onClick={() => { setPreview(null); setAdherence(null); }}>{t("Retour", "Back")}</button>
            </div>
          ) : <p className="text-xs text-volt font-semibold">{t("Bilan enregistré. Prochain dans 7 jours.", "Check-in saved. Next one in 7 days.")}</p>}
        </>)}
      </div>
    </Section>
  );
}
