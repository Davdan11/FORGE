"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { db, todayISO, uid } from "@/lib/db";
import { generatePlan } from "@/lib/engine/plan";
import { adaptationsFor } from "@/lib/engine/injury";
import { buildNutritionDay } from "@/lib/nutrition/engine";
import { lbToKg } from "@/lib/units";
import { IMG, sessionImage } from "@/lib/data/images";
import { Seg, MultiSeg, Photo } from "@/components/ui";
import { motion, AnimatePresence, Press } from "@/components/motion";
import type { Equipment, Goal, Level, PainArea, Profile, Sex, UnitPrefs } from "@/lib/types";

const STEPS = ["You", "Goal", "Schedule", "Gear", "Baselines", "Food"] as const;
const CLAIMS = ["We measure before we prescribe.", "One goal. Everything follows.", "The week you actually have.", "Train with what is in front of you.", "Honest numbers make a better block.", "Fuel is part of the plan."];
const GOALS: { v: Goal; name: string; line: string; image: string }[] = [
  { v: "strength", name: "Get strong", line: "Heavy compounds, low reps, long rests.", image: sessionImage("lower", 600, 600) },
  { v: "build", name: "Build muscle", line: "Volume, tempo, food to grow.", image: sessionImage("upper", 600, 600) },
  { v: "recomp", name: "Recomp", line: "Lift hard, eat at maintenance, lean out slowly.", image: IMG.weight },
  { v: "cut", name: "Lose fat", line: "Keep strength, run a small deficit.", image: sessionImage("cardio_intervals", 600, 600) },
  { v: "endurance", name: "Endurance", line: "Zone 2 base, intervals, strength to stay durable.", image: sessionImage("cardio_z2", 600, 600) },
  { v: "perform", name: "Perform for a date", line: "Peak for an event on the calendar.", image: IMG.city },
];
const PHOTOS = [IMG.onboarding, IMG.dark, IMG.progress, IMG.group, IMG.moveEmpty, "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=1200&h=800&fit=crop&q=75&auto=format"];

export default function Onboarding() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [busy, setBusy] = useState(false);
  const [units, setUnits] = useState<UnitPrefs>({ weight: "kg", distance: "km" });
  const [name, setName] = useState("");
  const [sex, setSex] = useState<Sex>("male");
  const [age, setAge] = useState(30);
  const [height, setHeight] = useState(175);
  const [weight, setWeight] = useState(78);
  const [goal, setGoal] = useState<Goal>("build");
  const [level, setLevel] = useState<Level>("intermediate");
  const [eventName, setEventName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [days, setDays] = useState<Profile["daysPerWeek"]>(4);
  const [minutes, setMinutes] = useState<Profile["sessionMinutes"]>(60);
  const [trainTime, setTrainTime] = useState("18:00");
  const [wakeTime, setWakeTime] = useState("07:00");
  const [equipment, setEquipment] = useState<Equipment[]>(["barbell", "dumbbell", "rack", "bench", "cable", "pullup_bar", "outdoor"]);
  const [pain, setPain] = useState<PainArea[]>([]);
  const [squat, setSquat] = useState(""); const [hinge, setHinge] = useState(""); const [push, setPush] = useState("");
  const [pullReps, setPullReps] = useState(""); const [plank, setPlank] = useState(""); const [run12, setRun12] = useState("");
  const [hip, setHip] = useState(3); const [shoulder, setShoulder] = useState(3); const [ankle, setAnkle] = useState(3);
  const [dietary, setDietary] = useState<Profile["dietary"]>([]);
  const [mealsPerDay, setMealsPerDay] = useState<Profile["mealsPerDay"]>(4);

  const kg = (v: string) => (v === "" ? undefined : units.weight === "lb" ? lbToKg(Number(v)) : Number(v));
  const canNext = useMemo(() => (step === 0 ? name.trim().length > 0 : true), [step, name]);
  const go = (n: number) => { setDir(n > step ? 1 : -1); setStep(n); };

  const [stage, setStage] = useState(-1);
  async function finish() {
    setBusy(true);
    // Cinematic build: staged messages while the engine works.
    for (let i = 0; i < 4; i++) { setStage(i); await new Promise((r) => setTimeout(r, 650)); }
    const profile: Profile = {
      id: uid(), name: name.trim(), sex, age, units, goal, level,
      heightCm: units.weight === "lb" ? height * 2.54 : height, weightKg: units.weight === "lb" ? lbToKg(weight) : weight,
      daysPerWeek: days, sessionMinutes: minutes, equipment, pain,
      eventName: goal === "perform" && eventName ? eventName : undefined, eventDate: goal === "perform" && eventDate ? eventDate : undefined,
      baselines: { squatE1rm: kg(squat), hingeE1rm: kg(hinge), pushE1rm: kg(push), pullReps: pullReps ? Number(pullReps) : undefined, plankSec: plank ? Number(plank) : undefined, run12minM: run12 ? Number(run12) * (units.distance === "mi" ? 1609.344 : 1000) : undefined, hipScreen: hip * 20, shoulderScreen: shoulder * 20, ankleScreen: ankle * 20 },
      dietary, mealsPerDay, wakeTime, trainTime, notifications: false, createdAt: new Date().toISOString(),
    };
    const { plan, sessions } = generatePlan(profile, todayISO(), {}, adaptationsFor(await db.injuries.toArray(), todayISO()));
    await db.transaction("rw", db.profile, db.plans, db.sessions, db.nutrition, async () => {
      await db.profile.put({ ...profile, dirty: 1, updatedAt: new Date().toISOString() });
      await db.plans.put({ ...plan, dirty: 1 });
      await db.sessions.bulkPut(sessions.map((s) => ({ ...s, dirty: 1 })));
      const today = todayISO();
      await db.nutrition.put({ ...buildNutritionDay(profile, today, sessions.find((x) => x.date === today) ?? null), dirty: 1 });
    });
    router.replace("/today");
  }

  const unitW = units.weight;
  const unitH = units.weight === "lb" ? "in" : "cm";
  const variants = { enter: (d: number) => ({ opacity: 0, x: d * 40 }), center: { opacity: 1, x: 0 }, exit: (d: number) => ({ opacity: 0, x: d * -40 }) };

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[minmax(0,1fr)_560px]">
      {/* Photo side: full height on desktop, header on mobile */}
      <div className="relative h-[240px] lg:h-dvh lg:sticky lg:top-0 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, scale: 1.04 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }} className="absolute inset-0"><Photo src={PHOTOS[step]} veil className="absolute inset-0" /></motion.div>
        </AnimatePresence>
        <span className="on-photo absolute top-[calc(var(--safe-top)+16px)] left-5 lg:top-8 lg:left-8 display text-lg lg:text-2xl">FORGE<span className="text-volt">.</span></span>
        <div className="on-photo absolute inset-x-0 bottom-0 px-5 pb-4 lg:px-10 lg:pb-10 grid gap-3">
          <p className="hidden md:block display display--lg leading-[0.95] max-w-[12ch]" style={{ fontSize: "var(--text-display-lg)" }}><AnimatePresence mode="wait"><motion.span key={step} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.5 }} className="block">{CLAIMS[step]}</motion.span></AnimatePresence></p>
          <p className="meta text-bone/80">Assessment · {step + 1} / {STEPS.length} · {STEPS[step]}</p>
          <div className="flex gap-1.5">{STEPS.map((st, i) => <span key={st} className={`h-1 flex-1 rounded-full transition-colors ${i < step ? "bg-volt" : i === step ? "bg-bone" : "bg-[rgba(236,231,223,.18)]"}`} />)}</div>
        </div>
      </div>

      <div className="px-5 pb-10 pt-6 lg:px-12 lg:py-12 lg:min-h-dvh lg:flex lg:flex-col lg:justify-center">

      <AnimatePresence mode="wait" custom={dir}>
        <motion.div key={step} custom={dir} variants={variants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }} className="grid gap-5">
          {step === 0 && (<>
            <h1 className="display display--lg leading-[0.95]" style={{ fontSize: "var(--text-display-lg)" }}>Let’s build <em>your</em> plan.</h1>
            <p className="text-smoke text-sm">Eight minutes. We measure before we prescribe.</p>
            <label className="field"><span className="meta">Name</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="What should we call you?" autoFocus /></label>
            <div className="grid grid-cols-2 gap-3">
              <div className="field"><span className="meta">Body weight</span><Seg fill value={units.weight} onChange={(weight) => setUnits((u) => ({ ...u, weight }))} options={[{ v: "kg", label: "kg" }, { v: "lb", label: "lb" }]} /></div>
              <div className="field"><span className="meta">Distance</span><Seg fill value={units.distance} onChange={(distance) => setUnits((u) => ({ ...u, distance }))} options={[{ v: "km", label: "km" }, { v: "mi", label: "mi" }]} /></div>
            </div>
            <div className="field"><span className="meta">Sex (for calorie math)</span><Seg value={sex} onChange={setSex} options={[{ v: "female", label: "Female" }, { v: "male", label: "Male" }, { v: "other", label: "Other" }]} /></div>
            <div className="grid grid-cols-3 gap-3">
              <label className="field"><span className="meta">Age</span><input className="input tnum" type="number" inputMode="numeric" value={age} onChange={(e) => setAge(Number(e.target.value))} /></label>
              <label className="field"><span className="meta">Height ({unitH})</span><input className="input tnum" type="number" inputMode="decimal" value={height} onChange={(e) => setHeight(Number(e.target.value))} /></label>
              <label className="field"><span className="meta">Weight ({unitW})</span><input className="input tnum" type="number" inputMode="decimal" value={weight} onChange={(e) => setWeight(Number(e.target.value))} /></label>
            </div>
          </>)}
          {step === 1 && (<>
            <h1 className="display display--lg leading-[0.95]" style={{ fontSize: "var(--text-display-lg)" }}>What’s the <em>real</em> goal?</h1>
            <div className="grid grid-cols-2 gap-2 lg:gap-3">
              {GOALS.map((g) => (
                <button key={g.v} type="button" aria-pressed={goal === g.v} onClick={() => setGoal(g.v)} className={`relative h-32 lg:h-36 rounded-[18px] overflow-hidden text-left border transition-colors ${goal === g.v ? "border-volt" : "border-line"}`}>
                  <Photo src={g.image} veil className="absolute inset-0" />
                  {goal === g.v && <span className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-volt grid place-items-center"><svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="#0A0A0A" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L19 7" /></svg></span>}
                  <span className="on-photo absolute inset-x-0 bottom-0 p-3 grid gap-0.5"><span className="display text-lg leading-none">{g.name}</span><span className="text-[11px] text-bone/75 leading-tight">{g.line}</span></span>
                </button>
              ))}
            </div>
            {goal === "perform" && <div className="grid grid-cols-2 gap-3"><label className="field"><span className="meta">Event</span><input className="input" value={eventName} onChange={(e) => setEventName(e.target.value)} placeholder="Hyrox, marathon…" /></label><label className="field"><span className="meta">Date</span><input className="input" type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} /></label></div>}
            <div className="field"><span className="meta">Training age</span><Seg value={level} onChange={setLevel} options={[{ v: "new", label: "New" }, { v: "intermediate", label: "1–3 years" }, { v: "advanced", label: "3+ years" }]} /></div>
            <p className="text-sm text-smoke">The goal sets calories, rep ranges and how much cardio sits next to the lifting. Change it any time — the block rebuilds.</p>
          </>)}
          {step === 2 && (<>
            <h1 className="display display--lg leading-[0.95]" style={{ fontSize: "var(--text-display-lg)" }}>How much <em>time</em> is real?</h1>
            <div className="field"><span className="meta">Sessions per week</span><Seg value={days} onChange={setDays} options={[2, 3, 4, 5, 6].map((d) => ({ v: d as Profile["daysPerWeek"], label: String(d) }))} /></div>
            <div className="field"><span className="meta">Minutes per session</span><Seg value={minutes} onChange={setMinutes} options={[25, 40, 60, 75].map((m) => ({ v: m as Profile["sessionMinutes"], label: `${m} min` }))} /></div>
            <div className="grid grid-cols-2 gap-3"><label className="field"><span className="meta">Usual training time</span><input className="input" type="time" value={trainTime} onChange={(e) => setTrainTime(e.target.value)} /></label><label className="field"><span className="meta">Wake time</span><input className="input" type="time" value={wakeTime} onChange={(e) => setWakeTime(e.target.value)} /></label></div>
            <p className="text-sm text-smoke">A plan for the week you actually have beats a perfect plan for a week you don’t. Meals are timed around your training.</p>
          </>)}
          {step === 3 && (<>
            <h1 className="display display--lg leading-[0.95]" style={{ fontSize: "var(--text-display-lg)" }}>What’s in <em>front</em> of you?</h1>
            <div className="field"><span className="meta">Equipment you have most days</span><MultiSeg value={equipment} onChange={setEquipment} options={[{ v: "barbell", label: "Barbell" }, { v: "rack", label: "Rack" }, { v: "bench", label: "Bench" }, { v: "dumbbell", label: "Dumbbells" }, { v: "kettlebell", label: "Kettlebell" }, { v: "cable", label: "Cables" }, { v: "machine", label: "Machines" }, { v: "pullup_bar", label: "Pull-up bar" }, { v: "band", label: "Bands" }, { v: "rower", label: "Rower" }, { v: "bike", label: "Bike" }, { v: "treadmill", label: "Treadmill" }, { v: "outdoor", label: "Outdoors" }]} /></div>
            <div className="field"><span className="meta">Anything that hurts right now?</span><MultiSeg value={pain} onChange={setPain} options={[{ v: "knee", label: "Knee" }, { v: "back", label: "Lower back" }, { v: "shoulder", label: "Shoulder" }, { v: "hip", label: "Hip" }, { v: "wrist", label: "Wrist" }, { v: "ankle", label: "Ankle" }, { v: "elbow", label: "Elbow" }]} /></div>
            <p className="text-sm text-smoke">We never prescribe a movement that loads a flagged joint. Clear it in Settings when it’s better.</p>
          </>)}
          {step === 4 && (<>
            <h1 className="display display--lg leading-[0.95]" style={{ fontSize: "var(--text-display-lg)" }}>Baselines. <em>Skip</em> what you don’t know.</h1>
            <p className="text-sm text-smoke">Any recent set works: we convert it to an estimated 1RM. Leave blank and the engine starts conservative.</p>
            <div className="grid grid-cols-3 gap-3">
              <label className="field"><span className="meta">Squat ({unitW})</span><input className="input tnum" type="number" inputMode="decimal" value={squat} onChange={(e) => setSquat(e.target.value)} placeholder="—" /></label>
              <label className="field"><span className="meta">Deadlift ({unitW})</span><input className="input tnum" type="number" inputMode="decimal" value={hinge} onChange={(e) => setHinge(e.target.value)} placeholder="—" /></label>
              <label className="field"><span className="meta">Bench ({unitW})</span><input className="input tnum" type="number" inputMode="decimal" value={push} onChange={(e) => setPush(e.target.value)} placeholder="—" /></label>
              <label className="field"><span className="meta">Pull-ups</span><input className="input tnum" type="number" inputMode="numeric" value={pullReps} onChange={(e) => setPullReps(e.target.value)} placeholder="—" /></label>
              <label className="field"><span className="meta">Plank (s)</span><input className="input tnum" type="number" inputMode="numeric" value={plank} onChange={(e) => setPlank(e.target.value)} placeholder="—" /></label>
              <label className="field"><span className="meta">12-min run ({units.distance})</span><input className="input tnum" type="number" inputMode="decimal" step="0.1" value={run12} onChange={(e) => setRun12(e.target.value)} placeholder="—" /></label>
            </div>
            <div className="grid gap-4 card p-4">
              <p className="meta text-ink">Movement screen — 1 (stiff) to 5 (free)</p>
              <Screen1 label="Deep squat, heels down" value={hip} onChange={setHip} />
              <Screen1 label="Arms overhead, ribs down" value={shoulder} onChange={setShoulder} />
              <Screen1 label="Knee over toes, heel down" value={ankle} onChange={setAnkle} />
            </div>
          </>)}
          {step === 5 && (<>
            <h1 className="display display--lg leading-[0.95]" style={{ fontSize: "var(--text-display-lg)" }}>How do you <em>eat</em>?</h1>
            <div className="field"><span className="meta">Dietary pattern</span><MultiSeg value={dietary} onChange={setDietary} options={[{ v: "vegetarian", label: "Vegetarian" }, { v: "vegan", label: "Vegan" }, { v: "pescatarian", label: "Pescatarian" }, { v: "halal", label: "Halal" }, { v: "gluten_free", label: "Gluten-free" }, { v: "lactose_free", label: "Lactose-free" }]} /></div>
            <div className="field"><span className="meta">Meals per day</span><Seg value={mealsPerDay} onChange={setMealsPerDay} options={[3, 4, 5].map((m) => ({ v: m as Profile["mealsPerDay"], label: String(m) }))} /></div>
            <p className="text-sm text-smoke">Targets come from your body, goal and the kind of day it is. 30,000+ recipes with cook mode; meals never repeat within three days.</p>
          </>)}
        </motion.div>
      </AnimatePresence>

      <AnimatePresence>{busy && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-[70] bg-ink text-bone grid place-items-center p-8">
          <div className="grid gap-6 w-full max-w-[380px]">
            <span className="display display--lg leading-[0.95]" style={{ fontSize: "var(--text-display-lg)" }}>Building<br /><em>your block.</em></span>
            <ul className="grid gap-3">
              {["Reading your baselines", "Choosing movements you can actually do", "Periodising 12 weeks · 3 mesocycles", "Planning today’s meals"].map((s, i) => (
                <motion.li key={s} initial={{ opacity: 0.25, x: -6 }} animate={{ opacity: stage >= i ? 1 : 0.25, x: 0 }} className="flex items-center gap-3 text-sm">
                  <span className={`w-5 h-5 rounded-full grid place-items-center border ${stage > i ? "bg-volt border-volt" : stage === i ? "border-volt" : "border-line"}`}>{stage > i && <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="#0A0A0A" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5 10 17l9-10" /></svg>}{stage === i && <motion.span className="w-2 h-2 rounded-full bg-volt" animate={{ scale: [1, 1.5, 1] }} transition={{ repeat: Infinity, duration: 0.9 }} />}</span>
                  {s}
                </motion.li>
              ))}
            </ul>
            <div className="bar"><motion.i animate={{ width: `${Math.min(100, ((stage + 1) / 4) * 100)}%` }} /></div>
          </div>
        </motion.div>
      )}</AnimatePresence>

      <div className="flex gap-3 mt-8 lg:mt-10">
        {step > 0 && <button type="button" className="pill" onClick={() => go(step - 1)}>Back</button>}
        {step < STEPS.length - 1 ? (
          <Press className="flex-1"><button type="button" className="pill pill--volt pill--block" disabled={!canNext} onClick={() => go(step + 1)}>Continue</button></Press>
        ) : (
          <Press className="flex-1"><button type="button" className="pill pill--volt pill--block" disabled={busy} onClick={finish}>{busy ? "Building your block…" : "Build my 12 weeks"}</button></Press>
        )}
      </div>
      </div>
    </div>
  );
}

function Screen1({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="grid gap-2">
      <span className="text-sm">{label}</span>
      <div className="seg">{[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" aria-pressed={value === n} onClick={() => onChange(n)}>{n}</button>)}</div>
    </div>
  );
}
