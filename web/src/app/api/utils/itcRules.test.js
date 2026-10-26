import { describe, it, expect } from "vitest";
import { ITC_ELIGIBILITY, defaultItcEligibility, isBlockedItc } from "./itcRules.js";

describe("ITC_ELIGIBILITY", () => {
  it("has the three states", () => {
    expect(ITC_ELIGIBILITY).toEqual(["eligible", "ineligible_section_17_5", "ineligible_others"]);
  });
});
describe("defaultItcEligibility", () => {
  it("blocks petrol, food, travel under 17(5)", () => {
    expect(defaultItcEligibility("petrol")).toBe("ineligible_section_17_5");
    expect(defaultItcEligibility("food")).toBe("ineligible_section_17_5");
    expect(defaultItcEligibility("travel")).toBe("ineligible_section_17_5");
  });
  it("treats salary as out-of-scope (ineligible_others)", () => {
    expect(defaultItcEligibility("salary")).toBe("ineligible_others");
  });
  it("treats business inputs as eligible", () => {
    for (const c of ["marketing", "software", "internet", "equipment", "subscription", "freelancer", "other"])
      expect(defaultItcEligibility(c)).toBe("eligible");
  });
  it("defaults unknown category to eligible", () => {
    expect(defaultItcEligibility("whatever")).toBe("eligible");
  });
});
describe("isBlockedItc", () => {
  it("true for both ineligible states", () => {
    expect(isBlockedItc("ineligible_section_17_5")).toBe(true);
    expect(isBlockedItc("ineligible_others")).toBe(true);
    expect(isBlockedItc("eligible")).toBe(false);
  });
});
