import { describe, expect, it } from "vitest";
import { GAME_ROUTES, categoryFor, scheduled, upcomingEvents } from "./forgeRide";

describe("FORGE Ride, as the Indoor page shows it", () => {
  it("schedules the same events as the game (values computed by RideEvents.Scheduled)", () => {
    const got = [995000, 995001, 995002, 995003, 995004, 995007].map((s) => { const e = scheduled(s); return `${s}:${e.race ? "Race" : "Group"}:${e.route.key}:${e.wkg}`; });
    expect(got).toEqual(["995000:Group:c0:2", "995001:Race:c7:0", "995002:Group:c1:2.8", "995003:Group:c2:1.6", "995004:Group:c7:2", "995007:Group:c0:1.6"]);
  });

  it("keeps an event that started less than 5 minutes ago, then moves on", () => {
    const slotStart = 995000 * 30 * 60_000;
    expect(upcomingEvents(1, slotStart + 4 * 60_000)[0].id).toBe("forge-995000");
    expect(upcomingEvents(1, slotStart + 6 * 60_000)[0].id).toBe("forge-995001");
  });

  it("lists the game's nine routes in its order, with stable keys", () => {
    expect(GAME_ROUTES.map((r) => r.key)).toEqual(["c0", "c1", "c2", "c3", "c4", "c5", "c6", "c7", "c8", "c9", "c10", "c11", "c12", "c13", "c14", "c15", "c16", "c17", "c18", "c19", "c20", "c21"]);
  });

  it("puts riders in the game's race categories", () => {
    expect(categoryFor(300, 72)).toBe("A");
    expect(categoryFor(245, 72)).toBe("B");
    expect(categoryFor(200, 72)).toBe("C");
    expect(categoryFor(150, 72)).toBe("D");
  });
});
