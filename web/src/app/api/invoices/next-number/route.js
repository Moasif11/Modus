import sql from "@/app/api/utils/sql";
import { requireAuth } from "@/app/api/utils/auth";

// Indian financial year for a date — starts April. e.g. June 2026 → "2026-27".
function indianFY(d) {
  const start = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

// { searchPrefix, build(seq), period } for a prefix + format + date.
function invoiceShape(prefix, format, date) {
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

export async function GET(request) {
  try {
    await requireAuth(request);

    const settings = await sql`
      SELECT invoice_prefix, invoice_format FROM company_settings LIMIT 1
    `;
    if (settings.length === 0) {
      return Response.json({ error: "Company settings not found" }, { status: 404 });
    }

    const prefix = settings[0].invoice_prefix || "INV";
    const format = settings[0].invoice_format || "fy";
    const shape = invoiceShape(prefix, format, new Date());

    // Self-heal: derive the next sequence from the max existing number that matches the
    // current period's prefix — never collides, and auto-resets when the FY / year rolls over.
    const rows = await sql`
      SELECT invoice_number FROM invoices
      WHERE invoice_number LIKE ${shape.searchPrefix + "%"}
    `;
    let maxSeq = 0;
    for (const r of rows) {
      const n = parseInt(String(r.invoice_number).slice(shape.searchPrefix.length), 10);
      if (!isNaN(n) && n > maxSeq) maxSeq = n;
    }
    const number = maxSeq + 1;

    return Response.json({ invoiceNumber: shape.build(number), prefix, number, format });
  } catch (error) {
    if (error.message === "UNAUTHORIZED") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Get next invoice number error:", error);
    return Response.json(
      { error: "Failed to get next invoice number" },
      { status: 500 },
    );
  }
}
