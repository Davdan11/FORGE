/* ─────────────────────────────────────────────────────────────
   FORGE domain types. Everything in the app is built on these.
   ───────────────────────────────────────────────────────────── */

export type Goal = "strength" | "build" | "recomp" | "cut" | "endurance" | "perform";
export type Level = "new" | "intermediate" | "advanced";
/** Weight and distance are chosen separately: plenty of places weigh in pounds
 *  and run in kilometres — Québec among them — and forcing one system on both
 *  makes the app wrong for them in one direction or the other. */
export type WeightUnit = "kg" | "lb";
export type DistanceUnit = "km" | "mi";
export interface UnitPrefs { weight: WeightUnit; distance: DistanceUnit }
/** Legacy single-system value, still found in rows written before the split. */
export type Units = "metric" | "imperial";
export type Sex = "female" | "male" | "other";
export type Equipment =
  | "barbell" | "dumbbell" | "kettlebell" | "cable" | "machine" | "bodyweight"
  | "band" | "pullup_bar" | "bench" | "rack" | "rower" | "bike" | "treadmill" | "outdoor";
export type Muscle =
  | "quads" | "hamstrings" | "glutes" | "calves" | "chest" | "back" | "lats" | "traps"
  | "shoulders" | "biceps" | "triceps" | "forearms" | "core" | "hips" | "spine" | "ankles"
  | "cardio" | "full_body";
export type Pattern =
  | "squat" | "hinge" | "push_h" | "push_v" | "pull_h" | "pull_v" | "lunge" | "carry"
  | "core" | "mobility" | "cardio" | "power";
export type Pillar = "strength" | "endurance" | "mobility" | "nutrition" | "recovery";

export interface Exercise {
  slug: string;
  name: string;
  pattern: Pattern;
  pillar: Pillar;
  primary: Muscle[];
  secondary: Muscle[];
  equipment: Equipment[];
  level: Level;
  unilateral?: boolean;
  /** Loadable = we prescribe weight; otherwise reps / time only. */
  loadable: boolean;
  timed?: boolean;
  tempo?: string;
  cues: string[];
  faults: string[];
  /** Simple relative strength anchor vs back squat (1.0) for load estimates. */
  ratio?: number;
  /** Alternatives by slug for swaps (equipment, pain, preference). */
  swaps: string[];
  /** Media: video URL and 3D model URL (glTF) when available. */
  video?: string;
  model3d?: string;
  image?: string;
  painFlags?: PainArea[];
  /** Works one muscle through one joint. Good accessory work, never the
   *  main lift of a session. */
  isolation?: boolean;
}

export type PainArea = "knee" | "back" | "shoulder" | "hip" | "wrist" | "ankle" | "elbow";

/** How much an injury is limiting the athlete right now. */
export type InjurySeverity = 1 | 2 | 3;   // 1 niggle · 2 limits training · 3 limits daily life
export type InjuryPhase = "protect" | "reload" | "return" | "clear";

/** A running injury record. The engine reads these to shape the prescription;
 *  it is training guidance, never a diagnosis. */
export interface Injury {
  id: string;
  area: PainArea;
  severity: InjurySeverity;
  /** ISO date the athlete first logged it. */
  since: string;
  /** ISO date it last flared up. Drives the return ladder. */
  lastFlareAt?: string;
  note?: string;
  /** Set when the athlete clears it; the engine then ignores it. */
  resolvedAt?: string;
}


export type TrainingPlace = "full_gym" | "home_gym" | "no_gym";
export type AvoidFood = "nuts" | "peanuts" | "shellfish" | "fish" | "eggs" | "dairy" | "soy" | "pork" | "red_meat";
export interface Lifestyle {
  sleep: "under_6" | "6_7" | "7_8" | "over_8";
  stress: "low" | "moderate" | "high";
  /** How the day is spent outside training. */
  work: "desk" | "on_feet" | "physical";
}

export interface Profile {
  id: string;             // local uuid, mirrored to Supabase user id on sign-in
  name: string;
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  units: UnitPrefs;
  goal: Goal;
  level: Level;
  daysPerWeek: 2 | 3 | 4 | 5 | 6;
  sessionMinutes: 25 | 40 | 60 | 75;
  equipment: Equipment[];
  /** Where the training happens. A full gym has everything; only a home gym
   *  needs the inventory. Absent on profiles written before it existed. */
  trainingPlace?: TrainingPlace;
  /** Hurts now: movements that load these joints are never prescribed. */
  pain: PainArea[];
  /** Hurt before and healed. Not excluded — the engine prefers the kinder
   *  variant when one exists, because old injuries are where new ones start. */
  injuryHistory?: PainArea[];
  /** Recovery outside the gym. Sets volume and energy needs. */
  lifestyle?: Lifestyle;
  /** Optional dated target: race, competition, event. */
  eventName?: string;
  eventDate?: string;     // ISO date
  /** Baselines from the assessment (kg, reps, seconds). */
  baselines: {
    squatE1rm?: number;
    hingeE1rm?: number;
    pushE1rm?: number;
    pullReps?: number;
    plankSec?: number;
    run12minM?: number;
    hipScreen?: number;   // 0-100
    shoulderScreen?: number;
    ankleScreen?: number;
  };
  dietary: ("vegetarian" | "vegan" | "pescatarian" | "halal" | "gluten_free" | "lactose_free" | "keto")[];
  /** Foods never served, whatever the diet: allergies, dislikes, beliefs. */
  avoidFoods?: AvoidFood[];
  mealsPerDay: 3 | 4 | 5;
  wakeTime: string;       // "07:00"
  trainTime: string;      // "18:00"
  notifications: boolean;
  /** Weight on the day the plan was built: the start line for progress badges. */
  startWeightKg?: number;
  /** When the health notice was accepted, at onboarding. */
  healthNoticeAt?: string;
  /** When the terms, privacy policy and processing of health data were agreed to. */
  consentAt?: string;
  /** Functional threshold power, watts. Unset until tested or entered. */
  ftpW?: number;
  /** Threshold running speed, km/h. */
  thresholdKmh?: number;
  /** Structured indoor workouts the athlete built. Stored on the profile so
   *  they travel with the account without a table of their own. */
  indoorWorkouts?: import("./indoor/workouts").StructuredWorkout[];
  /** The Unity indoor game's state that follows the account: the trophy case
   *  (JSON the game writes) and the outfit code. Opaque to the app. */
  indoorGame?: { palmares?: string; look?: string };
  createdAt: string;
  supabaseUserId?: string;
}

/* ── Plan ─────────────────────────────────────────────────── */
export type SessionKind = "lower" | "upper" | "full" | "push" | "pull" | "legs" | "cardio_z2" | "cardio_intervals" | "mobility" | "rest";

export interface PrescribedSet {
  reps?: number;            // target reps
  seconds?: number;         // for timed work
  rpe?: number;             // target RPE
  loadKg?: number;          // prescribed load (metric internally)
  pct?: number;             // % of e1RM used to derive load
  restSec: number;
}

export interface PrescribedExercise {
  id: string;
  slug: string;
  sets: PrescribedSet[];
  why: string;
  block: "prep" | "main" | "accessory" | "finisher" | "cooldown";
  /** Put there by the athlete from the library, not by the engine. Survives
   *  the engine rewriting the session (see engine/custom.ts). */
  added?: boolean;
}

export interface Session {
  id: string;
  planId: string;
  week: number;             // 1-based, counted from the plan start
  day: number;              // 1-7
  date: string;             // ISO date
  kind: SessionKind;
  title: string;
  minutes: number;
  focus: Pillar;
  exercises: PrescribedExercise[];
  cardio?: { zone: 1 | 2 | 3 | 4 | 5; minutes: number; structure?: string };
  why: string;
  status: "planned" | "done" | "skipped" | "adjusted";
  adjustment?: { reason: string; from: string; changes: string[] };
  readinessAtStart?: number;
}

/** Four weeks: three loading, one deload. */
export interface PlanBlock {
  name: string;
  weeks: number[];
  intent: string;
  intensity: string;
  /** What the previous block showed and what changed because of it.
   *  Set when the block is rebuilt from real training. */
  review?: BlockReview;
}
export interface BlockReview {
  at: string;
  sessionsDone: number;
  sessionsPlanned: number;
  /** Logged RPE minus prescribed RPE, averaged. + means harder than planned. */
  rpeGap?: number;
  changes: string[];
  /** What the engine applied to the block (see BlockTuning in engine/plan). */
  tuning: { loadMul: number; accessorySets: number; rpe: number };
}

export interface Plan {
  id: string;
  profileId: string;
  goal: Goal;
  startDate: string;
  /** Weeks programmed so far. The programme never ends: a new block is
   *  appended before the last one runs out. */
  weeks: number;
  blocks: PlanBlock[];
  season?: { eventName: string; eventDate: string; phases: { name: string; from: string; to: string }[] };
  /** The last break that was eased (see engine/comeback.ts). */
  comeback?: { lastTrained: string; at: string; daysAway: number; until: string; loadMul: number };
  createdAt: string;
}

/* ── Logging ───────────────────────────────────────────────── */
export interface LoggedSet {
  id: string;
  sessionId: string;
  exerciseId: string;       // PrescribedExercise.id
  slug: string;
  setIndex: number;
  reps?: number;
  seconds?: number;
  loadKg?: number;
  rpe?: number;
  at: string;
  adjusted?: string;        // why the prescription changed for this set
}

export interface SessionLog {
  id: string;
  sessionId: string;
  startedAt: string;
  endedAt?: string;
  durationSec?: number;
  volumeKg?: number;
  avgRpe?: number;
  notes?: string;
  xp: number;
}

/* ── Readiness / recovery ──────────────────────────────────── */
export interface Readiness {
  id: string;               // date ISO
  date: string;
  sleepHours: number;
  sleepQuality: 1 | 2 | 3 | 4 | 5;
  soreness: 1 | 2 | 3 | 4 | 5;
  stress: 1 | 2 | 3 | 4 | 5;
  mood: 1 | 2 | 3 | 4 | 5;
  hrv?: number;
  restingHr?: number;
  score: number;            // 0-100 computed
  minutesAvailable?: number;
  equipmentToday?: "full" | "dumbbells" | "bodyweight";
  painToday?: PainArea[];
}

/* ── Cardio / GPS ──────────────────────────────────────────── */
export type ActivityType =
  | "run" | "trail" | "walk" | "hike" | "ruck"
  | "ride" | "mtb" | "gravel" | "skate"
  | "ski" | "ski_alpine" | "snowboard" | "ice_skate"
  | "swim" | "row" | "kayak" | "surf"
  | "climb" | "boulder"
  | "soccer" | "football" | "hockey" | "basketball" | "tennis" | "combat"
  | "skydive" | "paraglide"
  | "other";
export interface TrackPoint { t: number; lat: number; lng: number; alt?: number; acc?: number; hr?: number }
export interface Lap { label: string; seconds: number; distanceM: number; zone: number }
export interface Activity {
  id: string;
  type: ActivityType;
  startedAt: string;
  endedAt?: string;
  distanceM: number;
  durationSec: number;
  movingSec?: number;
  avgPaceSecKm?: number;
  maxSpeedMs?: number;
  elevGainM: number;
  elevLossM?: number;
  points: TrackPoint[];
  splits: { km: number; sec: number }[];
  laps?: Lap[];
  title: string;
  note?: string;
  feel?: 1 | 2 | 3 | 4 | 5;
  sessionId?: string;
  workoutId?: string;
  shared?: boolean;
  sharedAt?: string;
  xp: number;
  /** Sport-specific details (pool length and laps for swims, discipline for ski…). */
  meta?: {
    poolM?: 25 | 50; laps?: number; discipline?: string; bike?: string;
    /** Indoor sessions: the virtual course, what measured the effort, and the workout followed. */
    indoor?: { course: string; quality: "measured" | "estimated" | "declared"; avgW?: number; workout?: string; workoutDone?: boolean; with?: number };
  };
  /** [seconds since start, bpm] from a Bluetooth strap or watch, every ~5 s. */
  hrSeries?: [number, number][];
  /** Indoor rides: one sample a second (distance, altitude, power, HR, cadence) for the TCX export. */
  streams?: import("./tcx").RideStreams;
  avgHr?: number;
  maxHr?: number;
  kcal?: number;
  /** Whether `kcal` came from heart rate or is an estimate from sport and pace. */
  kcalSource?: "heart_rate" | "estimate";
}

/* ── Guided cardio workouts ────────────────────────────────── */
export type WorkoutKind = "easy" | "long" | "tempo" | "intervals" | "hills" | "fartlek" | "recovery" | "test";
export interface WorkoutSegment { label: string; seconds: number; zone: 1 | 2 | 3 | 4 | 5; cue: string; repeat?: number }
export interface CardioWorkout {
  id: string;
  name: string;
  type: ActivityType;
  kind: WorkoutKind;
  minutes: number;
  zone: 1 | 2 | 3 | 4 | 5;
  image: string;
  description: string;
  why: string;
  segments: WorkoutSegment[];
  cues: string[];
  level: Level;
}

export interface WeighIn { id: string; date: string; kg: number; note?: string }

/* ── Nutrition ─────────────────────────────────────────────── */
export type MealSlot = "breakfast" | "lunch" | "snack" | "dinner" | "pre" | "post";
export interface Meal {
  id: string;
  name: string;
  slot: MealSlot[];
  kcal: number;
  protein: number;
  carbs: number;
  sugar: number;
  fat: number;
  fiber: number;
  tags: ("vegetarian" | "vegan" | "pescatarian" | "gluten_free" | "lactose_free" | "quick" | "batch" | "high_protein" | "low_carb" | "low_sugar")[];
  /** Generated recipes are rebuilt from their id; curated ones live in meals.ts. */
  generated?: boolean;
  ingredients: { item: string; qty: string }[];
  /** Ordered cooking steps. "N min" inside a step powers the cook-mode timer. */
  steps: string[];
  minutes: number;
  image: string;
  tip?: string;
  cuisine?: string;
}
export interface DayPlanMeal {
  slot: MealSlot; time: string; mealId: string; scale: number; done?: boolean;
  /** "Pre-workout" or "Recovery meal" when a regular meal doubles as one. */
  note?: string;
}
export interface NutritionDay {
  id: string;               // date ISO
  date: string;
  dayType: "train" | "rest" | "hard";
  targets: { kcal: number; protein: number; carbs: number; fat: number };
  meals: DayPlanMeal[];
  waterMl: number;
}

/* ── Gamification ──────────────────────────────────────────── */
export interface Stats {
  id: "me";
  xp: number;
  level: number;
  streakWeeks: number;
  lastActiveWeek?: string;
  badges: string[];         // badge ids
  /** Sport challenges already paid for (see lib/challenges.ts), newest last. */
  challengesDone?: string[];
  /** Daily rewards already paid today (check-in, each meal, full day), so
   *  undoing and redoing an action cannot pay twice. */
  paidDay?: { date: string; keys: string[] };
  totals: { sessions: number; volumeKg: number; distanceM: number; mobilityMin: number; mealsLogged: number; activities?: number; shared?: number; elevGainM?: number };
}
export interface Badge {
  id: string; name: string; desc: string; pillar: Pillar | "all";
  check: (s: Stats, extra: BadgeContext) => boolean;
  /** Optional [current, target] for a progress bar toward the badge. */
  progress?: (s: Stats, extra: BadgeContext) => [number, number];
}
export interface BadgeContext {
  bestE1rm: Record<string, number>; bodyweightKg: number; best5kSec?: number; zone2Min: number;
  /** Body-weight change since the plan started, kg (negative = lost). */
  weightChangeKg?: number;
  goal?: Goal;
  /** Training weeks where every planned session was done. */
  fullWeeks?: number;
}
