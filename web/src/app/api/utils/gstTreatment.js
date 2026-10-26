// Pure GST-treatment → tax-context derivation. No DB, no imports.

export const GST_TREATMENTS = [
  "registered_regular",
  "registered_composition",
  "unregistered",
  "sez_with_payment",
  "sez_without_payment",
  "overseas",       // export of service
  "deemed_export",
  "uin",
];

// Treatments that make a supply B2B (HSN/SAC mandatory). Single source of truth — used by
// invoice create/update guards. Unregistered/overseas/uin are not B2B for HSN purposes.
export const B2B_TREATMENTS = [
  "registered_regular",
  "registered_composition",
  "sez_with_payment",
  "sez_without_payment",
  "deemed_export",
];

// Place-of-supply code for foreign supply (GST: 96 = foreign country / 97 = other territory).
const FOREIGN_POS = "96";

export function deriveTaxContext(p) {
  const { gstTreatment, sellerStateCode, partyStateCode, placeOfSupplyCode, side = "sales", vendorTreatment } = p;

  const isForeign = gstTreatment === "overseas";
  const zeroRated = gstTreatment === "overseas" || gstTreatment === "sez_without_payment";

  // Normalize codes (string vs number, "6" vs "06") so type mismatches never flip the split.
  const norm = (c) => (c != null && c !== "" ? String(c).padStart(2, "0") : null);
  let pos = norm(placeOfSupplyCode);
  if (!pos) pos = isForeign ? FOREIGN_POS : norm(partyStateCode);
  const seller = norm(sellerStateCode);

  let isInterstate;
  if (isForeign || gstTreatment === "sez_with_payment" || gstTreatment === "sez_without_payment" || gstTreatment === "deemed_export") {
    isInterstate = true;
  } else {
    isInterstate = !!(pos && seller && pos !== seller);
  }

  let taxType;
  if (zeroRated) taxType = "no_tax";
  else if (isInterstate) taxType = "igst";
  else taxType = "cgst_sgst";

  const rcmApplicable = side === "purchase" && vendorTreatment === "overseas";

  return { placeOfSupplyCode: pos, isInterstate, taxType, zeroRated, rcmApplicable };
}
