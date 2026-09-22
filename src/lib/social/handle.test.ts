import { describe, it, expect } from "vitest";
import { handleProblem } from "./feed";

/* The handle rules exist twice on purpose: here, so the person is told what is
   wrong before a round trip, and as a CHECK constraint in Postgres, so the
   rule holds even for a client that never ran this code. These tests pin the
   client half to the same shape as the constraint in supabase/schema.sql:
   ^[a-z0-9_]{3,20}$ */

describe("handleProblem", () => {
  it("accepts an ordinary handle", () => {
    expect(handleProblem("david_run")).toBeNull();
    expect(handleProblem("d4v1d")).toBeNull();
    expect(handleProblem("abc")).toBeNull();
    expect(handleProblem("a".repeat(20))).toBeNull();
  });

  it("rejects one too short or too long", () => {
    expect(handleProblem("ab")).toMatch(/three/i);
    expect(handleProblem("a".repeat(21))).toMatch(/twenty/i);
  });

  it("rejects characters the database would refuse", () => {
    for (const bad of ["has space", "hé", "semi;colon", "dash-es", "dot.dot", "at@sign", "sl/ash", "quote'", "emoji🙂"]) {
      expect(handleProblem(bad), bad).not.toBeNull();
    }
  });

  it("accepts uppercase input, because it is lowercased before it is checked", () => {
    // The input field does not fight the person's keyboard; the value is
    // normalised, and only then validated.
    expect(handleProblem("DavidRun")).toBeNull();
  });

  it("ignores surrounding whitespace", () => {
    expect(handleProblem("  david_run  ")).toBeNull();
  });

  it("rejects a handle that is only whitespace", () => {
    expect(handleProblem("   ")).not.toBeNull();
  });

  it("agrees with the SQL constraint on every case above", () => {
    const sql = /^[a-z0-9_]{3,20}$/;
    const cases = ["david_run", "abc", "ab", "a".repeat(21), "has space", "dash-es", "DavidRun", "  david_run  "];
    for (const c of cases) {
      const normalised = c.trim().toLowerCase();
      expect(handleProblem(c) === null, c).toBe(sql.test(normalised));
    }
  });
});
