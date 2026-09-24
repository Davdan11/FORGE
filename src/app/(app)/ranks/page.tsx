"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { RewardsSection } from "@/components/RewardsSection";
import type { Campaign } from "@/lib/rewards";
import { Gift, Lock } from "lucide-react";
import { getStats, getProfile } from "@/lib/db";
import { LEVELS_PER_TIER, SUB_RANKS, TIERS, levelFromXp, nextRewardFor, rewardItem, rewardNote, subRankFor, tierForLevel, tierName, xpToReach } from "@/lib/gamification";
import { useLang, useT } from "@/lib/i18n";

import { RankEmblem } from "@/components/RankEmblem";
import { Screen, Hero, Section, ScreenSkeleton } from "@/components/ui";
import { Page, Stagger, Item, CountUp } from "@/components/motion";
import { IMG } from "@/lib/data/images";

/** Levels per sub-rank: ten levels a tier, five sub-ranks. */
const PER_SUB = LEVELS_PER_TIER / SUB_RANKS.length;

export default function RanksPage() {
  const stats = useLiveQuery(() => getStats(), []);
  const profile = useLiveQuery(() => getProfile(), []);
  // The owner's campaigns, once loaded: they replace the built-in tier gifts.
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  const t = useT();
  const lang = useLang();
  if (!stats || !profile) return <ScreenSkeleton />;
  const loc = lang === "fr" ? "fr-CA" : "en-US";

  const lvl = levelFromXp(stats.xp);
  const tier = tierForLevel(lvl.level);
  const sub = subRankFor(lvl.level);
  const next = nextRewardFor(lvl.level, stats.xp);

  return (
    <Page>
      <Screen>
        <Hero image={IMG.dark} height="h-[380px]" back="/progress"
          eyebrow={t(`Niveau ${lvl.level} sur 70 · ${stats.xp.toLocaleString(loc)} XP gagnés`, `Level ${lvl.level} of 70 · ${stats.xp.toLocaleString("en-US")} XP earned`)}
          title={<>{tierName(tier, lang)}<br /><em className="slab">{sub}.</em></>}
          stats={[
            { label: t("Niveau", "Level"), value: lvl.level },
            { label: t("Dans ce niveau", "Into this level"), value: `${Math.round((lvl.into / lvl.need) * 100)}%` },
            ...(next ? [{ label: t("Prochaine récompense", "To next reward"), value: t(`${next.levelsAway} niv.`, `${next.levelsAway} lvl`) }] : []),
          ]} />

        <Stagger className="xl:grid xl:grid-cols-[minmax(0,1fr)_var(--rail)] xl:gap-x-12 xl:items-start">
          <div className="min-w-0">
            <Item><RewardsSection onCampaigns={setCampaigns} /></Item>
            <Item>
              <Section title={t("L’échelle", "The ladder")} aside={<span className="text-xs text-smoke">{t("sept paliers · soixante-dix niveaux", "seven tiers · seventy levels")}</span>}>
                <ul className="grid gap-3">
                  {TIERS.map((tk) => {
                    const reached = lvl.level >= tk.from;
                    const current = tk.key === tier.key;
                    const last = tk.from + LEVELS_PER_TIER - 1;
                    return (
                      <li key={tk.key} className={`card p-4 grid gap-4 ${current ? "border-volt" : ""}`}>
                        <div className="flex items-center gap-4">
                        <RankEmblem tier={tk} sub={current ? sub : undefined} size={64} locked={!reached} className="shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline gap-2 flex-wrap">
                            <span className="display text-xl">{tierName(tk, lang)}</span>
                            {current && <span className="chip chip--volt">{t("T’es ici", "You are here")}</span>}
                          </div>
                          <p className="text-xs text-smoke tnum mt-0.5">
                            {t("Niveaux", "Levels")} {tk.from}–{last} · {xpToReach(tk.from).toLocaleString(loc)} {t("XP pour entrer", "XP to enter")}
                          </p>
                          {(() => {
                            const c = campaigns?.find((x) => x.rule_type === "rank" && x.rule_value.split(":")[0] === tk.key);
                            if (!c) return null;
                            return (
                              <p className="text-sm mt-2 flex items-center gap-3">
                                {c.image_url ? <img src={c.image_url} alt="" className="w-12 h-12 rounded-xl object-cover shrink-0" /> : <Gift className="w-5 h-5 text-volt shrink-0" />}
                                <span><span className="font-medium">{c.title}</span><span className="block text-xs text-smoke">{reached ? t("Débloqué : réclame-le plus haut.", "Unlocked — claim it above.") : t("La récompense pour atteindre ce rang.", "The reward for reaching this rank.")}</span></span>
                              </p>
                            );
                          })()}
                          {tk.reward && !campaigns?.length && (
                            <p className="text-sm mt-2 flex items-start gap-2">
                              {reached ? <Gift className="w-4 h-4 mt-0.5 text-volt shrink-0" strokeWidth={2} /> : <Lock className="w-4 h-4 mt-0.5 text-smoke shrink-0" strokeWidth={2} />}
                              <span><span className="font-medium">{rewardItem(tk.reward, lang)}</span><span className="block text-xs text-smoke">{rewardNote(tk.reward, lang)}</span></span>
                            </p>
                          )}
                        </div>
                        </div>
                        {/* The five sub-ranks, I to V: earned ones in full, the rest dimmed. */}
                        <div className="grid grid-cols-5 gap-1.5">
                          {SUB_RANKS.map((s, i) => {
                            const from = tk.from + i * PER_SUB;
                            const got = lvl.level >= from;
                            const here = current && s === sub;
                            return (
                              <div key={s} className={`grid justify-items-center gap-1 rounded-2xl py-2 ${here ? "bg-[rgba(31,199,111,.12)] ring-1 ring-volt" : ""}`}>
                                <RankEmblem tier={tk} sub={s} size={48} locked={!got} />
                                <span className={`text-[11px] font-medium ${got ? "" : "text-smoke"}`}>{s}</span>
                                <span className="text-[10px] text-smoke tnum">{t("Niv.", "Lv")} {from}–{from + PER_SUB - 1}</span>
                              </div>
                            );
                          })}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </Section>
            </Item>
          </div>

          <div className="min-w-0">
            <Item>
              <Section title={t("Où t’en es", "Where you stand")}>
                <div className="card p-5 grid justify-items-center text-center gap-4">
                  <RankEmblem tier={tier} sub={sub} size={150} />
                  <div>
                    <p className="display text-3xl">{tierName(tier, lang)} <em>{sub}</em></p>
                    <p className="text-sm text-smoke mt-1 tnum">{t("Niveau", "Level")} {lvl.level} · <CountUp value={lvl.into} /> / {lvl.need.toLocaleString(loc)} XP</p>
                  </div>
                  <span className="block w-full h-[4px] rounded-full bg-[var(--line)] overflow-hidden">
                    <span className="block h-full rounded-full bg-volt" style={{ width: `${(lvl.into / lvl.need) * 100}%` }} />
                  </span>
                </div>
              </Section>
            </Item>

            {next && (
              <Item>
                <Section title={t("Prochaine récompense", "Next reward")}>
                  <div className="card p-5 grid gap-3">
                    <div className="flex items-center gap-4">
                      <RankEmblem tier={next.tier} size={56} locked className="shrink-0" />
                      <div className="min-w-0">
                        <span className="meta">{tierName(next.tier, lang)}</span>
                        <p className="font-medium leading-tight">{rewardItem(next.tier.reward!, lang)}</p>
                      </div>
                    </div>
                    <p className="text-sm text-smoke">{rewardNote(next.tier.reward!, lang)}</p>
                    <p className="text-sm tnum"><strong className="text-ink">{next.xpAway.toLocaleString(loc)} XP</strong> {t(`à faire, ${next.levelsAway} niveau${next.levelsAway > 1 ? "x" : ""}.`, `to go — ${next.levelsAway} level${next.levelsAway === 1 ? "" : "s"}.`)}</p>
                    <p className="text-xs text-smoke">{t(
                      `Environ ${Math.max(1, Math.round(next.xpAway / 2100))} semaine${Math.max(1, Math.round(next.xpAway / 2100)) > 1 ? "s" : ""} à quatre séances par semaine, avec repas et check-ins enregistrés.`,
                      `Roughly ${Math.max(1, Math.round(next.xpAway / 2100))} week${Math.round(next.xpAway / 2100) === 1 ? "" : "s"} at four sessions a week with meals and check-ins logged.`,
                    )}</p>
                  </div>
                </Section>
              </Item>
            )}

            <Item>
              <Section title={t("Comment gagner de l’XP", "How XP is earned")}>
                <ul className="card divide-y divide-line px-4 text-sm">
                  {[[t("Finir une séance", "Finish a session"), "120"], [t("Te présenter une mauvaise journée", "Show up on a bad day"), "140"], [t("Chaque série enregistrée", "Each set logged"), "6"], [t("Check-in quotidien", "Daily check-in"), "20"], [t("Enregistrer une activité", "Record an activity"), "60"], [t("Noter une journée complète de repas", "Log a full day of meals"), "60"], [t("Garder une série de semaines", "Hold a week streak"), "250"], [t("Battre un record personnel", "Set a personal record"), "200"]].map(([what, xp]) => (
                    <li key={what} className="py-2.5 flex justify-between gap-3"><span>{what}</span><span className="tnum text-smoke">+{xp}</span></li>
                  ))}
                </ul>
                <p className="text-xs text-smoke mt-3">{t("La liste récompense le fait d’être là, pas l’intensité. Impossible d’acheter un palier ou de le sauter : le haut de l’échelle, c’est des années de travail, exprès.", "The list rewards turning up, not intensity. There is no way to buy a tier and no shortcut through one — the top of the ladder is years of work, by design.")}</p>
              </Section>
            </Item>
          </div>
        </Stagger>
      </Screen>
    </Page>
  );
}
