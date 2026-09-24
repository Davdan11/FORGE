"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ShieldAlert, TriangleAlert } from "lucide-react";
import { db, todayISO, uid } from "@/lib/db";
import { PAIN_LABEL } from "@/lib/engine/readiness";
import { AREA_LABEL, RED_FLAGS, adaptationFor, activeInjuries } from "@/lib/engine/injury";
import { rebuildRemaining } from "@/lib/engine/rebuild";
import { Section, RadioField } from "./ui";
import { Press } from "./motion";
import type { Injury, InjurySeverity, PainArea } from "@/lib/types";
import { tr, useLang, useT } from "@/lib/i18n";

const PHASE_LABEL = { protect: "Protecting", reload: "Reloading", return: "Returning", clear: "Clear" } as const;
const PHASE_FR = { protect: "Protection", reload: "Remise en charge", return: "Retour", clear: "Guéri" } as const;
const SEVERITY: { v: InjurySeverity; label: string; fr: string }[] = [
  { v: 1, label: "A niggle", fr: "Un petit bobo" },
  { v: 2, label: "Limits training", fr: "Limite l’entraînement" },
  { v: 3, label: "Limits daily life", fr: "Limite le quotidien" },
];
/* French for the engine's labels (lib/engine), picked at render time. */
const PAIN_FR: Record<PainArea, string> = { knee: "Genou", back: "Bas du dos", shoulder: "Épaule", hip: "Hanche", wrist: "Poignet", ankle: "Cheville", elbow: "Coude" };
const AREA_FR: Record<PainArea, string> = { knee: "genou", back: "bas du dos", shoulder: "épaule", hip: "hanche", wrist: "poignet", ankle: "cheville", elbow: "coude" };
/** Same order as RED_FLAGS. */
const RED_FLAGS_FR = [
  "Engourdissement, fourmillements ou faiblesse qui ne passent pas.",
  "Une douleur qui te réveille la nuit, ou qui est pire au repos qu’en mouvement.",
  "Tu ne peux pas mettre de poids dessus, ou l’articulation lâche.",
  "Enflure ou bleu qui continue d’empirer après 48 heures.",
  "Ça a commencé par une chute, un impact ou un « pop » soudain.",
];

/** Log an injury, report a flare-up, clear it when it settles. */
export function InjuryPanel({ onSay }: { onSay?: (t: string) => void }) {
  const injuries = useLiveQuery(() => db.injuries.toArray(), []) ?? [];
  const active = activeInjuries(injuries);
  const today = todayISO();
  const [adding, setAdding] = useState(false);
  const [area, setArea] = useState<PainArea>("knee");
  const [severity, setSeverity] = useState<InjurySeverity>(2);
  const t = useT();
  const lang = useLang();

  async function add() {
    const row: Injury = { id: uid(), area, severity, since: today };
    await db.injuries.put({ ...row, dirty: 1, updatedAt: new Date().toISOString() });
    setAdding(false);
    // The point of logging it is that the upcoming sessions change. Finished
    // sessions are left alone; only what hasn't happened yet is rewritten.
    await rebuildRemaining();
    onSay?.(tr(`${AREA_FR[area][0].toUpperCase() + AREA_FR[area].slice(1)} : noté. Le reste de ton bloc a été réécrit autour.`, `${AREA_LABEL[area]} logged. The rest of your block has been rewritten around it.`));
  }
  async function touch(id: string, patch: Partial<Injury>) {
    await db.injuries.update(id, { ...patch, dirty: 1, updatedAt: new Date().toISOString() });
    await rebuildRemaining();
  }

  return (
    <Section title={t("Blessures", "Injuries")} aside={!adding ? <button type="button" className="text-xs text-smoke underline" onClick={() => setAdding(true)}>{t("En noter une", "Log one")}</button> : undefined}>
      <div className="grid gap-3">
        {active.length === 0 && !adding && (
          <div className="card p-4 grid gap-1">
            <p className="text-sm font-medium">{t("Rien de signalé", "Nothing flagged")}</p>
            <p className="text-xs text-smoke">{t("Si quelque chose commence à faire mal, note-le ici. Le bloc continue — seuls les mouvements qui sollicitent cette zone sont mis de côté, et ils reviennent à mesure que ça se calme.", "If something starts hurting, log it here. The block keeps running — only the movements that load that area are held back, and they come back as it settles.")}</p>
          </div>
        )}

        {adding && (
          <div className="card p-4 grid gap-4">
            <RadioField label={t("Où", "Where")} value={area} onChange={setArea} options={(Object.keys(PAIN_LABEL) as PainArea[]).map((k) => ({ v: k, label: lang === "fr" ? PAIN_FR[k] : PAIN_LABEL[k] }))} />
            <RadioField label={t("À quel point ça te limite", "How much is it limiting you")} value={severity} onChange={setSeverity} options={SEVERITY.map((s) => ({ v: s.v, label: lang === "fr" ? s.fr : s.label }))} />
            <p className="text-xs text-smoke">{t("FORGE adapte ton entraînement autour. L’app ne pose aucun diagnostic et ne traite rien — si un des signes plus bas s’applique, consulte d’abord un professionnel.", "FORGE adapts your training around it. It doesn’t diagnose or treat anything — if any of the signs below apply, see a professional first.")}</p>
            <div className="flex gap-2">
              <Press><button type="button" className="pill pill--sm pill--bone" onClick={add}>{t("Noter", "Log it")}</button></Press>
              <button type="button" className="pill pill--sm" onClick={() => setAdding(false)}>{t("Annuler", "Cancel")}</button>
            </div>
          </div>
        )}

        {active.map((i) => {
          const a = adaptationFor(i, today);
          return (
            <div key={i.id} className="card overflow-hidden">
              <div className="p-4 grid gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className="meta flex items-center gap-1.5"><ShieldAlert className="w-3.5 h-3.5" strokeWidth={2} />{lang === "fr" ? PHASE_FR[a.phase] : PHASE_LABEL[a.phase]}</span>
                    <p className="display text-2xl mt-1 capitalize">{lang === "fr" ? AREA_FR[i.area] : AREA_LABEL[i.area]}</p>
                  </div>
                  <span className="chip tnum shrink-0">{lang === "fr" ? `${a.quietDays} jour${a.quietDays <= 1 ? "" : "s"} calme${a.quietDays <= 1 ? "" : "s"}` : `${a.quietDays} quiet day${a.quietDays === 1 ? "" : "s"}`}</span>
                </div>

                <div>
                  <div className="flex justify-between text-xs text-smoke mb-1.5 tnum">
                    <span>{t("Charge permise", "Load allowed")}</span><span>{Math.round(a.loadCap * 100)}%</span>
                  </div>
                  <span className="block h-[3px] rounded-full bg-[var(--line)]">
                    <span className="block h-full rounded-full bg-volt" style={{ width: `${Math.max(3, a.loadCap * 100)}%` }} />
                  </span>
                  {a.nextStepInDays != null && (
                    <p className="text-xs text-smoke mt-2">{a.nextStepInDays === 0 ? t("Prêt à monter d’un cran à ta prochaine séance.", "Ready to step up at your next session.") : lang === "fr" ? `Encore ${a.nextStepInDays} jour${a.nextStepInDays <= 1 ? "" : "s"} calme${a.nextStepInDays <= 1 ? "" : "s"} avant la prochaine étape.` : `${a.nextStepInDays} more quiet day${a.nextStepInDays === 1 ? "" : "s"} to the next step.`}</p>
                  )}
                </div>

                <ul className="grid gap-1.5 text-sm">{a.guidance.map((g) => <li key={g}>{g}</li>)}</ul>

                <div className="flex gap-2 flex-wrap">
                  <button type="button" className="pill pill--sm" onClick={async () => { await touch(i.id, { lastFlareAt: today }); onSay?.(tr("Poussée notée — la charge redescend et le bloc est réécrit.", "Flare-up noted — load steps back down and the block is rewritten.")); }}>{t("Ça a repris aujourd’hui", "It flared up today")}</button>
                  <button type="button" className="pill pill--sm" onClick={async () => { await touch(i.id, { resolvedAt: today }); onSay?.(tr(`${AREA_FR[i.area][0].toUpperCase() + AREA_FR[i.area].slice(1)} : guéri. La pleine charge revient pour les semaines qui restent.`, `${AREA_LABEL[i.area]} cleared. Full load returns to the remaining weeks.`)); }}>{t("Ça va mieux", "It’s better")}</button>
                </div>
              </div>

              <details className="border-t border-line">
                <summary className="px-4 py-3 text-xs flex items-center gap-2 cursor-pointer text-danger"><TriangleAlert className="w-3.5 h-3.5" strokeWidth={2} />{t("Quand arrêter et consulter un professionnel", "When to stop and see a professional")}</summary>
                <ul className="px-4 pb-4 grid gap-1.5 text-xs text-smoke">{RED_FLAGS.map((f, k) => <li key={f}>· {lang === "fr" ? RED_FLAGS_FR[k] ?? f : f}</li>)}</ul>
              </details>
            </div>
          );
        })}
      </div>
    </Section>
  );
}
