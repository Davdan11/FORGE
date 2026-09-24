import { describe, expect, it } from "vitest";
import { BADGE_SPARKS, CATALOGUE, PRICE, findItem, itemKey, lookItems, ownedKeys, priceOf, sparks, tryBuy } from "./shop";

/* The garage shop: sparks follow XP and badges, purchases are checked here, the game only asks. */

const base = { xp: 1000, badges: [] as string[], coinsSpent: 0, owned: [] as string[] };

describe("sparks", () => {
  it("are every XP earned plus a bonus per badge, minus what was spent", () => {
    expect(sparks(base)).toBe(1000);
    expect(sparks({ ...base, badges: ["a", "b"] })).toBe(1000 + 2 * BADGE_SPARKS);
    expect(sparks({ ...base, coinsSpent: 750 })).toBe(250);
    expect(sparks({ ...base, coinsSpent: 5000 })).toBe(0);
  });
});

describe("the catalogue", () => {
  it("mirrors the game's six collections (RigSkins.cs)", () => {
    const count = (slot: string) => CATALOGUE.filter((i) => i.slot === slot).length;
    expect([count("outfit"), count("helmet"), count("shoes"), count("glasses"), count("frame"), count("wheels")]).toEqual([9, 6, 6, 6, 9, 7]);
  });
  it("gives the free items and prices the rest by rarity", () => {
    expect(ownedKeys({ owned: [] })).toContain("skin:frame:0");
    expect(priceOf(findItem("skin:frame:0")!)).toBe(0);
    expect(priceOf(findItem("skin:frame:3")!)).toBe(PRICE.rare);
    expect(findItem("skin:frame:99")).toBeUndefined();
  });
  it("reads the skins worn in a look code", () => {
    expect(lookItems("0.7.0.0.1.0.2.6.1.0.0.1.0.-1.1.4.1.2.4.0")).toEqual(["skin:outfit:1", "skin:helmet:4", "skin:shoes:1", "skin:glasses:2", "skin:frame:4", "skin:wheels:0"]);
    expect(lookItems("1.2.3")).toEqual([]);
  });
});

describe("buying", () => {
  it("needs the level, then the sparks", () => {
    expect(tryBuy(base, 3, "skin:frame:3")).toEqual({ ok: false, reason: "level", need: 5 });
    expect(tryBuy({ ...base, xp: 500 }, 8, "skin:frame:3")).toEqual({ ok: false, reason: "sparks", need: 250 });
    const r = tryBuy(base, 8, "skin:frame:3");
    expect(r.ok && r.price).toBe(750);
  });
  it("won't sell what is owned or unknown", () => {
    expect(tryBuy({ ...base, owned: [itemKey("frame", 3)] }, 8, "skin:frame:3")).toEqual({ ok: false, reason: "owned" });
    expect(tryBuy(base, 8, "skin:frame:0")).toEqual({ ok: false, reason: "owned" });
    expect(tryBuy(base, 8, "kit:3")).toEqual({ ok: false, reason: "unknown" });
  });
});
