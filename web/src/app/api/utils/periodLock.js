// Pure period-lock + change-diff helpers. No DB, no imports.
// Once a GST/books period is filed and locked, documents dated on/before the lock
// date are immutable (must be corrected via credit/debit note or amendment).

export function isPeriodLocked(docDate, lockedUntil) {
  if (!lockedUntil || !docDate) return false;
  // Compare date-only (ignore time).
  const d = new Date(docDate); d.setHours(0, 0, 0, 0);
  const l = new Date(lockedUntil); l.setHours(0, 0, 0, 0);
  return d <= l;
}

// Shallow diff of two flat objects → { field: [oldValue, newValue] } for changed keys only.
// Used to build an immutable edit-log entry (Companies Act Rule 11(g)).
export function diffFields(before, after, keys) {
  const out = {};
  const fields = keys || Array.from(new Set([...Object.keys(before || {}), ...Object.keys(after || {})]));
  for (const k of fields) {
    const a = before ? before[k] : undefined;
    const b = after ? after[k] : undefined;
    if (a === undefined && b === undefined) continue;
    // Normalise numbers/strings for comparison.
    const na = a === null || a === undefined ? null : String(a);
    const nb = b === null || b === undefined ? null : String(b);
    if (na !== nb) out[k] = [a ?? null, b ?? null];
  }
  return out;
}
