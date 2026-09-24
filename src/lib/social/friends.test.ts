import { describe, it, expect } from "vitest";
import { byRating, searchPattern } from "./friends";

describe("searchPattern", () => {
  it("turns a query into a lowercase prefix", () => {
    expect(searchPattern("Dav")).toBe("dav%");
    expect(searchPattern("  @david ")).toBe("david%");
  });

  it("escapes the underscore, which LIKE reads as any one character", () => {
    expect(searchPattern("d_r")).toBe("d\\_r%");
  });

  it("drops what a handle cannot contain, so nothing else reaches the query", () => {
    expect(searchPattern("da%v*i.d")).toBe("david%");
    expect(searchPattern("%%%")).toBeNull();
    expect(searchPattern("   ")).toBeNull();
  });

  it("never looks for more than a handle can hold", () => {
    expect(searchPattern("a".repeat(40))).toBe("a".repeat(20) + "%");
  });
});

describe("byRating", () => {
  it("puts rated riders first, strongest first, then the rest by handle", () => {
    const rows = [{ handle: "zed" }, { handle: "amy", rating: 1200 }, { handle: "bob" }, { handle: "cat", rating: 1500 }];
    expect([...rows].sort(byRating).map((r) => r.handle)).toEqual(["cat", "amy", "bob", "zed"]);
  });
});
