import { describe, expect, it } from "vitest";
import { remindersFor, type Day } from "./reminders";
import { notificationId, reminderTarget } from "./notify";
import { generatePlan } from "./engine/plan";
import { buildNutritionDay } from "./nutrition/engine";
import type { Profile, Readiness } from "./types";

/* Reminders are only worth having if they are few, on time, and never about
   something already done. */

const profile: Profile = {
  id: "p1", name: "Test", sex: "male", age: 30, heightCm: 175, weightKg: 78,
  units: { weight: "kg", distance: "km" }, goal: "build", level: "intermediate", daysPerWeek: 4, sessionMinutes: 60,
  equipment: ["barbell", "rack", "bench", "dumbbell"], pain: [], baselines: {}, dietary: [], mealsPerDay: 4,
  wakeTime: "07:00", trainTime: "18:00", notifications: true, createdAt: "2026-01-01T00:00:00.000Z",
};
const DATE = "2026-01-05"; // a Monday, a training day
const session = generatePlan(profile, DATE).sessions.find((s) => s.date === DATE)!;
const nutrition = buildNutritionDay(profile, DATE, session);
const day = (over: Partial<Day> = {}): Day => ({ date: DATE, session, nutrition, readiness: null, ...over });
const early = new Date(`${DATE}T05:00:00`);

describe("reminders", () => {
  it("are all off unless the athlete turned them on", () => {
    expect(remindersFor({ ...profile, notifications: false }, [day()], early)).toEqual([]);
  });

  it("remind to check in half an hour after waking", () => {
    const r = remindersFor(profile, [day()], early).find((x) => x.key.startsWith("checkin"))!;
    expect(r.at.getHours()).toBe(7);
    expect(r.at.getMinutes()).toBe(30);
    expect(r.url).toBe("/today");
  });

  it("drop the check-in once it is done", () => {
    const readiness = { id: DATE, date: DATE } as Readiness;
    expect(remindersFor(profile, [day({ readiness })], early).some((x) => x.key.startsWith("checkin"))).toBe(false);
  });

  it("give an hour's notice before a planned session, and none once it is done", () => {
    const r = remindersFor(profile, [day()], early).find((x) => x.key.startsWith("session"))!;
    expect(r.at.getHours()).toBe(17);
    expect(r.title).toContain("18:00");
    expect(r.url).toBe(`/session?id=${session.id}`);
    expect(remindersFor(profile, [day({ session: { ...session, status: "done" } })], early).some((x) => x.key.startsWith("session"))).toBe(false);
  });

  it("never schedule anything already in the past, and come soonest first", () => {
    const noon = new Date(`${DATE}T12:00:00`);
    const list = remindersFor(profile, [day()], noon);
    expect(list.every((x) => x.at > noon)).toBe(true);
    expect(list.map((x) => x.at.getTime())).toEqual([...list.map((x) => x.at.getTime())].sort((a, b) => a - b));
  });

  it("have unique keys, so rescheduling replaces instead of duplicating", () => {
    const list = remindersFor(profile, [day()], early);
    expect(new Set(list.map((x) => x.key)).size).toBe(list.length);
    expect(new Set(list.map((x) => notificationId(x.key))).size).toBe(list.length);
  });
});

describe("notification plumbing", () => {
  it("turns a key into a stable positive int", () => {
    expect(notificationId("checkin:2026-01-05")).toBe(notificationId("checkin:2026-01-05"));
    expect(notificationId("checkin:2026-01-05")).toBeGreaterThan(0);
    expect(notificationId("checkin:2026-01-05")).toBeLessThan(2 ** 31);
  });

  it("opens the right page from a tap, query string kept", () => {
    expect(reminderTarget("/session?id=abc")).toBe("/session/?id=abc");
    expect(reminderTarget("/today")).toBe("/today/");
  });
});
