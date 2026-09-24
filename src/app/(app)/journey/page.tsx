"use client";

import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, getProfile, getStats, todayISO } from "@/lib/db";
import { buildJourney } from "@/lib/journey";
import { getExercise } from "@/lib/data/exercises";
import { ART } from "@/lib/data/images";
import { fmtDist, kgToLb } from "@/lib/units";
import { Screen, Hero, Section, ScreenSkeleton, StatRow } from "@/components/ui";
import { Sparkline } from "@/components/charts";
import { Page, Stagger, Item } from "@/components/motion";
import { useLang, useT } from "@/lib/i18n";

/* Your journey: everything since day one, week by week — weight, sessions,
   records, activities. The page someone opens when they come back. */
export default function JourneyPage() {
  const profile = useLiveQuery(() => getProfile(), []);
  const stats = useLiveQuery(() => getStats(), []);
  const weights = useLiveQuery(() => db.weights.toArray(), []);
  const sessions = useLiveQuery(() => db.sessions.toArray(), []);
  const sets = useLiveQuery(() => db.sets.toArray(), []);
  const activities = useLiveQuery(() => db.activities.toArray(), []);
  const today = todayISO();
  const tt = useT();
  const lang = useLang();
  const loc = lang === "fr" ? "fr-CA" : "en-US";

  const journey = useMemo(() => profile && weights && sessions && sets && activities
    ? buildJourney({ start: profile.createdAt.slice(0, 10) || today, today, startWeightKg: profile.startWeightKg, weights, sessions, sets, activities })
    : null, [profile, weights, sessions, sets, activities, today]);

  if (!profile || !stats || !journey) return <ScreenSkeleton />;
  const lb = profile.units.weight === "lb";
  const w = (kg: number) => (lb ? Math.round(kgToLb(kg) * 10) / 10 : Math.round(kg * 10) / 10);
  const unit = lb ? "lb" : "kg";
  const t = journey.totals;
  const since = new Date(profile.createdAt).toLocaleDateString(loc, { month: "long", day: "numeric", year: "numeric" });
  const series = [...(weights ?? [])].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <Page>
      <Screen>
        <Hero image={ART.profile} color height="h-[300px]" back="/progress" eyebrow={tt(`Depuis le ${since}`, `Since ${since}`)}
          title={<>{tt("Ton", "Your")} <em>{tt("parcours.", "journey.")}</em></>}>
          <p className="text-sm text-bone/80 max-w-[44ch]">{tt("Chaque semaine depuis le jour un : ce que tu pesais, ce que t’as fait, ce que t’as battu.", "Every week since day one: what you weighed, what you did, what you broke.")}</p>
        </Hero>

        <Stagger className="grid gap-6">
          <Item>
            <StatRow items={[
              t.changeKg != null ? { label: t.changeKg <= 0 ? tt("En moins depuis le jour un", "Down since day one") : tt("En plus depuis le jour un", "Up since day one"), value: String(Math.abs(w(t.changeKg))), unit } : { label: tt("Pesées", "Weigh-ins"), value: "0" },
              { label: tt("Séances faites", "Sessions done"), value: String(t.sessionsDone) },
              { label: tt("Records", "Records"), value: String(t.records) },
            ]} />
          </Item>

          {series.length > 1 && (
            <Item>
              <Section title={tt("Poids", "Weight")}>
                <div className="card p-4 grid gap-2">
                  <div className="flex justify-between text-xs text-smoke tnum"><span>{tt("Départ", "Start")} · {w(t.startKg ?? series[0].kg)} {unit}</span><span>{tt("Maintenant", "Now")} · {w(t.currentKg ?? series.at(-1)!.kg)} {unit}</span></div>
                  <Sparkline values={series.map((x) => w(x.kg))} labels={series.map((x) => x.date)} height={72} color="var(--green)" format={(v) => `${v} ${unit}`} />
                </div>
              </Section>
            </Item>
          )}

          <Item>
            <Section title={tt("Semaine par semaine", "Week by week")} aside={<span className="text-xs text-smoke">{tt(`${t.activeWeeks} semaine${t.activeWeeks > 1 ? "s" : ""} active${t.activeWeeks > 1 ? "s" : ""}`, `${t.activeWeeks} active ${t.activeWeeks === 1 ? "week" : "weeks"}`)}</span>}>
              <ol className="card divide-y divide-line">
                {journey.weeks.map((wk) => {
                  const empty = wk.sessionsDone + wk.activities === 0 && wk.weightKg == null;
                  return (
                    <li key={wk.monday} className={`p-4 grid grid-cols-[72px_minmax(0,1fr)] gap-3 ${empty ? "opacity-55" : ""}`}>
                      <span className="meta pt-0.5">{new Date(wk.monday + "T00:00:00").toLocaleDateString(loc, { month: "short", day: "numeric" })}</span>
                      <span className="grid gap-1 text-sm">
                        {empty ? <span className="text-smoke">{tt("Une semaine de congé.", "A week off.")}</span> : (
                          <>
                            <span className="flex flex-wrap gap-x-4 gap-y-1 tnum">
                              {wk.sessionsPlanned > 0 && <span><strong>{wk.sessionsDone}</strong>/{wk.sessionsPlanned} {tt("séances", "sessions")}</span>}
                              {wk.activities > 0 && <span><strong>{wk.activities}</strong> {wk.activities === 1 ? tt("activité", "activity") : tt("activités", "activities")} · {fmtDist(wk.distanceM, profile.units)}</span>}
                              {wk.weightKg != null && <span><strong>{w(wk.weightKg)} {unit}</strong>{wk.weightDeltaKg != null && wk.weightDeltaKg !== 0 && <span className={wk.weightDeltaKg < 0 ? "text-volt" : "text-smoke"}> {wk.weightDeltaKg > 0 ? "+" : "−"}{Math.abs(w(wk.weightDeltaKg))}</span>}</span>}
                            </span>
                            {wk.records.length > 0 && <span className="text-xs"><span className="chip chip--volt mr-1.5">PR</span>{wk.records.map((s) => getExercise(s)?.name ?? s).join(", ")}</span>}
                          </>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </Section>
          </Item>
        </Stagger>
      </Screen>
    </Page>
  );
}
