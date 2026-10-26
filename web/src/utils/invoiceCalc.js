// Invoice calculation utilities

// Calculate line item totals
export function calculateLineItem({
  quantity,
  unitPrice,
  discountPercent = 0,
  gstRate = 0,
  taxInclusive = false,
  sellerStateCode,
  placeOfSupplyCode,
}) {
  const qty = parseFloat(quantity) || 0;
  const price = parseFloat(unitPrice) || 0;
  const discount = parseFloat(discountPercent) || 0;
  const gst = parseFloat(gstRate) || 0;

  let taxableValue;
  let discountAmount;

  if (taxInclusive) {
    // Tax inclusive: back out tax from price
    const grossAmount = qty * price;
    discountAmount = (grossAmount * discount) / 100;
    const afterDiscount = grossAmount - discountAmount;
    taxableValue = afterDiscount / (1 + gst / 100);
  } else {
    // Tax exclusive: straightforward
    const grossAmount = qty * price;
    discountAmount = (grossAmount * discount) / 100;
    taxableValue = grossAmount - discountAmount;
  }

  // Determine if inter-state. Normalize codes (string vs number, "6" vs "06")
  // so a type mismatch never silently flips the CGST/SGST vs IGST split.
  const seller = sellerStateCode != null && sellerStateCode !== "" ? String(sellerStateCode).padStart(2, "0") : null;
  const pos = placeOfSupplyCode != null && placeOfSupplyCode !== "" ? String(placeOfSupplyCode).padStart(2, "0") : null;
  const isInterstate = !!(seller && pos && seller !== pos);

  let cgstRate = 0,
    sgstRate = 0,
    igstRate = 0;
  let cgstAmount = 0,
    sgstAmount = 0,
    igstAmount = 0;

  if (isInterstate) {
    // IGST
    igstRate = gst;
    igstAmount = (taxableValue * gst) / 100;
  } else {
    // CGST + SGST
    cgstRate = gst / 2;
    sgstRate = gst / 2;
    cgstAmount = (taxableValue * cgstRate) / 100;
    sgstAmount = (taxableValue * sgstRate) / 100;
  }

  const totalTax = cgstAmount + sgstAmount + igstAmount;
  const lineTotal = taxableValue + totalTax;

  return {
    taxableValue: round(taxableValue),
    discountAmount: round(discountAmount),
    cgstRate: round(cgstRate, 2),
    sgstRate: round(sgstRate, 2),
    igstRate: round(igstRate, 2),
    cgstAmount: round(cgstAmount),
    sgstAmount: round(sgstAmount),
    igstAmount: round(igstAmount),
    totalTax: round(totalTax),
    lineTotal: round(lineTotal),
    isInterstate,
  };
}

// Calculate invoice totals from items
export function calculateInvoiceTotals(items) {
  let subtotal = 0;
  let totalDiscount = 0;
  let taxableAmount = 0;
  let cgstAmount = 0;
  let sgstAmount = 0;
  let igstAmount = 0;

  for (const item of items) {
    subtotal += (item.quantity || 0) * (item.unitPrice || 0);
    totalDiscount += item.discountAmount || 0;
    taxableAmount += item.taxableValue || 0;
    cgstAmount += item.cgstAmount || 0;
    sgstAmount += item.sgstAmount || 0;
    igstAmount += item.igstAmount || 0;
  }

  const totalTax = cgstAmount + sgstAmount + igstAmount;
  const beforeRounding = taxableAmount + totalTax;
  const grandTotal = Math.round(beforeRounding);
  const roundOff = grandTotal - beforeRounding;

  return {
    subtotal: round(subtotal),
    totalDiscount: round(totalDiscount),
    taxableAmount: round(taxableAmount),
    cgstAmount: round(cgstAmount),
    sgstAmount: round(sgstAmount),
    igstAmount: round(igstAmount),
    totalTax: round(totalTax),
    roundOff: round(roundOff),
    grandTotal: round(grandTotal),
  };
}

// Round to 2 decimal places
function round(num, decimals = 2) {
  return Math.round(num * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

// Indian states with codes
export const INDIAN_STATES = [
  { name: "Andhra Pradesh", code: "37" },
  { name: "Arunachal Pradesh", code: "12" },
  { name: "Assam", code: "18" },
  { name: "Bihar", code: "10" },
  { name: "Chhattisgarh", code: "22" },
  { name: "Goa", code: "30" },
  { name: "Gujarat", code: "24" },
  { name: "Haryana", code: "06" },
  { name: "Himachal Pradesh", code: "02" },
  { name: "Jharkhand", code: "20" },
  { name: "Karnataka", code: "29" },
  { name: "Kerala", code: "32" },
  { name: "Madhya Pradesh", code: "23" },
  { name: "Maharashtra", code: "27" },
  { name: "Manipur", code: "14" },
  { name: "Meghalaya", code: "17" },
  { name: "Mizoram", code: "15" },
  { name: "Nagaland", code: "13" },
  { name: "Odisha", code: "21" },
  { name: "Punjab", code: "03" },
  { name: "Rajasthan", code: "08" },
  { name: "Sikkim", code: "11" },
  { name: "Tamil Nadu", code: "33" },
  { name: "Telangana", code: "36" },
  { name: "Tripura", code: "16" },
  { name: "Uttar Pradesh", code: "09" },
  { name: "Uttarakhand", code: "05" },
  { name: "West Bengal", code: "19" },
  { name: "Delhi", code: "07" },
  { name: "Jammu and Kashmir", code: "01" },
  { name: "Ladakh", code: "38" },
  { name: "Puducherry", code: "34" },
  { name: "Chandigarh", code: "04" },
  { name: "Dadra and Nagar Haveli and Daman and Diu", code: "26" },
  { name: "Lakshadweep", code: "31" },
  { name: "Andaman and Nicobar Islands", code: "35" },
];
