import sql from "@/app/api/utils/sql";
import { requireAuth } from "@/app/api/utils/auth";
import { invoiceShape } from "@/app/api/utils/invoiceNumber";

export async function GET(request) {
  try {
    await requireAuth(request);

    const settings = await sql`
      SELECT proforma_prefix, invoice_format FROM company_settings LIMIT 1
    `;
    if (settings.length === 0) {
      return Response.json(
        { error: "Company settings not found" },
        { status: 404 },
      );
    }

    const prefix = settings[0].proforma_prefix || "PI";
    const format = settings[0].invoice_format || "fy";
    const shape = invoiceShape(prefix, format, new Date());

    // Self-heal: derive the next sequence from the max existing number that matches the
    // current period's prefix — never collides, always advances, auto-resets on period rollover.
    const rows = await sql`
      SELECT proforma_number FROM proforma
      WHERE proforma_number LIKE ${shape.searchPrefix + "%"}
    `;
    let maxSeq = 0;
    for (const r of rows) {
      const n = parseInt(String(r.proforma_number).slice(shape.searchPrefix.length), 10);
      if (!isNaN(n) && n > maxSeq) maxSeq = n;
    }
    const number = maxSeq + 1;

    return Response.json({ proformaNumber: shape.build(number), prefix, number, format });
  } catch (error) {
    if (error.message === "UNAUTHORIZED") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Get next proforma number error:", error);
    return Response.json(
      { error: "Failed to get next proforma number" },
      { status: 500 },
    );
  }
}
