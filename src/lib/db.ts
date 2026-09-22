import Dexie, { type EntityTable } from "dexie";
import type {
  Profile, Plan, Session, LoggedSet, SessionLog, Readiness, Activity, NutritionDay, Stats, WeighIn,
} from "./types";

/**
 * Local-first store (IndexedDB). Every record carries a `dirty` flag so the
 * Supabase sync layer can push changes when the user is signed in.
 */
export interface Syncable { dirty?: number; updatedAt?: string }

export type ProfileRow = Profile & Syncable;
export type PlanRow = Plan & Syncable;
export type SessionRow = Session & Syncable;
export type LoggedSetRow = LoggedSet & Syncable;
export type SessionLogRow = SessionLog & Syncable;
export type ReadinessRow = Readiness & Syncable;
export type ActivityRow = Activity & Syncable;
export type NutritionDayRow = NutritionDay & Syncable;
export type StatsRow = Stats & Syncable;
export type WeighInRow = WeighIn & Syncable;

class ForgeDB extends Dexie {
  weights!: EntityTable<WeighInRow, "id">;
  profile!: EntityTable<ProfileRow, "id">;
  plans!: EntityTable<PlanRow, "id">;
  sessions!: EntityTable<SessionRow, "id">;
  sets!: EntityTable<LoggedSetRow, "id">;
  logs!: EntityTable<SessionLogRow, "id">;
  readiness!: EntityTable<ReadinessRow, "id">;
  activities!: EntityTable<ActivityRow, "id">;
  nutrition!: EntityTable<NutritionDayRow, "id">;
  stats!: EntityTable<StatsRow, "id">;

  constructor() {
    super("forge");
    this.version(1).stores({
      profile: "id",
      plans: "id, profileId, startDate",
      sessions: "id, planId, date, [planId+week], status",
      sets: "id, sessionId, slug, at",
      logs: "id, sessionId, startedAt",
      readiness: "id, date",
      activities: "id, startedAt, type",
      nutrition: "id, date",
      stats: "id",
    });
    this.version(2).stores({
      activities: "id, startedAt, type, shared, workoutId",
      weights: "id, date",
    });
  }
}

export const db = new ForgeDB();

export const uid = () =>
  (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36));

export const todayISO = (d = new Date()) => {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
};

export const addDays = (iso: string, n: number) => {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return todayISO(d);
};

export const isoWeek = (iso: string) => {
  const d = new Date(iso + "T00:00:00");
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day + 3);
  const first = new Date(d.getFullYear(), 0, 4);
  const week = 1 + Math.round(((d.getTime() - first.getTime()) / 86400000 - 3 + ((first.getDay() + 6) % 7)) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, "0")}`;
};

export async function getProfile() {
  const all = await db.profile.toArray();
  return all[0] ?? null;
}

/** Read-only (safe inside liveQuery): returns a default until the first award writes it. */
export async function getStats(): Promise<StatsRow> {
  const s = await db.stats.get("me");
  if (s) return s;
  return {
    id: "me", xp: 0, level: 1, streakWeeks: 0, badges: [],
    totals: { sessions: 0, volumeKg: 0, distanceM: 0, mobilityMin: 0, mealsLogged: 0, activities: 0, shared: 0, elevGainM: 0 },
    dirty: 1, updatedAt: new Date().toISOString(),
  };
}

export async function resetAll() {
  await db.delete();
  await db.open();
}
