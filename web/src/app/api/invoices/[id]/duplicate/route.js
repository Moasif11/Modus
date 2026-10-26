import sql from "@/app/api/utils/sql";
import { requireAuth, logAudit } from "@/app/api/utils/auth";
import { generateInvoiceNumber } from "@/app/api/utils/invoiceNumber";

export async function POST(request, { params }) {
  try {
    const user = await requireAuth(request);
    const { id } = params;

    // Get original invoice
    const invoices = await sql`
      SELECT * FROM invoices WHERE id = ${id} LIMIT 1
    `;

    if (invoices.length === 0) {
      return Response.json({ error: "Invoice not found" }, { status: 404 });
    }

    const original = invoices[0];

    // Get items
    const items = await sql`
      SELECT * FROM invoice_items WHERE invoice_id = ${id} ORDER BY position ASC
    `;

    // Get next invoice number (shared generator — same format as invoice creation)
    const { invoiceNumber: newInvoiceNumber } = await generateInvoiceNumber();

    // Create duplicate invoice
    const duplicateResult = await sql`
      INSERT INTO invoices (
        invoice_number, customer_id, invoice_date, due_date, po_number, reverse_charge,
        payment_terms, place_of_supply, place_of_supply_code, currency, subtotal,
        total_discount, taxable_amount, cgst_amount, sgst_amount, igst_amount,
        total_tax, round_off, grand_total, amount_in_words, tax_inclusive, is_interstate,
        notes, terms, payment_instructions, declaration, template_id, status, created_by,
        snapshot_seller_json, snapshot_buyer_json
      )
      VALUES (
        ${newInvoiceNumber}, ${original.customer_id}, CURRENT_DATE, ${original.due_date},
        ${original.po_number}, ${original.reverse_charge}, ${original.payment_terms},
        ${original.place_of_supply}, ${original.place_of_supply_code}, ${original.currency},
        ${original.subtotal}, ${original.total_discount}, ${original.taxable_amount},
        ${original.cgst_amount}, ${original.sgst_amount}, ${original.igst_amount},
        ${original.total_tax}, ${original.round_off}, ${original.grand_total},
        ${original.amount_in_words}, ${original.tax_inclusive}, ${original.is_interstate},
        ${original.notes}, ${original.terms}, ${original.payment_instructions},
        ${original.declaration}, ${original.template_id}, 'draft', ${user.id},
        ${original.snapshot_seller_json}, ${original.snapshot_buyer_json}
      )
      RETURNING *
    `;

    const duplicate = duplicateResult[0];

    // Duplicate items
    for (const item of items) {
      await sql`
        INSERT INTO invoice_items (
          invoice_id, position, item_name, description, hsn_sac_code, quantity,
          unit, unit_price, discount_percent, discount_amount, taxable_value,
          gst_rate, cgst_rate, sgst_rate, igst_rate, cgst_amount, sgst_amount,
          igst_amount, total_tax, line_total
        )
        VALUES (
          ${duplicate.id}, ${item.position}, ${item.item_name}, ${item.description},
          ${item.hsn_sac_code}, ${item.quantity}, ${item.unit}, ${item.unit_price},
          ${item.discount_percent}, ${item.discount_amount}, ${item.taxable_value},
          ${item.gst_rate}, ${item.cgst_rate}, ${item.sgst_rate}, ${item.igst_rate},
          ${item.cgst_amount}, ${item.sgst_amount}, ${item.igst_amount},
          ${item.total_tax}, ${item.line_total}
        )
      `;
    }

    // Create initial version
    await sql`
      INSERT INTO invoice_versions (invoice_id, version_number, snapshot_json, changed_by, change_summary)
      VALUES (
        ${duplicate.id}, 1, ${JSON.stringify({ invoice: duplicate, items })},
        ${user.id}, 'Duplicated from invoice ' || ${original.invoice_number}
      )
    `;

    // Log audit
    await logAudit({
      userId: user.id,
      action: "duplicate",
      entityType: "invoice",
      entityId: duplicate.id,
      metadata: {
        originalId: parseInt(id),
        originalNumber: original.invoice_number,
      },
      request,
    });

    return Response.json({
      id: duplicate.id,
      invoiceNumber: duplicate.invoice_number,
      message: "Invoice duplicated successfully",
    });
  } catch (error) {
    if (error.message === "UNAUTHORIZED") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Duplicate invoice error:", error);
    return Response.json(
      { error: "Failed to duplicate invoice" },
      { status: 500 },
    );
  }
}
