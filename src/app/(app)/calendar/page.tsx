"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronLeft, ChevronRight, UtensilsCrossed } from "lucide-react";
import { db, getProfile, todayISO } from "@/lib/db";
import { getMeal } from "@/lib/nutrition/recipes";
import { getExercise } from "@/lib/data/exercises";
import { fmtLoad } from "@/lib/units";
import { IMG } from "@/lib/data/images";
import { Screen, Hero, Section, ScreenSkeleton, Photo } from "@/components/ui";
import { Page, Stagger, Item } from "@/components/motion";

/* A month at a glance, and a day in full: what you train and what you eat,
   so tomorrow can be shopped for and packed tonight. */

const enc = (id: string) => encodeURIComponent(id);
const iso = (y: number, m: number, d: number) =>
  `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

export default function CalendarPage() {
  const today = todayISO();
  const profile = useLiveQuery(() => getProfile(), []);
  const sessions = useLiveQuery(() => db.sessions.toArray(), []);
  const nutrition = useLiveQuery(() => db.nutrition.toArray(), []);
  const activities = useLiveQuery(() => db.activities.toArray(), []);

  const [cursor, setCursor] = useState(() => { const d = new Date(today + "T00:00:00"); return { y: d.getFullYear(), m: d.getMonth() }; });
  const [picked, setPicked] = useState(today);

  type DayRow = { session?: NonNullable<typeof sessions>[number]; meals?: NonNullable<typeof nutrition>[number]; activities: NonNullable<typeof activities> };
  const byDate = useMemo(() => {
    const map = new Map<string, DayRow>();
    const touch = (d: string) => map.get(d) ?? map.set(d, { activities: [] }).get(d)!;
    for (const s of sessions ?? []) touch(s.date).session = s;
    for (const n of nutrition ?? []) touch(n.date).meals = n;
    for (const a of activities ?? []) touch(a.startedAt.slice(0, 10)).activities.push(a);
    return map;
  }, [sessions, nutrition, activities]);

  if (!profile) return <ScreenSkeleton />;

  const first = new Date(cursor.y, cursor.m, 1);
  const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate();
  const lead = (first.getDay() + 6) % 7;             // Monday-first grid
  const monthLabel = first.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const step = (n: number) => setCursor(({ y, m }) => { const d = new Date(y, m + n, 1); return { y: d.getFullYear(), m: d.getMonth() }; });

  const day = byDate.get(picked);
  const pickedDate = new Date(picked + "T00:00:00");
  const meal0 = day?.meals?.meals ?? [];

  return (
    <Page>
      <Screen>
        <Hero image={IMG.dark} height="h-[300px]" back="/today" eyebrow="Plan ahead · training and food"
          title={<>Your <em className="slab">month.</em></>} />

        <Stagger className="xl:grid xl:grid-cols-[minmax(0,1fr)_var(--rail)] xl:gap-x-12 xl:items-start">
          <div className="min-w-0">
            <Item>
              <Section title={monthLabel} aside={
                <span className="flex gap-1">
                  <button type="button" className="chip" onClick={() => step(-1)} aria-label="Previous month"><ChevronLeft className="w-4 h-4" /></button>
                  <button type="button" className="chip" onClick={() => step(1)} aria-label="Next month"><ChevronRight className="w-4 h-4" /></button>
                </span>}>
                <div className="grid grid-cols-7 gap-1.5 mb-2">
                  {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                    <span key={d} className="meta text-center">{d}</span>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1.5">
                  {Array.from({ length: lead }, (_, i) => <span key={`lead${i}`} />)}
                  {Array.from({ length: daysInMonth }, (_, i) => {
                    const d = iso(cursor.y, cursor.m, i + 1);
                    const info = byDate.get(d);
                    const isToday = d === today;
                    const isPicked = d === picked;
                    const done = info?.session?.status === "done" || (info?.activities.length ?? 0) > 0;
                    return (
                      <button key={d} type="button" onClick={() => setPicked(d)}
                        aria-pressed={isPicked} aria-label={`${new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}${info?.session ? `, ${info.session.title}` : ""}`}
                        className={`aspect-square rounded-xl border p-1.5 grid content-between text-left transition-colors
                          ${isPicked ? "border-ink bg-[rgba(16,16,16,.05)]" : isToday ? "border-volt" : "border-line hover:border-line-strong"}`}>
                        <span className={`text-xs tnum ${isToday ? "font-semibold" : "text-smoke"}`}>{i + 1}</span>
                        <span className="flex gap-1 items-center">
                          {info?.session && <span className={`w-1.5 h-1.5 rounded-full ${done ? "bg-volt" : "bg-ink"}`} title="Training" />}
                          {info?.meals && <span className="w-1.5 h-1.5 rounded-full bg-[var(--line-strong)]" title="Meals planned" />}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-smoke mt-3 flex gap-4 flex-wrap">
                  <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-ink" />Training planned</span>
                  <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-volt" />Done</span>
                  <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-[var(--line-strong)]" />Meals planned</span>
                </p>
              </Section>
            </Item>
          </div>

          <div className="min-w-0">
            <Item>
              <Section title={pickedDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}>
                {!day?.session && !day?.meals && (day?.activities.length ?? 0) === 0 ? (
                  <div className="card p-4"><p className="text-sm text-smoke">Nothing planned on this day yet. Meals are built the morning of. Training is planned at least eight weeks ahead, and each new block is written from how the last one went.</p></div>
                ) : (
                  <div className="grid gap-3">
                    {day?.session && (
                      <Link href={`/session?id=${day.session.id}`} className="card p-4 grid gap-2">
                        <span className="meta">Training · week {day.session.week} · {day.session.minutes} min</span>
                        <p className="display text-2xl">{day.session.title}</p>
                        <ul className="grid gap-1 text-sm text-smoke">
                          {day.session.exercises.filter((e) => e.block === "main" || e.block === "accessory").slice(0, 4).map((e) => {
                            const meta = getExercise(e.slug); const f = e.sets[0];
                            return <li key={e.id} className="flex justify-between gap-3"><span className="truncate">{meta?.name ?? e.slug}</span><span className="tnum shrink-0">{e.sets.length} × {f.reps ?? `${f.seconds}s`}{f.loadKg ? ` · ${fmtLoad(f.loadKg, profile.units)}` : ""}</span></li>;
                          })}
                        </ul>
                      </Link>
                    )}

                    {day?.meals && (
                      <div className="card overflow-hidden">
                        <div className="p-4 pb-2 flex items-baseline justify-between gap-3">
                          <span className="meta flex items-center gap-1.5"><UtensilsCrossed className="w-3.5 h-3.5" strokeWidth={2} />Food</span>
                          <span className="text-xs text-smoke tnum">{day.meals.targets.kcal} kcal · {day.meals.targets.protein} g protein</span>
                        </div>
                        <ul className="divide-y divide-line">
                          {meal0.map((m) => {
                            const meal = getMeal(m.mealId);
                            if (!meal) return null;
                            return (
                              <li key={`${m.slot}-${m.time}`}>
                                <Link href={`/food/meal?id=${enc(meal.id)}&date=${picked}`} className="px-4 py-2.5 flex items-center gap-3">
                                  <Photo src={meal.image} color className="thumb !w-11 !h-11 shrink-0" />
                                  <span className="min-w-0 flex-1">
                                    <span className="block text-sm font-medium truncate">{meal.name.split(" with ")[0]}</span>
                                    <span className="meta">{m.time} · {m.slot}</span>
                                  </span>
                                  <span className="text-xs text-smoke tnum shrink-0">{Math.round(meal.kcal * m.scale)} kcal</span>
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
                        <div className="px-4 py-3 border-t border-line">
                          <Link href="/food" className="pill pill--sm">Groceries for the week</Link>
                        </div>
                      </div>
                    )}

                    {day?.activities.map((a) => (
                      <Link key={a.id} href={`/move/activity?id=${a.id}`} className="card p-4 grid gap-1">
                        <span className="meta">Recorded · {a.type}</span>
                        <p className="font-medium">{a.title}</p>
                      </Link>
                    ))}
                  </div>
                )}
              </Section>
            </Item>
          </div>
        </Stagger>
      </Screen>
    </Page>
  );
}
