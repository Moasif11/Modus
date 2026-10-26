import { describe, it, expect } from "vitest";
import { GST_TREATMENTS, deriveTaxContext } from "./gstTreatment.js";

const SELLER = "32"; // Kerala

describe("GST_TREATMENTS", () => {
  it("exposes the india-compliance enum", () => {
    expect(GST_TREATMENTS).toContain("registered_regular");
    expect(GST_TREATMENTS).toContain("overseas");
    expect(GST_TREATMENTS).toContain("sez_without_payment");
  });
});

describe("deriveTaxContext", () => {
  it("registered intra-state => CGST+SGST", () => {
    const ctx = deriveTaxContext({ gstTreatment: "registered_regular", sellerStateCode: SELLER, partyStateCode: "32" });
    expect(ctx).toMatchObject({ taxType: "cgst_sgst", isInterstate: false, zeroRated: false, placeOfSupplyCode: "32" });
  });
  it("registered inter-state => IGST", () => {
    const ctx = deriveTaxContext({ gstTreatment: "registered_regular", sellerStateCode: SELLER, partyStateCode: "27" });
    expect(ctx).toMatchObject({ taxType: "igst", isInterstate: true, placeOfSupplyCode: "27" });
  });
  it("overseas (export) => zero-rated, POS 96", () => {
    const ctx = deriveTaxContext({ gstTreatment: "overseas", sellerStateCode: SELLER, partyStateCode: null });
    expect(ctx).toMatchObject({ taxType: "no_tax", zeroRated: true, isInterstate: true, placeOfSupplyCode: "96" });
  });
  it("SEZ without payment => zero-rated", () => {
    const ctx = deriveTaxContext({ gstTreatment: "sez_without_payment", sellerStateCode: SELLER, partyStateCode: "24" });
    expect(ctx).toMatchObject({ taxType: "no_tax", zeroRated: true, isInterstate: true });
  });
  it("SEZ with payment => IGST, zero-rated false", () => {
    const ctx = deriveTaxContext({ gstTreatment: "sez_with_payment", sellerStateCode: SELLER, partyStateCode: "24" });
    expect(ctx).toMatchObject({ taxType: "igst", isInterstate: true, zeroRated: false });
  });
  it("explicit placeOfSupplyCode override wins for tax-type", () => {
    const ctx = deriveTaxContext({ gstTreatment: "registered_regular", sellerStateCode: SELLER, partyStateCode: "32", placeOfSupplyCode: "29" });
    expect(ctx).toMatchObject({ taxType: "igst", isInterstate: true, placeOfSupplyCode: "29" });
  });
  it("flags rcmApplicable for overseas vendor on purchase side", () => {
    const ctx = deriveTaxContext({ gstTreatment: "registered_regular", sellerStateCode: SELLER, partyStateCode: "32", side: "purchase", vendorTreatment: "overseas" });
    expect(ctx.rcmApplicable).toBe(true);
  });
});
