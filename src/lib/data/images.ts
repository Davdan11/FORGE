import type { Exercise, SessionKind } from "../types";

/* Photo helpers. Unsplash IDs verified to resolve; swap for the media pack later. */
const U = (id: string, w = 1000, h = 700) => `https://images.unsplash.com/photo-${id}?w=${w}&h=${h}&fit=crop&q=75&auto=format`;

const GYM = {
  squat: "1541534741688-6078c6bfb5c5",
  squat2: "1567598508481-65985588e295",
  deadlift: "1517963879433-6ad2b056d712",
  deadlift2: "1521804906057-1df8fdb718b7",
  bench: "1584466977773-e625c37cdd50",
  pullup: "1532029837206-abbe2b7620e3",
  kettlebell: "1601422407692-ec4eeec1d9b3",
  ohp: "1581009146145-b5ef050c2e1e",
  cable: "1574680096145-d05b474e2155",
  pushup: "1594737625785-a6cbdabd333c",
  dumbbells: "1534438327276-14e5300c3a48",
  rack: "1558611848-73f7eb4001a1",
  floor: "1540497077202-7c8a3999166f",
  ropes: "1548690312-e3b507d8c110",
  mobility: "1599901860904-17e6ed7083a0",
  yoga: "1518611012118-696072aa579a",
  yoga2: "1552196563-55cd4e45efb3",
  stairs: "1476480862126-209bfaa8edc8",
  track: "1461896836934-ffe607ba8211",
  rower: "1519505907962-0a6cb0167c73",
  run: "1607962837359-5e7e89f86776",
  dark: "1526506118085-60ce8714f8c5",
  back: "1603287681836-b174ce5074c2",
  hero: "1605296867304-46d5465a13f1",
  lunge: "1550345332-09e3ac987658",
  group: "1518310383802-640c2de311b2",
  laugh: "1590556409324-aa1d726e5c3c",
};

const BY_SLUG: Partial<Record<string, string>> = {
  "back-squat": GYM.squat, "front-squat": GYM.squat2, "goblet-squat": GYM.kettlebell, "leg-press": GYM.rack, "hack-squat": GYM.rack, "safety-bar-squat": GYM.squat,
  "deadlift": GYM.deadlift, "trap-bar-deadlift": GYM.deadlift2, "romanian-deadlift": GYM.deadlift2, "kettlebell-swing": GYM.kettlebell, "hip-thrust": GYM.floor,
  "bench-press": GYM.bench, "dumbbell-bench-press": GYM.dumbbells, "incline-dumbbell-press": GYM.dumbbells, "push-up": GYM.pushup, "incline-push-up": GYM.pushup,
  "overhead-press": GYM.ohp, "dumbbell-shoulder-press": GYM.ohp, "landmine-press": GYM.ohp, "lateral-raise": GYM.dumbbells,
  "barbell-row": GYM.back, "dumbbell-row": GYM.dumbbells, "cable-row": GYM.cable, "chest-supported-row": GYM.cable, "face-pull": GYM.cable,
  "pull-up": GYM.pullup, "chin-up": GYM.pullup, "band-assisted-pull-up": GYM.pullup, "lat-pulldown": GYM.cable,
  "bulgarian-split-squat": GYM.lunge, "reverse-lunge": GYM.lunge, "walking-lunge": GYM.lunge, "step-up": GYM.stairs,
  "farmers-carry": GYM.kettlebell, "suitcase-carry": GYM.kettlebell, "burpee": GYM.ropes, "mountain-climber": GYM.ropes, "box-jump": GYM.stairs, "broad-jump": GYM.track,
  "run": GYM.run, "bike": GYM.track, "row": GYM.rower, "brisk-walk": GYM.run, "stair-sprints": GYM.stairs,
};

export function exerciseImage(ex: Pick<Exercise, "slug" | "pattern" | "pillar">, w = 1000, h = 700) {
  const id = BY_SLUG[ex.slug] ?? (ex.pillar === "mobility" ? GYM.mobility : ex.pattern === "core" ? GYM.yoga2 : ex.pattern === "cardio" ? GYM.track : GYM.floor);
  return U(id, w, h);
}

export function sessionImage(kind: SessionKind, w = 1200, h = 800) {
  const id = ({ lower: GYM.squat, legs: GYM.squat2, upper: GYM.bench, push: GYM.ohp, pull: GYM.pullup, full: GYM.hero, cardio_z2: GYM.run, cardio_intervals: GYM.track, mobility: GYM.mobility, rest: GYM.yoga } as Record<SessionKind, string>)[kind] ?? GYM.hero;
  return U(id, w, h);
}

const OUT = {
  run: "1486218119243-13883505764c", runGroup: "1552674605-db6ffd4facb5", tempo: "1571008887538-b36bb32f4571", track: "1529900748604-07564a03e7a6",
  ride: "1541625602330-2277a4c46182", peloton: "1517649763962-0c623066013b", hike: "1551632811-561732d1e306", hike2: "1501554728187-ce583db33af7",
  ski: "1551698618-1dfe5d97d256", snow: "1548777123-e216912df7d8", shoes: "1483721310020-03333e577078", forest: "1476231682828-37e571bc172f",
  lake: "1508672019048-805c876b67e2", dusty: "1530143311094-34d807799e8f", stairsLegs: "1538805060514-97d9cc17730c", stairs: "1476480862126-209bfaa8edc8",
  massage: "1544161515-4ab6ce6db874", mountain: "1553531384-397c80973a0b", city: "1498036882173-b41c28a8ba34", sunset: "1506905925346-21bda4d32df4",
  rower: "1519505907962-0a6cb0167c73", swim: "1454496522488-7a8e488e8606", yoga: "1544367567-0f2fcb009e0b",
};

export function activityImage(type: string, w = 1200, h = 800) {
  const id = ({ run: OUT.run, ride: OUT.ride, walk: OUT.lake, hike: OUT.hike, ruck: OUT.mountain, row: OUT.rower, ski: OUT.ski, trail: OUT.forest, swim: OUT.swim, other: OUT.sunset } as Record<string, string>)[type] ?? OUT.run;
  return U(id, w, h);
}

/* FORGE's own artwork, shipped in /public/art (no network needed): one
   backdrop per tab, and one per built-in indoor course. */
export const ART = {
  today: "/art/bg-today.webp",
  library: "/art/bg-library.webp",
  move: "/art/bg-move.webp",
  indoor: "/art/bg-indoor.webp",
  food: "/art/bg-food.webp",
  profile: "/art/bg-profile.webp",
  course: { vallee: "/art/indoor-vallee.webp", "mont-royal": "/art/indoor-montagne.webp", plaine: "/art/indoor-plaine.webp" } as Record<string, string>,
};

export const IMG = {
  moveHero: U(OUT.runGroup, 1200, 800),
  moveShoes: U(OUT.shoes, 1200, 800),
  city: U(OUT.city, 1200, 800),
  recovery: U(OUT.massage, 1200, 800),
  weight: U(OUT.yoga, 1200, 800),
  restDay: U(GYM.yoga, 1200, 800),
  moveEmpty: U(GYM.run, 1200, 800),
  progress: U(GYM.back, 1200, 700),
  group: U(GYM.group, 1200, 800),
  laugh: U(GYM.laugh, 800, 800),
  onboarding: U(GYM.hero, 1200, 1600),
  dark: U(GYM.dark, 1200, 1600),
};

export const food = (id: string, w = 1000, h = 700) => U(id, w, h);
