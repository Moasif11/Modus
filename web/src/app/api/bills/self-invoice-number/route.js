import sql from "@/app/api/utils/sql";
import { requireAuth } from "@/app/api/utils/auth";
import { ensureApGstColumns } from "@/app/api/utils/apSchema";

// Indian financial year for a date — starts April. e.g. June 2026 → "2026-27".
function indianFY(d) {
  const start = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

// { searchPrefix, build(seq) } for a prefix + format + date.
function siShape(prefix, format, date) {
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
    await ensureApGstColumns();

    const settings = await sql`
      SELECT self_invoice_prefix, invoice_format FROM company_settings ORDER BY id ASC LIMIT 1
    `;
    const prefix = settings[0]?.self_invoice_prefix || "SI";
    const format = settings[0]?.invoice_format || "fy";
    const shape = siShape(prefix, format, new Date());

    // Self-heal: next sequence = max existing self-invoice number for the current period prefix.
    const rows = await sql`
      SELECT self_invoice_number FROM bills
      WHERE self_invoice_number LIKE ${shape.searchPrefix + "%"}
    `;
    let maxSeq = 0;
    for (const r of rows) {
      const n = parseInt(String(r.self_invoice_number).slice(shape.searchPrefix.length), 10);
      if (!isNaN(n) && n > maxSeq) maxSeq = n;
    }
    const seq = maxSeq + 1;

    return Response.json({ number: shape.build(seq), prefix, seq, format });
  } catch (error) {
    if (error.message === "UNAUTHORIZED") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Get next self-invoice number error:", error);
    return Response.json(
      { error: "Failed to get next self-invoice number" },
      { status: 500 },
    );
  }
}
