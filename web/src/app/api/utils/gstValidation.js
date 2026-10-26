// Pure GST validation. No DB, no imports.

const CODEPOINTS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

// Standard GSTN MOD-36 checksum over the first 14 characters.
export function gstinCheckDigit(base14) {
  if (!base14 || base14.length !== 14) return null;
  const factor = 36;
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const code = CODEPOINTS.indexOf(base14[i]);
    if (code < 0) return null;
    const multiplier = i % 2 === 0 ? 1 : 2;
    const prod = code * multiplier;
    sum += Math.floor(prod / factor) + (prod % factor);
  }
  const check = (factor - (sum % factor)) % factor;
  return CODEPOINTS[check];
}

export function isValidGstin(gstin) {
  if (!gstin || typeof gstin !== "string") return false;
  const g = gstin.trim().toUpperCase();
  if (g.length !== 15) return false;
  if (!GSTIN_RE.test(g)) return false;
  return gstinCheckDigit(g.slice(0, 14)) === g[14];
}

export function stateCodeFromGstin(gstin) {
  if (!isValidGstin(gstin)) {
    if (typeof gstin === "string" && /^[0-9]{2}/.test(gstin) && gstin.length === 15) {
      return gstin.slice(0, 2);
    }
    return null;
  }
  return gstin.trim().toUpperCase().slice(0, 2);
}

// Minimum HSN/SAC digits: 6 if AATO > 5cr, else 4 (Notification 78/2020).
export function validateHsnSac(code, { b2b, turnoverAbove5cr }) {
  const c = (code || "").trim();
  if (!c) {
    if (b2b) return { ok: false, reason: "HSN/SAC is mandatory on B2B invoices" };
    if (turnoverAbove5cr) return { ok: false, reason: "HSN/SAC is mandatory when turnover exceeds ₹5cr" };
    return { ok: true };
  }
  if (!/^[0-9]+$/.test(c)) return { ok: false, reason: "HSN/SAC must be numeric" };
  const min = turnoverAbove5cr ? 6 : 4;
  if (c.length < min) return { ok: false, reason: `HSN/SAC must be at least ${min} digits` };
  return { ok: true };
}
