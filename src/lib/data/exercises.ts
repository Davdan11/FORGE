import type { Equipment, Exercise, Muscle, PainArea, Pattern } from "../types";

/* ─────────────────────────────────────────────────────────────
   Exercise bank v0.1 — hand-authored, structured for the engine.
   Each entry: pattern, muscles, equipment, cues, faults, swaps.
   `ratio` anchors load estimates relative to back squat e1RM.
   Media (video / model3d) attach later without changing the schema.
   ───────────────────────────────────────────────────────────── */

const E = (e: Exercise) => e;

export const EXERCISES: Exercise[] = [
  /* ── Squat pattern ─────────────────────────────────────── */
  E({ slug: "back-squat", name: "Back squat", pattern: "squat", pillar: "strength", primary: ["quads", "glutes"], secondary: ["hamstrings", "core", "spine"], equipment: ["barbell", "rack"], level: "intermediate", loadable: true, tempo: "3-1-1-0", ratio: 1,
    cues: ["Brace before you unrack: big breath into the belt line.", "Knees track over the middle toe.", "Hips and chest rise together — no good-morning."],
    faults: ["Knees caving in on the way up.", "Heels lifting: ankle mobility or stance too narrow.", "Chest dropping at the bottom."],
    swaps: ["front-squat", "goblet-squat", "leg-press", "bulgarian-split-squat"], painFlags: ["knee", "back"] }),
  E({ slug: "front-squat", name: "Front squat", pattern: "squat", pillar: "strength", primary: ["quads"], secondary: ["glutes", "core", "back"], equipment: ["barbell", "rack"], level: "intermediate", loadable: true, tempo: "3-0-1-0", ratio: 0.82,
    cues: ["Elbows high, bar on the shelf of the shoulders.", "Sit straight down between the heels.", "Stay tall out of the hole."],
    faults: ["Elbows dropping — bar rolls forward.", "Wrist pain from gripping the bar: use straps or cross grip."],
    swaps: ["back-squat", "goblet-squat", "safety-bar-squat"], painFlags: ["knee", "wrist"] }),
  E({ slug: "goblet-squat", name: "Goblet squat", pattern: "squat", pillar: "strength", primary: ["quads", "glutes"], secondary: ["core"], equipment: ["dumbbell", "kettlebell"], level: "new", loadable: true, tempo: "3-1-1-0", ratio: 0.3,
    cues: ["Hold the bell against the chest, elbows in.", "Push the knees out and sit between them.", "Pause at the bottom, drive the floor away."],
    faults: ["Leaning forward to counterbalance.", "Rushing the descent."],
    swaps: ["back-squat", "bodyweight-squat", "leg-press"] }),
  E({ slug: "bodyweight-squat", name: "Bodyweight squat", pattern: "squat", pillar: "strength", primary: ["quads", "glutes"], secondary: [], equipment: ["bodyweight"], level: "new", loadable: false, tempo: "3-1-1-0",
    cues: ["Arms forward for balance.", "Full depth if the knees allow.", "Control the descent — three seconds."],
    faults: ["Heels lifting.", "Half reps."],
    swaps: ["goblet-squat", "wall-sit", "bulgarian-split-squat"] }),
  E({ slug: "leg-press", name: "Leg press", pattern: "squat", pillar: "strength", primary: ["quads", "glutes"], secondary: ["hamstrings"], equipment: ["machine"], level: "new", loadable: true, ratio: 1.8,
    cues: ["Feet mid-platform, shoulder width.", "Lower until the hips just start to tuck.", "Don't lock the knees at the top."],
    faults: ["Lower back rounding off the pad.", "Locking out hard."],
    swaps: ["back-squat", "goblet-squat", "hack-squat"] , painFlags: ["knee"]}),
  E({ slug: "hack-squat", name: "Hack squat", pattern: "squat", pillar: "strength", primary: ["quads"], secondary: ["glutes"], equipment: ["machine"], level: "intermediate", loadable: true, ratio: 1.3,
    cues: ["Back flat on the pad.", "Drive through mid-foot."], faults: ["Heels rising."], swaps: ["leg-press", "front-squat"] , painFlags: ["knee"]}),
  E({ slug: "safety-bar-squat", name: "Safety-bar squat", pattern: "squat", pillar: "strength", primary: ["quads", "glutes"], secondary: ["back", "core"], equipment: ["barbell", "rack"], level: "intermediate", loadable: true, ratio: 0.9,
    cues: ["Handles forward, elbows down.", "Fight the bar pulling you forward."], faults: ["Forward collapse."], swaps: ["back-squat", "front-squat"], painFlags: ["shoulder"] }),
  E({ slug: "wall-sit", name: "Wall sit", pattern: "squat", pillar: "strength", primary: ["quads"], secondary: [], equipment: ["bodyweight"], level: "new", loadable: false, timed: true,
    cues: ["Thighs parallel, back flat on the wall.", "Breathe."], faults: ["Hands on thighs."], swaps: ["bodyweight-squat"] }),

  /* ── Hinge pattern ─────────────────────────────────────── */
  E({ slug: "deadlift", name: "Deadlift", pattern: "hinge", pillar: "strength", primary: ["hamstrings", "glutes", "back"], secondary: ["traps", "forearms", "core"], equipment: ["barbell"], level: "intermediate", loadable: true, tempo: "1-0-1-1", ratio: 1.2,
    cues: ["Bar over mid-foot, shins to the bar.", "Pull the slack out before the floor leaves.", "Push the floor away; hips and shoulders rise together."],
    faults: ["Hips shooting up first.", "Bar drifting away from the legs.", "Rounding the upper back under load."],
    swaps: ["trap-bar-deadlift", "romanian-deadlift", "kettlebell-swing"], painFlags: ["back"] }),
  E({ slug: "trap-bar-deadlift", name: "Trap-bar deadlift", pattern: "hinge", pillar: "strength", primary: ["glutes", "quads", "hamstrings"], secondary: ["back", "traps"], equipment: ["barbell"], level: "new", loadable: true, ratio: 1.25,
    cues: ["Stand in the middle, handles at mid-thigh.", "Big chest, push through the floor."], faults: ["Squatting it up with rounded back."], swaps: ["deadlift", "romanian-deadlift"], painFlags: ["back"] }),
  E({ slug: "romanian-deadlift", name: "Romanian deadlift", pattern: "hinge", pillar: "strength", primary: ["hamstrings", "glutes"], secondary: ["back"], equipment: ["barbell", "dumbbell"], level: "new", loadable: true, tempo: "3-1-1-0", ratio: 0.75,
    cues: ["Soft knees, hips back until you feel the hamstrings.", "Bar stays glued to the thighs.", "Neutral spine the whole way."],
    faults: ["Bending the knees into a squat.", "Going lower than the hamstrings allow — back rounds."],
    swaps: ["deadlift", "single-leg-rdl", "hip-thrust", "kettlebell-swing"], painFlags: ["back"] }),
  E({ slug: "single-leg-rdl", name: "Single-leg RDL", pattern: "hinge", pillar: "strength", primary: ["hamstrings", "glutes"], secondary: ["core", "ankles"], equipment: ["dumbbell", "kettlebell", "bodyweight"], level: "new", unilateral: true, loadable: true, tempo: "3-1-1-0", ratio: 0.2,
    cues: ["Hips square, back leg reaches straight behind.", "Slow down; balance is the point."], faults: ["Hip opening to the side."], swaps: ["romanian-deadlift", "hip-thrust"] }),
  E({ slug: "hip-thrust", name: "Hip thrust", pattern: "hinge", pillar: "strength", primary: ["glutes"], secondary: ["hamstrings"], equipment: ["barbell", "bench"], level: "new", loadable: true, tempo: "2-1-1-1", ratio: 1.1,
    cues: ["Chin tucked, ribs down.", "Squeeze hard at the top for one second."], faults: ["Over-arching the lower back at the top."], swaps: ["romanian-deadlift", "glute-bridge"] }),
  E({ slug: "glute-bridge", name: "Glute bridge", pattern: "hinge", pillar: "strength", primary: ["glutes"], secondary: ["hamstrings"], equipment: ["bodyweight"], level: "new", loadable: false, tempo: "2-1-1-1",
    cues: ["Heels close, squeeze at the top."], faults: ["Pushing through the toes."], swaps: ["hip-thrust"] }),
  E({ slug: "kettlebell-swing", name: "Kettlebell swing", pattern: "power", pillar: "strength", primary: ["glutes", "hamstrings"], secondary: ["core", "back"], equipment: ["kettlebell"], level: "new", loadable: true, ratio: 0.25,
    cues: ["Hinge, don't squat. The bell floats to chest height.", "Snap the hips; arms are ropes."], faults: ["Lifting with the arms.", "Rounded back at the bottom."], swaps: ["romanian-deadlift", "trap-bar-deadlift"], painFlags: ["back"] }),
  E({ slug: "good-morning", name: "Good morning", pattern: "hinge", pillar: "strength", primary: ["hamstrings", "back"], secondary: ["glutes"], equipment: ["barbell"], level: "advanced", loadable: true, tempo: "3-1-1-0", ratio: 0.45,
    cues: ["Bar high on the traps, hips back."], faults: ["Rounding."], swaps: ["romanian-deadlift"], painFlags: ["back"] }),

  /* ── Lunge / unilateral ────────────────────────────────── */
  E({ slug: "bulgarian-split-squat", name: "Bulgarian split squat", pattern: "lunge", pillar: "strength", primary: ["quads", "glutes"], secondary: ["hamstrings", "hips"], equipment: ["dumbbell", "bench", "bodyweight"], level: "new", unilateral: true, loadable: true, tempo: "3-0-1-0", ratio: 0.25,
    cues: ["Front foot far enough that the knee stays behind the toes.", "Torso slightly forward for glutes, upright for quads."], faults: ["Pushing off the back foot.", "Wobbling: slow down."], swaps: ["walking-lunge", "reverse-lunge", "step-up"], painFlags: ["knee"] }),
  E({ slug: "reverse-lunge", name: "Reverse lunge", pattern: "lunge", pillar: "strength", primary: ["quads", "glutes"], secondary: ["hips"], equipment: ["dumbbell", "bodyweight"], level: "new", unilateral: true, loadable: true, ratio: 0.25,
    cues: ["Step back, drop the knee straight down.", "Push through the front heel."], faults: ["Front knee collapsing inward."], swaps: ["walking-lunge", "bulgarian-split-squat", "step-up"] , painFlags: ["knee"]}),
  E({ slug: "walking-lunge", name: "Walking lunge", pattern: "lunge", pillar: "strength", primary: ["quads", "glutes"], secondary: ["core"], equipment: ["dumbbell", "bodyweight"], level: "new", unilateral: true, loadable: true, ratio: 0.25,
    cues: ["Long steps, quiet feet."], faults: ["Short choppy steps."], swaps: ["reverse-lunge", "bulgarian-split-squat"], painFlags: ["knee"] }),
  E({ slug: "step-up", name: "Step-up", pattern: "lunge", pillar: "strength", primary: ["quads", "glutes"], secondary: [], equipment: ["dumbbell", "bench", "bodyweight"], level: "new", unilateral: true, loadable: true, ratio: 0.25,
    cues: ["Whole foot on the box, drive without pushing off the floor."], faults: ["Bouncing off the back leg."], swaps: ["reverse-lunge", "bulgarian-split-squat"] , painFlags: ["knee"]}),

  /* ── Horizontal push ───────────────────────────────────── */
  E({ slug: "bench-press", name: "Bench press", pattern: "push_h", pillar: "strength", primary: ["chest"], secondary: ["triceps", "shoulders"], equipment: ["barbell", "bench", "rack"], level: "intermediate", loadable: true, tempo: "2-1-1-0", ratio: 0.75,
    cues: ["Shoulder blades pinned, feet planted.", "Bar touches at the sternum, elbows about 45°.", "Press back toward the rack."],
    faults: ["Elbows flared to 90°.", "Bouncing off the chest.", "Feet moving."], swaps: ["dumbbell-bench-press", "push-up", "machine-chest-press"], painFlags: ["shoulder"] }),
  E({ slug: "dumbbell-bench-press", name: "Dumbbell bench press", pattern: "push_h", pillar: "strength", primary: ["chest"], secondary: ["triceps", "shoulders"], equipment: ["dumbbell", "bench"], level: "new", loadable: true, tempo: "2-1-1-0", ratio: 0.3,
    cues: ["Kick the bells up with the knees.", "Slight arc — bells come together at the top."], faults: ["Shoulders rolling forward."], swaps: ["bench-press", "push-up", "incline-dumbbell-press"], painFlags: ["shoulder"] }),
  E({ slug: "incline-dumbbell-press", name: "Incline dumbbell press", pattern: "push_h", pillar: "strength", primary: ["chest", "shoulders"], secondary: ["triceps"], equipment: ["dumbbell", "bench"], level: "new", loadable: true, ratio: 0.26,
    cues: ["30° incline, elbows under the wrists."], faults: ["Flaring."], swaps: ["dumbbell-bench-press", "push-up"] }),
  E({ slug: "push-up", name: "Push-up", pattern: "push_h", pillar: "strength", primary: ["chest", "triceps"], secondary: ["core", "shoulders"], equipment: ["bodyweight"], level: "new", loadable: false, tempo: "2-0-1-0",
    cues: ["Body is one line from heels to head.", "Hands under shoulders, elbows 45°.", "Chest to the floor, not the chin."],
    faults: ["Hips sagging.", "Head diving first."], swaps: ["dumbbell-bench-press", "incline-push-up", "machine-chest-press"], painFlags: ["wrist"] }),
  E({ slug: "incline-push-up", name: "Incline push-up", pattern: "push_h", pillar: "strength", primary: ["chest", "triceps"], secondary: ["core"], equipment: ["bodyweight", "bench"], level: "new", loadable: false,
    cues: ["Hands on a bench; same line from heels to head."], faults: ["Sagging."], swaps: ["push-up"] }),
  E({ slug: "machine-chest-press", name: "Machine chest press", pattern: "push_h", pillar: "strength", primary: ["chest"], secondary: ["triceps"], equipment: ["machine"], level: "new", loadable: true, ratio: 0.6,
    cues: ["Handles at mid-chest height."], faults: ["Shrugging."], swaps: ["bench-press", "dumbbell-bench-press"] }),
  E({ slug: "dip", name: "Dip", pattern: "push_h", pillar: "strength", primary: ["chest", "triceps"], secondary: ["shoulders"], equipment: ["pullup_bar"], level: "intermediate", loadable: false,
    cues: ["Lean forward for chest, upright for triceps.", "Elbows to 90°, no deeper if the shoulder complains."], faults: ["Going too deep."], swaps: ["push-up", "bench-press"], painFlags: ["shoulder"] }),

  /* ── Vertical push ─────────────────────────────────────── */
  E({ slug: "overhead-press", name: "Overhead press", pattern: "push_v", pillar: "strength", primary: ["shoulders"], secondary: ["triceps", "core"], equipment: ["barbell"], level: "intermediate", loadable: true, tempo: "2-0-1-0", ratio: 0.5,
    cues: ["Squeeze the glutes, ribs down.", "Move the head back, bar goes straight up, head through at the top."],
    faults: ["Leaning back into a standing incline.", "Bar path forward of the face."], swaps: ["dumbbell-shoulder-press", "landmine-press", "push-up"], painFlags: ["shoulder"] }),
  E({ slug: "dumbbell-shoulder-press", name: "Dumbbell shoulder press", pattern: "push_v", pillar: "strength", primary: ["shoulders"], secondary: ["triceps"], equipment: ["dumbbell"], level: "new", loadable: true, ratio: 0.2,
    cues: ["Palms slightly in, elbows just in front of the body."], faults: ["Arching the lower back."], swaps: ["overhead-press", "landmine-press"], painFlags: ["shoulder"] }),
  E({ slug: "landmine-press", name: "Landmine press", pattern: "push_v", pillar: "strength", primary: ["shoulders", "chest"], secondary: ["core"], equipment: ["barbell"], level: "new", unilateral: true, loadable: true, ratio: 0.3,
    cues: ["Half-kneeling, press up and forward."], faults: ["Twisting."], swaps: ["dumbbell-shoulder-press", "overhead-press"] }),
  E({ slug: "lateral-raise", name: "Lateral raise", pattern: "push_v", pillar: "strength", primary: ["shoulders"], secondary: [], equipment: ["dumbbell", "cable"], level: "new", isolation: true, loadable: true, tempo: "2-1-2-0", ratio: 0.08,
    cues: ["Lead with the elbows, thumbs slightly down.", "Stop at shoulder height."], faults: ["Swinging.", "Shrugging."], swaps: ["cable-lateral-raise"] }),
  E({ slug: "cable-lateral-raise", name: "Cable lateral raise", pattern: "push_v", pillar: "strength", primary: ["shoulders"], secondary: [], equipment: ["cable"], level: "new", isolation: true, loadable: true, ratio: 0.06,
    cues: ["Cable behind the body."], faults: ["Shrugging."], swaps: ["lateral-raise"] }),

  /* ── Horizontal pull ───────────────────────────────────── */
  E({ slug: "barbell-row", name: "Barbell row", pattern: "pull_h", pillar: "strength", primary: ["back", "lats"], secondary: ["biceps", "core"], equipment: ["barbell"], level: "intermediate", loadable: true, tempo: "1-1-2-0", ratio: 0.6,
    cues: ["Hinge to ~45°, bar hangs under the chest.", "Pull to the lower ribs, elbows past the torso.", "Pause, then lower slow."],
    faults: ["Torso heaving up on every rep.", "Pulling to the neck."], swaps: ["dumbbell-row", "cable-row", "chest-supported-row"], painFlags: ["back"] }),
  E({ slug: "dumbbell-row", name: "Dumbbell row", pattern: "pull_h", pillar: "strength", primary: ["back", "lats"], secondary: ["biceps"], equipment: ["dumbbell", "bench"], level: "new", unilateral: true, loadable: true, tempo: "1-1-2-0", ratio: 0.3,
    cues: ["Elbow travels to the hip, not out to the side.", "Squeeze the shoulder blade at the top."], faults: ["Rotating the torso."], swaps: ["barbell-row", "cable-row", "chest-supported-row"] }),
  E({ slug: "chest-supported-row", name: "Chest-supported row", pattern: "pull_h", pillar: "strength", primary: ["back"], secondary: ["biceps"], equipment: ["dumbbell", "bench", "machine"], level: "new", loadable: true, ratio: 0.28,
    cues: ["Chest on the pad; pull the elbows back and down."], faults: ["Shrugging."], swaps: ["dumbbell-row", "cable-row"], painFlags: ["back"] }),
  E({ slug: "cable-row", name: "Seated cable row", pattern: "pull_h", pillar: "strength", primary: ["back", "lats"], secondary: ["biceps"], equipment: ["cable", "machine"], level: "new", loadable: true, ratio: 0.55,
    cues: ["Tall torso, handle to the belly."], faults: ["Rocking."], swaps: ["dumbbell-row", "barbell-row"] }),
  E({ slug: "inverted-row", name: "Inverted row", pattern: "pull_h", pillar: "strength", primary: ["back"], secondary: ["biceps", "core"], equipment: ["pullup_bar", "bodyweight"], level: "new", loadable: false,
    cues: ["Body straight, chest to the bar."], faults: ["Hips sagging."], swaps: ["dumbbell-row", "band-row"] }),
  E({ slug: "band-row", name: "Band row", pattern: "pull_h", pillar: "strength", primary: ["back"], secondary: ["biceps"], equipment: ["band"], level: "new", loadable: false,
    cues: ["Anchor at chest height, pull elbows past the ribs."], faults: ["Shrugging."], swaps: ["inverted-row", "dumbbell-row"] }),
  E({ slug: "face-pull", name: "Face pull", pattern: "pull_h", pillar: "strength", primary: ["shoulders", "back"], secondary: [], equipment: ["cable", "band"], level: "new", loadable: true, ratio: 0.12,
    cues: ["Pull to the forehead, thumbs back.", "External rotation at the end."], faults: ["Using the arms only."], swaps: ["band-pull-apart"] }),
  E({ slug: "band-pull-apart", name: "Band pull-apart", pattern: "pull_h", pillar: "mobility", primary: ["shoulders", "back"], secondary: [], equipment: ["band"], level: "new", loadable: false,
    cues: ["Straight arms, squeeze the shoulder blades."], faults: ["Shrugging."], swaps: ["face-pull"] }),

  /* ── Vertical pull ─────────────────────────────────────── */
  E({ slug: "pull-up", name: "Pull-up", pattern: "pull_v", pillar: "strength", primary: ["lats", "back"], secondary: ["biceps", "core"], equipment: ["pullup_bar"], level: "intermediate", loadable: false,
    cues: ["Start from a dead hang, shoulders pulled down first.", "Chin over the bar, chest to the bar if you can.", "Lower under control."],
    faults: ["Kipping.", "Half reps at the top."], swaps: ["lat-pulldown", "band-assisted-pull-up", "inverted-row"], painFlags: ["shoulder", "elbow"] }),
  E({ slug: "band-assisted-pull-up", name: "Band-assisted pull-up", pattern: "pull_v", pillar: "strength", primary: ["lats"], secondary: ["biceps"], equipment: ["pullup_bar", "band"], level: "new", loadable: false,
    cues: ["Band under the feet; same technique as a strict pull-up."], faults: ["Bouncing off the band."], swaps: ["lat-pulldown", "pull-up"] }),
  E({ slug: "lat-pulldown", name: "Lat pulldown", pattern: "pull_v", pillar: "strength", primary: ["lats"], secondary: ["biceps"], equipment: ["cable", "machine"], level: "new", loadable: true, ratio: 0.55,
    cues: ["Lean back slightly, pull to the upper chest."], faults: ["Pulling behind the neck."], swaps: ["pull-up", "band-assisted-pull-up"] }),
  E({ slug: "chin-up", name: "Chin-up", pattern: "pull_v", pillar: "strength", primary: ["lats", "biceps"], secondary: ["back"], equipment: ["pullup_bar"], level: "intermediate", loadable: false,
    cues: ["Palms toward you; drive the elbows to the ribs."], faults: ["Kipping."], swaps: ["pull-up", "lat-pulldown"] }),

  /* ── Arms ──────────────────────────────────────────────── */
  E({ slug: "dumbbell-curl", name: "Dumbbell curl", pattern: "pull_h", pillar: "strength", primary: ["biceps"], secondary: ["forearms"], equipment: ["dumbbell"], level: "new", isolation: true, loadable: true, tempo: "2-0-2-0", ratio: 0.12,
    cues: ["Elbows pinned, rotate the palm up on the way."], faults: ["Swinging."], swaps: ["cable-curl"] }),
  E({ slug: "cable-curl", name: "Cable curl", pattern: "pull_h", pillar: "strength", primary: ["biceps"], secondary: [], equipment: ["cable"], level: "new", isolation: true, loadable: true, ratio: 0.2,
    cues: ["Constant tension; don't rest at the bottom."], faults: ["Leaning back."], swaps: ["dumbbell-curl"] }),
  E({ slug: "triceps-pushdown", name: "Triceps pushdown", pattern: "push_h", pillar: "strength", primary: ["triceps"], secondary: [], equipment: ["cable"], level: "new", isolation: true, loadable: true, ratio: 0.25,
    cues: ["Elbows stay by the ribs; full extension."], faults: ["Elbows drifting forward."], swaps: ["skull-crusher", "dip"] }),
  E({ slug: "skull-crusher", name: "Skull crusher", pattern: "push_h", pillar: "strength", primary: ["triceps"], secondary: [], equipment: ["dumbbell", "barbell", "bench"], level: "new", isolation: true, loadable: true, ratio: 0.2,
    cues: ["Lower behind the head, elbows pointing to the ceiling."], faults: ["Flaring."], swaps: ["triceps-pushdown"], painFlags: ["elbow"] }),

  /* ── Machines and isolation ────────────────────────────── */
  E({ slug: "smith-squat", name: "Smith machine squat", pattern: "squat", pillar: "strength", primary: ["quads", "glutes"], secondary: ["hamstrings"], equipment: ["machine"], level: "new", loadable: true, ratio: 0.85,
    cues: ["Feet slightly in front of the bar so the shins stay near vertical.", "Sit down between the heels; drive the floor away."], faults: ["Feet directly under the bar, knees shooting forward.", "Bouncing off the bottom."], swaps: ["back-squat", "leg-press", "goblet-squat"], painFlags: ["knee", "back"] }),
  E({ slug: "leg-extension", name: "Leg extension", pattern: "squat", pillar: "strength", primary: ["quads"], secondary: [], equipment: ["machine"], level: "new", loadable: true, ratio: 0.4, tempo: "2-1-2-0", isolation: true,
    cues: ["Knee lined up with the machine's pivot.", "Squeeze at the top for a second."], faults: ["Kicking the weight up.", "Hips lifting off the seat."], swaps: ["goblet-squat", "leg-press"], painFlags: ["knee"] }),
  E({ slug: "calf-raise-machine", name: "Calf raise machine", pattern: "squat", pillar: "strength", primary: ["calves"], secondary: [], equipment: ["machine"], level: "new", loadable: true, ratio: 0.8, tempo: "2-1-2-1", isolation: true,
    cues: ["Full stretch at the bottom, pause.", "Rise onto the big toe, not the outside of the foot."], faults: ["Bouncing through half reps."], swaps: [], painFlags: ["ankle"] }),
  E({ slug: "lying-leg-curl", name: "Lying leg curl", pattern: "hinge", pillar: "strength", primary: ["hamstrings"], secondary: ["calves"], equipment: ["machine"], level: "new", loadable: true, ratio: 0.25, tempo: "2-0-2-1", isolation: true,
    cues: ["Hips pressed into the pad the whole set.", "Lower slowly — the way down builds the hamstring."], faults: ["Hips lifting to finish the rep."], swaps: ["seated-leg-curl", "romanian-deadlift"], painFlags: ["knee"] }),
  E({ slug: "seated-leg-curl", name: "Seated leg curl", pattern: "hinge", pillar: "strength", primary: ["hamstrings"], secondary: [], equipment: ["machine"], level: "new", loadable: true, ratio: 0.3, tempo: "2-0-2-1", isolation: true,
    cues: ["Thigh pad snug; lean slightly forward for a longer stretch.", "Curl all the way under the seat."], faults: ["Short range.", "Letting the stack slam."], swaps: ["lying-leg-curl", "romanian-deadlift"], painFlags: ["knee"] }),
  E({ slug: "back-extension-machine", name: "Back extension machine", pattern: "hinge", pillar: "strength", primary: ["spine", "glutes"], secondary: ["hamstrings"], equipment: ["machine"], level: "new", loadable: true, ratio: 0.4, isolation: true,
    cues: ["Move from the hips with a neutral spine.", "Stop when the body is in line — no arching past it."], faults: ["Hyperextending at the top.", "Yanking the weight."], swaps: ["good-morning", "glute-bridge"], painFlags: ["back"] }),
  E({ slug: "glute-kickback-machine", name: "Glute kickback machine", pattern: "hinge", pillar: "strength", primary: ["glutes"], secondary: ["hamstrings"], equipment: ["machine"], level: "new", loadable: true, ratio: 0.25, unilateral: true, isolation: true,
    cues: ["Drive back through the heel.", "Stop before the lower back arches."], faults: ["Swinging the leg.", "Arching instead of extending the hip."], swaps: ["hip-thrust", "glute-bridge"] }),
  E({ slug: "hip-abductor", name: "Hip abductor", pattern: "hinge", pillar: "strength", primary: ["glutes", "hips"], secondary: [], equipment: ["machine"], level: "new", loadable: true, ratio: 0.45, tempo: "2-1-2-0", isolation: true,
    cues: ["Sit tall, push the pads out with the outside of the knees.", "Control the way back in."], faults: ["Letting the pads crash together."], swaps: ["glute-bridge"], painFlags: ["hip"] }),
  E({ slug: "hip-adductor", name: "Hip adductor", pattern: "hinge", pillar: "strength", primary: ["hips"], secondary: [], equipment: ["machine"], level: "new", loadable: true, ratio: 0.45, tempo: "2-1-2-0", isolation: true,
    cues: ["Start in a range you can control; widen it over weeks.", "Squeeze the pads together, pause."], faults: ["Starting too wide, too heavy."], swaps: ["goblet-squat"], painFlags: ["hip"] }),
  E({ slug: "smith-bench-press", name: "Smith machine bench press", pattern: "push_h", pillar: "strength", primary: ["chest"], secondary: ["triceps", "shoulders"], equipment: ["machine", "bench"], level: "new", loadable: true, ratio: 0.7,
    cues: ["Bench set so the bar lands on the lower chest.", "Shoulder blades pinned back."], faults: ["Bar path over the neck.", "Elbows flared to 90°."], swaps: ["bench-press", "machine-chest-press"], painFlags: ["shoulder"] }),
  E({ slug: "incline-chest-press", name: "Incline chest press machine", pattern: "push_h", pillar: "strength", primary: ["chest", "shoulders"], secondary: ["triceps"], equipment: ["machine"], level: "new", loadable: true, ratio: 0.5,
    cues: ["Handles at upper-chest height.", "Press up and slightly in."], faults: ["Shoulders rolling forward off the pad."], swaps: ["incline-dumbbell-press", "machine-chest-press"], painFlags: ["shoulder"] }),
  E({ slug: "pec-deck", name: "Pec deck", pattern: "push_h", pillar: "strength", primary: ["chest"], secondary: ["shoulders"], equipment: ["machine"], level: "new", loadable: true, ratio: 0.3, tempo: "2-1-2-0", isolation: true,
    cues: ["Soft bend in the elbows, fixed for the whole rep.", "Hug a tree; squeeze at the middle."], faults: ["Pressing instead of hugging.", "Stretching past what the shoulder allows."], swaps: ["cable-crossover", "dumbbell-fly"], painFlags: ["shoulder"] }),
  E({ slug: "cable-crossover", name: "Cable crossover", pattern: "push_h", pillar: "strength", primary: ["chest"], secondary: ["shoulders"], equipment: ["cable"], level: "new", loadable: true, ratio: 0.15, tempo: "2-1-2-0", isolation: true,
    cues: ["Staggered stance, slight forward lean.", "Hands meet in front of the lower chest."], faults: ["Bending the elbows to move more weight."], swaps: ["pec-deck", "dumbbell-fly"], painFlags: ["shoulder"] }),
  E({ slug: "dumbbell-fly", name: "Dumbbell fly", pattern: "push_h", pillar: "strength", primary: ["chest"], secondary: ["shoulders"], equipment: ["dumbbell", "bench"], level: "new", loadable: true, ratio: 0.12, tempo: "3-0-2-0", isolation: true,
    cues: ["Lower in a wide arc until you feel the chest stretch.", "Bring the weights up as if around a barrel."], faults: ["Going deeper than the shoulder is happy with.", "Turning it into a press."], swaps: ["pec-deck", "cable-crossover"], painFlags: ["shoulder"] }),
  E({ slug: "assisted-dip", name: "Assisted dip", pattern: "push_h", pillar: "strength", primary: ["chest", "triceps"], secondary: ["shoulders"], equipment: ["machine"], level: "new", loadable: false,
    cues: ["More assistance is not cheating: pick what gives clean reps.", "Elbows to 90°, chest slightly forward."], faults: ["Dropping too deep.", "Shrugging at the bottom."], swaps: ["dip", "push-up", "bench-dip"], painFlags: ["shoulder"] }),
  E({ slug: "bench-dip", name: "Bench dip", pattern: "push_h", pillar: "strength", primary: ["triceps"], secondary: ["chest", "shoulders"], equipment: ["bench"], level: "new", loadable: false, isolation: true,
    cues: ["Hips close to the bench.", "Bend to about 90° and press back up."], faults: ["Sinking far below the bench — it loads the front of the shoulder."], swaps: ["triceps-pushdown", "push-up"], painFlags: ["shoulder", "wrist"] }),
  E({ slug: "shoulder-press-machine", name: "Shoulder press machine", pattern: "push_v", pillar: "strength", primary: ["shoulders"], secondary: ["triceps"], equipment: ["machine"], level: "new", loadable: true, ratio: 0.4,
    cues: ["Seat so the handles start at shoulder height.", "Back against the pad; press without arching."], faults: ["Arching off the pad.", "Half reps."], swaps: ["dumbbell-shoulder-press", "overhead-press"], painFlags: ["shoulder"] }),
  E({ slug: "dumbbell-front-raise", name: "Dumbbell front raise", pattern: "push_v", pillar: "strength", primary: ["shoulders"], secondary: [], equipment: ["dumbbell"], level: "new", loadable: true, ratio: 0.07, tempo: "2-1-2-0", isolation: true,
    cues: ["Raise to eye height, thumbs slightly up.", "Ribs down, no lean back."], faults: ["Swinging the torso."], swaps: ["lateral-raise"], painFlags: ["shoulder"] }),
  E({ slug: "dumbbell-tricep-extension", name: "Dumbbell triceps extension", pattern: "push_v", pillar: "strength", primary: ["triceps"], secondary: [], equipment: ["dumbbell"], level: "new", loadable: true, ratio: 0.15, tempo: "3-0-1-0", isolation: true,
    cues: ["Elbows point up and stay close to the head.", "Lower behind the head for a full stretch."], faults: ["Elbows flaring wide.", "Arching the lower back."], swaps: ["triceps-pushdown", "skull-crusher"], painFlags: ["elbow", "shoulder"] }),
  E({ slug: "low-row", name: "Low row machine", pattern: "pull_h", pillar: "strength", primary: ["back", "lats"], secondary: ["biceps"], equipment: ["machine"], level: "new", loadable: true, ratio: 0.6,
    cues: ["Chest on the pad, pull the elbows past the ribs.", "Pause, then let the shoulder blades stretch forward."], faults: ["Leaning back to finish.", "Shrugging."], swaps: ["cable-row", "chest-supported-row"] }),
  E({ slug: "assisted-pull-up", name: "Assisted pull-up", pattern: "pull_v", pillar: "strength", primary: ["lats"], secondary: ["biceps", "back"], equipment: ["machine"], level: "new", loadable: false,
    cues: ["Start from a dead hang, shoulders down first.", "Chin over the bar, lower in two seconds.", "Take away assistance a little each week."], faults: ["Kipping off the pad.", "Half reps at the top."], swaps: ["band-assisted-pull-up", "lat-pulldown", "pull-up"] }),
  E({ slug: "hammer-curl", name: "Hammer curl", pattern: "pull_h", pillar: "strength", primary: ["biceps", "forearms"], secondary: [], equipment: ["dumbbell"], level: "new", loadable: true, ratio: 0.13, tempo: "2-0-2-0", isolation: true,
    cues: ["Palms face each other the whole rep.", "Elbows pinned to the sides."], faults: ["Swinging.", "Elbows drifting forward."], swaps: ["dumbbell-curl", "cable-curl"] }),

  /* ── Core / carry ─────────────────────────────────────── */
  E({ slug: "plank", name: "Plank", pattern: "core", pillar: "strength", primary: ["core"], secondary: ["shoulders"], equipment: ["bodyweight"], level: "new", loadable: false, timed: true,
    cues: ["Squeeze glutes, tuck the ribs, push the floor away.", "Quality over duration: 30 hard seconds beat 3 lazy minutes."], faults: ["Hips sagging or piking."], swaps: ["dead-bug", "side-plank"] }),
  E({ slug: "side-plank", name: "Side plank", pattern: "core", pillar: "strength", primary: ["core", "hips"], secondary: [], equipment: ["bodyweight"], level: "new", unilateral: true, loadable: false, timed: true,
    cues: ["Elbow under the shoulder, hips stacked and lifted."], faults: ["Hips dropping."], swaps: ["plank", "pallof-press"] }),
  E({ slug: "dead-bug", name: "Dead bug", pattern: "core", pillar: "strength", primary: ["core"], secondary: [], equipment: ["bodyweight"], level: "new", loadable: false,
    cues: ["Lower back pressed into the floor the whole time.", "Opposite arm and leg, slow."], faults: ["Back arching."], swaps: ["plank", "pallof-press"] }),
  E({ slug: "pallof-press", name: "Pallof press", pattern: "core", pillar: "strength", primary: ["core"], secondary: [], equipment: ["cable", "band"], level: "new", unilateral: true, loadable: true, ratio: 0.1,
    cues: ["Press out, resist the rotation, hold two seconds."], faults: ["Twisting toward the anchor."], swaps: ["side-plank", "dead-bug"] }),
  E({ slug: "hanging-knee-raise", name: "Hanging knee raise", pattern: "core", pillar: "strength", primary: ["core"], secondary: ["forearms"], equipment: ["pullup_bar"], level: "intermediate", loadable: false,
    cues: ["Tuck the pelvis first, then lift the knees."], faults: ["Swinging."], swaps: ["dead-bug"] }),
  E({ slug: "crunch", name: "Crunch", pattern: "core", pillar: "strength", primary: ["core"], secondary: [], equipment: ["bodyweight"], level: "new", loadable: false,
    cues: ["Curl the ribs toward the pelvis; the lower back stays down.", "Hands light on the head — never pull the neck."], faults: ["Yanking the head forward.", "Sitting all the way up."], swaps: ["dead-bug", "ab-crunch-machine"] }),
  E({ slug: "bicycle-crunch", name: "Bicycle crunch", pattern: "core", pillar: "strength", primary: ["core"], secondary: ["hips"], equipment: ["bodyweight"], level: "new", loadable: false,
    cues: ["Shoulder toward the opposite knee, slow.", "Extend the other leg long and low."], faults: ["Racing through it.", "Only moving the elbows."], swaps: ["dead-bug", "crunch"] }),
  E({ slug: "russian-twist", name: "Russian twist", pattern: "core", pillar: "strength", primary: ["core"], secondary: [], equipment: ["bodyweight"], level: "new", loadable: false,
    cues: ["Lean back with a long spine; rotate from the ribs.", "Feet down until the rotation is controlled."], faults: ["Rounding the lower back.", "Just swinging the arms."], swaps: ["pallof-press", "side-plank"], painFlags: ["back"] }),
  E({ slug: "ab-crunch-machine", name: "Ab crunch machine", pattern: "core", pillar: "strength", primary: ["core"], secondary: [], equipment: ["machine"], level: "new", loadable: true, ratio: 0.3, tempo: "2-1-2-0",
    cues: ["Crunch the ribs down; the hips do not move.", "Exhale hard at the bottom."], faults: ["Pulling with the arms.", "Heavy and short."], swaps: ["crunch", "hanging-knee-raise"] }),
  E({ slug: "rotary-torso", name: "Rotary torso machine", pattern: "core", pillar: "strength", primary: ["core"], secondary: [], equipment: ["machine"], level: "new", loadable: true, ratio: 0.3, tempo: "2-1-2-0",
    cues: ["Chest stays against the pad; rotate slowly both ways.", "Light enough to stop at any point."], faults: ["Throwing the weight around."], swaps: ["pallof-press", "russian-twist"], painFlags: ["back"] }),
  E({ slug: "farmers-carry", name: "Farmer's carry", pattern: "carry", pillar: "strength", primary: ["forearms", "core", "traps"], secondary: ["full_body"], equipment: ["dumbbell", "kettlebell"], level: "new", loadable: true, timed: true, ratio: 0.35,
    cues: ["Tall, shoulders down, walk like nothing's in your hands."], faults: ["Leaning to one side."], swaps: ["suitcase-carry"] }),
  E({ slug: "suitcase-carry", name: "Suitcase carry", pattern: "carry", pillar: "strength", primary: ["core", "forearms"], secondary: [], equipment: ["dumbbell", "kettlebell"], level: "new", unilateral: true, loadable: true, timed: true, ratio: 0.25,
    cues: ["One side loaded; don't lean away."], faults: ["Side-bending."], swaps: ["farmers-carry"] }),

  /* ── Power / conditioning ─────────────────────────────── */
  E({ slug: "box-jump", name: "Box jump", pattern: "power", pillar: "strength", primary: ["quads", "glutes"], secondary: ["calves"], equipment: ["bodyweight"], level: "intermediate", loadable: false,
    cues: ["Land soft, full foot on the box, stand tall.", "Step down, don't jump down."], faults: ["Landing in a deep squat."], swaps: ["kettlebell-swing", "broad-jump"], painFlags: ["knee", "ankle"] }),
  E({ slug: "broad-jump", name: "Broad jump", pattern: "power", pillar: "strength", primary: ["glutes", "quads"], secondary: [], equipment: ["bodyweight"], level: "new", loadable: false,
    cues: ["Arm swing, land quiet."], faults: ["Stiff landing."], swaps: ["box-jump"] , painFlags: ["knee", "ankle"]}),
  E({ slug: "burpee", name: "Burpee", pattern: "cardio", pillar: "endurance", primary: ["full_body"], secondary: [], equipment: ["bodyweight"], level: "new", loadable: false,
    cues: ["Steady rhythm beats sprinting the first ten."], faults: ["Sagging in the push-up."], swaps: ["mountain-climber"] , painFlags: ["knee", "wrist"]}),
  E({ slug: "mountain-climber", name: "Mountain climber", pattern: "cardio", pillar: "endurance", primary: ["core", "cardio"], secondary: [], equipment: ["bodyweight"], level: "new", loadable: false, timed: true,
    cues: ["Hips level, knees drive under the chest."], faults: ["Hips piking."], swaps: ["burpee"] }),

  /* ── Cardio modalities ─────────────────────────────────── */
  E({ slug: "run", name: "Run", pattern: "cardio", pillar: "endurance", primary: ["cardio"], secondary: ["calves", "quads"], equipment: ["outdoor", "treadmill"], level: "new", loadable: false, timed: true,
    cues: ["Zone 2 = you can speak full sentences.", "Cadence around 170–180 steps per minute."], faults: ["Every run at the same medium-hard pace."], swaps: ["bike", "row", "brisk-walk"], painFlags: ["knee", "ankle"] }),
  E({ slug: "bike", name: "Bike", pattern: "cardio", pillar: "endurance", primary: ["cardio", "quads"], secondary: [], equipment: ["bike", "outdoor"], level: "new", loadable: false, timed: true,
    cues: ["Cadence 85–95 rpm for endurance work."], faults: ["Grinding a huge gear."], swaps: ["run", "row"] }),
  E({ slug: "row", name: "Row", pattern: "cardio", pillar: "endurance", primary: ["cardio", "back"], secondary: ["quads", "core"], equipment: ["rower"], level: "new", loadable: false, timed: true,
    cues: ["Legs, then back, then arms. Reverse on the way in.", "Damper 4–6, not 10."], faults: ["Arms pulling early."], swaps: ["bike", "run"] }),
  E({ slug: "brisk-walk", name: "Brisk walk / ruck", pattern: "cardio", pillar: "endurance", primary: ["cardio"], secondary: [], equipment: ["outdoor", "treadmill"], level: "new", loadable: false, timed: true,
    cues: ["Fast enough that talking takes effort."], faults: ["Strolling."], swaps: ["run", "bike"] }),
  E({ slug: "stair-sprints", name: "Stair sprints", pattern: "cardio", pillar: "endurance", primary: ["cardio", "quads"], secondary: ["calves"], equipment: ["outdoor"], level: "intermediate", loadable: false, timed: true,
    cues: ["Drive the knees, walk down for recovery."], faults: ["Sprinting the recovery."], swaps: ["run", "bike"], painFlags: ["knee"] }),

  /* ── Mobility ──────────────────────────────────────────── */
  E({ slug: "90-90-hip-switch", name: "90/90 hip switch", pattern: "mobility", pillar: "mobility", primary: ["hips"], secondary: [], equipment: ["bodyweight"], level: "new", loadable: false, timed: true,
    cues: ["Both knees at 90°, rotate to the other side without using the hands.", "Slow; breathe out into the hard bit."], faults: ["Leaning back to cheat the rotation."], swaps: ["pigeon-stretch", "deep-squat-hold"] }),
  E({ slug: "pigeon-stretch", name: "Pigeon", pattern: "mobility", pillar: "mobility", primary: ["hips", "glutes"], secondary: [], equipment: ["bodyweight"], level: "new", unilateral: true, loadable: false, timed: true,
    cues: ["Front shin as parallel to the mat as the hip allows.", "Square the hips, then fold."], faults: ["Front knee pain: bring the foot closer."], swaps: ["90-90-hip-switch"], painFlags: ["knee"] }),
  E({ slug: "couch-stretch", name: "Couch stretch", pattern: "mobility", pillar: "mobility", primary: ["hips", "quads"], secondary: [], equipment: ["bodyweight"], level: "new", unilateral: true, loadable: false, timed: true,
    cues: ["Back knee in the corner, squeeze that glute, stay tall."], faults: ["Arching the lower back."], swaps: ["pigeon-stretch"], painFlags: ["knee"] }),
  E({ slug: "deep-squat-hold", name: "Deep squat hold", pattern: "mobility", pillar: "mobility", primary: ["hips", "ankles"], secondary: ["spine"], equipment: ["bodyweight"], level: "new", loadable: false, timed: true,
    cues: ["Hold something if needed; elbows push the knees out.", "Heels down. If they lift, raise them on a plate."], faults: ["Rounding hard."], swaps: ["90-90-hip-switch", "ankle-rock"] , painFlags: ["knee"]}),
  E({ slug: "ankle-rock", name: "Ankle rock", pattern: "mobility", pillar: "mobility", primary: ["ankles"], secondary: ["calves"], equipment: ["bodyweight"], level: "new", unilateral: true, loadable: false, timed: true,
    cues: ["Knee over the pinky toe, heel stays down."], faults: ["Heel lifting."], swaps: ["deep-squat-hold"] }),
  E({ slug: "thoracic-rotation", name: "Thoracic rotation", pattern: "mobility", pillar: "mobility", primary: ["spine", "shoulders"], secondary: [], equipment: ["bodyweight"], level: "new", unilateral: true, loadable: false,
    cues: ["On all fours, hand behind the head, rotate the elbow to the ceiling.", "Hips stay still."], faults: ["Rotating from the lower back."], swaps: ["cat-cow"] }),
  E({ slug: "cat-cow", name: "Cat–cow", pattern: "mobility", pillar: "mobility", primary: ["spine"], secondary: [], equipment: ["bodyweight"], level: "new", loadable: false,
    cues: ["Segment by segment; breathe with it."], faults: ["Rushing."], swaps: ["thoracic-rotation"] }),
  E({ slug: "shoulder-cars", name: "Shoulder CARs", pattern: "mobility", pillar: "mobility", primary: ["shoulders"], secondary: [], equipment: ["bodyweight"], level: "new", unilateral: true, loadable: false,
    cues: ["Slow controlled circle, the rest of the body locked."], faults: ["Shrugging through the top."], swaps: ["band-pull-apart"] }),
  E({ slug: "hamstring-floss", name: "Hamstring floss", pattern: "mobility", pillar: "mobility", primary: ["hamstrings"], secondary: [], equipment: ["bodyweight"], level: "new", unilateral: true, loadable: false,
    cues: ["Straighten the knee, flex the foot, breathe."], faults: ["Rounding."], swaps: ["pigeon-stretch"] }),
  E({ slug: "world-greatest-stretch", name: "World's greatest stretch", pattern: "mobility", pillar: "mobility", primary: ["hips", "spine", "shoulders"], secondary: [], equipment: ["bodyweight"], level: "new", unilateral: true, loadable: false,
    cues: ["Lunge, elbow to instep, rotate to the ceiling."], faults: ["Back knee collapsing."], swaps: ["90-90-hip-switch"] }),
];

export const EXERCISE_MAP: Record<string, Exercise> = Object.fromEntries(EXERCISES.map((e) => [e.slug, e]));
export const getExercise = (slug: string) => EXERCISE_MAP[slug];

export function searchExercises(q: string, filters: { pattern?: string; equipment?: string; pillar?: string } = {}) {
  const needle = q.trim().toLowerCase();
  return EXERCISES.filter((e) => {
    if (filters.pattern && e.pattern !== filters.pattern) return false;
    if (filters.pillar && e.pillar !== filters.pillar) return false;
    if (filters.equipment && !e.equipment.includes(filters.equipment as never)) return false;
    if (!needle) return true;
    return e.name.toLowerCase().includes(needle) || !!EXERCISE_FR[e.slug]?.name.toLowerCase().includes(needle) || e.primary.some((m) => m.includes(needle)) || e.pattern.includes(needle);
  });
}

/* ── French ────────────────────────────────────────────────────
   The bank is authored in English (the engine and the tests read it).
   French names, cues and faults live here, keyed by slug, in the same
   order as the English arrays; `exText` picks the one to show. */
type ExText = { name: string; cues: string[]; faults: string[] };
const F = (name: string, cues: string[], faults: string[]): ExText => ({ name, cues, faults });

export const EXERCISE_FR: Record<string, ExText> = {
  "back-squat": F("Squat arrière", ["Gaine-toi avant de décrocher la barre : grosse inspiration jusqu’à la ceinture.", "Les genoux suivent l’orteil du milieu.", "Hanches et poitrine montent ensemble — pas de good morning."], ["Genoux qui rentrent en montant.", "Talons qui décollent : mobilité de cheville ou appui trop étroit.", "Poitrine qui tombe en bas."]),
  "front-squat": F("Squat avant", ["Coudes hauts, barre posée sur les épaules.", "Descends droit entre les talons.", "Reste grand en sortant du bas."], ["Coudes qui tombent — la barre roule vers l’avant.", "Douleur aux poignets en tenant la barre : prends des sangles ou une prise croisée."]),
  "goblet-squat": F("Squat gobelet", ["Tiens le poids contre la poitrine, coudes rentrés.", "Pousse les genoux vers l’extérieur et assieds-toi entre eux.", "Pause en bas, puis pousse le sol."], ["Pencher vers l’avant pour faire contrepoids.", "Descendre trop vite."]),
  "bodyweight-squat": F("Squat au poids du corps", ["Bras devant pour l’équilibre.", "Pleine amplitude si les genoux le permettent.", "Contrôle la descente — trois secondes."], ["Talons qui décollent.", "Demi-répétitions."]),
  "leg-press": F("Presse à cuisses", ["Pieds au milieu de la plateforme, largeur d’épaules.", "Descends jusqu’à ce que les hanches commencent à s’enrouler.", "Ne verrouille pas les genoux en haut."], ["Bas du dos qui décolle du dossier.", "Verrouiller fort en haut."]),
  "hack-squat": F("Hack squat", ["Dos à plat sur le dossier.", "Pousse avec le milieu du pied."], ["Talons qui lèvent."]),
  "safety-bar-squat": F("Squat à la barre de sécurité", ["Poignées vers l’avant, coudes vers le bas.", "Résiste à la barre qui te tire vers l’avant."], ["Effondrement vers l’avant."]),
  "wall-sit": F("Chaise au mur", ["Cuisses parallèles, dos à plat sur le mur.", "Respire."], ["Mains sur les cuisses."]),
  "deadlift": F("Soulevé de terre", ["Barre au-dessus du milieu du pied, tibias à la barre.", "Enlève le jeu de la barre avant qu’elle quitte le sol.", "Pousse le sol ; hanches et épaules montent ensemble."], ["Hanches qui montent en premier.", "Barre qui s’éloigne des jambes.", "Haut du dos qui s’arrondit sous la charge."]),
  "trap-bar-deadlift": F("Soulevé de terre à la trap bar", ["Place-toi au centre, poignées à mi-cuisse.", "Poitrine ouverte, pousse dans le sol."], ["Le remonter en squat avec le dos rond."]),
  "romanian-deadlift": F("Soulevé de terre roumain", ["Genoux souples, hanches vers l’arrière jusqu’à sentir les ischios.", "La barre reste collée aux cuisses.", "Colonne neutre tout du long."], ["Plier les genoux comme un squat.", "Descendre plus bas que les ischios le permettent — le dos s’arrondit."]),
  "single-leg-rdl": F("Soulevé roumain sur une jambe", ["Hanches de face, la jambe arrière s’allonge droit derrière.", "Ralentis ; l’équilibre, c’est le but."], ["Hanche qui s’ouvre sur le côté."]),
  "hip-thrust": F("Hip thrust", ["Menton rentré, côtes basses.", "Serre fort en haut pendant une seconde."], ["Cambrer le bas du dos en haut."]),
  "glute-bridge": F("Pont fessier", ["Talons proches, serre en haut."], ["Pousser avec les orteils."]),
  "kettlebell-swing": F("Swing au kettlebell", ["Charnière, pas squat. Le kettlebell flotte à hauteur de poitrine.", "Claque les hanches ; les bras sont des cordes."], ["Lever avec les bras.", "Dos rond en bas."]),
  "good-morning": F("Good morning", ["Barre haute sur les trapèzes, hanches vers l’arrière."], ["Arrondir le dos."]),
  "bulgarian-split-squat": F("Squat bulgare", ["Pied avant assez loin pour que le genou reste derrière les orteils.", "Buste un peu penché pour les fessiers, droit pour les quads."], ["Pousser avec le pied arrière.", "Ça vacille : ralentis."]),
  "reverse-lunge": F("Fente arrière", ["Recule, descends le genou droit vers le sol.", "Pousse avec le talon avant."], ["Genou avant qui rentre vers l’intérieur."]),
  "walking-lunge": F("Fentes marchées", ["Grands pas, pieds silencieux."], ["Petits pas saccadés."]),
  "step-up": F("Montée sur banc", ["Tout le pied sur la boîte, monte sans pousser du sol."], ["Rebondir sur la jambe arrière."]),
  "bench-press": F("Développé couché", ["Omoplates serrées, pieds ancrés.", "La barre touche au sternum, coudes à environ 45°.", "Pousse en revenant vers les supports."], ["Coudes ouverts à 90°.", "Rebondir sur la poitrine.", "Pieds qui bougent."]),
  "dumbbell-bench-press": F("Développé couché aux haltères", ["Monte les haltères avec un coup de genoux.", "Léger arc — les haltères se rejoignent en haut."], ["Épaules qui roulent vers l’avant."]),
  "incline-dumbbell-press": F("Développé incliné aux haltères", ["Banc à 30°, coudes sous les poignets."], ["Coudes trop ouverts."]),
  "push-up": F("Pompe", ["Le corps fait une ligne des talons à la tête.", "Mains sous les épaules, coudes à 45°.", "La poitrine au sol, pas le menton."], ["Hanches qui s’affaissent.", "La tête qui plonge en premier."]),
  "incline-push-up": F("Pompe inclinée", ["Mains sur un banc ; même ligne des talons à la tête."], ["Hanches qui s’affaissent."]),
  "machine-chest-press": F("Presse pectorale à la machine", ["Poignées à mi-poitrine."], ["Hausser les épaules."]),
  "dip": F("Dips", ["Penche-toi pour la poitrine, reste droit pour les triceps.", "Coudes à 90°, pas plus bas si l’épaule proteste."], ["Descendre trop bas."]),
  "overhead-press": F("Développé militaire", ["Serre les fessiers, côtes basses.", "Recule la tête, la barre monte droit, la tête passe dessous en haut."], ["Se pencher en arrière comme un développé incliné debout.", "Trajectoire de barre devant le visage."]),
  "dumbbell-shoulder-press": F("Développé épaules aux haltères", ["Paumes légèrement vers l’intérieur, coudes juste devant le corps."], ["Cambrer le bas du dos."]),
  "landmine-press": F("Développé landmine", ["À genou sur une jambe, pousse vers le haut et l’avant."], ["Se tordre."]),
  "lateral-raise": F("Élévation latérale", ["Mène avec les coudes, pouces un peu vers le bas.", "Arrête à hauteur d’épaules."], ["Se balancer.", "Hausser les épaules."]),
  "cable-lateral-raise": F("Élévation latérale à la poulie", ["Câble derrière le corps."], ["Hausser les épaules."]),
  "barbell-row": F("Rowing à la barre", ["Penche-toi à ~45°, la barre pend sous la poitrine.", "Tire vers le bas des côtes, coudes au-delà du buste.", "Pause, puis descends lentement."], ["Buste qui se relève à chaque rep.", "Tirer vers le cou."]),
  "dumbbell-row": F("Rowing à l’haltère", ["Le coude va vers la hanche, pas sur le côté.", "Serre l’omoplate en haut."], ["Tourner le buste."]),
  "chest-supported-row": F("Rowing poitrine appuyée", ["Poitrine sur le dossier ; tire les coudes vers l’arrière et le bas."], ["Hausser les épaules."]),
  "cable-row": F("Tirage horizontal à la poulie", ["Buste droit, poignée vers le ventre."], ["Se balancer."]),
  "inverted-row": F("Rowing inversé", ["Corps droit, poitrine à la barre."], ["Hanches qui s’affaissent."]),
  "band-row": F("Rowing à l’élastique", ["Ancre à hauteur de poitrine, tire les coudes au-delà des côtes."], ["Hausser les épaules."]),
  "face-pull": F("Face pull", ["Tire vers le front, pouces vers l’arrière.", "Rotation externe à la fin."], ["Tirer seulement avec les bras."]),
  "band-pull-apart": F("Écartement à l’élastique", ["Bras tendus, serre les omoplates."], ["Hausser les épaules."]),
  "pull-up": F("Traction", ["Pars suspendu bras tendus, épaules abaissées d’abord.", "Menton au-dessus de la barre, poitrine à la barre si tu peux.", "Descends en contrôle."], ["Kipping.", "Demi-reps en haut."]),
  "band-assisted-pull-up": F("Traction assistée à l’élastique", ["Élastique sous les pieds ; même technique qu’une traction stricte."], ["Rebondir sur l’élastique."]),
  "lat-pulldown": F("Tirage vertical", ["Penche-toi un peu en arrière, tire vers le haut de la poitrine."], ["Tirer derrière la nuque."]),
  "chin-up": F("Traction en supination", ["Paumes vers toi ; ramène les coudes vers les côtes."], ["Kipping."]),
  "dumbbell-curl": F("Curl aux haltères", ["Coudes fixes, tourne la paume vers le haut en montant."], ["Se balancer."]),
  "cable-curl": F("Curl à la poulie", ["Tension constante ; ne te repose pas en bas."], ["Se pencher en arrière."]),
  "triceps-pushdown": F("Extension triceps à la poulie", ["Coudes collés aux côtes ; extension complète."], ["Coudes qui avancent."]),
  "skull-crusher": F("Barre au front", ["Descends derrière la tête, coudes pointés au plafond."], ["Coudes trop ouverts."]),
  "smith-squat": F("Squat à la Smith", ["Pieds un peu devant la barre pour garder les tibias presque verticaux.", "Assieds-toi entre les talons ; pousse le sol."], ["Pieds directement sous la barre, genoux qui partent vers l’avant.", "Rebondir en bas."]),
  "leg-extension": F("Extension des jambes", ["Genou aligné avec le pivot de la machine.", "Serre en haut une seconde."], ["Lancer la charge d’un coup de pied.", "Hanches qui décollent du siège."]),
  "calf-raise-machine": F("Mollets à la machine", ["Étirement complet en bas, pause.", "Monte sur le gros orteil, pas sur l’extérieur du pied."], ["Rebondir en demi-reps."]),
  "lying-leg-curl": F("Leg curl couché", ["Hanches collées au coussin toute la série.", "Descends lentement — la descente construit l’ischio."], ["Hanches qui lèvent pour finir la rep."]),
  "seated-leg-curl": F("Leg curl assis", ["Coussin de cuisse bien ajusté ; penche-toi un peu pour plus d’étirement.", "Plie jusque sous le siège."], ["Amplitude courte.", "Laisser claquer les plaques."]),
  "back-extension-machine": F("Extension du dos à la machine", ["Bouge à partir des hanches, colonne neutre.", "Arrête quand le corps est aligné — pas de cambrure au-delà."], ["Hyperextension en haut.", "Arracher la charge."]),
  "glute-kickback-machine": F("Kickback fessier à la machine", ["Pousse vers l’arrière avec le talon.", "Arrête avant que le bas du dos se cambre."], ["Balancer la jambe.", "Cambrer au lieu d’étendre la hanche."]),
  "hip-abductor": F("Abducteurs à la machine", ["Assis droit, pousse les coussins avec l’extérieur des genoux.", "Contrôle le retour."], ["Laisser les coussins claquer ensemble."]),
  "hip-adductor": F("Adducteurs à la machine", ["Commence dans une amplitude que tu contrôles ; élargis-la au fil des semaines.", "Serre les coussins ensemble, pause."], ["Partir trop large, trop lourd."]),
  "smith-bench-press": F("Développé couché à la Smith", ["Banc placé pour que la barre arrive au bas de la poitrine.", "Omoplates serrées vers l’arrière."], ["Trajectoire de barre au-dessus du cou.", "Coudes ouverts à 90°."]),
  "incline-chest-press": F("Presse pectorale inclinée à la machine", ["Poignées à hauteur du haut de la poitrine.", "Pousse vers le haut et légèrement vers l’intérieur."], ["Épaules qui décollent du dossier vers l’avant."]),
  "pec-deck": F("Pec deck", ["Coudes légèrement fléchis, fixes toute la rep.", "Serre un arbre dans tes bras ; contracte au centre."], ["Pousser au lieu d’enlacer.", "S’étirer plus loin que l’épaule le permet."]),
  "cable-crossover": F("Écarté à la poulie vis-à-vis", ["Pieds décalés, légère inclinaison vers l’avant.", "Les mains se rejoignent devant le bas de la poitrine."], ["Plier les coudes pour bouger plus de poids."]),
  "dumbbell-fly": F("Écarté aux haltères", ["Descends en grand arc jusqu’à sentir l’étirement des pecs.", "Remonte comme autour d’un baril."], ["Descendre plus bas que l’épaule l’accepte.", "En faire un développé."]),
  "assisted-dip": F("Dips assistés", ["Plus d’assistance, ce n’est pas tricher : prends ce qui donne des reps propres.", "Coudes à 90°, poitrine un peu vers l’avant."], ["Descendre trop bas.", "Hausser les épaules en bas."]),
  "bench-dip": F("Dips sur banc", ["Hanches proches du banc.", "Plie à environ 90° et remonte."], ["Descendre bien sous le banc — ça charge l’avant de l’épaule."]),
  "shoulder-press-machine": F("Développé épaules à la machine", ["Règle le siège pour que les poignées partent à hauteur d’épaules.", "Dos contre le dossier ; pousse sans cambrer."], ["Cambrer en décollant du dossier.", "Demi-reps."]),
  "dumbbell-front-raise": F("Élévation frontale aux haltères", ["Monte à hauteur des yeux, pouces un peu vers le haut.", "Côtes basses, pas de penché arrière."], ["Balancer le buste."]),
  "dumbbell-tricep-extension": F("Extension triceps à l’haltère", ["Coudes pointés vers le haut, proches de la tête.", "Descends derrière la tête pour un étirement complet."], ["Coudes qui s’écartent.", "Cambrer le bas du dos."]),
  "low-row": F("Rowing bas à la machine", ["Poitrine sur le coussin, tire les coudes au-delà des côtes.", "Pause, puis laisse les omoplates s’étirer vers l’avant."], ["Se pencher en arrière pour finir.", "Hausser les épaules."]),
  "assisted-pull-up": F("Traction assistée", ["Pars suspendu bras tendus, épaules abaissées d’abord.", "Menton au-dessus de la barre, descends en deux secondes.", "Enlève un peu d’assistance chaque semaine."], ["Kipping sur le coussin.", "Demi-reps en haut."]),
  "hammer-curl": F("Curl marteau", ["Paumes face à face toute la rep.", "Coudes collés au corps."], ["Se balancer.", "Coudes qui avancent."]),
  "plank": F("Planche", ["Serre les fessiers, rentre les côtes, pousse le sol.", "La qualité avant la durée : 30 secondes intenses valent mieux que 3 minutes molles."], ["Hanches qui tombent ou qui montent."]),
  "side-plank": F("Planche latérale", ["Coude sous l’épaule, hanches empilées et levées."], ["Hanches qui tombent."]),
  "dead-bug": F("Dead bug", ["Bas du dos collé au sol tout du long.", "Bras et jambe opposés, lentement."], ["Dos qui se cambre."]),
  "pallof-press": F("Pallof press", ["Pousse devant, résiste à la rotation, tiens deux secondes."], ["Tourner vers l’ancrage."]),
  "hanging-knee-raise": F("Montée de genoux suspendu", ["Bascule le bassin d’abord, puis monte les genoux."], ["Se balancer."]),
  "crunch": F("Crunch", ["Enroule les côtes vers le bassin ; le bas du dos reste au sol.", "Mains légères sur la tête — ne tire jamais sur le cou."], ["Tirer la tête vers l’avant.", "Remonter complètement assis."]),
  "bicycle-crunch": F("Crunch vélo", ["Épaule vers le genou opposé, lentement.", "Allonge l’autre jambe, loin et bas."], ["Aller trop vite.", "Bouger seulement les coudes."]),
  "russian-twist": F("Rotation russe", ["Penche-toi en arrière, colonne longue ; tourne à partir des côtes.", "Pieds au sol tant que la rotation n’est pas contrôlée."], ["Arrondir le bas du dos.", "Juste balancer les bras."]),
  "ab-crunch-machine": F("Crunch à la machine", ["Enroule les côtes vers le bas ; les hanches ne bougent pas.", "Expire fort en bas."], ["Tirer avec les bras.", "Lourd et court."]),
  "rotary-torso": F("Rotation du tronc à la machine", ["Poitrine contre le coussin ; tourne lentement des deux côtés.", "Assez léger pour t’arrêter n’importe quand."], ["Lancer la charge."]),
  "farmers-carry": F("Marche du fermier", ["Grand, épaules basses, marche comme si tu n’avais rien dans les mains."], ["Pencher d’un côté."]),
  "suitcase-carry": F("Marche valise", ["Un seul côté chargé ; ne te penche pas à l’opposé."], ["Flexion latérale."]),
  "box-jump": F("Saut sur boîte", ["Atterris en douceur, tout le pied sur la boîte, redresse-toi.", "Redescends en marchant, pas en sautant."], ["Atterrir en squat profond."]),
  "broad-jump": F("Saut en longueur", ["Élan des bras, atterrissage silencieux."], ["Atterrissage raide."]),
  "burpee": F("Burpee", ["Un rythme régulier bat un sprint sur les dix premiers."], ["S’affaisser dans la pompe."]),
  "mountain-climber": F("Grimpeur", ["Hanches à niveau, genoux qui montent sous la poitrine."], ["Hanches qui montent."]),
  "run": F("Course", ["Zone 2 = tu peux dire des phrases complètes.", "Cadence autour de 170–180 pas par minute."], ["Chaque sortie au même rythme moyen-dur."]),
  "bike": F("Vélo", ["Cadence de 85–95 tr/min pour l’endurance."], ["Écraser un braquet énorme."]),
  "row": F("Rameur", ["Jambes, puis dos, puis bras. À l’inverse au retour.", "Damper à 4–6, pas à 10."], ["Bras qui tirent trop tôt."]),
  "brisk-walk": F("Marche rapide / ruck", ["Assez vite pour que parler demande un effort."], ["Flâner."]),
  "stair-sprints": F("Sprints dans les escaliers", ["Monte les genoux, redescends en marchant pour récupérer."], ["Sprinter la récupération."]),
  "90-90-hip-switch": F("Bascule de hanches 90/90", ["Les deux genoux à 90°, tourne de l’autre côté sans les mains.", "Lentement ; expire dans le passage difficile."], ["Se pencher en arrière pour tricher la rotation."]),
  "pigeon-stretch": F("Pigeon", ["Tibia avant aussi parallèle au tapis que la hanche le permet.", "Mets les hanches de face, puis penche-toi."], ["Douleur au genou avant : rapproche le pied."]),
  "couch-stretch": F("Étirement du divan", ["Genou arrière dans le coin, serre ce fessier, reste grand."], ["Cambrer le bas du dos."]),
  "deep-squat-hold": F("Squat profond tenu", ["Tiens-toi à quelque chose au besoin ; les coudes poussent les genoux vers l’extérieur.", "Talons au sol. S’ils lèvent, surélève-les sur un disque."], ["S’arrondir fort."]),
  "ankle-rock": F("Bascule de cheville", ["Genou au-dessus du petit orteil, le talon reste au sol."], ["Talon qui lève."]),
  "thoracic-rotation": F("Rotation thoracique", ["À quatre pattes, main derrière la tête, tourne le coude vers le plafond.", "Les hanches ne bougent pas."], ["Tourner à partir du bas du dos."]),
  "cat-cow": F("Chat–vache", ["Vertèbre par vertèbre ; respire avec le mouvement."], ["Aller trop vite."]),
  "shoulder-cars": F("CARs d’épaule", ["Cercle lent et contrôlé, le reste du corps verrouillé."], ["Hausser l’épaule en haut du cercle."]),
  "hamstring-floss": F("Floss des ischios", ["Tends le genou, flexe le pied, respire."], ["Arrondir le dos."]),
  "world-greatest-stretch": F("Meilleur étirement au monde", ["Fente, coude vers l’intérieur du pied, tourne vers le plafond."], ["Genou arrière qui s’effondre."]),
};

type Lang = "fr" | "en";

/** Name, cues and faults in the reader's language (English is the source). */
export function exText(ex: Pick<Exercise, "slug" | "name"> & Partial<Pick<Exercise, "cues" | "faults">>, lang: Lang): ExText {
  const fr = lang === "fr" ? EXERCISE_FR[ex.slug] : undefined;
  return { name: fr?.name ?? ex.name, cues: fr?.cues ?? ex.cues ?? [], faults: fr?.faults ?? ex.faults ?? [] };
}
export const exName = (ex: Pick<Exercise, "slug" | "name">, lang: Lang) => (lang === "fr" ? EXERCISE_FR[ex.slug]?.name : undefined) ?? ex.name;

const MUSCLE_FR: Record<Muscle, string> = {
  quads: "quadriceps", hamstrings: "ischios", glutes: "fessiers", calves: "mollets", chest: "pectoraux", back: "dos", lats: "dorsaux", traps: "trapèzes",
  shoulders: "épaules", biceps: "biceps", triceps: "triceps", forearms: "avant-bras", core: "tronc", hips: "hanches", spine: "colonne", ankles: "chevilles",
  cardio: "cardio", full_body: "corps entier",
};
const EQUIP_FR: Record<Equipment, string> = {
  barbell: "barre", dumbbell: "haltères", kettlebell: "kettlebell", cable: "poulie", machine: "machine", bodyweight: "poids du corps",
  band: "élastique", pullup_bar: "barre à traction", bench: "banc", rack: "support", rower: "rameur", bike: "vélo", treadmill: "tapis roulant", outdoor: "extérieur",
};
const PATTERN_FR: Record<Pattern, string> = {
  squat: "squat", hinge: "charnière", push_h: "poussée horizontale", push_v: "poussée verticale", pull_h: "tirage horizontal", pull_v: "tirage vertical",
  lunge: "fente", carry: "portage", core: "tronc", mobility: "mobilité", cardio: "cardio", power: "puissance",
};
const PAIN_FR: Record<PainArea, string> = { knee: "genou", back: "bas du dos", shoulder: "épaule", hip: "hanche", wrist: "poignet", ankle: "cheville", elbow: "coude" };

/** Display labels. English keeps the raw key as the pages always showed it. */
export const muscleLabel = (m: Muscle, lang: Lang) => (lang === "fr" ? MUSCLE_FR[m] ?? m : m);
export const equipLabel = (e: Equipment, lang: Lang) => (lang === "fr" ? EQUIP_FR[e] ?? e : e);
export const patternLabel = (p: Pattern, lang: Lang) => (lang === "fr" ? PATTERN_FR[p] ?? p : p.replace("_", " "));
export const painAreaLabel = (a: PainArea, lang: Lang) => (lang === "fr" ? PAIN_FR[a] ?? a : a);
