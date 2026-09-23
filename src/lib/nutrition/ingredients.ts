/* ─────────────────────────────────────────────────────────────
   Ingredient nutrition table — per 100 g (edible, as stated),
   values rounded from USDA FoodData Central / typical labels.
   kcal · protein · carbs · sugar · fat · fiber
   ───────────────────────────────────────────────────────────── */

export type Diet = "vegetarian" | "vegan" | "pescatarian" | "gluten_free" | "lactose_free";
export type Cat = "protein" | "carb" | "veg" | "sauce" | "fruit" | "dairy" | "extra";

export interface Ingredient {
  id: string;
  name: string;
  cat: Cat;
  /** per 100 g */
  n: [kcal: number, p: number, c: number, sugar: number, f: number, fiber: number];
  /** Diet flags this ingredient is compatible with (absent flag = not compatible). */
  ok: Diet[];
  /** Human portion unit, if not grams: [label, grams]. */
  unit?: [string, number];
  /** Cooked-from-dry ratio for grains/pasta (cooked g = dry g × ratio). */
  dry?: number;
  /** Cooking lines by method, with real temps/times. */
  cook?: Partial<Record<Method, string>>;
  /** Short qualifier used in recipe names. */
  adj?: string;
}

export type Method = "roast" | "pan" | "stirfry" | "grill" | "boil" | "steam" | "raw" | "curry" | "pasta";

const ALL: Diet[] = ["vegetarian", "vegan", "pescatarian", "gluten_free", "lactose_free"];
const MEAT: Diet[] = ["gluten_free", "lactose_free"];
const FISH: Diet[] = ["pescatarian", "gluten_free", "lactose_free"];
const VEGT: Diet[] = ["vegetarian", "pescatarian", "gluten_free", "lactose_free"];   // vegetarian, dairy-free
const VEGD: Diet[] = ["vegetarian", "pescatarian", "gluten_free"];                   // vegetarian with dairy
const VEGAN_GF: Diet[] = ALL;

const I = (i: Ingredient) => i;

export const INGREDIENTS: Ingredient[] = [
  /* ── Proteins ── */
  I({ id: "chicken-breast", name: "Chicken breast", cat: "protein", n: [120, 22.5, 0, 0, 2.6, 0], ok: MEAT, adj: "lemon-herb",
    cook: { pan: "Butterfly the chicken so it's an even thickness, salt both sides. Sear in a hot pan with a teaspoon of oil, 5–6 min per side, until 74 °C inside. Rest 3 min, slice.", roast: "Roast the chicken on the tray at 220 °C for 18–22 min until 74 °C inside; rest 3 min.", stirfry: "Slice the chicken thin across the grain. Sear in a smoking-hot wok in a single layer, 2–3 min, then remove.", grill: "Grill the chicken 5 min per side over high heat until 74 °C inside; rest 3 min.", curry: "Cube the chicken; brown 4 min in the pan before the sauce goes in, then simmer 10 min in the curry until cooked through." } }),
  I({ id: "chicken-thigh", name: "Chicken thighs", cat: "protein", n: [145, 19, 0, 0, 8, 0], ok: MEAT, adj: "crispy",
    cook: { roast: "Roast the thighs skin-side up at 210 °C for 30–35 min until the skin crisps and the inside hits 75 °C.", pan: "Sear the thighs skin-side down 7 min, flip, 6 min more until 75 °C inside.", curry: "Cube the thighs; brown 5 min, then simmer 15 min in the curry sauce.", grill: "Grill the thighs 6–7 min per side until 75 °C inside." } }),
  I({ id: "turkey-mince", name: "Lean ground turkey", cat: "protein", n: [150, 19, 0, 0, 8, 0], ok: MEAT, adj: "spiced",
    cook: { pan: "Brown the turkey in a hot pan 6–7 min, breaking it up, until no pink remains. Season hard — turkey needs it.", stirfry: "Brown the turkey in the wok 5 min, breaking it up, then push aside.", curry: "Brown the turkey 5 min, then simmer 10 min in the sauce." } }),
  I({ id: "beef-mince", name: "Lean ground beef (95/5)", cat: "protein", n: [137, 21, 0, 0, 5, 0], ok: MEAT, adj: "seared",
    cook: { pan: "Brown the beef in a hot pan 6 min, breaking it up; drain any fat.", stirfry: "Brown the beef 4 min in a smoking wok; remove.", curry: "Brown the beef 5 min, then simmer 12 min in the sauce." } }),
  I({ id: "sirloin", name: "Sirloin steak", cat: "protein", n: [150, 22, 0, 0, 6.5, 0], ok: MEAT, adj: "pan-seared",
    cook: { pan: "Pat the steak dry, salt it, sear in a very hot pan 3 min per side for medium-rare (2.5 cm thick). Rest 5 min, slice against the grain.", grill: "Grill the steak 3–4 min per side over high heat; rest 5 min, slice thin.", stirfry: "Slice the steak thin; sear 60–90 s in a smoking wok in one layer, then remove." } }),
  I({ id: "pork-tenderloin", name: "Pork tenderloin", cat: "protein", n: [120, 21, 0, 0, 3.5, 0], ok: MEAT, adj: "roasted",
    cook: { roast: "Sear the pork 2 min per side, then roast at 200 °C for 15–18 min until 63 °C inside. Rest 5 min, slice.", pan: "Slice the pork into 2 cm medallions; sear 3 min per side until just blushing (63 °C).", stirfry: "Slice thin; sear 2 min in a hot wok, remove." } }),
  I({ id: "salmon", name: "Salmon fillet", cat: "protein", n: [208, 20, 0, 0, 13, 0], ok: FISH, adj: "roasted",
    cook: { roast: "Oil and season the salmon; roast skin-side down at 200 °C for 12 min — it should flake and stay pink in the center. Pull it a minute early.", pan: "Sear the salmon skin-side down 4 min without moving it, flip, 2 min more.", grill: "Grill the salmon skin-side down 5 min, flip for 2." } }),
  I({ id: "cod", name: "Cod fillet", cat: "protein", n: [82, 18, 0, 0, 0.7, 0], ok: FISH, adj: "baked",
    cook: { roast: "Bake the cod at 200 °C for 12 min until it flakes.", pan: "Dust the cod with a little flour or not; pan-fry 3 min per side in oil until opaque.", curry: "Cut the cod into chunks; slip them into the simmering sauce for the last 5 min." } }),
  I({ id: "shrimp", name: "Shrimp, peeled", cat: "protein", n: [85, 20, 0, 0, 0.5, 0], ok: FISH, adj: "garlic",
    cook: { pan: "Pat the shrimp dry; sauté 90 s per side in hot oil with garlic until pink and curled.", stirfry: "Toss the shrimp into the smoking wok for 2 min until pink; remove.", curry: "Add the shrimp to the simmering sauce for the last 3 min.", grill: "Skewer and grill 2 min per side." } }),
  I({ id: "tuna", name: "Tuna in water, drained", cat: "protein", n: [116, 26, 0, 0, 1, 0], ok: FISH, adj: "",
    cook: { raw: "Drain the tuna and flake it." } }),
  I({ id: "eggs", name: "Eggs", cat: "protein", n: [143, 12.6, 0.7, 0.4, 9.5, 0], ok: VEGT, unit: ["egg", 50], adj: "",
    cook: { pan: "Cook the eggs on medium-low with a knob of butter — scrambled slowly (3 min, off the heat while still glossy) or fried 3 min until the whites set.", boil: "Boil the eggs 7 min for jammy yolks; cool in cold water, peel.", raw: "" } }),
  I({ id: "tofu", name: "Firm tofu", cat: "protein", n: [120, 13, 2.5, 0.5, 7, 1.5], ok: VEGAN_GF, adj: "crispy",
    cook: { pan: "Press the tofu 10 min, cube it, toss with a teaspoon of cornflour and salt. Fry in hot oil 6–8 min, turning, until golden on every side.", roast: "Press, cube, toss with oil and cornflour; roast at 220 °C for 25 min until crisp.", stirfry: "Press and cube the tofu; fry 6 min until golden, remove.", curry: "Cube the tofu; fry 5 min until golden, then simmer 8 min in the sauce." } }),
  I({ id: "tempeh", name: "Tempeh", cat: "protein", n: [192, 20, 8, 0, 11, 6], ok: VEGAN_GF, adj: "golden",
    cook: { pan: "Slice the tempeh 1 cm thick; fry 3 min per side in oil until golden. Splash with soy at the end.", roast: "Cube and roast at 200 °C for 20 min.", stirfry: "Cube; fry 5 min until golden, remove.", curry: "Cube; fry 5 min, then simmer 8 min in the sauce." } }),
  I({ id: "chickpeas", name: "Chickpeas, cooked", cat: "protein", n: [139, 7.5, 22, 4, 2.6, 6], ok: VEGAN_GF, adj: "crispy",
    cook: { roast: "Rinse and dry the chickpeas; toss with oil, smoked paprika and salt; roast at 220 °C for 22 min until crisp.", pan: "Fry the chickpeas 5 min in oil with cumin until they pop.", raw: "Rinse and drain the chickpeas.", curry: "Add the chickpeas to the sauce and simmer 10 min." } }),
  I({ id: "black-beans", name: "Black beans, cooked", cat: "protein", n: [130, 8.9, 24, 0.3, 0.5, 8.7], ok: VEGAN_GF, adj: "smoky",
    cook: { pan: "Warm the beans 4 min with cumin, lime and a pinch of salt; mash a few.", raw: "Rinse and drain the beans." } }),
  I({ id: "lentils", name: "Lentils, cooked", cat: "protein", n: [116, 9, 20, 1.8, 0.4, 7.9], ok: VEGAN_GF, adj: "",
    cook: { raw: "Warm the lentils 2 min with a squeeze of lemon and olive oil.", curry: "Add the lentils and simmer 8 min." } }),
  I({ id: "halloumi", name: "Halloumi", cat: "protein", n: [321, 22, 2, 2, 25, 0], ok: VEGD, adj: "grilled",
    cook: { pan: "Slice the halloumi 1 cm thick; dry-fry 2 min per side until golden. Serve immediately — it turns rubbery cold.", grill: "Grill the halloumi slices 2 min per side.", roast: "Cube and roast 12 min at 220 °C." } }),
  I({ id: "paneer", name: "Paneer", cat: "protein", n: [296, 18, 3.6, 3, 23, 0], ok: VEGD, adj: "tikka",
    cook: { pan: "Cube the paneer; sear 2 min per side until charred at the edges.", curry: "Sear the paneer cubes 2 min per side, then simmer 5 min in the sauce.", roast: "Cube, toss with spices and yogurt, roast 15 min at 220 °C." } }),
  I({ id: "greek-yogurt", name: "Greek yogurt 2%", cat: "protein", n: [73, 10, 4, 4, 2, 0], ok: VEGD, cook: { raw: "" } }),
  I({ id: "cottage-cheese", name: "Cottage cheese 2%", cat: "protein", n: [84, 11, 4.3, 4, 2.3, 0], ok: VEGD, cook: { raw: "" } }),
  I({ id: "whey", name: "Whey protein", cat: "protein", n: [400, 80, 8, 4, 6, 0], ok: VEGD, unit: ["scoop", 30], cook: { raw: "" } }),
  I({ id: "plant-protein", name: "Plant protein powder", cat: "protein", n: [380, 70, 12, 2, 6, 4], ok: VEGAN_GF, unit: ["scoop", 30], cook: { raw: "" } }),

  /* ── Carbs ── */
  I({ id: "white-rice", name: "White rice", cat: "carb", n: [130, 2.7, 28, 0.1, 0.3, 0.4], ok: VEGAN_GF, dry: 3, cook: { boil: "Rinse the rice until the water runs clear. Simmer covered in 1.8× water for 12 min, then rest 5 min off the heat and fluff." } }),
  I({ id: "brown-rice", name: "Brown rice", cat: "carb", n: [123, 2.7, 26, 0.4, 1, 1.6], ok: VEGAN_GF, dry: 3, cook: { boil: "Simmer the brown rice in 2× water, covered, 30–35 min; rest 5 min, fluff." } }),
  I({ id: "quinoa", name: "Quinoa", cat: "carb", n: [120, 4.4, 21, 0.9, 1.9, 2.8], ok: VEGAN_GF, dry: 3, cook: { boil: "Rinse the quinoa; simmer in 2× water 15 min until the germ spirals out. Fluff." } }),
  I({ id: "sweet-potato", name: "Sweet potato", cat: "carb", n: [86, 1.6, 20, 4.2, 0.1, 3], ok: VEGAN_GF, cook: { roast: "Cut the sweet potato into 3 cm chunks, toss with oil and salt; roast at 220 °C for 25 min.", boil: "Dice and microwave 5–6 min, or boil 12 min, until soft." } }),
  I({ id: "potatoes", name: "Baby potatoes", cat: "carb", n: [77, 2, 17, 0.8, 0.1, 2.2], ok: VEGAN_GF, cook: { roast: "Halve the potatoes, parboil 7 min, drain and shake to rough the edges; roast with oil at 220 °C for 25 min until crisp.", boil: "Boil the potatoes in salted water 15 min until a knife slides in; crush lightly with oil and salt." } }),
  I({ id: "pasta", name: "Wholewheat pasta", cat: "carb", n: [124, 5.3, 26, 0.8, 0.5, 4.5], ok: ["vegetarian", "vegan", "pescatarian", "lactose_free"], dry: 2.2, cook: { boil: "Boil the pasta in well-salted water to packet time minus 1 min. Keep a cup of the water before draining." } }),
  I({ id: "rice-noodles", name: "Rice noodles", cat: "carb", n: [108, 0.9, 25, 0, 0.2, 1], ok: VEGAN_GF, dry: 2.5, cook: { boil: "Soak or boil the noodles per the packet (usually 3–4 min); drain, rinse briefly." } }),
  I({ id: "couscous", name: "Couscous", cat: "carb", n: [112, 3.8, 23, 0.1, 0.2, 1.4], ok: ["vegetarian", "vegan", "pescatarian", "lactose_free"], dry: 2.5, cook: { boil: "Pour 1.2× boiling water over the couscous with a pinch of salt; cover 5 min, fluff with a fork." } }),
  I({ id: "bulgur", name: "Bulgur", cat: "carb", n: [83, 3.1, 19, 0.1, 0.2, 4.5], ok: ["vegetarian", "vegan", "pescatarian", "lactose_free"], dry: 3, cook: { boil: "Simmer the bulgur in 2× water 12 min; rest 5 min, fluff." } }),
  I({ id: "farro", name: "Farro", cat: "carb", n: [130, 5, 26, 0.4, 1, 3.5], ok: ["vegetarian", "vegan", "pescatarian", "lactose_free"], dry: 2.5, cook: { boil: "Simmer the farro in plenty of salted water 25 min until chewy-tender; drain." } }),
  I({ id: "oats", name: "Rolled oats", cat: "carb", n: [379, 13, 68, 1, 6.5, 10], ok: VEGAN_GF, cook: { boil: "Simmer the oats in the milk with a pinch of salt 4 min, stirring." , raw: "" } }),
  I({ id: "bread", name: "Wholegrain bread", cat: "carb", n: [247, 13, 41, 6, 3.4, 7], ok: ["vegetarian", "vegan", "pescatarian", "lactose_free"], unit: ["slice", 40], cook: { raw: "Toast the bread." } }),
  I({ id: "tortilla", name: "Wholewheat tortilla", cat: "carb", n: [300, 8, 50, 3, 7, 5], ok: ["vegetarian", "vegan", "pescatarian", "lactose_free"], unit: ["wrap", 60], cook: { raw: "Warm the tortillas 20 s each in a dry hot pan." } }),
  I({ id: "corn-tortilla", name: "Corn tortillas", cat: "carb", n: [218, 5.7, 45, 0.9, 2.9, 6], ok: VEGAN_GF, unit: ["tortilla", 30], cook: { raw: "Char the tortillas 20 s per side over a flame or in a dry pan." } }),

  /* ── Vegetables ── */
  I({ id: "broccoli", name: "Broccoli", cat: "veg", n: [34, 2.8, 7, 1.7, 0.4, 2.6], ok: VEGAN_GF, cook: { roast: "Roast the broccoli florets with a little oil at 220 °C for 15 min until the edges char.", steam: "Steam the broccoli 4 min until bright green.", stirfry: "Stir-fry the broccoli 2 min, add a splash of water, cover 2 min." } }),
  I({ id: "green-beans", name: "Green beans", cat: "veg", n: [31, 1.8, 7, 3.3, 0.2, 2.7], ok: VEGAN_GF, cook: { steam: "Steam or blanch the beans 3 min; toss with a little oil and salt.", roast: "Roast the beans 12 min at 220 °C.", stirfry: "Stir-fry the beans 3 min until blistered." } }),
  I({ id: "asparagus", name: "Asparagus", cat: "veg", n: [20, 2.2, 3.9, 1.9, 0.1, 2.1], ok: VEGAN_GF, cook: { roast: "Roast the asparagus 8 min at 220 °C.", steam: "Steam 3 min.", stirfry: "Cut into 3 cm pieces; stir-fry 3 min.", grill: "Grill 4 min, turning." } }),
  I({ id: "spinach", name: "Spinach", cat: "veg", n: [23, 2.9, 3.6, 0.4, 0.4, 2.2], ok: VEGAN_GF, cook: { steam: "Wilt the spinach in the hot pan for 1 min.", raw: "", stirfry: "Throw the spinach in for the final 30 s.", curry: "Stir the spinach into the curry until it wilts." } }),
  I({ id: "kale", name: "Kale", cat: "veg", n: [49, 4.3, 8.8, 2.3, 0.9, 3.6], ok: VEGAN_GF, cook: { raw: "Massage the kale with a little oil and salt for 1 min to soften it.", roast: "Roast the kale 8 min at 200 °C until crisp.", steam: "Wilt the kale 2 min." } }),
  I({ id: "bell-pepper", name: "Bell peppers", cat: "veg", n: [31, 1, 6, 4.2, 0.3, 2.1], ok: VEGAN_GF, cook: { roast: "Roast the pepper strips 20 min at 220 °C until soft and charred.", stirfry: "Stir-fry the pepper strips 3 min.", raw: "Slice the pepper thin.", grill: "Grill the pepper quarters 4 min per side." } }),
  I({ id: "courgette", name: "Zucchini", cat: "veg", n: [17, 1.2, 3.1, 2.5, 0.3, 1], ok: VEGAN_GF, cook: { roast: "Roast the zucchini chunks 18 min at 220 °C.", stirfry: "Stir-fry 3 min.", grill: "Grill the zucchini slices 3 min per side." } }),
  I({ id: "mushrooms", name: "Mushrooms", cat: "veg", n: [22, 3.1, 3.3, 2, 0.3, 1], ok: VEGAN_GF, cook: { pan: "Fry the mushrooms in a hot dry pan 5 min until browned, then add a little oil and salt.", roast: "Roast the mushrooms 15 min at 220 °C.", stirfry: "Stir-fry the mushrooms 4 min until browned." } }),
  I({ id: "cherry-tomatoes", name: "Cherry tomatoes", cat: "veg", n: [18, 0.9, 3.9, 2.6, 0.2, 1.2], ok: VEGAN_GF, cook: { roast: "Roast the tomatoes 15 min at 200 °C until they burst.", raw: "Halve the tomatoes.", pan: "Blister the tomatoes in the hot pan 3 min." } }),
  I({ id: "carrot", name: "Carrot", cat: "veg", n: [41, 0.9, 9.6, 4.7, 0.2, 2.8], ok: VEGAN_GF, cook: { roast: "Roast the carrot batons 25 min at 220 °C.", raw: "Grate or ribbon the carrot.", stirfry: "Stir-fry the carrot matchsticks 3 min." } }),
  I({ id: "cucumber", name: "Cucumber", cat: "veg", n: [15, 0.7, 3.6, 1.7, 0.1, 0.5], ok: VEGAN_GF, cook: { raw: "Dice or ribbon the cucumber." } }),
  I({ id: "red-cabbage", name: "Red cabbage", cat: "veg", n: [31, 1.4, 7.4, 3.8, 0.2, 2.1], ok: VEGAN_GF, cook: { raw: "Shred the cabbage thin; toss with a pinch of salt and a squeeze of lime.", stirfry: "Stir-fry the cabbage 3 min." } }),
  I({ id: "cauliflower", name: "Cauliflower", cat: "veg", n: [25, 1.9, 5, 1.9, 0.3, 2], ok: VEGAN_GF, cook: { roast: "Roast the cauliflower florets 22 min at 220 °C until deeply browned.", curry: "Add the cauliflower florets to the sauce and simmer 12 min.", steam: "Steam 5 min." } }),
  I({ id: "edamame", name: "Edamame", cat: "veg", n: [121, 11, 9, 2.2, 5, 5.2], ok: VEGAN_GF, cook: { steam: "Microwave the edamame 2 min; salt.", raw: "Thaw the edamame." } }),
  I({ id: "leaves", name: "Mixed leaves", cat: "veg", n: [17, 1.5, 3, 1, 0.2, 1.5], ok: VEGAN_GF, cook: { raw: "" } }),
  I({ id: "red-onion", name: "Red onion", cat: "veg", n: [40, 1.1, 9.3, 4.2, 0.1, 1.7], ok: VEGAN_GF, cook: { raw: "Slice the onion paper-thin; soak 2 min in lemon juice to tame it.", roast: "Roast the onion wedges 20 min at 220 °C.", stirfry: "Stir-fry the onion 2 min." } }),
  I({ id: "bok-choy", name: "Bok choy", cat: "veg", n: [13, 1.5, 2.2, 1.2, 0.2, 1], ok: VEGAN_GF, cook: { stirfry: "Halve the bok choy; stir-fry 2 min cut-side down, then 1 min more.", steam: "Steam 3 min." } }),

  /* ── Sauces & fats (per 100 g) ── */
  I({ id: "olive-oil", name: "Olive oil", cat: "sauce", n: [884, 0, 0, 0, 100, 0], ok: VEGAN_GF, unit: ["tbsp", 14] }),
  I({ id: "tahini-lemon", name: "Tahini-lemon dressing", cat: "sauce", n: [450, 12, 12, 1, 40, 5], ok: VEGAN_GF, unit: ["tbsp", 15], cook: { raw: "Whisk tahini with lemon juice, a little garlic, salt and enough water to make it pourable." } }),
  I({ id: "peanut-sauce", name: "Peanut sauce", cat: "sauce", n: [380, 12, 20, 10, 28, 3], ok: VEGAN_GF, unit: ["tbsp", 16], cook: { raw: "Stir peanut butter with soy, lime, a little honey or maple and warm water until smooth." } }),
  I({ id: "soy-ginger", name: "Soy-ginger sauce", cat: "sauce", n: [90, 5, 12, 8, 1, 0.5], ok: ["vegetarian", "vegan", "pescatarian", "lactose_free"], unit: ["tbsp", 15], cook: { raw: "Mix soy sauce, grated ginger, garlic, a splash of rice vinegar and a teaspoon of honey." } }),
  I({ id: "teriyaki", name: "Teriyaki glaze", cat: "sauce", n: [130, 5, 25, 20, 0.5, 0], ok: ["vegetarian", "vegan", "pescatarian", "lactose_free"], unit: ["tbsp", 15] }),
  I({ id: "pesto", name: "Basil pesto", cat: "sauce", n: [450, 5, 6, 1, 45, 2], ok: VEGD, unit: ["tbsp", 15] }),
  I({ id: "yogurt-herb", name: "Yogurt-herb sauce", cat: "sauce", n: [90, 8, 5, 4, 4, 0], ok: VEGD, unit: ["tbsp", 15], cook: { raw: "Stir Greek yogurt with lemon, chopped herbs, grated garlic and salt." } }),
  I({ id: "salsa", name: "Salsa", cat: "sauce", n: [36, 1.5, 7, 4, 0.2, 1.5], ok: VEGAN_GF, unit: ["tbsp", 16] }),
  I({ id: "avocado", name: "Avocado", cat: "sauce", n: [160, 2, 8.5, 0.7, 15, 6.7], ok: VEGAN_GF, unit: ["half", 70] }),
  I({ id: "feta", name: "Feta", cat: "sauce", n: [264, 14, 4, 4, 21, 0], ok: VEGD, unit: ["30 g", 30] }),
  I({ id: "parmesan", name: "Parmesan", cat: "sauce", n: [431, 38, 4, 0.9, 29, 0], ok: VEGD, unit: ["20 g", 20] }),
  I({ id: "hummus", name: "Hummus", cat: "sauce", n: [166, 8, 14, 0.3, 10, 6], ok: VEGAN_GF, unit: ["tbsp", 25] }),
  I({ id: "coconut-curry", name: "Coconut curry sauce", cat: "sauce", n: [120, 1.5, 6, 3, 10, 1], ok: VEGAN_GF, unit: ["ml", 1], cook: { curry: "Fry 2 tbsp curry paste in a little oil for 1 min until fragrant, then pour in the light coconut milk and simmer 5 min." } }),
  I({ id: "chimichurri", name: "Chimichurri", cat: "sauce", n: [420, 1, 4, 1, 45, 1], ok: VEGAN_GF, unit: ["tbsp", 15], cook: { raw: "Chop parsley and garlic fine; stir with olive oil, red-wine vinegar, oregano, chili and salt." } }),
  I({ id: "sriracha-lime", name: "Sriracha-lime", cat: "sauce", n: [60, 1, 12, 10, 0.5, 0.5], ok: VEGAN_GF, unit: ["tbsp", 15] }),
  I({ id: "tomato-sauce", name: "Tomato passata", cat: "sauce", n: [35, 1.5, 7, 4.5, 0.2, 1.5], ok: VEGAN_GF, unit: ["ml", 1], cook: { pasta: "Simmer the passata with garlic, a pinch of chili and salt for 10 min until it thickens." } }),
  I({ id: "peanut-butter", name: "Peanut butter", cat: "sauce", n: [588, 25, 20, 9, 50, 6], ok: VEGAN_GF, unit: ["tbsp", 16] }),
  I({ id: "cream-cheese", name: "Light cream cheese", cat: "sauce", n: [200, 7, 6, 4, 17, 0], ok: VEGD, unit: ["tbsp", 20] }),

  /* ── Fruit ── */
  I({ id: "banana", name: "Banana", cat: "fruit", n: [89, 1.1, 23, 12, 0.3, 2.6], ok: VEGAN_GF, unit: ["banana", 120] }),
  I({ id: "blueberries", name: "Blueberries", cat: "fruit", n: [57, 0.7, 14.5, 10, 0.3, 2.4], ok: VEGAN_GF }),
  I({ id: "strawberries", name: "Strawberries", cat: "fruit", n: [32, 0.7, 7.7, 4.9, 0.3, 2], ok: VEGAN_GF }),
  I({ id: "apple", name: "Apple", cat: "fruit", n: [52, 0.3, 14, 10, 0.2, 2.4], ok: VEGAN_GF, unit: ["apple", 180] }),
  I({ id: "mango", name: "Mango", cat: "fruit", n: [60, 0.8, 15, 14, 0.4, 1.6], ok: VEGAN_GF }),
  I({ id: "pineapple", name: "Pineapple", cat: "fruit", n: [50, 0.5, 13, 10, 0.1, 1.4], ok: VEGAN_GF }),
  I({ id: "kiwi", name: "Kiwi", cat: "fruit", n: [61, 1.1, 15, 9, 0.5, 3], ok: VEGAN_GF, unit: ["kiwi", 75] }),
  I({ id: "orange", name: "Orange", cat: "fruit", n: [47, 0.9, 12, 9, 0.1, 2.4], ok: VEGAN_GF, unit: ["orange", 150] }),
  I({ id: "raspberries", name: "Raspberries", cat: "fruit", n: [52, 1.2, 12, 4.4, 0.7, 6.5], ok: VEGAN_GF }),

  /* ── Dairy & extras ── */
  I({ id: "milk", name: "Milk 2%", cat: "dairy", n: [50, 3.4, 4.8, 4.8, 2, 0], ok: VEGD, unit: ["ml", 1] }),
  I({ id: "oat-milk", name: "Oat milk", cat: "dairy", n: [45, 1, 7, 4, 1.5, 0.8], ok: VEGAN_GF, unit: ["ml", 1] }),
  I({ id: "honey", name: "Honey", cat: "extra", n: [304, 0.3, 82, 82, 0, 0], ok: VEGD, unit: ["tsp", 7] }),
  I({ id: "maple", name: "Maple syrup", cat: "extra", n: [260, 0, 67, 60, 0, 0], ok: VEGAN_GF, unit: ["tsp", 7] }),
  I({ id: "chia", name: "Chia seeds", cat: "extra", n: [486, 17, 42, 0, 31, 34], ok: VEGAN_GF, unit: ["tbsp", 12] }),
  I({ id: "granola", name: "Granola", cat: "extra", n: [471, 10, 64, 20, 20, 7], ok: ["vegetarian", "vegan", "pescatarian", "lactose_free"] }),
  I({ id: "almonds", name: "Almonds", cat: "extra", n: [579, 21, 22, 4.4, 50, 12.5], ok: VEGAN_GF }),
  I({ id: "walnuts", name: "Walnuts", cat: "extra", n: [654, 15, 14, 2.6, 65, 6.7], ok: VEGAN_GF }),
  I({ id: "dark-chocolate", name: "Dark chocolate 70%", cat: "extra", n: [598, 7.8, 46, 24, 43, 11], ok: VEGAN_GF }),
  I({ id: "rice-cakes", name: "Rice cakes", cat: "carb", n: [387, 8, 82, 1, 3, 4], ok: VEGAN_GF, unit: ["cake", 9] }),
  I({ id: "cinnamon", name: "Cinnamon", cat: "extra", n: [247, 4, 81, 2, 1.2, 53], ok: VEGAN_GF, unit: ["tsp", 2.6] }),
];

export const ING: Record<string, Ingredient> = Object.fromEntries(INGREDIENTS.map((i) => [i.id, i]));
export const byCat = (cat: Cat) => INGREDIENTS.filter((i) => i.cat === cat);

/** Human measure for a gram amount of an ingredient. */
export function measure(i: Ingredient, grams: number) {
  if (i.unit) {
    const [label, g] = i.unit;
    if (label === "ml") return `${Math.round(grams / 10) * 10} ml`;
    const n = grams / g;
    const nice = n >= 1 ? (Math.round(n * 2) / 2).toString() : `${Math.round(n * 4) / 4}`;
    return `${nice} ${label}${n > 1.25 && !/g$/.test(label) ? "s" : ""}${label.endsWith("g") ? "" : ` (${Math.round(grams)} g)`}`;
  }
  if (i.dry) return `${Math.round(grams / i.dry / 5) * 5} g dry (≈${Math.round(grams / 10) * 10} g cooked)`;
  return `${Math.round(grams / 5) * 5} g`;
}
