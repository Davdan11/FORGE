import { describe, expect, it } from "vitest";
import { GAME_ROUTES, categoryFor, scheduled, upcomingEvents } from "./forgeRide";

describe("FORGE Ride, as the Indoor page shows it", () => {
  it("schedules the same events as the game (values computed by RideEvents.Scheduled)", () => {
    const kind = { group: "Group", race: "Race", tt: "TimeTrial" };
    const got = [995000, 995001, 995002, 995003, 995004, 995005, 995007, 995009].map((s) => { const e = scheduled(s); return `${s}:${kind[e.kind]}:${e.route.key}:${e.wkg}`; });
    expect(got).toEqual(["995000:Group:c0:2", "995001:Race:c7:0", "995002:Group:c1:2.8", "995003:Group:c2:1.6", "995004:TimeTrial:c7:0", "995005:Group:c7:2", "995007:Group:c3:2.8", "995009:TimeTrial:c6:0"]);
  });

  it("keeps an event that started less than 5 minutes ago, then moves on", () => {
    const slotStart = 995000 * 30 * 60_000;
    expect(upcomingEvents(1, slotStart + 4 * 60_000)[0].id).toBe("forge-995000");
    expect(upcomingEvents(1, slotStart + 6 * 60_000)[0].id).toBe("forge-995001");
  });

  it("lists the game's nine routes in its order, with stable keys", () => {
    expect(GAME_ROUTES.map((r) => r.key)).toEqual(["c0", "c1", "c2", "c3", "c4", "c5", "c6", "c7", "c8", "c9", "c10", "c11", "c12", "c13", "c14", "c15", "c16", "c17", "c18", "c19", "c20", "c21", "c22", "c23", "c24", "c25", "c26", "c27", "c28", "c29", "c30", "c31", "c32", "c33", "c34", "c35"]);
  });

  it("puts riders in the game's race categories", () => {
    expect(categoryFor(300, 72)).toBe("A");
    expect(categoryFor(245, 72)).toBe("B");
    expect(categoryFor(200, 72)).toBe("C");
    expect(categoryFor(150, 72)).toBe("D");
  });
});
