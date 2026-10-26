import sql from "@/app/api/utils/sql";
import { requireAuth, logAudit } from "@/app/api/utils/auth";
import { ensureCreditNoteTables } from "@/app/api/utils/refundSchema";
import { recomputeInvoiceStatus } from "@/app/api/utils/invoiceStatus";
import { maxRefundable } from "@/app/api/utils/refundMath";

export async function GET(request, { params }) {
  try {
    await requireAuth(request);
    await ensureCreditNoteTables();
    const { id } = params;
    const rows = await sql`SELECT * FROM refund_disbursements WHERE credit_note_id = ${id} ORDER BY refund_date DESC`;
    return Response.json({
      refunds: rows.map((r) => ({
        id: r.id, creditNoteId: r.credit_note_id, invoiceId: r.invoice_id, amount: parseFloat(r.amount),
        refundDate: r.refund_date, method: r.method, referenceNumber: r.reference_number, notes: r.notes, receiptUrl: r.receipt_url,
      })),
    });
  } catch (error) {
    if (error.message === "UNAUTHORIZED") return Response.json({ error: "Unauthorized" }, { status: 401 });
    return Response.json({ error: error.code ? "Database error" : error.message }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    const user = await requireAuth(request);
    await ensureCreditNoteTables();
    const { id } = params; // credit_note_id
    const body = await request.json();
    const { amount, refundDate, method = "bank_transfer", referenceNumber, notes, receiptUrl } = body;

    if (!amount || parseFloat(amount) <= 0) return Response.json({ error: "Valid amount is required" }, { status: 400 });
    if (!refundDate) return Response.json({ error: "Refund date is required" }, { status: 400 });

    const cn = (await sql`SELECT invoice_id FROM credit_notes WHERE id = ${id} AND status = 'issued'`)[0];
    if (!cn) return Response.json({ error: "Issued credit note not found" }, { status: 404 });
    const invoiceId = cn.invoice_id;

    // GUARD: cannot refund more than the customer overpaid on this invoice.
    const inv = (await sql`SELECT grand_total FROM invoices WHERE id = ${invoiceId}`)[0];
    const [{ total: credits }] = await sql`SELECT COALESCE(SUM(total_amount),0) AS total FROM credit_notes WHERE invoice_id = ${invoiceId} AND status='issued'`;
    const [{ total: payments }] = await sql`SELECT COALESCE(SUM(amount),0) AS total FROM payments WHERE invoice_id = ${invoiceId}`;
    const [{ total: refunds }] = await sql`SELECT COALESCE(SUM(amount),0) AS total FROM refund_disbursements WHERE invoice_id = ${invoiceId}`;
    const refundable = maxRefundable(inv.grand_total, credits, payments, refunds);
    if (parseFloat(amount) > refundable + 0.01) {
      return Response.json({ error: `Refund exceeds refundable overpayment of ${refundable}` }, { status: 400 });
    }

    const r = (await sql`
      INSERT INTO refund_disbursements (credit_note_id, invoice_id, amount, refund_date, method, reference_number, notes, receipt_url, created_by)
      VALUES (${id}, ${invoiceId}, ${parseFloat(amount)}, ${refundDate}, ${method}, ${referenceNumber || null}, ${notes || null}, ${receiptUrl || null}, ${user.id})
      RETURNING *
    `)[0];

    const recomputed = await recomputeInvoiceStatus(invoiceId);
    await logAudit({ userId: user.id, action: "record_refund", entityType: "refund_disbursement", entityId: r.id, metadata: { invoiceId, amount: parseFloat(amount) }, request });

    return Response.json({ id: r.id, amount: parseFloat(r.amount), invoiceStatus: recomputed?.status, balanceDue: recomputed?.balanceDue }, { status: 201 });
  } catch (error) {
    if (error.message === "UNAUTHORIZED") return Response.json({ error: "Unauthorized" }, { status: 401 });
    console.error("Record refund error:", error);
    return Response.json({ error: error.code ? "Database error" : error.message }, { status: 500 });
  }
}
