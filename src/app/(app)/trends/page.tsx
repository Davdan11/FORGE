"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import { db, getProfile, getStats, todayISO } from "@/lib/db";
import { consistency, liftTrends, readGoal, recentWeeks, trendOfCompleted, weekly } from "@/lib/analytics";
import { getExercise } from "@/lib/data/exercises";
import { goalLabel } from "@/lib/engine/plan";
import { fmtLoad, fmtDist } from "@/lib/units";
import { sessionImage } from "@/lib/data/images";
import { Screen, Hero, Section, ScreenSkeleton } from "@/components/ui";
import { Page, Stagger, Item, Ring, CountUp } from "@/components/motion";
import { Bars, Sparkline } from "@/components/charts";
import { useLang, useT } from "@/lib/i18n";

const WEEKS = 8;

const Arrow = ({ v }: { v: number }) =>
  v > 0.001 ? <TrendingUp className="w-4 h-4 text-volt" strokeWidth={2} />
    : v < -0.001 ? <TrendingDown className="w-4 h-4 text-danger" strokeWidth={2} />
    : <Minus className="w-4 h-4 text-smoke" strokeWidth={2} />;

export default function TrendsPage() {
  const today = todayISO();
  const profile = useLiveQuery(() => getProfile(), []);
  const stats = useLiveQuery(() => getStats(), []);
  const sets = useLiveQuery(() => db.sets.toArray(), []);
  const logs = useLiveQuery(() => db.logs.toArray(), []);
  const activities = useLiveQuery(() => db.activities.toArray(), []);
  const weights = useLiveQuery(() => db.weights.toArray(), []);
  const readiness = useLiveQuery(() => db.readiness.toArray(), []);
  const t = useT();
  const lang = useLang();

  const weeks = useMemo(() => recentWeeks(today, WEEKS), [today]);
  const lifts = useMemo(() => liftTrends(sets ?? []), [sets]);
  const tonnage = useMemo(() => weekly(logs ?? [], (l) => l.startedAt, (l) => l.volumeKg ?? 0, weeks), [logs, weeks]);
  const distance = useMemo(() => weekly(activities ?? [], (a) => a.startedAt, (a) => a.distanceM, weeks), [activities, weeks]);
  const minutes = useMemo(() => weekly(logs ?? [], (l) => l.startedAt, (l) => Math.round((l.durationSec ?? 0) / 60), weeks), [logs, weeks]);
  const hasTonnage = tonnage.some((w) => w.value > 0);
  const hasMinutes = minutes.some((w) => w.value > 0);
  const cons = useMemo(() => consistency(logs ?? [], activities ?? [], weeks), [logs, activities, weeks]);
  const read = useMemo(() => profile ? readGoal({
    goal: profile.goal, weights: weights ?? [], lifts, tonnage, distance, consistency: cons, readiness: readiness ?? [],
  }) : null, [profile, weights, lifts, tonnage, distance, cons, readiness, lang]); // eslint-disable-line react-hooks/exhaustive-deps -- the read is written in the current language

  if (!profile || !stats || !read) return <ScreenSkeleton />;

  const u = profile.units;
  const tonnageSlope = trendOfCompleted(tonnage);
  const totalKm = distance.reduce((a, d) => a + d.value, 0);
  return (
    <Page>
      <Screen>
        <Hero image={sessionImage("upper", 1400, 800)} height="h-[340px]" back="/progress"
          eyebrow={t(`${WEEKS} dernières semaines · objectif : ${goalLabel(profile.goal)}`, `Last ${WEEKS} weeks · goal: ${goalLabel(profile.goal)}`)}
          title={<>{t("Est-ce que tu", "Are you")} <em className="slab">{t("avances?", "getting there?")}</em></>}
          stats={[
            { label: t("Semaines entraînées", "Weeks trained"), value: `${cons.weeksTrained}/${cons.weeksTotal}` },
            { label: t("Plus longue série", "Longest run"), value: t(`${cons.longestRun} sem.`, `${cons.longestRun} wk`) },
            ...(lifts.length ? [{ label: t("Meilleur gain", "Best gain"), value: `${lifts[0].gainPct > 0 ? "+" : ""}${lifts[0].gainPct}%` }] : []),
          ]} />

        <Stagger className="xl:grid xl:grid-cols-[minmax(0,1fr)_var(--rail)] xl:gap-x-12 xl:items-start">
          <div className="min-w-0">
            {/* The read on the goal comes first: the charts below are the evidence. */}
            <Item>
              <Section title={t("Où t’en es", "Where you stand")}>
                <div className="card p-5 grid gap-4 sm:grid-cols-[auto_1fr] sm:items-start">
                  <Ring value={read.onTrack} size={92} stroke={7} color={read.onTrack >= 0.7 ? "var(--volt)" : read.onTrack >= 0.5 ? "var(--ink)" : "var(--danger)"}>
                    <span className="display text-2xl tnum"><CountUp value={Math.round(read.onTrack * 100)} /></span>
                  </Ring>
                  <div className="grid gap-2">
                    <p className="display text-2xl">{read.headline}</p>
                    <p className="text-sm text-smoke">{read.detail}</p>
                    {read.missing && (
                      <p className="text-sm border-t border-line pt-3 mt-1">
                        <span className="meta block mb-1">{t("Ce qui ferait le plus bouger les choses", "What would move it most")}</span>{read.missing}
                      </p>
                    )}
                  </div>
                </div>
              </Section>
            </Item>

            <Item>
              <Section title={t("Force", "Strength")} aside={<span className="text-xs text-smoke">{t("1RM estimé à partir de ta meilleure série", "estimated 1RM from your best set")}</span>}>
                {lifts.length === 0 ? (
                  <div className="card p-4"><p className="text-sm text-smoke">{t("Enregistre deux fois une série avec charge sur le même mouvement et sa courbe apparaît ici.", "Log a loaded set twice on the same movement and its curve appears here.")}</p></div>
                ) : (
                  <ul className="grid gap-3">
                    {lifts.slice(0, 5).map((l) => {
                      const meta = getExercise(l.slug);
                      return (
                        <li key={l.slug} className="card p-4">
                          <div className="flex items-baseline justify-between gap-3 mb-2">
                            <Link href={`/library/${l.slug}`} className="font-medium truncate">{meta?.name ?? l.slug}</Link>
                            <span className={`tnum text-sm shrink-0 ${l.gainPct > 0 ? "text-volt" : "text-smoke"}`}>
                              {l.gainPct > 0 ? "+" : ""}{l.gainPct}%
                            </span>
                          </div>
                          <Sparkline values={l.points.map((p) => p.e1rm)} labels={l.points.map((p) => p.date.slice(5))} height={44} format={(v) => fmtLoad(v, u)} />
                          <p className="text-xs text-smoke tnum mt-2">
                            {fmtLoad(l.first, u)} → {fmtLoad(l.best, u)} {t("max", "best")} · {l.points.length} {l.points.length > 1 ? t("séances", "sessions") : t("séance", "sessions")}
                          </p>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Section>
            </Item>

            {/* Empty charts are eight flat lines: until there is something to
                draw, "Where you stand" above already says why. */}
            {hasTonnage && <Item>
              <Section title={t("Tonnage hebdo", "Weekly tonnage")} aside={<span className="flex items-center gap-1.5 text-xs text-smoke"><Arrow v={tonnageSlope} />{tonnageSlope > 0 ? t("en hausse", "climbing") : tonnageSlope < 0 ? t("en baisse", "falling") : t("stable", "flat")}</span>}>
                <div className="card p-4">
                  <Bars data={tonnage} format={(v) => `${Math.round(v / 1000)} t`} />
                </div>
              </Section>
            </Item>}
          </div>

          <div className="min-w-0">
            <Item>
              <Section title={t("Être là", "Showing up")}>
                <div className="card p-4 grid gap-3">
                  {cons.weeksTrained > 0 && <Bars data={cons.sessions} format={(v) => `${Math.round(v)}`} height={90} />}
                  <p className="text-sm tnum">
                    <strong>{cons.weeksTrained}</strong> {t("sur", "of")} {cons.weeksTotal} {t("semaines · plus longue série", "weeks · longest run")} <strong>{cons.longestRun}</strong>.
                  </p>
                  <p className="text-xs text-smoke">{t("La régularité bat toutes les autres variables de cette page. C’est la seule que tu contrôles complètement.", "Consistency beats every other variable on this page. It is the one you fully control.")}</p>
                </div>
              </Section>
            </Item>

            {hasMinutes && <Item>
              <Section title={t("Minutes d’entraînement", "Minutes trained")}>
                <div className="card p-4"><Bars data={minutes} format={(v) => `${Math.round(v)} min`} height={90} /></div>
              </Section>
            </Item>}

            {totalKm > 0 && (
              <Item>
                <Section title={t("Distance", "Distance")} aside={<span className="text-xs text-smoke tnum">{fmtDist(totalKm, u)} {t("au total", "total")}</span>}>
                  <div className="card p-4"><Bars data={distance} format={(v) => fmtDist(v, u)} height={90} /></div>
                </Section>
              </Item>
            )}

            {(weights?.length ?? 0) > 1 && (
              <Item>
                <Section title={t("Poids", "Body weight")}>
                  <div className="card p-4">
                    <Sparkline
                      values={[...weights!].sort((a, b) => a.date.localeCompare(b.date)).map((w) => w.kg)}
                      labels={[...weights!].sort((a, b) => a.date.localeCompare(b.date)).map((w) => w.date.slice(5))}
                      height={48} format={(v) => fmtLoad(v, u)} />
                  </div>
                </Section>
              </Item>
            )}
          </div>
        </Stagger>
      </Screen>
    </Page>
  );
}
