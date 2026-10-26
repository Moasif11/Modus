import sql from "@/app/api/utils/sql";
import { requireAuth, logAudit } from "@/app/api/utils/auth";
import { ensureCreditNoteTables, getNextCreditNoteNumber } from "@/app/api/utils/refundSchema";
import { recomputeInvoiceStatus } from "@/app/api/utils/invoiceStatus";
import { maxIssuableCredit, round2, creditNoteWithinSec34 } from "@/app/api/utils/refundMath";

export async function GET(request) {
  try {
    await requireAuth(request);
    await ensureCreditNoteTables();
    const url = new URL(request.url);
    const invoiceId = url.searchParams.get("invoiceId");

    const rows = invoiceId
      ? await sql`
          SELECT cn.*, c.name AS customer_name, c.company_name AS customer_company, i.invoice_number
          FROM credit_notes cn
          LEFT JOIN customers c ON cn.customer_id = c.id
          LEFT JOIN invoices i ON cn.invoice_id = i.id
          WHERE cn.invoice_id = ${invoiceId}
          ORDER BY cn.created_at DESC`
      : await sql`
          SELECT cn.*, c.name AS customer_name, c.company_name AS customer_company, i.invoice_number
          FROM credit_notes cn
          LEFT JOIN customers c ON cn.customer_id = c.id
          LEFT JOIN invoices i ON cn.invoice_id = i.id
          ORDER BY cn.created_at DESC`;

    return Response.json({
      creditNotes: rows.map((r) => ({
        id: r.id,
        creditNoteNumber: r.credit_note_number,
        creditNoteDate: r.credit_note_date,
        invoiceId: r.invoice_id,
        invoiceNumber: r.invoice_number,
        customerName: r.customer_company || r.customer_name || "—",
        reasonCode: r.reason_code,
        reasonText: r.reason_text,
        currency: r.currency || "INR",
        taxableAmount: parseFloat(r.taxable_amount),
        totalTax: parseFloat(r.total_tax),
        totalAmount: parseFloat(r.total_amount),
        status: r.status,
        createdAt: r.created_at,
      })),
    });
  } catch (error) {
    if (error.message === "UNAUTHORIZED") return Response.json({ error: "Unauthorized" }, { status: 401 });
    return Response.json({ error: "Failed to list credit notes" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const user = await requireAuth(request);
    await ensureCreditNoteTables();
    const body = await request.json();
    const { creditNoteDate, invoiceId, reasonCode, reasonText, notes, items, status } = body;

    if (!creditNoteDate) return Response.json({ error: "Credit note date is required" }, { status: 400 });
    if (!invoiceId) return Response.json({ error: "Original invoice is required" }, { status: 400 });
    if (!items || items.length === 0) return Response.json({ error: "At least one line item is required" }, { status: 400 });

    const inv = (await sql`
      SELECT i.*, c.gstin AS customer_gstin
      FROM invoices i LEFT JOIN customers c ON i.customer_id = c.id
      WHERE i.id = ${invoiceId}
    `)[0];
    if (!inv) return Response.json({ error: "Invoice not found" }, { status: 404 });

    // GUARD (Sec 34(2)): a credit note can reduce tax only up to 30 Nov following the invoice FY.
    if (!creditNoteWithinSec34(inv.invoice_date, creditNoteDate)) {
      return Response.json({ error: "Past the Sec 34(2) deadline (30 Nov following the invoice's financial year) — a credit note can no longer adjust GST for this invoice." }, { status: 400 });
    }

    // Compute totals from items (GST already split client-side via invoiceCalc).
    let taxable = 0, cgst = 0, sgst = 0, igst = 0;
    for (const it of items) {
      taxable += parseFloat(it.taxableValue) || 0;
      cgst += parseFloat(it.cgstAmount) || 0;
      sgst += parseFloat(it.sgstAmount) || 0;
      igst += parseFloat(it.igstAmount) || 0;
    }
    const totalTax = round2(cgst + sgst + igst);
    const totalAmount = round2(taxable + totalTax);

    // GUARD 1 (per-line): each credited line's taxable value must not exceed the matching
    // invoice line, net of taxable already credited against that line.
    const invItems = await sql`SELECT id, taxable_value FROM invoice_items WHERE invoice_id = ${invoiceId}`;
    const invLineMap = Object.fromEntries(invItems.map((r) => [r.id, parseFloat(r.taxable_value) || 0]));
    const priorByLine = {};
    for (const r of await sql`
      SELECT cni.invoice_item_id AS iid, COALESCE(SUM(cni.taxable_value),0) AS t
      FROM credit_note_items cni
      JOIN credit_notes cn ON cni.credit_note_id = cn.id
      WHERE cn.invoice_id = ${invoiceId} AND cn.status = 'issued' AND cni.invoice_item_id IS NOT NULL
      GROUP BY cni.invoice_item_id
    `) priorByLine[r.iid] = parseFloat(r.t) || 0;
    for (const it of items) {
      if (it.invoiceItemId == null) continue;
      const lineMax = invLineMap[it.invoiceItemId] ?? 0;
      const used = priorByLine[it.invoiceItemId] || 0;
      if ((parseFloat(it.taxableValue) || 0) > lineMax - used + 0.01) {
        return Response.json({ error: `Line credit exceeds remaining value for item ${it.itemName || it.invoiceItemId} (max ${round2(lineMax - used)})` }, { status: 400 });
      }
    }

    // GUARD 2 (aggregate): total issued credits must not exceed invoice grand_total.
    const [{ total: already }] = await sql`
      SELECT COALESCE(SUM(total_amount), 0) AS total FROM credit_notes
      WHERE invoice_id = ${invoiceId} AND status = 'issued'
    `;
    const headroom = maxIssuableCredit(inv.grand_total, already);
    if (totalAmount > headroom + 0.01) {
      return Response.json({ error: `Credit note (${totalAmount}) exceeds remaining invoice value (${headroom})` }, { status: 400 });
    }

    const finalStatus = status || "issued";
    const creditNoteNumber = await getNextCreditNoteNumber();

    const cn = (await sql`
      INSERT INTO credit_notes (
        credit_note_number, credit_note_date, invoice_id, customer_id,
        reason_code, reason_text, currency, exchange_rate,
        place_of_supply, place_of_supply_code, is_interstate, gst_category,
        taxable_amount, cgst_amount, sgst_amount, igst_amount, total_tax, total_amount,
        notes, status, snapshot_seller_json, snapshot_buyer_json, created_by
      ) VALUES (
        ${creditNoteNumber}, ${creditNoteDate}, ${invoiceId}, ${inv.customer_id},
        ${reasonCode || "07"}, ${reasonText || null}, ${inv.currency || "INR"}, ${inv.exchange_rate || 1.0},
        ${inv.place_of_supply || null}, ${inv.place_of_supply_code || null}, ${inv.is_interstate || false},
        ${inv.gst_category || (inv.customer_gstin ? "registered_regular" : "unregistered")},
        ${round2(taxable)}, ${round2(cgst)}, ${round2(sgst)}, ${round2(igst)}, ${totalTax}, ${totalAmount},
        ${notes || null}, ${finalStatus}, ${inv.snapshot_seller_json || null}, ${inv.snapshot_buyer_json || null}, ${user.id}
      ) RETURNING *
    `)[0];

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      await sql`
        INSERT INTO credit_note_items (
          credit_note_id, invoice_item_id, position, item_name, description, hsn_sac_code, unit,
          quantity, rate, discount, gst_rate, taxable_value, cgst_amount, sgst_amount, igst_amount, total_tax, line_total
        ) VALUES (
          ${cn.id}, ${it.invoiceItemId || null}, ${i}, ${it.itemName || null}, ${it.description || null},
          ${it.hsnSacCode || null}, ${it.unit || null}, ${it.quantity || 1}, ${it.rate || 0}, ${it.discount || 0},
          ${it.gstRate || 0}, ${it.taxableValue || 0}, ${it.cgstAmount || 0}, ${it.sgstAmount || 0},
          ${it.igstAmount || 0}, ${it.totalTax || 0}, ${it.lineTotal || 0}
        )
      `;
    }

    if (finalStatus === "issued") {
      await sql`UPDATE company_settings SET next_credit_note_number = COALESCE(next_credit_note_number,1) + 1 WHERE id = (SELECT id FROM company_settings ORDER BY id ASC LIMIT 1)`;
    }

    const recomputed = await recomputeInvoiceStatus(invoiceId);
    await logAudit({ userId: user.id, action: "create_credit_note", entityType: "credit_note", entityId: cn.id, metadata: { invoiceId, totalAmount }, request });

    return Response.json({ id: cn.id, creditNoteNumber: cn.credit_note_number, totalAmount, invoiceStatus: recomputed?.status, balanceDue: recomputed?.balanceDue }, { status: 201 });
  } catch (error) {
    if (error.message === "UNAUTHORIZED") return Response.json({ error: "Unauthorized" }, { status: 401 });
    console.error("Create credit note error:", error);
    return Response.json({ error: "Failed to create credit note" }, { status: 500 });
  }
}
