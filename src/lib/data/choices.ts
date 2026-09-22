import type { AvoidFood, Equipment, Lifestyle, PainArea, Profile, TrainingPlace } from "../types";

/* The choices an athlete makes about their training and food, shared by
   onboarding and Settings so the two can never offer different lists. */

export const PLACES: { v: TrainingPlace; name: string; line: string }[] = [
  { v: "full_gym", name: "Full gym", line: "Racks, cables, machines. Nothing to list." },
  { v: "home_gym", name: "Home gym", line: "Tell us what you have." },
  { v: "no_gym", name: "No gym", line: "Bodyweight, outdoors, anywhere." },
];
export const FULL_GYM: Equipment[] = ["barbell", "rack", "bench", "dumbbell", "kettlebell", "cable", "machine", "pullup_bar", "band", "rower", "bike", "treadmill", "outdoor"];
export const HOME_KIT: { v: Equipment; label: string }[] = [{ v: "dumbbell", label: "Dumbbells" }, { v: "kettlebell", label: "Kettlebell" }, { v: "barbell", label: "Barbell" }, { v: "rack", label: "Rack" }, { v: "bench", label: "Bench" }, { v: "pullup_bar", label: "Pull-up bar" }, { v: "band", label: "Bands" }, { v: "cable", label: "Cables" }, { v: "bike", label: "Bike" }, { v: "rower", label: "Rower" }, { v: "treadmill", label: "Treadmill" }];
export const AREAS: { v: PainArea; label: string }[] = [{ v: "knee", label: "Knee" }, { v: "back", label: "Lower back" }, { v: "shoulder", label: "Shoulder" }, { v: "hip", label: "Hip" }, { v: "wrist", label: "Wrist" }, { v: "ankle", label: "Ankle" }, { v: "elbow", label: "Elbow" }];
export const AVOID: { v: AvoidFood; label: string }[] = [{ v: "nuts", label: "Nuts" }, { v: "peanuts", label: "Peanuts" }, { v: "shellfish", label: "Shellfish" }, { v: "fish", label: "Fish" }, { v: "eggs", label: "Eggs" }, { v: "dairy", label: "Dairy" }, { v: "soy", label: "Soy" }, { v: "pork", label: "Pork" }, { v: "red_meat", label: "Red meat" }];
export const DIETS: { v: Profile["dietary"][number]; label: string }[] = [{ v: "vegetarian", label: "Vegetarian" }, { v: "vegan", label: "Vegan" }, { v: "pescatarian", label: "Pescatarian" }, { v: "keto", label: "Keto" }, { v: "halal", label: "Halal" }, { v: "gluten_free", label: "Gluten-free" }, { v: "lactose_free", label: "Lactose-free" }];

export const SLEEP: { v: Lifestyle["sleep"]; label: string }[] = [{ v: "under_6", label: "< 6 h" }, { v: "6_7", label: "6–7 h" }, { v: "7_8", label: "7–8 h" }, { v: "over_8", label: "8 h +" }];
export const STRESS: { v: Lifestyle["stress"]; label: string }[] = [{ v: "low", label: "Low" }, { v: "moderate", label: "Moderate" }, { v: "high", label: "High" }];
export const WORK: { v: Lifestyle["work"]; label: string }[] = [{ v: "desk", label: "Sitting" }, { v: "on_feet", label: "On my feet" }, { v: "physical", label: "Physical work" }];
export const DEFAULT_LIFESTYLE: Lifestyle = { sleep: "7_8", stress: "moderate", work: "desk" };

/** Equipment for a place. A home gym keeps its own list; outdoors is always there. */
export function equipmentFor(place: TrainingPlace, homeKit: Equipment[]): Equipment[] {
  if (place === "full_gym") return FULL_GYM;
  if (place === "home_gym") return [...new Set<Equipment>([...homeKit.filter((e) => e !== "outdoor"), "outdoor"])];
  return ["outdoor"];
}
