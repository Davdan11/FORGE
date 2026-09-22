import type { ActivityType } from "../types";

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
  { v: "run",        label: "Run",        group: "run",   metric: "distance", rate: "pace",  ceilingMs: 8,   gps: true },
  { v: "trail",      label: "Trail",      group: "run",   metric: "distance", rate: "pace",  ceilingMs: 7,   gps: true },
  { v: "walk",       label: "Walk",       group: "run",   metric: "distance", rate: "pace",  ceilingMs: 3.2, gps: true },
  { v: "hike",       label: "Hike",       group: "run",   metric: "distance", rate: "pace",  ceilingMs: 3.2, gps: true },
  { v: "ruck",       label: "Ruck",       group: "run",   metric: "distance", rate: "pace",  ceilingMs: 3.5, gps: true },

  // On wheels
  { v: "ride",       label: "Road bike",  group: "ride",  metric: "distance", rate: "speed", ceilingMs: 22,  gps: true },
  { v: "mtb",        label: "Mountain bike", group: "ride", metric: "distance", rate: "speed", ceilingMs: 18, gps: true },
  { v: "gravel",     label: "Gravel",     group: "ride",  metric: "distance", rate: "speed", ceilingMs: 20,  gps: true },
  { v: "skate",      label: "Inline skate", group: "ride", metric: "distance", rate: "speed", ceilingMs: 14, gps: true },

  // Snow and ice
  { v: "ski",        label: "Nordic ski", group: "snow",  metric: "distance", rate: "speed", ceilingMs: 12,  gps: true },
  { v: "ski_alpine", label: "Alpine ski", group: "snow",  metric: "vertical", rate: "speed", ceilingMs: 35,  gps: true },
  { v: "snowboard",  label: "Snowboard",  group: "snow",  metric: "vertical", rate: "speed", ceilingMs: 35,  gps: true },
  { v: "ice_skate",  label: "Ice skate",  group: "snow",  metric: "distance", rate: "speed", ceilingMs: 16,  gps: true },

  // Water
  { v: "swim",       label: "Swim",       group: "water", metric: "distance", rate: "pace",  ceilingMs: 2.6, gps: false },
  { v: "row",        label: "Row",        group: "water", metric: "distance", rate: "speed", ceilingMs: 7,   gps: true },
  { v: "kayak",      label: "Kayak",      group: "water", metric: "distance", rate: "speed", ceilingMs: 6,   gps: true },
  { v: "surf",       label: "Surf",       group: "water", metric: "duration", rate: "none",  ceilingMs: 14,  gps: true },

  // Vertical
  { v: "climb",      label: "Climbing",   group: "climb", metric: "vertical", rate: "none",  ceilingMs: 4,   gps: false },
  { v: "boulder",    label: "Bouldering", group: "climb", metric: "duration", rate: "none",  ceilingMs: 4,   gps: false },

  // Field and court — time on the pitch is the measure, not distance
  { v: "soccer",     label: "Soccer",     group: "field", metric: "duration", rate: "none",  ceilingMs: 11,  gps: true },
  { v: "football",   label: "Football",   group: "field", metric: "duration", rate: "none",  ceilingMs: 11,  gps: true },
  { v: "hockey",     label: "Hockey",     group: "field", metric: "duration", rate: "none",  ceilingMs: 16,  gps: false },
  { v: "basketball", label: "Basketball", group: "field", metric: "duration", rate: "none",  ceilingMs: 11,  gps: false },
  { v: "tennis",     label: "Racquet",    group: "field", metric: "duration", rate: "none",  ceilingMs: 11,  gps: false },
  { v: "combat",     label: "Combat",     group: "field", metric: "duration", rate: "none",  ceilingMs: 8,   gps: false },

  // Air
  { v: "skydive",    label: "Skydive",    group: "air",   metric: "duration", rate: "none",  ceilingMs: 90,  gps: true },
  { v: "paraglide",  label: "Paraglide",  group: "air",   metric: "duration", rate: "none",  ceilingMs: 30,  gps: true },

  { v: "other",      label: "Other",      group: "other", metric: "duration", rate: "none",  ceilingMs: 25,  gps: true },
];

const BY_TYPE = new Map(SPORTS.map((s) => [s.v, s]));

export const sportSpec = (t: ActivityType): SportSpec => BY_TYPE.get(t) ?? BY_TYPE.get("other")!;
export const sportLabel = (t: ActivityType) => sportSpec(t).label;

/** Sports grouped for a picker, in the order the groups are listed above. */
export const SPORT_GROUPS: { key: SportSpec["group"]; label: string; sports: SportSpec[] }[] = [
  { key: "run", label: "On foot", sports: SPORTS.filter((s) => s.group === "run") },
  { key: "ride", label: "Wheels", sports: SPORTS.filter((s) => s.group === "ride") },
  { key: "snow", label: "Snow & ice", sports: SPORTS.filter((s) => s.group === "snow") },
  { key: "water", label: "Water", sports: SPORTS.filter((s) => s.group === "water") },
  { key: "climb", label: "Climbing", sports: SPORTS.filter((s) => s.group === "climb") },
  { key: "field", label: "Field & court", sports: SPORTS.filter((s) => s.group === "field") },
  { key: "air", label: "Air", sports: SPORTS.filter((s) => s.group === "air") },
  { key: "other", label: "Other", sports: SPORTS.filter((s) => s.group === "other") },
];
