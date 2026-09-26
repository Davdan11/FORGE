/* ─────────────────────────────────────────────────────────────
   FORGE Ride (the Unity game) as the Indoor page presents it:
   its nine routes and its event schedule. Both mirror the game —
   RideRouteCatalog.cs and RideEvents.Scheduled in FORGE-Unity —
   so the page and the game always announce the same thing. The
   schedule test pins values computed by the game itself.
   ───────────────────────────────────────────────────────────── */

export type Lang = "fr" | "en";

export interface GameRoute {
  id: number;
  key: string;
  name: Record<Lang, string>;
  country: Record<Lang, string>;
  level: Record<Lang, string>;
  about: Record<Lang, string>;
  km: number;
  gainM: number;
  accent: string;
  image: string;
  challenge?: boolean;
  /** A circuit: `km` is one lap, ridden as many times as the rider chooses. */
  loop?: boolean;
  /** Free ride: no length, a junction every 6 km where the rider picks the next country. */
  free?: boolean;
  /** A real road (real track, relief and towns, from OpenStreetMap and public elevation data). */
  real?: boolean;
}

const r = (id: number, name: [string, string], country: [string, string], level: [string, string], about: [string, string], km: number, gainM: number, accent: string, image: string, challenge = false, loop = false): GameRoute =>
  ({ id, key: `c${id}`, name: { fr: name[0], en: name[1] }, country: { fr: country[0], en: country[1] }, level: { fr: level[0], en: level[1] }, about: { fr: about[0], en: about[1] }, km, gainM, accent, image: `/indoor/${image}.jpg`, challenge, loop });

/** The game's catalog, in its order. Gains are the game's own figures. */
export const GAME_ROUTES: GameRoute[] = [
  r(0, ["Polders", "Polders"], ["Pays-Bas", "Netherlands"], ["Débutant", "Beginner"], ["Plaines, canaux et moulins", "Flatlands, canals and windmills"], 20, 19, "#FF9638", "polders"),
  r(1, ["Sakura Valley", "Sakura Valley"], ["Japon", "Japan"], ["Débutant +", "Beginner +"], ["Vallée douce et portiques rouges", "Gentle valley and red gates"], 20, 132, "#FF85AD", "sakura"),
  r(2, ["Provence", "Provence"], ["France", "France"], ["Intermédiaire", "Intermediate"], ["Petites côtes et champs de lavande", "Short hills and lavender fields"], 40, 276, "#AD94FF", "provence"),
  r(3, ["Collines Toscanes", "Tuscan Hills"], ["Italie", "Italy"], ["Sportif", "Athletic"], ["Vignobles et collines successives", "Vineyards and rolling hills"], 40, 628, "#FFB861", "tuscan"),
  r(4, ["Alpine Pass", "Alpine Pass"], ["Suisse", "Switzerland"], ["Avancé", "Advanced"], ["Longs cols et vallées alpines", "Long climbs and alpine valleys"], 60, 1939, "#E8F2FF", "alpine"),
  r(5, ["Pine Ridge", "Pine Ridge"], ["Canada", "Canada"], ["Expert", "Expert"], ["Le Grand Tour montagneux original", "The original mountain Grand Tour"], 100, 3101, "#2EF0DE", "pine"),
  r(6, ["Mur de Montalcino", "Montalcino Wall"], ["Italie", "Italy"], ["Défi · montée", "Challenge · climb"], ["8 km : la route se cabre jusqu'au sommet", "8 km: the road rears up to the summit"], 8, 336, "#FF4D5E", "montalcino", true),
  r(7, ["Critérium des Polders", "Polders Criterium"], ["Pays-Bas", "Netherlands"], ["Défi · sprint", "Challenge · sprint"], ["12 km tout plat, deux sprints chronométrés", "12 km dead flat, two timed sprints"], 12, 3, "#74EB8A", "criterium", true),
  r(8, ["Col du Géant", "Giant's Pass"], ["Suisse", "Switzerland"], ["Défi · hors catégorie", "Challenge · HC"], ["25 km, 1 400 m de montée à 7 %", "25 km, 1,400 m of climbing at 7%"], 25, 1424, "#FF2E78", "giant", true),
  // Circuits: km and gain are per lap.
  r(9, ["Circuit des Moulins", "Windmill Circuit"], ["Pays-Bas", "Netherlands"], ["Circuit · plat", "Circuit · flat"], ["Boucle de 10 km au ras des canaux, tours au choix", "10 km loop along the canals, as many laps as you like"], 10, 4, "#FFC733", "polders", false, true),
  r(10, ["Boucle du Luberon", "Luberon Loop"], ["France", "France"], ["Circuit · vallonné", "Circuit · rolling"], ["Boucle de 15 km qui ondule entre les lavandes", "15 km loop rolling through the lavender"], 15, 174, "#CC8CFF", "provence", false, true),
  r(11, ["Anello del Chianti", "Chianti Ring"], ["Italie", "Italy"], ["Circuit · course", "Circuit · race"], ["Boucle de 12 km et son mur à chaque tour", "12 km loop with its steep wall every lap"], 12, 128, "#FF6B4D", "tuscan", false, true),
  // A long route through four countries.
  r(12, ["Grand Tour d'Europe", "Grand Tour of Europe"], ["Europe", "Europe"], ["Grand Tour · 4 pays", "Grand Tour · 4 countries"], ["Pays-Bas, France, Italie puis la Suisse", "Netherlands, France, Italy, then Switzerland"], 100, 1388, "#59D9FF", "alpine"),
  r(13, ["Balade libre", "Free ride"], ["Europe", "Europe"], ["Sans fin · carrefours", "Endless · junctions"], ["Sans fin : à chaque carrefour, choisis ta route et ton pays", "Endless: at every junction, pick your road and your country"], 0, 0, "#8CFF8C", "polders"),
];
GAME_ROUTES[13].free = true;
// Real French roads, climbs and stages (the game's "Real France" page).
const real = (id: number, name: [string, string], level: [string, string], about: [string, string], km: number, gainM: number, accent: string, image: string) =>
  ({ ...r(id, name, ["France", "France"], level, about, km, gainM, accent, image), real: true });
GAME_ROUTES.push(
  real(14, ["Alpe d'Huez", "Alpe d'Huez"], ["Col réel · 21 lacets", "Real climb · 21 hairpins"], ["La vraie montée depuis Bourg-d'Oisans", "The real climb from Bourg-d'Oisans"], 14, 1132, "#FFD94D", "giant"),
  real(15, ["Mont Ventoux", "Mont Ventoux"], ["Col réel · Provence", "Real climb · Provence"], ["Depuis Bédoin, jusqu'aux pierres du sommet", "From Bédoin up to the bare stones"], 21.4, 1606, "#F2F2E6", "provence"),
  real(16, ["Col du Tourmalet", "Col du Tourmalet"], ["Col réel · Pyrénées", "Real climb · Pyrenees"], ["Depuis Luz-Saint-Sauveur, par Barèges", "From Luz-Saint-Sauveur, through Barèges"], 19.1, 1407, "#FF8C4D", "alpine"),
  real(17, ["Col du Galibier", "Col du Galibier"], ["Col réel · 2 642 m", "Real climb · 2,642 m"], ["Depuis Valloire, au-dessus des arbres", "From Valloire, above the trees"], 17.7, 1262, "#99D9FF", "alpine"),
  real(18, ["Col d'Izoard", "Col d'Izoard"], ["Col réel · Casse Déserte", "Real climb · Casse Déserte"], ["Depuis Briançon, par Cervières", "From Briançon, through Cervières"], 20.1, 1224, "#F2B373", "alpine"),
  real(19, ["Col de la Madeleine", "Col de la Madeleine"], ["Col réel · HC", "Real climb · HC"], ["Depuis La Chambre", "From La Chambre"], 20, 1563, "#8CFFB3", "alpine"),
  real(20, ["Étape reine des Alpes", "Queen stage of the Alps"], ["Étape réelle · 112 km", "Real stage · 112 km"], ["Modane, Télégraphe, Galibier, La Grave, Alpe d'Huez", "Modane, Télégraphe, Galibier, La Grave, Alpe d'Huez"], 111.6, 3901, "#FF4D66", "giant"),
  real(21, ["Étape du Tourmalet", "Tourmalet stage"], ["Étape réelle · 49 km", "Real stage · 49 km"], ["De Lourdes au sommet du Tourmalet", "From Lourdes to the top of the Tourmalet"], 48.6, 2054, "#FFCC40", "alpine"),
);
// Home: the Tour de l'Île de Montréal 2026, 50 km route, street by street (the city's official track).
GAME_ROUTES.push({ ...r(22, ["Tour de l'Île", "Tour de l'Île"], ["Montréal", "Montréal"], ["Parcours officiel 2026 · 50 km", "Official 2026 route · 50 km"], ["Le vrai parcours, rue par rue : parc Jarry, canal Lachine, Vieux-Montréal, Plateau", "The real route, street by street: Parc Jarry, Lachine canal, Old Montréal, the Plateau"], 49, 216, "#4A8CFF", "montreal"), real: true });
// The 2026 UCI Road World Championships in Montréal, from the city's official tracks.
GAME_ROUTES.push(
  { ...r(23, ["Mondiaux · mont Royal", "Worlds · Mount Royal"], ["Montréal", "Montréal"], ["Circuit officiel UCI 2026 · 13,4 km", "Official UCI 2026 circuit · 13.4 km"], ["Camillien-Houde, la Polytechnique, l'avenue du Parc : le tour des pros", "Camillien-Houde, Polytechnique, avenue du Parc: the pros' lap"], 13.4, 263, "#F2334D", "mondiaux-mont-royal"), real: true },
  { ...r(24, ["Mondiaux · contre-la-montre", "Worlds · time trial"], ["Montréal", "Montréal"], ["CLM officiel UCI 2026 · 39 km", "Official UCI 2026 TT · 39 km"], ["Vieux-Montréal, circuit Gilles-Villeneuve, parc Jean-Drapeau", "Old Montréal, Gilles-Villeneuve circuit, Parc Jean-Drapeau"], 39, 151, "#A875FF", "mondiaux-clm"), real: true },
  { ...r(25, ["Mondiaux · course élite", "Worlds · elite race"], ["Montréal", "Montréal"], ["Course officielle UCI 2026 · 277 km", "Official UCI 2026 race · 277 km"], ["La Montérégie, le pont Champlain, puis 12 tours du mont Royal", "The Montérégie, the Champlain bridge, then 12 laps of Mount Royal"], 277, 3654, "#FFD133", "mondiaux-elite"), real: true },
);
// The great climbs of the Giro and the Tour (the game's "Great climbs" page).
const climb = (id: number, name: string, country: [string, string], level: [string, string], about: [string, string], km: number, gainM: number, accent: string, image: string) =>
  ({ ...r(id, [name, name], country, level, about, km, gainM, accent, image), real: true });
GAME_ROUTES.push(
  climb(26, "Passo dello Stelvio", ["Italie", "Italy"], ["Col réel · 48 lacets", "Real climb · 48 hairpins"], ["Depuis Prato, par Trafoi, jusqu'à 2 758 m", "From Prato, through Trafoi, up to 2,758 m"], 22.1, 1904, "#8CCCFF", "alpine"),
  climb(27, "Passo del Mortirolo", ["Italie", "Italy"], ["Col réel · le plus dur", "Real climb · the hardest"], ["Depuis Mazzo : 11 km à plus de 10 %", "From Mazzo: 11 km above 10 %"], 11.4, 1336, "#FF594D", "giant"),
  climb(28, "Passo Giau", ["Italie", "Italy"], ["Col réel · Dolomites", "Real climb · Dolomites"], ["Depuis Selva di Cadore, au pied des Dolomites", "From Selva di Cadore, below the Dolomites"], 11, 1013, "#FF99D9", "alpine"),
  climb(29, "Col de la Croix de Fer", ["France", "France"], ["Col réel · 29 km", "Real climb · 29 km"], ["Depuis Saint-Jean-de-Maurienne, par Saint-Sorlin-d'Arves", "From Saint-Jean-de-Maurienne, through Saint-Sorlin-d'Arves"], 28.7, 1819, "#BFBFCC", "alpine"),
  climb(30, "Col d'Aubisque", ["France", "France"], ["Col réel · Pyrénées", "Real climb · Pyrenees"], ["Depuis Laruns, par Eaux-Bonnes et Gourette", "From Laruns, through Eaux-Bonnes and Gourette"], 18.4, 1304, "#66E68C", "alpine"),
  climb(31, "Grand Colombier", ["France", "France"], ["Col réel · Jura", "Real climb · Jura"], ["Depuis Culoz, les rampes à 14 % au-dessus du Rhône", "From Culoz, the 14 % ramps above the Rhône"], 17.3, 1315, "#FFB340", "giant"),
);
// Québec beyond Montréal (the game's "Québec" page, with the Montréal routes).
GAME_ROUTES.push(
  climb(32, "Parc de la Gatineau", ["Québec", "Quebec"], ["Montée réelle · belvédère Champlain", "Real climb · Champlain Lookout"], ["D'Old Chelsea au belvédère Champlain", "From Old Chelsea to the Champlain Lookout"], 13, 380, "#66D973", "pine"),
  climb(33, "Mont-Tremblant", ["Québec", "Quebec"], ["Route réelle · Laurentides", "Real road · Laurentians"], ["De Saint-Jovite jusqu'au pied des pistes", "From Saint-Jovite to the foot of the slopes"], 18.7, 257, "#F2734D", "pine"),
  climb(34, "Chemin du Roy", ["Québec", "Quebec"], ["Route réelle · fleuve", "Real road · river"], ["De Neuville à Deschambault, le long du Saint-Laurent", "From Neuville to Deschambault, along the St. Lawrence"], 34.9, 207, "#59A6FF", "pine"),
  climb(35, "Charlevoix", ["Québec", "Quebec"], ["Route réelle · côtes à 15 %", "Real road · 15 % hills"], ["De Baie-Saint-Paul aux Éboulements, au-dessus du fleuve", "From Baie-Saint-Paul to Les Éboulements, above the river"], 17.2, 558, "#FFCC4D", "pine"),
);

export interface GameEvent { id: string; race: boolean; kind: "group" | "race" | "tt"; wkg: number; title: Record<Lang, string>; route: GameRoute; start: Date }

const FORMATS: { kind: GameEvent["kind"]; wkg: number; title: Record<Lang, string> }[] = [
  { kind: "group", wkg: 2.0, title: { fr: "Sortie de groupe", en: "Group ride" } },
  { kind: "race", wkg: 0, title: { fr: "Course", en: "Race" } },
  { kind: "group", wkg: 2.8, title: { fr: "Groupe rapide", en: "Fast group" } },
  { kind: "group", wkg: 1.6, title: { fr: "Sortie découverte", en: "Social ride" } },
  { kind: "tt", wkg: 0, title: { fr: "Contre-la-montre", en: "Time trial" } },
];
const GROUP_ROUTES = [0, 1, 2, 7, 3], RACE_ROUTES = [7, 6, 1, 0, 8];
const SLOT_MIN = 30;

/** The event of one 30-minute slot, exactly as the game schedules it. */
export function scheduled(slot: number): GameEvent {
  const f = FORMATS[slot % FORMATS.length], turn = Math.floor(slot / FORMATS.length);
  const n = FORMATS.length, groupIndex = turn * 3 + (slot % n === 0 ? 0 : (slot % n) - 1);
  const route = f.kind !== "group" ? RACE_ROUTES[turn % RACE_ROUTES.length] : GROUP_ROUTES[groupIndex % GROUP_ROUTES.length];
  return { id: `forge-${slot}`, race: f.kind === "race", kind: f.kind, wkg: f.wkg, title: f.title, route: GAME_ROUTES[route], start: new Date(slot * SLOT_MIN * 60_000) };
}

/** The next events; the one that started less than 5 minutes ago can still be joined. */
export function upcomingEvents(count: number, now = Date.now()): GameEvent[] {
  let slot = Math.floor(now / 60_000 / SLOT_MIN);
  if (now - slot * SLOT_MIN * 60_000 > 5 * 60_000) slot++;
  return Array.from({ length: count }, (_, i) => scheduled(slot + i));
}

/** Race category from FTP per kilo, as the game computes it. */
export const categoryFor = (ftpW: number, kg: number) => { const w = ftpW / Math.max(30, kg); return w >= 4 ? "A" : w >= 3.2 ? "B" : w >= 2.5 ? "C" : "D"; };
