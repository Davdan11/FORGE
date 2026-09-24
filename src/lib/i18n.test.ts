import { describe, expect, it } from "vitest";
import { bilingual, loc, tr } from "./i18n";
import { generatePlan } from "./engine/plan";
import type { Profile } from "./types";

/* The coach's notes are saved once and read later, maybe after the language was switched:
   they keep both languages and are shown in whichever one is on. */

const profile: Profile = {
  id: "p1", name: "Test", sex: "male", age: 30, heightCm: 175, weightKg: 78,
  units: { weight: "kg", distance: "km" }, goal: "build", level: "intermediate", daysPerWeek: 4, sessionMinutes: 60,
  equipment: ["barbell", "rack", "bench", "dumbbell", "cable", "pullup_bar", "machine"], pain: [],
  baselines: {}, dietary: [], mealsPerDay: 4, wakeTime: "07:00", trainTime: "18:00",
  notifications: false, createdAt: "2026-01-01T00:00:00.000Z",
};
const hidden = /[-]/;

describe("saved text in two languages", () => {
  it("keeps both halves and shows the one asked for", () => {
    const s = bilingual(() => tr("Bonjour", "Hello"), true);
    expect(loc(s, "fr")).toBe("Bonjour");
    expect(loc(s, "en")).toBe("Hello");
  });
  it("resolves a pair inside a sentence", () => {
    const s = bilingual(() => tr(`Genou : ${tr("repos", "rest")}.`, `Knee: ${tr("repos", "rest")}.`), true);
    expect(loc(s, "fr")).toBe("Genou : repos.");
    expect(loc(s, "en")).toBe("Knee: rest.");
  });
  it("leaves older, one-language text alone", () => {
    expect(loc("Train as planned.", "fr")).toBe("Train as planned.");
    expect(loc(undefined)).toBeUndefined();
  });
  it("gives a whole plan's notes in either language", () => {
    const { plan, sessions } = bilingual(() => generatePlan(profile, "2026-01-05"), true);
    const s = sessions[0];
    expect(loc(s.why, "fr")).not.toBe(loc(s.why, "en"));
    for (const text of [s.why, s.title, plan.blocks[0].name, plan.blocks[0].intent, ...s.exercises.map((e) => e.why)]) {
      expect(loc(text, "fr")).not.toMatch(hidden);
      expect(loc(text, "en")).not.toMatch(hidden);
    }
    expect(loc(s.why, "en")).toBe(generatePlan(profile, "2026-01-05").sessions[0].why);
  });
});
