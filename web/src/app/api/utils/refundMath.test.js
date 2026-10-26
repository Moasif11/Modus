import { describe, it, expect } from "vitest";
import {
  round2,
  invoiceEffectiveValue,
  netCashReceived,
  invoiceBalanceDue,
  invoiceStatus,
  maxIssuableCredit,
  maxRefundable,
  creditNoteWithinSec34,
} from "./refundMath.js";

describe("round2", () => {
  it("rounds to 2 decimals", () => {
    expect(round2(1.005)).toBe(1.01);
    expect(round2(2.344)).toBe(2.34);
  });
});

describe("invoiceEffectiveValue", () => {
  it("subtracts issued credit notes from grand total", () => {
    expect(invoiceEffectiveValue(10000, 2000)).toBe(8000);
  });
});

describe("netCashReceived", () => {
  it("is payments minus refunds", () => {
    expect(netCashReceived(10000, 2000)).toBe(8000);
  });
});

describe("invoiceBalanceDue", () => {
  it("full pay, partial credit, full refund of overpayment => 0", () => {
    expect(invoiceBalanceDue(10000, 2000, 10000, 2000)).toBe(0);
  });
  it("credit with no payment reduces what customer owes", () => {
    expect(invoiceBalanceDue(10000, 2000, 0, 0)).toBe(8000);
  });
});

describe("invoiceStatus", () => {
  it("fully credited invoice => credited", () => {
    expect(invoiceStatus({ grandTotal: 10000, creditsTotal: 10000, paymentsTotal: 0, refundsTotal: 0, currentStatus: "sent" })).toBe("credited");
  });
  it("paid in full, no credit => paid", () => {
    expect(invoiceStatus({ grandTotal: 10000, creditsTotal: 0, paymentsTotal: 10000, refundsTotal: 0, currentStatus: "sent" })).toBe("paid");
  });
  it("partial credit + full prior payment + refund of overpay => paid", () => {
    expect(invoiceStatus({ grandTotal: 10000, creditsTotal: 2000, paymentsTotal: 10000, refundsTotal: 2000, currentStatus: "paid" })).toBe("paid");
  });
  it("partial payment, no credit => partially_paid", () => {
    expect(invoiceStatus({ grandTotal: 10000, creditsTotal: 0, paymentsTotal: 4000, refundsTotal: 0, currentStatus: "sent" })).toBe("partially_paid");
  });
  it("reverts paid->sent when payment removed", () => {
    expect(invoiceStatus({ grandTotal: 10000, creditsTotal: 0, paymentsTotal: 0, refundsTotal: 0, currentStatus: "paid" })).toBe("sent");
  });
});

describe("maxIssuableCredit", () => {
  it("cannot exceed remaining invoice value", () => {
    expect(maxIssuableCredit(10000, 3000)).toBe(7000);
  });
});

describe("maxRefundable", () => {
  it("equals customer overpayment (netCash - effective)", () => {
    expect(maxRefundable(10000, 2000, 10000, 0)).toBe(2000);
  });
  it("is 0 when not overpaid", () => {
    expect(maxRefundable(10000, 0, 4000, 0)).toBe(0);
  });
});

describe("creditNoteWithinSec34", () => {
  it("allows a credit note before 30 Nov following the invoice FY", () => {
    // invoice FY 2025-26 (Apr 2025–Mar 2026) → deadline 30 Nov 2026
    expect(creditNoteWithinSec34("2025-06-01", "2026-11-30")).toBe(true);
    expect(creditNoteWithinSec34("2026-02-01", "2026-11-30")).toBe(true);
  });
  it("blocks a credit note after the 30 Nov deadline", () => {
    expect(creditNoteWithinSec34("2025-06-01", "2026-12-01")).toBe(false);
  });
  it("does not block when dates are missing", () => {
    expect(creditNoteWithinSec34(null, "2026-12-01")).toBe(true);
  });
});
