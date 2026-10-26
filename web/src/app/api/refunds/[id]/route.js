import sql from "@/app/api/utils/sql";
import { requireAuth, logAudit } from "@/app/api/utils/auth";
import { ensureCreditNoteTables } from "@/app/api/utils/refundSchema";
import { recomputeInvoiceStatus } from "@/app/api/utils/invoiceStatus";

export async function PUT(request, { params }) {
  try {
    await requireAuth(request);
    await ensureCreditNoteTables();
    const { id } = params;
    const body = await request.json();
    const { amount, refundDate, method, referenceNumber, notes } = body;
    const existing = (await sql`SELECT invoice_id FROM refund_disbursements WHERE id = ${id}`)[0];
    if (!existing) return Response.json({ error: "Refund not found" }, { status: 404 });
    await sql`
      UPDATE refund_disbursements
      SET amount = COALESCE(${amount ?? null}, amount),
          refund_date = COALESCE(${refundDate ?? null}, refund_date),
          method = COALESCE(${method ?? null}, method),
          reference_number = ${referenceNumber ?? null},
          notes = ${notes ?? null}
      WHERE id = ${id}
    `;
    const recomputed = await recomputeInvoiceStatus(existing.invoice_id);
    return Response.json({ ok: true, invoiceStatus: recomputed?.status, balanceDue: recomputed?.balanceDue });
  } catch (error) {
    if (error.message === "UNAUTHORIZED") return Response.json({ error: "Unauthorized" }, { status: 401 });
    return Response.json({ error: error.code ? "Database error" : error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const user = await requireAuth(request);
    await ensureCreditNoteTables();
    const { id } = params;
    const existing = (await sql`SELECT invoice_id FROM refund_disbursements WHERE id = ${id}`)[0];
    if (!existing) return Response.json({ error: "Refund not found" }, { status: 404 });
    await sql`DELETE FROM refund_disbursements WHERE id = ${id}`;
    const recomputed = await recomputeInvoiceStatus(existing.invoice_id);
    await logAudit({ userId: user.id, action: "delete_refund", entityType: "refund_disbursement", entityId: parseInt(id), metadata: { invoiceId: existing.invoice_id }, request });
    return Response.json({ ok: true, invoiceStatus: recomputed?.status, balanceDue: recomputed?.balanceDue });
  } catch (error) {
    if (error.message === "UNAUTHORIZED") return Response.json({ error: "Unauthorized" }, { status: 401 });
    return Response.json({ error: error.code ? "Database error" : error.message }, { status: 500 });
  }
}
