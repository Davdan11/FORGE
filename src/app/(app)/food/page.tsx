"use client";

import { useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { db, getProfile, todayISO, addDays } from "@/lib/db";
import { getMeal, recipeCount } from "@/lib/nutrition/recipes";
import { buildNutritionDay, dayTotals, groceryList, swapOptions, dailyTargets } from "@/lib/nutrition/engine";
import { awardMeal } from "@/lib/progress";
import { Screen, Hero, Section, Bar, Toast, Photo, Check, ScreenSkeleton } from "@/components/ui";
import { Page, Stagger, Item, Press, Ring, CountUp, motion, AnimatePresence } from "@/components/motion";
import type { DayPlanMeal, Meal, NutritionDay } from "@/lib/types";

const enc = (id: string) => encodeURIComponent(id);

export default function FoodPage() {
  const today = todayISO();
  const profile = useLiveQuery(() => getProfile(), []);
  const day = useLiveQuery(() => db.nutrition.get(today), [today]);
  const week = useLiveQuery(() => db.nutrition.where("date").between(today, addDays(today, 6), true, true).toArray(), [today]) ?? [];
  const [tab, setTab] = useState<"today" | "groceries">("today");
  const [swapFor, setSwapFor] = useState<DayPlanMeal | null>(null);
  const [swaps, setSwaps] = useState<Meal[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  if (!profile || day === undefined) return <ScreenSkeleton />;
  if (!day) return <ScreenSkeleton />;
  const t = dayTotals(day);
  const tg = dailyTargets(profile, day.dayType);
  const next = day.meals.find((m) => !m.done);
  const hero = next ? getMeal(next.mealId) : getMeal(day.meals[0]?.mealId);
  const doneCount = day.meals.filter((m) => m.done).length;

  async function toggleDone(m: DayPlanMeal) {
    const meals = day!.meals.map((x) => (x === m ? { ...x, done: !x.done } : x));
    await db.nutrition.update(day!.id, { meals, dirty: 1 });
    if (!m.done) { const full = meals.every((x) => x.done); const xp = await awardMeal(full); setToast(`${getMeal(m.mealId)?.name} logged. +${xp} XP${full ? " — full day, bonus!" : ""}`); setTimeout(() => setToast(null), 3000); }
  }
  function openSwap(m: DayPlanMeal) { setSwapFor(m); setSwaps(swapOptions(profile!, day!, m)); }
  async function doSwap(to: string) {
    if (!swapFor) return;
    await db.nutrition.update(day!.id, { meals: day!.meals.map((x) => (x === swapFor ? { ...x, mealId: to, done: false } : x)), dirty: 1 });
    setSwapFor(null);
  }
  async function rebuildToday() {
    const recent = (await db.nutrition.where("date").between(addDays(today, -3), addDays(today, -1), true, true).toArray()).flatMap((d) => d.meals.map((m) => m.mealId));
    const s = await db.sessions.where("date").equals(today).first();
    const nd = buildNutritionDay(profile!, today, s ?? null, undefined, [...recent, ...day!.meals.map((m) => m.mealId)]);
    await db.nutrition.put({ ...nd, dirty: 1 });
    setToast("New menu for today."); setTimeout(() => setToast(null), 2500);
  }
  async function buildWeek() {
    let prev: NutritionDay | undefined = day ?? undefined;
    const recent: string[] = day!.meals.map((m) => m.mealId);
    for (let i = 1; i <= 6; i++) {
      const d = addDays(today, i);
      const existing = await db.nutrition.get(d);
      if (existing) { prev = existing; recent.push(...existing.meals.map((m) => m.mealId)); continue; }
      const s = await db.sessions.where("date").equals(d).first();
      const nd = buildNutritionDay(profile!, d, s ?? null, prev, recent.slice(-24));
      await db.nutrition.put({ ...nd, dirty: 1 });
      prev = nd; recent.push(...nd.meals.map((m) => m.mealId));
    }
    setTab("groceries");
  }

  return (
    <Page>
      <Screen>
        <Hero image={hero?.image ?? ""} color height="h-[360px]" eyebrow={`${day.dayType === "rest" ? "Rest day" : day.dayType === "hard" ? "Hard day" : "Training day"} · ${day.targets.kcal} kcal · ${day.targets.protein} g protein`}
          title={next ? <>Next up<br /><em>{hero?.name.split(" with ")[0]}</em></> : <>Day <em>complete.</em></>}
          right={<div className="seg"><button type="button" className="!min-h-9 !text-xs" aria-pressed={tab === "today"} onClick={() => setTab("today")}><span className="seg__label">Today</span></button><button type="button" className="!min-h-9 !text-xs" aria-pressed={tab === "groceries"} onClick={() => setTab("groceries")}><span className="seg__label">Groceries</span></button></div>}>
          {next && hero && <div className="flex items-center gap-2 mt-3 flex-wrap"><span className="chip chip--live backdrop-blur-md">{next.time}</span><span className="chip chip--live backdrop-blur-md tnum">{Math.round(hero.kcal * next.scale)} kcal</span><span className="chip chip--live backdrop-blur-md">{hero.minutes} min</span><Link href={`/food/${enc(hero.id)}?date=${day.date}`} className="pill pill--sm pill--volt ml-auto">Cook</Link></div>}
        </Hero>

        <AnimatePresence mode="wait">
          {tab === "today" ? (
            <motion.div key="today" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-x-10 lg:items-start">
              <div className="lg:order-2 lg:sticky lg:top-8">
              <div className="card p-4 grid gap-4 mb-4">
                <div className="grid grid-cols-[auto_1fr] gap-4 items-center">
                <Ring value={doneCount / Math.max(1, day.meals.length)} size={84} stroke={7}><span className="text-sm font-semibold tnum">{doneCount}/{day.meals.length}</span></Ring>
                <div className="grid gap-2">
                  <div className="flex justify-between items-baseline"><span className="meta">Calories</span><span className="tnum display text-2xl"><CountUp value={Math.round(t.kcal)} /><span className="text-sm text-smoke"> / {day.targets.kcal}</span></span></div>
                  <Bar value={t.kcal} max={day.targets.kcal} />
                </div>
                </div>
                <div className="grid gap-2">
                  <div className="grid grid-cols-3 gap-3 text-[11px] tnum">
                    <Macro label="Protein" v={t.protein} max={day.targets.protein} /><Macro label="Carbs" v={t.carbs} max={day.targets.carbs} /><Macro label="Fat" v={t.fat} max={day.targets.fat} />
                  </div>
                  <div className="flex gap-3 text-[11px] tnum"><span className={t.sugar > tg.sugarMax ? "text-danger" : "text-smoke"}>Sugar {Math.round(t.sugar)} / {tg.sugarMax} g max</span><span className={t.fiber >= tg.fiberMin ? "text-volt" : "text-smoke"}>Fibre {Math.round(t.fiber)} / {tg.fiberMin} g</span><span className="text-smoke ml-auto">Water {Math.round(day.waterMl / 100) / 10} L</span></div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 mb-4">
                <Link href="/food/browse" className="pill pill--sm">Browse {recipeCount().toLocaleString("en-US")}</Link>
                <button type="button" className="pill pill--sm" onClick={rebuildToday}>↻ New menu</button>
              </div>
              </div>

              <div className="lg:order-1 min-w-0">
              <Stagger className="grid gap-3">
                {day.meals.map((m, i) => {
                  const meal = getMeal(m.mealId); if (!meal) return null;
                  const key = `${m.slot}-${i}`;
                  return (
                    <Item key={key}>
                      <div className="grid grid-cols-[44px_minmax(0,1fr)] lg:grid-cols-[56px_minmax(0,1fr)] gap-3">
                        <div className="relative border-r border-line pr-3 pt-1 text-right"><span className="text-xs tnum text-smoke">{m.time}</span><span className={`absolute -right-[5px] top-2.5 w-[9px] h-[9px] rounded-full border-2 border-paper ${m.done ? "bg-volt" : "bg-line-strong"}`} /></div>
                        <div className={`card overflow-hidden transition-opacity ${m.done ? "opacity-55" : ""}`}>
                          <Link href={`/food/${enc(meal.id)}?date=${day.date}`} className="block relative h-44 lg:h-56">
                            <Photo src={meal.image} color veil className="absolute inset-0" />
                            <div className="on-photo absolute inset-x-0 bottom-0 p-4 lg:p-5 grid gap-1">
                              <span className="meta text-bone/80">{m.slot}{m.scale !== 1 ? ` · ×${m.scale}` : ""} · {meal.minutes} min</span>
                              <span className="display text-2xl lg:text-3xl leading-[.95]">{meal.name.split(" with ")[0]}</span>
                              {meal.name.includes(" with ") && <span className="text-sm text-bone/85">with {meal.name.split(" with ")[1]}</span>}
                            </div>
                          </Link>
                          <div className="grid grid-cols-4 divide-x divide-line border-t border-line text-center tnum">
                            <span className="py-2.5 grid"><strong className="text-base">{Math.round(meal.kcal * m.scale)}</strong><span className="meta">kcal</span></span>
                            <span className="py-2.5 grid"><strong className="text-base">{Math.round(meal.protein * m.scale)} g</strong><span className="meta">protein</span></span>
                            <span className="py-2.5 grid"><strong className="text-base">{Math.round(meal.carbs * m.scale)} g</strong><span className="meta">carbs</span></span>
                            <span className="py-2.5 grid"><strong className="text-base">{Math.round(meal.sugar * m.scale)} g</strong><span className="meta">sugar</span></span>
                          </div>
                          <div className="flex items-center gap-2 p-3 border-t border-line">
                            <Link href={`/food/${enc(meal.id)}?date=${day.date}`} className="pill pill--sm pill--bone">Cook</Link>
                            <button type="button" className="pill pill--sm" onClick={() => openSwap(m)}>Swap</button>
                            <span className="ml-auto"><Check on={!!m.done} onToggle={() => toggleDone(m)} label={m.done ? "Unlog meal" : "Log meal"} /></span>
                          </div>
                        </div>
                      </div>
                    </Item>
                  );
                })}
              </Stagger>

              <AnimatePresence>{swapFor && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="card p-4 mt-4 grid gap-2">
                  <div className="flex justify-between items-baseline"><span className="meta">Best fits for your {swapFor.slot} · {profile.goal}</span><button type="button" className="text-xs text-smoke underline" onClick={() => setSwaps(swapOptions(profile, day, swapFor))}>Shuffle</button></div>
                  {swaps.map((m) => (
                    <button key={m.id} type="button" className="flex items-center gap-3 p-2 rounded-xl border border-line text-left" onClick={() => { const c = { ...checked }; delete c[m.id]; setChecked(c); doSwap(m.id); }}>
                      <Photo src={m.image} color className="thumb !w-12 !h-12" /><span className="flex-1 text-sm font-medium leading-tight">{m.name}</span><span className="text-xs text-smoke tnum text-right">{m.kcal} kcal<br />{m.protein} P · {m.sugar} S</span>
                    </button>
                  ))}
                  <div className="flex justify-between"><Link href={`/food/browse?slot=${swapFor.slot}&date=${day.date}`} className="text-xs underline text-smoke">Browse all</Link><button type="button" className="text-xs text-smoke underline" onClick={() => setSwapFor(null)}>Cancel</button></div>
                </motion.div>
              )}</AnimatePresence>
              </div>
            </motion.div>
          ) : (
            <motion.div key="groceries" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-x-10 lg:items-start">
              <Section title={`Next ${week.length} day${week.length > 1 ? "s" : ""}`} aside={<Press><button type="button" className="pill pill--sm" onClick={buildWeek}>Plan the week</button></Press>}>
                {week.length < 2 ? (
                  <div className="card p-5 grid gap-2"><p className="display text-2xl">One list. <em>Whole week.</em></p><p className="text-sm text-smoke">Plan the week and every meal’s ingredients land here — no repeats, portions scaled to each day.</p></div>
                ) : (
                  <ul className="grid divide-y divide-line card px-4">{groceryList(week).map((g) => (
                    <li key={g.item} className="py-3 flex items-center gap-3 text-sm">
                      <Check on={!!checked[g.item]} onToggle={() => setChecked({ ...checked, [g.item]: !checked[g.item] })} label={g.item} />
                      <span className={`flex-1 ${checked[g.item] ? "line-through text-smoke" : ""}`}>{g.item}</span>
                      <span className="text-xs text-smoke text-right tnum">{g.qty.join(" + ") || "—"}</span>
                    </li>))}</ul>
                )}
              </Section>
              {week.length > 1 && (
                <Section title="The week">
                  <div className="grid gap-2">{week.map((d) => { const first = getMeal(d.meals[0]?.mealId); return (
                    <div key={d.id} className="card flex items-center gap-3 p-2">{first && <Photo src={first.image} color className="thumb" />}<div className="flex-1 min-w-0"><p className="text-sm font-medium">{new Date(d.date + "T00:00:00").toLocaleDateString("en-US", { weekday: "long" })}</p><p className="text-xs text-smoke truncate">{d.dayType} day · {d.meals.map((m) => getMeal(m.mealId)?.name.split(/ with | and |,/)[0]).slice(0, 3).join(" · ")}</p></div><span className="tnum text-xs text-smoke">{d.targets.kcal}</span></div>); })}</div>
                </Section>
              )}
            </motion.div>
          )}
        </AnimatePresence>
        <Toast text={toast} />
      </Screen>
    </Page>
  );
}

function Macro({ label, v, max }: { label: string; v: number; max: number }) {
  return <div className="grid gap-1"><span className="flex justify-between"><span className="text-smoke">{label}</span><span>{Math.round(v)}/{max}</span></span><Bar value={v} max={max} /></div>;
}
