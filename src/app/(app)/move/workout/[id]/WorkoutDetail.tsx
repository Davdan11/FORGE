"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { WORKOUT_MAP, ZONE_LABEL, ZONE_TALK, expandSegments, localizeWorkout } from "@/lib/data/workouts";
import { Screen, Hero, Section, Empty } from "@/components/ui";
import { Page, Stagger, Item, Press } from "@/components/motion";
import { SegmentBar, sportName, WORKOUT_KIND_FR, ZONE_LABEL_FR, ZONE_TALK_FR } from "@/components/move-bits";
import { useLang, useT } from "@/lib/i18n";
import { fmtDuration } from "@/lib/units";

export function WorkoutDetail() {
  const { id } = useParams<{ id: string }>();
  const t = useT();
  const lang = useLang();
  const zl = (z: number) => (lang === "fr" ? ZONE_LABEL_FR[z] : ZONE_LABEL[z]);
  const w0 = WORKOUT_MAP[id];
  if (!w0) return <Screen><Empty title={t("Introuvable", "Not found")} body={t("Cet entraînement n’est pas dans la bibliothèque.", "That workout isn't in the library.")} cta={t("Retour à Bouger", "Back to Move")} href="/move" /></Screen>;
  const w = localizeWorkout(w0, lang);
  const segs = expandSegments(w);
  const byZone = [1, 2, 3, 4, 5].map((z) => ({ z, sec: segs.filter((s) => s.zone === z).reduce((a, s) => a + s.seconds, 0) })).filter((x) => x.sec > 0);
  const total = segs.reduce((a, s) => a + s.seconds, 0);
  return (
    <Page>
      <Screen>
        <Hero image={w.image} height="h-[380px]" back="/move" eyebrow={lang === "fr" ? `${sportName(w.type, lang).toLowerCase()} · ${WORKOUT_KIND_FR[w.kind] ?? w.kind} · ${w.level === "new" ? "débutant" : w.level === "intermediate" ? "intermédiaire" : "avancé"}` : `${w.type} · ${w.kind} · ${w.level === "new" ? "beginner" : w.level}`} title={<>{w.name.split(" · ")[0]}<br /><em>{w.name.split(" · ")[1] ?? `${w.minutes} min`}</em></>}>
          <div className="flex flex-wrap gap-1.5 mt-3"><span className="chip chip--volt">Zone {w.zone} · {zl(w.zone)}</span><span className="chip chip--live backdrop-blur-md">{w.minutes} min</span><span className="chip chip--live backdrop-blur-md">{segs.length} {t("segments", "segments")}</span></div>
        </Hero>
        <Stagger>
          <Item><Press><Link href={`/move?workout=${w.id}`} className="pill pill--volt pill--block pill--lg mb-6">{t("Lancer en guidé · GPS activé", "Start guided · GPS on")}</Link></Press></Item>
          <Item><p className="text-sm mb-6">{w.description}</p></Item>
          <Item>
            <Section title={t("Structure", "Structure")} aside={<span className="text-xs text-smoke tnum">{fmtDuration(total)}</span>}>
              <div className="card p-4 grid gap-4">
                <SegmentBar segments={segs} />
                <ul className="grid divide-y divide-line">
                  {w.segments.map((s, i) => (
                    <li key={i} className="py-3 grid grid-cols-[52px_1fr_auto] gap-3 items-start text-sm">
                      <span className="chip justify-self-start" style={{ background: `rgba(31,199,111,${[0, .18, .32, .5, .7, 1][s.zone]})`, color: "var(--ink)", borderColor: "transparent" }}>Z{s.zone}</span>
                      <span><span className="block font-medium">{s.label}{s.repeat ? ` × ${s.repeat}` : ""}</span><span className="text-xs text-smoke">{s.cue}</span></span>
                      <span className="tnum text-xs text-smoke">{fmtDuration(s.seconds)}{s.repeat ? ` ×${s.repeat}` : ""}</span>
                    </li>
                  ))}
                </ul>
                <div className="grid gap-1.5">
                  {byZone.map((b) => <div key={b.z} className="grid grid-cols-[96px_1fr_44px] items-center gap-2 text-xs"><span className="text-smoke">Z{b.z} {zl(b.z)}</span><div className="bar"><i style={{ width: `${(b.sec / total) * 100}%` }} /></div><span className="tnum text-right">{Math.round(b.sec / 60)} min</span></div>)}
                </div>
              </div>
            </Section>
          </Item>
          <Item>
            <Section title={t("Pourquoi cette séance", "Why this session")}>
              <div className="card p-4 flex gap-3"><span className="display text-volt text-2xl">!</span><p className="text-sm">{w.why}</p></div>
            </Section>
          </Item>
          <Item>
            <Section title={t("Consignes", "Cues")}>
              <ol className="grid gap-2">{w.cues.map((c, i) => <li key={c} className="card p-3 flex gap-3 text-sm"><span className="display text-xl text-volt tnum w-6">{i + 1}</span>{c}</li>)}</ol>
            </Section>
          </Item>
          <Item>
            <Section title={t("Guide des zones", "Zone guide")}>
              <ul className="grid gap-1.5 text-xs">{[1, 2, 3, 4, 5].map((z) => <li key={z} className={`flex justify-between py-1.5 border-b border-line ${z === w.zone ? "text-bone" : "text-smoke"}`}><span>Z{z} · {zl(z)}</span><span>{lang === "fr" ? ZONE_TALK_FR[z] : ZONE_TALK[z]}</span></li>)}</ul>
            </Section>
          </Item>
        </Stagger>
      </Screen>
    </Page>
  );
}
