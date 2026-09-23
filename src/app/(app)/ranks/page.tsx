"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { RewardsSection } from "@/components/RewardsSection";
import type { Campaign } from "@/lib/rewards";
import { Gift, Lock } from "lucide-react";
import { getStats, getProfile } from "@/lib/db";
import { LEVELS_PER_TIER, SUB_RANKS, TIERS, levelFromXp, nextRewardFor, subRankFor, tierForLevel, xpToReach } from "@/lib/gamification";

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
  if (!stats || !profile) return <ScreenSkeleton />;

  const lvl = levelFromXp(stats.xp);
  const tier = tierForLevel(lvl.level);
  const sub = subRankFor(lvl.level);
  const next = nextRewardFor(lvl.level, stats.xp);

  return (
    <Page>
      <Screen>
        <Hero image={IMG.dark} height="h-[380px]" back="/progress"
          eyebrow={`Level ${lvl.level} of 70 · ${stats.xp.toLocaleString("en-US")} XP earned`}
          title={<>{tier.name}<br /><em className="slab">{sub}.</em></>}
          stats={[
            { label: "Level", value: lvl.level },
            { label: "Into this level", value: `${Math.round((lvl.into / lvl.need) * 100)}%` },
            ...(next ? [{ label: "To next reward", value: `${next.levelsAway} lvl` }] : []),
          ]} />

        <Stagger className="xl:grid xl:grid-cols-[minmax(0,1fr)_var(--rail)] xl:gap-x-12 xl:items-start">
          <div className="min-w-0">
            <Item><RewardsSection onCampaigns={setCampaigns} /></Item>
            <Item>
              <Section title="The ladder" aside={<span className="text-xs text-smoke">seven tiers · seventy levels</span>}>
                <ul className="grid gap-3">
                  {TIERS.map((t) => {
                    const reached = lvl.level >= t.from;
                    const current = t.key === tier.key;
                    const last = t.from + LEVELS_PER_TIER - 1;
                    return (
                      <li key={t.key} className={`card p-4 grid gap-4 ${current ? "border-volt" : ""}`}>
                        <div className="flex items-center gap-4">
                        <RankEmblem tier={t} sub={current ? sub : undefined} size={64} locked={!reached} className="shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline gap-2 flex-wrap">
                            <span className="display text-xl">{t.name}</span>
                            {current && <span className="chip chip--volt">You are here</span>}
                          </div>
                          <p className="text-xs text-smoke tnum mt-0.5">
                            Levels {t.from}–{last} · {xpToReach(t.from).toLocaleString("en-US")} XP to enter
                          </p>
                          {(() => {
                            const c = campaigns?.find((x) => x.rule_type === "rank" && x.rule_value.split(":")[0] === t.key);
                            if (!c) return null;
                            return (
                              <p className="text-sm mt-2 flex items-center gap-3">
                                {c.image_url ? <img src={c.image_url} alt="" className="w-12 h-12 rounded-xl object-cover shrink-0" /> : <Gift className="w-5 h-5 text-volt shrink-0" />}
                                <span><span className="font-medium">{c.title}</span><span className="block text-xs text-smoke">{reached ? "Unlocked — claim it above." : "The reward for reaching this rank."}</span></span>
                              </p>
                            );
                          })()}
                          {t.reward && !campaigns?.length && (
                            <p className="text-sm mt-2 flex items-start gap-2">
                              {reached ? <Gift className="w-4 h-4 mt-0.5 text-volt shrink-0" strokeWidth={2} /> : <Lock className="w-4 h-4 mt-0.5 text-smoke shrink-0" strokeWidth={2} />}
                              <span><span className="font-medium">{t.reward.item}</span><span className="block text-xs text-smoke">{t.reward.note}</span></span>
                            </p>
                          )}
                        </div>
                        </div>
                        {/* The five sub-ranks, I to V: earned ones in full, the rest dimmed. */}
                        <div className="grid grid-cols-5 gap-1.5">
                          {SUB_RANKS.map((s, i) => {
                            const from = t.from + i * PER_SUB;
                            const got = lvl.level >= from;
                            const here = current && s === sub;
                            return (
                              <div key={s} className={`grid justify-items-center gap-1 rounded-2xl py-2 ${here ? "bg-[rgba(31,199,111,.12)] ring-1 ring-volt" : ""}`}>
                                <RankEmblem tier={t} sub={s} size={48} locked={!got} />
                                <span className={`text-[11px] font-medium ${got ? "" : "text-smoke"}`}>{s}</span>
                                <span className="text-[10px] text-smoke tnum">Lv {from}–{from + PER_SUB - 1}</span>
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
              <Section title="Where you stand">
                <div className="card p-5 grid justify-items-center text-center gap-4">
                  <RankEmblem tier={tier} sub={sub} size={150} />
                  <div>
                    <p className="display text-3xl">{tier.name} <em>{sub}</em></p>
                    <p className="text-sm text-smoke mt-1 tnum">Level {lvl.level} · <CountUp value={lvl.into} /> / {lvl.need.toLocaleString("en-US")} XP</p>
                  </div>
                  <span className="block w-full h-[4px] rounded-full bg-[var(--line)] overflow-hidden">
                    <span className="block h-full rounded-full bg-volt" style={{ width: `${(lvl.into / lvl.need) * 100}%` }} />
                  </span>
                </div>
              </Section>
            </Item>

            {next && (
              <Item>
                <Section title="Next reward">
                  <div className="card p-5 grid gap-3">
                    <div className="flex items-center gap-4">
                      <RankEmblem tier={next.tier} size={56} locked className="shrink-0" />
                      <div className="min-w-0">
                        <span className="meta">{next.tier.name}</span>
                        <p className="font-medium leading-tight">{next.tier.reward!.item}</p>
                      </div>
                    </div>
                    <p className="text-sm text-smoke">{next.tier.reward!.note}</p>
                    <p className="text-sm tnum"><strong className="text-ink">{next.xpAway.toLocaleString("en-US")} XP</strong> to go — {next.levelsAway} level{next.levelsAway === 1 ? "" : "s"}.</p>
                    <p className="text-xs text-smoke">Roughly {Math.max(1, Math.round(next.xpAway / 2100))} week{Math.round(next.xpAway / 2100) === 1 ? "" : "s"} at four sessions a week with meals and check-ins logged.</p>
                  </div>
                </Section>
              </Item>
            )}

            <Item>
              <Section title="How XP is earned">
                <ul className="card divide-y divide-line px-4 text-sm">
                  {[["Finish a session", "120"], ["Show up on a bad day", "140"], ["Each set logged", "6"], ["Daily check-in", "20"], ["Record an activity", "60"], ["Log a full day of meals", "60"], ["Hold a week streak", "250"], ["Set a personal record", "200"]].map(([what, xp]) => (
                    <li key={what} className="py-2.5 flex justify-between gap-3"><span>{what}</span><span className="tnum text-smoke">+{xp}</span></li>
                  ))}
                </ul>
                <p className="text-xs text-smoke mt-3">The list rewards turning up, not intensity. There is no way to buy a tier and no shortcut through one — the top of the ladder is years of work, by design.</p>
              </Section>
            </Item>
          </div>
        </Stagger>
      </Screen>
    </Page>
  );
}
