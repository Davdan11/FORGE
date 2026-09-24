import type { AvoidFood, Equipment, Lifestyle, PainArea, Profile, TrainingPlace } from "../types";
import type { Lang } from "../i18n";

/* The choices an athlete makes about their training and food, shared by
   onboarding and Settings so the two can never offer different lists. */

/* Each option carries its French beside the English (`fr`, or `nameFr`/`lineFr`);
   `choiceOptions(list, lang)` / `placeText(p, lang)` pick one at render time. */
export const PLACES: { v: TrainingPlace; name: string; line: string; nameFr: string; lineFr: string }[] = [
  { v: "full_gym", name: "Full gym", line: "Racks, cables, machines. Nothing to list.", nameFr: "Gym complet", lineFr: "Racks, poulies, machines. Rien à lister." },
  { v: "home_gym", name: "Home gym", line: "Tell us what you have.", nameFr: "Gym maison", lineFr: "Dis-nous ce que tu as." },
  { v: "no_gym", name: "No gym", line: "Bodyweight, outdoors, anywhere.", nameFr: "Pas de gym", lineFr: "Poids du corps, dehors, n’importe où." },
];
export const FULL_GYM: Equipment[] = ["barbell", "rack", "bench", "dumbbell", "kettlebell", "cable", "machine", "pullup_bar", "band", "rower", "bike", "treadmill", "outdoor"];
type Choice<V> = { v: V; label: string; fr: string };
export const HOME_KIT: Choice<Equipment>[] = [{ v: "dumbbell", label: "Dumbbells", fr: "Haltères" }, { v: "kettlebell", label: "Kettlebell", fr: "Kettlebell" }, { v: "barbell", label: "Barbell", fr: "Barre" }, { v: "rack", label: "Rack", fr: "Rack" }, { v: "bench", label: "Bench", fr: "Banc" }, { v: "pullup_bar", label: "Pull-up bar", fr: "Barre à traction" }, { v: "band", label: "Bands", fr: "Élastiques" }, { v: "cable", label: "Cables", fr: "Poulies" }, { v: "bike", label: "Bike", fr: "Vélo" }, { v: "rower", label: "Rower", fr: "Rameur" }, { v: "treadmill", label: "Treadmill", fr: "Tapis roulant" }];
export const AREAS: Choice<PainArea>[] = [{ v: "knee", label: "Knee", fr: "Genou" }, { v: "back", label: "Lower back", fr: "Bas du dos" }, { v: "shoulder", label: "Shoulder", fr: "Épaule" }, { v: "hip", label: "Hip", fr: "Hanche" }, { v: "wrist", label: "Wrist", fr: "Poignet" }, { v: "ankle", label: "Ankle", fr: "Cheville" }, { v: "elbow", label: "Elbow", fr: "Coude" }];
export const AVOID: Choice<AvoidFood>[] = [{ v: "nuts", label: "Nuts", fr: "Noix" }, { v: "peanuts", label: "Peanuts", fr: "Arachides" }, { v: "shellfish", label: "Shellfish", fr: "Fruits de mer" }, { v: "fish", label: "Fish", fr: "Poisson" }, { v: "eggs", label: "Eggs", fr: "Œufs" }, { v: "dairy", label: "Dairy", fr: "Produits laitiers" }, { v: "soy", label: "Soy", fr: "Soya" }, { v: "pork", label: "Pork", fr: "Porc" }, { v: "red_meat", label: "Red meat", fr: "Viande rouge" }];
export const DIETS: Choice<Profile["dietary"][number]>[] = [{ v: "vegetarian", label: "Vegetarian", fr: "Végétarien" }, { v: "vegan", label: "Vegan", fr: "Végane" }, { v: "pescatarian", label: "Pescatarian", fr: "Pescétarien" }, { v: "keto", label: "Keto", fr: "Céto" }, { v: "halal", label: "Halal", fr: "Halal" }, { v: "gluten_free", label: "Gluten-free", fr: "Sans gluten" }, { v: "lactose_free", label: "Lactose-free", fr: "Sans lactose" }];

export const SLEEP: Choice<Lifestyle["sleep"]>[] = [{ v: "under_6", label: "< 6 h", fr: "< 6 h" }, { v: "6_7", label: "6–7 h", fr: "6–7 h" }, { v: "7_8", label: "7–8 h", fr: "7–8 h" }, { v: "over_8", label: "8 h +", fr: "8 h +" }];
export const STRESS: Choice<Lifestyle["stress"]>[] = [{ v: "low", label: "Low", fr: "Faible" }, { v: "moderate", label: "Moderate", fr: "Modéré" }, { v: "high", label: "High", fr: "Élevé" }];
export const WORK: Choice<Lifestyle["work"]>[] = [{ v: "desk", label: "Sitting", fr: "Assis" }, { v: "on_feet", label: "On my feet", fr: "Debout" }, { v: "physical", label: "Physical work", fr: "Travail physique" }];

/** A choice list as picker options ({ v, label }) in the reader's language. */
export function choiceOptions<V>(list: Choice<V>[], lang: Lang): { v: V; label: string }[] {
  return list.map((c) => ({ v: c.v, label: lang === "fr" ? c.fr : c.label }));
}
/** One choice's label, e.g. an injury area by its key. */
export function choiceLabel<V>(list: Choice<V>[], v: V, lang: Lang): string | undefined {
  const c = list.find((x) => x.v === v);
  return c && (lang === "fr" ? c.fr : c.label);
}
/** A training place's name and line in the reader's language. */
export function placeText(p: (typeof PLACES)[number], lang: Lang): { name: string; line: string } {
  return lang === "fr" ? { name: p.nameFr, line: p.lineFr } : { name: p.name, line: p.line };
}
export const DEFAULT_LIFESTYLE: Lifestyle = { sleep: "7_8", stress: "moderate", work: "desk" };

/** Equipment for a place. A home gym keeps its own list; outdoors is always there. */
export function equipmentFor(place: TrainingPlace, homeKit: Equipment[]): Equipment[] {
  if (place === "full_gym") return FULL_GYM;
  if (place === "home_gym") return [...new Set<Equipment>([...homeKit.filter((e) => e !== "outdoor"), "outdoor"])];
  return ["outdoor"];
}
