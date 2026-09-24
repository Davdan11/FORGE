"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { db, getProfile, todayISO, addDays } from "@/lib/db";
import { getMeal, recipeCount } from "@/lib/nutrition/recipes";
import { buildNutritionDay, dayTotals, eatenTotals, groceryList, swapOptions, dailyTargets, retuneDay, DAY_TYPE_LABEL, SLOT_LABEL, NOTE_LABEL } from "@/lib/nutrition/engine";
import { useT, useLang, locale } from "@/lib/i18n";
import { NumbersExplained } from "@/components/NumbersExplained";
import { awardMeal } from "@/lib/progress";
import { ART } from "@/lib/data/images";
import { Screen, Hero, Section, Bar, Toast, Photo, Check, ScreenSkeleton, Seg } from "@/components/ui";
import { Page, Stagger, Item, Press, Ring, CountUp, motion, AnimatePresence } from "@/components/motion";
import type { DayPlanMeal, Meal, NutritionDay } from "@/lib/types";

const enc = (id: string) => encodeURIComponent(id);
/** The goal as a French reader sees it; English shows the key as before. */
const GOAL_FR: Record<string, string> = { strength: "force", build: "prise de masse", recomp: "recompo", cut: "sèche", endurance: "endurance", perform: "performance" };

export default function FoodPage() {
  const today = todayISO();
  const profile = useLiveQuery(() => getProfile(), []);
  const day = useLiveQuery(() => db.nutrition.get(today).then((d) => d ?? null), [today]);
  const week = useLiveQuery(() => db.nutrition.where("date").between(today, addDays(today, 6), true, true).toArray(), [today]) ?? [];
  const [tab, setTab] = useState<"today" | "groceries">("today");
  const [swapFor, setSwapFor] = useState<DayPlanMeal | null>(null);
  const [swaps, setSwaps] = useState<Meal[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const t = useT();
  const lang = useLang();
  const L = (l: { fr: string; en: string }) => l[lang];

  // No menu for today yet (first visit of a new day): build it from the plan.
  useEffect(() => {
    if (!profile || day !== null) return;
    (async () => {
      const s = await db.sessions.where("date").equals(today).first();
      const recent = (await db.nutrition.where("date").between(addDays(today, -3), addDays(today, -1), true, true).toArray()).flatMap((d) => d.meals.map((m) => m.mealId));
      const yesterday = await db.nutrition.get(addDays(today, -1));
      await db.nutrition.put({ ...buildNutritionDay(profile, today, s ?? null, yesterday ?? undefined, recent), dirty: 1 });
    })();
  }, [profile, day, today]);

  if (!profile || day === undefined) return <ScreenSkeleton />;
  if (!day) return <ScreenSkeleton />;
  const eaten = eatenTotals(day);           // what is ticked off
  const planned = dayTotals(day);       // what the day is built to deliver
  const tg = dailyTargets(profile, day.dayType);
  const next = day.meals.find((m) => !m.done);
  const hero = next ? getMeal(next.mealId) : getMeal(day.meals[0]?.mealId);
  const doneCount = day.meals.filter((m) => m.done).length;

  async function toggleDone(m: DayPlanMeal) {
    const meals = day!.meals.map((x) => (x === m ? { ...x, done: !x.done } : x));
    await db.nutrition.update(day!.id, { meals, dirty: 1 });
    if (!m.done) { const full = meals.every((x) => x.done); const xp = await awardMeal(full, day!.meals.indexOf(m), day!.date); setToast(t(`${getMeal(m.mealId)?.name} : noté.${xp ? ` +${xp} XP` : ""}${full && xp > 15 ? " — journée complète, bonus!" : ""}`, `${getMeal(m.mealId)?.name} logged.${xp ? ` +${xp} XP` : ""}${full && xp > 15 ? " — full day, bonus!" : ""}`)); setTimeout(() => setToast(null), 3000); }
  }
  function openSwap(m: DayPlanMeal) { setSwapFor(m); setSwaps(swapOptions(profile!, day!, m)); }
  async function doSwap(to: string) {
    if (!swapFor) return;
    // Re-balance every portion around the new plate, so the day still adds up.
    const swapped = retuneDay(profile!, { ...day!, meals: day!.meals.map((x) => (x === swapFor ? { ...x, mealId: to, done: false } : x)) });
    await db.nutrition.update(day!.id, { meals: swapped.meals, dirty: 1 });
    setSwapFor(null);
  }
  async function rebuildToday() {
    const recent = (await db.nutrition.where("date").between(addDays(today, -3), addDays(today, -1), true, true).toArray()).flatMap((d) => d.meals.map((m) => m.mealId));
    const s = await db.sessions.where("date").equals(today).first();
    const nd = buildNutritionDay(profile!, today, s ?? null, undefined, [...recent, ...day!.meals.map((m) => m.mealId)]);
    await db.nutrition.put({ ...nd, dirty: 1 });
    setToast(t("Nouveau menu pour aujourd’hui.", "New menu for today.")); setTimeout(() => setToast(null), 2500);
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
        <Hero image={next && hero?.image ? hero.image : ART.food} color height="h-[360px]" eyebrow={`${L(DAY_TYPE_LABEL[day.dayType])} · ${day.targets.kcal.toLocaleString(locale())} kcal · ${day.targets.protein} g ${t("de protéines", "protein")}`}
          title={next ? <>{t("À venir", "Next up")}<br /><em>{hero?.name.split(" with ")[0]}</em></> : lang === "fr" ? <>Journée <em>complétée.</em></> : <>Day <em>complete.</em></>}
          right={<Seg value={tab} onChange={setTab} options={[{ v: "today", label: t("Aujourd’hui", "Today") }, { v: "groceries", label: t("Épicerie", "Groceries") }]} />}>
          {next && hero && <div className="flex items-center gap-2 mt-3 flex-wrap"><span className="chip chip--live backdrop-blur-md">{next.time}</span><span className="chip chip--live backdrop-blur-md tnum">{Math.round(hero.kcal * next.scale)} kcal</span><span className="chip chip--live backdrop-blur-md">{hero.minutes} min</span><Link href={`/food/meal?id=${enc(hero.id)}&date=${day.date}`} className="pill pill--sm pill--volt ml-auto">{t("Cuisiner", "Cook")}</Link></div>}
        </Hero>

        <AnimatePresence mode="wait">
          {tab === "today" ? (
            <motion.div key="today" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="xl:grid xl:grid-cols-[minmax(0,1fr)_var(--rail)] xl:gap-x-12 xl:items-start">
              <div className="xl:order-2 xl:sticky xl:top-10">
              <div className="card p-4 grid gap-4 mb-4">
                <div className="grid grid-cols-[auto_1fr] gap-4 items-center">
                <Ring value={doneCount / Math.max(1, day.meals.length)} size={84} stroke={7}><span className="text-sm font-semibold tnum">{doneCount}/{day.meals.length}</span></Ring>
                <div className="grid gap-2">
                  <div className="flex justify-between items-baseline"><span className="meta">{t("Calories mangées", "Calories eaten")}</span><span className="tnum display text-2xl"><CountUp value={Math.round(eaten.kcal)} /><span className="text-sm text-smoke"> / {day.targets.kcal}</span></span></div>
                  <Bar value={eaten.kcal} max={day.targets.kcal} />
                  <p className="text-[11px] text-smoke tnum">
                    {doneCount === day.meals.length
                      ? t("Journée complétée.", "Day complete.")
                      : t(`${Math.max(0, Math.round(day.targets.kcal - eaten.kcal)).toLocaleString(locale())} kcal restantes · le menu du jour en donne ${Math.round(planned.kcal).toLocaleString(locale())}.`, `${Math.max(0, Math.round(day.targets.kcal - eaten.kcal)).toLocaleString(locale())} kcal left · today's menu delivers ${Math.round(planned.kcal).toLocaleString(locale())}.`)}
                  </p>
                </div>
                </div>
                <div className="grid gap-2">
                  <div className="grid grid-cols-3 gap-3 text-[11px] tnum">
                    <Macro label={t("Protéines", "Protein")} v={eaten.protein} max={day.targets.protein} /><Macro label={t("Glucides", "Carbs")} v={eaten.carbs} max={day.targets.carbs} /><Macro label={t("Lipides", "Fat")} v={eaten.fat} max={day.targets.fat} />
                  </div>
                  <div className="flex gap-3 text-[11px] tnum"><span className={eaten.sugar > tg.sugarMax ? "text-danger" : "text-smoke"}>{t("Sucre", "Sugar")} {Math.round(eaten.sugar)} / {tg.sugarMax} g max</span><span className={eaten.fiber >= tg.fiberMin ? "text-volt" : "text-smoke"}>{t("Fibres", "Fiber")} {Math.round(eaten.fiber)} / {tg.fiberMin} g</span><span className="text-smoke ml-auto">{t("Eau", "Water")} {(Math.round(day.waterMl / 100) / 10).toLocaleString(locale())} L</span></div>
                </div>
              </div>
              <div className="mb-4"><NumbersExplained profile={profile} dayType={day.dayType} /></div>
              <div className="grid grid-cols-2 gap-2 mb-4">
                <Link href="/food/browse" className="pill pill--sm">{t(`Parcourir ${recipeCount().toLocaleString(locale())} recettes`, `Browse ${recipeCount().toLocaleString(locale())} recipes`)}</Link>
                <button type="button" className="pill pill--sm" onClick={rebuildToday}>↻ {t("Nouveau menu", "New menu")}</button>
              </div>
              </div>

              <div className="xl:order-1 min-w-0">
              <Stagger className="grid gap-3">
                {day.meals.map((m, i) => {
                  const meal = getMeal(m.mealId); if (!meal) return null;
                  const key = `${m.slot}-${i}`;
                  return (
                    <Item key={key}>
                      <div className="grid grid-cols-[44px_minmax(0,1fr)] lg:grid-cols-[56px_minmax(0,1fr)] gap-3">
                        <div className="relative border-r border-line pr-3 pt-1 text-right"><span className="text-xs tnum text-smoke">{m.time}</span><span className={`absolute -right-[5px] top-2.5 w-[9px] h-[9px] rounded-full border-2 border-paper ${m.done ? "bg-volt" : "bg-line-strong"}`} /></div>
                        <div className={`card overflow-hidden transition-opacity ${m.done ? "opacity-55" : ""}`}>
                          <Link href={`/food/meal?id=${enc(meal.id)}&date=${day.date}`} className="block relative h-44 md:h-52 lg:h-56">
                            <Photo src={meal.image} color veil className="absolute inset-0" />
                            <div className="on-photo absolute inset-x-0 bottom-0 p-4 lg:p-5 grid gap-1">
                              <span className="meta text-bone/80">{m.note ? <span className="font-bold" style={{ color: "#c6f432" }}>{NOTE_LABEL[m.note] ? L(NOTE_LABEL[m.note]) : m.note}</span> : t(SLOT_LABEL[m.slot].fr, m.slot === "pre" ? "Pre-workout" : m.slot === "post" ? "Recovery" : m.slot)}{m.scale !== 1 ? ` · ×${m.scale}` : ""} · {meal.minutes} min</span>
                              <span className="display text-2xl lg:text-3xl leading-[.95]">{meal.name.split(" with ")[0]}</span>
                              {meal.name.includes(" with ") && <span className="text-sm text-bone/85">{t("avec", "with")} {meal.name.split(" with ")[1]}</span>}
                            </div>
                          </Link>
                          <div className="grid grid-cols-4 divide-x divide-line border-t border-line text-center tnum">
                            <span className="py-2.5 grid"><strong className="text-base">{Math.round(meal.kcal * m.scale)}</strong><span className="meta">kcal</span></span>
                            <span className="py-2.5 grid"><strong className="text-base">{Math.round(meal.protein * m.scale)} g</strong><span className="meta">{t("protéines", "protein")}</span></span>
                            <span className="py-2.5 grid"><strong className="text-base">{Math.round(meal.carbs * m.scale)} g</strong><span className="meta">{t("glucides", "carbs")}</span></span>
                            <span className="py-2.5 grid"><strong className="text-base">{Math.round(meal.sugar * m.scale)} g</strong><span className="meta">{t("sucre", "sugar")}</span></span>
                          </div>
                          <div className="flex items-center gap-2 p-3 border-t border-line">
                            <Link href={`/food/meal?id=${enc(meal.id)}&date=${day.date}`} className="pill pill--sm pill--bone">{t("Cuisiner", "Cook")}</Link>
                            <button type="button" className="pill pill--sm" onClick={() => openSwap(m)}>{t("Changer", "Swap")}</button>
                            <span className="ml-auto"><Check on={!!m.done} onToggle={() => toggleDone(m)} label={m.done ? t("Annuler le repas", "Unlog meal") : t("Noter le repas", "Log meal")} /></span>
                          </div>
                        </div>
                      </div>
                    </Item>
                  );
                })}
              </Stagger>

              <AnimatePresence>{swapFor && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="card p-4 mt-4 grid gap-2">
                  <div className="flex justify-between items-baseline"><span className="meta">{lang === "fr" ? `Meilleurs choix · ${SLOT_LABEL[swapFor.slot].fr.toLowerCase()} · ${GOAL_FR[profile.goal] ?? profile.goal}` : <>Best fits for your {swapFor.slot} · {profile.goal}</>}</span><button type="button" className="text-xs text-smoke underline" onClick={() => setSwaps(swapOptions(profile, day, swapFor))}>{t("Mélanger", "Shuffle")}</button></div>
                  {swaps.map((m) => (
                    <button key={m.id} type="button" className="flex items-center gap-3 p-2 rounded-xl border border-line text-left" onClick={() => { const c = { ...checked }; delete c[m.id]; setChecked(c); doSwap(m.id); }}>
                      <Photo src={m.image} color className="thumb !w-12 !h-12" /><span className="flex-1 text-sm font-medium leading-tight">{m.name}</span><span className="text-xs text-smoke tnum text-right">{m.kcal} kcal<br />{m.protein} P · {m.sugar} S</span>
                    </button>
                  ))}
                  <div className="flex justify-between"><Link href={`/food/browse?slot=${swapFor.slot}&date=${day.date}`} className="text-xs underline text-smoke">{t("Tout parcourir", "Browse all")}</Link><button type="button" className="text-xs text-smoke underline" onClick={() => setSwapFor(null)}>{t("Annuler", "Cancel")}</button></div>
                </motion.div>
              )}</AnimatePresence>
              </div>
            </motion.div>
          ) : (
            <motion.div key="groceries" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="xl:grid xl:grid-cols-[minmax(0,1fr)_var(--rail)] xl:gap-x-12 xl:items-start">
              <Section title={t(week.length > 1 ? `${week.length} prochains jours` : "Prochain jour", `Next ${week.length} day${week.length > 1 ? "s" : ""}`)} aside={<Press><button type="button" className="pill pill--sm" onClick={buildWeek}>{t("Planifier la semaine", "Plan the week")}</button></Press>}>
                {week.length < 2 ? (
                  <div className="card p-5 grid gap-2"><p className="display text-2xl">{t("Une liste.", "One list.")} <em>{t("Toute la semaine.", "Whole week.")}</em></p><p className="text-sm text-smoke">{t("Planifie la semaine et les ingrédients de chaque repas atterrissent ici — pas de répétitions, portions ajustées à chaque jour.", "Plan the week and every meal’s ingredients land here — no repeats, portions scaled to each day.")}</p></div>
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
                <Section title={t("La semaine", "The week")}>
                  <div className="grid gap-2">{week.map((d) => { const first = getMeal(d.meals[0]?.mealId); return (
                    <div key={d.id} className="card flex items-center gap-3 p-2">{first && <Photo src={first.image} color className="thumb" />}<div className="flex-1 min-w-0"><p className="text-sm font-medium">{new Date(d.date + "T00:00:00").toLocaleDateString(locale(), { weekday: "long" })}</p><p className="text-xs text-smoke truncate">{lang === "fr" ? L(DAY_TYPE_LABEL[d.dayType]).toLowerCase() : `${d.dayType} day`} · {d.meals.map((m) => getMeal(m.mealId)?.name.split(/ with | and |,/)[0]).slice(0, 3).join(" · ")}</p></div><span className="tnum text-xs text-smoke">{d.targets.kcal}</span></div>); })}</div>
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
