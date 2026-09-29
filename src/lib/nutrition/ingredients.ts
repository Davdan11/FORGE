/* ─────────────────────────────────────────────────────────────
   Ingredient nutrition table — per 100 g (edible, as stated),
   values rounded from USDA FoodData Central / typical labels.
   kcal · protein · carbs · sugar · fat · fiber

   Every ingredient also carries its cookbook text in French (Québec,
   first) and English: how to prep it (cut, trim, rinse, season) and how
   to cook it by method, with heat, fat, time and a doneness cue.
   Placeholders are filled by the recipe builder with the recipe's own
   grams, as scalable tokens (see cookbook.ts):
     <g>          this ingredient's grams          → {g:180}
     <g*0.45>     a share of them (sauce parts)   → {g:9}
     <dry>        dry weight of a grain            → {g:80}
     <water>      cooking water for that grain     → {ml:145}
     <ml>         millilitres (ml-unit liquids)    → {ml:250}
     <n|one|many> a count in the item's unit       → {n:3|egg|eggs}
   Temperatures are written in °C; the page adds °F.
   ───────────────────────────────────────────────────────────── */

export type Diet = "vegetarian" | "vegan" | "pescatarian" | "gluten_free" | "lactose_free";
export type Cat = "protein" | "carb" | "veg" | "sauce" | "fruit" | "dairy" | "extra";
export type Method = "roast" | "pan" | "stirfry" | "grill" | "boil" | "steam" | "raw" | "curry" | "pasta";
/** A text in both languages: [French, English]. */
export type L = readonly [fr: string, en: string];

/** One way of cooking an ingredient: `t` = minutes from the moment it goes on until it is ready. */
export interface CookLine {
  t: number;
  txt: L;
  /** Curry only: browned in the paste before the coconut milk goes in (then simmers the whole time). */
  brown?: boolean;
}

export interface Ingredient {
  id: string;
  name: string;
  /** French name, as on a Québec grocery list. */
  fr: string;
  cat: Cat;
  /** per 100 g */
  n: [kcal: number, p: number, c: number, sugar: number, f: number, fiber: number];
  /** Diet flags this ingredient is compatible with (absent flag = not compatible). */
  ok: Diet[];
  /** Human portion unit, if not grams: [label, grams]. */
  unit?: [string, number];
  /** Count words for the unit: [fr one, fr many, en one, en many]. */
  words?: [string, string, string, string];
  /** Cooked-from-dry ratio for grains/pasta (cooked g = dry g × ratio). */
  dry?: number;
  /** Cooking water per gram of dry grain (absorption method). */
  water?: number;
  /** Mise en place by method ("_" = any method). */
  prep?: Partial<Record<Method | "_", L>>;
  /** Cooking lines by method. */
  cook?: Partial<Record<Method, CookLine>>;
  /** Short qualifier used in English recipe names. */
  adj?: string;
  /** French words for recipe names: [plain noun, noun with its qualifier]. */
  title?: [plain: string, qualified?: string];
  /** Days a cooked portion keeps in the fridge. */
  keep?: number;
}

const ALL: Diet[] = ["vegetarian", "vegan", "pescatarian", "gluten_free", "lactose_free"];
const MEAT: Diet[] = ["gluten_free", "lactose_free"];
const FISH: Diet[] = ["pescatarian", "gluten_free", "lactose_free"];
const VEGT: Diet[] = ["vegetarian", "pescatarian", "gluten_free", "lactose_free"];   // vegetarian, dairy-free
const VEGD: Diet[] = ["vegetarian", "pescatarian", "gluten_free"];                   // vegetarian with dairy
const VEGAN_GF: Diet[] = ALL;
const WHEAT: Diet[] = ["vegetarian", "vegan", "pescatarian", "lactose_free"];

const I = (i: Ingredient) => i;
const T = (fr: string, en: string): L => [fr, en];
const C = (t: number, fr: string, en: string, brown?: boolean): CookLine => (brown ? { t, txt: [fr, en], brown } : { t, txt: [fr, en] });

export const INGREDIENTS: Ingredient[] = [
  /* ── Proteins ── */
  I({ id: "chicken-breast", name: "Chicken breast", fr: "Poitrine de poulet", cat: "protein", n: [120, 22.5, 0, 0, 2.6, 0], ok: MEAT, adj: "lemon-herb", title: ["poulet", "poulet citron-fines herbes"], keep: 3,
    prep: {
      _: T("Éponge <g> de poitrine de poulet avec du papier absorbant et ouvre-la en portefeuille pour obtenir une épaisseur égale de 2 cm. Assaisonne-la de {tsp:0.25} de sel, {tsp:0.25} de poivre noir, {tsp:1} d’herbes de Provence et du zeste de ½ citron.",
        "Pat <g> chicken breast dry with paper towel and butterfly it to an even 2 cm thickness. Season with {tsp:0.25} salt, {tsp:0.25} black pepper, {tsp:1} dried Italian herbs and the zest of ½ lemon."),
      stirfry: T("Tranche <g> de poitrine de poulet contre le grain en lanières de 1 cm et enrobe-les de {tsp:1} de fécule de maïs et {tsp:0.25} de sel.",
        "Slice <g> chicken breast against the grain into 1 cm strips; toss with {tsp:1} cornstarch and {tsp:0.25} salt."),
      curry: T("Coupe <g> de poitrine de poulet en cubes de 3 cm et sale-les avec {tsp:0.25} de sel.",
        "Cut <g> chicken breast into 3 cm cubes and season with {tsp:0.25} salt."),
    },
    cook: {
      pan: C(15, "Chauffe {tsp:1} d’huile dans une poêle à feu moyen-vif jusqu’à ce qu’elle miroite. Saisis <g> de poulet 5–6 min sans y toucher, retourne-le et poursuis 5–6 min, jusqu’à 74 °C au cœur. Laisse reposer 3 min sur une planche, puis tranche à 1 cm.",
        "Heat {tsp:1} oil in a skillet over medium-high heat until it shimmers. Sear <g> chicken 5–6 min without moving it, flip and cook 5–6 min more, until 74 °C in the thickest part. Rest 3 min on a board, then slice 1 cm thick."),
      roast: C(20, "Dépose <g> de poulet sur la plaque, badigeonne-le de {tsp:1} d’huile et fais rôtir 18–20 min, jusqu’à 74 °C au cœur. Laisse reposer 3 min avant de trancher.",
        "Place <g> chicken on the tray, brush with {tsp:1} oil and roast 18–20 min, until 74 °C in the thickest part. Rest 3 min before slicing."),
      stirfry: C(4, "Chauffe {tsp:1} d’huile dans le wok à feu vif jusqu’à ce qu’il fume. Saisis <g> de poulet en une seule couche 3–4 min en remuant, jusqu’à ce qu’il soit doré et blanc au centre (74 °C). Réserve dans une assiette.",
        "Heat {tsp:1} oil in the wok over high heat until smoking. Sear <g> chicken in a single layer 3–4 min, stirring, until golden and white at the center (74 °C). Transfer to a plate."),
      curry: C(12, "Ajoute <g> de poulet en cubes à la pâte de cari et fais-le dorer 3 min en remuant, jusqu’à ce qu’il soit blanc sur toutes les faces; il finira de cuire dans la sauce (74 °C au cœur).",
        "Add <g> cubed chicken to the curry paste and brown 3 min, stirring, until white on all sides; it finishes cooking in the sauce (74 °C inside).", true),
    } }),
  I({ id: "chicken-thigh", name: "Chicken thighs", fr: "Hauts de cuisse de poulet désossés", cat: "protein", n: [145, 19, 0, 0, 8, 0], ok: MEAT, adj: "crispy", title: ["poulet", "poulet croustillant"], keep: 3,
    prep: {
      _: T("Éponge <g> de hauts de cuisse de poulet désossés, retire l’excédent de gras et assaisonne-les de {tsp:0.25} de sel, {tsp:0.25} de poivre et {tsp:0.5} de paprika fumé.",
        "Pat <g> boneless chicken thighs dry, trim excess fat and season with {tsp:0.25} salt, {tsp:0.25} black pepper and {tsp:0.5} smoked paprika."),
      curry: T("Coupe <g> de hauts de cuisse de poulet désossés en cubes de 3 cm et sale-les avec {tsp:0.25} de sel.",
        "Cut <g> boneless chicken thighs into 3 cm cubes and season with {tsp:0.25} salt."),
    },
    cook: {
      roast: C(30, "Dépose <g> de poulet sur la plaque, côté peau (ou côté lisse) vers le haut, arrose de {tsp:1} d’huile et fais rôtir 28–30 min, jusqu’à ce que le dessus soit croustillant et l’intérieur à 74 °C.",
        "Place <g> chicken on the tray skin-side (smooth side) up, drizzle with {tsp:1} oil and roast 28–30 min, until the top is crisp and the inside reads 74 °C."),
      pan: C(15, "Chauffe {tsp:1} d’huile dans une poêle à feu moyen-vif. Dépose <g> de poulet côté lisse en dessous et cuis 7 min sans y toucher, retourne et poursuis 6 min, jusqu’à 74 °C au cœur. Laisse reposer 2 min, puis tranche.",
        "Heat {tsp:1} oil in a skillet over medium-high heat. Lay in <g> chicken smooth-side down and cook 7 min without moving it, flip and cook 6 min more, until 74 °C inside. Rest 2 min, then slice."),
      curry: C(15, "Ajoute <g> de poulet en cubes à la pâte de cari et fais-le dorer 4 min en remuant; il finira de cuire dans la sauce (74 °C au cœur).",
        "Add <g> cubed chicken to the curry paste and brown 4 min, stirring; it finishes cooking in the sauce (74 °C inside).", true),
    } }),
  I({ id: "turkey-mince", name: "Lean ground turkey", fr: "Dinde hachée maigre", cat: "protein", n: [150, 19, 0, 0, 8, 0], ok: MEAT, adj: "spiced", title: ["dinde hachée", "dinde épicée"], keep: 3,
    prep: { _: T("Sors <g> de dinde hachée maigre et prépare le mélange d’épices : {tsp:0.5} de cumin moulu, {tsp:0.5} de paprika fumé, {tsp:0.25} de poudre d’ail, {tsp:0.25} de sel et {tsp:0.25} de poivre.",
      "Have <g> lean ground turkey ready and mix the spices: {tsp:0.5} ground cumin, {tsp:0.5} smoked paprika, {tsp:0.25} garlic powder, {tsp:0.25} salt and {tsp:0.25} black pepper.") },
    cook: {
      pan: C(8, "Chauffe {tsp:1} d’huile dans une poêle à feu moyen-vif. Ajoute <g> de dinde et fais-la dorer 6–7 min en l’émiettant à la spatule, jusqu’à ce qu’il ne reste plus de rose (74 °C). Ajoute les épices la dernière minute.",
        "Heat {tsp:1} oil in a skillet over medium-high heat. Add <g> turkey and brown 6–7 min, breaking it up with a spatula, until no pink remains (74 °C). Add the spices for the last minute."),
      stirfry: C(5, "Chauffe {tsp:1} d’huile dans le wok à feu vif. Fais dorer <g> de dinde 5 min en l’émiettant, jusqu’à ce qu’il ne reste plus de rose (74 °C), avec les épices; réserve.",
        "Heat {tsp:1} oil in the wok over high heat. Brown <g> turkey 5 min, breaking it up, until no pink remains (74 °C), with the spices; set aside."),
    } }),
  I({ id: "beef-mince", name: "Lean ground beef (95/5)", fr: "Bœuf haché extra-maigre", cat: "protein", n: [137, 21, 0, 0, 5, 0], ok: MEAT, adj: "seared", title: ["bœuf haché", "bœuf haché saisi"], keep: 3,
    prep: { _: T("Sors <g> de bœuf haché extra-maigre et prépare {tsp:0.25} de sel, {tsp:0.25} de poivre noir et {tsp:0.5} de poudre d’ail.",
      "Have <g> extra-lean ground beef ready with {tsp:0.25} salt, {tsp:0.25} black pepper and {tsp:0.5} garlic powder.") },
    cook: {
      pan: C(7, "Chauffe une poêle à feu vif avec {tsp:0.5} d’huile. Ajoute <g> de bœuf, laisse-le saisir 2 min sans y toucher, puis émiette-le et poursuis 4–5 min, jusqu’à ce qu’il n’y ait plus de rose (71 °C). Assaisonne et égoutte le gras s’il y en a.",
        "Heat a skillet over high heat with {tsp:0.5} oil. Add <g> beef, let it sear 2 min undisturbed, then break it up and cook 4–5 min more, until no pink remains (71 °C). Season and pour off any fat."),
      stirfry: C(5, "Dans le wok fumant avec {tsp:0.5} d’huile, saisis <g> de bœuf 4–5 min en l’émiettant, jusqu’à ce qu’il n’y ait plus de rose (71 °C). Assaisonne et réserve.",
        "In the smoking wok with {tsp:0.5} oil, sear <g> beef 4–5 min, breaking it up, until no pink remains (71 °C). Season and set aside."),
    } }),
  I({ id: "sirloin", name: "Sirloin steak", fr: "Bifteck de surlonge", cat: "protein", n: [150, 22, 0, 0, 6.5, 0], ok: MEAT, adj: "pan-seared", title: ["surlonge", "surlonge poêlée"], keep: 3,
    prep: {
      _: T("Sors <g> de bifteck de surlonge (2,5 cm d’épaisseur) du frigo 15 min avant la cuisson, éponge-le bien et sale-le des deux côtés avec {tsp:0.25} de sel.",
        "Take <g> sirloin steak (2.5 cm thick) out of the fridge 15 min before cooking, pat it very dry and salt both sides with {tsp:0.25} salt."),
      stirfry: T("Tranche <g> de bifteck de surlonge contre le grain en lanières de 5 mm; enrobe-les de {tsp:1} de fécule de maïs et {tsp:0.25} de sel.",
        "Slice <g> sirloin steak against the grain into 5 mm strips; toss with {tsp:1} cornstarch and {tsp:0.25} salt."),
    },
    cook: {
      pan: C(11, "Chauffe une poêle en fonte à feu vif avec {tsp:1} d’huile jusqu’à ce qu’elle fume légèrement. Saisis <g> de surlonge 3 min par côté pour mi-saignant (54 °C au cœur) ou 4 min par côté pour à point (57 °C). Laisse reposer 5 min, puis tranche finement contre le grain et poivre ({tsp:0.25}).",
        "Heat a cast-iron skillet over high heat with {tsp:1} oil until just smoking. Sear <g> sirloin 3 min per side for medium-rare (54 °C inside) or 4 min per side for medium (57 °C). Rest 5 min, then slice thin against the grain and pepper it ({tsp:0.25})."),
      stirfry: C(2, "Dans le wok fumant avec {tsp:1} d’huile, saisis <g> de surlonge en une seule couche 60–90 s, juste assez pour colorer; réserve.",
        "In the smoking wok with {tsp:1} oil, sear <g> sirloin in a single layer 60–90 s, just until browned; set aside."),
    } }),
  I({ id: "pork-tenderloin", name: "Pork tenderloin", fr: "Filet de porc", cat: "protein", n: [120, 21, 0, 0, 3.5, 0], ok: MEAT, adj: "roasted", title: ["porc", "filet de porc rôti"], keep: 3,
    prep: {
      _: T("Retire la membrane argentée de <g> de filet de porc avec la pointe d’un couteau, éponge-le et frotte-le avec {tsp:0.25} de sel, {tsp:0.25} de poivre et {tsp:0.5} de thym séché.",
        "Trim the silver skin off <g> pork tenderloin with the tip of a knife, pat it dry and rub with {tsp:0.25} salt, {tsp:0.25} black pepper and {tsp:0.5} dried thyme."),
      pan: T("Retire la membrane argentée de <g> de filet de porc, coupe-le en médaillons de 2 cm et assaisonne-les de {tsp:0.25} de sel, {tsp:0.25} de poivre et {tsp:0.5} de thym séché.",
        "Trim the silver skin off <g> pork tenderloin, cut it into 2 cm medallions and season with {tsp:0.25} salt, {tsp:0.25} black pepper and {tsp:0.5} dried thyme."),
      stirfry: T("Retire la membrane de <g> de filet de porc et tranche-le en lamelles de 5 mm; enrobe-les de {tsp:1} de fécule de maïs et {tsp:0.25} de sel.",
        "Trim <g> pork tenderloin and slice it into 5 mm strips; toss with {tsp:1} cornstarch and {tsp:0.25} salt."),
    },
    cook: {
      roast: C(20, "Dépose <g> de filet de porc sur la plaque, badigeonne-le de {tsp:1} d’huile et fais rôtir 18–20 min, jusqu’à 63 °C au cœur (légèrement rosé). Laisse reposer 5 min, puis tranche à 1 cm.",
        "Place <g> pork tenderloin on the tray, brush with {tsp:1} oil and roast 18–20 min, until 63 °C in the center (just blushing). Rest 5 min, then slice 1 cm thick."),
      pan: C(11, "Chauffe {tsp:1} d’huile dans une poêle à feu moyen-vif. Saisis <g> de médaillons de porc 3 min par côté, jusqu’à 63 °C au cœur. Laisse reposer 5 min.",
        "Heat {tsp:1} oil in a skillet over medium-high heat. Sear <g> pork medallions 3 min per side, until 63 °C in the center. Rest 5 min."),
      stirfry: C(3, "Dans le wok fumant avec {tsp:1} d’huile, saisis <g> de porc en une seule couche 2–3 min, jusqu’à ce qu’il n’y ait plus de rose (63 °C); réserve.",
        "In the smoking wok with {tsp:1} oil, sear <g> pork in a single layer 2–3 min, until no longer pink (63 °C); set aside."),
    } }),
  I({ id: "salmon", name: "Salmon fillet", fr: "Pavé de saumon", cat: "protein", n: [208, 20, 0, 0, 13, 0], ok: FISH, adj: "roasted", title: ["saumon", "saumon rôti"], keep: 2,
    prep: {
      _: T("Éponge <g> de pavé de saumon avec du papier absorbant, vérifie qu’il ne reste pas d’arêtes et assaisonne la chair de {tsp:0.25} de sel, {tsp:0.25} de poivre et du zeste de ½ citron.",
        "Pat <g> salmon fillet dry with paper towel, check for pin bones and season the flesh with {tsp:0.25} salt, {tsp:0.25} black pepper and the zest of ½ lemon."),
    },
    cook: {
      roast: C(12, "Dépose <g> de saumon côté peau en dessous sur la plaque, badigeonne-le de {tsp:1} d’huile et fais rôtir 10–12 min, jusqu’à ce que la chair se défasse en flocons et soit encore rosée au centre (52 °C pour mi-cuit, 60 °C bien cuit).",
        "Place <g> salmon skin-side down on the tray, brush with {tsp:1} oil and roast 10–12 min, until it flakes but is still pink in the center (52 °C for medium, 60 °C well done)."),
      pan: C(8, "Chauffe {tsp:1} d’huile dans une poêle antiadhésive à feu moyen-vif. Dépose <g> de saumon côté peau en dessous et cuis 5 min sans y toucher, jusqu’à ce que la peau soit croustillante, retourne et poursuis 2–3 min (52 °C au centre pour mi-cuit). Défais en gros flocons au besoin.",
        "Heat {tsp:1} oil in a non-stick skillet over medium-high heat. Lay <g> salmon skin-side down and cook 5 min without moving it, until the skin is crisp, then flip and cook 2–3 min more (52 °C in the center for medium). Break into large flakes if needed."),
    } }),
  I({ id: "cod", name: "Cod fillet", fr: "Filet de morue", cat: "protein", n: [82, 18, 0, 0, 0.7, 0], ok: FISH, adj: "baked", title: ["morue", "morue au four"], keep: 2,
    prep: {
      _: T("Éponge <g> de filet de morue et assaisonne-le de {tsp:0.25} de sel, {tsp:0.25} de poivre et {tsp:0.5} de paprika doux.",
        "Pat <g> cod fillet dry and season with {tsp:0.25} salt, {tsp:0.25} black pepper and {tsp:0.5} sweet paprika."),
      curry: T("Éponge <g> de filet de morue, coupe-le en morceaux de 4 cm et sale-les avec {tsp:0.25} de sel.",
        "Pat <g> cod fillet dry, cut it into 4 cm chunks and season with {tsp:0.25} salt."),
    },
    cook: {
      roast: C(12, "Dépose <g> de morue sur la plaque, arrose de {tsp:1} d’huile et fais cuire 10–12 min, jusqu’à ce que la chair soit opaque et se défasse en flocons (60 °C au cœur).",
        "Place <g> cod on the tray, drizzle with {tsp:1} oil and bake 10–12 min, until opaque and flaking easily (60 °C inside)."),
      pan: C(7, "Chauffe {tsp:1} d’huile dans une poêle antiadhésive à feu moyen-vif. Cuis <g> de morue 3 min, retourne délicatement et poursuis 3 min, jusqu’à ce qu’elle soit opaque et se défasse en flocons (60 °C).",
        "Heat {tsp:1} oil in a non-stick skillet over medium-high heat. Cook <g> cod 3 min, flip gently and cook 3 min more, until opaque and flaking (60 °C)."),
      curry: C(5, "Glisse <g> de morue dans la sauce frémissante sans remuer; laisse pocher 5 min, jusqu’à ce qu’elle soit opaque et se défasse en flocons.",
        "Slip <g> cod into the simmering sauce without stirring; poach 5 min, until opaque and flaking."),
    } }),
  I({ id: "shrimp", name: "Shrimp, peeled", fr: "Crevettes décortiquées", cat: "protein", n: [85, 20, 0, 0, 0.5, 0], ok: FISH, adj: "garlic", title: ["crevettes", "crevettes à l’ail"], keep: 2,
    prep: {
      _: T("Décongèle au besoin <g> de crevettes décortiquées sous l’eau froide, retire la veine noire, éponge-les bien et assaisonne-les de {tsp:0.25} de sel. Hache finement 2 gousses d’ail.",
        "Thaw <g> peeled shrimp under cold water if frozen, remove any dark vein, pat very dry and season with {tsp:0.25} salt. Finely chop 2 garlic cloves."),
    },
    cook: {
      pan: C(4, "Chauffe {tsp:1} d’huile dans une poêle à feu moyen-vif. Saisis <g> de crevettes 90 s par côté avec l’ail, jusqu’à ce qu’elles soient roses, opaques et en forme de C (pas de O : trop cuites).",
        "Heat {tsp:1} oil in a skillet over medium-high heat. Sauté <g> shrimp with the garlic 90 s per side, until pink, opaque and curled into a C (an O means overcooked)."),
      stirfry: C(3, "Dans le wok fumant avec {tsp:1} d’huile, saisis <g> de crevettes et l’ail 2 min en remuant, jusqu’à ce qu’elles soient roses et opaques; réserve.",
        "In the smoking wok with {tsp:1} oil, stir-fry <g> shrimp with the garlic 2 min, until pink and opaque; set aside."),
      curry: C(3, "Ajoute <g> de crevettes (et l’ail) dans la sauce frémissante et laisse cuire 3 min, jusqu’à ce qu’elles soient roses et opaques.",
        "Add <g> shrimp (and the garlic) to the simmering sauce and cook 3 min, until pink and opaque."),
    } }),
  I({ id: "tuna", name: "Tuna in water, drained", fr: "Thon pâle dans l’eau, égoutté", cat: "protein", n: [116, 26, 0, 0, 1, 0], ok: FISH, adj: "", title: ["thon"], keep: 2,
    prep: { _: T("Égoutte bien le thon pour en obtenir <g>, puis défais-le à la fourchette avec {tsp:0.25} de poivre noir et le jus de ½ citron.",
      "Drain the tuna well to get <g>, then flake it with a fork with {tsp:0.25} black pepper and the juice of ½ lemon.") },
    cook: {
      pan: C(1, "Ajoute <g> de thon émietté à la poêle hors du feu, juste pour le réchauffer 1 min.",
        "Fold <g> flaked tuna into the pan off the heat, just to warm it through for 1 min."),
    } }),
  I({ id: "eggs", name: "Eggs", fr: "Œufs", cat: "protein", n: [143, 12.6, 0.7, 0.4, 9.5, 0], ok: VEGT, unit: ["egg", 50], words: ["œuf", "œufs", "egg", "eggs"], adj: "", title: ["œufs"], keep: 2,
    prep: {
      _: T("Casse <n|œuf|œufs> (<g>) dans un bol, ajoute {tsp:0.25} de sel et {tsp:0.25} de poivre et bats à la fourchette 20 s.",
        "Crack <n|egg|eggs> (<g>) into a bowl, add {tsp:0.25} salt and {tsp:0.25} black pepper and beat with a fork for 20 s."),
      boil: T("Sors <n|œuf|œufs> (<g>) du frigo et prépare un bol d’eau glacée.",
        "Take <n|egg|eggs> (<g>) out of the fridge and set up a bowl of ice water."),
    },
    cook: {
      pan: C(4, "Fais fondre {tsp:0.5} d’huile ou de beurre dans une poêle antiadhésive à feu moyen-doux. Verse <n|œuf|œufs> battus et remue lentement à la spatule 3 min, en ramenant les bords vers le centre; retire du feu quand ils sont encore brillants et à peine pris.",
        "Melt {tsp:0.5} oil or butter in a non-stick skillet over medium-low heat. Pour in <n|egg|eggs>, beaten, and stir slowly with a spatula for 3 min, pulling the edges to the center; take off the heat while still glossy and just set."),
      boil: C(10, "Dépose délicatement <n|œuf|œufs> dans l’eau bouillante et cuis 7 min pour un jaune coulant-crémeux (9 min pour cuit dur), puis plonge-les 2 min dans l’eau glacée. Écale et coupe en deux.",
        "Lower <n|egg|eggs> gently into boiling water and cook 7 min for a jammy yolk (9 min for hard-boiled), then into the ice water for 2 min. Peel and halve."),
    } }),
  I({ id: "tofu", name: "Firm tofu", fr: "Tofu ferme", cat: "protein", n: [120, 13, 2.5, 0.5, 7, 1.5], ok: VEGAN_GF, adj: "crispy", title: ["tofu", "tofu croustillant"], keep: 4,
    prep: { _: T("Presse <g> de tofu ferme 10 min entre deux linges sous une poêle lourde, coupe-le en cubes de 2 cm et enrobe-les de {tsp:1} de fécule de maïs, {tsp:0.25} de sel et {tsp:0.5} de paprika fumé.",
      "Press <g> firm tofu for 10 min between two towels under a heavy pan, cut it into 2 cm cubes and toss with {tsp:1} cornstarch, {tsp:0.25} salt and {tsp:0.5} smoked paprika.") },
    cook: {
      pan: C(8, "Chauffe {tsp:2} d’huile dans une poêle antiadhésive à feu moyen-vif. Fais dorer <g> de tofu 6–8 min en tournant les cubes aux 2 min, jusqu’à ce qu’ils soient croustillants sur toutes les faces.",
        "Heat {tsp:2} oil in a non-stick skillet over medium-high heat. Fry <g> tofu 6–8 min, turning the cubes every 2 min, until crisp and golden on every side."),
      roast: C(25, "Étale <g> de tofu en une seule couche sur la plaque, arrose de {tsp:1} d’huile et fais rôtir 25 min en retournant à mi-cuisson, jusqu’à ce qu’il soit doré et croustillant.",
        "Spread <g> tofu in a single layer on the tray, drizzle with {tsp:1} oil and roast 25 min, turning halfway, until golden and crisp."),
      stirfry: C(6, "Dans le wok avec {tsp:2} d’huile à feu vif, fais dorer <g> de tofu 5–6 min en remuant délicatement, jusqu’à ce qu’il soit doré; réserve.",
        "In the wok with {tsp:2} oil over high heat, fry <g> tofu 5–6 min, stirring gently, until golden; set aside."),
      curry: C(8, "Ajoute <g> de tofu à la pâte de cari et fais-le dorer 4 min en le retournant délicatement.",
        "Add <g> tofu to the curry paste and brown 4 min, turning gently.", true),
    } }),
  I({ id: "tempeh", name: "Tempeh", fr: "Tempeh", cat: "protein", n: [192, 20, 8, 0, 11, 6], ok: VEGAN_GF, adj: "golden", title: ["tempeh", "tempeh doré"], keep: 4,
    prep: {
      _: T("Coupe <g> de tempeh en tranches de 1 cm et arrose-les de {tsp:1} de sauce soya (ou tamari sans gluten).",
        "Slice <g> tempeh 1 cm thick and sprinkle with {tsp:1} soy sauce (or gluten-free tamari)."),
      roast: T("Coupe <g> de tempeh en cubes de 2 cm et enrobe-les de {tsp:1} de sauce soya (ou tamari).", "Cut <g> tempeh into 2 cm cubes and toss with {tsp:1} soy sauce (or tamari)."),
      stirfry: T("Coupe <g> de tempeh en cubes de 2 cm.", "Cut <g> tempeh into 2 cm cubes."),
      curry: T("Coupe <g> de tempeh en cubes de 2 cm.", "Cut <g> tempeh into 2 cm cubes."),
    },
    cook: {
      pan: C(6, "Chauffe {tsp:2} d’huile dans une poêle à feu moyen. Fais dorer <g> de tempeh 3 min par côté, jusqu’à ce qu’il soit doré et croustillant sur les bords.",
        "Heat {tsp:2} oil in a skillet over medium heat. Fry <g> tempeh 3 min per side, until golden and crisp at the edges."),
      roast: C(20, "Étale <g> de tempeh sur la plaque, arrose de {tsp:1} d’huile et fais rôtir 20 min en retournant à mi-cuisson, jusqu’à ce qu’il soit doré.",
        "Spread <g> tempeh on the tray, drizzle with {tsp:1} oil and roast 20 min, turning halfway, until golden."),
      stirfry: C(5, "Dans le wok avec {tsp:2} d’huile à feu vif, fais dorer <g> de tempeh 5 min en remuant; réserve.",
        "In the wok with {tsp:2} oil over high heat, fry <g> tempeh 5 min, stirring, until golden; set aside."),
      curry: C(10, "Ajoute <g> de tempeh à la pâte de cari et fais-le dorer 4 min en remuant.",
        "Add <g> tempeh to the curry paste and brown 4 min, stirring.", true),
    } }),
  I({ id: "chickpeas", name: "Chickpeas, cooked", fr: "Pois chiches cuits", cat: "protein", n: [139, 7.5, 22, 4, 2.6, 6], ok: VEGAN_GF, adj: "crispy", title: ["pois chiches", "pois chiches croustillants"], keep: 4,
    prep: {
      _: T("Rince et égoutte <g> de pois chiches cuits, puis sèche-les bien dans un linge (retire les peaux qui se détachent). Enrobe-les de {tsp:0.5} de paprika fumé, {tsp:0.5} de cumin moulu et {tsp:0.25} de sel.",
        "Rinse and drain <g> cooked chickpeas, then dry them well in a towel (discard loose skins). Toss with {tsp:0.5} smoked paprika, {tsp:0.5} ground cumin and {tsp:0.25} salt."),
      curry: T("Rince et égoutte <g> de pois chiches cuits.", "Rinse and drain <g> cooked chickpeas."),
    },
    cook: {
      roast: C(22, "Étale <g> de pois chiches en une seule couche sur la plaque, arrose de {tsp:1} d’huile et fais rôtir 20–22 min en secouant la plaque à mi-cuisson, jusqu’à ce qu’ils soient croustillants.",
        "Spread <g> chickpeas in a single layer on the tray, drizzle with {tsp:1} oil and roast 20–22 min, shaking the tray halfway, until crisp."),
      pan: C(6, "Chauffe {tsp:1} d’huile dans une poêle à feu moyen-vif. Fais sauter <g> de pois chiches 5–6 min en remuant souvent, jusqu’à ce qu’ils soient dorés et commencent à éclater.",
        "Heat {tsp:1} oil in a skillet over medium-high heat. Fry <g> chickpeas 5–6 min, stirring often, until golden and starting to pop."),
      curry: C(10, "Ajoute <g> de pois chiches à la sauce et laisse mijoter 10 min pour qu’ils s’imprègnent des saveurs.",
        "Add <g> chickpeas to the sauce and simmer 10 min so they soak up the flavor."),
    } }),
  I({ id: "black-beans", name: "Black beans, cooked", fr: "Haricots noirs cuits", cat: "protein", n: [130, 8.9, 24, 0.3, 0.5, 8.7], ok: VEGAN_GF, adj: "smoky", title: ["haricots noirs", "haricots noirs fumés"], keep: 4,
    prep: { _: T("Rince et égoutte <g> de haricots noirs cuits. Prépare {tsp:0.5} de cumin moulu, {tsp:0.5} de paprika fumé, {tsp:0.25} de sel et le jus de ½ lime.",
      "Rinse and drain <g> cooked black beans. Have ready {tsp:0.5} ground cumin, {tsp:0.5} smoked paprika, {tsp:0.25} salt and the juice of ½ lime.") },
    cook: {
      pan: C(5, "Chauffe {tsp:1} d’huile dans une poêle à feu moyen. Ajoute les épices 30 s, puis <g> de haricots noirs et 2 c. à soupe d’eau; réchauffe 4 min en écrasant le quart des haricots. Finis avec le jus de lime.",
        "Heat {tsp:1} oil in a skillet over medium heat. Add the spices for 30 s, then <g> black beans and 2 tbsp water; warm 4 min, mashing a quarter of the beans. Finish with the lime juice."),
    } }),
  I({ id: "lentils", name: "Lentils, cooked", fr: "Lentilles cuites", cat: "protein", n: [116, 9, 20, 1.8, 0.4, 7.9], ok: VEGAN_GF, adj: "", title: ["lentilles"], keep: 4,
    prep: { _: T("Rince et égoutte <g> de lentilles cuites; assaisonne-les de {tsp:0.25} de sel, {tsp:0.25} de poivre et du jus de ½ citron.",
      "Rinse and drain <g> cooked lentils; season with {tsp:0.25} salt, {tsp:0.25} black pepper and the juice of ½ lemon.") },
    cook: {
      pan: C(3, "Réchauffe <g> de lentilles 2–3 min dans une poêle à feu moyen avec {tsp:1} d’huile d’olive, en remuant, jusqu’à ce qu’elles soient chaudes.",
        "Warm <g> lentils 2–3 min in a skillet over medium heat with {tsp:1} olive oil, stirring, until hot."),
      curry: C(8, "Ajoute <g> de lentilles à la sauce et laisse mijoter 8 min.", "Add <g> lentils to the sauce and simmer 8 min."),
    } }),
  I({ id: "halloumi", name: "Halloumi", fr: "Halloumi", cat: "protein", n: [321, 22, 2, 2, 25, 0], ok: VEGD, adj: "grilled", title: ["halloumi", "halloumi grillé"], keep: 2,
    prep: {
      _: T("Coupe <g> de halloumi en tranches de 1 cm et éponge-les.", "Slice <g> halloumi 1 cm thick and pat dry."),
      roast: T("Coupe <g> de halloumi en cubes de 2 cm.", "Cut <g> halloumi into 2 cm cubes."),
    },
    cook: {
      pan: C(4, "Chauffe une poêle antiadhésive à sec à feu moyen-vif. Dore <g> de halloumi 2 min par côté, jusqu’à ce qu’il soit bien doré. Sers aussitôt : il devient caoutchouteux en refroidissant.",
        "Heat a dry non-stick skillet over medium-high heat. Brown <g> halloumi 2 min per side, until deep golden. Serve right away — it turns rubbery as it cools."),
      roast: C(12, "Ajoute <g> de halloumi sur la plaque et fais rôtir 10–12 min, jusqu’à ce que les arêtes soient dorées.",
        "Add <g> halloumi to the tray and roast 10–12 min, until golden at the edges."),
    } }),
  I({ id: "paneer", name: "Paneer", fr: "Paneer", cat: "protein", n: [296, 18, 3.6, 3, 23, 0], ok: VEGD, adj: "tikka", title: ["paneer", "paneer tikka"], keep: 3,
    prep: { _: T("Coupe <g> de paneer en cubes de 2 cm et enrobe-les de {tsp:1} de garam masala, {tsp:0.25} de curcuma et {tsp:0.25} de sel.",
      "Cut <g> paneer into 2 cm cubes and toss with {tsp:1} garam masala, {tsp:0.25} turmeric and {tsp:0.25} salt.") },
    cook: {
      pan: C(5, "Chauffe {tsp:1} d’huile dans une poêle à feu moyen-vif. Saisis <g> de paneer 4–5 min en tournant les cubes, jusqu’à ce qu’ils soient grillés sur les arêtes.",
        "Heat {tsp:1} oil in a skillet over medium-high heat. Sear <g> paneer 4–5 min, turning the cubes, until charred at the edges."),
      curry: C(6, "Ajoute <g> de paneer à la pâte de cari et saisis-le 2 min en le retournant délicatement.",
        "Add <g> paneer to the curry paste and sear 2 min, turning gently.", true),
      roast: C(15, "Étale <g> de paneer sur la plaque, arrose de {tsp:1} d’huile et fais rôtir 15 min, jusqu’à ce qu’il soit grillé sur les arêtes.",
        "Spread <g> paneer on the tray, drizzle with {tsp:1} oil and roast 15 min, until charred at the edges."),
    } }),
  I({ id: "greek-yogurt", name: "Greek yogurt 2%", fr: "Yogourt grec 2 %", cat: "protein", n: [73, 10, 4, 4, 2, 0], ok: VEGD, title: ["yogourt grec"],
    prep: { _: T("Mesure <g> de yogourt grec 2 %.", "Measure <g> 2% Greek yogurt.") } }),
  I({ id: "cottage-cheese", name: "Cottage cheese 2%", fr: "Fromage cottage 2 %", cat: "protein", n: [84, 11, 4.3, 4, 2.3, 0], ok: VEGD, title: ["fromage cottage"],
    prep: { _: T("Mesure <g> de fromage cottage 2 %.", "Measure <g> 2% cottage cheese.") } }),
  I({ id: "whey", name: "Whey protein", fr: "Protéine whey", cat: "protein", n: [400, 80, 8, 4, 6, 0], ok: VEGD, unit: ["scoop", 30], words: ["mesure", "mesures", "scoop", "scoops"], title: ["protéine whey"],
    prep: { _: T("Mesure <g> de protéine whey (<n|mesure|mesures>).", "Measure <g> whey protein (<n|scoop|scoops>).") } }),
  I({ id: "plant-protein", name: "Plant protein powder", fr: "Protéine végétale en poudre", cat: "protein", n: [380, 70, 12, 2, 6, 4], ok: VEGAN_GF, unit: ["scoop", 30], words: ["mesure", "mesures", "scoop", "scoops"], title: ["protéine végétale"],
    prep: { _: T("Mesure <g> de protéine végétale (<n|mesure|mesures>).", "Measure <g> plant protein (<n|scoop|scoops>).") } }),

  /* ── Carbs ── */
  I({ id: "white-rice", name: "White rice", fr: "Riz blanc", cat: "carb", n: [130, 2.7, 28, 0.1, 0.3, 0.4], ok: VEGAN_GF, dry: 3, water: 1.8, title: ["riz blanc"], keep: 3,
    prep: { _: T("Rince <dry> de riz blanc dans une passoire fine à l’eau froide jusqu’à ce que l’eau soit claire.", "Rinse <dry> white rice in a fine sieve under cold water until the water runs clear.") },
    cook: { boil: C(20, "Mets le riz dans une petite casserole avec <water> d’eau froide et {tsp:0.25} de sel. Porte à ébullition à feu vif, couvre, baisse à feu doux et laisse mijoter 12 min, jusqu’à ce que l’eau soit absorbée et que de petits trous apparaissent à la surface. Retire du feu, laisse reposer 5 min à couvert, puis égraine à la fourchette (<g> cuit).",
      "Put the rice in a small pot with <water> cold water and {tsp:0.25} salt. Bring to a boil over high heat, cover, turn to low and simmer 12 min, until the water is absorbed and small holes show on the surface. Off the heat, rest 5 min covered, then fluff with a fork (<g> cooked).") } }),
  I({ id: "brown-rice", name: "Brown rice", fr: "Riz brun", cat: "carb", n: [123, 2.7, 26, 0.4, 1, 1.6], ok: VEGAN_GF, dry: 3, water: 2.3, title: ["riz brun"], keep: 3,
    prep: { _: T("Rince <dry> de riz brun à l’eau froide.", "Rinse <dry> brown rice under cold water.") },
    cook: { boil: C(45, "Mets le riz dans une casserole avec <water> d’eau et {tsp:0.25} de sel. Porte à ébullition, couvre et laisse mijoter à feu doux 35 min, jusqu’à ce que l’eau soit absorbée. Retire du feu, laisse reposer 5 min à couvert, puis égraine (<g> cuit).",
      "Put the rice in a pot with <water> water and {tsp:0.25} salt. Bring to a boil, cover and simmer on low 35 min, until the water is absorbed. Off the heat, rest 5 min covered, then fluff (<g> cooked).") } }),
  I({ id: "quinoa", name: "Quinoa", fr: "Quinoa", cat: "carb", n: [120, 4.4, 21, 0.9, 1.9, 2.8], ok: VEGAN_GF, dry: 3, water: 2, title: ["quinoa"], keep: 4,
    prep: { _: T("Rince <dry> de quinoa dans une passoire fine 30 s pour enlever l’amertume.", "Rinse <dry> quinoa in a fine sieve for 30 s to remove the bitterness.") },
    cook: { boil: C(20, "Mets le quinoa dans une petite casserole avec <water> d’eau et {tsp:0.25} de sel. Porte à ébullition, couvre et laisse mijoter à feu doux 15 min, jusqu’à ce que le germe forme une petite spirale. Laisse reposer 3 min, puis égraine (<g> cuit).",
      "Put the quinoa in a small pot with <water> water and {tsp:0.25} salt. Bring to a boil, cover and simmer on low 15 min, until the germ spirals out. Rest 3 min, then fluff (<g> cooked).") } }),
  I({ id: "sweet-potato", name: "Sweet potato", fr: "Patate douce", cat: "carb", n: [86, 1.6, 20, 4.2, 0.1, 3], ok: VEGAN_GF, title: ["patate douce"], keep: 4,
    prep: { _: T("Brosse <g> de patate douce sous l’eau (garde la pelure pour les fibres) et coupe-la en cubes de 2 cm.", "Scrub <g> sweet potato under water (keep the skin for fiber) and cut it into 2 cm cubes.") },
    cook: {
      roast: C(25, "Enrobe <g> de patate douce de {tsp:1} d’huile et {tsp:0.25} de sel, étale en une seule couche sur la plaque et fais rôtir 25 min en retournant à mi-cuisson, jusqu’à ce que les cubes soient tendres et caramélisés sur les bords.",
        "Toss <g> sweet potato with {tsp:1} oil and {tsp:0.25} salt, spread in a single layer on the tray and roast 25 min, turning halfway, until tender and caramelized at the edges."),
      boil: C(15, "Mets <g> de patate douce dans une casserole d’eau froide salée ({tsp:0.5} de sel), porte à ébullition et cuis 10–12 min, jusqu’à ce qu’un couteau s’y enfonce sans résistance. Égoutte.",
        "Put <g> sweet potato in a pot of cold salted water ({tsp:0.5} salt), bring to a boil and cook 10–12 min, until a knife slides in easily. Drain."),
    } }),
  I({ id: "potatoes", name: "Baby potatoes", fr: "Pommes de terre grelots", cat: "carb", n: [77, 2, 17, 0.8, 0.1, 2.2], ok: VEGAN_GF, title: ["grelots"], keep: 4,
    prep: { _: T("Brosse <g> de pommes de terre grelots et coupe-les en deux (en quatre si elles dépassent 4 cm).", "Scrub <g> baby potatoes and halve them (quarter any bigger than 4 cm).") },
    cook: {
      roast: C(30, "Enrobe <g> de grelots de {tsp:1} d’huile, {tsp:0.25} de sel et {tsp:0.5} de romarin séché; place-les côté coupé en dessous sur la plaque et fais rôtir 28–30 min, jusqu’à ce qu’ils soient dorés et tendres au couteau.",
        "Toss <g> baby potatoes with {tsp:1} oil, {tsp:0.25} salt and {tsp:0.5} dried rosemary; set them cut-side down on the tray and roast 28–30 min, until golden and knife-tender."),
      boil: C(18, "Mets <g> de grelots dans une casserole d’eau froide salée ({tsp:0.5} de sel), porte à ébullition et cuis 15 min, jusqu’à ce qu’un couteau s’y enfonce sans résistance. Égoutte et écrase légèrement avec {tsp:0.25} de sel.",
        "Put <g> baby potatoes in a pot of cold salted water ({tsp:0.5} salt), bring to a boil and cook 15 min, until a knife slides in. Drain and crush lightly with {tsp:0.25} salt."),
    } }),
  I({ id: "pasta", name: "Wholewheat pasta", fr: "Pâtes de blé entier", cat: "carb", n: [124, 5.3, 26, 0.8, 0.5, 4.5], ok: WHEAT, dry: 2.2, title: ["pâtes"], keep: 3,
    prep: { _: T("Pèse <dry> de pâtes de blé entier (penne ou fusilli).", "Weigh <dry> wholewheat pasta (penne or fusilli).") },
    cook: { boil: C(10, "Plonge <dry> de pâtes dans l’eau bouillante salée et cuis 1 min de moins que le temps indiqué sur l’emballage (environ 9 min), en remuant la première minute : elles doivent rester al dente. Garde 125 ml d’eau de cuisson, puis égoutte.",
      "Drop <dry> pasta into the salted boiling water and cook 1 min less than the package says (about 9 min), stirring for the first minute: it should stay al dente. Save 125 ml pasta water, then drain.") } }),
  I({ id: "rice-noodles", name: "Rice noodles", fr: "Nouilles de riz", cat: "carb", n: [108, 0.9, 25, 0, 0.2, 1], ok: VEGAN_GF, dry: 2.5, title: ["nouilles de riz"], keep: 2,
    prep: { _: T("Pèse <dry> de nouilles de riz et fais bouillir 1,5 L d’eau.", "Weigh <dry> rice noodles and bring 1.5 L water to a boil.") },
    cook: { boil: C(5, "Plonge les nouilles dans l’eau bouillante hors du feu et laisse-les tremper 4 min (ou selon l’emballage), jusqu’à ce qu’elles soient souples mais encore fermes. Égoutte, rince à l’eau froide et mélange avec {tsp:0.5} d’huile pour qu’elles ne collent pas.",
      "Put the noodles in the boiling water off the heat and soak 4 min (or per the package), until pliable but still firm. Drain, rinse under cold water and toss with {tsp:0.5} oil so they don’t stick.") } }),
  I({ id: "couscous", name: "Couscous", fr: "Couscous", cat: "carb", n: [112, 3.8, 23, 0.1, 0.2, 1.4], ok: WHEAT, dry: 2.5, water: 1.25, title: ["couscous"], keep: 3,
    prep: { _: T("Mets <dry> de couscous dans un bol résistant à la chaleur avec {tsp:0.25} de sel et {tsp:0.5} d’huile d’olive.", "Put <dry> couscous in a heatproof bowl with {tsp:0.25} salt and {tsp:0.5} olive oil.") },
    cook: { boil: C(6, "Verse <water> d’eau bouillante sur le couscous, couvre d’une assiette et laisse gonfler 5 min, puis égraine à la fourchette (<g> cuit).",
      "Pour <water> boiling water over the couscous, cover with a plate and let it swell 5 min, then fluff with a fork (<g> cooked).") } }),
  I({ id: "bulgur", name: "Bulgur", fr: "Boulgour", cat: "carb", n: [83, 3.1, 19, 0.1, 0.2, 4.5], ok: WHEAT, dry: 3, water: 2, title: ["boulgour"], keep: 4,
    prep: { _: T("Rince <dry> de boulgour moyen.", "Rinse <dry> medium bulgur.") },
    cook: { boil: C(18, "Mets le boulgour dans une petite casserole avec <water> d’eau et {tsp:0.25} de sel; porte à ébullition, couvre et laisse mijoter à feu doux 12 min. Retire du feu, laisse reposer 5 min à couvert, puis égraine (<g> cuit).",
      "Put the bulgur in a small pot with <water> water and {tsp:0.25} salt; bring to a boil, cover and simmer on low 12 min. Off the heat, rest 5 min covered, then fluff (<g> cooked).") } }),
  I({ id: "farro", name: "Farro", fr: "Farro", cat: "carb", n: [130, 5, 26, 0.4, 1, 3.5], ok: WHEAT, dry: 2.5, title: ["farro"], keep: 4,
    prep: { _: T("Rince <dry> de farro et fais bouillir 1 L d’eau avec {tsp:0.5} de sel.", "Rinse <dry> farro and bring 1 L water with {tsp:0.5} salt to a boil.") },
    cook: { boil: C(30, "Plonge le farro dans l’eau bouillante salée et laisse mijoter à découvert 25 min, jusqu’à ce qu’il soit tendre mais encore un peu ferme sous la dent. Égoutte (<g> cuit).",
      "Add the farro to the salted boiling water and simmer uncovered 25 min, until tender but still a little chewy. Drain (<g> cooked).") } }),
  I({ id: "oats", name: "Rolled oats", fr: "Flocons d’avoine", cat: "carb", n: [379, 13, 68, 1, 6.5, 10], ok: VEGAN_GF, title: ["gruau"],
    prep: { _: T("Mesure <g> de flocons d’avoine à l’ancienne.", "Measure <g> old-fashioned rolled oats.") },
    cook: { boil: C(6, "Mets <g> de flocons d’avoine dans une petite casserole avec le lait, une pincée de sel et {tsp:0.5} de cannelle. Porte à frémissement à feu moyen et cuis 4–5 min en remuant pour que ça ne colle pas, jusqu’à consistance crémeuse.",
      "Put <g> oats in a small pot with the milk, a pinch of salt and {tsp:0.5} cinnamon. Bring to a simmer over medium heat and cook 4–5 min, stirring so it doesn’t catch, until creamy.") } }),
  I({ id: "bread", name: "Wholegrain bread", fr: "Pain de grains entiers", cat: "carb", n: [247, 13, 41, 6, 3.4, 7], ok: WHEAT, unit: ["slice", 40], words: ["tranche", "tranches", "slice", "slices"], title: ["pain"],
    prep: { _: T("Sors <n|tranche|tranches> de pain de grains entiers (<g>).", "Have <n|slice|slices> wholegrain bread (<g>) ready.") },
    cook: { raw: C(3, "Fais griller <n|tranche|tranches> de pain 2–3 min au grille-pain, jusqu’à ce qu’elles soient dorées et croustillantes.", "Toast <n|slice|slices> bread 2–3 min, until golden and crisp.") } }),
  I({ id: "tortilla", name: "Wholewheat tortilla", fr: "Tortilla de blé entier", cat: "carb", n: [300, 8, 50, 3, 7, 5], ok: WHEAT, unit: ["wrap", 60], words: ["tortilla", "tortillas", "tortilla", "tortillas"], title: ["tortilla"],
    prep: { _: T("Sors <n|tortilla|tortillas> de blé entier de 25 cm (<g>).", "Have <n|tortilla|tortillas> 25 cm wholewheat tortillas (<g>) ready.") },
    cook: { raw: C(1, "Réchauffe <n|tortilla|tortillas> 20 s par côté dans une poêle sèche à feu moyen-vif, pour qu’elles soient souples.", "Warm <n|tortilla|tortillas> 20 s per side in a dry skillet over medium-high heat, until pliable.") } }),
  I({ id: "corn-tortilla", name: "Corn tortillas", fr: "Tortillas de maïs", cat: "carb", n: [218, 5.7, 45, 0.9, 2.9, 6], ok: VEGAN_GF, unit: ["tortilla", 30], words: ["tortilla", "tortillas", "tortilla", "tortillas"], title: ["tortillas de maïs"],
    prep: { _: T("Sors <n|tortilla|tortillas> de maïs de 15 cm (<g>).", "Have <n|tortilla|tortillas> 15 cm corn tortillas (<g>) ready.") },
    cook: { raw: C(2, "Grille <n|tortilla|tortillas> de maïs 20–30 s par côté directement sur le rond ou dans une poêle sèche très chaude, jusqu’à ce qu’elles soient tachetées; garde-les au chaud dans un linge.", "Char <n|tortilla|tortillas> 20–30 s per side over a gas flame or in a very hot dry skillet, until spotted; keep warm wrapped in a towel.") } }),

  /* ── Vegetables ── */
  I({ id: "broccoli", name: "Broccoli", fr: "Brocoli", cat: "veg", n: [34, 2.8, 7, 1.7, 0.4, 2.6], ok: VEGAN_GF, title: ["brocoli"], keep: 4,
    prep: { _: T("Défais <g> de brocoli en bouquets de 3 cm; pèle la tige et coupe-la en rondelles de 5 mm.", "Cut <g> broccoli into 3 cm florets; peel the stem and slice it 5 mm thick.") },
    cook: {
      roast: C(15, "Enrobe <g> de brocoli de {tsp:1} d’huile et {tsp:0.25} de sel, étale sur la plaque et fais rôtir 15 min, jusqu’à ce que les bords soient grillés et les tiges tendres.",
        "Toss <g> broccoli with {tsp:1} oil and {tsp:0.25} salt, spread on the tray and roast 15 min, until charred at the edges and the stems are tender."),
      steam: C(6, "Porte 2 cm d’eau à ébullition dans une casserole munie d’un panier vapeur. Cuis <g> de brocoli à la vapeur, à couvert, 4–5 min, jusqu’à ce qu’il soit vert vif et tendre-croquant. Sale d’une pincée.",
        "Bring 2 cm water to a boil in a pot fitted with a steamer basket. Steam <g> broccoli, covered, 4–5 min, until bright green and crisp-tender. Add a pinch of salt."),
      stirfry: C(4, "Dans le wok à feu vif avec {tsp:1} d’huile, fais sauter <g> de brocoli 2 min, ajoute 2 c. à soupe d’eau, couvre et laisse cuire 2 min à la vapeur.",
        "In the wok over high heat with {tsp:1} oil, stir-fry <g> broccoli 2 min, add 2 tbsp water, cover and steam 2 min."),
      curry: C(6, "Ajoute <g> de brocoli à la sauce et laisse mijoter 5–6 min, jusqu’à ce qu’il soit tendre-croquant.", "Add <g> broccoli to the sauce and simmer 5–6 min, until crisp-tender."),
      pan: C(5, "Dans la poêle à feu moyen-vif avec {tsp:1} d’huile, fais sauter <g> de brocoli 3 min, ajoute 2 c. à soupe d’eau, couvre et cuis 2 min.", "In the skillet over medium-high heat with {tsp:1} oil, sauté <g> broccoli 3 min, add 2 tbsp water, cover and cook 2 min."),
    } }),
  I({ id: "green-beans", name: "Green beans", fr: "Haricots verts", cat: "veg", n: [31, 1.8, 7, 3.3, 0.2, 2.7], ok: VEGAN_GF, title: ["haricots verts"], keep: 4,
    prep: { _: T("Équeute <g> de haricots verts et coupe-les en deux s’ils dépassent 10 cm.", "Trim the ends off <g> green beans and halve any longer than 10 cm.") },
    cook: {
      steam: C(5, "Cuis <g> de haricots verts à la vapeur ou dans l’eau bouillante salée 3–4 min, jusqu’à ce qu’ils soient vert vif et tendres-croquants; égoutte et mélange avec une pincée de sel.",
        "Steam or blanch <g> green beans in salted boiling water 3–4 min, until bright green and crisp-tender; drain and toss with a pinch of salt."),
      roast: C(15, "Enrobe <g> de haricots verts de {tsp:1} d’huile et {tsp:0.25} de sel et fais-les rôtir 12–15 min sur la plaque, jusqu’à ce qu’ils soient cloqués.",
        "Toss <g> green beans with {tsp:1} oil and {tsp:0.25} salt and roast 12–15 min on the tray, until blistered."),
      stirfry: C(4, "Dans le wok à feu vif avec {tsp:1} d’huile, fais sauter <g> de haricots verts 3–4 min, jusqu’à ce qu’ils soient cloqués par endroits.",
        "In the wok over high heat with {tsp:1} oil, stir-fry <g> green beans 3–4 min, until blistered in spots."),
      curry: C(7, "Ajoute <g> de haricots verts à la sauce et laisse mijoter 6–7 min, jusqu’à ce qu’ils soient tendres.", "Add <g> green beans to the sauce and simmer 6–7 min, until tender."),
    } }),
  I({ id: "asparagus", name: "Asparagus", fr: "Asperges", cat: "veg", n: [20, 2.2, 3.9, 1.9, 0.1, 2.1], ok: VEGAN_GF, title: ["asperges"], keep: 3,
    prep: {
      _: T("Casse la base fibreuse de <g> d’asperges là où elle plie naturellement.", "Snap the woody ends off <g> asparagus where they naturally break."),
      stirfry: T("Casse la base fibreuse de <g> d’asperges et coupe-les en tronçons de 3 cm en biais.", "Snap the woody ends off <g> asparagus and cut on the diagonal into 3 cm pieces."),
      pan: T("Casse la base fibreuse de <g> d’asperges et coupe-les en tronçons de 3 cm.", "Snap the woody ends off <g> asparagus and cut into 3 cm pieces."),
      raw: T("Casse la base fibreuse de <g> d’asperges et tranche-les en fins rubans à l’économe; arrose de quelques gouttes de citron.", "Snap the woody ends off <g> asparagus and shave into thin ribbons with a peeler; add a few drops of lemon."),
    },
    cook: {
      roast: C(10, "Enrobe <g> d’asperges de {tsp:1} d’huile et d’une pincée de sel et fais-les rôtir 8–10 min, jusqu’à ce qu’elles soient tendres et légèrement grillées.",
        "Toss <g> asparagus with {tsp:1} oil and a pinch of salt and roast 8–10 min, until tender and lightly charred."),
      steam: C(5, "Cuis <g> d’asperges à la vapeur, à couvert, 3–4 min, jusqu’à ce qu’elles soient vert vif et tendres-croquantes.", "Steam <g> asparagus, covered, 3–4 min, until bright green and crisp-tender."),
      stirfry: C(4, "Dans le wok à feu vif avec {tsp:1} d’huile, fais sauter <g> d’asperges 3 min.", "In the wok over high heat with {tsp:1} oil, stir-fry <g> asparagus 3 min."),
      pan: C(5, "Dans la poêle à feu moyen-vif avec {tsp:1} d’huile, fais sauter <g> d’asperges 4 min, jusqu’à ce qu’elles soient tendres-croquantes.", "In the skillet over medium-high heat with {tsp:1} oil, sauté <g> asparagus 4 min, until crisp-tender."),
    } }),
  I({ id: "spinach", name: "Spinach", fr: "Épinards", cat: "veg", n: [23, 2.9, 3.6, 0.4, 0.4, 2.2], ok: VEGAN_GF, title: ["épinards"], keep: 2,
    prep: { _: T("Rince et essore <g> de bébés épinards.", "Rinse and spin dry <g> baby spinach.") },
    cook: {
      steam: C(2, "Dans une poêle chaude à feu moyen avec 1 c. à soupe d’eau, fais tomber <g> d’épinards 1–2 min en remuant; sale d’une pincée.", "In a hot skillet over medium heat with 1 tbsp water, wilt <g> spinach 1–2 min, stirring; add a pinch of salt."),
      pan: C(2, "Ajoute <g> d’épinards à la poêle et fais-les tomber 1–2 min en remuant.", "Add <g> spinach to the skillet and wilt 1–2 min, stirring."),
      curry: C(2, "Incorpore <g> d’épinards à la sauce et remue 1–2 min, jusqu’à ce qu’ils soient tombés.", "Stir <g> spinach into the sauce for 1–2 min, until wilted."),
      stirfry: C(1, "Ajoute <g> d’épinards au wok pour les 30 dernières secondes.", "Add <g> spinach to the wok for the last 30 seconds."),
    } }),
  I({ id: "kale", name: "Kale", fr: "Chou kale", cat: "veg", n: [49, 4.3, 8.8, 2.3, 0.9, 3.6], ok: VEGAN_GF, title: ["chou kale"], keep: 3,
    prep: {
      _: T("Retire les côtes de <g> de chou kale et hache les feuilles en lanières de 2 cm.", "Strip <g> kale off its ribs and cut the leaves into 2 cm ribbons."),
      raw: T("Retire les côtes de <g> de chou kale, hache les feuilles en fines lanières et masse-les 1 min avec {tsp:0.5} d’huile d’olive et une pincée de sel pour les attendrir.", "Strip <g> kale off its ribs, slice the leaves thin and massage 1 min with {tsp:0.5} olive oil and a pinch of salt to soften."),
    },
    cook: {
      steam: C(4, "Dans une poêle couverte à feu moyen avec 2 c. à soupe d’eau, fais tomber <g> de chou kale 3–4 min; sale d’une pincée.", "In a covered skillet over medium heat with 2 tbsp water, wilt <g> kale 3–4 min; add a pinch of salt."),
      pan: C(3, "Ajoute <g> de chou kale à la poêle avec 1 c. à soupe d’eau et fais-le tomber 3 min en remuant.", "Add <g> kale to the skillet with 1 tbsp water and wilt 3 min, stirring."),
      roast: C(8, "Enrobe <g> de chou kale de {tsp:1} d’huile et fais-le rôtir 8 min, jusqu’à ce qu’il soit croustillant.", "Toss <g> kale with {tsp:1} oil and roast 8 min, until crisp."),
    } }),
  I({ id: "bell-pepper", name: "Bell peppers", fr: "Poivrons", cat: "veg", n: [31, 1, 6, 4.2, 0.3, 2.1], ok: VEGAN_GF, title: ["poivrons"], keep: 4,
    prep: {
      _: T("Épépine <g> de poivrons et coupe-les en lanières de 1 cm.", "Seed <g> bell peppers and cut into 1 cm strips."),
      raw: T("Épépine <g> de poivrons et tranche-les finement (5 mm).", "Seed <g> bell peppers and slice thin (5 mm)."),
      curry: T("Épépine <g> de poivrons et coupe-les en carrés de 3 cm.", "Seed <g> bell peppers and cut into 3 cm squares."),
    },
    cook: {
      roast: C(20, "Enrobe <g> de poivrons de {tsp:1} d’huile et d’une pincée de sel et fais-les rôtir 20 min, jusqu’à ce qu’ils soient tendres et grillés sur les bords.", "Toss <g> bell peppers with {tsp:1} oil and a pinch of salt and roast 20 min, until soft and charred at the edges."),
      stirfry: C(3, "Dans le wok à feu vif avec {tsp:1} d’huile, fais sauter <g> de poivrons 3 min, jusqu’à ce qu’ils soient tendres-croquants.", "In the wok over high heat with {tsp:1} oil, stir-fry <g> bell peppers 3 min, until crisp-tender."),
      curry: C(8, "Ajoute <g> de poivrons à la sauce et laisse mijoter 7–8 min, jusqu’à ce qu’ils soient tendres.", "Add <g> bell peppers to the sauce and simmer 7–8 min, until tender."),
    } }),
  I({ id: "courgette", name: "Zucchini", fr: "Courgette", cat: "veg", n: [17, 1.2, 3.1, 2.5, 0.3, 1], ok: VEGAN_GF, title: ["courgette"], keep: 3,
    prep: {
      _: T("Coupe les extrémités de <g> de courgette, puis coupe-la en demi-lunes de 1,5 cm.", "Trim <g> zucchini and cut into 1.5 cm half-moons."),
      roast: T("Coupe les extrémités de <g> de courgette, puis coupe-la en morceaux de 3 cm.", "Trim <g> zucchini and cut into 3 cm chunks."),
    },
    cook: {
      roast: C(18, "Enrobe <g> de courgette de {tsp:1} d’huile et d’une pincée de sel et fais-la rôtir 18 min, jusqu’à ce qu’elle soit dorée et tendre.", "Toss <g> zucchini with {tsp:1} oil and a pinch of salt and roast 18 min, until golden and tender."),
      pan: C(5, "Dans la poêle à feu moyen-vif avec {tsp:1} d’huile, fais sauter <g> de courgette 4–5 min, jusqu’à ce qu’elle soit dorée par endroits mais encore ferme.", "In the skillet over medium-high heat with {tsp:1} oil, sauté <g> zucchini 4–5 min, until browned in spots but still firm."),
    } }),
  I({ id: "mushrooms", name: "Mushrooms", fr: "Champignons blancs", cat: "veg", n: [22, 3.1, 3.3, 2, 0.3, 1], ok: VEGAN_GF, title: ["champignons"], keep: 3,
    prep: { _: T("Essuie <g> de champignons avec un papier humide (ne les lave pas) et tranche-les à 5 mm.", "Wipe <g> mushrooms clean with a damp paper towel (don’t soak them) and slice 5 mm thick.") },
    cook: {
      pan: C(6, "Chauffe une poêle à sec à feu moyen-vif. Fais dorer <g> de champignons 5 min sans trop remuer, jusqu’à ce que leur eau soit évaporée et qu’ils soient dorés, puis ajoute {tsp:1} d’huile et une pincée de sel.", "Heat a dry skillet over medium-high heat. Brown <g> mushrooms 5 min without stirring much, until their liquid has cooked off and they are golden, then add {tsp:1} oil and a pinch of salt."),
      roast: C(15, "Enrobe <g> de champignons de {tsp:1} d’huile et fais-les rôtir 15 min, jusqu’à ce qu’ils soient dorés.", "Toss <g> mushrooms with {tsp:1} oil and roast 15 min, until browned."),
      stirfry: C(4, "Dans le wok à feu vif avec {tsp:1} d’huile, fais sauter <g> de champignons 4 min, jusqu’à ce qu’ils soient dorés.", "In the wok over high heat with {tsp:1} oil, stir-fry <g> mushrooms 4 min, until browned."),
      curry: C(8, "Ajoute <g> de champignons à la sauce et laisse mijoter 8 min.", "Add <g> mushrooms to the sauce and simmer 8 min."),
    } }),
  I({ id: "cherry-tomatoes", name: "Cherry tomatoes", fr: "Tomates cerises", cat: "veg", n: [18, 0.9, 3.9, 2.6, 0.2, 1.2], ok: VEGAN_GF, title: ["tomates cerises"], keep: 3,
    prep: { _: T("Rince <g> de tomates cerises et coupe-les en deux.", "Rinse <g> cherry tomatoes and halve them.") },
    cook: {
      pan: C(3, "Ajoute <g> de tomates cerises à la poêle chaude et fais-les cloquer 3 min, jusqu’à ce qu’elles commencent à éclater.", "Add <g> cherry tomatoes to the hot skillet and blister 3 min, until they start to burst."),
      roast: C(15, "Fais rôtir <g> de tomates cerises 15 min avec {tsp:0.5} d’huile, jusqu’à ce qu’elles éclatent.", "Roast <g> cherry tomatoes 15 min with {tsp:0.5} oil, until they burst."),
    } }),
  I({ id: "carrot", name: "Carrot", fr: "Carotte", cat: "veg", n: [41, 0.9, 9.6, 4.7, 0.2, 2.8], ok: VEGAN_GF, title: ["carotte"], keep: 4,
    prep: {
      _: T("Pèle <g> de carotte et coupe-la en bâtonnets de 1 × 6 cm.", "Peel <g> carrot and cut into 1 × 6 cm batons."),
      raw: T("Pèle <g> de carotte et râpe-la grossièrement (ou taille-la en rubans à l’économe).", "Peel <g> carrot and grate it coarsely (or shave into ribbons with a peeler)."),
      stirfry: T("Pèle <g> de carotte et taille-la en allumettes de 5 mm.", "Peel <g> carrot and cut into 5 mm matchsticks."),
      steam: T("Pèle <g> de carotte et coupe-la en rondelles de 1 cm.", "Peel <g> carrot and slice into 1 cm rounds."),
    },
    cook: {
      roast: C(25, "Enrobe <g> de carotte de {tsp:1} d’huile et d’une pincée de sel et fais-la rôtir 25 min, jusqu’à ce qu’elle soit tendre et caramélisée.", "Toss <g> carrot with {tsp:1} oil and a pinch of salt and roast 25 min, until tender and caramelized."),
      stirfry: C(4, "Dans le wok à feu vif avec {tsp:1} d’huile, fais sauter <g> de carotte 3–4 min.", "In the wok over high heat with {tsp:1} oil, stir-fry <g> carrot 3–4 min."),
      steam: C(7, "Cuis <g> de carotte à la vapeur, à couvert, 6 min, jusqu’à ce qu’un couteau s’y enfonce facilement.", "Steam <g> carrot, covered, 6 min, until a knife slides in easily."),
    } }),
  I({ id: "cucumber", name: "Cucumber", fr: "Concombre", cat: "veg", n: [15, 0.7, 3.6, 1.7, 0.1, 0.5], ok: VEGAN_GF, title: ["concombre"],
    prep: { _: T("Coupe <g> de concombre en demi-rondelles de 5 mm (ou en bâtonnets de 1 × 8 cm pour tremper).", "Cut <g> cucumber into 5 mm half-moons (or 1 × 8 cm sticks for dipping).") } }),
  I({ id: "red-cabbage", name: "Red cabbage", fr: "Chou rouge", cat: "veg", n: [31, 1.4, 7.4, 3.8, 0.2, 2.1], ok: VEGAN_GF, title: ["chou rouge"], keep: 4,
    prep: {
      _: T("Émince <g> de chou rouge très finement (2 mm) et mélange avec une pincée de sel et le jus de ¼ de lime.", "Shred <g> red cabbage very thin (2 mm) and toss with a pinch of salt and the juice of ¼ lime."),
      stirfry: T("Émince <g> de chou rouge en lanières de 5 mm.", "Slice <g> red cabbage into 5 mm ribbons."),
    },
    cook: { stirfry: C(3, "Dans le wok à feu vif avec {tsp:1} d’huile, fais sauter <g> de chou rouge 3 min, jusqu’à ce qu’il soit tout juste tombé.", "In the wok over high heat with {tsp:1} oil, stir-fry <g> red cabbage 3 min, until just wilted.") } }),
  I({ id: "cauliflower", name: "Cauliflower", fr: "Chou-fleur", cat: "veg", n: [25, 1.9, 5, 1.9, 0.3, 2], ok: VEGAN_GF, title: ["chou-fleur"], keep: 4,
    prep: { _: T("Défais <g> de chou-fleur en bouquets de 3 cm.", "Break <g> cauliflower into 3 cm florets.") },
    cook: {
      roast: C(22, "Enrobe <g> de chou-fleur de {tsp:1} d’huile, {tsp:0.25} de sel et {tsp:0.5} de cumin et fais-le rôtir 22 min, jusqu’à ce qu’il soit bien doré.", "Toss <g> cauliflower with {tsp:1} oil, {tsp:0.25} salt and {tsp:0.5} cumin and roast 22 min, until deeply browned."),
      curry: C(12, "Ajoute <g> de chou-fleur à la sauce et laisse mijoter 12 min, à couvert, jusqu’à ce qu’il soit tendre au couteau.", "Add <g> cauliflower to the sauce and simmer 12 min, covered, until knife-tender."),
      steam: C(7, "Cuis <g> de chou-fleur à la vapeur, à couvert, 5–6 min, jusqu’à ce qu’il soit tendre-croquant.", "Steam <g> cauliflower, covered, 5–6 min, until crisp-tender."),
    } }),
  I({ id: "edamame", name: "Edamame", fr: "Edamames écossés", cat: "veg", n: [121, 11, 9, 2.2, 5, 5.2], ok: VEGAN_GF, title: ["edamames"], keep: 3,
    prep: { _: T("Décongèle <g> d’edamames écossés 2 min au micro-ondes (ou 3 min dans l’eau bouillante), égoutte et sale d’une pincée.", "Thaw <g> shelled edamame 2 min in the microwave (or 3 min in boiling water), drain and add a pinch of salt.") },
    cook: { stirfry: C(2, "Ajoute <g> d’edamames au wok et fais sauter 2 min.", "Add <g> edamame to the wok and stir-fry 2 min.") } }),
  I({ id: "leaves", name: "Mixed leaves", fr: "Mesclun", cat: "veg", n: [17, 1.5, 3, 1, 0.2, 1.5], ok: VEGAN_GF, title: ["mesclun"],
    prep: { _: T("Rince et essore bien <g> de mesclun.", "Rinse and spin dry <g> mixed leaves.") } }),
  I({ id: "red-onion", name: "Red onion", fr: "Oignon rouge", cat: "veg", n: [40, 1.1, 9.3, 4.2, 0.1, 1.7], ok: VEGAN_GF, title: ["oignon rouge"], keep: 4,
    prep: {
      _: T("Émince <g> d’oignon rouge très finement et fais-le tremper 2 min dans le jus de ½ citron pour l’adoucir.", "Slice <g> red onion paper-thin and soak 2 min in the juice of ½ lemon to tame it."),
      roast: T("Coupe <g> d’oignon rouge en quartiers de 2 cm en gardant la base pour qu’ils se tiennent.", "Cut <g> red onion into 2 cm wedges, keeping the root so they hold together."),
    },
    cook: { roast: C(20, "Enrobe <g> d’oignon rouge de {tsp:1} d’huile et fais-le rôtir 20 min, jusqu’à ce qu’il soit tendre et caramélisé.", "Toss <g> red onion with {tsp:1} oil and roast 20 min, until soft and caramelized.") } }),
  I({ id: "bok-choy", name: "Bok choy", fr: "Bok choy", cat: "veg", n: [13, 1.5, 2.2, 1.2, 0.2, 1], ok: VEGAN_GF, title: ["bok choy"], keep: 2,
    prep: { _: T("Coupe <g> de bok choy en deux sur la longueur et rince bien entre les feuilles.", "Halve <g> bok choy lengthwise and rinse well between the leaves.") },
    cook: { stirfry: C(3, "Dans le wok à feu vif avec {tsp:1} d’huile, dépose <g> de bok choy côté coupé en dessous 2 min, retourne et poursuis 1 min.", "In the wok over high heat with {tsp:1} oil, lay <g> bok choy cut-side down for 2 min, flip and cook 1 min more.") } }),

  /* ── Sauces & fats (per 100 g) ── */
  I({ id: "olive-oil", name: "Olive oil", fr: "Huile d’olive extra-vierge", cat: "sauce", n: [884, 0, 0, 0, 100, 0], ok: VEGAN_GF, unit: ["tbsp", 14], title: ["huile d’olive"],
    prep: { _: T("Mesure <g> d’huile d’olive extra-vierge pour arroser au service, avec le jus de ½ citron et {tsp:0.25} de sel.", "Measure <g> extra-virgin olive oil for drizzling at the end, with the juice of ½ lemon and {tsp:0.25} salt."),
      pan: T("", ""), curry: T("", "") },
    cook: {
      // Used as the cooking fat when a recipe counts it (eggs on toast, curry).
      pan: C(1, "Chauffe <g> d’huile d’olive dans une poêle antiadhésive à feu moyen-doux, 1 min.", "Heat <g> olive oil in a non-stick skillet over medium-low heat, 1 min."),
      curry: C(1, "Chauffe <g> d’huile d’olive dans une grande poêle profonde à feu moyen, puis fais revenir {tbsp:2} de pâte de cari rouge 1 min en remuant, jusqu’à ce qu’elle embaume.", "Heat <g> olive oil in a large deep skillet over medium heat, then fry {tbsp:2} red curry paste 1 min, stirring, until fragrant."),
    } }),
  I({ id: "tahini-lemon", name: "Tahini-lemon dressing", fr: "Sauce tahini-citron", cat: "sauce", n: [450, 12, 12, 1, 40, 5], ok: VEGAN_GF, unit: ["tbsp", 15], title: ["sauce tahini-citron"],
    prep: { _: T("Sauce tahini-citron (<g>) : fouette <g*0.45> de tahini, <g*0.25> de jus de citron, <g*0.3> d’eau froide, ¼ de gousse d’ail râpée et une pincée de sel jusqu’à consistance lisse et nappante.", "Tahini-lemon sauce (<g>): whisk <g*0.45> tahini, <g*0.25> lemon juice, <g*0.3> cold water, ¼ garlic clove (grated) and a pinch of salt until smooth and pourable.") } }),
  I({ id: "peanut-sauce", name: "Peanut sauce", fr: "Sauce aux arachides", cat: "sauce", n: [380, 12, 20, 10, 28, 3], ok: VEGAN_GF, unit: ["tbsp", 16], title: ["sauce aux arachides"],
    prep: { _: T("Sauce aux arachides (<g>) : mélange <g*0.4> de beurre d’arachide naturel, <g*0.15> de sauce tamari, <g*0.1> de jus de lime, <g*0.05> de sirop d’érable et <g*0.3> d’eau tiède jusqu’à ce que ce soit lisse.", "Peanut sauce (<g>): stir <g*0.4> natural peanut butter, <g*0.15> tamari, <g*0.1> lime juice, <g*0.05> maple syrup and <g*0.3> warm water until smooth.") } }),
  I({ id: "soy-ginger", name: "Soy-ginger sauce", fr: "Sauce soya-gingembre", cat: "sauce", n: [90, 5, 12, 8, 1, 0.5], ok: WHEAT, unit: ["tbsp", 15], title: ["sauce soya-gingembre"],
    prep: { _: T("Sauce soya-gingembre (<g>) : mélange <g*0.5> de sauce soya, <g*0.2> de vinaigre de riz, <g*0.1> de miel, <g*0.1> de gingembre frais râpé et <g*0.1> d’ail râpé.", "Soy-ginger sauce (<g>): stir together <g*0.5> soy sauce, <g*0.2> rice vinegar, <g*0.1> honey, <g*0.1> grated fresh ginger and <g*0.1> grated garlic.") } }),
  I({ id: "teriyaki", name: "Teriyaki glaze", fr: "Sauce teriyaki", cat: "sauce", n: [130, 5, 25, 20, 0.5, 0], ok: WHEAT, unit: ["tbsp", 15], title: ["teriyaki"],
    prep: { _: T("Mesure <g> de sauce teriyaki et allonge-la de 1 c. à soupe d’eau.", "Measure <g> teriyaki sauce and loosen it with 1 tbsp water.") } }),
  I({ id: "pesto", name: "Basil pesto", fr: "Pesto au basilic", cat: "sauce", n: [450, 5, 6, 1, 45, 2], ok: VEGD, unit: ["tbsp", 15], title: ["pesto"],
    prep: { _: T("Mesure <g> de pesto au basilic.", "Measure <g> basil pesto.") } }),
  I({ id: "yogurt-herb", name: "Yogurt-herb sauce", fr: "Sauce yogourt et fines herbes", cat: "sauce", n: [90, 8, 5, 4, 4, 0], ok: VEGD, unit: ["tbsp", 15], title: ["sauce yogourt-fines herbes"],
    prep: { _: T("Sauce yogourt et fines herbes (<g>) : mélange <g*0.8> de yogourt grec, <g*0.1> de jus de citron, <g*0.08> d’aneth ou de persil haché, <g*0.02> d’ail râpé et une pincée de sel.", "Yogurt-herb sauce (<g>): stir <g*0.8> Greek yogurt, <g*0.1> lemon juice, <g*0.08> chopped dill or parsley, <g*0.02> grated garlic and a pinch of salt.") } }),
  I({ id: "salsa", name: "Salsa", fr: "Salsa", cat: "sauce", n: [36, 1.5, 7, 4, 0.2, 1.5], ok: VEGAN_GF, unit: ["tbsp", 16], title: ["salsa"],
    prep: { _: T("Mesure <g> de salsa.", "Measure <g> salsa.") } }),
  I({ id: "avocado", name: "Avocado", fr: "Avocat", cat: "sauce", n: [160, 2, 8.5, 0.7, 15, 6.7], ok: VEGAN_GF, unit: ["half", 70], words: ["demi-avocat", "demi-avocats", "avocado half", "avocado halves"], title: ["avocat"],
    prep: { _: T("Coupe <g> d’avocat bien mûr (il cède sous une légère pression) en tranches de 5 mm, ou écrase-le à la fourchette avec une pincée de sel et quelques gouttes de jus de lime.", "Slice <g> ripe avocado (it gives under gentle pressure) 5 mm thick, or mash it with a fork with a pinch of salt and a few drops of lime juice.") } }),
  I({ id: "feta", name: "Feta", fr: "Feta", cat: "sauce", n: [264, 14, 4, 4, 21, 0], ok: VEGD, unit: ["30 g", 30], title: ["feta"],
    prep: { _: T("Émiette <g> de feta.", "Crumble <g> feta.") } }),
  I({ id: "parmesan", name: "Parmesan", fr: "Parmesan", cat: "sauce", n: [431, 38, 4, 0.9, 29, 0], ok: VEGD, unit: ["20 g", 20], title: ["parmesan"],
    prep: { _: T("Râpe finement <g> de parmesan.", "Finely grate <g> parmesan.") } }),
  I({ id: "hummus", name: "Hummus", fr: "Houmous", cat: "sauce", n: [166, 8, 14, 0.3, 10, 6], ok: VEGAN_GF, unit: ["tbsp", 25], title: ["houmous"],
    prep: { _: T("Mesure <g> de houmous.", "Measure <g> hummus.") } }),
  I({ id: "coconut-curry", name: "Coconut curry sauce", fr: "Sauce cari et lait de coco", cat: "sauce", n: [120, 1.5, 6, 3, 10, 1], ok: VEGAN_GF, unit: ["ml", 1], title: ["cari coco"],
    prep: { _: T("Mesure <ml> de lait de coco léger (bien agité) et {tbsp:2} de pâte de cari rouge.", "Measure <ml> light coconut milk (shaken well) and {tbsp:2} red curry paste.") },
    cook: { curry: C(3, "Verse <ml> de lait de coco léger, gratte le fond de la poêle et porte à frémissement à feu moyen, 2–3 min.", "Pour in <ml> light coconut milk, scrape the bottom of the pan and bring to a gentle simmer over medium heat, 2–3 min.") } }),
  I({ id: "chimichurri", name: "Chimichurri", fr: "Chimichurri", cat: "sauce", n: [420, 1, 4, 1, 45, 1], ok: VEGAN_GF, unit: ["tbsp", 15], title: ["chimichurri"],
    prep: { _: T("Chimichurri (<g>) : hache très finement <g*0.3> de persil plat et <g*0.05> d’ail, puis mélange avec <g*0.45> d’huile d’olive, <g*0.15> de vinaigre de vin rouge, une pincée d’origan séché, de flocons de piment et de sel.", "Chimichurri (<g>): finely chop <g*0.3> flat-leaf parsley and <g*0.05> garlic, then stir with <g*0.45> olive oil, <g*0.15> red wine vinegar, and a pinch each of dried oregano, chili flakes and salt.") } }),
  I({ id: "sriracha-lime", name: "Sriracha-lime", fr: "Sauce sriracha-lime", cat: "sauce", n: [60, 1, 12, 10, 0.5, 0.5], ok: VEGAN_GF, unit: ["tbsp", 15], title: ["sriracha-lime"],
    prep: { _: T("Sauce sriracha-lime (<g>) : mélange <g*0.6> de sriracha, <g*0.3> de jus de lime et <g*0.1> de sirop d’érable.", "Sriracha-lime (<g>): stir <g*0.6> sriracha, <g*0.3> lime juice and <g*0.1> maple syrup.") } }),
  I({ id: "tomato-sauce", name: "Tomato passata", fr: "Coulis de tomates (passata)", cat: "sauce", n: [35, 1.5, 7, 4.5, 0.2, 1.5], ok: VEGAN_GF, unit: ["ml", 1], title: ["sauce tomate"],
    prep: { _: T("Mesure <ml> de coulis de tomates (passata) et râpe 1 gousse d’ail.", "Measure <ml> tomato passata and grate 1 garlic clove.") },
    cook: { pasta: C(10, "Dans une petite casserole à feu moyen, verse <ml> de passata avec l’ail, une pincée de flocons de piment et {tsp:0.25} de sel; laisse mijoter 10 min à découvert, jusqu’à ce que la sauce épaississe.", "In a small pot over medium heat, add <ml> passata with the garlic, a pinch of chili flakes and {tsp:0.25} salt; simmer 10 min uncovered, until it thickens.") } }),
  I({ id: "peanut-butter", name: "Peanut butter", fr: "Beurre d’arachide", cat: "sauce", n: [588, 25, 20, 9, 50, 6], ok: VEGAN_GF, unit: ["tbsp", 16], title: ["beurre d’arachide"],
    prep: { _: T("Mesure <g> de beurre d’arachide naturel (bien mélangé).", "Measure <g> natural peanut butter (stirred well).") } }),
  I({ id: "cream-cheese", name: "Light cream cheese", fr: "Fromage à la crème léger", cat: "sauce", n: [200, 7, 6, 4, 17, 0], ok: VEGD, unit: ["tbsp", 20], title: ["fromage à la crème"],
    prep: { _: T("Laisse ramollir <g> de fromage à la crème léger 5 min à la température ambiante.", "Let <g> light cream cheese soften 5 min at room temperature.") } }),

  /* ── Fruit ── */
  I({ id: "banana", name: "Banana", fr: "Banane", cat: "fruit", n: [89, 1.1, 23, 12, 0.3, 2.6], ok: VEGAN_GF, unit: ["banana", 120], words: ["banane", "bananes", "banana", "bananas"], title: ["banane"],
    prep: { _: T("Pèle et tranche <g> de banane (<n|banane|bananes>) en rondelles de 1 cm.", "Peel and slice <g> banana (<n|banana|bananas>) into 1 cm rounds.") } }),
  I({ id: "blueberries", name: "Blueberries", fr: "Bleuets", cat: "fruit", n: [57, 0.7, 14.5, 10, 0.3, 2.4], ok: VEGAN_GF, title: ["bleuets"],
    prep: { _: T("Rince et égoutte <g> de bleuets (frais ou surgelés).", "Rinse and drain <g> blueberries (fresh or frozen).") } }),
  I({ id: "strawberries", name: "Strawberries", fr: "Fraises", cat: "fruit", n: [32, 0.7, 7.7, 4.9, 0.3, 2], ok: VEGAN_GF, title: ["fraises"],
    prep: { _: T("Rince <g> de fraises, équeute-les et coupe-les en quatre.", "Rinse <g> strawberries, hull them and quarter.") } }),
  I({ id: "apple", name: "Apple", fr: "Pomme", cat: "fruit", n: [52, 0.3, 14, 10, 0.2, 2.4], ok: VEGAN_GF, unit: ["apple", 180], words: ["pomme", "pommes", "apple", "apples"], title: ["pomme"],
    prep: { _: T("Rince <g> de pomme, retire le cœur et coupe-la en tranches de 5 mm (ou en dés de 1 cm).", "Rinse <g> apple, core it and cut into 5 mm slices (or 1 cm dice).") } }),
  I({ id: "mango", name: "Mango", fr: "Mangue", cat: "fruit", n: [60, 0.8, 15, 14, 0.4, 1.6], ok: VEGAN_GF, title: ["mangue"],
    prep: { _: T("Coupe <g> de mangue (fraîche ou surgelée) en dés de 1,5 cm.", "Cut <g> mango (fresh or frozen) into 1.5 cm dice.") } }),
  I({ id: "pineapple", name: "Pineapple", fr: "Ananas", cat: "fruit", n: [50, 0.5, 13, 10, 0.1, 1.4], ok: VEGAN_GF, title: ["ananas"],
    prep: { _: T("Coupe <g> d’ananas en dés de 1,5 cm.", "Cut <g> pineapple into 1.5 cm dice.") } }),
  I({ id: "kiwi", name: "Kiwi", fr: "Kiwi", cat: "fruit", n: [61, 1.1, 15, 9, 0.5, 3], ok: VEGAN_GF, unit: ["kiwi", 75], words: ["kiwi", "kiwis", "kiwi", "kiwis"], title: ["kiwi"],
    prep: { _: T("Pèle <g> de kiwi (<n|kiwi|kiwis>) et coupe-le en demi-rondelles.", "Peel <g> kiwi (<n|kiwi|kiwis>) and cut into half-moons.") } }),
  I({ id: "orange", name: "Orange", fr: "Orange", cat: "fruit", n: [47, 0.9, 12, 9, 0.1, 2.4], ok: VEGAN_GF, unit: ["orange", 150], words: ["orange", "oranges", "orange", "oranges"], title: ["orange"],
    prep: { _: T("Pèle <g> d’orange (<n|orange|oranges>) et sépare-la en quartiers.", "Peel <g> orange (<n|orange|oranges>) and pull it into segments.") } }),
  I({ id: "raspberries", name: "Raspberries", fr: "Framboises", cat: "fruit", n: [52, 1.2, 12, 4.4, 0.7, 6.5], ok: VEGAN_GF, title: ["framboises"],
    prep: { _: T("Rince délicatement <g> de framboises.", "Gently rinse <g> raspberries.") } }),

  /* ── Dairy & extras ── */
  I({ id: "milk", name: "Milk 2%", fr: "Lait 2 %", cat: "dairy", n: [50, 3.4, 4.8, 4.8, 2, 0], ok: VEGD, unit: ["ml", 1], title: ["lait 2 %"],
    prep: { _: T("Mesure <ml> de lait 2 %.", "Measure <ml> 2% milk.") } }),
  I({ id: "oat-milk", name: "Oat milk", fr: "Boisson d’avoine", cat: "dairy", n: [45, 1, 7, 4, 1.5, 0.8], ok: VEGAN_GF, unit: ["ml", 1], title: ["boisson d’avoine"],
    prep: { _: T("Mesure <ml> de boisson d’avoine.", "Measure <ml> oat milk.") } }),
  I({ id: "honey", name: "Honey", fr: "Miel", cat: "extra", n: [304, 0.3, 82, 82, 0, 0], ok: VEGD, unit: ["tsp", 7], title: ["miel"],
    prep: { _: T("Mesure <g> de miel.", "Measure <g> honey.") } }),
  I({ id: "maple", name: "Maple syrup", fr: "Sirop d’érable", cat: "extra", n: [260, 0, 67, 60, 0, 0], ok: VEGAN_GF, unit: ["tsp", 7], title: ["sirop d’érable"],
    prep: { _: T("Mesure <g> de sirop d’érable.", "Measure <g> maple syrup.") } }),
  I({ id: "chia", name: "Chia seeds", fr: "Graines de chia", cat: "extra", n: [486, 17, 42, 0, 31, 34], ok: VEGAN_GF, unit: ["tbsp", 12], title: ["chia"],
    prep: { _: T("Mesure <g> de graines de chia.", "Measure <g> chia seeds.") } }),
  I({ id: "granola", name: "Granola", fr: "Granola", cat: "extra", n: [471, 10, 64, 20, 20, 7], ok: WHEAT, title: ["granola"],
    prep: { _: T("Mesure <g> de granola.", "Measure <g> granola.") } }),
  I({ id: "almonds", name: "Almonds", fr: "Amandes", cat: "extra", n: [579, 21, 22, 4.4, 50, 12.5], ok: VEGAN_GF, title: ["amandes"],
    prep: { _: T("Pèse <g> d’amandes et hache-les grossièrement.", "Weigh <g> almonds and chop them roughly.") } }),
  I({ id: "walnuts", name: "Walnuts", fr: "Noix de Grenoble", cat: "extra", n: [654, 15, 14, 2.6, 65, 6.7], ok: VEGAN_GF, title: ["noix de Grenoble"],
    prep: { _: T("Pèse <g> de noix de Grenoble et brise-les en morceaux.", "Weigh <g> walnuts and break them into pieces.") } }),
  I({ id: "dark-chocolate", name: "Dark chocolate 70%", fr: "Chocolat noir 70 %", cat: "extra", n: [598, 7.8, 46, 24, 43, 11], ok: VEGAN_GF, title: ["chocolat noir"],
    prep: { _: T("Hache <g> de chocolat noir 70 % en copeaux.", "Chop <g> 70% dark chocolate into shards.") } }),
  I({ id: "rice-cakes", name: "Rice cakes", fr: "Galettes de riz", cat: "carb", n: [387, 8, 82, 1, 3, 4], ok: VEGAN_GF, unit: ["cake", 9], words: ["galette", "galettes", "rice cake", "rice cakes"], title: ["galettes de riz"],
    prep: { _: T("Sors <n|galette|galettes> de riz (<g>).", "Have <n|rice cake|rice cakes> (<g>) ready.") } }),
  I({ id: "cinnamon", name: "Cinnamon", fr: "Cannelle", cat: "extra", n: [247, 4, 81, 2, 1.2, 53], ok: VEGAN_GF, unit: ["tsp", 2.6], title: ["cannelle"],
    prep: { _: T("Mesure <g> de cannelle moulue.", "Measure <g> ground cinnamon.") } }),
];

export const ING: Record<string, Ingredient> = Object.fromEntries(INGREDIENTS.map((i) => [i.id, i]));
export const byCat = (cat: Cat) => INGREDIENTS.filter((i) => i.cat === cat);

/** Dry weight of a grain for a cooked amount, rounded the way the list shows it. */
export const dryGrams = (i: Ingredient, grams: number) => Math.round(grams / (i.dry ?? 1) / 5) * 5;

/** Human measure for a gram amount of an ingredient (plain English text, kept for older callers). */
export function measure(i: Ingredient, grams: number) {
  if (i.unit) {
    const [label, g] = i.unit;
    if (label === "ml") return `${Math.round(grams / 10) * 10} ml`;
    const n = grams / g;
    const nice = n >= 1 ? (Math.round(n * 2) / 2).toString() : `${Math.round(n * 4) / 4}`;
    return `${nice} ${label}${n > 1.25 && !/g$/.test(label) ? "s" : ""}${label.endsWith("g") ? "" : ` (${Math.round(grams)} g)`}`;
  }
  if (i.dry) return `${dryGrams(i, grams)} g dry (≈${Math.round(grams / 10) * 10} g cooked)`;
  return `${Math.round(grams / 5) * 5} g`;
}

/** The same measure as a scalable token string, in a language: "{g:80} dry (≈ {g:240} cooked)". */
export function measureTok(i: Ingredient, grams: number, lang: "fr" | "en"): string {
  const fr = lang === "fr";
  if (i.unit) {
    const [label, g] = i.unit;
    if (label === "ml") return `{ml:${grams}}`;
    if (label === "tbsp") return `{tbsp:${+(grams / g).toFixed(2)}} ({g:${grams}})`;
    if (label === "tsp") return `{tsp:${+(grams / g).toFixed(2)}} ({g:${grams}})`;
    if (label.endsWith("g") || !i.words) return `{g:${grams}}`;
    const n = grams / g;
    if (n < 0.75) return `{g:${grams}}`;
    const [f1, fN, e1, eN] = i.words;
    return `{n:${+n.toFixed(2)}|${fr ? f1 : e1}|${fr ? fN : eN}} ({g:${grams}})`;
  }
  if (i.dry) return fr ? `{g:${dryGrams(i, grams)}} sec (≈ {g:${grams}} cuit)` : `{g:${dryGrams(i, grams)}} dry (≈ {g:${grams}} cooked)`;
  return `{g:${grams}}`;
}

/** Fill an ingredient's placeholders with its grams in this recipe, as tokens. */
export function fill(text: string, i: Ingredient, grams: number): string {
  return text.replace(/<(g|dry|water|ml|n)(?:\*([\d.]+))?(?:\|([^|>]*)\|([^>]*))?>/g, (_m, k: string, mul?: string, one?: string, many?: string) => {
    const f = mul ? Number(mul) : 1;
    switch (k) {
      case "g": return `{g:${+(grams * f).toFixed(1)}}`;
      case "dry": return `{g:${dryGrams(i, grams)}}`;
      case "water": return `{ml:${Math.round(dryGrams(i, grams) * (i.water ?? 2))}}`;
      case "ml": return `{ml:${+(grams * f).toFixed(1)}}`;
      default: {
        const n = grams / (i.unit?.[1] ?? grams);
        return one == null ? `{n:${+n.toFixed(2)}}` : `{n:${+n.toFixed(2)}|${one}|${many}}`;
      }
    }
  });
}
