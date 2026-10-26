import { describe, it, expect } from "vitest";
import { computeRcmTax } from "./rcmMath.js";

describe("computeRcmTax", () => {
  it("import of service => IGST on taxable value", () => {
    expect(computeRcmTax({ taxableAmount: 1000, rate: 18, isInterstate: true })).toEqual({ igst: 180, cgst: 0, sgst: 0, total: 180 });
  });
  it("domestic intra-state RCM => CGST+SGST split", () => {
    expect(computeRcmTax({ taxableAmount: 1000, rate: 18, isInterstate: false })).toEqual({ igst: 0, cgst: 90, sgst: 90, total: 180 });
  });
  it("zero rate => zero tax", () => {
    expect(computeRcmTax({ taxableAmount: 1000, rate: 0, isInterstate: true })).toEqual({ igst: 0, cgst: 0, sgst: 0, total: 0 });
  });
  it("rounds to 2 decimals", () => {
    expect(computeRcmTax({ taxableAmount: 333.33, rate: 18, isInterstate: true }).igst).toBe(60);
  });
});
