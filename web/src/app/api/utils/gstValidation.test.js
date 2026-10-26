import { describe, it, expect } from "vitest";
import { isValidGstin, gstinCheckDigit, stateCodeFromGstin } from "./gstValidation.js";
import { validateHsnSac } from "./gstValidation.js";

describe("gstinCheckDigit", () => {
  it("computes the MOD-36 check char for a 14-char base", () => {
    expect(gstinCheckDigit("27AAPFU0939F1Z")).toBe("V");
  });
});

describe("isValidGstin", () => {
  it("accepts a structurally valid GSTIN with correct checksum", () => {
    expect(isValidGstin("27AAPFU0939F1ZV")).toBe(true);
  });
  it("rejects wrong checksum", () => {
    expect(isValidGstin("27AAPFU0939F1ZA")).toBe(false);
  });
  it("rejects wrong length", () => {
    expect(isValidGstin("27AAPFU0939F1Z")).toBe(false);
  });
  it("rejects wrong format", () => {
    expect(isValidGstin("AA27PFU0939F1ZV")).toBe(false);
  });
  it("rejects empty/null", () => {
    expect(isValidGstin("")).toBe(false);
    expect(isValidGstin(null)).toBe(false);
  });
});

describe("stateCodeFromGstin", () => {
  it("returns the first two digits", () => {
    expect(stateCodeFromGstin("27AAPFU0939F1ZV")).toBe("27");
  });
  it("returns null for invalid", () => {
    expect(stateCodeFromGstin("bad")).toBe(null);
  });
});

describe("validateHsnSac", () => {
  it("requires HSN on B2B lines", () => {
    expect(validateHsnSac("", { b2b: true, turnoverAbove5cr: false })).toEqual({ ok: false, reason: "HSN/SAC is mandatory on B2B invoices" });
  });
  it("requires >=6 digits when turnover above 5cr", () => {
    expect(validateHsnSac("9983", { b2b: true, turnoverAbove5cr: true }).ok).toBe(false);
    expect(validateHsnSac("998361", { b2b: true, turnoverAbove5cr: true }).ok).toBe(true);
  });
  it("requires >=4 digits when turnover at/below 5cr", () => {
    expect(validateHsnSac("99", { b2b: true, turnoverAbove5cr: false }).ok).toBe(false);
    expect(validateHsnSac("9983", { b2b: true, turnoverAbove5cr: false }).ok).toBe(true);
  });
  it("allows blank for B2C below 5cr", () => {
    expect(validateHsnSac("", { b2b: false, turnoverAbove5cr: false }).ok).toBe(true);
  });
  it("rejects non-numeric codes", () => {
    expect(validateHsnSac("99AB", { b2b: true, turnoverAbove5cr: false }).ok).toBe(false);
  });
});
