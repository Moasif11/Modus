import sql from "@/app/api/utils/sql";
import { requireAuth, logAudit } from "@/app/api/utils/auth";
import {
  generateInvoiceNumber,
  ensureInvoiceNumberUnique,
  isDuplicateInvoiceNumberError,
} from "@/app/api/utils/invoiceNumber";

export async function POST(request, { params }) {
  try {
    const user = await requireAuth(request);
    const { id } = params;

    const quotes = await sql`
      SELECT * FROM quotes WHERE id = ${id} AND is_archived = false LIMIT 1
    `;

    if (quotes.length === 0) {
      return Response.json({ error: "Quote not found" }, { status: 404 });
    }

    const quote = quotes[0];

    const items = await sql`
      SELECT * FROM quote_items WHERE quote_id = ${id} ORDER BY position ASC
    `;

    // Same self-healing generator the invoice module uses, so converted invoices
    // land in the configured series (fy / calendar / ym / plain) instead of the
    // legacy next_invoice_number counter, which this route never incremented —
    // it handed out the same number on every convert and hit the unique index.
    await ensureInvoiceNumberUnique();

    let invoice;
    let numberToUse = (await generateInvoiceNumber()).invoiceNumber;
    for (let attempt = 0; ; attempt++) {
      try {
        invoice = await insertInvoice(numberToUse);
        break;
      } catch (e) {
        if (!isDuplicateInvoiceNumberError(e)) throw e;
        if (attempt >= 3) {
          return Response.json(
            { error: `Invoice number ${numberToUse} already exists. Please refresh and try again.` },
            { status: 409 },
          );
        }
        numberToUse = (await generateInvoiceNumber()).invoiceNumber;
      }
    }

    async function insertInvoice(newInvoiceNumber) {
      const invoiceResult = await sql`
      INSERT INTO invoices (
        invoice_number, customer_id, invoice_date, due_date, po_number, reverse_charge,
        payment_terms, place_of_supply, place_of_supply_code, currency, exchange_rate, subtotal,
        total_discount, taxable_amount, cgst_amount, sgst_amount, igst_amount,
        total_tax, round_off, grand_total, amount_in_words, tax_inclusive, is_interstate,
        notes, terms, payment_instructions, declaration, template_id, status, created_by,
        snapshot_seller_json, snapshot_buyer_json,
        payment_method, service_period_from, service_period_to, gst_category, project_id
      )
      VALUES (
        ${newInvoiceNumber}, ${quote.customer_id}, CURRENT_DATE, NULL,
        NULL, ${quote.reverse_charge}, NULL,
        ${quote.place_of_supply}, ${quote.place_of_supply_code}, ${quote.currency}, ${quote.exchange_rate},
        ${quote.subtotal}, ${quote.total_discount}, ${quote.taxable_amount},
        ${quote.cgst_amount}, ${quote.sgst_amount}, ${quote.igst_amount},
        ${quote.total_tax}, ${quote.round_off}, ${quote.grand_total},
        ${quote.amount_in_words}, ${quote.tax_inclusive}, ${quote.is_interstate},
        ${quote.notes}, ${quote.terms}, NULL,
        ${quote.declaration}, ${quote.template_id}, 'draft', ${user.id},
        ${quote.snapshot_seller_json}, ${quote.snapshot_buyer_json},
        ${quote.payment_method}, ${quote.service_period_from}, ${quote.service_period_to},
        ${quote.gst_category}, ${quote.project_id}
      )
      RETURNING *
    `;
      return invoiceResult[0];
    }

    for (const item of items) {
      await sql`
        INSERT INTO invoice_items (
          invoice_id, position, item_name, description, hsn_sac_code, quantity,
          unit, unit_price, discount_percent, discount_amount, taxable_value,
          gst_rate, cgst_rate, sgst_rate, igst_rate, cgst_amount, sgst_amount,
          igst_amount, total_tax, line_total
        )
        VALUES (
          ${invoice.id}, ${item.position}, ${item.item_name}, ${item.description},
          ${item.hsn_sac_code}, ${item.quantity}, ${item.unit}, ${item.unit_price},
          ${item.discount_percent}, ${item.discount_amount}, ${item.taxable_value},
          ${item.gst_rate}, ${item.cgst_rate}, ${item.sgst_rate}, ${item.igst_rate},
          ${item.cgst_amount}, ${item.sgst_amount}, ${item.igst_amount},
          ${item.total_tax}, ${item.line_total}
        )
      `;
    }

    await sql`
      INSERT INTO invoice_versions (invoice_id, version_number, snapshot_json, changed_by, change_summary)
      VALUES (
        ${invoice.id}, 1, ${JSON.stringify({ invoice, items })},
        ${user.id}, 'Converted from quote ' || ${quote.quote_number}
      )
    `;

    await logAudit({
      userId: user.id,
      action: "create",
      entityType: "invoice",
      entityId: invoice.id,
      metadata: {
        convertedFromQuoteId: quote.id,
        convertedFromQuoteNumber: quote.quote_number,
      },
      request,
    });

    if (quote.status !== "accepted") {
      await sql`UPDATE quotes SET status = 'accepted', updated_at = NOW() WHERE id = ${id}`;
    }

    await logAudit({
      userId: user.id,
      action: "convert",
      entityType: "quote",
      entityId: quote.id,
      metadata: {
        convertedToInvoiceId: invoice.id,
        convertedToInvoiceNumber: invoice.invoice_number,
      },
      request,
    });

    return Response.json({
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoice_number,
      message: "Quote converted to invoice successfully",
    });
  } catch (error) {
    if (error.message === "UNAUTHORIZED") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Convert quote error:", error);
    return Response.json(
      { error: "Failed to convert quote" },
      { status: 500 },
    );
  }
}
