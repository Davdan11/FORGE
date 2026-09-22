import { describe, expect, it } from "vitest";
import { generatePlan, getExercise, recoveryCapacity } from "./plan";
import { HORIZON_WEEKS, advance, reviewBlock, tuningFrom, weekOf } from "./progression";
import { addDays } from "../db";
import type { Profile, Session, SessionLog } from "../types";

/* The programme is a promise that does not end at week twelve and does not
   repeat itself: each block is rebuilt from the one before, and the next
   one always exists before it is needed. */

const make = (over: Partial<Profile> = {}): Profile => ({
  id: "p1", name: "Test", sex: "male", age: 30, heightCm: 175, weightKg: 78,
  units: { weight: "kg", distance: "km" }, goal: "build", level: "intermediate", daysPerWeek: 4, sessionMinutes: 60,
  equipment: ["barbell", "rack", "bench", "dumbbell", "cable", "pullup_bar", "machine", "kettlebell"], pain: [],
  baselines: {}, dietary: [], mealsPerDay: 4, wakeTime: "07:00", trainTime: "18:00",
  notifications: false, createdAt: "2026-01-01T00:00:00.000Z", ...over,
});
const START = "2026-01-05"; // a Monday

/** Mark every session of block 1 done (or skipped) and log how hard it felt. */
function liveBlockOne(sessions: Session[], opts: { doneShare: number; rpeOffset: number }) {
  const inBlock = sessions.filter((s) => s.week <= 4);
  const doneCount = Math.round(inBlock.length * opts.doneShare);
  const logs: SessionLog[] = [];
  const rows = sessions.map((s) => {
    const i = inBlock.indexOf(s);
    if (i < 0) return s;
    if (i >= doneCount) return { ...s, status: "skipped" as const };
    const target = s.exercises.find((e) => e.block === "main")?.sets[0]?.rpe ?? 7.5;
    logs.push({ id: `l${i}`, sessionId: s.id, startedAt: s.date, avgRpe: target + opts.rpeOffset, xp: 0 });
    return { ...s, status: "done" as const };
  });
  return { rows, logs };
}

const mainLoad = (sessions: Session[], week: number) =>
  Math.max(0, ...sessions.filter((s) => s.week === week).flatMap((s) => s.exercises.filter((e) => e.block === "main").flatMap((e) => e.sets.map((x) => x.loadKg ?? 0))));

describe("the programme never runs out", () => {
  it("appends a block before the last one is reached", () => {
    const p = make();
    const { plan, sessions } = generatePlan(p, START);
    const inWeek5 = addDays(START, 4 * 7);
    const next = advance(plan, sessions, [], p, inWeek5)!;
    expect(next.plan.weeks).toBeGreaterThanOrEqual(weekOf(plan, inWeek5) + HORIZON_WEEKS);
    expect(next.plan.blocks.map((b) => b.weeks[0])).toEqual([1, 5, 9, 13]);
    expect(next.add.some((s) => s.week === 13)).toBe(true);
  });

  it("does not back-fill weeks that are already in the past", () => {
    const p = make();
    const { plan, sessions } = generatePlan(p, START);
    const months = addDays(START, 30 * 7); // week 31
    const next = advance(plan, sessions, [], p, months)!;
    for (const s of next.add) expect(s.date >= months).toBe(true);
    expect(next.plan.weeks).toBeGreaterThanOrEqual(31 + HORIZON_WEEKS);
  });

  it("does nothing in week one", () => {
    const p = make();
    const { plan, sessions } = generatePlan(p, START);
    expect(advance(plan, sessions, [], p, START)).toBeNull();
  });
});

describe("every block is different", () => {
  it("names the three phases by goal", () => {
    expect(generatePlan(make({ goal: "build" }), START).plan.blocks.map((b) => b.name)).toEqual(["Accumulation", "Hypertrophy", "Intensification"]);
    expect(generatePlan(make({ goal: "strength" }), START).plan.blocks.map((b) => b.name)).toEqual(["Volume", "Strength", "Peak"]);
    expect(generatePlan(make({ goal: "endurance" }), START).plan.blocks.map((b) => b.name)).toEqual(["Base", "Build", "Sharpen"]);
  });

  it("rotates accessories between blocks", () => {
    const { sessions } = generatePlan(make(), START);
    const acc = (week: number) => new Set(sessions.filter((s) => s.week === week).flatMap((s) => s.exercises.filter((e) => e.block === "accessory").map((e) => e.slug)));
    const a = acc(1), b = acc(5);
    expect([...b].some((slug) => !a.has(slug))).toBe(true);
  });

  it("keeps a beginner's main lifts the same so they can learn them", () => {
    const { sessions } = generatePlan(make({ level: "new" }), START);
    const mains = (week: number) => sessions.filter((s) => s.week === week).map((s) => s.exercises.find((e) => e.block === "main")?.slug).join();
    expect(mains(5)).toBe(mains(1));
    expect(mains(9)).toBe(mains(1));
  });

  it("drops the reps as the phases get heavier", () => {
    const { sessions } = generatePlan(make({ goal: "build" }), START);
    const reps = (week: number) => sessions.find((s) => s.week === week && s.exercises.some((e) => e.block === "main"))!.exercises.find((e) => e.block === "main")!.sets[0].reps!;
    expect(reps(1)).toBeGreaterThan(reps(9));
  });
});

describe("the next block is written from the last one", () => {
  it("eases off when sessions felt harder than prescribed", () => {
    const p = make();
    const { plan, sessions } = generatePlan(p, START);
    const { rows, logs } = liveBlockOne(sessions, { doneShare: 1, rpeOffset: 1.5 });
    const next = advance(plan, rows, logs, p, addDays(START, 4 * 7))!;
    const review = next.plan.blocks[1].review!;
    expect(review.rpeGap).toBeCloseTo(1.5);
    expect(review.tuning.loadMul).toBeLessThan(1);
    const rebuilt = next.add.filter((s) => s.week === 5);
    expect(mainLoad(rebuilt, 5)).toBeLessThan(mainLoad(sessions, 5));
  });

  it("pushes when sessions were easy and consistent", () => {
    const { tuning } = tuningFrom({ sessionsDone: 16, sessionsPlanned: 16, rpeGap: -1.2 });
    expect(tuning.loadMul).toBeGreaterThan(1);
    expect(tuning.accessorySets).toBe(1);
  });

  it("shortens sessions when most were missed, and says so", () => {
    const p = make();
    const { plan, sessions } = generatePlan(p, START);
    const { rows, logs } = liveBlockOne(sessions, { doneShare: 0.25, rpeOffset: 0 });
    const next = advance(plan, rows, logs, p, addDays(START, 4 * 7))!;
    const review = next.plan.blocks[1].review!;
    expect(review.sessionsDone).toBe(4);
    expect(review.sessionsPlanned).toBe(16);
    expect(review.changes[0]).toMatch(/4 of 16/);
    expect(review.tuning.accessorySets).toBe(-1);
  });

  it("never rewrites a session that has already happened", () => {
    const p = make();
    const { plan, sessions } = generatePlan(p, START);
    const { rows, logs } = liveBlockOne(sessions, { doneShare: 1, rpeOffset: 0 });
    const next = advance(plan, rows, logs, p, addDays(START, 4 * 7))!;
    const removed = new Set(next.remove);
    for (const s of rows) if (s.status !== "planned") expect(removed.has(s.id)).toBe(false);
  });

  it("reviews a block only once", () => {
    const p = make();
    const { plan, sessions } = generatePlan(p, START);
    const day = addDays(START, 4 * 7);
    const first = advance(plan, sessions, [], p, day)!;
    const kept = sessions.filter((s) => !first.remove.includes(s.id)).concat(first.add);
    expect(advance(first.plan, kept, [], p, day)).toBeNull();
  });

  it("counts only sessions whose day has passed", () => {
    const { sessions } = generatePlan(make(), START);
    const r = reviewBlock(1, sessions, [], addDays(START, 7)); // one week in
    expect(r.sessionsPlanned).toBe(4);
  });
});

describe("life outside the gym", () => {
  it("reads short sleep and a hard job as low recovery", () => {
    expect(recoveryCapacity({ sleep: "under_6", stress: "moderate", work: "physical" })).toBe("low");
    expect(recoveryCapacity({ sleep: "over_8", stress: "low", work: "desk" })).toBe("high");
    expect(recoveryCapacity(undefined)).toBe("normal");
  });

  it("gives a poorly recovered athlete fewer accessory sets", () => {
    const sets = (p: Profile) => generatePlan(p, START).sessions.filter((s) => s.week === 1).flatMap((s) => s.exercises.filter((e) => e.block === "accessory")).reduce((a, e) => a + e.sets.length, 0);
    expect(sets(make({ lifestyle: { sleep: "under_6", stress: "high", work: "physical" } }))).toBeLessThan(sets(make()));
  });
});

describe("old injuries", () => {
  it("prefers a movement that spares a healed joint when one exists", () => {
    const touches = (p: Profile) => generatePlan(p, START).sessions.flatMap((s) => s.exercises).filter((e) => (getExercise(e.slug)?.painFlags ?? []).includes("knee")).length;
    expect(touches(make({ injuryHistory: ["knee"] }))).toBeLessThan(touches(make()));
  });
});
