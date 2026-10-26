import sql from "@/app/api/utils/sql";
import { requireAuth, logAudit } from "@/app/api/utils/auth";
import { ensureCreditNoteTables } from "@/app/api/utils/refundSchema";
import { recomputeInvoiceStatus } from "@/app/api/utils/invoiceStatus";

export async function GET(request, { params }) {
  try {
    await requireAuth(request);
    await ensureCreditNoteTables();
    const { id } = params;
    const cn = (await sql`
      SELECT cn.*, c.name AS customer_name, c.company_name AS customer_company, c.gstin AS customer_gstin,
             i.invoice_number, i.invoice_date AS original_invoice_date
      FROM credit_notes cn
      LEFT JOIN customers c ON cn.customer_id = c.id
      LEFT JOIN invoices i ON cn.invoice_id = i.id
      WHERE cn.id = ${id}
    `)[0];
    if (!cn) return Response.json({ error: "Credit note not found" }, { status: 404 });
    const items = await sql`SELECT * FROM credit_note_items WHERE credit_note_id = ${id} ORDER BY position ASC`;
    const refunds = await sql`SELECT * FROM refund_disbursements WHERE credit_note_id = ${id} ORDER BY refund_date DESC`;
    return Response.json({
      id: cn.id,
      creditNoteNumber: cn.credit_note_number,
      creditNoteDate: cn.credit_note_date,
      invoiceId: cn.invoice_id,
      invoiceNumber: cn.invoice_number,
      originalInvoiceDate: cn.original_invoice_date,
      customerName: cn.customer_company || cn.customer_name || "—",
      customerGstin: cn.customer_gstin || "",
      reasonCode: cn.reason_code,
      reasonText: cn.reason_text,
      currency: cn.currency || "INR",
      isInterstate: cn.is_interstate,
      placeOfSupply: cn.place_of_supply,
      gstCategory: cn.gst_category,
      taxableAmount: parseFloat(cn.taxable_amount),
      cgstAmount: parseFloat(cn.cgst_amount),
      sgstAmount: parseFloat(cn.sgst_amount),
      igstAmount: parseFloat(cn.igst_amount),
      totalTax: parseFloat(cn.total_tax),
      totalAmount: parseFloat(cn.total_amount),
      notes: cn.notes,
      status: cn.status,
      pdfUrl: cn.pdf_url,
      snapshotSeller: cn.snapshot_seller_json,
      snapshotBuyer: cn.snapshot_buyer_json,
      items: items.map((it) => ({
        id: it.id, itemName: it.item_name, description: it.description, hsnSacCode: it.hsn_sac_code,
        unit: it.unit, quantity: parseFloat(it.quantity), rate: parseFloat(it.rate), discount: parseFloat(it.discount),
        gstRate: parseFloat(it.gst_rate), taxableValue: parseFloat(it.taxable_value),
        cgstAmount: parseFloat(it.cgst_amount), sgstAmount: parseFloat(it.sgst_amount),
        igstAmount: parseFloat(it.igst_amount), totalTax: parseFloat(it.total_tax), lineTotal: parseFloat(it.line_total),
      })),
      refunds: refunds.map((r) => ({
        id: r.id, amount: parseFloat(r.amount), refundDate: r.refund_date, method: r.method,
        referenceNumber: r.reference_number, notes: r.notes, receiptUrl: r.receipt_url,
      })),
    });
  } catch (error) {
    if (error.message === "UNAUTHORIZED") return Response.json({ error: "Unauthorized" }, { status: 401 });
    return Response.json({ error: "Failed to load credit note" }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    await requireAuth(request);
    await ensureCreditNoteTables();
    const { id } = params;
    const body = await request.json();
    const { reasonCode, reasonText, notes } = body;
    await sql`
      UPDATE credit_notes
      SET reason_code = COALESCE(${reasonCode ?? null}, reason_code),
          reason_text = ${reasonText ?? null},
          notes = ${notes ?? null},
          updated_at = NOW()
      WHERE id = ${id}
    `;
    return Response.json({ ok: true });
  } catch (error) {
    if (error.message === "UNAUTHORIZED") return Response.json({ error: "Unauthorized" }, { status: 401 });
    return Response.json({ error: "Failed to update credit note" }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const user = await requireAuth(request);
    await ensureCreditNoteTables();
    const { id } = params;
    const cn = (await sql`SELECT invoice_id, status FROM credit_notes WHERE id = ${id}`)[0];
    if (!cn) return Response.json({ error: "Credit note not found" }, { status: 404 });

    const [{ count }] = await sql`SELECT COUNT(*)::int AS count FROM refund_disbursements WHERE credit_note_id = ${id}`;
    if (count > 0) return Response.json({ error: "Delete the linked refund(s) before cancelling this credit note" }, { status: 400 });

    await sql`UPDATE credit_notes SET status = 'cancelled', updated_at = NOW() WHERE id = ${id}`;
    const recomputed = await recomputeInvoiceStatus(cn.invoice_id);
    await logAudit({ userId: user.id, action: "cancel_credit_note", entityType: "credit_note", entityId: parseInt(id), metadata: { invoiceId: cn.invoice_id }, request });
    return Response.json({ ok: true, invoiceStatus: recomputed?.status, balanceDue: recomputed?.balanceDue });
  } catch (error) {
    if (error.message === "UNAUTHORIZED") return Response.json({ error: "Unauthorized" }, { status: 401 });
    return Response.json({ error: "Failed to cancel credit note" }, { status: 500 });
  }
}
