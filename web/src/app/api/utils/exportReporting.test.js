import { describe, it, expect } from "vitest";
import { EXPORT_TREATMENTS, isExportSupply, exportTable, exportPaymentType, toINR } from "./exportReporting.js";

describe("isExportSupply", () => {
  it("true for export/SEZ/deemed treatments", () => {
    for (const t of EXPORT_TREATMENTS) expect(isExportSupply(t)).toBe(true);
  });
  it("false for domestic treatments", () => {
    for (const t of ["registered_regular", "unregistered", "registered_composition", "uin"])
      expect(isExportSupply(t)).toBe(false);
  });
});

describe("exportTable", () => {
  it("maps treatment to the GSTR-1 sub-table", () => {
    expect(exportTable("overseas")).toBe("6A");
    expect(exportTable("sez_with_payment")).toBe("6B");
    expect(exportTable("sez_without_payment")).toBe("6B");
    expect(exportTable("deemed_export")).toBe("6C");
    expect(exportTable("registered_regular")).toBe(null);
  });
});

describe("exportPaymentType", () => {
  it("SEZ with payment => WPAY, else WOPAY (LUT)", () => {
    expect(exportPaymentType("sez_with_payment")).toBe("WPAY");
    expect(exportPaymentType("overseas")).toBe("WOPAY");
    expect(exportPaymentType("sez_without_payment")).toBe("WOPAY");
  });
});

describe("toINR", () => {
  it("converts using exchange rate", () => {
    expect(toINR(1000, 83.5)).toBe(83500);
  });
  it("defaults rate to 1 (already INR)", () => {
    expect(toINR(1000, null)).toBe(1000);
    expect(toINR(1000, undefined)).toBe(1000);
  });
  it("rounds to 2 decimals", () => {
    expect(toINR(100.005, 1)).toBe(100.01);
  });
});
