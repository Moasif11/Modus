import sql from "@/app/api/utils/sql";

let ensured = false;

export async function ensureGstTreatmentColumns() {
  if (ensured) return;
  await sql`ALTER TABLE customers ADD COLUMN IF NOT EXISTS gst_treatment VARCHAR(40)`;
  await sql`ALTER TABLE vendors   ADD COLUMN IF NOT EXISTS gst_treatment VARCHAR(40)`;
  await sql`ALTER TABLE invoices  ADD COLUMN IF NOT EXISTS gst_treatment VARCHAR(40)`;
  await sql`ALTER TABLE bills     ADD COLUMN IF NOT EXISTS gst_treatment VARCHAR(40)`;

  // One-time backfill from GSTIN presence (idempotent — only fills NULLs).
  await sql`UPDATE customers SET gst_treatment = CASE WHEN gstin IS NOT NULL AND gstin <> '' THEN 'registered_regular' ELSE 'unregistered' END WHERE gst_treatment IS NULL`;
  await sql`UPDATE vendors   SET gst_treatment = CASE WHEN gstin IS NOT NULL AND gstin <> '' THEN 'registered_regular' ELSE 'unregistered' END WHERE gst_treatment IS NULL`;
  ensured = true;
}
