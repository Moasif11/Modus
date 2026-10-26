// Pure ITC eligibility rules (CGST Sec 17(5) blocked credits). No DB, no imports.

export const ITC_ELIGIBILITY = ["eligible", "ineligible_section_17_5", "ineligible_others"];

const BLOCKED_17_5 = new Set(["petrol", "food", "travel"]);
const OUT_OF_SCOPE = new Set(["salary"]); // employee cost — not a GST supply

export function defaultItcEligibility(category) {
  const c = (category || "").toLowerCase();
  if (BLOCKED_17_5.has(c)) return "ineligible_section_17_5";
  if (OUT_OF_SCOPE.has(c)) return "ineligible_others";
  return "eligible";
}

export function isBlockedItc(eligibility) {
  return eligibility === "ineligible_section_17_5" || eligibility === "ineligible_others";
}
