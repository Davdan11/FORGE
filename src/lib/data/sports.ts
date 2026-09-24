import type { ActivityType } from "../types";
import { getLang, type Lang } from "../i18n";

/* ─────────────────────────────────────────────────────────────
   The sports people actually do.

   Not every sport is a distance. A climbing session is measured
   in routes, a hockey game in time on the ice, a skydive in
   seconds of freefall. Forcing all of them into kilometres is why
   most training apps feel wrong the moment you leave the road.

   `ceilingMs` is the speed above which a human doing this sport is
   no longer plausible — a car, a chairlift, a train. It is used to
   discount effort, never to accuse anyone.
   ───────────────────────────────────────────────────────────── */

export type SportMetric = "distance" | "duration" | "vertical";
export type SportRate = "pace" | "speed" | "none";

export interface SportSpec {
  v: ActivityType;
  label: string;
  /** French name. */
  fr: string;
  group: "run" | "ride" | "snow" | "water" | "climb" | "field" | "air" | "other";
  metric: SportMetric;
  rate: SportRate;
  /** Plausible ceiling in m/s for a human doing this sport. */
  ceilingMs: number;
  /** Whether a GPS track is expected at all. */
  gps: boolean;
}

export const SPORTS: SportSpec[] = [
  // On foot
  { v: "run",        label: "Run", fr: "Course",        group: "run",   metric: "distance", rate: "pace",  ceilingMs: 8,   gps: true },
  { v: "trail",      label: "Trail", fr: "Trail",      group: "run",   metric: "distance", rate: "pace",  ceilingMs: 7,   gps: true },
  { v: "walk",       label: "Walk", fr: "Marche",       group: "run",   metric: "distance", rate: "pace",  ceilingMs: 3.2, gps: true },
  { v: "hike",       label: "Hike", fr: "Randonnée",       group: "run",   metric: "distance", rate: "pace",  ceilingMs: 3.2, gps: true },
  { v: "ruck",       label: "Ruck", fr: "Ruck",       group: "run",   metric: "distance", rate: "pace",  ceilingMs: 3.5, gps: true },

  // On wheels
  { v: "ride",       label: "Road bike", fr: "Vélo de route",  group: "ride",  metric: "distance", rate: "speed", ceilingMs: 22,  gps: true },
  { v: "mtb",        label: "Mountain bike", fr: "Vélo de montagne", group: "ride", metric: "distance", rate: "speed", ceilingMs: 18, gps: true },
  { v: "gravel",     label: "Gravel", fr: "Gravel",     group: "ride",  metric: "distance", rate: "speed", ceilingMs: 20,  gps: true },
  { v: "skate",      label: "Inline skate", fr: "Patin à roues alignées", group: "ride", metric: "distance", rate: "speed", ceilingMs: 14, gps: true },

  // Snow and ice
  { v: "ski",        label: "Nordic ski", fr: "Ski de fond", group: "snow",  metric: "distance", rate: "speed", ceilingMs: 12,  gps: true },
  { v: "ski_alpine", label: "Alpine ski", fr: "Ski alpin", group: "snow",  metric: "vertical", rate: "speed", ceilingMs: 35,  gps: true },
  { v: "snowboard",  label: "Snowboard", fr: "Planche à neige",  group: "snow",  metric: "vertical", rate: "speed", ceilingMs: 35,  gps: true },
  { v: "ice_skate",  label: "Ice skate", fr: "Patin sur glace",  group: "snow",  metric: "distance", rate: "speed", ceilingMs: 16,  gps: true },

  // Water
  { v: "swim",       label: "Swim", fr: "Natation",       group: "water", metric: "distance", rate: "pace",  ceilingMs: 2.6, gps: false },
  { v: "row",        label: "Row", fr: "Aviron",        group: "water", metric: "distance", rate: "speed", ceilingMs: 7,   gps: true },
  { v: "kayak",      label: "Kayak", fr: "Kayak",      group: "water", metric: "distance", rate: "speed", ceilingMs: 6,   gps: true },
  { v: "surf",       label: "Surf", fr: "Surf",       group: "water", metric: "duration", rate: "none",  ceilingMs: 14,  gps: true },

  // Vertical
  { v: "climb",      label: "Climbing", fr: "Escalade",   group: "climb", metric: "vertical", rate: "none",  ceilingMs: 4,   gps: false },
  { v: "boulder",    label: "Bouldering", fr: "Bloc", group: "climb", metric: "duration", rate: "none",  ceilingMs: 4,   gps: false },

  // Field and court — time on the pitch is the measure, not distance
  { v: "soccer",     label: "Soccer", fr: "Soccer",     group: "field", metric: "duration", rate: "none",  ceilingMs: 11,  gps: true },
  { v: "football",   label: "Football", fr: "Football",   group: "field", metric: "duration", rate: "none",  ceilingMs: 11,  gps: true },
  { v: "hockey",     label: "Hockey", fr: "Hockey",     group: "field", metric: "duration", rate: "none",  ceilingMs: 16,  gps: false },
  { v: "basketball", label: "Basketball", fr: "Basketball", group: "field", metric: "duration", rate: "none",  ceilingMs: 11,  gps: false },
  { v: "tennis",     label: "Racquet", fr: "Raquette",    group: "field", metric: "duration", rate: "none",  ceilingMs: 11,  gps: false },
  { v: "combat",     label: "Combat", fr: "Combat",     group: "field", metric: "duration", rate: "none",  ceilingMs: 8,   gps: false },

  // Air
  { v: "skydive",    label: "Skydive", fr: "Parachutisme",    group: "air",   metric: "duration", rate: "none",  ceilingMs: 90,  gps: true },
  { v: "paraglide",  label: "Paraglide", fr: "Parapente",  group: "air",   metric: "duration", rate: "none",  ceilingMs: 30,  gps: true },

  { v: "other",      label: "Other", fr: "Autre",      group: "other", metric: "duration", rate: "none",  ceilingMs: 25,  gps: true },
];

const BY_TYPE = new Map(SPORTS.map((s) => [s.v, s]));

export const sportSpec = (t: ActivityType): SportSpec => BY_TYPE.get(t) ?? BY_TYPE.get("other")!;
/** A sport's name. Components pass the language from useLang(); lib code may rely on the default. */
export const sportLabel = (t: ActivityType, lang: Lang = getLang()) => (lang === "fr" ? sportSpec(t).fr : sportSpec(t).label);

/** Sports grouped for a picker, in the order the groups are listed above. */
export const SPORT_GROUPS: { key: SportSpec["group"]; label: string; fr: string; sports: SportSpec[] }[] = [
  { key: "run", label: "On foot", fr: "À pied", sports: SPORTS.filter((s) => s.group === "run") },
  { key: "ride", label: "Wheels", fr: "Roues", sports: SPORTS.filter((s) => s.group === "ride") },
  { key: "snow", label: "Snow & ice", fr: "Neige et glace", sports: SPORTS.filter((s) => s.group === "snow") },
  { key: "water", label: "Water", fr: "Eau", sports: SPORTS.filter((s) => s.group === "water") },
  { key: "climb", label: "Climbing", fr: "Escalade", sports: SPORTS.filter((s) => s.group === "climb") },
  { key: "field", label: "Field & court", fr: "Terrain et court", sports: SPORTS.filter((s) => s.group === "field") },
  { key: "air", label: "Air", fr: "Air", sports: SPORTS.filter((s) => s.group === "air") },
  { key: "other", label: "Other", fr: "Autre", sports: SPORTS.filter((s) => s.group === "other") },
];
/** A sport family's name. */
export const groupLabel = (g: { label: string; fr: string }, lang: Lang = getLang()) => (lang === "fr" ? g.fr : g.label);
