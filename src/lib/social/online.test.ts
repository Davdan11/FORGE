import { describe, it, expect } from "vitest";
import { cleanRider, readPresence } from "./online";

/* Presence comes from other people's devices. Whatever it says is checked
   before it reaches a card: these tests pin what is let through. */

const ID = "0b3f5c2a-1d4e-4f6a-9b8c-7d6e5f4a3b2c";
const ok = { handle: "david_run", routeKey: "c3", routeName: "Alpe d’Huez", since: "2026-09-24T10:00:00.000Z" };

describe("cleanRider", () => {
  it("accepts a well-formed announcement", () => {
    expect(cleanRider(ID, ok)).toEqual({ user_id: ID, ...ok });
    expect(cleanRider(ID, { ...ok, routeKey: "g-giant_2" })).not.toBeNull();
  });

  it("drops a key that is not a user id", () => {
    expect(cleanRider("someone", ok)).toBeNull();
  });

  it("drops a handle the database would refuse", () => {
    for (const handle of ["DAVID", "ab", "a".repeat(21), "<script>", "has space", 42]) expect(cleanRider(ID, { ...ok, handle }), String(handle)).toBeNull();
  });

  it("drops a route key that is not a game route", () => {
    for (const routeKey of ["x3", "", "c" + "1".repeat(41), "c/../x", "c 1", null]) expect(cleanRider(ID, { ...ok, routeKey }), String(routeKey)).toBeNull();
  });

  it("drops a route name that is empty or too long, and trims the rest", () => {
    expect(cleanRider(ID, { ...ok, routeName: "   " })).toBeNull();
    expect(cleanRider(ID, { ...ok, routeName: "x".repeat(41) })).toBeNull();
    expect(cleanRider(ID, { ...ok, routeName: "  Col  " })?.routeName).toBe("Col");
  });

  it("reads a start time from the future, or none, as now", () => {
    const before = Date.now();
    const r = cleanRider(ID, { ...ok, since: "2999-01-01T00:00:00Z" })!;
    expect(Date.parse(r.since)).toBeGreaterThanOrEqual(before);
    expect(Date.parse(r.since)).toBeLessThanOrEqual(Date.now());
    expect(cleanRider(ID, { ...ok, since: undefined })).not.toBeNull();
  });

  it("drops anything that is not an object", () => {
    expect(cleanRider(ID, "hello")).toBeNull();
    expect(cleanRider(ID, null)).toBeNull();
  });
});

describe("readPresence", () => {
  it("keeps one entry per rider, the newest, and orders by who started first", () => {
    const other = "1c3f5c2a-1d4e-4f6a-9b8c-7d6e5f4a3b2c";
    const broken = "2c3f5c2a-1d4e-4f6a-9b8c-7d6e5f4a3b2c";
    const riders = readPresence({
      [ID]: [ok, { ...ok, routeKey: "c7", since: "2026-09-24T10:30:00.000Z" }],
      [other]: [{ ...ok, handle: "early", since: "2026-09-24T09:00:00.000Z" }],
      bogus: [ok],
      [broken]: [{ handle: "x" }],
    });
    expect(riders.map((r) => r.handle)).toEqual(["early", "david_run"]);
    expect(riders[1].routeKey).toBe("c7");
  });
});
