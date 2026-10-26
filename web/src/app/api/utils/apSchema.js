import sql from "@/app/api/utils/sql";
import { defaultItcEligibility } from "@/app/api/utils/itcRules";

let ensured = false;

export async function ensureApGstColumns() {
  if (ensured) return;
  await sql`ALTER TABLE bills ADD COLUMN IF NOT EXISTS is_rcm BOOLEAN DEFAULT false`;
  await sql`ALTER TABLE bills ADD COLUMN IF NOT EXISTS rcm_section VARCHAR(40)`;
  await sql`ALTER TABLE bills ADD COLUMN IF NOT EXISTS rcm_rate NUMERIC(5,2) DEFAULT 0`;
  await sql`ALTER TABLE bills ADD COLUMN IF NOT EXISTS rcm_tax_amount NUMERIC(14,2) DEFAULT 0`;
  await sql`ALTER TABLE bills ADD COLUMN IF NOT EXISTS itc_eligibility VARCHAR(30)`;
  await sql`ALTER TABLE bills ADD COLUMN IF NOT EXISTS self_invoice_number VARCHAR(40)`;

  // Backfill itc_eligibility for existing rows using category defaults (idempotent).
  const rows = await sql`SELECT id, category FROM bills WHERE itc_eligibility IS NULL`;
  for (const b of rows) {
    await sql`UPDATE bills SET itc_eligibility = ${defaultItcEligibility(b.category)} WHERE id = ${b.id}`;
  }
  ensured = true;
}

// Indian financial year for a date — starts April. e.g. June 2026 → "2026-27".
function indianFY(d) {
  const start = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

function selfInvoiceShape(prefix, format, date) {
  if (format === "calendar") {
    const sp = `${prefix}-${date.getFullYear()}-`;
    return { searchPrefix: sp, build: (s) => `${sp}${String(s).padStart(4, "0")}` };
  }
  if (format === "ym") {
    const sp = `${prefix}-${String(date.getFullYear() % 100).padStart(2, "0")}${String(date.getMonth() + 1).padStart(2, "0")}-`;
    return { searchPrefix: sp, build: (s) => `${sp}${String(s).padStart(3, "0")}` };
  }
  if (format === "plain") {
    const sp = `${prefix}-`;
    return { searchPrefix: sp, build: (s) => `${sp}${String(s).padStart(5, "0")}` };
  }
  const sp = `${prefix}/${indianFY(date)}/`;
  return { searchPrefix: sp, build: (s) => `${sp}${String(s).padStart(3, "0")}` };
}

// Compute the next self-invoice number (Sec 31(3)(f) consecutive series). Self-heals
// from the max existing number in the current period prefix — never collides.
export async function getNextSelfInvoiceNumber() {
  const s = (await sql`SELECT self_invoice_prefix, invoice_format FROM company_settings ORDER BY id ASC LIMIT 1`)[0] || {};
  const shape = selfInvoiceShape(s.self_invoice_prefix || "SI", s.invoice_format || "fy", new Date());
  const rows = await sql`SELECT self_invoice_number FROM bills WHERE self_invoice_number LIKE ${shape.searchPrefix + "%"}`;
  let maxSeq = 0;
  for (const r of rows) {
    const n = parseInt(String(r.self_invoice_number).slice(shape.searchPrefix.length), 10);
    if (!isNaN(n) && n > maxSeq) maxSeq = n;
  }
  return shape.build(maxSeq + 1);
}
