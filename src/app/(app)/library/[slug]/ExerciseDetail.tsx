"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { equipLabel, exName, exText, getExercise, muscleLabel, painAreaLabel, patternLabel } from "@/lib/data/exercises";
import { loc, locale, useLang, useT } from "@/lib/i18n";
import { exerciseImage } from "@/lib/data/images";
import { MoveMedia } from "@/components/MoveMedia";
import { db, getProfile } from "@/lib/db";
import { e1rm, fmtLoad } from "@/lib/units";
import { Screen, Section, Empty, Photo } from "@/components/ui";
import { Page, Stagger, Item, Reveal } from "@/components/motion";
import { AddToTraining } from "@/components/AddToTraining";

export function ExerciseDetail() {
  const { slug } = useParams<{ slug: string }>();
  const t = useT();
  const lang = useLang();
  const ex = getExercise(slug);
  const profile = useLiveQuery(() => getProfile(), []);
  const history = useLiveQuery(() => db.sets.where("slug").equals(slug).reverse().sortBy("at"), [slug]) ?? [];
  const upcoming = useLiveQuery(() => db.sessions.filter((x) => x.status !== "done" && x.exercises.some((e) => e.slug === slug)).sortBy("date"), [slug]) ?? [];
  if (!ex) return <Screen><Empty title={t("Introuvable", "Not found")} body={t("Cet exercice n’est pas encore dans la bibliothèque.", "That exercise isn’t in the library yet.")} cta={t("Retour à la bibliothèque", "Back to library")} href="/library" /></Screen>;
  const tx = exText(ex, lang);
  const ml = (m: Parameters<typeof muscleLabel>[0]) => (lang === "fr" ? muscleLabel(m, lang) : m.replace("_", " "));
  const best = history.reduce((a, s) => Math.max(a, s.loadKg && s.reps ? e1rm(s.loadKg, s.reps) : 0), 0);

  return (
    <Page>
      <Screen>
        <div className="bleed relative -mt-[calc(var(--safe-top)+16px)] lg:-mt-10 overflow-hidden mb-8 lg:mb-[var(--stack-section)] h-[460px] lg:h-auto lg:min-h-[72vh]">
          <MoveMedia ex={ex} fill />
          <div className="photo__veil photo__veil--hero" />
          <div className="on-photo absolute inset-x-0 top-0 pt-[calc(var(--safe-top)+16px)] lg:pt-8"><div className="screen flex justify-between items-start"><Link href="/library" className="chip chip--live backdrop-blur-md">{t("← Retour", "← Back")}</Link></div></div>
          <div className="on-photo absolute inset-x-0 bottom-0 pb-7 lg:pb-14">
            <div className="screen">
              <p className="eyebrow mb-5">{patternLabel(ex.pattern, lang)} · {ex.equipment.map((e) => equipLabel(e, lang)).join(" · ")}</p>
              <h1 className="display display--xl leading-[0.9] max-w-[14ch]" style={{ fontSize: "var(--text-display-xl)" }}>{tx.name}</h1>
              <div className="flex flex-wrap gap-1.5 mt-6">{ex.primary.map((m) => <span key={m} className="chip chip--volt">{muscleLabel(m, lang)}</span>)}{ex.secondary.map((m) => <span key={m} className="chip chip--live">{muscleLabel(m, lang)}</span>)}{ex.tempo && <span className="chip chip--live">{t("Tempo", "Tempo")} {ex.tempo}</span>}</div>
            </div>
          </div>
        </div>

        <Stagger className="xl:grid xl:grid-cols-[minmax(0,1fr)_var(--rail)] xl:gap-x-12 xl:items-start">
          <div className="min-w-0 xl:order-2">
          <Item>
            <Section title={t("Dans ton bloc", "In your block")} aside={<span className="text-xs text-smoke tnum">{lang === "fr" ? `${upcoming.length} séance${upcoming.length <= 1 ? "" : "s"}` : `${upcoming.length} session${upcoming.length === 1 ? "" : "s"}`}</span>}>
              <div className="mb-4"><AddToTraining ex={ex} /></div>
              {upcoming.length === 0 ? <p className="text-sm text-smoke mb-6">{t("Pas encore dans tes prochaines séances.", "Not in your coming sessions yet.")}</p> : (
                <ul className="card divide-y divide-line px-4 mb-6">{upcoming.slice(0, 4).map((x) => { const e = x.exercises.find((e) => e.slug === slug)!; const f = e.sets[0]; return (
                  <li key={x.id}><Link href={`/session?id=${x.id}`} className="py-3 flex items-center justify-between gap-3 text-sm"><span><span className="block font-medium">{loc(x.title)}</span><span className="text-xs text-smoke">{t("Semaine", "Week")} {x.week} · {new Date(x.date + "T00:00:00").toLocaleDateString(locale(), { weekday: "short", month: "short", day: "numeric" })}</span></span><span className="tnum text-xs text-smoke">{e.sets.length} × {f.reps ?? `${f.seconds}s`}{f.loadKg && profile ? ` · ${fmtLoad(f.loadKg, profile.units)}` : ""}</span></Link></li>); })}</ul>
              )}
            </Section>
            <Section title={t("Muscles", "Muscles")} aside={<span className="text-xs text-smoke">{t("principaux · secondaires", "primary · secondary")}</span>}>
              <div className="card p-4 grid gap-3">
                <div className="flex flex-wrap gap-1.5">{ex.primary.map((m) => <span key={m} className="chip chip--volt">{ml(m)}</span>)}{ex.secondary.map((m) => <span key={m} className="chip">{ml(m)}</span>)}</div>
                <p className="text-sm text-smoke">{ex.pillar === "mobility" ? t("L’amplitude d’abord, la charge ensuite : celui-ci te donne les positions dont tes levées ont besoin.", "Range first, load later: this one earns the positions your lifts need.") : ex.pattern === "cardio" ? t("Travail du moteur : cœur, poumons et jambes, dans la zone que le plan demande.", "Engine work: the heart, lungs and legs, at the zone the plan asks for.") : t(`Schéma : ${patternLabel(ex.pattern, lang)}. ${ex.primary.length > 1 ? "Plusieurs muscles se partagent la charge" : "Un muscle fait l’essentiel du travail"} ; la technique décide lequel.`, `A ${ex.pattern.replace("_", " ")} pattern. ${ex.primary.length > 1 ? "Several muscles share the load" : "One muscle does most of the work"}; technique decides who gets it.`)}</p>
              </div>
            </Section>
          </Item>
          </div>
          <div className="min-w-0 xl:order-1">
          <Item>
            <Section title={t("Consignes", "Cues")}>
              <ol className="grid gap-3">{tx.cues.map((c, i) => <li key={c} className="card p-3 flex gap-3 text-sm"><span className="display text-xl text-volt tnum w-6">{i + 1}</span>{c}</li>)}</ol>
            </Section>
          </Item>
          <Item>
            <Section title={t("Erreurs fréquentes", "Common faults")}>
              <ul className="grid gap-2">{tx.faults.map((f) => <li key={f} className="flex gap-3 text-sm text-smoke"><span className="text-danger">×</span>{f}</li>)}</ul>
              {ex.painFlags?.length ? <p className="text-xs text-smoke mt-3">{t(`Sollicite : ${ex.painFlags.map((a) => painAreaLabel(a, lang)).join(", ")}. Signale une douleur dans ton bilan et ce mouvement est remplacé automatiquement.`, `Loads the ${ex.painFlags.join(", ")}. Flag it in your check-in and this movement is swapped automatically.`)}</p> : null}
            </Section>
          </Item>
          <Item>
            <Section title={t("Substitutions", "Swaps")}>
              <div className="grid grid-cols-2 gap-2">{ex.swaps.map((s) => { const m = getExercise(s); if (!m) return null; return (
                <Link key={s} href={`/library/${s}`} className="card flex items-center gap-3 p-2"><Photo src={exerciseImage(m, 120, 120)} className="thumb !w-12 !h-12" /><span className="text-sm font-medium leading-tight">{exName(m, lang)}</span></Link>); })}</div>
            </Section>
          </Item>
          <Item>
            <Reveal>
              <Section title={t("Ton historique", "Your history")} aside={best && profile ? <span className="text-xs text-volt tnum">{t("Meilleur 1RM est.", "Best e1RM")} {fmtLoad(best, profile.units)}</span> : undefined}>
                {history.length === 0 ? <p className="text-sm text-smoke">{t("Aucune série notée encore — ça va apparaître ici après ta première séance avec ce mouvement.", "No sets logged yet — it’ll show up here after your first session with it.")}</p> : (
                  <ul className="grid divide-y divide-line">{history.slice(0, 12).map((s) => <li key={s.id} className="py-2 flex justify-between text-sm tnum"><span>{s.seconds ? `${s.seconds}s` : t(`${s.reps} reps`, `${s.reps} reps`)}{s.loadKg && profile ? ` · ${fmtLoad(s.loadKg, profile.units)}` : ""}</span><span className="text-smoke text-xs">RPE {s.rpe ?? "—"} · {s.at.slice(0, 10)}</span></li>)}</ul>
                )}
              </Section>
            </Reveal>
          </Item>
          </div>
        </Stagger>
      </Screen>
    </Page>
  );
}
