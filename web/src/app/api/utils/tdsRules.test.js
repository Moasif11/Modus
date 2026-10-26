import { describe, it, expect } from "vitest";
import { TDS_SECTIONS, defaultTdsRate, isValidTdsSection, computeTds, tdsBase } from "./tdsRules.js";

describe("TDS_SECTIONS", () => {
  it("includes the common sections", () => {
    const codes = TDS_SECTIONS.map((s) => s.code);
    expect(codes).toContain("194C");
    expect(codes).toContain("194J");
    expect(codes).toContain("194H");
    expect(codes).toContain("194I");
  });
});

describe("defaultTdsRate", () => {
  it("returns the section default rate", () => {
    expect(defaultTdsRate("194J")).toBe(10);
    expect(defaultTdsRate("194C")).toBe(2);
    expect(defaultTdsRate("194H")).toBe(2); // reduced w.e.f 01-Oct-2024
    expect(defaultTdsRate("194Q")).toBe(0.1);
  });
  it("returns 0 for unknown", () => {
    expect(defaultTdsRate("999")).toBe(0);
  });
});

describe("isValidTdsSection", () => {
  it("accepts known sections and empty (no TDS)", () => {
    expect(isValidTdsSection("194J")).toBe(true);
    expect(isValidTdsSection("")).toBe(true);
    expect(isValidTdsSection(null)).toBe(true);
  });
  it("rejects unknown", () => {
    expect(isValidTdsSection("194Z")).toBe(false);
  });
});

describe("computeTds", () => {
  it("computes percentage of base", () => {
    expect(computeTds(1000, 10)).toBe(100);
    expect(computeTds(1000, 0.1)).toBe(1);
    expect(computeTds(333.33, 10)).toBe(33.33);
    expect(computeTds(1000, 0)).toBe(0);
  });
});

describe("tdsBase", () => {
  it("strips GST from a gross amount", () => {
    expect(tdsBase(11800, 1800)).toBe(10000);
    expect(tdsBase(1000, 0)).toBe(1000);
  });
});
