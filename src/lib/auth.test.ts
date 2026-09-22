import { describe, expect, it } from "vitest";
import { isEmail, normalisePhone } from "./auth";

/* A code sent to the wrong number costs money and locks a real person out. */
describe("phone numbers", () => {
  it("reads a North American number however it is typed", () => {
    for (const s of ["514 555 1234", "(514) 555-1234", "514.555.1234", "1 514 555 1234", "+1 514 555 1234"]) expect(normalisePhone(s)).toBe("+15145551234");
  });
  it("keeps an international number that starts with +", () => {
    expect(normalisePhone("+33 6 12 34 56 78")).toBe("+33612345678");
  });
  it("refuses what cannot be a phone number", () => {
    for (const s of ["", "555 1234", "+12", "abc", "12345678901234567"]) expect(normalisePhone(s)).toBeNull();
  });
});

describe("email", () => {
  it("accepts ordinary addresses and refuses broken ones", () => {
    expect(isEmail("coach@forge.app")).toBe(true);
    expect(isEmail("  a.b+c@mail.co ")).toBe(true);
    for (const s of ["", "a@b", "@forge.app", "coach forge@app.com", "coach@.c"]) expect(isEmail(s)).toBe(false);
  });
});
