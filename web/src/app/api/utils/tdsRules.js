// Pure TDS (Tax Deducted at Source) rules. No DB, no imports.
// Rates reflect FY 2026-27 (incl. 194H reduced to 2% w.e.f. 01-Oct-2024).
// TDS base is the amount EXCLUDING GST (CBDT Circular 23/2017) when GST is shown separately.

export const TDS_SECTIONS = [
  { code: "194C",  label: "194C — Contractor / sub-contractor", defaultRate: 2 },
  { code: "194J",  label: "194J — Professional / technical fees", defaultRate: 10 },
  { code: "194J-T", label: "194J — Technical services (2%)", defaultRate: 2 },
  { code: "194H",  label: "194H — Commission / brokerage", defaultRate: 2 },
  { code: "194I",  label: "194I — Rent (land/building)", defaultRate: 10 },
  { code: "194I-P", label: "194I — Rent (plant/machinery)", defaultRate: 2 },
  { code: "194Q",  label: "194Q — Purchase of goods", defaultRate: 0.1 },
];

export function defaultTdsRate(section) {
  const s = TDS_SECTIONS.find((x) => x.code === section);
  return s ? s.defaultRate : 0;
}

export function isValidTdsSection(section) {
  return !section || TDS_SECTIONS.some((x) => x.code === section);
}

// TDS amount on a base value at a given rate, rounded to 2 decimals.
export function computeTds(baseAmount, rate) {
  return Math.round((parseFloat(baseAmount) || 0) * (parseFloat(rate) || 0)) / 100;
}

// Base for TDS = value excluding GST. Given a gross amount (incl. tax) and the tax, returns the net.
export function tdsBase(grossAmount, taxAmount) {
  return Math.round(((parseFloat(grossAmount) || 0) - (parseFloat(taxAmount) || 0)) * 100) / 100;
}
