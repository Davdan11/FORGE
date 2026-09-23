import { describe, expect, it, vi } from "vitest";

vi.mock("./supabase/client", () => ({ supabase: null }));
import { routeBadgeXp } from "./progress";

describe("FORGE Ride route badge", () => {
  it("pays 100 XP plus 4 per km for a route's first finish", () => {
    expect(routeBadgeXp(20)).toBe(180);
    expect(routeBadgeXp(25)).toBe(200);
    expect(routeBadgeXp(100)).toBe(500);
  });
  it("never pays less than the base, whatever the length says", () => {
    expect(routeBadgeXp(0)).toBe(100);
    expect(routeBadgeXp(-5)).toBe(100);
  });
});
