import { describe, expect, it } from "vitest";
import { comebackFor, easeSessions } from "./comeback";
import type { Session } from "../types";

describe("coming back after a break", () => {
  it("does nothing under two weeks", () => {
    expect(comebackFor("2026-10-01", "2026-10-13")).toBeNull();
    expect(comebackFor(null, "2026-10-13")).toBeNull();
  });
  it("eases more the longer the break", () => {
    expect(comebackFor("2026-10-01", "2026-10-22")).toMatchObject({ daysAway: 21, loadMul: 0.9, easeDays: 7 });
    expect(comebackFor("2026-09-01", "2026-10-06")).toMatchObject({ loadMul: 0.85, easeDays: 7 });
    expect(comebackFor("2026-07-01", "2026-10-06")).toMatchObject({ loadMul: 0.8, easeDays: 14 });
  });

  const session = (date: string, status: Session["status"] = "planned"): Session => ({
    id: date, planId: "p", week: 5, day: 1, date, kind: "lower", title: "Lower", minutes: 60, focus: "strength", why: "", status,
    exercises: [
      { id: "a", slug: "back-squat", block: "main", why: "", sets: [1, 2, 3, 4].map(() => ({ reps: 5, rpe: 8, loadKg: 100, restSec: 180 })) },
      { id: "b", slug: "leg-press", block: "accessory", why: "", sets: [1, 2, 3].map(() => ({ reps: 10, rpe: 7.5, loadKg: 150, restSec: 90 })) },
    ],
  } as unknown as Session);

  it("lightens the coming week only, one set fewer on main lifts, with a note", () => {
    const c = comebackFor("2026-10-01", "2026-10-22")!;
    const out = easeSessions([session("2026-10-22"), session("2026-10-27"), session("2026-10-30"), session("2026-10-23", "done")], "2026-10-22", c, "kg");
    expect(out.map((s) => s.date)).toEqual(["2026-10-22", "2026-10-27"]);
    const squat = out[0].exercises[0];
    expect(squat.sets).toHaveLength(3);
    expect(squat.sets[0].loadKg).toBe(90);
    expect(squat.sets[0].rpe).toBe(7);
    expect(out[0].exercises[1].sets).toHaveLength(3);
    expect(out[0].adjustment?.reason).toMatch(/Welcome back — 21 days away/);
  });
});
