import { describe, expect, it } from "vitest";
import { addSplits, colorFor, profileMessage, rewardMessage, ridersMessage, unityRoom } from "./unity";
import { hexColor, lookCode } from "./live";
import { xpToReach } from "../gamification";

describe("the Unity game, seen from the app", () => {
  it("keeps Unity riders apart from the Three.js world, and events apart from free rides", () => {
    expect(unityRoom("c2")).toBe("unity:c2");
    expect(unityRoom("c2", "forge-123")).toBe("unity-event:forge-123");
    expect(unityRoom("c2")).not.toBe(unityRoom("c3"));
  });

  it("hands the game the room's people where they are now, not where they were", () => {
    const m = ridersMessage([{ id: "a", name: "Léa", distanceM: 1000, speedMs: 10, at: 0 }], 1000);
    expect(m.type).toBe("riders");
    expect(m.riders[0]).toMatchObject({ id: "p-a", name: "Léa", distance: 1010, speedKph: 36 });
    expect(m.riders[0].color).toMatch(/^#[0-9A-F]{6}$/i);
  });

  it("gives everyone a stable tag colour", () => {
    expect(colorFor("abc")).toBe(colorFor("abc"));
  });

  it("sends the level the app counted, never one the game made up", () => {
    const p = profileMessage({ name: "David Danjou", weightKg: 72.4, ftpW: 250 }, xpToReach(12) + 100);
    expect(p).toMatchObject({ type: "profile", name: "David", weightKg: 72, ftp: 250, level: 12, levelXp: 100 });
    expect(p.rank.length).toBeGreaterThan(0);
  });

  it("says when a ride crossed into a new level", () => {
    const edge = xpToReach(5) - 10;
    expect(rewardMessage(20, edge).levelUp).toBe(true);
    expect(rewardMessage(5, edge).levelUp).toBe(false);
  });

  it("cuts splits at each kilometre from the position reports", () => {
    const splits: { km: number; sec: number }[] = [];
    let last = addSplits(splits, 999, 100, 0);
    expect(splits).toEqual([]);
    last = addSplits(splits, 1001, 120, last);
    expect(splits).toEqual([{ km: 1, sec: 120 }]);
    addSplits(splits, 2500, 250, last);
    expect(splits).toEqual([{ km: 1, sec: 120 }, { km: 2, sec: 130 }]);
  });

  it("accepts only a real outfit code and a real colour from another client", () => {
    expect(lookCode("3.7.0.0.1.0.2.6.1.0.0.1.21.-1")).toBeDefined();
    expect(lookCode("<script>")).toBeUndefined();
    expect(lookCode("1.2.3")).toBeUndefined();
    expect(hexColor("#FF6F9C")).toBe("#FF6F9C");
    expect(hexColor("red; background:url(x)")).toBeUndefined();
  });
});
