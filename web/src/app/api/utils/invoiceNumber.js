import sql from "@/app/api/utils/sql";

// Indian financial year for a date — starts April. e.g. June 2026 → "2026-27".
function indianFY(d) {
  const start = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

// { searchPrefix, build(seq) } for a prefix + format + date.
export function invoiceShape(prefix, format, date) {
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

// Derive the next number from the max existing number matching the current
// period's prefix — auto-resets when the FY / year rolls over.
export async function generateInvoiceNumber(date = new Date()) {
  const settings = await sql`
    SELECT invoice_prefix, invoice_format FROM company_settings LIMIT 1
  `;
  const prefix = settings[0]?.invoice_prefix || "INV";
  const format = settings[0]?.invoice_format || "fy";
  const shape = invoiceShape(prefix, format, date);

  const rows = await sql`
    SELECT invoice_number FROM invoices
    WHERE invoice_number LIKE ${shape.searchPrefix + "%"}
  `;
  let maxSeq = 0;
  for (const r of rows) {
    const n = parseInt(String(r.invoice_number).slice(shape.searchPrefix.length), 10);
    if (!isNaN(n) && n > maxSeq) maxSeq = n;
  }
  return { invoiceNumber: shape.build(maxSeq + 1), prefix, number: maxSeq + 1, format };
}

// GST requires unique invoice serials — enforce at the DB so concurrent
// creates can't collide. If historical duplicates block index creation,
// log and continue (collision retry in POST still applies).
export async function ensureInvoiceNumberUnique() {
  try {
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS invoices_invoice_number_unique ON invoices (invoice_number)`;
  } catch (error) {
    console.error("Could not create unique index on invoices.invoice_number:", error.message);
  }
}

export function isDuplicateInvoiceNumberError(error) {
  return error?.code === "23505" && String(error?.message || "").includes("invoice_number");
}
