import { describe, expect, it } from "vitest";
import { localeUnits } from "./units";

describe("default units by region", () => {
  it("uses pounds and miles in the US", () => {
    expect(localeUnits("en-US")).toEqual({ weight: "lb", distance: "mi" });
  });
  it("weighs in kilograms and runs in miles in the UK", () => {
    expect(localeUnits("en-GB")).toEqual({ weight: "kg", distance: "mi" });
  });
  it("is metric everywhere else, and when the region is unknown", () => {
    expect(localeUnits("fr-CA")).toEqual({ weight: "kg", distance: "km" });
    expect(localeUnits("en-AU")).toEqual({ weight: "kg", distance: "km" });
    expect(localeUnits("en")).toEqual({ weight: "kg", distance: "km" });
  });
});
