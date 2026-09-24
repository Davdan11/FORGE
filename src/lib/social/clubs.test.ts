import { describe, it, expect } from "vitest";
import { averageRating, CLUB_COLORS, clubProblem, inkOn, normalTag, sortClubs } from "./clubs";

/* The club rules exist twice on purpose, like the handle's: here, so the form
   says what is wrong before a round trip, and as CHECK constraints in
   supabase/social.sql, so they hold for any client. These tests pin the client
   half to the constraints: name 3..32 characters, tag ^[A-Z0-9]{2,4}$,
   about ≤ 160, colour ^#[0-9A-Fa-f]{6}$. */

describe("clubProblem", () => {
  it("accepts an ordinary club", () => {
    expect(clubProblem({ name: "Les Grimpeurs", tag: "GRMP" })).toBeNull();
    expect(clubProblem({ name: "abc", tag: "A1" })).toBeNull();
    expect(clubProblem({ name: "a".repeat(32), tag: "X9Z" })).toBeNull();
  });

  it("rejects a name too short or too long", () => {
    expect(clubProblem({ name: "ab", tag: "AB" })).toMatch(/three/i);
    expect(clubProblem({ name: "   ab   ", tag: "AB" })).toMatch(/three/i);
    expect(clubProblem({ name: "a".repeat(33), tag: "AB" })).toMatch(/32/);
  });

  it("rejects a tag of the wrong length", () => {
    expect(clubProblem({ name: "Club", tag: "A" })).toMatch(/2 to 4/);
    expect(clubProblem({ name: "Club", tag: "ABCDE" })).toMatch(/2 to 4/);
    expect(clubProblem({ name: "Club", tag: "" })).toMatch(/2 to 4/);
  });

  it("rejects characters the database would refuse in a tag", () => {
    for (const bad of ["A-B", "A_B", "É1", "A.B", "🙂A"]) expect(clubProblem({ name: "Club", tag: bad }), bad).not.toBeNull();
  });

  it("accepts a lowercase or spaced tag, because it is cleaned before it is checked", () => {
    expect(clubProblem({ name: "Club", tag: "grmp" })).toBeNull();
    expect(clubProblem({ name: "Club", tag: " G R " })).toBeNull();
  });

  it("checks the description and the colour when given", () => {
    expect(clubProblem({ name: "Club", tag: "CL", about: "x".repeat(160) })).toBeNull();
    expect(clubProblem({ name: "Club", tag: "CL", about: "x".repeat(161) })).toMatch(/160/);
    expect(clubProblem({ name: "Club", tag: "CL", color: "#12AbEf" })).toBeNull();
    expect(clubProblem({ name: "Club", tag: "CL", color: "red" })).not.toBeNull();
  });

  it("agrees with the SQL tag constraint", () => {
    const sql = /^[A-Z0-9]{2,4}$/;
    for (const c of ["AB", "abcd", "A", "ABCDE", "A-1", " x1 ", "Z9Z9"]) {
      expect(clubProblem({ name: "Club", tag: c }) === null, c).toBe(sql.test(normalTag(c)));
    }
  });
});

describe("normalTag", () => {
  it("uppercases and removes spaces", () => {
    expect(normalTag(" ab c ")).toBe("ABC");
  });
});

describe("sortClubs", () => {
  it("puts the biggest clubs first, then sorts by name, without touching the input", () => {
    const input = [{ name: "b", members: 2 }, { name: "a", members: 2 }, { name: "z", members: 9 }, { name: "c", members: 0 }];
    expect(sortClubs(input).map((c) => c.name)).toEqual(["z", "a", "b", "c"]);
    expect(input[0].name).toBe("b");
  });
});

describe("averageRating", () => {
  it("averages the riders who have a rating and ignores the rest", () => {
    expect(averageRating([{ rating: 1200 }, { rating: 1301 }, {}, { rating: null }])).toBe(1251);
  });

  it("is null when nobody is rated", () => {
    expect(averageRating([])).toBeNull();
    expect(averageRating([{}, { rating: null }])).toBeNull();
  });
});

describe("inkOn", () => {
  it("puts dark text on light colours and white on dark ones", () => {
    expect(inkOn("#FFFFFF")).toBe("#0b120e");
    expect(inkOn("#FFB020")).toBe("#0b120e");
    expect(inkOn("#000000")).toBe("#ffffff");
    expect(inkOn("#1B2A6B")).toBe("#ffffff");
  });

  it("falls back to dark text on anything that is not a colour", () => {
    expect(inkOn("nope")).toBe("#0b120e");
  });

  it("offers six swatches the database accepts", () => {
    expect(CLUB_COLORS).toHaveLength(6);
    for (const c of CLUB_COLORS) expect(clubProblem({ name: "Club", tag: "CL", color: c }), c).toBeNull();
  });
});
