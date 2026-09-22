import type { CardioWorkout, WorkoutSegment } from "../types";

/* ─────────────────────────────────────────────────────────────
   Guided cardio workouts v0.1 — structured segments the recorder
   plays back live (countdown, zone target, cue, vibration on change).
   Zones: 1 recovery · 2 easy/conversational · 3 steady · 4 threshold · 5 max.
   ───────────────────────────────────────────────────────────── */

const P = (id: string) => `https://images.unsplash.com/photo-${id}?w=1200&h=800&fit=crop&q=75&auto=format`;
const S = (label: string, seconds: number, zone: WorkoutSegment["zone"], cue: string, repeat?: number): WorkoutSegment => ({ label, seconds, zone, cue, repeat });
const wu = (sec = 600) => S("Warm-up", sec, 2, "Easy. Conversational. Let the legs wake up before you ask anything of them.");
const cd = (sec = 300) => S("Cool-down", sec, 1, "Slow to a shuffle, then a walk. Breathe through the nose if you can.");

/** Expand repeats into a flat segment list for playback. */
export function expandSegments(w: CardioWorkout): WorkoutSegment[] {
  const out: WorkoutSegment[] = [];
  for (const s of w.segments) {
    if (s.repeat && s.repeat > 1) { for (let i = 1; i <= s.repeat; i++) out.push({ ...s, label: `${s.label} ${i}/${s.repeat}`, repeat: undefined }); }
    else out.push(s);
  }
  return out;
}

export const WORKOUTS: CardioWorkout[] = [
  { id: "z2-run-40", name: "Zone 2 run · 40", type: "run", kind: "easy", minutes: 40, zone: 2, level: "new", image: P("1486218119243-13883505764c"),
    description: "Forty easy minutes. The pace where you could tell a story. This is the base everything else is built on.",
    why: "Zone 2 grows mitochondria and capillaries — the aerobic engine that makes every hard session recoverable.",
    segments: [S("Walk", 180, 1, "Three minutes of brisk walking. Arms swinging."), S("Easy run", 2100, 2, "Nose-breathing pace. If you can't speak a full sentence, slow down."), cd(120)],
    cues: ["Cadence around 170–180 steps per minute — short, quick steps.", "If your heart rate climbs, walk 30 s. Ego stays at home.", "Finish feeling like you could do it again."] },
  { id: "z2-run-60", name: "Long easy run · 60", type: "run", kind: "long", minutes: 60, zone: 2, level: "intermediate", image: P("1571008887538-b36bb32f4571"),
    description: "The weekly long one. Same easy effort, longer time on feet.",
    why: "Duration, not speed, is what drives fat oxidation and tendon resilience. This is where distance PRs come from.",
    segments: [wu(300), S("Easy run", 3000, 2, "Settle in. Check your form every ten minutes: tall, relaxed shoulders, quiet feet."), cd(300)],
    cues: ["Fuel before: 30–60 g carbs an hour out.", "Sip water if it's warm.", "Last 10 minutes: hold form, don't chase pace."] },
  { id: "tempo-run-20", name: "Tempo run · 20 min", type: "run", kind: "tempo", minutes: 40, zone: 4, level: "intermediate", image: P("1571008887538-b36bb32f4571"),
    description: "Ten easy, twenty at threshold, ten easy. Comfortably hard: you can say three words, not a sentence.",
    why: "Threshold work raises the pace you can hold for an hour. It's the single best return on hard-running time.",
    segments: [wu(600), S("Tempo", 1200, 4, "Comfortably hard. Controlled breathing, 2-in 2-out. Don't start too fast — the last five minutes should feel like the first."), cd(600)],
    cues: ["Pick a flat route.", "Same pace start to finish beats a fast start and a fade.", "Eat within an hour after."] },
  { id: "intervals-6x2", name: "Intervals · 6 × 2 min", type: "run", kind: "intervals", minutes: 38, zone: 5, level: "intermediate", image: P("1529900748604-07564a03e7a6"),
    description: "Six two-minute reps hard, two minutes easy between. Raises the ceiling.",
    why: "Short reps at VO2max pace teach the heart to pump more per beat. Six is the sweet spot for quality.",
    segments: [wu(600), S("Hard", 120, 5, "Fast but tall. Drive the arms, land under the hips. Rep 1 should feel too easy.", 6), S("Easy", 120, 1, "Jog or walk. Let the heart rate come down — you need it for the next one."), cd(300)],
    cues: ["The reps are an ask on the last two, not the first two.", "Same time or distance every rep — that's the test.", "Skip this one if readiness is red."] },
  { id: "hills-8", name: "Hill repeats · 8 × 45 s", type: "run", kind: "hills", minutes: 35, zone: 5, level: "intermediate", image: P("1530143311094-34d807799e8f"),
    description: "Find a hill that takes 45 seconds hard. Eight ups, walk down.",
    why: "Hills build power and running economy with less impact than flat sprints. Strength training in disguise.",
    segments: [wu(600), S("Hill", 45, 5, "Short steps, knees up, look at the top of the hill, not your feet.", 8), S("Walk down", 90, 1, "Walk. Shake the arms out. Recover fully."), cd(300)],
    cues: ["Drive the arms — they set the tempo for the legs.", "Lean from the ankles, not the waist.", "Walk the descent; jogging down is where knees complain."] },
  { id: "fartlek-30", name: "Fartlek · 30 min", type: "run", kind: "fartlek", minutes: 30, zone: 3, level: "new", image: P("1552674605-db6ffd4facb5"),
    description: "Play with speed: one minute quick, two minutes easy, on repeat. No watch-staring.",
    why: "Unstructured speed builds the same engine as intervals with less mental cost — ideal in the base phase.",
    segments: [wu(300), S("Quick", 60, 4, "Pick a lamppost and run to it briskly.", 7), S("Easy", 120, 2, "Back to easy. Loose."), cd(240)],
    cues: ["Terrain is your coach — surge on the flats, ease on the climbs.", "Smile. This one's meant to be fun."] },
  { id: "recovery-jog", name: "Recovery jog · 25", type: "run", kind: "recovery", minutes: 25, zone: 1, level: "new", image: P("1476231682828-37e571bc172f"),
    description: "Embarrassingly slow. Blood flow, not training.",
    why: "Active recovery clears the day-after stiffness faster than the couch — as long as it stays genuinely easy.",
    segments: [S("Walk", 180, 1, "Walk it in."), S("Jog", 1200, 1, "Slower than feels reasonable. Nose breathing the whole way."), S("Walk", 120, 1, "Walk it out.")],
    cues: ["If a walker passes you, you're doing it right.", "Soft surfaces if you have them."] },
  { id: "cooper-12", name: "12-minute test", type: "run", kind: "test", minutes: 27, zone: 5, level: "new", image: P("1538805060514-97d9cc17730c"),
    description: "Run as far as you can in twelve minutes. The engine re-calibrates your zones from the result.",
    why: "The Cooper test estimates VO2max from distance alone. Repeat every block to see the engine grow.",
    segments: [wu(600), S("12-minute test", 720, 5, "Even pace. Most people start too fast — the first two minutes should feel almost easy."), cd(300)],
    cues: ["Flat loop or track.", "Fresh legs: do it after a rest day.", "Log it — the distance updates your baseline."] },
  { id: "ride-z2-60", name: "Zone 2 ride · 60", type: "ride", kind: "easy", minutes: 60, zone: 2, level: "new", image: P("1541625602330-2277a4c46182"),
    description: "An hour of easy spinning. Cadence high, gear light.",
    why: "Cycling lets you bank aerobic hours with zero impact — perfect between heavy lower-body days.",
    segments: [wu(600), S("Easy ride", 2700, 2, "85–95 rpm. Conversational. Sit up and look around."), cd(300)],
    cues: ["Light gear, fast legs.", "Drink every 15 minutes.", "Flat or rolling, not a mountain."] },
  { id: "ride-sweetspot", name: "Sweet-spot ride · 2 × 15", type: "ride", kind: "tempo", minutes: 55, zone: 4, level: "intermediate", image: P("1517649763962-0c623066013b"),
    description: "Two 15-minute efforts just under threshold, five easy between.",
    why: "Sweet spot (88–94% of threshold) gives most of the fitness of threshold work with half the fatigue.",
    segments: [wu(600), S("Sweet spot", 900, 4, "Hard but sustainable. Steady cadence, steady breathing.", 2), S("Easy spin", 300, 1, "Spin it out, drink."), cd(300)],
    cues: ["Same power both efforts.", "Stay seated.", "Eat afterwards — this one empties the tank."] },
  { id: "hike-90", name: "Hike · 90 min", type: "hike", kind: "long", minutes: 90, zone: 2, level: "new", image: P("1551632811-561732d1e306"),
    description: "Ninety minutes on trail, climbing if you can. Time on feet, elevation in the bank.",
    why: "Hiking with elevation is Zone 2 with a strength component — and it counts every metre of gain.",
    segments: [S("Hike", 5400, 2, "Steady. Poles if you have them. Short steps on the climbs.")],
    cues: ["Pack water and a snack.", "Downhills: bend the knees, land soft.", "The vertical metres are the point — pick a hill."] },
  { id: "ruck-45", name: "Ruck · 45 min", type: "ruck", kind: "easy", minutes: 45, zone: 2, level: "new", image: P("1553531384-397c80973a0b"),
    description: "Walk fast with 10–20% of bodyweight on your back.",
    why: "Rucking loads the posture and the heart at once. Low skill, high return, and it's a walk.",
    segments: [S("Ruck", 2700, 2, "Brisk. Chest up, pack tight to the back. 12–14 min per km.")],
    cues: ["Start at 10% bodyweight; add 2 kg a week.", "Hip belt tight, shoulders relaxed.", "Good shoes matter more than the pack."] },
  { id: "row-4x1000", name: "Row · 4 × 1000 m", type: "row", kind: "intervals", minutes: 40, zone: 4, level: "intermediate", image: P("1519505907962-0a6cb0167c73"),
    description: "Four 1000-metre pieces at threshold, three minutes easy between.",
    why: "The rower trains the whole posterior chain and the heart together. 1k pieces are the classic threshold builder.",
    segments: [wu(480), S("1000 m", 240, 4, "Legs, back, arms. Stroke rate 26–28. Same split every piece.", 4), S("Easy paddle", 180, 1, "Slow strokes, breathe."), cd(240)],
    cues: ["Damper 4–6.", "Push with the legs — arms are the last 10%.", "Negative split the last piece if you have it."] },
  { id: "walk-30", name: "Walk · 30 min", type: "walk", kind: "recovery", minutes: 30, zone: 1, level: "new", image: P("1508672019048-805c876b67e2"),
    description: "Thirty minutes outside. Counts. Really.",
    why: "Daily walking is the most under-rated recovery and body-composition tool there is.",
    segments: [S("Walk", 1800, 1, "Head up, phone away. Brisk enough that talking takes a little effort.")],
    cues: ["Post-meal walks blunt blood sugar.", "Ten minutes is better than zero minutes."] },
  { id: "ski-touring", name: "Ski · 60 min", type: "ski", kind: "easy", minutes: 60, zone: 3, level: "intermediate", image: P("1551698618-1dfe5d97d256"),
    description: "An hour on snow — touring, nordic or laps. Steady effort, big vertical.",
    why: "Skiing is full-body aerobic work with a huge elevation return. Winter's best Zone 2–3.",
    segments: [S("Ski", 3600, 3, "Steady. Layers off before you sweat, on before you chill.")],
    cues: ["Hydrate — cold hides thirst.", "Legs burn? Ease off the edges."] },
  { id: "trail-run-50", name: "Trail run · 50", type: "trail", kind: "easy", minutes: 50, zone: 2, level: "intermediate", image: P("1476231682828-37e571bc172f"),
    description: "Fifty minutes on dirt. Effort easy, terrain honest.",
    why: "Trail running builds ankle strength, proprioception and a stronger heart per kilometre than road.",
    segments: [wu(300), S("Trail", 2700, 2, "Effort, not pace. Walk the steep climbs — everyone does."), cd(300)],
    cues: ["Eyes 3 m ahead on descents.", "Shorten the stride on rocks.", "GPS distance reads low under trees — go by time."] },
];

export const WORKOUT_MAP: Record<string, CardioWorkout> = Object.fromEntries(WORKOUTS.map((w) => [w.id, w]));
export const ZONE_LABEL: Record<number, string> = { 1: "Recovery", 2: "Easy", 3: "Steady", 4: "Threshold", 5: "Max" };
export const ZONE_TALK: Record<number, string> = { 1: "Full conversation", 2: "Full sentences", 3: "Short sentences", 4: "A few words", 5: "No talking" };
export const workoutsFor = (type?: string) => (type ? WORKOUTS.filter((w) => w.type === type) : WORKOUTS);
