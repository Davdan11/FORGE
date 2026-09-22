import { describe, expect, it, vi } from "vitest";

vi.mock("../supabase/client", () => ({ supabase: null }));
import { extrapolate, prune, roomName, joinRoom, type Peer } from "./live";

describe("live riders", () => {
  const p: Peer = { id: "a", name: "Ana", distanceM: 1000, speedMs: 10, at: 0 };

  it("moves a peer on at their last speed between messages", () => {
    expect(extrapolate(p, 500)).toBe(1005);
  });

  it("stops a peer that has gone quiet instead of riding them off", () => {
    expect(extrapolate(p, 60_000)).toBe(1030);
  });

  it("removes riders not heard from", () => {
    const m = new Map([["a", p], ["b", { ...p, id: "b", at: 9000 }]]);
    expect(prune(m, 10_000)).toEqual(["a"]);
    expect([...m.keys()]).toEqual(["b"]);
  });

  it("keeps riders and runners in separate rooms", () => {
    expect(roomName("vallee", "ride")).not.toBe(roomName("vallee", "run"));
  });

  it("does not join without an account", async () => {
    expect(await joinRoom("vallee", "ride", "Ana", () => {})).toBeNull();
  });
});
