import { describe, it, expect } from "vitest";
import { fpFromDate, toGstr1Json, toGstr3bJson } from "./gstPortalJson.js";

describe("fpFromDate", () => {
  it("formats MMYYYY", () => {
    expect(fpFromDate("2026-06-30")).toBe("062026");
  });
});

describe("toGstr1Json", () => {
  const g = {
    b2b: [{ invoiceNumber: "HI-1", invoiceDate: "2026-06-10", grandTotal: 1180, taxableAmount: 1000, cgst: 90, sgst: 90, igst: 0, customerGstin: "27AAPFU0939F1ZV", placeOfSupply: "Kerala (32)", reverseCharge: "N" }],
    b2cs: [{ invoiceNumber: "HI-2", taxableAmount: 500, cgst: 45, sgst: 45, igst: 0, placeOfSupply: "Kerala (32)" }],
    exports: [{ invoiceNumber: "HI-3", invoiceDate: "2026-06-20", grandTotal: 83000, taxableAmount: 83000, igst: 0, paymentType: "WOPAY" }],
  };
  const j = toGstr1Json(g, "32ABCDE1234F1Z5", "2026-06-30");

  it("sets gstin + fp", () => {
    expect(j.gstin).toBe("32ABCDE1234F1Z5");
    expect(j.fp).toBe("062026");
  });
  it("groups b2b by ctin with itm rate", () => {
    expect(j.b2b[0].ctin).toBe("27AAPFU0939F1ZV");
    expect(j.b2b[0].inv[0].itms[0].itm_det.rt).toBe(18);
    expect(j.b2b[0].inv[0].pos).toBe("32");
  });
  it("aggregates b2cs rate-wise", () => {
    expect(j.b2cs[0]).toMatchObject({ sply_ty: "INTRA", rt: 18, pos: "32", txval: 500 });
  });
  it("emits exports under exp with WOPAY", () => {
    expect(j.exp[0].exp_typ).toBe("WOPAY");
    expect(j.exp[0].inv[0].val).toBe(83000);
  });
});

describe("toGstr3bJson", () => {
  it("maps 3.1(a)/(d) + ITC", () => {
    const g = { table31: { a: { taxableValue: 1000, igst: 0, cgst: 90, sgst: 90 }, d: { taxableValue: 500, igst: 90 } }, table4: { A: { rcSupplies: 90, allOther: 200 }, D: { ineligible: 30 } } };
    const j = toGstr3bJson(g, "32ABCDE1234F1Z5", "2026-06-30");
    expect(j.ret_period).toBe("062026");
    expect(j.sup_details.osup_det.camt).toBe(90);
    expect(j.sup_details.isup_rev.iamt).toBe(90);
    expect(j.itc_elg.itc_avl.find((x) => x.ty === "ISRC").iamt).toBe(90);
  });
});
