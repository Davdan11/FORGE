import { describe, expect, it } from "vitest";
import { buildJourney } from "./journey";
import type { Activity, LoggedSet, Session, WeighIn } from "./types";

const w = (date: string, kg: number) => ({ id: date, date, kg }) as WeighIn;
const s = (date: string, status: Session["status"]) => ({ id: date, date, status, kind: "lower" }) as Session;
const set = (at: string, loadKg: number, reps = 5) => ({ id: at, at, slug: "back-squat", loadKg, reps }) as LoggedSet;

describe("the journey", () => {
  // Marc: 90 kg on day one, 89 a week later, then three weeks away, back at 88.
  const j = buildJourney({
    start: "2026-10-05", today: "2026-11-09", startWeightKg: 90,
    weights: [w("2026-10-12", 89), w("2026-11-09", 88)],
    sessions: [s("2026-10-05", "done"), s("2026-10-07", "done"), s("2026-10-12", "done"), s("2026-10-14", "skipped"), s("2026-11-09", "done"), s("2026-11-20", "planned")],
    sets: [set("2026-10-05T18:00:00Z", 100), set("2026-10-12T18:00:00Z", 105), set("2026-11-09T18:00:00Z", 95)],
    activities: [{ startedAt: "2026-10-18T09:00:00Z", distanceM: 5000 } as Activity],
  });

  it("keeps every week from day one to today, newest first, gaps included", () => {
    expect(j.weeks.map((x) => x.monday)).toEqual(["2026-11-09", "2026-11-02", "2026-10-26", "2026-10-19", "2026-10-12", "2026-10-05"]);
    expect(j.weeks[2]).toMatchObject({ sessionsDone: 0, activities: 0 });
  });

  it("tracks the weight from the start line, week to week", () => {
    expect(j.weeks.find((x) => x.monday === "2026-10-12")).toMatchObject({ weightKg: 89, weightDeltaKg: -1 });
    expect(j.weeks[0]).toMatchObject({ weightKg: 88, weightDeltaKg: -1 });
    expect(j.totals).toMatchObject({ startKg: 90, currentKg: 88, changeKg: -2 });
  });

  it("counts sessions done against planned, and never the future", () => {
    expect(j.weeks.find((x) => x.monday === "2026-10-12")).toMatchObject({ sessionsDone: 1, sessionsPlanned: 2 });
    expect(j.totals.sessionsDone).toBe(4);
  });

  it("marks a record only when a set beats every earlier one", () => {
    expect(j.weeks.find((x) => x.monday === "2026-10-12")?.records).toEqual(["back-squat"]);
    expect(j.weeks[0].records).toEqual([]);
    expect(j.totals.records).toBe(1);
  });

  it("counts active weeks from sessions or activities (Sunday the 18th is in the week of the 12th)", () => {
    expect(j.weeks.find((x) => x.monday === "2026-10-12")).toMatchObject({ activities: 1, distanceM: 5000 });
    expect(j.totals.activeWeeks).toBe(3);
  });
});
