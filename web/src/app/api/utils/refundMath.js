// Pure money math for credit notes + refunds. No DB, no imports.
// All amounts are numbers in the document's own currency.

const EPS = 0.01;

export function round2(n) {
  // String-based to avoid binary-float half-rounding errors (e.g. 1.005 → 1.01, not 1.00).
  return Number(`${Math.round(Number(`${parseFloat(n) || 0}e2`))}e-2`);
}

export function invoiceEffectiveValue(grandTotal, issuedCreditsTotal) {
  return round2((parseFloat(grandTotal) || 0) - (parseFloat(issuedCreditsTotal) || 0));
}

export function netCashReceived(paymentsTotal, refundsTotal) {
  return round2((parseFloat(paymentsTotal) || 0) - (parseFloat(refundsTotal) || 0));
}

export function invoiceBalanceDue(grandTotal, creditsTotal, paymentsTotal, refundsTotal) {
  return round2(invoiceEffectiveValue(grandTotal, creditsTotal) - netCashReceived(paymentsTotal, refundsTotal));
}

export function invoiceStatus({ grandTotal, creditsTotal, paymentsTotal, refundsTotal, currentStatus }) {
  const effective = invoiceEffectiveValue(grandTotal, creditsTotal);
  const netCash = netCashReceived(paymentsTotal, refundsTotal);
  const balance = round2(effective - netCash);

  if (effective <= EPS) return "credited";       // fully credit-noted
  if (balance <= EPS) return "paid";              // settled
  if (netCash > EPS) return "partially_paid";     // some cash in, still owing
  if (["paid", "partially_paid", "credited"].includes(currentStatus)) return "sent";
  return currentStatus;
}

// Max further credit you may issue against an invoice.
export function maxIssuableCredit(grandTotal, alreadyCreditedTotal) {
  return round2((parseFloat(grandTotal) || 0) - (parseFloat(alreadyCreditedTotal) || 0));
}

// Max cash you may refund = how much the customer has overpaid relative to effective value.
export function maxRefundable(grandTotal, creditsTotal, paymentsTotal, refundsTotal) {
  const over = netCashReceived(paymentsTotal, refundsTotal) - invoiceEffectiveValue(grandTotal, creditsTotal);
  return round2(Math.max(0, over));
}

// CGST Sec 34(2): a credit note affecting tax may be issued only up to 30 November
// following the end of the financial year of the original invoice. Returns true if the
// credit-note date is within that window. Indian FY ends 31 March.
export function creditNoteWithinSec34(invoiceDate, creditNoteDate) {
  if (!invoiceDate || !creditNoteDate) return true; // can't judge — don't block
  const inv = new Date(invoiceDate);
  const fyEndYear = inv.getMonth() >= 3 ? inv.getFullYear() + 1 : inv.getFullYear();
  const deadline = new Date(`${fyEndYear}-11-30T23:59:59`);
  return new Date(creditNoteDate) <= deadline;
}
