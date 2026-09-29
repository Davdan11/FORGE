import type { Goal, Meal, MealSlot } from "../types";
import { ING, INGREDIENTS, fill, measureTok, type CookLine, type Diet, type Ingredient, type L, type Method } from "./ingredients";
import { MEALS as CURATED } from "../data/meals";
import { fold } from "./cookbook";

/* ─────────────────────────────────────────────────────────────
   RECIPE SYSTEM
   Thousands of coherent recipes generated from templates × real
   ingredients, with macros computed from the nutrition table and
   cooking steps written like a cookbook: preheat, mise en place with
   each ingredient's grams and cut, then a timed game plan so every
   element is ready at the same minute, doneness cues, plating, and
   portions/storage. French (Québec) and English, side by side.
   Every generated recipe has a stable id: g:<template>:<a>:<b>:<c>:<d>
   and is rebuilt on demand — nothing is stored.
   ───────────────────────────────────────────────────────────── */

type Slot = { cat: "protein" | "carb" | "veg" | "sauce" | "fruit" | "dairy" | "extra"; grams: number; only?: string[]; not?: string[]; method: Method; optional?: boolean };
type Part = { ing: Ingredient; grams: number; method: Method };
interface Template {
  id: string;
  slot: MealSlot[];
  minutes: number;
  image: (ids: string[]) => string;
  name: (ing: Ingredient[]) => string;
  nameFr: (ing: Ingredient[]) => string;
  slots: Slot[];
  tip?: L;
  cuisine: L;
  /** Fixed extras added to every recipe of this template: [id, grams, method]. */
  fixed?: [string, number, Method][];
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

/* ── Names ─────────────────────────────────────────────────────── */
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const low = (s: string) => s.toLowerCase();
const short = (i: Ingredient) => i.name.split(",")[0].replace(/\s\d+%$/, "").replace(/ fillet$/, "").replace(/, peeled$/, "");
const sauceName = (s: Ingredient) => low(s.name.replace(/ dressing| sauce| glaze/i, ""));
/** French title words: plain ("poulet") and qualified ("poulet citron-fines herbes"). */
const fr = (i: Ingredient) => i.title?.[0] ?? low(i.fr);
const frq = (i: Ingredient) => i.title?.[1] ?? fr(i);
/** "de" with elision: de poulet, d’asperges, d’huile. */
const de = (s: string) => (/^[aeiouyéèêàâîïôûœh]/i.test(s) && !/^(houmous|haricots|hauts)/i.test(s) ? `d’${s}` : `de ${s}`);

const MAIN_PROTEINS = ["chicken-breast", "chicken-thigh", "turkey-mince", "beef-mince", "sirloin", "pork-tenderloin", "salmon", "cod", "shrimp", "tofu", "tempeh", "chickpeas", "halloumi", "paneer"];
const ROAST_PROTEINS = ["chicken-breast", "chicken-thigh", "pork-tenderloin", "salmon", "cod", "tofu", "tempeh", "chickpeas", "halloumi", "paneer"];
const STIR_PROTEINS = ["chicken-breast", "beef-mince", "sirloin", "pork-tenderloin", "shrimp", "tofu", "tempeh", "turkey-mince"];
const CURRY_PROTEINS = ["chicken-breast", "chicken-thigh", "cod", "shrimp", "tofu", "tempeh", "chickpeas", "lentils", "paneer", "cauliflower"];
const SALAD_PROTEINS = ["chicken-breast", "sirloin", "salmon", "tuna", "shrimp", "eggs", "chickpeas", "lentils", "halloumi", "tofu"];
const WRAP_PROTEINS = ["chicken-breast", "turkey-mince", "beef-mince", "shrimp", "black-beans", "chickpeas", "tofu", "halloumi", "eggs"];
const PASTA_PROTEINS = ["chicken-breast", "turkey-mince", "beef-mince", "shrimp", "salmon", "tuna", "chickpeas", "tofu"];

const TEMPLATES: Template[] = [
  { id: "tray", slot: ["dinner", "lunch"], minutes: 35, cuisine: ["Plaque au four", "Tray bake"],
    image: (ids) => pick(proteinPhoto(ids[0]), ids.join()),
    name: ([p, c, v, s]) => `${cap(p.adj ? `${p.adj} ${low(short(p))}` : low(short(p)))} tray bake with ${low(short(c))}, ${low(short(v))} and ${sauceName(s)}`,
    nameFr: ([p, c, v, s]) => `Plaque ${de(frq(p))} avec ${fr(c)}, ${fr(v)} et ${fr(s)}`,
    slots: [{ cat: "protein", grams: 180, only: ROAST_PROTEINS, method: "roast" }, { cat: "carb", grams: 250, only: ["sweet-potato", "potatoes"], method: "roast" }, { cat: "veg", grams: 200, only: ["broccoli", "bell-pepper", "courgette", "asparagus", "cauliflower", "carrot", "green-beans", "red-onion", "mushrooms"], method: "roast" }, { cat: "sauce", grams: 20, only: ["olive-oil", "chimichurri", "yogurt-herb", "tahini-lemon", "pesto", "sriracha-lime"], method: "raw" }],
    tip: ["Une plaque, une vaisselle. Double tout : la deuxième portion, c’est ton dîner de demain.", "One tray, one wash-up. Double it and the second portion is tomorrow’s lunch."] },
  { id: "plate", slot: ["dinner", "lunch"], minutes: 25, cuisine: ["Assiette classique", "Classic plate"],
    image: (ids) => pick(proteinPhoto(ids[0]), ids.join()),
    name: ([p, c, v, s]) => `${cap(p.adj ? `${p.adj} ${low(short(p))}` : low(short(p)))} with ${low(short(c))}, ${low(short(v))} and ${sauceName(s)}`,
    nameFr: ([p, c, v, s]) => `${cap(frq(p))} avec ${fr(c)}, ${fr(v)} et ${fr(s)}`,
    slots: [{ cat: "protein", grams: 180, only: MAIN_PROTEINS, method: "pan" }, { cat: "carb", grams: 240, only: ["white-rice", "brown-rice", "quinoa", "potatoes", "sweet-potato", "couscous", "bulgur", "farro"], method: "boil" }, { cat: "veg", grams: 180, only: ["broccoli", "green-beans", "asparagus", "spinach", "kale", "cauliflower", "carrot"], method: "steam" }, { cat: "sauce", grams: 20, only: ["olive-oil", "chimichurri", "yogurt-herb", "tahini-lemon", "pesto", "salsa"], method: "raw" }] },
  { id: "stirfry", slot: ["dinner", "lunch"], minutes: 20, cuisine: ["Sauté", "Stir-fry"],
    image: (ids) => pick(PHOTOS.stirfry.concat(proteinPhoto(ids[0])), ids.join()),
    name: ([p, c, v, s]) => `${cap(low(short(p)))} and ${low(short(v))} stir-fry with ${low(short(c))} · ${sauceName(s)}`,
    nameFr: ([p, c, v, s]) => `Sauté ${de(fr(p))} et ${fr(v)} avec ${fr(c)} · ${fr(s)}`,
    slots: [{ cat: "protein", grams: 170, only: STIR_PROTEINS, method: "stirfry" }, { cat: "carb", grams: 220, only: ["white-rice", "brown-rice", "rice-noodles", "quinoa"], method: "boil" }, { cat: "veg", grams: 220, only: ["broccoli", "bell-pepper", "bok-choy", "green-beans", "mushrooms", "carrot", "asparagus", "red-cabbage", "edamame"], method: "stirfry" }, { cat: "sauce", grams: 30, only: ["soy-ginger", "peanut-sauce", "teriyaki", "sriracha-lime"], method: "raw" }],
    tip: ["Le wok doit être plus chaud que ce qui te semble raisonnable. Trop plein, il fait bouillir la viande au lieu de la saisir : cuis en deux fois au besoin.", "The pan must be hotter than feels reasonable. Crowding it steams the protein gray — cook in batches."] },
  { id: "bowl", slot: ["lunch", "dinner"], minutes: 20, cuisine: ["Bol de grains", "Grain bowl"],
    image: (ids) => pick(PHOTOS.bowl.concat(proteinPhoto(ids[0])), ids.join()),
    name: ([p, c, v, v2, s]) => `${cap(low(short(p)))} ${low(short(c))} bowl with ${low(short(v))}, ${low(short(v2))} and ${sauceName(s)}`,
    nameFr: ([p, c, v, v2, s]) => `Bol ${de(fr(c))} et ${fr(p)} avec ${fr(v)}, ${fr(v2)} et ${fr(s)}`,
    slots: [{ cat: "protein", grams: 160, only: MAIN_PROTEINS.concat(["eggs", "lentils", "black-beans"]), method: "pan" }, { cat: "carb", grams: 200, only: ["quinoa", "brown-rice", "farro", "bulgur", "couscous", "white-rice"], method: "boil" }, { cat: "veg", grams: 120, only: ["broccoli", "sweet-potato", "bell-pepper", "cauliflower", "carrot"], method: "roast" }, { cat: "veg", grams: 90, only: ["cucumber", "cherry-tomatoes", "red-cabbage", "leaves", "edamame", "red-onion", "kale"], method: "raw" }, { cat: "sauce", grams: 25, only: ["tahini-lemon", "yogurt-herb", "peanut-sauce", "hummus", "avocado", "chimichurri", "sriracha-lime"], method: "raw" }],
    tip: ["Cuis la céréale et rôtis les légumes en double : les bols sont le meal prep le plus simple qui soit.", "Cook the grain and roast the veg in double quantities — bowls are the easiest meal-prep there is."] },
  { id: "salad", slot: ["lunch", "dinner"], minutes: 15, cuisine: ["Salade", "Salad"],
    image: (ids) => pick(PHOTOS.salad.concat(proteinPhoto(ids[0])), ids.join()),
    name: ([p, v, v2, s]) => `${cap(low(short(p)))} salad with ${low(short(v))}, ${low(short(v2))} and ${sauceName(s)}`,
    nameFr: ([p, v, v2, s]) => `Salade ${de(fr(p))} avec ${fr(v)}, ${fr(v2)} et ${fr(s)}`,
    slots: [{ cat: "protein", grams: 160, only: SALAD_PROTEINS, method: "pan" }, { cat: "veg", grams: 90, only: ["leaves", "kale", "spinach", "red-cabbage"], method: "raw" }, { cat: "veg", grams: 150, only: ["cherry-tomatoes", "cucumber", "bell-pepper", "carrot", "red-onion", "edamame", "asparagus"], method: "raw" }, { cat: "sauce", grams: 25, only: ["tahini-lemon", "yogurt-herb", "olive-oil", "chimichurri", "avocado", "feta", "parmesan"], method: "raw" }],
    fixed: [["olive-oil", 7, "raw"]] },
  { id: "wrap", slot: ["lunch"], minutes: 15, cuisine: ["Wrap", "Wrap"],
    image: (ids) => pick(PHOTOS.wrap.concat(proteinPhoto(ids[0])), ids.join()),
    name: ([p, c, v, s]) => `${cap(low(short(p)))} ${low(short(c)).replace("wholewheat ", "")}${c.id === "corn-tortilla" ? " tacos" : " wrap"} with ${low(short(v))} and ${sauceName(s)}`,
    nameFr: ([p, c, v, s]) => `${c.id === "corn-tortilla" ? "Tacos" : "Wrap"} ${de(fr(p))} avec ${fr(v)} et ${fr(s)}`,
    slots: [{ cat: "protein", grams: 150, only: WRAP_PROTEINS, method: "pan" }, { cat: "carb", grams: 90, only: ["tortilla", "corn-tortilla"], method: "raw" }, { cat: "veg", grams: 120, only: ["red-cabbage", "leaves", "bell-pepper", "cucumber", "cherry-tomatoes", "red-onion"], method: "raw" }, { cat: "sauce", grams: 30, only: ["salsa", "yogurt-herb", "hummus", "avocado", "sriracha-lime", "tahini-lemon"], method: "raw" }] },
  { id: "curry", slot: ["dinner"], minutes: 30, cuisine: ["Cari", "Curry"],
    image: (ids) => pick(["1574484284002-952d92456975", "1604908176997-125f25cc6f3d", "1559847844-5315695dadae"], ids.join()),
    name: ([p, v, c]) => `${cap(low(short(p)))} and ${low(short(v))} coconut curry with ${low(short(c))}`,
    nameFr: ([p, v, c]) => `Cari ${de(fr(p))} et ${fr(v)} à la noix de coco avec ${fr(c)}`,
    slots: [{ cat: "protein", grams: 170, only: CURRY_PROTEINS, method: "curry" }, { cat: "veg", grams: 180, only: ["spinach", "cauliflower", "bell-pepper", "green-beans", "broccoli", "sweet-potato", "mushrooms"], method: "curry" }, { cat: "carb", grams: 220, only: ["white-rice", "brown-rice", "quinoa"], method: "boil" }],
    fixed: [["coconut-curry", 180, "curry"], ["olive-oil", 7, "curry"]],
    tip: ["Le lait de coco léger garde ce cari raisonnable; le lait de coco entier ajoute environ 120 kcal par portion.", "Light coconut milk keeps this under control; full-fat adds ~120 kcal per portion."] },
  { id: "pasta", slot: ["dinner"], minutes: 25, cuisine: ["Pâtes", "Pasta"],
    image: (ids) => pick(PHOTOS.pasta, ids.join()),
    name: ([p, v, s]) => `${cap(low(short(s)).replace(" basil", "").replace("tomato passata", "tomato"))} pasta with ${low(short(p))} and ${low(short(v))}`,
    nameFr: ([p, v, s]) => `${s.id === "pesto" ? "Pâtes au pesto" : "Pâtes sauce tomate"} avec ${fr(p)} et ${fr(v)}`,
    slots: [{ cat: "protein", grams: 150, only: PASTA_PROTEINS, method: "pan" }, { cat: "veg", grams: 150, only: ["broccoli", "spinach", "cherry-tomatoes", "courgette", "mushrooms", "asparagus", "kale"], method: "pan" }, { cat: "sauce", grams: 40, only: ["pesto", "tomato-sauce"], method: "pasta" }],
    fixed: [["pasta", 200, "boil"], ["parmesan", 15, "raw"]],
    tip: ["L’eau de cuisson des pâtes, pleine d’amidon, est la meilleure amie de la sauce : n’en jette jamais toute.", "The starchy pasta water is the sauce’s best friend — never drain it all away."] },

  /* Breakfasts */
  { id: "oats", slot: ["breakfast"], minutes: 8, cuisine: ["Déjeuner", "Breakfast"],
    image: (ids) => pick(PHOTOS.oats, ids.join()),
    name: ([f, x, d]) => `${cap(low(short(f)))} oats with ${low(short(x))} · ${low(short(d))}`,
    nameFr: ([f, x, d]) => `Gruau protéiné avec ${fr(f)} et ${fr(x)} · ${fr(d)}`,
    slots: [{ cat: "fruit", grams: 110, only: ["banana", "blueberries", "strawberries", "apple", "raspberries", "mango"], method: "raw" }, { cat: "extra", grams: 14, only: ["peanut-butter", "almonds", "chia", "walnuts", "honey", "maple", "dark-chocolate"], method: "raw" }, { cat: "dairy", grams: 250, only: ["milk", "oat-milk"], method: "raw" }],
    fixed: [["oats", 70, "boil"], ["whey", 25, "raw"]],
    tip: ["Fais cuire le gruau la veille et réchauffe-le avec un trait de lait : 90 secondes le matin.", "Cook the oats the night before and reheat with a splash of milk — 90 seconds in the morning."] },
  { id: "yogurt-bowl", slot: ["breakfast", "snack"], minutes: 3, cuisine: ["Déjeuner", "Breakfast"],
    image: (ids) => pick(PHOTOS.yogurt, ids.join()),
    name: ([p, f, x]) => `${cap(low(short(p)))} bowl with ${low(short(f))} and ${low(short(x))}`,
    nameFr: ([p, f, x]) => `Bol ${de(fr(p))} avec ${fr(f)} et ${fr(x)}`,
    slots: [{ cat: "protein", grams: 250, only: ["greek-yogurt", "cottage-cheese"], method: "raw" }, { cat: "fruit", grams: 120, only: ["blueberries", "strawberries", "banana", "mango", "kiwi", "pineapple", "raspberries"], method: "raw" }, { cat: "extra", grams: 25, only: ["granola", "almonds", "walnuts", "chia", "dark-chocolate", "honey"], method: "raw" }] },
  { id: "eggs", slot: ["breakfast"], minutes: 10, cuisine: ["Déjeuner", "Breakfast"],
    image: (ids) => pick(PHOTOS.eggs, ids.join()),
    name: ([v, s]) => `Eggs on toast with ${low(short(v))} and ${sauceName(s)}`,
    nameFr: ([v, s]) => `Œufs sur rôties avec ${fr(v)} et ${fr(s)}`,
    slots: [{ cat: "veg", grams: 80, only: ["spinach", "cherry-tomatoes", "mushrooms", "kale", "asparagus"], method: "pan" }, { cat: "sauce", grams: 30, only: ["avocado", "feta", "salsa", "hummus", "pesto"], method: "raw" }],
    fixed: [["eggs", 150, "pan"], ["bread", 80, "raw"], ["olive-oil", 5, "pan"]],
    tip: ["Le feu doux, c’est tout le secret d’œufs qui ne goûtent pas le caoutchouc.", "Low heat is the whole secret to eggs that aren’t rubber."] },
  { id: "smoothie", slot: ["breakfast", "snack", "post"], minutes: 3, cuisine: ["Smoothie", "Smoothie"],
    image: (ids) => pick(PHOTOS.smoothie, ids.join()),
    name: ([f, f2, x]) => `${cap(low(short(f)))} and ${low(short(f2))} protein smoothie with ${low(short(x))}`,
    nameFr: ([f, f2, x]) => `Smoothie protéiné ${fr(f)} et ${fr(f2)} avec ${fr(x)}`,
    slots: [{ cat: "fruit", grams: 120, only: ["banana", "mango", "strawberries", "blueberries", "pineapple"], method: "raw" }, { cat: "fruit", grams: 80, only: ["blueberries", "raspberries", "strawberries", "kiwi", "orange"], method: "raw" }, { cat: "extra", grams: 15, only: ["peanut-butter", "chia", "almonds", "oats"], method: "raw" }],
    fixed: [["whey", 30, "raw"], ["milk", 250, "raw"]] },
  { id: "toast", slot: ["breakfast", "snack"], minutes: 5, cuisine: ["Rôtie", "Toast"],
    image: (ids) => pick(PHOTOS.toast, ids.join()),
    name: ([s, f]) => `${cap(sauceName(s))} toast with ${low(short(f))}`,
    nameFr: ([s, f]) => `Rôties au ${fr(s)} avec ${fr(f)}`.replace("au avocat", "à l’avocat"),
    slots: [{ cat: "sauce", grams: 32, only: ["peanut-butter", "cream-cheese", "avocado", "hummus"], method: "raw" }, { cat: "fruit", grams: 80, only: ["banana", "strawberries", "blueberries", "apple", "raspberries"], method: "raw" }],
    fixed: [["bread", 80, "raw"], ["cottage-cheese", 100, "raw"]] },

  /* Snacks · pre · post */
  { id: "snack-fruit-nuts", slot: ["snack", "pre"], minutes: 2, cuisine: ["Collation", "Snack"],
    image: (ids) => pick(PHOTOS.snack, ids.join()),
    name: ([f, x]) => `${cap(low(short(f)))} and ${low(short(x))}`,
    nameFr: ([f, x]) => `${cap(fr(f))} et ${fr(x)}`,
    slots: [{ cat: "fruit", grams: 150, only: ["apple", "banana", "orange", "kiwi", "strawberries", "blueberries"], method: "raw" }, { cat: "extra", grams: 25, only: ["almonds", "walnuts", "dark-chocolate", "peanut-butter"], method: "raw" }] },
  { id: "snack-protein", slot: ["snack", "post"], minutes: 2, cuisine: ["Collation", "Snack"],
    image: (ids) => pick(PHOTOS.yogurt.concat(PHOTOS.snack), ids.join()),
    name: ([p, f]) => `${cap(low(short(p)))} with ${low(short(f))}`,
    nameFr: ([p, f]) => `${cap(fr(p))} avec ${fr(f)}`,
    slots: [{ cat: "protein", grams: 220, only: ["greek-yogurt", "cottage-cheese"], method: "raw" }, { cat: "fruit", grams: 120, only: ["pineapple", "blueberries", "mango", "strawberries", "raspberries", "banana"], method: "raw" }] },
  { id: "snack-veg", slot: ["snack"], minutes: 3, cuisine: ["Collation", "Snack"],
    image: (ids) => pick(PHOTOS.snack, ids.join()),
    name: ([s, v]) => `${cap(low(short(s)))} with ${low(short(v))}`,
    nameFr: ([s, v]) => `${cap(fr(s))} avec ${fr(v)}`,
    slots: [{ cat: "sauce", grams: 80, only: ["hummus", "yogurt-herb"], method: "raw" }, { cat: "veg", grams: 150, only: ["carrot", "cucumber", "bell-pepper", "edamame"], method: "raw" }] },
  { id: "rice-cakes", slot: ["pre", "snack"], minutes: 2, cuisine: ["Avant l’entraînement", "Pre-session"],
    image: (ids) => pick(["1541544741938-0af808871cc0"], ids.join()),
    name: ([s, f]) => `Rice cakes with ${sauceName(s)} and ${low(short(f))}`,
    nameFr: ([s, f]) => `Galettes de riz avec ${fr(s)} et ${fr(f)}`,
    slots: [{ cat: "sauce", grams: 24, only: ["peanut-butter", "cream-cheese", "hummus"], method: "raw" }, { cat: "fruit", grams: 60, only: ["banana", "strawberries", "apple"], method: "raw" }],
    fixed: [["rice-cakes", 27, "raw"]] },
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

/* ── Cookbook steps ───────────────────────────────────────────────
   A recipe is written as: preheat → mise en place (grams + cut for
   every ingredient) → sauce → a timed game plan → plating. The game
   plan runs "lanes" in parallel (a pot of grain, the oven, the pan);
   each lane is a list of actions, each lasting d minutes before the
   lane's next action. Lanes are started so they all finish at the
   same minute; the steps are then read in clock order, each marked
   with its minute, and the cook-mode timer on a step counts down to
   the next action. */
type Sub = { d: number; txt: L };
type Step = { txt: L; sec: number | null };

const fillL = (l: L, p: Part): L => [fill(l[0], p.ing, p.grams), fill(l[1], p.ing, p.grams)];
const joinL = (ls: L[], sep = " "): L => [ls.map((l) => l[0]).join(sep), ls.map((l) => l[1]).join(sep)];
const lowFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

function prepOf(p: Part): L | undefined {
  const pr = p.ing.prep?.[p.method] ?? p.ing.prep?._;
  return pr && pr[0] ? fillL(pr, p) : undefined;
}
function cookOf(p: Part, m: Method = p.method): (CookLine & { txt: L }) | undefined {
  const c = p.ing.cook?.[m];
  return c ? { ...c, txt: fillL(c.txt, p) } : undefined;
}
const sub = (p: Part, m?: Method): Sub[] => { const c = cookOf(p, m); return c ? [{ d: c.t, txt: c.txt }] : []; };

/** Several things in one oven or one simmering sauce: longest first, each added so all finish together. */
function stagger(items: { t: number; txt: L }[]): Sub[] {
  const s = [...items].sort((a, b) => b.t - a.t);
  return s.map((x, i) => ({ d: i < s.length - 1 ? x.t - s[i + 1].t : x.t, txt: x.txt }));
}

/** Run lanes in parallel so they all end together; returns steps in clock order with timers. */
function schedule(lanes: Sub[][]): { steps: Step[]; end: number } {
  const live = lanes.filter((l) => l.length);
  const tot = live.map((l) => l.reduce((a, s) => a + s.d, 0));
  const end = Math.max(0, ...tot);
  const items: { at: number; txt: L }[] = [];
  live.forEach((l, k) => { let at = end - tot[k]; for (const s of l) { items.push({ at, txt: s.txt }); at += s.d; } });
  items.sort((a, b) => a.at - b.at);
  const groups: { at: number; txt: L[] }[] = [];
  for (const it of items) { const g = groups[groups.length - 1]; if (g && g.at === it.at) g.txt.push(it.txt); else groups.push({ at: it.at, txt: [it.txt] }); }
  const marked = groups.length > 1;
  const steps = groups.map((g, i) => {
    const next = groups[i + 1]?.at ?? end;
    const txt = joinL(g.txt);
    return { txt: (marked ? [`Minute ${g.at} — ${txt[0]}`, `Minute ${g.at} — ${txt[1]}`] : txt) as L, sec: next - g.at > 0 ? (next - g.at) * 60 : null };
  });
  return { steps, end };
}

const PREHEAT: L = ["Préchauffe le four à 220 °C, grille au centre, et tapisse une grande plaque de papier parchemin.", "Preheat the oven to 220 °C with a rack in the middle, and line a large sheet pan with parchment paper."];

/** Mise en place: every ingredient's grams and cut, in one step. */
function misePlace(parts: Part[]): Step | undefined {
  const lines = parts.map(prepOf).filter((x): x is L => !!x);
  if (!lines.length) return undefined;
  const [f, e] = joinL(lines);
  return { txt: [`Mise en place : ${lowFirst(f)}`, `Prep: ${lowFirst(e)}`], sec: null };
}
const once = (txt: L, sec: number | null = null): Step => ({ txt, sec });

/** "{g:20} de chimichurri" / "{g:20} chimichurri". */
const amount = (p: Part): L => {
  const tok = p.ing.unit?.[0] === "ml" ? `{ml:${p.grams}}` : `{g:${p.grams}}`;
  return [`${tok} ${de(low(p.ing.fr))}`, `${tok} ${low(p.ing.name)}`];
};
const nm = (p: Part): L => [fr(p.ing), low(short(p.ing))];

function buildSteps(t: Template, parts: Part[]): { steps: Step[]; end: number } {
  const by = (pred: (p: Part) => boolean) => parts.filter(pred);
  const P0 = parts.slice(0, t.slots.length);                       // the combo, in slot order
  const sauces = by((p) => p.ing.cat === "sauce" && p.method === "raw");
  const sauceStep = sauces.length ? once(joinL(sauces.map(prepOf).filter((x): x is L => !!x))) : undefined;
  const miseParts = by((p) => !(p.ing.cat === "sauce" && p.method === "raw"));
  const hasOven = parts.some((p) => p.method === "roast");
  const pre: Step[] = [];
  if (hasOven) pre.push(once(PREHEAT));
  const mise = misePlace(miseParts); if (mise) pre.push(mise);
  if (sauceStep && sauceStep.txt[0]) pre.push(sauceStep);

  const oven = stagger(by((p) => p.method === "roast").map((p) => cookOf(p)!).filter(Boolean));
  const pots = by((p) => p.method === "boil" || p.method === "steam").map((p) => sub(p));
  let lanes: Sub[][] = [];
  let finish: L;
  let finishSec: number | null = null;

  switch (t.id) {
    case "tray": {
      const [p, c, v, s] = P0;
      lanes = [oven];
      finish = [`Sors la plaque et laisse reposer la protéine 3 min. Dresse dans l’assiette : ${fr(c.ing)}, ${fr(v.ing)} et ${fr(p.ing)}. Nappe de ${amount(s)[0]} et presse ¼ de citron par-dessus.`,
        `Take the tray out and rest the ${nm(p)[1]} 3 min. Plate the ${nm(c)[1]}, ${nm(v)[1]} and ${nm(p)[1]}, spoon ${amount(s)[1]} over the top and squeeze ¼ lemon over it.`];
      break;
    }
    case "plate": {
      const [p, c, v, s] = P0;
      lanes = [...pots, sub(p)];
      finish = [`Dresse dans l’assiette : ${fr(c.ing)}, puis ${fr(p.ing)} par-dessus et ${fr(v.ing)} à côté. Nappe de ${amount(s)[0]}.`,
        `Plate it: the ${nm(c)[1]}, then the ${nm(p)[1]} on top and the ${nm(v)[1]} alongside. Spoon ${amount(s)[1]} over everything.`];
      break;
    }
    case "stirfry": {
      const [p, c, v, s] = P0;
      const toss: Sub = { d: 1, txt: [`Remets la protéine dans le wok avec les légumes, verse ${amount(s)[0]} et fais sauter 1 min à feu vif, jusqu’à ce que tout soit luisant et bien enrobé.`,
        `Return the ${nm(p)[1]} to the wok with the vegetables, pour in ${amount(s)[1]} and toss 1 min over high heat, until glossy and coated.`] };
      lanes = [...pots, [...sub(p), ...sub(v), toss]];
      finish = [`Sers sur un lit ${de(fr(c.ing))} et garnis d’oignon vert tranché.`, `Serve over the ${nm(c)[1]}, topped with sliced green onion.`];
      break;
    }
    case "bowl": {
      const [p, c, v, v2, s] = P0;
      lanes = [...pots, oven, ...(p.method === "boil" || p.method === "steam" ? [] : [sub(p)])];
      finish = [`Monte le bol : ${fr(c.ing)} au fond, puis ${fr(p.ing)}, ${fr(v.ing)} et ${fr(v2.ing)} côte à côte. Nappe de ${amount(s)[0]}, ajoute une pincée de sel et un filet de citron.`,
        `Build the bowl: ${nm(c)[1]} on the bottom, then the ${nm(p)[1]}, ${nm(v)[1]} and ${nm(v2)[1]} side by side. Top with ${amount(s)[1]}, a pinch of salt and a squeeze of lemon.`];
      break;
    }
    case "salad": {
      const [p, v, v2, s] = P0;
      lanes = [sub(p)];
      finish = [`Dans un grand bol, mélange les légumes (${fr(v.ing)} et ${fr(v2.ing)}) avec l’huile d’olive, le jus de citron et le sel, puis ajoute ${amount(s)[0]}. Dépose la protéine (${fr(p.ing)}) par-dessus et sers aussitôt.`,
        `In a large bowl, toss the ${nm(v)[1]} and ${nm(v2)[1]} with the olive oil, lemon juice and salt, then add ${amount(s)[1]}. Lay the ${nm(p)[1]} on top and serve right away.`];
      break;
    }
    case "wrap": {
      const [p, c, v, s] = P0;
      lanes = [[...sub(p), ...sub(c)]];
      finish = c.ing.id === "corn-tortilla"
        ? [`Garnis chaque tortilla de ${amount(s)[0]} (réparti), puis de la garniture (${fr(p.ing)} et ${fr(v.ing)}); plie en deux et mange aussitôt.`,
          `Top each tortilla with ${amount(s)[1]} (divided), the ${nm(p)[1]} and the ${nm(v)[1]}; fold and eat right away.`]
        : [`Étale ${amount(s)[0]} au centre des tortillas, ajoute la garniture (${fr(p.ing)} et ${fr(v.ing)}), replie les côtés et roule bien serré. Coupe en deux en biais.`,
          `Spread ${amount(s)[1]} down the middle of the tortillas, add the ${nm(p)[1]} and ${nm(v)[1]}, fold in the sides and roll up tight. Halve on the diagonal.`];
      break;
    }
    case "curry": {
      const [p, v, c] = P0;
      const coco = parts.find((x) => x.ing.id === "coconut-curry")!, oil = parts.find((x) => x.ing.id === "olive-oil")!;
      const cp = cookOf(p)!, cv = cookOf(v)!;
      const chain: Sub[] = [...sub(oil)];
      if (cp.brown) chain.push({ d: 3, txt: cp.txt });
      chain.push(...sub(coco));
      const simmer = [cv, ...(cp.brown ? [] : [cp])];
      const T = Math.max(cp.t, ...simmer.map((x) => x.t));
      const first = Math.max(...simmer.map((x) => x.t));
      if (T > first) chain.push({ d: T - first, txt: [`Baisse à feu moyen-doux et laisse mijoter la sauce ${T - first} min.`, `Turn to medium-low and let the sauce simmer ${T - first} min.`] });
      chain.push(...stagger(simmer));
      lanes = [...pots, chain];
      finish = [`Goûte et rectifie : le jus de ½ lime, {tsp:0.25} de sel au besoin et une poignée de coriandre fraîche. Sers sur un lit ${de(fr(c.ing))}.`,
        `Taste and adjust: the juice of ½ lime, {tsp:0.25} salt if needed and a handful of cilantro. Serve over the ${nm(c)[1]}.`];
      break;
    }
    case "pasta": {
      const [p, v, s] = P0;
      const pasta = parts.find((x) => x.ing.id === "pasta")!, parm = parts.find((x) => x.ing.id === "parmesan")!;
      const water: Sub = { d: 10, txt: ["Porte 3 L d’eau à ébullition dans une grande casserole, à couvert, avec 1 c. à soupe de sel.", "Bring 3 L water to a boil in a large covered pot with 1 tbsp salt."] };
      const aside: Sub = { d: 0, txt: ["Transfère la protéine dans une assiette et essuie la poêle.", "Move the protein to a plate and wipe out the skillet."] };
      lanes = [[water, ...sub(pasta)], [...sub(p), ...(sub(p).length ? [aside] : []), ...sub(v)], sub(s)];
      finish = [`Remets les pâtes égouttées dans la casserole avec ${amount(s)[0]}, la protéine, les légumes et 60 ml de l’eau de cuisson réservée; mélange 1 min à feu doux, jusqu’à ce que la sauce enrobe bien. Sers avec ${amount(parm)[0]}, du poivre noir et le zeste de ½ citron.`,
        `Return the drained pasta to the pot with ${amount(s)[1]}, the ${nm(p)[1]}, the ${nm(v)[1]} and 60 ml of the saved pasta water; toss 1 min over low heat until the sauce coats it. Serve with ${amount(parm)[1]}, black pepper and the zest of ½ lemon.`];
      break;
    }
    case "oats": {
      const [f, x, d] = P0;
      const oats = parts.find((z) => z.ing.id === "oats")!, whey = parts.find((z) => z.ing.id === "whey")!;
      lanes = [[{ d: sub(oats)[0].d, txt: [sub(oats)[0].txt[0].replace("avec le lait", `avec ${amount(d)[0]}`), sub(oats)[0].txt[1].replace("with the milk", `with ${amount(d)[1]}`)] }]];
      finish = [`Retire du feu, attends 30 s, puis incorpore ${amount(whey)[0]} (hors du feu, sinon elle fait des grumeaux). Garnis ${de(fr(f.ing))} et ${de(fr(x.ing))}.`,
        `Take it off the heat, wait 30 s, then stir in ${amount(whey)[1]} (off the heat or it clumps). Top with the ${nm(f)[1]} and ${nm(x)[1]}.`];
      break;
    }
    case "yogurt-bowl": {
      const [p, f, x] = P0;
      finish = [`Verse le ${fr(p.ing)} dans un bol et garnis ${de(fr(f.ing))}, puis ${de(fr(x.ing))}. Mange tout de suite.`, `Spoon the ${nm(p)[1]} into a bowl, add the ${nm(f)[1]}, then the ${nm(x)[1]} on top. Eat right away.`];
      break;
    }
    case "eggs": {
      const [v, s] = P0;
      const eggs = parts.find((z) => z.ing.id === "eggs")!, bread = parts.find((z) => z.ing.id === "bread")!, oil = parts.find((z) => z.ing.id === "olive-oil")!;
      lanes = [[...sub(oil), ...sub(v), { d: 1, txt: ["Glisse les légumes sur le côté de la poêle (ou dans une assiette).", "Push the vegetables to one side of the pan (or onto a plate)."] }, ...sub(eggs)], sub(bread)];
      finish = [`Monte : les rôties, les légumes (${fr(v.ing)}), les œufs, puis ${amount(s)[0]}. Poivre et une pincée de flocons de piment.`,
        `Stack it: toast, the ${nm(v)[1]}, the eggs, then ${amount(s)[1]}. Black pepper and a pinch of chili flakes.`];
      void bread;
      break;
    }
    case "smoothie": {
      const [f, f2, x] = P0;
      const milk = parts.find((z) => z.ing.id === "milk")!, whey = parts.find((z) => z.ing.id === "whey")!;
      finish = [`Verse ${amount(milk)[0]} dans le mélangeur, puis ajoute ${amount(whey)[0]} et les fruits et garnitures préparés (${fr(f.ing)}, ${fr(f2.ing)}, ${fr(x.ing)}). Mélange 45 s à haute vitesse, jusqu’à ce que ce soit lisse; ajoute 3–4 glaçons pour l’épaissir.`,
        `Pour ${amount(milk)[1]} into the blender, then add ${amount(whey)[1]}, the ${nm(f)[1]}, ${nm(f2)[1]} and ${nm(x)[1]}. Blend 45 s on high until smooth; add 3–4 ice cubes to thicken.`];
      finishSec = 45;
      break;
    }
    case "toast": {
      const [s, f] = P0;
      const bread = parts.find((z) => z.ing.id === "bread")!;
      lanes = [sub(bread)];
      finish = [`Tartine ${amount(s)[0]} sur les rôties chaudes, garnis ${de(fr(f.ing))} et saupoudre d’une pincée de cannelle. Sers le fromage cottage à côté pour les protéines.`,
        `Spread ${amount(s)[1]} on the hot toast, top with the ${nm(f)[1]} and a pinch of cinnamon. Serve the cottage cheese on the side for the protein.`];
      break;
    }
    case "snack-fruit-nuts":
      finish = ["C’est prêt. Avant l’entraînement : mange-la 45 à 60 minutes avant.", "That’s it. Before a session: eat it 45–60 minutes before."];
      break;
    case "snack-protein":
      finish = ["Mélange dans un bol. La collation la plus riche en protéines par calorie qui soit. Après l’entraînement : dans l’heure qui suit.", "Mix in a bowl. The highest protein-per-calorie snack there is. After a session: within the hour."];
      break;
    case "snack-veg":
      finish = ["Sers les légumes avec la trempette à côté.", "Serve the vegetables with the dip on the side."];
      break;
    default: // rice-cakes
      finish = ["Tartine les galettes, garnis de fruits et c’est parti. De 45 à 60 minutes avant l’entraînement : des glucides rapides, faciles à digérer.", "Spread, top, go. 45–60 minutes before a session — fast carbs, easy on the stomach."];
  }

  const plan = schedule(lanes);
  return { steps: [...pre, ...plan.steps, once(finish, finishSec)], end: plan.end + (hasOven ? 10 : plan.end ? 5 : 0) };
}

/** Portions, fridge life and reheating. */
function storageFor(t: Template, parts: Part[]): L {
  // Fridge life follows the protein and the starch; a cooked vegetable keeps as long as the dish.
  const days = Math.min(4, ...parts.filter((p) => p.ing.keep && (p.ing.cat === "protein" || p.ing.cat === "carb")).map((p) => p.ing.keep!));
  const fish = parts.some((p) => /salmon|cod|shrimp|tuna/.test(p.ing.id));
  switch (t.id) {
    case "tray": case "plate": case "bowl": case "stirfry": case "curry": case "pasta":
      return [`Donne 1 portion. Se conserve ${days} jours au frigo dans un contenant hermétique (garde la sauce à part). Réchauffe à couvert au micro-ondes 2 à 3 minutes, jusqu’à ce que ce soit fumant au centre (74 °C)${t.id === "pasta" ? ", avec un trait d’eau" : ""}${fish ? "; le poisson se mange aussi froid" : ""}.${t.id === "curry" ? " La sauce se congèle 3 mois." : ""}`,
        `Makes 1 portion. Keeps ${days} days in an airtight container in the fridge (sauce on the side). Reheat covered in the microwave for 2–3 minutes, until steaming in the center (74 °C)${t.id === "pasta" ? ", with a splash of water" : ""}${fish ? "; the fish is also good cold" : ""}.${t.id === "curry" ? " The sauce freezes for 3 months." : ""}`];
    case "salad":
      return [`Donne 1 portion. Meilleure tout de suite; sinon, garde la protéine, les légumes et la vinaigrette séparés au frigo jusqu’à ${days} jours et assemble au moment de manger.`,
        `Makes 1 portion. Best right away; otherwise keep the protein, vegetables and dressing separate in the fridge for up to ${days} days and assemble when you eat.`];
    case "wrap":
      return [`Donne 1 portion. À manger dès que c’est assemblé; la garniture cuite se garde ${days} jours au frigo — assemble à la dernière minute pour que la tortilla ne ramollisse pas.`,
        `Makes 1 portion. Eat as soon as it’s assembled; the cooked filling keeps ${days} days in the fridge — assemble at the last minute so the tortilla doesn’t go soggy.`];
    case "oats":
      return ["Donne 1 portion. Se conserve 3 jours au frigo (sans la protéine ni les garnitures); réchauffe 1 à 2 minutes au micro-ondes avec 2 c. à soupe de lait, puis ajoute la protéine hors du feu.",
        "Makes 1 portion. Keeps 3 days in the fridge (without the protein or toppings); reheat 1–2 minutes in the microwave with 2 tbsp milk, then stir in the protein off the heat."];
    case "eggs":
      return ["Donne 1 portion. À manger tout de suite : réchauffés, les œufs deviennent caoutchouteux.", "Makes 1 portion. Eat right away — reheated eggs turn rubbery."];
    case "smoothie":
      return ["Donne 1 portion (environ 500 ml). Meilleur tout de suite; se garde 24 h au frigo dans un pot fermé — secoue avant de boire.", "Makes 1 portion (about 500 ml). Best right away; keeps 24 h in the fridge in a sealed jar — shake before drinking."];
    default:
      return ["Donne 1 portion. À préparer au moment de manger.", "Makes 1 portion. Put it together when you eat."];
  }
}

/* ── Build one recipe from its id ─────────────────────────────── */
/** Method actually used for an ingredient in a template (a salad boils its eggs; tuna stays as is). */
function methodFor(t: Template, slot: Slot, ing: Ingredient): Method {
  if ((t.id === "salad" || t.id === "bowl") && ing.id === "eggs") return "boil";
  if (t.id === "salad" && ing.id === "tuna") return "raw";
  if (slot.method !== "raw" && !ing.cook?.[slot.method]) return "raw";
  return slot.method;
}

const cache = new Map<string, Meal>();
export function buildRecipe(id: string): Meal | undefined {
  if (cache.has(id)) return cache.get(id);
  const [, tid, ...ids] = id.split(":");
  const t = TEMPLATES.find((x) => x.id === tid); if (!t || ids.length !== t.slots.length) return undefined;
  const ings = ids.map((i) => ING[i]); if (ings.some((i) => !i)) return undefined;
  const parts: Part[] = ings.map((ing, k) => ({ ing, grams: t.slots[k].grams, method: methodFor(t, t.slots[k], ing) }));
  for (const [fid, g, m] of t.fixed ?? []) parts.push({ ing: ING[fid], grams: g, method: m });

  const { steps, end } = buildSteps(t, parts);
  // The cooking oil the steps call for ("1 tsp oil" to roast, to sear) is food too:
  // up to ~120 kcal on a tray bake. Counted here, and listed with the ingredients.
  let oilG = 0, oilTsp = 0;
  for (const s of steps) for (const m of s.txt[1].matchAll(/\{(tsp|tbsp):([\d.]+)\}\s+(?:of\s+)?(?:olive\s+|neutral\s+|vegetable\s+)?oil\b/g)) { oilG += Number(m[2]) * (m[1] === "tsp" ? 4.5 : 13.5); oilTsp += Number(m[2]) * (m[1] === "tsp" ? 1 : 3); }
  oilG = Math.round(oilG);
  const oil = ING["olive-oil"];

  // Macros
  const sum = [0, 0, 0, 0, 0, 0];
  for (const p of parts) for (let k = 0; k < 6; k++) sum[k] += (p.ing.n[k] * p.grams) / 100;
  if (oilG && oil) for (let k = 0; k < 6; k++) sum[k] += (oil.n[k] * oilG) / 100;
  const [kcal, protein, carbs, sugar, fat, fiber] = sum.map((v) => Math.round(v));

  // Diet tags = intersection of all ingredients' compatibilities
  const diets: Diet[] = ["vegetarian", "vegan", "pescatarian", "gluten_free", "lactose_free"];
  const tags: Meal["tags"] = diets.filter((d) => parts.every((p) => p.ing.ok.includes(d)));
  if (t.minutes <= 15) tags.push("quick");
  if (["tray", "curry", "bowl"].includes(t.id)) tags.push("batch");
  if (protein / Math.max(1, kcal) * 4 >= 0.3) tags.push("high_protein");
  if (carbs <= 30) tags.push("low_carb");
  if (sugar <= 10) tags.push("low_sugar");

  const store = storageFor(t, parts);
  const meal: Meal = {
    id, name: t.name(ings), nameFr: t.nameFr(ings), slot: t.slot, kcal, protein, carbs, sugar, fat, fiber, tags,
    // The time shown is the real game plan (prep included), never less than the template's.
    minutes: Math.max(t.minutes, Math.ceil(end / 5) * 5),
    image: t.image(ids), tip: t.tip?.[1], tipFr: t.tip?.[0], cuisine: t.cuisine[1], cuisineFr: t.cuisine[0], generated: true,
    ingredients: [...parts.map((p) => ({ item: p.ing.name, qty: measureTok(p.ing, p.grams, "en") })), ...(oilG ? [{ item: "Cooking oil (olive or canola)", qty: `{tsp:${oilTsp}}` }] : [])],
    ingredientsFr: [...parts.map((p) => ({ item: p.ing.fr, qty: measureTok(p.ing, p.grams, "fr") })), ...(oilG ? [{ item: "Huile de cuisson (olive ou canola)", qty: `{tsp:${oilTsp}}` }] : [])],
    steps: steps.map((s) => s.txt[1]),
    stepsFr: steps.map((s) => s.txt[0]),
    timers: steps.map((s) => s.sec),
    storage: store[1], storageFr: store[0],
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

/* Search text in both languages, accents folded: "poulet" and "chicken" both find the chicken recipes. */
const ING_HAY: Record<string, string> = Object.fromEntries(INGREDIENTS.map((i) => [i.id, fold(`${i.name} ${i.fr} ${i.title?.join(" ") ?? ""} ${i.adj ?? ""} ${i.id.replace(/-/g, " ")}`)]));
const TPL_HAY: Record<string, string> = {
  tray: "tray bake sheet pan plaque four", plate: "plate assiette", stirfry: "stir-fry stir fry saute wok", bowl: "bowl bol grain", salad: "salad salade",
  wrap: "wrap tacos", curry: "curry cari coconut coco", pasta: "pasta pates", oats: "oats oatmeal gruau avoine", "yogurt-bowl": "yogurt bowl yogourt bol",
  eggs: "eggs toast oeufs roties", smoothie: "smoothie shake", toast: "toast rotie roties", "snack-fruit-nuts": "snack collation", "snack-protein": "snack collation", "snack-veg": "snack collation crudites dip trempette", "rice-cakes": "rice cakes galettes de riz",
};
const CURATED_HAY: Record<string, string> = Object.fromEntries(CURATED.map((m) => [m.id, fold([m.name, m.nameFr ?? "", m.cuisine ?? "", m.cuisineFr ?? "", ...m.ingredients.map((i) => i.item), ...(m.ingredientsFr ?? []).map((i) => i.item)].join(" "))]));
function hay(id: string): string {
  if (!id.startsWith("g:")) return CURATED_HAY[id] ?? "";
  const [, tid, ...ids] = id.split(":");
  return `${TPL_HAY[tid] ?? tid} ${ids.map((i) => ING_HAY[i] ?? i).join(" ")}`;
}

export function searchRecipes(f: RecipeFilter = {}): { total: number; items: Meal[] } {
  const diets = f.diets ?? [];
  const words = fold((f.q ?? "").trim()).split(/\s+/).filter(Boolean);
  const ids = [...CURATED.map((m) => m.id), ...catalogIds()].filter((id) => {
    if (!idPassesDiet(id, diets)) return false;
    if (f.slot) { if (id.startsWith("g:")) { const t = TEMPLATES.find((x) => x.id === id.split(":")[1])!; if (!t.slot.includes(f.slot)) return false; } else if (!CURATED_MAP[id].slot.includes(f.slot)) return false; }
    if (words.length) { const h = hay(id); if (!words.every((w) => h.includes(w))) return false; }
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

export const TEMPLATE_NAMES = TEMPLATES.map((t) => ({ id: t.id, cuisine: t.cuisine[1], cuisineFr: t.cuisine[0] }));
