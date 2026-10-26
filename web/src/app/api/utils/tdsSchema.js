import sql from "@/app/api/utils/sql";

let ensured = false;

// TDS columns on both sides:
//  - invoices.tds_* = TDS the CLIENT deducts on our invoice (TDS receivable, claim in 26AS/ITR)
//  - bills.tds_*    = TDS WE deduct on a vendor/contractor bill (TDS payable, deposit + 26Q)
export async function ensureTdsColumns() {
  if (ensured) return;
  await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tds_section VARCHAR(10)`;
  await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tds_rate NUMERIC(5,2) DEFAULT 0`;
  await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tds_amount NUMERIC(14,2) DEFAULT 0`;
  await sql`ALTER TABLE bills ADD COLUMN IF NOT EXISTS tds_section VARCHAR(10)`;
  await sql`ALTER TABLE bills ADD COLUMN IF NOT EXISTS tds_rate NUMERIC(5,2) DEFAULT 0`;
  await sql`ALTER TABLE bills ADD COLUMN IF NOT EXISTS tds_amount NUMERIC(14,2) DEFAULT 0`;
  await sql`ALTER TABLE bills ADD COLUMN IF NOT EXISTS tds_deposited BOOLEAN DEFAULT false`;
  ensured = true;
}
