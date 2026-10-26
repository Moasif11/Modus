import { describe, it, expect } from "vitest";
import { parse2bInvoices, reconcile2b } from "./reconcile2b.js";

const raw2b = {
  data: { docdata: { b2b: [
    { ctin: "27AAPFU0939F1ZV", inv: [
      { inum: "S-101", dt: "05-06-2026", val: 1180, txval: 1000, iamt: 0, camt: 90, samt: 90 },
      { inum: "S-102", dt: "06-06-2026", val: 2360, itms: [{ itm_det: { txval: 2000, iamt: 360 } }] },
    ] },
  ] } },
};

describe("parse2bInvoices", () => {
  it("flattens supplier invoices with summed tax", () => {
    const inv = parse2bInvoices(raw2b);
    expect(inv).toHaveLength(2);
    expect(inv[0]).toMatchObject({ supplierGstin: "27AAPFU0939F1ZV", invoiceNumber: "S-101", tax: 180, taxable: 1000 });
    expect(inv[1]).toMatchObject({ invoiceNumber: "S-102", tax: 360, taxable: 2000 });
  });
  it("handles empty / missing structure", () => {
    expect(parse2bInvoices({})).toEqual([]);
  });
});

describe("reconcile2b", () => {
  const portal = parse2bInvoices(raw2b);
  it("matches book bills to 2B (case/space-insensitive)", () => {
    const bills = [{ id: 1, billNumber: "HB-1", vendorGstin: "27aapfu0939f1zv", supplierInvNo: "s-101", tax: 180 }];
    const r = reconcile2b(bills, portal);
    expect(r.summary.matchedCount).toBe(1);
    expect(r.summary.missingInBooksCount).toBe(1); // S-102 unmatched
  });
  it("flags tax mismatch", () => {
    const bills = [{ id: 1, billNumber: "HB-1", vendorGstin: "27AAPFU0939F1ZV", supplierInvNo: "S-101", tax: 200 }];
    const r = reconcile2b(bills, portal);
    expect(r.summary.mismatchedCount).toBe(1);
    expect(r.mismatched[0].taxDiff).toBe(20);
  });
  it("flags a bill absent from 2B (ITC at risk)", () => {
    const bills = [{ id: 9, billNumber: "HB-9", vendorGstin: "29GGGGG0000G1Z5", supplierInvNo: "X-1", tax: 500 }];
    const r = reconcile2b(bills, portal);
    expect(r.summary.missingIn2bCount).toBe(1);
    expect(r.summary.atRiskTax).toBe(500);
  });
});
