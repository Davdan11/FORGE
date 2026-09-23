import type { Goal, Meal, MealSlot } from "../types";
import { ING, INGREDIENTS, measure, type Diet, type Ingredient, type Method } from "./ingredients";
import { MEALS as CURATED } from "../data/meals";

/* ─────────────────────────────────────────────────────────────
   RECIPE SYSTEM
   Thousands of coherent recipes generated from templates × real
   ingredients, with macros computed from the nutrition table and
   cooking steps assembled from each ingredient's method text.
   Every generated recipe has a stable id: g:<template>:<a>:<b>:<c>:<d>
   and is rebuilt on demand — nothing is stored.
   ───────────────────────────────────────────────────────────── */

type Slot = { cat: "protein" | "carb" | "veg" | "sauce" | "fruit" | "dairy" | "extra"; grams: number; only?: string[]; not?: string[]; method: Method; optional?: boolean };
interface Template {
  id: string;
  slot: MealSlot[];
  minutes: number;
  image: (ids: string[]) => string;
  name: (ing: Ingredient[]) => string;
  slots: Slot[];
  intro: string;
  finish: string;
  tip?: string;
  cuisine: string;
  /** Optional fixed extras added to every recipe of this template (id → grams). */
  fixed?: [string, number][];
}

/* Photo pools by dominant ingredient / template. Verified Unsplash ids. */
const P = (id: string) => `https://images.unsplash.com/photo-${id}?w=1000&h=700&fit=crop&q=75&auto=format`;
const PHOTOS: Record<string, string[]> = {
  chicken: ["1598515214211-89d3c73ae83b", "1555939594-58d7cb561ad1", "1546793665-c74683f339c1"],
  beef: ["1615937657715-bc7b4b7962c1", "1600891964092-4316c288032e", "1504674900247-0877df9cc836"],
  pork: ["1432139555190-58524dae6a55"],
  fish: ["1519708227418-c8fd9a32b7a2", "1467003909585-2f8a72700288", "1546069901-ba9599a7e63c"],
  shrimp: ["1559847844-5315695dadae"],
  tofu: ["1574484284002-952d92456975", "1512621776951-a57141f2eefd", "1490645935967-10de6ba17061"],
  beans: ["1547496502-affa22d38842", "1455619452474-d2be8b1e70cd", "1547592180-85f173990554"],
  cheese: ["1551504734-5ee1c4a1479b", "1604908176997-125f25cc6f3d"],
  eggs: ["1482049016688-2d3e1b311543", "1525351484163-7529414344d8", "1510693206972-df098062cb71"],
  salad: ["1505253716362-afaea1d3d1af", "1543339308-43e59d6b73a6", "1512621776951-a57141f2eefd"],
  stirfry: ["1540189549336-e6e99c3679fe"],
  pasta: ["1473093226795-af9932fe5856", "1529042410759-befb1204b468"],
  bowl: ["1546069901-ba9599a7e63c", "1547592180-85f173990554", "1516684732162-798a0062be99"],
  wrap: ["1547496502-affa22d38842", "1539252554453-80ab65ce3586"],
  oats: ["1447078806655-40579c2520d6", "1505576399279-565b52d4ac71"],
  yogurt: ["1517673400267-0251440c45dc", "1488477181946-6428a0291777", "1494597564530-871f2b93ac55"],
  smoothie: ["1502741224143-90386d7f8c82", "1495214783159-3503fd1b572d"],
  toast: ["1482049016688-2d3e1b311543", "1525351484163-7529414344d8"],
  snack: ["1498837167922-ddd27525d352", "1515543237350-b3eea1ec8082", "1490474418585-ba9bad8fd0ea"],
  pancakes: ["1506084868230-bb9d95c24759"],
};
const proteinPhoto = (id: string) => {
  const k = /chicken/.test(id) ? "chicken" : /beef|sirloin/.test(id) ? "beef" : /pork/.test(id) ? "pork" : /salmon|cod|tuna/.test(id) ? "fish" : /shrimp/.test(id) ? "shrimp" : /tofu|tempeh/.test(id) ? "tofu" : /chickpea|bean|lentil/.test(id) ? "beans" : /halloumi|paneer/.test(id) ? "cheese" : /egg/.test(id) ? "eggs" : "bowl";
  return PHOTOS[k];
};
const pick = (pool: string[], seed: string) => P(pool[[...seed].reduce((a, c) => a + c.charCodeAt(0), 0) % pool.length]);

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const low = (s: string) => s.toLowerCase();
const short = (i: Ingredient) => i.name.split(",")[0].replace(/\s\d+%$/, "").replace(/ fillet$/, "").replace(/, peeled$/, "");
const sauceName = (s: Ingredient) => low(s.name.replace(/ dressing| sauce| glaze/i, ""));

const MAIN_PROTEINS = ["chicken-breast", "chicken-thigh", "turkey-mince", "beef-mince", "sirloin", "pork-tenderloin", "salmon", "cod", "shrimp", "tofu", "tempeh", "chickpeas", "halloumi", "paneer"];
const ROAST_PROTEINS = ["chicken-breast", "chicken-thigh", "pork-tenderloin", "salmon", "cod", "tofu", "tempeh", "chickpeas", "halloumi", "paneer"];
const STIR_PROTEINS = ["chicken-breast", "beef-mince", "sirloin", "pork-tenderloin", "shrimp", "tofu", "tempeh", "turkey-mince"];
const CURRY_PROTEINS = ["chicken-breast", "chicken-thigh", "cod", "shrimp", "tofu", "tempeh", "chickpeas", "lentils", "paneer", "cauliflower"];
const SALAD_PROTEINS = ["chicken-breast", "sirloin", "salmon", "tuna", "shrimp", "eggs", "chickpeas", "lentils", "halloumi", "tofu"];
const WRAP_PROTEINS = ["chicken-breast", "turkey-mince", "beef-mince", "shrimp", "black-beans", "chickpeas", "tofu", "halloumi", "eggs"];
const PASTA_PROTEINS = ["chicken-breast", "turkey-mince", "beef-mince", "shrimp", "salmon", "tuna", "chickpeas", "tofu"];

const TEMPLATES: Template[] = [
  { id: "tray", slot: ["dinner", "lunch"], minutes: 35, cuisine: "Tray bake",
    image: (ids) => pick(proteinPhoto(ids[0]), ids.join()),
    name: ([p, c, v, s]) => `${cap(p.adj ? `${p.adj} ${low(short(p))}` : low(short(p)))} tray bake with ${low(short(c))}, ${low(short(v))} and ${sauceName(s)}`,
    slots: [{ cat: "protein", grams: 180, only: ROAST_PROTEINS, method: "roast" }, { cat: "carb", grams: 250, only: ["sweet-potato", "potatoes"], method: "roast" }, { cat: "veg", grams: 200, only: ["broccoli", "bell-pepper", "courgette", "asparagus", "cauliflower", "carrot", "green-beans", "red-onion", "mushrooms"], method: "roast" }, { cat: "sauce", grams: 20, only: ["olive-oil", "chimichurri", "yogurt-herb", "tahini-lemon", "pesto", "sriracha-lime"], method: "raw" }],
    intro: "Heat the oven to 220 °C and line a large tray.", finish: "Plate everything from the tray and finish with the sauce and a squeeze of lemon.", tip: "One tray, one wash-up. Double it and the second portion is tomorrow's lunch." },
  { id: "plate", slot: ["dinner", "lunch"], minutes: 25, cuisine: "Classic plate",
    image: (ids) => pick(proteinPhoto(ids[0]), ids.join()),
    name: ([p, c, v, s]) => `${cap(p.adj ? `${p.adj} ${low(short(p))}` : low(short(p)))} with ${low(short(c))}, ${low(short(v))} and ${sauceName(s)}`,
    slots: [{ cat: "protein", grams: 180, only: MAIN_PROTEINS, method: "pan" }, { cat: "carb", grams: 240, only: ["white-rice", "brown-rice", "quinoa", "potatoes", "sweet-potato", "couscous", "bulgur", "farro"], method: "boil" }, { cat: "veg", grams: 180, only: ["broccoli", "green-beans", "asparagus", "spinach", "kale", "cauliflower", "carrot"], method: "steam" }, { cat: "sauce", grams: 20, only: ["olive-oil", "chimichurri", "yogurt-herb", "tahini-lemon", "pesto", "salsa"], method: "raw" }],
    intro: "Get the carb going first — it takes the longest.", finish: "Plate the carb, the protein on top, greens on the side, sauce over everything." },
  { id: "stirfry", slot: ["dinner", "lunch"], minutes: 20, cuisine: "Stir-fry",
    image: (ids) => pick(PHOTOS.stirfry.concat(proteinPhoto(ids[0])), ids.join()),
    name: ([p, c, v, s]) => `${cap(low(short(p)))} and ${low(short(v))} stir-fry with ${low(short(c))} · ${sauceName(s)}`,
    slots: [{ cat: "protein", grams: 170, only: STIR_PROTEINS, method: "stirfry" }, { cat: "carb", grams: 220, only: ["white-rice", "brown-rice", "rice-noodles", "quinoa"], method: "boil" }, { cat: "veg", grams: 220, only: ["broccoli", "bell-pepper", "bok-choy", "green-beans", "mushrooms", "carrot", "asparagus", "red-cabbage", "edamame"], method: "stirfry" }, { cat: "sauce", grams: 30, only: ["soy-ginger", "peanut-sauce", "teriyaki", "sriracha-lime"], method: "raw" }],
    intro: "Prep everything before the heat goes on — a stir-fry is two minutes of cooking and ten of chopping. Get a wok or wide pan smoking hot.", finish: "Return the protein to the wok, pour in the sauce, toss 1 min until glossy. Serve over the carb with sesame and green onion.", tip: "The pan must be hotter than feels reasonable. Crowding it steams the protein gray — cook in batches." },
  { id: "bowl", slot: ["lunch", "dinner"], minutes: 20, cuisine: "Grain bowl",
    image: (ids) => pick(PHOTOS.bowl.concat(proteinPhoto(ids[0])), ids.join()),
    name: ([p, c, v, v2, s]) => `${cap(low(short(p)))} ${low(short(c))} bowl with ${low(short(v))}, ${low(short(v2))} and ${sauceName(s)}`,
    slots: [{ cat: "protein", grams: 160, only: MAIN_PROTEINS.concat(["eggs", "lentils", "black-beans"]), method: "pan" }, { cat: "carb", grams: 200, only: ["quinoa", "brown-rice", "farro", "bulgur", "couscous", "white-rice"], method: "boil" }, { cat: "veg", grams: 120, only: ["broccoli", "sweet-potato", "bell-pepper", "cauliflower", "carrot"], method: "roast" }, { cat: "veg", grams: 90, only: ["cucumber", "cherry-tomatoes", "red-cabbage", "leaves", "edamame", "red-onion", "kale"], method: "raw" }, { cat: "sauce", grams: 25, only: ["tahini-lemon", "yogurt-herb", "peanut-sauce", "hummus", "avocado", "chimichurri", "sriracha-lime"], method: "raw" }],
    intro: "Heat the oven to 220 °C for the roasted element and start the grain.", finish: "Build the bowl by color: grain, protein, roasted and raw veg side by side, sauce last. Lemon and salt to taste.", tip: "Cook the grain and roast the veg in double quantities — bowls are the easiest meal-prep there is." },
  { id: "salad", slot: ["lunch", "dinner"], minutes: 15, cuisine: "Salad",
    image: (ids) => pick(PHOTOS.salad.concat(proteinPhoto(ids[0])), ids.join()),
    name: ([p, v, v2, s]) => `${cap(low(short(p)))} salad with ${low(short(v))}, ${low(short(v2))} and ${sauceName(s)}`,
    slots: [{ cat: "protein", grams: 160, only: SALAD_PROTEINS, method: "pan" }, { cat: "veg", grams: 90, only: ["leaves", "kale", "spinach", "red-cabbage"], method: "raw" }, { cat: "veg", grams: 150, only: ["cherry-tomatoes", "cucumber", "bell-pepper", "carrot", "red-onion", "edamame", "asparagus"], method: "raw" }, { cat: "sauce", grams: 25, only: ["tahini-lemon", "yogurt-herb", "olive-oil", "chimichurri", "avocado", "feta", "parmesan"], method: "raw" }],
    intro: "Cook the protein first so it can rest while you chop.", finish: "Toss the vegetables with the dressing and salt, then lay the protein on top.", fixed: [["olive-oil", 7]] },
  { id: "wrap", slot: ["lunch"], minutes: 15, cuisine: "Wrap",
    image: (ids) => pick(PHOTOS.wrap.concat(proteinPhoto(ids[0])), ids.join()),
    name: ([p, c, v, s]) => `${cap(low(short(p)))} ${low(short(c)).replace("wholewheat ", "")}${c.id === "corn-tortilla" ? " tacos" : " wrap"} with ${low(short(v))} and ${sauceName(s)}`,
    slots: [{ cat: "protein", grams: 150, only: WRAP_PROTEINS, method: "pan" }, { cat: "carb", grams: 90, only: ["tortilla", "corn-tortilla"], method: "raw" }, { cat: "veg", grams: 120, only: ["red-cabbage", "leaves", "bell-pepper", "cucumber", "cherry-tomatoes", "red-onion"], method: "raw" }, { cat: "sauce", grams: 30, only: ["salsa", "yogurt-herb", "hummus", "avocado", "sriracha-lime", "tahini-lemon"], method: "raw" }],
    intro: "Cook the filling first; warm the wraps at the very end.", finish: "Spread the sauce, pile the filling and slaw down the middle, roll tight and halve." },
  { id: "curry", slot: ["dinner"], minutes: 30, cuisine: "Curry",
    image: (ids) => pick(["1574484284002-952d92456975", "1604908176997-125f25cc6f3d", "1559847844-5315695dadae"], ids.join()),
    name: ([p, v, c]) => `${cap(low(short(p)))} and ${low(short(v))} coconut curry with ${low(short(c))}`,
    slots: [{ cat: "protein", grams: 170, only: CURRY_PROTEINS, method: "curry" }, { cat: "veg", grams: 180, only: ["spinach", "cauliflower", "bell-pepper", "green-beans", "broccoli", "sweet-potato", "mushrooms"], method: "curry" }, { cat: "carb", grams: 220, only: ["white-rice", "brown-rice", "quinoa"], method: "boil" }],
    fixed: [["coconut-curry", 180], ["olive-oil", 7]],
    intro: "Start the rice. In a wide pan, fry 2 tbsp of curry paste in the oil for 1 min until it smells toasty.", finish: "Simmer until the sauce coats a spoon; lime juice, cilantro, salt to taste. Serve over the rice.", tip: "Light coconut milk keeps this under control; full-fat adds ~120 kcal per portion." },
  { id: "pasta", slot: ["dinner"], minutes: 25, cuisine: "Pasta",
    image: (ids) => pick(PHOTOS.pasta, ids.join()),
    name: ([p, v, s]) => `${cap(low(short(s)).replace(" basil", "").replace("tomato passata", "tomato"))} pasta with ${low(short(p))} and ${low(short(v))}`,
    slots: [{ cat: "protein", grams: 150, only: PASTA_PROTEINS, method: "pan" }, { cat: "veg", grams: 150, only: ["broccoli", "spinach", "cherry-tomatoes", "courgette", "mushrooms", "asparagus", "kale"], method: "pan" }, { cat: "sauce", grams: 40, only: ["pesto", "tomato-sauce"], method: "pasta" }],
    fixed: [["pasta", 200], ["parmesan", 15]],
    intro: "Bring a big pot of well-salted water to the boil.", finish: "Toss the pasta with the sauce, protein and vegetables plus a splash of pasta water until glossy. Parmesan, pepper, lemon zest.", tip: "The starchy pasta water is the sauce's best friend — never drain it all away." },

  /* Breakfasts */
  { id: "oats", slot: ["breakfast"], minutes: 8, cuisine: "Breakfast",
    image: (ids) => pick(PHOTOS.oats, ids.join()),
    name: ([f, x, d]) => `${cap(low(short(f)))} oats with ${low(short(x))} · ${low(short(d))}`,
    slots: [{ cat: "fruit", grams: 110, only: ["banana", "blueberries", "strawberries", "apple", "raspberries", "mango"], method: "raw" }, { cat: "extra", grams: 14, only: ["peanut-butter", "almonds", "chia", "walnuts", "honey", "maple", "dark-chocolate"], method: "raw" }, { cat: "dairy", grams: 250, only: ["milk", "oat-milk"], method: "raw" }],
    fixed: [["oats", 70], ["whey", 25]],
    intro: "Put the oats, milk, a pinch of salt and cinnamon in a small pot.", finish: "Take it off the heat, stir in the protein powder, then top with the fruit and the extra." },
  { id: "yogurt-bowl", slot: ["breakfast", "snack"], minutes: 3, cuisine: "Breakfast",
    image: (ids) => pick(PHOTOS.yogurt, ids.join()),
    name: ([p, f, x]) => `${cap(low(short(p)))} bowl with ${low(short(f))} and ${low(short(x))}`,
    slots: [{ cat: "protein", grams: 250, only: ["greek-yogurt", "cottage-cheese"], method: "raw" }, { cat: "fruit", grams: 120, only: ["blueberries", "strawberries", "banana", "mango", "kiwi", "pineapple", "raspberries"], method: "raw" }, { cat: "extra", grams: 25, only: ["granola", "almonds", "walnuts", "chia", "dark-chocolate", "honey"], method: "raw" }],
    intro: "", finish: "Spoon the yogurt into a bowl, fruit over it, the extra on top. Eat now." },
  { id: "eggs", slot: ["breakfast"], minutes: 10, cuisine: "Breakfast",
    image: (ids) => pick(PHOTOS.eggs, ids.join()),
    name: ([v, s]) => `Eggs on toast with ${low(short(v))} and ${sauceName(s)}`,
    slots: [{ cat: "veg", grams: 80, only: ["spinach", "cherry-tomatoes", "mushrooms", "kale", "asparagus"], method: "pan" }, { cat: "sauce", grams: 30, only: ["avocado", "feta", "salsa", "hummus", "pesto"], method: "raw" }],
    fixed: [["eggs", 150], ["bread", 80], ["olive-oil", 5]],
    intro: "Toast the bread. Heat a non-stick pan on medium-low with the oil.", finish: "Stack: toast, the vegetables, the eggs, the topping. Salt, pepper, chili flakes.", tip: "Low heat is the whole secret to eggs that aren't rubber." },
  { id: "smoothie", slot: ["breakfast", "snack", "post"], minutes: 3, cuisine: "Smoothie",
    image: (ids) => pick(PHOTOS.smoothie, ids.join()),
    name: ([f, f2, x]) => `${cap(low(short(f)))} and ${low(short(f2))} protein smoothie with ${low(short(x))}`,
    slots: [{ cat: "fruit", grams: 120, only: ["banana", "mango", "strawberries", "blueberries", "pineapple"], method: "raw" }, { cat: "fruit", grams: 80, only: ["blueberries", "raspberries", "strawberries", "kiwi", "orange"], method: "raw" }, { cat: "extra", grams: 15, only: ["peanut-butter", "chia", "almonds", "oats"], method: "raw" }],
    fixed: [["whey", 30], ["milk", 250]],
    intro: "", finish: "Blend everything 45 s until smooth. Add ice for thickness." },
  { id: "toast", slot: ["breakfast", "snack"], minutes: 5, cuisine: "Toast",
    image: (ids) => pick(PHOTOS.toast, ids.join()),
    name: ([s, f]) => `${cap(sauceName(s))} toast with ${low(short(f))}`,
    slots: [{ cat: "sauce", grams: 32, only: ["peanut-butter", "cream-cheese", "avocado", "hummus"], method: "raw" }, { cat: "fruit", grams: 80, only: ["banana", "strawberries", "blueberries", "apple", "raspberries"], method: "raw" }],
    fixed: [["bread", 80], ["cottage-cheese", 100]],
    intro: "Toast the bread.", finish: "Spread, top with the fruit, add the cottage cheese on the side for the protein. Cinnamon over everything." },

  /* Snacks · pre · post */
  { id: "snack-fruit-nuts", slot: ["snack", "pre"], minutes: 2, cuisine: "Snack",
    image: (ids) => pick(PHOTOS.snack, ids.join()),
    name: ([f, x]) => `${cap(low(short(f)))} and ${low(short(x))}`,
    slots: [{ cat: "fruit", grams: 150, only: ["apple", "banana", "orange", "kiwi", "strawberries", "blueberries"], method: "raw" }, { cat: "extra", grams: 25, only: ["almonds", "walnuts", "dark-chocolate", "peanut-butter"], method: "raw" }],
    intro: "", finish: "That's it. Pre-session: eat it 45–60 min before." },
  { id: "snack-protein", slot: ["snack", "post"], minutes: 2, cuisine: "Snack",
    image: (ids) => pick(PHOTOS.yogurt.concat(PHOTOS.snack), ids.join()),
    name: ([p, f]) => `${cap(low(short(p)))} with ${low(short(f))}`,
    slots: [{ cat: "protein", grams: 220, only: ["greek-yogurt", "cottage-cheese"], method: "raw" }, { cat: "fruit", grams: 120, only: ["pineapple", "blueberries", "mango", "strawberries", "raspberries", "banana"], method: "raw" }],
    intro: "", finish: "Mix. Highest protein-per-calorie snack there is. Post-session: within the hour." },
  { id: "snack-veg", slot: ["snack"], minutes: 3, cuisine: "Snack",
    image: (ids) => pick(PHOTOS.snack, ids.join()),
    name: ([s, v]) => `${cap(low(short(s)))} with ${low(short(v))}`,
    slots: [{ cat: "sauce", grams: 80, only: ["hummus", "yogurt-herb"], method: "raw" }, { cat: "veg", grams: 150, only: ["carrot", "cucumber", "bell-pepper", "edamame"], method: "raw" }],
    intro: "", finish: "Cut the vegetables into sticks. Dip." },
  { id: "rice-cakes", slot: ["pre", "snack"], minutes: 2, cuisine: "Pre-session",
    image: (ids) => pick(["1541544741938-0af808871cc0"], ids.join()),
    name: ([s, f]) => `Rice cakes with ${sauceName(s)} and ${low(short(f))}`,
    slots: [{ cat: "sauce", grams: 24, only: ["peanut-butter", "cream-cheese", "hummus"], method: "raw" }, { cat: "fruit", grams: 60, only: ["banana", "strawberries", "apple"], method: "raw" }],
    fixed: [["rice-cakes", 27]],
    intro: "", finish: "Spread, top, go. 45–60 min before a session — fast carbs, easy on the stomach." },
];

/* ── Enumeration ─────────────────────────────────────────────── */
function combos(t: Template): string[][] {
  const lists = t.slots.map((s) => INGREDIENTS.filter((i) => i.cat === s.cat && (!s.only || s.only.includes(i.id)) && !(s.not ?? []).includes(i.id)).map((i) => i.id));
  const out: string[][] = [];
  const rec = (k: number, acc: string[]) => {
    if (k === lists.length) { if (new Set(acc).size === acc.length) out.push(acc); return; }
    for (const id of lists[k]) rec(k + 1, [...acc, id]);
  };
  rec(0, []);
  return out;
}
let CATALOG_IDS: string[] | null = null;
let RANGES: { tid: string; slot: MealSlot[]; start: number; end: number }[] = [];
export function catalogIds(): string[] {
  if (!CATALOG_IDS) {
    const all: string[] = []; RANGES = [];
    for (const t of TEMPLATES) { const start = all.length; for (const c of combos(t)) all.push(`g:${t.id}:${c.join(":")}`); RANGES.push({ tid: t.id, slot: t.slot, start, end: all.length }); }
    CATALOG_IDS = all;
  }
  return CATALOG_IDS;
}
export const recipeCount = () => catalogIds().length + CURATED.length;
/** Sample n ids per template that serves the slot — keeps variety even when one template dominates. */
export function sampleIds(slot: MealSlot, perTemplate: number, rand: () => number): string[] {
  catalogIds();
  const out: string[] = [];
  for (const r of RANGES) {
    if (!r.slot.includes(slot)) continue;
    const size = r.end - r.start;
    for (let i = 0; i < Math.min(perTemplate, size); i++) out.push(CATALOG_IDS![r.start + Math.floor(rand() * size)]);
  }
  return out;
}

/* ── Build one recipe from its id ─────────────────────────────── */
const cache = new Map<string, Meal>();
export function buildRecipe(id: string): Meal | undefined {
  if (cache.has(id)) return cache.get(id);
  const [, tid, ...ids] = id.split(":");
  const t = TEMPLATES.find((x) => x.id === tid); if (!t || ids.length !== t.slots.length) return undefined;
  const ings = ids.map((i) => ING[i]); if (ings.some((i) => !i)) return undefined;
  const parts: { ing: Ingredient; grams: number; method: Method }[] = ings.map((ing, k) => ({ ing, grams: t.slots[k].grams, method: t.slots[k].method }));
  for (const [fid, g] of t.fixed ?? []) parts.push({ ing: ING[fid], grams: g, method: ING[fid].cook?.boil ? "boil" : ING[fid].cook?.pasta ? "pasta" : "raw" });

  // Macros
  const sum = [0, 0, 0, 0, 0, 0];
  for (const p of parts) for (let k = 0; k < 6; k++) sum[k] += (p.ing.n[k] * p.grams) / 100;
  const [kcal, protein, carbs, sugar, fat, fiber] = sum.map((v) => Math.round(v));

  // Diet tags = intersection of all ingredients' compatibilities
  const diets: Diet[] = ["vegetarian", "vegan", "pescatarian", "gluten_free", "lactose_free"];
  const tags: Meal["tags"] = diets.filter((d) => parts.every((p) => p.ing.ok.includes(d)));
  if (t.minutes <= 15) tags.push("quick");
  if (["tray", "curry", "bowl"].includes(t.id)) tags.push("batch");
  if (protein / Math.max(1, kcal) * 4 >= 0.3) tags.push("high_protein");
  if (carbs <= 30) tags.push("low_carb");
  if (sugar <= 10) tags.push("low_sugar");

  // Steps: intro → carbs (longest) → roast/pan protein → veg → sauce → finish
  const order: Method[] = ["boil", "roast", "pan", "grill", "stirfry", "curry", "steam", "pasta", "raw"];
  const lines: string[] = [];
  if (t.intro) lines.push(t.intro);
  for (const m of order) for (const p of parts) {
    if (p.method !== m) continue;
    const c = p.ing.cook?.[m] ?? (m === "raw" ? "" : p.ing.cook?.raw ?? "");
    if (c) lines.push(c);
  }
  // Sauce preparation for raw sauces with a recipe line
  for (const p of parts) if (p.ing.cat === "sauce" && p.method === "raw" && p.ing.cook?.raw) lines.push(p.ing.cook.raw);
  lines.push(t.finish);
  const steps = [...new Set(lines)].filter(Boolean);

  const meal: Meal = {
    id, name: t.name(ings), slot: t.slot, kcal, protein, carbs, sugar, fat, fiber, tags, minutes: t.minutes, image: t.image(ids), tip: t.tip, cuisine: t.cuisine, generated: true,
    ingredients: parts.map((p) => ({ item: p.ing.name, qty: measure(p.ing, p.grams) })),
    steps,
  };
  cache.set(id, meal);
  return meal;
}

/* ── Unified catalog API ─────────────────────────────────────── */
const CURATED_MAP: Record<string, Meal> = Object.fromEntries(CURATED.map((m) => [m.id, m]));
export function getMeal(id: string): Meal | undefined { return CURATED_MAP[id] ?? (id.startsWith("g:") ? buildRecipe(id) : undefined); }

export interface RecipeFilter { slot?: MealSlot; diets?: Diet[]; q?: string; maxKcal?: number; minProtein?: number; quick?: boolean; limit?: number; offset?: number }

/** Cheap pre-filter on ids (diet compatibility from ingredient flags) before building. */
function idPassesDiet(id: string, diets: Diet[]) {
  if (!diets.length) return true;
  if (!id.startsWith("g:")) { const m = CURATED_MAP[id]; return !!m && diets.every((d) => m.tags.includes(d) || (d === "vegetarian" && m.tags.includes("vegan")) || (d === "pescatarian" && (m.tags.includes("vegetarian") || m.tags.includes("vegan")))); }
  const [, tid, ...ids] = id.split(":");
  const t = TEMPLATES.find((x) => x.id === tid)!;
  const all = ids.concat((t.fixed ?? []).map(([f]) => f));
  return diets.every((d) => all.every((i) => ING[i].ok.includes(d)));
}

export function searchRecipes(f: RecipeFilter = {}): { total: number; items: Meal[] } {
  const diets = f.diets ?? [];
  const q = (f.q ?? "").trim().toLowerCase();
  const ids = [...CURATED.map((m) => m.id), ...catalogIds()].filter((id) => {
    if (!idPassesDiet(id, diets)) return false;
    if (f.slot) { if (id.startsWith("g:")) { const t = TEMPLATES.find((x) => x.id === id.split(":")[1])!; if (!t.slot.includes(f.slot)) return false; } else if (!CURATED_MAP[id].slot.includes(f.slot)) return false; }
    if (q) { const hay = id.startsWith("g:") ? id.slice(2).replace(/[:-]/g, " ") : CURATED_MAP[id].name.toLowerCase(); if (!q.split(/\s+/).every((w) => hay.includes(w))) return false; }
    return true;
  });
  // Macro filters need the built recipe; apply lazily while paging.
  const out: Meal[] = []; let seen = 0; const offset = f.offset ?? 0, limit = f.limit ?? 40;
  let total = 0;
  for (const id of ids) {
    const m = getMeal(id); if (!m) continue;
    if (f.maxKcal && m.kcal > f.maxKcal) continue;
    if (f.minProtein && m.protein < f.minProtein) continue;
    if (f.quick && !m.tags.includes("quick")) continue;
    total++;
    if (seen++ < offset) continue;
    if (out.length < limit) out.push(m);
  }
  return { total, items: out };
}

/** Goal fit score (lower is better) for choosing a recipe against a slot target. */
export function fitScore(m: Meal, target: { kcal: number; protein: number }, goal: Goal) {
  const scale = Math.max(0.6, Math.min(1.8, target.kcal / Math.max(1, m.kcal)));
  const kcalErr = Math.abs(m.kcal * scale - target.kcal) / target.kcal;
  const proteinErr = Math.max(0, target.protein - m.protein * scale) / target.protein;
  const pDensity = (m.protein * 4) / Math.max(1, m.kcal);
  const sugarPen = m.sugar / Math.max(1, m.kcal) * 4;
  let s = kcalErr * 1.2 + proteinErr * 1.5;
  if (goal === "cut") s += (0.35 - pDensity) * 1.2 + sugarPen * 0.8 + Math.abs(scale - 1) * 0.3;
  if (goal === "build" || goal === "strength") s += Math.max(0, 0.25 - pDensity) * 0.8 - Math.min(0.15, (m.carbs * 4) / Math.max(1, m.kcal)) * 0.3;
  if (goal === "endurance" || goal === "perform") s -= Math.min(0.5, (m.carbs * 4) / Math.max(1, m.kcal)) * 0.6;
  if (goal === "recomp") s += (0.3 - pDensity) * 0.8 + sugarPen * 0.4;
  return s;
}

export const TEMPLATE_NAMES = TEMPLATES.map((t) => ({ id: t.id, cuisine: t.cuisine }));
