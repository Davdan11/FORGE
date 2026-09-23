import { describe, expect, it, vi } from "vitest";

vi.mock("./supabase/client", () => ({ supabase: null }));
import { buildReport, claimsCsv, isOpen, qualifies, rankRuleLevel, type Campaign } from "./rewards";
import type { Activity, LoggedSet, Profile, Session, Stats } from "./types";

describe("who qualifies", () => {
  const me = { level: 42, xp: 60000, badges: ["down_5lb"], streakWeeks: 6, sessionsThisMonth: 10 };
  it("reads rank rules as the first level of that rank", () => {
    expect(rankRuleLevel("gold")).toBe(41);
    expect(rankRuleLevel("gold:III")).toBe(45);
    expect(rankRuleLevel("nonsense")).toBeNull();
  });
  it("checks every kind of rule, with progress", () => {
    expect(qualifies("rank", "gold", me)).toMatchObject({ ok: true });
    expect(qualifies("rank", "gold:III", me)).toMatchObject({ ok: false, have: 42, need: 45 });
    expect(qualifies("level", "40", me).ok).toBe(true);
    expect(qualifies("badge", "down_5lb", me).ok).toBe(true);
    expect(qualifies("badge", "down_10lb", me).ok).toBe(false);
    expect(qualifies("streak", "8", me)).toMatchObject({ ok: false, have: 6, need: 8 });
    expect(qualifies("sessions_month", "12", me)).toMatchObject({ ok: false, have: 10 });
  });
  it("is open only when active and inside its dates", () => {
    const c = { active: true, starts_at: "2026-10-01T00:00:00Z", ends_at: "2026-10-31T23:59:59Z" } as Campaign;
    expect(isOpen(c, new Date("2026-10-15"))).toBe(true);
    expect(isOpen(c, new Date("2026-11-02"))).toBe(false);
    expect(isOpen({ ...c, active: false }, new Date("2026-10-15"))).toBe(false);
  });
});

describe("the claim report", () => {
  const profile = { name: "Marc", createdAt: "2026-09-01T00:00:00Z", startWeightKg: 90 } as Profile;
  const now = new Date("2026-10-01T00:00:00Z");

  it("summarises what was done and raises no flag for an honest month", () => {
    const sessions = Array.from({ length: 12 }, (_, i) => ({ date: `2026-09-${String(i * 2 + 2).padStart(2, "0")}`, status: "done", title: "Lower" })) as Session[];
    const sets = Array.from({ length: 180 }, () => ({})) as LoggedSet[];
    const r = buildReport({ profile, stats: { xp: 7000, streakWeeks: 4, badges: ["full_week"] } as Stats, sessions, sets, activities: [], weights: [{ id: "a", date: "2026-09-29", kg: 88 }], now });
    expect(r).toMatchObject({ accountAgeDays: 30, sessionsDone: 12, setsLogged: 180, weightChangeKg: -2, xpPerDay: 233 });
    expect(r.flags).toEqual([]);
  });

  it("flags a climb faster than real training allows, and hand-set indoor time", () => {
    const indoor = Array.from({ length: 6 }, (_, i) => ({ startedAt: `2026-09-2${i}T10:00:00Z`, title: "Vallée", distanceM: 30000, durationSec: 3600, movingSec: 3600, points: [], meta: { indoor: { quality: "declared" } } })) as unknown as Activity[];
    const r = buildReport({ profile: { ...profile, createdAt: "2026-09-20T00:00:00Z" }, stats: { xp: 20000, streakWeeks: 1, badges: [] } as unknown as Stats, sessions: [], sets: [], activities: indoor, weights: [], now });
    expect(r.flags.join(" ")).toMatch(/Climbed fast/);
    expect(r.flags.join(" ")).toMatch(/New account/);
    expect(r.flags.join(" ")).toMatch(/set by hand/);
  });
});

describe("shipping list", () => {
  it("escapes commas and quotes so any spreadsheet opens it", () => {
    const csv = claimsCsv([{ id: "1", campaign_id: "c", status: "approved", ship_name: 'Marc "The Tank" Roy', ship_line1: "12, rue Principale", ship_city: "Lévis", ship_postal: "G6V 1A1", ship_country: "CA", created_at: "2026-10-02T10:00:00Z" } as never], [{ id: "c", title: "Water bottle" } as Campaign]);
    expect(csv.split("\n")[1]).toContain('"Marc ""The Tank"" Roy","12, rue Principale"');
  });
});
