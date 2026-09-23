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

export interface GameEvent { id: string; race: boolean; wkg: number; title: Record<Lang, string>; route: GameRoute; start: Date }

const FORMATS = [
  { race: false, wkg: 2.0, title: { fr: "Sortie de groupe", en: "Group ride" } },
  { race: true, wkg: 0, title: { fr: "Course", en: "Race" } },
  { race: false, wkg: 2.8, title: { fr: "Groupe rapide", en: "Fast group" } },
  { race: false, wkg: 1.6, title: { fr: "Sortie découverte", en: "Social ride" } },
];
const GROUP_ROUTES = [0, 1, 2, 7, 3], RACE_ROUTES = [7, 6, 1, 0, 8];
const SLOT_MIN = 30;

/** The event of one 30-minute slot, exactly as the game schedules it. */
export function scheduled(slot: number): GameEvent {
  const f = FORMATS[slot % FORMATS.length], turn = Math.floor(slot / FORMATS.length);
  const groupIndex = turn * 3 + (slot % 4 === 0 ? 0 : (slot % 4) - 1);
  const route = f.race ? RACE_ROUTES[turn % RACE_ROUTES.length] : GROUP_ROUTES[groupIndex % GROUP_ROUTES.length];
  return { id: `forge-${slot}`, race: f.race, wkg: f.wkg, title: f.title, route: GAME_ROUTES[route], start: new Date(slot * SLOT_MIN * 60_000) };
}

/** The next events; the one that started less than 5 minutes ago can still be joined. */
export function upcomingEvents(count: number, now = Date.now()): GameEvent[] {
  let slot = Math.floor(now / 60_000 / SLOT_MIN);
  if (now - slot * SLOT_MIN * 60_000 > 5 * 60_000) slot++;
  return Array.from({ length: count }, (_, i) => scheduled(slot + i));
}

/** Race category from FTP per kilo, as the game computes it. */
export const categoryFor = (ftpW: number, kg: number) => { const w = ftpW / Math.max(30, kg); return w >= 4 ? "A" : w >= 3.2 ? "B" : w >= 2.5 ? "C" : "D"; };
