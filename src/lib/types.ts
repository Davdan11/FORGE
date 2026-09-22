/* ─────────────────────────────────────────────────────────────
   FORGE domain types. Everything in the app is built on these.
   ───────────────────────────────────────────────────────────── */

export type Goal = "strength" | "build" | "recomp" | "cut" | "endurance" | "perform";
export type Level = "new" | "intermediate" | "advanced";
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
}

export type PainArea = "knee" | "back" | "shoulder" | "hip" | "wrist" | "ankle" | "elbow";

export interface Profile {
  id: string;             // local uuid, mirrored to Supabase user id on sign-in
  name: string;
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  units: Units;
  goal: Goal;
  level: Level;
  daysPerWeek: 2 | 3 | 4 | 5 | 6;
  sessionMinutes: 25 | 40 | 60 | 75;
  equipment: Equipment[];
  pain: PainArea[];
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
  dietary: ("vegetarian" | "vegan" | "pescatarian" | "halal" | "gluten_free" | "lactose_free")[];
  mealsPerDay: 3 | 4 | 5;
  wakeTime: string;       // "07:00"
  trainTime: string;      // "18:00"
  notifications: boolean;
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
}

export interface Session {
  id: string;
  planId: string;
  week: number;             // 1-12
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

export interface Plan {
  id: string;
  profileId: string;
  goal: Goal;
  startDate: string;
  weeks: 12;
  blocks: { name: string; weeks: number[]; intent: string; intensity: string }[];
  season?: { eventName: string; eventDate: string; phases: { name: string; from: string; to: string }[] };
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
export type ActivityType = "run" | "ride" | "walk" | "hike" | "row" | "ruck" | "ski" | "trail" | "swim" | "other";
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
  meta?: { poolM?: 25 | 50; laps?: number; discipline?: string; bike?: string };
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
export interface DayPlanMeal { slot: MealSlot; time: string; mealId: string; scale: number; done?: boolean }
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
  totals: { sessions: number; volumeKg: number; distanceM: number; mobilityMin: number; mealsLogged: number; activities?: number; shared?: number; elevGainM?: number };
}
export interface Badge {
  id: string; name: string; desc: string; pillar: Pillar | "all";
  check: (s: Stats, extra: BadgeContext) => boolean;
  /** Optional [current, target] for a progress bar toward the badge. */
  progress?: (s: Stats, extra: BadgeContext) => [number, number];
}
export interface BadgeContext { bestE1rm: Record<string, number>; bodyweightKg: number; best5kSec?: number; zone2Min: number }
