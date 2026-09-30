import { describe, expect, it } from "vitest";
import { buildWatchFeed, feedBytes, formatPairingCode, WATCH_FEED_MAX_BYTES, type WatchInput } from "./watch";
import { MEALS } from "./data/meals";
import { EXERCISES, exName } from "./data/exercises";
import { catalogIds, getMeal } from "./nutrition/recipes";
import { mealTitle } from "./nutrition/cookbook";
import { levelFromXp, rankFor } from "./gamification";
import type { NutritionDay, Session } from "./types";

/* The watch feed: every field the watch reads is there, names follow the language asked for,
   and the JSON stays under the size a watch can take (8 KB). */

const NOW = new Date("2026-09-29T15:00:00");
const loadable = EXERCISES.filter((e) => e.loadable).slice(0, 12);

function session(kind: Session["kind"], n: number, date = "2026-09-29"): Session {
  return {
    id: `s-${date}`, planId: "p", week: 2, day: 1, date, kind, title: "stored title", minutes: 60, focus: "strength", why: "", status: "planned",
    exercises: [
      { id: "warm", slug: EXERCISES.find((e) => e.pattern === "mobility")!.slug, block: "prep", why: "", sets: [{ reps: 8, restSec: 30 }] },
      ...loadable.slice(0, n).map((e, i) => ({ id: `e${i}`, slug: e.slug, block: "main" as const, why: "", sets: [{ reps: 5, loadKg: 100 + i, restSec: 120 }, { reps: 5, loadKg: 102.5 + i, restSec: 120 }, { reps: 5, loadKg: 102.5 + i, restSec: 120 }] })),
    ],
  };
}

const curated = MEALS.filter((m) => m.nameFr).slice(0, 3);
const generated = catalogIds().slice(0, 2);
const nutrition: NutritionDay = {
  id: "2026-09-29", date: "2026-09-29", dayType: "train", waterMl: 0,
  targets: { kcal: 2710.4, protein: 182.6, carbs: 300, fat: 80 },
  meals: [
    { slot: "dinner", time: "18:30", mealId: generated[1], scale: 1.2 },
    { slot: "breakfast", time: "07:00", mealId: curated[0].id, scale: 1, done: true },
    { slot: "lunch", time: "12:00", mealId: generated[0], scale: 1.1, done: true },
    { slot: "snack", time: "15:30", mealId: curated[1].id, scale: 0.8 },
  ],
};

const input = (over: Partial<WatchInput> = {}): WatchInput => ({
  profile: { name: "David", units: { weight: "lb", distance: "km" } },
  stats: { xp: 5321, streakWeeks: 4, badges: ["a", "b"], coinsSpent: 250 },
  today: session("lower", 5),
  tomorrow: session("upper", 4, "2026-09-30"),
  nutrition,
  lang: "fr",
  now: NOW,
  ...over,
});

describe("watch feed", () => {
  it("has every field the watch reads", () => {
    const f = buildWatchFeed(input());
    const lvl = levelFromXp(5321);
    expect(f).toMatchObject({ v: 1, lang: "fr", name: "David", units: "lb", level: lvl.level, xp: lvl.into, xpNext: lvl.need, xpTotal: 5321, streakWeeks: 4, date: "2026-09-29" });
    expect(f.ts).toBe(Math.floor(NOW.getTime() / 1000));
    expect(f.updatedAt).toBe(NOW.toISOString());
    // Gems are the garage sparks: XP + 100 per badge − spent.
    expect(f.gems).toBe(5321 + 200 - 250);
    expect(f.rank).toMatch(/^\S+ (I|II|III|IV|V)$/);
    expect(f.today.targets).toEqual({ kcal: 2710, protein: 183 });
    expect(f.today.session).toMatchObject({ minutes: 60, done: false, zone: null });
    expect(f.tomorrow.session).toBeTruthy();
  });

  it("lists the work, not the warm-up, with sets, reps and top load in kg", () => {
    const f = buildWatchFeed(input());
    const ex = f.today.session!.exercises;
    expect(ex).toHaveLength(5);
    expect(ex[0]).toEqual({ name: exName(loadable[0], "fr"), sets: 3, reps: 5, sec: null, loadKg: 102.5 });
  });

  it("keeps at most 8 exercises", () => {
    expect(buildWatchFeed(input({ today: session("full", 12) })).today.session!.exercises).toHaveLength(8);
  });

  it("sorts meals by time, scales kcal and protein, and totals what was eaten", () => {
    const f = buildWatchFeed(input());
    expect(f.today.meals.map((m) => m.time)).toEqual(["07:00", "12:00", "15:30", "18:30"]);
    expect(f.today.meals.map((m) => m.done)).toEqual([true, true, false, false]);
    const lunch = getMeal(generated[0])!;
    expect(f.today.meals[1]).toMatchObject({ kcal: Math.round(lunch.kcal * 1.1), protein: Math.round(lunch.protein * 1.1) });
    const eaten = curated[0].kcal + lunch.kcal * 1.1;
    expect(f.today.eaten.kcal).toBe(Math.round(eaten));
  });

  it("names meals, slots and sessions in the language asked for", () => {
    const fr = buildWatchFeed(input({ lang: "fr" }));
    const en = buildWatchFeed(input({ lang: "en" }));
    expect(fr.today.meals[0].name).toBe(mealTitle(curated[0], "fr")[0].slice(0, 48));
    expect(en.today.meals[0].name).toBe(mealTitle(curated[0], "en")[0].slice(0, 48));
    expect(fr.today.meals[0].name).not.toBe(en.today.meals[0].name);
    expect(fr.today.meals[0].slot).toBe("Déjeuner");
    expect(en.today.meals[0].slot).toBe("Breakfast");
    expect(fr.today.meals[1].slot).toBe("Dîner");
    expect(fr.today.session!.title).toBe("Bas du corps");
    expect(en.today.session!.title).toBe("Lower");
    expect(fr.tomorrow.session).toBe("Haut du corps");
    expect(fr.rank).toBe(rankFor(fr.level, "fr"));
    expect(en.rank).toBe(rankFor(en.level, "en"));
  });

  it("stays small, even on a crowded day", () => {
    expect(feedBytes(buildWatchFeed(input()))).toBeLessThan(3000);
    const long = "Très long nom de repas ".repeat(20);
    const crowded: NutritionDay = { ...nutrition, meals: Array.from({ length: 40 }, (_, i) => ({ slot: "snack" as const, time: `${String(i % 24).padStart(2, "0")}:00`, mealId: curated[i % 3].id, scale: 1 })) };
    const f = buildWatchFeed(input({ nutrition: crowded, today: session("full", 20), profile: { name: long, units: { weight: "kg", distance: "km" } } }));
    expect(feedBytes(f)).toBeLessThanOrEqual(WATCH_FEED_MAX_BYTES);
    expect(f.name.length).toBeLessThanOrEqual(20);
  });

  it("handles a rest day, no food plan and no profile", () => {
    const f = buildWatchFeed(input({ today: null, tomorrow: session("rest", 0, "2026-09-30"), nutrition: null, profile: null }));
    expect(f.today.session).toBeNull();
    expect(f.tomorrow.session).toBeNull();
    expect(f.today.meals).toEqual([]);
    expect(f.today.targets).toEqual({ kcal: 0, protein: 0 });
    expect(f.name).toBe("FORGE");
    expect(f.units).toBe("kg");
  });

  it("formats pairing codes in groups of four", () => {
    expect(formatPairingCode("abcd2345wxyz")).toBe("ABCD-2345-WXYZ");
    expect(formatPairingCode("ABCD-2345-WXYZ")).toBe("ABCD-2345-WXYZ");
  });
});
