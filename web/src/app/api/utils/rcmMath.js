// Pure reverse-charge tax computation. No DB, no imports.
const r2 = (n) => Math.round((parseFloat(n) || 0) * 100) / 100;

export function computeRcmTax({ taxableAmount, rate, isInterstate }) {
  const taxable = parseFloat(taxableAmount) || 0;
  const gst = parseFloat(rate) || 0;
  const total = r2((taxable * gst) / 100);
  if (isInterstate) return { igst: total, cgst: 0, sgst: 0, total };
  const half = r2(total / 2);
  return { igst: 0, cgst: half, sgst: r2(total - half), total };
}
