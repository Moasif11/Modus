import sql from "@/app/api/utils/sql";
import { requireAuth, logAudit } from "@/app/api/utils/auth";
import { ensureTdsColumns } from "@/app/api/utils/tdsSchema";
import { computeTds, isValidTdsSection } from "@/app/api/utils/tdsRules";
import { recomputeInvoiceStatus } from "@/app/api/utils/invoiceStatus";

// Record TDS deducted by the CLIENT on this invoice (TDS receivable — claim in 26AS/ITR).
// Computed on the invoice's taxable value (ex-GST). Pass tdsAmount: 0 / section: "" to clear.
export async function POST(request, { params }) {
  try {
    const user = await requireAuth(request);
    await ensureTdsColumns();
    const { id } = params;
    const body = await request.json();
    const { tdsSection, tdsRate, tdsAmount } = body;

    if (!isValidTdsSection(tdsSection)) return Response.json({ error: "Invalid TDS section" }, { status: 400 });

    const inv = (await sql`SELECT taxable_amount, grand_total FROM invoices WHERE id = ${id}`)[0];
    if (!inv) return Response.json({ error: "Invoice not found" }, { status: 404 });

    const rate = tdsSection ? (parseFloat(tdsRate) || 0) : 0;
    // Prefer an explicit amount if given; else compute rate × taxable value.
    let amount = 0;
    if (tdsSection) {
      amount = (tdsAmount != null && tdsAmount !== "") ? (parseFloat(tdsAmount) || 0) : computeTds(parseFloat(inv.taxable_amount) || 0, rate);
    }
    // Cannot exceed the invoice value.
    if (amount > parseFloat(inv.grand_total) + 0.01) {
      return Response.json({ error: "TDS cannot exceed the invoice total" }, { status: 400 });
    }

    await sql`
      UPDATE invoices
      SET tds_section = ${tdsSection || null}, tds_rate = ${rate}, tds_amount = ${amount}, updated_at = NOW()
      WHERE id = ${id}
    `;
    const recomputed = await recomputeInvoiceStatus(id);
    await logAudit({ userId: user.id, action: "record_invoice_tds", entityType: "invoice", entityId: parseInt(id), metadata: { tdsSection, amount }, request });
    return Response.json({ ok: true, tdsAmount: amount, invoiceStatus: recomputed?.status, balanceDue: recomputed?.balanceDue });
  } catch (error) {
    if (error.message === "UNAUTHORIZED") return Response.json({ error: "Unauthorized" }, { status: 401 });
    return Response.json({ error: error.code ? "Database error" : error.message }, { status: 500 });
  }
}
