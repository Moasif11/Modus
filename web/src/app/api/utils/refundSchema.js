import sql from "@/app/api/utils/sql";

let ensured = false;

export async function ensureCreditNoteTables() {
  if (ensured) return;
  await sql`
    CREATE TABLE IF NOT EXISTS credit_notes (
      id SERIAL PRIMARY KEY,
      credit_note_number VARCHAR(40) UNIQUE,
      credit_note_date DATE NOT NULL,
      invoice_id INTEGER REFERENCES invoices(id),
      customer_id INTEGER REFERENCES customers(id),
      reason_code VARCHAR(4),
      reason_text TEXT,
      currency VARCHAR(10) DEFAULT 'INR',
      exchange_rate NUMERIC(12,6) DEFAULT 1.0,
      place_of_supply VARCHAR(255),
      place_of_supply_code VARCHAR(4),
      is_interstate BOOLEAN DEFAULT false,
      gst_category VARCHAR(40),
      taxable_amount NUMERIC(14,2) DEFAULT 0,
      cgst_amount NUMERIC(14,2) DEFAULT 0,
      sgst_amount NUMERIC(14,2) DEFAULT 0,
      igst_amount NUMERIC(14,2) DEFAULT 0,
      total_tax NUMERIC(14,2) DEFAULT 0,
      total_amount NUMERIC(14,2) DEFAULT 0,
      notes TEXT,
      status VARCHAR(20) DEFAULT 'issued',
      snapshot_seller_json JSONB,
      snapshot_buyer_json JSONB,
      pdf_url TEXT,
      pdf_object_key TEXT,
      created_by INTEGER,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS credit_note_items (
      id SERIAL PRIMARY KEY,
      credit_note_id INTEGER REFERENCES credit_notes(id) ON DELETE CASCADE,
      invoice_item_id INTEGER,
      position INTEGER DEFAULT 0,
      item_name VARCHAR(500),
      description TEXT,
      hsn_sac_code VARCHAR(20),
      unit VARCHAR(20),
      quantity NUMERIC(12,3) DEFAULT 1,
      rate NUMERIC(14,2) DEFAULT 0,
      discount NUMERIC(14,2) DEFAULT 0,
      gst_rate NUMERIC(5,2) DEFAULT 0,
      taxable_value NUMERIC(14,2) DEFAULT 0,
      cgst_amount NUMERIC(14,2) DEFAULT 0,
      sgst_amount NUMERIC(14,2) DEFAULT 0,
      igst_amount NUMERIC(14,2) DEFAULT 0,
      total_tax NUMERIC(14,2) DEFAULT 0,
      line_total NUMERIC(14,2) DEFAULT 0
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS refund_disbursements (
      id SERIAL PRIMARY KEY,
      credit_note_id INTEGER REFERENCES credit_notes(id) ON DELETE CASCADE,
      invoice_id INTEGER REFERENCES invoices(id),
      amount NUMERIC(14,2) NOT NULL,
      refund_date DATE NOT NULL,
      method VARCHAR(40) DEFAULT 'bank_transfer',
      reference_number VARCHAR(255),
      notes TEXT,
      receipt_url TEXT,
      created_by INTEGER,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  ensured = true;
}

// Indian financial year for a date — starts April.
function indianFY(d) {
  const start = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

function cnShape(prefix, format, date) {
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

// Next consecutive credit-note number (own series, GST-required). Self-heals from the
// max existing number in the current period prefix.
export async function getNextCreditNoteNumber() {
  await ensureCreditNoteTables();
  const s = (await sql`SELECT credit_note_prefix, invoice_format FROM company_settings ORDER BY id ASC LIMIT 1`)[0] || {};
  const shape = cnShape(s.credit_note_prefix || "CN", s.invoice_format || "fy", new Date());
  const rows = await sql`SELECT credit_note_number FROM credit_notes WHERE credit_note_number LIKE ${shape.searchPrefix + "%"}`;
  let maxSeq = 0;
  for (const r of rows) {
    const n = parseInt(String(r.credit_note_number).slice(shape.searchPrefix.length), 10);
    if (!isNaN(n) && n > maxSeq) maxSeq = n;
  }
  return shape.build(maxSeq + 1);
}
