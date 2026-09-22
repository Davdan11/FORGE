/* ─────────────────────────────────────────────────────────────
   Turning effort into movement.

   This is the part that decides whether the mode feels real. A
   speed that ignores gradient turns a mountain into a corridor,
   and everyone notices within thirty seconds even if they could
   not say why.

   So the avatar is moved by the same equation a cyclist's body
   answers to: the power you produce is spent on rolling
   resistance, on pushing air aside, and on lifting your own mass
   up the hill. Whatever is left accelerates you.

     P = v · (Crr·m·g·cosθ + m·g·sinθ + ½·ρ·CdA·v²) / drivetrain

   There is no closed form for v, so it is integrated forward one
   tick at a time — which is also what makes acceleration feel
   like acceleration rather than a number snapping to a new value.
   ───────────────────────────────────────────────────────────── */

const G = 9.80665;
/** Air density at sea level, 15 °C. Altitude would change this by a few
 *  percent; nobody can feel a few percent. */
const RHO = 1.225;
/** Chain and bearings eat a little of what you put in. */
const DRIVETRAIN = 0.97;

export interface Bike {
  /** Rider plus machine, kilograms. */
  massKg: number;
  /** Drag area, m². 0.32 is an upright rider on the hoods; 0.25 is low and
   *  tucked; 0.40 is sitting up in a headwind. */
  cdA: number;
  /** Rolling resistance coefficient. 0.005 is a good tyre on tarmac. */
  crr: number;
}

export const ROAD_BIKE = (massKg: number): Bike => ({ massKg: massKg + 8, cdA: 0.32, crr: 0.005 });

/**
 * Advance one tick.
 *
 * `gradient` is rise over run, so 0.08 is an eight percent climb. `dt` is
 * seconds. Returns the new speed in m/s.
 */
export function step(speedMs: number, watts: number, gradient: number, bike: Bike, dt: number): number {
  const v = Math.max(speedMs, 0);
  const m = bike.massKg;

  // At a realistic gradient cos θ ≈ 1 and sin θ ≈ gradient, but the app also
  // has to survive whatever a course generator hands it, so do it properly.
  const theta = Math.atan(gradient);

  const rolling = bike.crr * m * G * Math.cos(theta);
  const gravity = m * G * Math.sin(theta);
  const drag = 0.5 * RHO * bike.cdA * v * v;

  const resisting = rolling + gravity + drag;
  // Propulsive force from power. At a standstill P/v is infinite, so cap the
  // force at what the rider could actually apply — otherwise the first tick
  // launches them at absurd speed.
  const drive = v > 0.5 ? (watts * DRIVETRAIN) / v : Math.min(watts * DRIVETRAIN, m * 4);

  const next = v + ((drive - resisting) / m) * dt;

  // Freewheeling down a hill is real; rolling backwards up one is not, because
  // a rider who stops pedalling on a climb puts a foot down.
  return Math.max(0, next);
}

/**
 * The steady speed a given power would settle at on a given gradient.
 *
 * Not used to drive the avatar — `step` does that — but it is how the physics
 * is checked against numbers a cyclist can recognise, and how a course
 * estimates a finishing time before anyone rides it.
 */
export function steadySpeed(watts: number, gradient: number, bike: Bike): number {
  // Bisection rather than algebra: the cubic has a closed form, and it is far
  // easier to be wrong about than a loop that cannot converge on a lie.
  let lo = 0, hi = 30;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const theta = Math.atan(gradient);
    const need = mid * (bike.crr * bike.massKg * G * Math.cos(theta) + bike.massKg * G * Math.sin(theta) + 0.5 * RHO * bike.cdA * mid * mid) / DRIVETRAIN;
    if (need > watts) hi = mid; else lo = mid;
  }
  return (lo + hi) / 2;
}

/* ─────────────────────────────────────────────────────────────
   When there is no power meter.

   Three of the four ways into this mode do not measure watts, so
   they have to be estimated — and an estimate dressed up as a
   measurement is the kind of lie this app does not tell. Every
   function below returns a number AND says how much it is worth,
   and the caller is expected to carry that through to the screen
   and to the XP.
   ───────────────────────────────────────────────────────────── */

export type EffortQuality = "measured" | "estimated" | "declared";

export interface Effort {
  watts: number;
  quality: EffortQuality;
}

/**
 * Power from heart rate.
 *
 * Honest about what this is: heart rate says how hard the body is working,
 * not how much is reaching the pedals, and the relationship drifts with
 * fatigue, heat, caffeine and sleep. It also LAGS — thirty to sixty seconds
 * behind a change in effort — so a sprint shows up after it is over. Good
 * enough to move an avatar believably over minutes. Not good enough to race.
 *
 * `ftp` is functional threshold power: the watts someone holds for an hour.
 * Heart rate reserve maps onto a fraction of it.
 */
export function powerFromHr(hr: number, restHr: number, maxHr: number, ftp: number): Effort {
  const reserve = Math.max(1, maxHr - restHr);
  const intensity = clamp((hr - restHr) / reserve, 0, 1.15);
  // Below about 50% of heart-rate reserve almost nothing is happening at the
  // pedals; above threshold the curve steepens. A squared-ish response fits
  // better than a straight line and costs nothing.
  const frac = intensity <= 0.5 ? intensity * 0.5 : 0.25 + Math.pow((intensity - 0.5) / 0.5, 1.4) * 1.05;
  return { watts: Math.round(clamp(frac * ftp, 0, ftp * 1.6)), quality: "estimated" };
}

/** Age-predicted maximum heart rate (Tanaka). Better than 220−age, which
 *  overestimates the young and underestimates everyone over fifty. */
export const maxHrFor = (age: number) => Math.round(208 - 0.7 * age);

/**
 * A rough FTP when nobody has ever tested one.
 *
 * Watts per kilogram by training level, which is the crudest defensible
 * guess. It exists so heart-rate mode has a scale at all, and it should be
 * replaced by a real number the moment the athlete rides with a power meter.
 */
export function guessFtp(weightKg: number, level: "new" | "returning" | "intermediate" | "advanced"): number {
  const wPerKg = { new: 1.9, returning: 2.2, intermediate: 2.9, advanced: 3.8 }[level] ?? 2.2;
  return Math.round(weightKg * wPerKg);
}

/**
 * Power from a speed the machine reported.
 *
 * A dumb trainer with a speed sensor is a closed system: its resistance curve
 * turns wheel speed into a known power. Curves differ by model, so this is the
 * generic quadratic most of them approximate, and it is an estimate for the
 * same reason — the app does not know which trainer is under the bike.
 */
export function powerFromSpeed(speedMs: number): Effort {
  const kmh = speedMs * 3.6;
  return { watts: Math.round(clamp(0.0115 * kmh * kmh * kmh * 0.08 + 2.2 * kmh, 0, 900)), quality: "estimated" };
}

/**
 * Effort someone typed in.
 *
 * Kept deliberately separate and labelled `declared`, because it is not a
 * measurement of anything. It exists so a person with no hardware can still
 * ride the course and see the world move — and it must never be worth XP or a
 * place on a board, or every board becomes a list of people who typed 400.
 */
export function declaredPower(watts: number): Effort {
  return { watts: clamp(Math.round(watts), 0, 600), quality: "declared" };
}

/** What a session's effort is worth toward progression. Mirrors the reasoning
 *  in lib/verify.ts: you are credited for what the data supports. */
export const XP_CREDIT: Record<EffortQuality, number> = {
  measured: 1,
  estimated: 0.6,
  declared: 0,
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
