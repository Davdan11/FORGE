"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { db, todayISO, uid } from "@/lib/db";
import { generatePlan } from "@/lib/engine/plan";
import { adaptationsFor } from "@/lib/engine/injury";
import { buildNutritionDay, dailyTargets } from "@/lib/nutrition/engine";
import { NumbersExplained } from "@/components/NumbersExplained";
import { lbToKg, localeUnits } from "@/lib/units";
import { APP_NAME, HEALTH_NOTICE, MIN_AGE, minimumAge } from "@/lib/brand";
import { SPORTS } from "@/lib/data/sports";
import { EXERCISES } from "@/lib/data/exercises";
import { recipeCount } from "@/lib/nutrition/recipes";
import { ART, IMG, sessionImage } from "@/lib/data/images";
import { AREAS, AVOID, DIETS, HOME_KIT, PLACES, SLEEP, STRESS, WORK, DEFAULT_LIFESTYLE, equipmentFor, choiceOptions, choiceLabel, placeText } from "@/lib/data/choices";
import { RadioField, RadioCards, MultiSeg, Photo, StatRow } from "@/components/ui";
import { motion, AnimatePresence, Press } from "@/components/motion";
import { AccountPanel } from "@/components/AccountPanel";
import { isConfigured } from "@/lib/supabase/client";
import { currentUser, firstName, restoreAccount } from "@/lib/auth";
import { syncNow } from "@/lib/sync";
import { bilingual, loc, locale, useLang, useT } from "@/lib/i18n";

/* Remembered when someone chooses to start without an account, so the
   question is not asked again on this device. Settings can still sign in. */
const SKIPPED = "forge.accountSkipped";
import type { AvoidFood, Equipment, Goal, Level, Lifestyle, PainArea, Profile, Sex, TrainingPlace, UnitPrefs } from "@/lib/types";

type Txt = { fr: string; en: string };
const STEPS: Txt[] = [
  { fr: "Toi", en: "You" }, { fr: "Objectif", en: "Goal" }, { fr: "Horaire", en: "Schedule" },
  { fr: "Matériel", en: "Gear" }, { fr: "Récupération", en: "Recovery" }, { fr: "Bouffe", en: "Food" },
];
const CLAIMS: Txt[] = [
  { fr: "Ton plan commence par toi.", en: "Your plan starts with you." },
  { fr: "Un objectif. Tout le reste suit.", en: "One goal. Everything follows." },
  { fr: "La semaine que tu as vraiment.", en: "The week you actually have." },
  { fr: "Entraîne-toi avec ce que t’as devant toi.", en: "Train with what is in front of you." },
  { fr: "La récup se passe hors du gym.", en: "Recovery happens outside the gym." },
  { fr: "Le carburant fait partie du plan.", en: "Fuel is part of the plan." },
];
const GOALS: { v: Goal; name: Txt; line: Txt; image: string }[] = [
  { v: "strength", name: { fr: "Devenir fort", en: "Get strong" }, line: { fr: "Gros polyarticulaires, peu de reps, longs repos.", en: "Heavy compounds, low reps, long rests." }, image: sessionImage("lower", 600, 600) },
  { v: "build", name: { fr: "Prendre du muscle", en: "Build muscle" }, line: { fr: "Volume, tempo, et de la bouffe pour grossir.", en: "Volume, tempo, food to grow." }, image: sessionImage("upper", 600, 600) },
  { v: "recomp", name: { fr: "Recomposition", en: "Recomp" }, line: { fr: "Soulève lourd, mange à maintien, sèche tranquillement.", en: "Lift hard, eat at maintenance, lean out slowly." }, image: IMG.weight },
  { v: "cut", name: { fr: "Perdre du gras", en: "Lose fat" }, line: { fr: "Garde ta force, avec un petit déficit.", en: "Keep strength, run a small deficit." }, image: sessionImage("cardio_intervals", 600, 600) },
  { v: "endurance", name: { fr: "Endurance", en: "Endurance" }, line: { fr: "Base en zone 2, intervalles, force pour durer.", en: "Zone 2 base, intervals, strength to stay durable." }, image: sessionImage("cardio_z2", 600, 600) },
  { v: "perform", name: { fr: "Performer à une date", en: "Perform for a date" }, line: { fr: "Sois au sommet pour un événement au calendrier.", en: "Peak for an event on the calendar." }, image: IMG.city },
];
const BUILD_STAGES: Txt[] = [
  { fr: "Lecture de tes réponses", en: "Reading your answers" },
  { fr: "Choix d’exercices que tu peux vraiment faire", en: "Choosing exercises you can actually do" },
  { fr: "Écriture de tes 12 premières semaines", en: "Writing your first 12 weeks" },
  { fr: "Planification des repas d’aujourd’hui", en: "Planning today’s meals" },
];
const PHOTOS = [IMG.onboarding, IMG.dark, IMG.progress, IMG.group, IMG.moveEmpty, "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=1200&h=800&fit=crop&q=75&auto=format"];

const METRIC: UnitPrefs = { weight: "kg", distance: "km" };
const noopSubscribe = () => () => {};

export default function Onboarding() {
  const router = useRouter();
  const t = useT();
  const lang = useLang();
  const [step, setStep] = useState(0);
  // Account first: "ask" shows the sign-in screen, "done" the assessment.
  const [account, setAccount] = useState<"checking" | "ask" | "restoring" | "done">(isConfigured ? "checking" : "done");
  const [signedIn, setSignedIn] = useState(false);
  const [dir, setDir] = useState(1);
  const [busy, setBusy] = useState(false);
  // Once built: the plan, explained, before the first screen of the app.
  const [ready, setReady] = useState<{ profile: Profile; blocks: { name: string; intent: string }[] } | null>(null);
  // Units follow the phone's region until the person picks: pounds and miles
  // in the US. Read after hydration, so the static page and the first client
  // render agree.
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const [chosenUnits, setUnits] = useState<UnitPrefs | null>(null);
  const units = chosenUnits ?? (hydrated ? localeUnits() : METRIC);
  const [ack, setAck] = useState(false);
  const [consent, setConsent] = useState(false);
  const [name, setName] = useState("");
  const [sex, setSex] = useState<Sex>("male");
  const [age, setAge] = useState(30);
  // Blank until typed: the defaults follow the units shown.
  const [heightIn, setHeight] = useState<number | null>(null);
  const [weightIn, setWeight] = useState<number | null>(null);
  const height = heightIn ?? (units.weight === "lb" ? 69 : 175);
  const weight = weightIn ?? (units.weight === "lb" ? 172 : 78);
  const [goal, setGoal] = useState<Goal>("build");
  const [level, setLevel] = useState<Level>("intermediate");
  const [eventName, setEventName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [days, setDays] = useState<Profile["daysPerWeek"]>(4);
  const [minutes, setMinutes] = useState<Profile["sessionMinutes"]>(60);
  const [trainTime, setTrainTime] = useState("18:00");
  const [wakeTime, setWakeTime] = useState("07:00");
  const [place, setPlace] = useState<TrainingPlace>("full_gym");
  const [homeKit, setHomeKit] = useState<Equipment[]>(["dumbbell", "bench"]);
  const [injured, setInjured] = useState<PainArea[]>([]);
  const [healed, setHealed] = useState<PainArea[]>([]);
  const [lifestyle, setLifestyle] = useState<Lifestyle>(DEFAULT_LIFESTYLE);
  const [dietary, setDietary] = useState<Profile["dietary"]>([]);
  const [avoidFoods, setAvoidFoods] = useState<AvoidFood[]>([]);
  const [mealsPerDay, setMealsPerDay] = useState<Profile["mealsPerDay"]>(4);

  useEffect(() => {
    if (!isConfigured) return;
    currentUser().then((u) => {
      if (u) { setSignedIn(true); setName((n) => n || firstName(u)); setAccount("done"); return; }
      let skipped = false;
      try { skipped = localStorage.getItem(SKIPPED) === "1"; } catch { /* private mode */ }
      setAccount(skipped ? "done" : "ask");
    }).catch(() => setAccount("done"));
  }, []);

  const onSignedIn = useCallback(async (u: User) => {
    setAccount("restoring");
    setSignedIn(true);
    // An existing account on a new phone: bring everything back and skip the
    // assessment. A new account: carry on, with the name the provider gave.
    const { hasProfile } = await restoreAccount().catch(() => ({ hasProfile: false }));
    if (hasProfile) { router.replace("/today"); return; }
    setName((n) => n || firstName(u));
    setAccount("done");
  }, [router]);

  // 13 in the US, 16 in the EU/EEA — read after hydration, like the units.
  const minAge = hydrated ? minimumAge() : MIN_AGE;
  const tooYoung = age > 0 && age < minAge;
  const canNext = useMemo(() => (step === 0 ? name.trim().length > 0 && age >= minAge && age <= 100 : true), [step, name, age, minAge]);
  const go = (n: number) => { setDir(n > step ? 1 : -1); setStep(n); };

  const [stage, setStage] = useState(-1);
  async function finish() {
    setBusy(true);
    // Cinematic build: staged messages while the engine works.
    for (let i = 0; i < 4; i++) { setStage(i); await new Promise((r) => setTimeout(r, 650)); }
    const equipment = equipmentFor(place, homeKit);
    // Doing the setup again replaces the rider (same id, so their history stays theirs) instead of adding a second
    // profile that the app would never show.
    const existing = await db.profile.toArray();
    const profile: Profile = {
      id: existing[0]?.id ?? uid(), name: name.trim(), sex, age, units, goal, level,
      heightCm: units.weight === "lb" ? height * 2.54 : height, weightKg: units.weight === "lb" ? lbToKg(weight) : weight,
      daysPerWeek: days, sessionMinutes: minutes, trainingPlace: place, equipment,
      pain: injured.filter((a) => !healed.includes(a)), injuryHistory: injured.filter((a) => healed.includes(a)),
      eventName: goal === "perform" && eventName ? eventName : undefined, eventDate: goal === "perform" && eventDate ? eventDate : undefined,
      // No lifts asked up front: loads start from bodyweight and training age,
      // and the first logged sets replace the estimate within a week.
      baselines: {}, lifestyle,
      dietary, avoidFoods, mealsPerDay, wakeTime, trainTime, notifications: false, healthNoticeAt: new Date().toISOString(), consentAt: new Date().toISOString(), createdAt: new Date().toISOString(),
      startWeightKg: units.weight === "lb" ? lbToKg(weight) : weight,
    };
    const injuries = adaptationsFor(await db.injuries.toArray(), todayISO());
    const { plan, sessions } = bilingual(() => generatePlan(profile, todayISO(), {}, injuries));
    await db.transaction("rw", db.profile, db.plans, db.sessions, db.nutrition, async () => {
      // One rider, one plan: the old plan and the sessions it still had planned make way for the new ones.
      await db.profile.clear();
      const oldPlans = (await db.plans.toArray()).map((p) => p.id);
      if (oldPlans.length) {
        await db.sessions.where("planId").anyOf(oldPlans).filter((x) => x.status === "planned").delete();
        await db.plans.bulkDelete(oldPlans);
      }
      await db.profile.put({ ...profile, dirty: 1, updatedAt: new Date().toISOString() });
      await db.plans.put({ ...plan, dirty: 1 });
      await db.sessions.bulkPut(sessions.map((s) => ({ ...s, dirty: 1 })));
      const today = todayISO();
      await db.nutrition.put({ ...buildNutritionDay(profile, today, sessions.find((x) => x.date === today) ?? null), dirty: 1 });
    });
    // Put the new profile and block on the account straight away.
    if (signedIn) await syncNow().catch(() => {});
    setBusy(false);
    setReady({ profile, blocks: plan.blocks.slice(0, 3).map((b) => ({ name: loc(b.name), intent: loc(b.intent) })) });
  }

  const unitW = units.weight;
  const unitH = units.weight === "lb" ? "in" : "cm";
  const variants = { enter: (d: number) => ({ opacity: 0, x: d * 40 }), center: { opacity: 1, x: 0 }, exit: (d: number) => ({ opacity: 0, x: d * -40 }) };

  if (ready) {
    const p = ready.profile;
    return (
      <main className="min-h-dvh px-5 pt-[calc(var(--safe-top)+28px)] pb-12 max-w-[640px] mx-auto grid gap-6 content-start">
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="grid gap-2">
          <p className="eyebrow">{t("Ton plan est prêt", "Your plan is ready")}</p>
          <h1 className="display display--lg leading-[0.95]" style={{ fontSize: "var(--text-display-lg)" }}>{t("Bâti pour", "Built for")} <em>{t("toi", "you")}, {p.name}.</em></h1>
          <p className="text-sm text-smoke">{t("Voici ce qu’on a bâti, et pourquoi — pour que tu saches exactement ce que tu fais et à quoi t’attendre.", "Here is what we built, and why — so you know exactly what you are doing and what to expect.")}</p>
        </motion.div>
        <StatRow items={[
          { label: t("Séances / semaine", "Sessions / week"), value: String(p.daysPerWeek) },
          { label: t("Minutes chacune", "Minutes each"), value: String(p.sessionMinutes) },
          { label: t("Kcal · jour d’entraînement", "Kcal · training day"), value: dailyTargets(p, "train").kcal.toLocaleString(locale()) },
        ]} />
        <section className="grid gap-2">
          <span className="meta">{t("Tes 12 prochaines semaines", "Your next 12 weeks")}</span>
          <ol className="card divide-y divide-line">
            {ready.blocks.map((b, i) => (
              <li key={b.name} className="p-4 grid grid-cols-[34px_minmax(0,1fr)] gap-x-2">
                <span className="meta text-volt font-bold pt-0.5">{String(i + 1).padStart(2, "0")}</span>
                <span className="grid gap-0.5"><strong className="text-sm">{t("Semaines", "Weeks")} {i * 4 + 1}–{i * 4 + 4} · {b.name}</strong><span className="text-xs text-smoke leading-relaxed">{b.intent} {t(`Sa dernière semaine (semaine ${i * 4 + 4}) est plus légère pour que le travail rapporte.`, `Its last week (week ${i * 4 + 4}) is lighter so the work can pay off.`)}</span></span>
              </li>
            ))}
          </ol>
          <p className="text-xs text-smoke">{t("Aux quatre semaines, le bloc suivant est réécrit selon comment le dernier s’est vraiment passé : les charges soulevées, la difficulté ressentie, ce que tu as sauté.", "Every four weeks the next block is rewritten from how the last one actually went: the loads you lifted, how hard it felt, what you skipped.")}</p>
        </section>
        <section className="grid gap-2">
          <span className="meta">{t("Ta bouffe", "Your food")}</span>
          <NumbersExplained profile={p} dayType="train" open />
        </section>
        <Press><button type="button" className="pill pill--volt pill--block pill--lg" onClick={() => router.replace("/today")}>{t("Commencer l’entraînement", "Start training")}</button></Press>
      </main>
    );
  }

  if (account !== "done") {
    return (
      <div className="min-h-dvh lg:grid lg:grid-cols-[minmax(0,1fr)_560px]">
        <div className="relative h-[300px] lg:h-dvh lg:sticky lg:top-0 overflow-hidden">
          <Photo src={ART.today} color veil className="absolute inset-0" />
          <span className="on-photo absolute top-[calc(var(--safe-top)+16px)] left-5 lg:top-8 lg:left-8 display text-lg lg:text-2xl">{APP_NAME}<span className="text-volt">.</span></span>
          <p className="on-photo absolute inset-x-0 bottom-0 px-5 pb-5 lg:px-10 lg:pb-10 display display--lg leading-[0.95] max-w-[14ch]" style={{ fontSize: "var(--text-display-lg)" }}>{t("Entraîne-toi. Mesure. ", "Train. Track. ")}<em>{t("Monte en rang.", "Rank up.")}</em></p>
        </div>
        <div className="px-5 pb-10 pt-8 lg:px-12 lg:py-12 lg:min-h-dvh lg:flex lg:flex-col lg:justify-center">
          {account === "checking" ? <div className="skeleton h-64" /> : account === "restoring" ? (
            <div className="grid gap-3"><h1 className="display display--lg leading-[0.95]" style={{ fontSize: "var(--text-display-lg)" }}>{t("Bon", "Welcome")} <em>{t("retour.", "back.")}</em></h1><p className="text-sm text-smoke">{t("On ramène ton entraînement sur cet appareil…", "Bringing your training onto this device…")}</p><div className="bar"><motion.i initial={{ width: "10%" }} animate={{ width: "90%" }} transition={{ duration: 6 }} /></div></div>
          ) : (
            <div className="grid gap-6 max-w-[440px]">
              <div className="grid gap-2">
                <h1 className="display display--lg leading-[0.95]" style={{ fontSize: "var(--text-display-lg)" }}>{t("Crée ton", "Create your")} <em>{t("compte.", "account.")}</em></h1>
                <p className="text-sm text-smoke">{t("Gym, course, vélo — un seul rang pour tout ça, gagné pour vrai. Un compte garde ton plan, tes entraînements et ton rang sur tous tes appareils. T’en as déjà un? Utilise le même bouton.", "Gym, runs, rides — one rank for all of it, earned for real. An account keeps your plan, workouts and rank on every device. Already have one? Use the same button.")}</p>
              </div>
              {/* What is inside, in numbers — the proof row, as on the company's sites. */}
              <StatRow items={[
                { label: t("Sports", "Sports"), value: String(SPORTS.length) },
                { label: t("Exercices", "Exercises"), value: String(EXERCISES.length) },
                { label: t("Recettes", "Recipes"), value: `${Math.floor(recipeCount() / 1000)}k+`, unit: "" },
              ]} />
              <AccountPanel onSignedIn={onSignedIn} />
              <button type="button" className="text-sm text-smoke underline justify-self-start" onClick={() => { try { localStorage.setItem(SKIPPED, "1"); } catch { /* private mode */ } setAccount("done"); }}>{t("Continuer sans compte", "Continue without an account")}</button>
              <p className="text-xs text-smoke">{t("Sans compte, tout reste sur ce téléphone. Tu pourras en créer un plus tard dans les Réglages.", "Without an account, everything stays on this phone. You can create one later in Settings.")}</p>
              <p className="text-xs text-smoke">{t("En continuant, tu acceptes les", "By continuing you agree to the")} <Link href="/legal/terms" className="underline">{t("Conditions d’utilisation", "Terms of Use")}</Link> {t("et la", "and")} <Link href="/legal/privacy" className="underline">{t("Politique de confidentialité", "Privacy Policy")}</Link>.</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[minmax(0,1fr)_560px]">
      {/* Photo side: full height on desktop, header on mobile */}
      <div className="relative h-[240px] lg:h-dvh lg:sticky lg:top-0 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, scale: 1.04 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }} className="absolute inset-0"><Photo src={PHOTOS[step]} veil className="absolute inset-0" /></motion.div>
        </AnimatePresence>
        <span className="on-photo absolute top-[calc(var(--safe-top)+16px)] left-5 lg:top-8 lg:left-8 display text-lg lg:text-2xl">{APP_NAME}<span className="text-volt">.</span></span>
        <div className="on-photo absolute inset-x-0 bottom-0 px-5 pb-4 lg:px-10 lg:pb-10 grid gap-3">
          <p className="hidden md:block display display--lg leading-[0.95] max-w-[12ch]" style={{ fontSize: "var(--text-display-lg)" }}><AnimatePresence mode="wait"><motion.span key={step} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.5 }} className="block">{CLAIMS[step][lang]}</motion.span></AnimatePresence></p>
          <p className="meta text-bone/80"><span className="text-volt font-bold">{String(step + 1).padStart(2, "0")}</span> / {String(STEPS.length).padStart(2, "0")} · {STEPS[step][lang]}</p>
          <div className="flex gap-1.5">{STEPS.map((st, i) => <span key={st.en} className={`h-1 flex-1 rounded-full transition-colors ${i < step ? "bg-volt" : i === step ? "bg-bone" : "bg-[rgba(236,231,223,.18)]"}`} />)}</div>
        </div>
      </div>

      <div className="px-5 pb-10 pt-6 lg:px-12 lg:py-12 lg:min-h-dvh lg:flex lg:flex-col lg:justify-center">

      <AnimatePresence mode="wait" custom={dir}>
        <motion.div key={step} custom={dir} variants={variants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }} className="grid gap-5">
          {step === 0 && (<>
            <h1 className="display display--lg leading-[0.95]" style={{ fontSize: "var(--text-display-lg)" }}>{t("Bâtissons", "Let’s build")} <em>{t("ton", "your")}</em> {t("plan.", "plan.")}</h1>
            <p className="text-smoke text-sm">{t("Six étapes rapides, environ deux minutes. Tout peut être changé plus tard.", "Six quick steps, about two minutes. Everything can be changed later.")}</p>
            {/* No autoFocus. In a browser it saves a tap; in the native app the
                keyboard rises before the screen has been read and covers the
                form, so the first thing anyone sees is two thirds of a keyboard. */}
            <label className="field"><span className="meta">{t("Nom", "Name")}</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("Comment on t’appelle?", "What should we call you?")} /></label>
            <div className="grid grid-cols-2 gap-3">
              <RadioField label={t("Poids corporel", "Body weight")} value={units.weight} onChange={(weight) => setUnits({ ...units, weight })} options={[{ v: "kg", label: "kg" }, { v: "lb", label: "lb" }]} />
              <RadioField label={t("Distance", "Distance")} value={units.distance} onChange={(distance) => setUnits({ ...units, distance })} options={[{ v: "km", label: "km" }, { v: "mi", label: "mi" }]} />
            </div>
            <RadioField label={t("Sexe (pour le calcul des calories)", "Sex (for calorie math)")} value={sex} onChange={setSex} options={[{ v: "female", label: t("Femme", "Female") }, { v: "male", label: t("Homme", "Male") }, { v: "other", label: t("Autre", "Other") }]} />
            <div className="grid grid-cols-3 gap-3">
              <label className="field"><span className="meta">{t("Âge", "Age")}</span><input className="input tnum" type="number" inputMode="numeric" min={minAge} max={100} value={age} onChange={(e) => setAge(Number(e.target.value))} /></label>
              <label className="field"><span className="meta">{t("Taille", "Height")} ({unitH})</span><input className="input tnum" type="number" inputMode="decimal" value={height} onChange={(e) => setHeight(Number(e.target.value))} /></label>
              <label className="field"><span className="meta">{t("Poids", "Weight")} ({unitW})</span><input className="input tnum" type="number" inputMode="decimal" value={weight} onChange={(e) => setWeight(Number(e.target.value))} /></label>
            </div>
            {tooYoung && <p className="text-sm text-danger">{t(`${APP_NAME} est pour les personnes de ${minAge} ans et plus.`, `${APP_NAME} is for people ${minAge} and older.`)}</p>}
          </>)}
          {step === 1 && (<>
            <h1 className="display display--lg leading-[0.95]" style={{ fontSize: "var(--text-display-lg)" }}>{t("C’est quoi le", "What’s the")} <em>{t("vrai", "real")}</em> {t("objectif?", "goal?")}</h1>
            <div className="grid grid-cols-2 gap-2 lg:gap-3">
              {GOALS.map((g) => (
                <button key={g.v} type="button" aria-pressed={goal === g.v} onClick={() => setGoal(g.v)} className={`relative h-32 lg:h-36 rounded-[18px] overflow-hidden text-left border transition-colors ${goal === g.v ? "border-volt" : "border-line"}`}>
                  <Photo src={g.image} veil className="absolute inset-0" />
                  {goal === g.v && <span className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-volt grid place-items-center"><svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="#0A0A0A" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L19 7" /></svg></span>}
                  <span className="on-photo absolute inset-x-0 bottom-0 p-3 grid gap-0.5"><span className="display text-lg leading-none">{g.name[lang]}</span><span className="text-[11px] text-bone/75 leading-tight">{g.line[lang]}</span></span>
                </button>
              ))}
            </div>
            {goal === "perform" && <div className="grid grid-cols-2 gap-3"><label className="field"><span className="meta">{t("Événement", "Event")}</span><input className="input" value={eventName} onChange={(e) => setEventName(e.target.value)} placeholder={t("Hyrox, marathon…", "Hyrox, marathon…")} /></label><label className="field"><span className="meta">{t("Date", "Date")}</span><input className="input" type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} /></label></div>}
            <RadioField label={t("Depuis combien de temps tu t’entraînes?", "How long have you been training?")} value={level} onChange={setLevel} options={[{ v: "new", label: t("Je commence", "Just starting") }, { v: "intermediate", label: t("1–3 ans", "1–3 years") }, { v: "advanced", label: t("3 ans et +", "3+ years") }]} />
            <p className="text-sm text-smoke">{t("Ton objectif fixe tes calories, tes reps et combien de cardio accompagne la muscu. Change-le n’importe quand et ton plan suit.", "Your goal sets your calories, your reps and how much cardio goes with the lifting. Change it any time and your plan updates.")}</p>
          </>)}
          {step === 2 && (<>
            <h1 className="display display--lg leading-[0.95]" style={{ fontSize: "var(--text-display-lg)" }}>{t("Combien de", "How much")} <em>{t("temps", "time")}</em> {t("t’as vraiment?", "is real?")}</h1>
            <RadioField label={t("Séances par semaine", "Sessions per week")} value={days} onChange={setDays} options={[2, 3, 4, 5, 6].map((d) => ({ v: d as Profile["daysPerWeek"], label: String(d) }))} />
            <RadioField label={t("Minutes par séance", "Minutes per session")} value={minutes} onChange={setMinutes} options={[25, 40, 60, 75].map((m) => ({ v: m as Profile["sessionMinutes"], label: `${m} min` }))} />
            <div className="grid grid-cols-2 gap-3"><label className="field"><span className="meta">{t("Heure habituelle d’entraînement", "Usual training time")}</span><input className="input" type="time" value={trainTime} onChange={(e) => setTrainTime(e.target.value)} /></label><label className="field"><span className="meta">{t("Heure de réveil", "Wake time")}</span><input className="input" type="time" value={wakeTime} onChange={(e) => setWakeTime(e.target.value)} /></label></div>
            <p className="text-sm text-smoke">{t("Un plan pour la semaine que t’as vraiment bat un plan parfait pour une semaine que t’as pas. Les repas sont placés autour de ton entraînement.", "A plan for the week you actually have beats a perfect plan for a week you don’t. Meals are timed around your training.")}</p>
          </>)}
          {step === 3 && (<>
            <h1 className="display display--lg leading-[0.95]" style={{ fontSize: "var(--text-display-lg)" }}>{t("Où est-ce que tu", "Where do you")} <em>{t("t’entraînes", "train")}</em>?</h1>
            <div className="grid gap-2">
              {PLACES.map((pl) => (
                <button key={pl.v} type="button" aria-pressed={place === pl.v} onClick={() => setPlace(pl.v)} className={`card p-4 text-left flex items-center justify-between gap-3 transition-colors ${place === pl.v ? "border-volt" : ""}`}>
                  <span className="grid gap-0.5"><span className="display text-lg leading-none">{placeText(pl, lang).name}</span><span className="text-sm text-smoke">{placeText(pl, lang).line}</span></span>
                  <span className={`w-5 h-5 shrink-0 rounded-full grid place-items-center border ${place === pl.v ? "bg-volt border-volt" : "border-line-strong"}`}>{place === pl.v && <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="#0A0A0A" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L19 7" /></svg>}</span>
                </button>
              ))}
            </div>
            {place === "home_gym" && <div className="field"><span className="meta">{t("Qu’est-ce qu’il y a dans ton gym maison?", "What’s in your home gym?")}</span><MultiSeg value={homeKit} onChange={setHomeKit} options={choiceOptions(HOME_KIT, lang)} /></div>}
            <div className="field"><span className="meta">{t("Des blessures, maintenant ou dans le passé?", "Any injuries, now or in the past?")}</span><MultiSeg value={injured} onChange={(v) => { setInjured(v); setHealed((h) => h.filter((a) => v.includes(a))); }} options={choiceOptions(AREAS, lang)} /></div>
            {injured.length > 0 && (
              <div className="grid gap-3 card p-4">
                {injured.map((a) => (
                  <div key={a} className="grid gap-2">
                    <span className="text-sm font-medium">{choiceLabel(AREAS, a, lang)}</span>
                    <RadioCards label={choiceLabel(AREAS, a, lang)} value={healed.includes(a) ? "healed" : "hurts"} onChange={(v) => setHealed((h) => (v === "healed" ? [...h.filter((x) => x !== a), a] : h.filter((x) => x !== a)))} options={[{ v: "hurts", label: t("Fait encore mal", "Still hurts") }, { v: "healed", label: t("Guérie", "Healed") }]} />
                  </div>
                ))}
              </div>
            )}
            <p className="text-sm text-smoke">{injured.length ? t("Si ça fait encore mal, on enlève les exercices qui la sollicitent. Si c’est guéri, tu as d’abord la version plus douce d’un exercice. Une douleur qui ne part pas mérite qu’un médecin ou un physiothérapeute y jette un œil.", "If it still hurts, we leave out the exercises that load it. If it has healed, you get the gentler version of an exercise first. Pain that doesn’t go away deserves a look from a doctor or physical therapist.") : t("Les vieilles blessures comptent aussi : c’est souvent là que les nouvelles commencent.", "Old injuries count too: that’s where new ones usually start.")}</p>
          </>)}
          {step === 4 && (<>
            <h1 className="display display--lg leading-[0.95]" style={{ fontSize: "var(--text-display-lg)" }}>{t("La vie", "Life")} <em>{t("hors", "outside")}</em> {t("du gym.", "the gym.")}</h1>
            <RadioField label={t("Sommeil une nuit normale", "Sleep on a normal night")} value={lifestyle.sleep} onChange={(sleep) => setLifestyle((l) => ({ ...l, sleep }))} options={choiceOptions(SLEEP, lang)} />
            <RadioField label={t("Stress ces temps-ci", "Stress these days")} value={lifestyle.stress} onChange={(stress) => setLifestyle((l) => ({ ...l, stress }))} options={choiceOptions(STRESS, lang)} />
            <RadioField label={t("Tes journées sont surtout", "Your days are mostly")} value={lifestyle.work} onChange={(work) => setLifestyle((l) => ({ ...l, work }))} options={choiceOptions(WORK, lang)} />
            <p className="text-sm text-smoke">{t("Le muscle se bâtit pendant que tu récupères. Peu de sommeil, beaucoup de stress ou une job physique, ça veut dire moins de séries par entraînement, et une job physique veut dire plus de bouffe. Aux quatre semaines, ton plan est réécrit selon comment les quatre dernières se sont vraiment passées.", "Muscle is built while you recover. Short sleep, high stress or a physical job mean fewer sets per workout, and a physical job means more food. Every four weeks, your plan is rewritten from how the last four actually went.")}</p>
          </>)}
          {step === 5 && (<>
            <h1 className="display display--lg leading-[0.95]" style={{ fontSize: "var(--text-display-lg)" }}>{t("Comment est-ce que tu", "How do you")} <em>{t("manges", "eat")}</em>?</h1>
            <div className="field"><span className="meta">{t("Façon de manger", "Way of eating")}</span><MultiSeg value={dietary} onChange={setDietary} options={choiceOptions(DIETS, lang)} /></div>
            <div className="field"><span className="meta">{t("Aliments que tu ne manges pas", "Foods you don’t eat")}</span><MultiSeg value={avoidFoods} onChange={setAvoidFoods} options={choiceOptions(AVOID, lang)} /></div>
            <RadioField label={t("Repas par jour", "Meals per day")} value={mealsPerDay} onChange={setMealsPerDay} options={[3, 4, 5].map((m) => ({ v: m as Profile["mealsPerDay"], label: String(m) }))} />
            <p className="text-sm text-smoke">{t("Les cibles viennent de ton corps, de ton objectif et du type de journée. Plus de 30 000 recettes avec la préparation étape par étape; les repas ne se répètent jamais sur trois jours.", "Targets come from your body, your goal and the kind of day it is. 30,000+ recipes with step-by-step cooking; meals never repeat within three days.")}</p>
            <label className="card p-4 flex gap-3 items-start text-left cursor-pointer">
              <input type="checkbox" className="tick mt-0.5 shrink-0" checked={ack} onChange={(e) => setAck(e.target.checked)} />
              <span className="text-xs text-smoke leading-relaxed"><strong className="text-ink">{t("Je comprends.", "I understand.")}</strong> {HEALTH_NOTICE[lang]}</span>
            </label>
            <label className="card p-4 flex gap-3 items-start text-left cursor-pointer">
              <input type="checkbox" className="tick mt-0.5 shrink-0" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span className="text-xs text-smoke leading-relaxed"><strong className="text-ink">{t("J’accepte", "I agree")}</strong> {t("les", "to the")} <Link href="/legal/terms" className="underline">{t("Conditions d’utilisation", "Terms of Use")}</Link> {t("et la", "and")} <Link href="/legal/privacy" className="underline">{t("Politique de confidentialité", "Privacy Policy")}</Link>{t(`, et je consens à ce que ${APP_NAME} utilise les informations de santé que j’entre — comme mon poids, mes blessures et ma fréquence cardiaque — pour bâtir mon plan.`, `, and I consent to ${APP_NAME} using the health information I enter — like my weight, injuries and heart rate — to build my plan.`)}</span>
            </label>
          </>)}
        </motion.div>
      </AnimatePresence>

      <AnimatePresence>{busy && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-[70] bg-ink text-bone grid place-items-center p-8">
          <div className="grid gap-6 w-full max-w-[380px]">
            <span className="display display--lg leading-[0.95]" style={{ fontSize: "var(--text-display-lg)" }}>{t("On bâtit", "Building")}<br /><em>{t("ton entraînement.", "your training.")}</em></span>
            <ul className="grid gap-3">
              {BUILD_STAGES.map((s, i) => (
                <motion.li key={s.en} initial={{ opacity: 0.25, x: -6 }} animate={{ opacity: stage >= i ? 1 : 0.25, x: 0 }} className="flex items-center gap-3 text-sm">
                  <span className={`w-5 h-5 rounded-full grid place-items-center border ${stage > i ? "bg-volt border-volt" : stage === i ? "border-volt" : "border-line"}`}>{stage > i && <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="#0A0A0A" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5 10 17l9-10" /></svg>}{stage === i && <motion.span className="w-2 h-2 rounded-full bg-volt" animate={{ scale: [1, 1.5, 1] }} transition={{ repeat: Infinity, duration: 0.9 }} />}</span>
                  {s[lang]}
                </motion.li>
              ))}
            </ul>
            <div className="bar"><motion.i animate={{ width: `${Math.min(100, ((stage + 1) / 4) * 100)}%` }} /></div>
          </div>
        </motion.div>
      )}</AnimatePresence>

      <div className="flex gap-3 mt-8 lg:mt-10">
        {step > 0 && <button type="button" className="pill" onClick={() => go(step - 1)}>{t("Retour", "Back")}</button>}
        {step < STEPS.length - 1 ? (
          <Press className="flex-1"><button type="button" className="pill pill--volt pill--block" disabled={!canNext} onClick={() => go(step + 1)}>{t("Continuer", "Continue")}</button></Press>
        ) : (
          <Press className="flex-1"><button type="button" className="pill pill--volt pill--block" disabled={busy || !ack || !consent} onClick={finish}>{busy ? t("On bâtit ton entraînement…", "Building your training…") : t("Créer mon entraînement", "Create my training")}</button></Press>
        )}
      </div>
      </div>
    </div>
  );
}
