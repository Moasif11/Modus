// Pure export-supply classification + INR conversion for GST reporting. No DB, no imports.

// Treatments that are zero-rated / export supplies (GSTR-1 Table 6).
export const EXPORT_TREATMENTS = ["overseas", "sez_with_payment", "sez_without_payment", "deemed_export"];

export function isExportSupply(treatment) {
  return EXPORT_TREATMENTS.includes(treatment);
}

// GSTR-1 sub-table: 6A exports, 6B SEZ, 6C deemed exports.
export function exportTable(treatment) {
  if (treatment === "overseas") return "6A";
  if (treatment === "sez_with_payment" || treatment === "sez_without_payment") return "6B";
  if (treatment === "deemed_export") return "6C";
  return null;
}

// WPAY = with payment of IGST; WOPAY = without payment (under LUT / bond).
export function exportPaymentType(treatment) {
  if (treatment === "sez_with_payment") return "WPAY";
  return "WOPAY";
}

// Convert a document-currency amount to INR using the stored exchange rate.
export function toINR(amount, exchangeRate) {
  return Math.round((parseFloat(amount) || 0) * (parseFloat(exchangeRate) || 1) * 100) / 100;
}
