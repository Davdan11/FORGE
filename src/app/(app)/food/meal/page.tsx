"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { db, getProfile, type NutritionDayRow } from "@/lib/db";
import { dailyTargets } from "@/lib/nutrition/engine";
import { getMeal } from "@/lib/nutrition/recipes";
import { awardMeal } from "@/lib/progress";
import { fmtDuration, localizeCooking } from "@/lib/units";
import { Screen, Hero, Section, Empty, Check, Toast, ScreenSkeleton } from "@/components/ui";
import { Page, Stagger, Item, Press, Ring, motion, AnimatePresence } from "@/components/motion";

/* The id arrives as a query parameter, not as a path segment.

   A static export writes one file per route, and these ids only exist once
   somebody has trained — there is nothing to pre-render. A query parameter
   needs no file of its own, so the same page serves every id and the iOS and
   Android builds get a route they can actually ship. */
export default function RecipePage() {
  return <Suspense fallback={<ScreenSkeleton />}><Recipe /></Suspense>;
}

function Recipe() {
  const params = useSearchParams();
  const id = params.get("id") ?? "";
  const router = useRouter();
  const date = params.get("date");
  const meal = getMeal(decodeURIComponent(id));
  const day = useLiveQuery(async (): Promise<NutritionDayRow | undefined> => (date ? db.nutrition.get(date) : undefined), [date]);
  const planned = day?.meals.find((m) => m.mealId === id);
  const profile = useLiveQuery(() => getProfile(), []);
  const scale = planned?.scale ?? 1;
  const [have, setHave] = useState<Record<number, boolean>>({});
  const [cook, setCook] = useState(false);
  const [step, setStep] = useState(0);
  const [timer, setTimer] = useState<number | null>(null);
  const [timerTotal, setTimerTotal] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

  const running = timer != null && timer > 0;
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setTimer((x) => { if (x == null) return null; if (x <= 1) { if (navigator.vibrate) navigator.vibrate([200, 100, 200]); return 0; } return x - 1; }), 1000);
    return () => clearInterval(t);
  }, [running]);

  if (!meal) return <Screen><Empty title="Recipe not found" body="This recipe isn’t in the collection." cta="Back to food" href="/food" /></Screen>;
  const minutesIn = (s: string) => { const m = s.match(/(\d+(?:\.\d+)?)\s*min/); return m ? Math.round(Number(m[1]) * 60) : (s.match(/(\d+)\s*s\b/) ? Number(s.match(/(\d+)\s*s\b/)![1]) : null); };

  async function logIt() {
    if (!day || !planned) { router.push("/food"); return; }
    if (!planned.done) {
      const meals = day.meals.map((m) => (m === planned ? { ...m, done: true } : m));
      await db.nutrition.update(day.id, { meals, dirty: 1 });
      const xp = await awardMeal(meals.every((m) => m.done), day.meals.indexOf(planned), day.date);
      setToast(xp ? `Logged. +${xp} XP.` : "Logged.");
      setTimeout(() => router.push("/food"), 1200);
    } else router.push("/food");
  }

  return (
    <Page>
      <Screen>
        <Hero image={meal.image} color height="h-[400px]" back="/food" eyebrow={[meal.cuisine ?? "Recipe", `${meal.minutes} min`, ...meal.slot.filter((sl) => sl.toLowerCase() !== (meal.cuisine ?? "").toLowerCase())].join(" · ")} title={<>{meal.name}</>}>
          <div className="flex flex-wrap gap-1.5 mt-3">
            <span className="chip chip--volt tnum">{Math.round(meal.kcal * scale)} kcal</span>
            <span className="chip chip--live backdrop-blur-md tnum">Protein {Math.round(meal.protein * scale)} g</span>
            <span className="chip chip--live backdrop-blur-md tnum">Carbs {Math.round(meal.carbs * scale)} g</span>
            <span className="chip chip--live backdrop-blur-md tnum">Fat {Math.round(meal.fat * scale)} g</span>
            {scale !== 1 && <span className="chip chip--live backdrop-blur-md">×{scale} portion</span>}
            {meal.tags.filter((t) => t !== "quick" && t !== "batch").map((t) => <span key={t} className="chip chip--live backdrop-blur-md">{t.replace("_", "-")}</span>)}
          </div>
        </Hero>

        <Stagger>
          <Item>
            <div className="flex gap-3 mb-6">
              <Press className="flex-1"><button type="button" className="pill pill--volt pill--block" onClick={() => { setCook(true); setStep(0); }}>Start cooking</button></Press>
              {planned && <Press><button type="button" className="pill" onClick={logIt}>{planned.done ? "Logged ✓" : "Log meal"}</button></Press>}
            </div>
          </Item>

          {profile && day && planned && (() => {
            const t = dailyTargets(profile, day.dayType);
            const n = day.meals.length;
            const kcal = meal.kcal * scale, protein = meal.protein * scale, sugar = meal.sugar * scale, carbs = meal.carbs * scale;
            const pDensity = Math.round((meal.protein * 4) / Math.max(1, meal.kcal) * 100);
            const sugarShare = Math.round(t.sugarMax / n);
            const goalWhy = ({ cut: `${pDensity}% of its calories are protein — keeps you full in a deficit.`, recomp: `${pDensity}% protein calories: enough to hold muscle while you lean out.`, build: `${Math.round(carbs)} g carbs to fuel volume; protein to grow from it.`, strength: `${Math.round(protein)} g protein and real carbs — heavy sessions need both.`, endurance: `${Math.round(carbs)} g carbs first: your engine runs on them.`, perform: `Carbs for the work, protein to recover, timed ${planned.time}.` } as Record<string, string>)[profile.goal] ?? "";
            return (
              <Item>
                <div className="card p-4 mb-6 grid gap-3">
                  <div className="flex items-center justify-between"><span className="meta">Why this, today</span><span className="chip chip--live">{day.dayType} day · {planned.time}</span></div>
                  <ul className="grid gap-2 text-sm">
                    <li className="flex gap-3"><span className="w-1.5 h-1.5 rounded-full bg-volt mt-2 shrink-0" /><span><strong className="tnum">{Math.round(protein)} g protein</strong> — {Math.round((protein / t.protein) * 100)}% of today’s {t.protein} g. {goalWhy}</span></li>
                    <li className="flex gap-3"><span className="w-1.5 h-1.5 rounded-full bg-volt mt-2 shrink-0" /><span><strong className="tnum">{Math.round(kcal)} kcal</strong> — {Math.round((kcal / t.kcal) * 100)}% of your {t.kcal} kcal, sized ×{scale} for this slot.</span></li>
                    <li className="flex gap-3"><span className={`w-1.5 h-1.5 rounded-full mt-2 shrink-0 ${sugar <= sugarShare ? "bg-volt" : "bg-danger"}`} /><span><strong className="tnum">{Math.round(sugar)} g sugar</strong> — {sugar <= sugarShare ? "inside" : "over"} your per-meal share of {sugarShare} g ({t.sugarMax} g a day max).{meal.fiber ? ` ${Math.round(meal.fiber * scale)} g fiber.` : ""}</span></li>
                  </ul>
                  {meal.tip && <p className="text-sm text-smoke border-t border-line pt-3">{localizeCooking(meal.tip, profile.units)}</p>}
                </div>
              </Item>
            );
          })()}
          {(!profile || !day || !planned) && meal.tip && <Item><div className="card p-4 mb-6 flex gap-3"><span className="display text-volt text-2xl">!</span><p className="text-sm">{localizeCooking(meal.tip, profile?.units ?? "kg")}</p></div></Item>}

          <Item>
            <Section title="Ingredients" aside={<span className="text-xs text-smoke">{Object.values(have).filter(Boolean).length}/{meal.ingredients.length} ready</span>}>
              <ul className="card divide-y divide-line px-4">
                {meal.ingredients.map((ing, i) => (
                  <li key={ing.item} className="py-3 flex items-center gap-3 text-sm">
                    <Check on={!!have[i]} onToggle={() => setHave({ ...have, [i]: !have[i] })} label={ing.item} />
                    <span className={`flex-1 ${have[i] ? "line-through text-smoke" : ""}`}>{ing.item}</span>
                    <span className="text-xs text-smoke tnum">{ing.qty ? (scale !== 1 ? `${ing.qty} ×${scale}` : ing.qty) : ""}</span>
                  </li>
                ))}
              </ul>
            </Section>
          </Item>

          <Item>
            <Section title="Method">
              <ol className="grid gap-3">
                {meal.steps.map((s, i) => { const sec = minutesIn(s); return (
                  <li key={s} className="card p-4 flex gap-4"><span className="display text-2xl text-volt tnum w-7">{i + 1}</span><div className="grid gap-1 flex-1"><p className="text-sm">{localizeCooking(s, profile?.units ?? "kg")}</p>{sec && <span className="chip justify-self-start">⏱ {fmtDuration(sec)}</span>}</div></li>); })}
              </ol>
            </Section>
          </Item>
        </Stagger>

        <AnimatePresence>{cook && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] bg-ink text-bone flex flex-col">
            <div className="flex items-center justify-between px-5 pt-[calc(var(--safe-top)+16px)] pb-3">
              <button type="button" className="chip chip--live" onClick={() => { setCook(false); setTimer(null); }}>✕ Close</button>
              <span className="meta">Step {step + 1} / {meal.steps.length}</span>
              <span className="chip">{meal.minutes} min</span>
            </div>
            <div className="px-5"><div className="bar"><motion.i animate={{ width: `${((step + 1) / meal.steps.length) * 100}%` }} /></div></div>
            <AnimatePresence mode="wait">
              <motion.div key={step} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }} className="flex-1 grid content-center gap-6 px-6">
                <span className="numeral text-volt">{step + 1}</span>
                <p className="cook-step">{localizeCooking(meal.steps[step], profile?.units ?? "kg")}</p>
                {(() => { const sec = minutesIn(meal.steps[step]); if (!sec) return null; return (
                  <div className="flex items-center gap-4">
                    <Ring value={timerTotal ? 1 - (timer ?? timerTotal) / timerTotal : 0} size={88} stroke={7} color={timer === 0 ? "var(--danger)" : "var(--volt)"}><span className="text-sm font-semibold tnum">{fmtDuration(timer ?? sec)}</span></Ring>
                    {timer == null || timer === 0 ? <button type="button" className="pill pill--bone" onClick={() => { setTimerTotal(sec); setTimer(sec); }}>{timer === 0 ? "Done — restart" : "Start timer"}</button> : <button type="button" className="pill" onClick={() => setTimer(null)}>Stop</button>}
                  </div>); })()}
              </motion.div>
            </AnimatePresence>
            <div className="flex gap-3 p-5 pb-[calc(var(--safe-bottom)+20px)]">
              <button type="button" className="pill flex-1" disabled={step === 0} onClick={() => { setStep(step - 1); setTimer(null); }}>Back</button>
              {step < meal.steps.length - 1 ? <button type="button" className="pill pill--volt flex-1" onClick={() => { setStep(step + 1); setTimer(null); }}>Next step</button> : <button type="button" className="pill pill--volt flex-1" onClick={() => { setCook(false); logIt(); }}>Plate & log</button>}
            </div>
          </motion.div>
        )}</AnimatePresence>
        <Toast text={toast} />
      </Screen>
    </Page>
  );
}
