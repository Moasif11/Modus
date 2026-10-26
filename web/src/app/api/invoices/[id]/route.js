import sql from "@/app/api/utils/sql";
import { requireAuth, logAudit } from "@/app/api/utils/auth";
import { ensureGstTreatmentColumns } from "@/app/api/utils/gstSchema";
import { deriveTaxContext, GST_TREATMENTS, B2B_TREATMENTS } from "@/app/api/utils/gstTreatment";
import { validateHsnSac } from "@/app/api/utils/gstValidation";
import { ensureCreditNoteTables } from "@/app/api/utils/refundSchema";
import { ensureTdsColumns } from "@/app/api/utils/tdsSchema";
import { isPeriodLocked } from "@/app/api/utils/periodLock";
import { logChange, getBooksLockDate } from "@/app/api/utils/auditLog";

async function ensureInvoicesColumns() {
  try {
    await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'INR'`;
    await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(12,6) DEFAULT 1.0`;
  } catch (error) {
    console.error("Error ensuring invoices columns exist:", error);
  }
}

export async function GET(request, { params }) {
  try {
    await requireAuth(request);
    await ensureInvoicesColumns();
    const { id } = params;

    const invoices = await sql`
      SELECT i.*, c.*,
        i.id as invoice_id,
        c.id as customer_id
      FROM invoices i
      LEFT JOIN customers c ON i.customer_id = c.id
      WHERE i.id = ${id} AND i.is_archived = false
      LIMIT 1
    `;

    if (invoices.length === 0) {
      return Response.json({ error: "Invoice not found" }, { status: 404 });
    }

    const inv = invoices[0];

    // Get line items
    const items = await sql`
      SELECT * FROM invoice_items
      WHERE invoice_id = ${id}
      ORDER BY position ASC
    `;

    // Get payments
    const paymentsResult = await sql`
      SELECT * FROM payments
      WHERE invoice_id = ${id}
      ORDER BY payment_date DESC, created_at DESC
    `;

    await ensureCreditNoteTables();
    const creditNotes = await sql`
      SELECT id, credit_note_number, credit_note_date, reason_code, total_amount, status
      FROM credit_notes WHERE invoice_id = ${id} AND status = 'issued' ORDER BY credit_note_date DESC
    `;
    const refundRows = await sql`SELECT COALESCE(SUM(amount),0) AS total FROM refund_disbursements WHERE invoice_id = ${id}`;
    const creditedTotal = creditNotes.reduce((s, c) => s + parseFloat(c.total_amount || 0), 0);
    const refundsTotal = parseFloat(refundRows[0].total) || 0;

    await ensureTdsColumns();
    const tdsReceivable = parseFloat(inv.tds_amount || 0);

    const totalPaid = paymentsResult.reduce((sum, p) => sum + parseFloat(p.amount), 0);
    const grandTotal = parseFloat(inv.grand_total || 0);
    // Balance = (grand total − issued credit notes) − (payments − refunds + client-deducted TDS).
    const balanceDue = Math.round((grandTotal - creditedTotal - (totalPaid - refundsTotal) - tdsReceivable) * 100) / 100;

    let computedStatus = inv.status;
    if (inv.status !== "draft" && inv.status !== "saved" && inv.status !== "paid" && inv.status !== "cancelled" && inv.due_date) {
      const dueDateObj = new Date(inv.due_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (dueDateObj < today && balanceDue > 0) {
        computedStatus = "overdue";
      }
    }

    return Response.json({
      invoice: {
        id: inv.invoice_id,
        invoiceNumber: inv.invoice_number,
        customerId: inv.customer_id,
        invoiceDate: inv.invoice_date,
        dueDate: inv.due_date,
        poNumber: inv.po_number,
        reverseCharge: inv.reverse_charge,
        paymentTerms: inv.payment_terms,
        placeOfSupply: inv.place_of_supply,
        placeOfSupplyCode: inv.place_of_supply_code,
        currency: inv.currency || "INR",
        exchangeRate: parseFloat(inv.exchange_rate || 1.0),
        subtotal: parseFloat(inv.subtotal),
        totalDiscount: parseFloat(inv.total_discount),
        taxableAmount: parseFloat(inv.taxable_amount),
        cgstAmount: parseFloat(inv.cgst_amount),
        sgstAmount: parseFloat(inv.sgst_amount),
        igstAmount: parseFloat(inv.igst_amount),
        totalTax: parseFloat(inv.total_tax),
        roundOff: parseFloat(inv.round_off),
        grandTotal,
        amountInWords: inv.amount_in_words,
        taxInclusive: inv.tax_inclusive,
        isInterstate: inv.is_interstate,
        notes: inv.notes,
        terms: inv.terms,
        paymentInstructions: inv.payment_instructions,
        declaration: inv.declaration,
        templateId: inv.template_id,
        status: computedStatus,
        snapshotSeller: inv.snapshot_seller_json,
        snapshotBuyer: inv.snapshot_buyer_json,
        paymentMethod: inv.payment_method,
        servicePeriodFrom: inv.service_period_from,
        servicePeriodTo: inv.service_period_to,
        gstCategory: inv.gst_category || "B2B",
        projectId: inv.project_id || null,
        createdAt: inv.created_at,
        updatedAt: inv.updated_at,
        totalPaid,
        balanceDue,
        creditedTotal,
        refundsTotal,
        tdsReceivable,
        tdsSection: inv.tds_section || null,
        tdsRate: parseFloat(inv.tds_rate || 0),
        tdsAmount: tdsReceivable,
        creditNotes: creditNotes.map((c) => ({
          id: c.id, creditNoteNumber: c.credit_note_number, creditNoteDate: c.credit_note_date,
          reasonCode: c.reason_code, totalAmount: parseFloat(c.total_amount), status: c.status,
        })),
      },
      customer: inv.customer_id
        ? {
            id: inv.customer_id,
            name: inv.name,
            companyName: inv.company_name,
            gstin: inv.gstin,
            email: inv.email,
            phone: inv.phone,
            billingAddress: inv.billing_address,
            shippingAddress: inv.shipping_address,
            city: inv.city,
            state: inv.state,
            stateCode: inv.state_code,
            pincode: inv.pincode,
            country: inv.country,
          }
        : null,
      items: items.map((item) => ({
        id: item.id,
        position: item.position,
        itemName: item.item_name,
        description: item.description,
        hsnSacCode: item.hsn_sac_code,
        quantity: parseFloat(item.quantity),
        unit: item.unit,
        unitPrice: parseFloat(item.unit_price),
        discountPercent: parseFloat(item.discount_percent),
        discountAmount: parseFloat(item.discount_amount),
        taxableValue: parseFloat(item.taxable_value),
        gstRate: parseFloat(item.gst_rate),
        cgstRate: parseFloat(item.cgst_rate),
        sgstRate: parseFloat(item.sgst_rate),
        igstRate: parseFloat(item.igst_rate),
        cgstAmount: parseFloat(item.cgst_amount),
        sgstAmount: parseFloat(item.sgst_amount),
        igstAmount: parseFloat(item.igst_amount),
        totalTax: parseFloat(item.total_tax),
        lineTotal: parseFloat(item.line_total),
      })),
      payments: paymentsResult.map((p) => ({
        id: p.id,
        invoiceId: p.invoice_id,
        amount: parseFloat(p.amount),
        paymentDate: p.payment_date,
        paymentMethod: p.payment_method,
        referenceNumber: p.reference_number,
        notes: p.notes,
        receiptUrl: p.receipt_url,
        createdAt: p.created_at,
      })),
    });
  } catch (error) {
    if (error.message === "UNAUTHORIZED") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Get invoice error:", error);
    return Response.json(
      { error: "Failed to get invoice" },
      { status: 500 },
    );
  }
}

export async function PUT(request, { params }) {
  try {
    const user = await requireAuth(request);
    await ensureInvoicesColumns();
    await ensureGstTreatmentColumns();
    const { id } = params;
    const body = await request.json();

    const {
      customerId,
      invoiceDate,
      dueDate,
      poNumber,
      reverseCharge,
      paymentTerms,
      placeOfSupply,
      placeOfSupplyCode,
      currency,
      exchangeRate,
      subtotal,
      totalDiscount,
      taxableAmount,
      cgstAmount,
      sgstAmount,
      igstAmount,
      totalTax,
      roundOff,
      grandTotal,
      amountInWords,
      taxInclusive,
      isInterstate,
      notes,
      terms,
      paymentInstructions,
      declaration,
      templateId,
      status,
      items,
      snapshotSeller,
      snapshotBuyer,
      paymentMethod,
      servicePeriodFrom,
      servicePeriodTo,
      gstCategory,
      projectId,
    } = body;

    // --- Server-side GST derivation + validation ---
    // Load existing invoice row to fill any fields omitted from this partial update.
    const existing = (await sql`SELECT * FROM invoices WHERE id = ${id} AND is_archived = false LIMIT 1`)[0];
    if (!existing) {
      return Response.json({ error: "Invoice not found" }, { status: 404 });
    }

    // Period lock (Rule 11(g) / books integrity): block edits to filed-period invoices.
    const lockDate = await getBooksLockDate();
    if (isPeriodLocked(existing.invoice_date, lockDate)) {
      return Response.json({ error: `This invoice is in a locked period (filed up to ${lockDate}). Issue a credit note or move the books-lock date in Settings.` }, { status: 403 });
    }

    // Issued invoices are statutory documents — financial fields freeze once sent.
    // Status, template, notes and project linkage stay editable; superadmin can override (audited).
    const ISSUED_STATUSES = ["sent", "partially_paid", "paid", "overdue"];
    if (ISSUED_STATUSES.includes(existing.status) && user.role !== "superadmin") {
      const FROZEN_KEYS = [
        "customerId", "invoiceDate", "dueDate", "poNumber", "reverseCharge", "paymentTerms",
        "placeOfSupply", "placeOfSupplyCode", "currency", "exchangeRate", "subtotal",
        "totalDiscount", "taxableAmount", "cgstAmount", "sgstAmount", "igstAmount",
        "totalTax", "roundOff", "grandTotal", "amountInWords", "taxInclusive", "isInterstate",
        "items", "snapshotSeller", "snapshotBuyer", "gstCategory", "servicePeriodFrom", "servicePeriodTo",
      ];
      const attempted = FROZEN_KEYS.filter((k) => body[k] !== undefined);
      if (attempted.length > 0) {
        return Response.json(
          { error: `This invoice was already issued (${existing.status}) — its financial details are locked. Issue a credit note to adjust it, or ask a superadmin.` },
          { status: 403 },
        );
      }
    }

    const effectiveCustomerId = customerId !== undefined ? customerId : existing.customer_id;
    const effectivePlaceOfSupplyCode = placeOfSupplyCode !== undefined ? placeOfSupplyCode : existing.place_of_supply_code;
    const effectiveGstCategory = gstCategory !== undefined ? gstCategory : existing.gst_category;
    const effectiveCgst = parseFloat(cgstAmount !== undefined ? cgstAmount : existing.cgst_amount) || 0;
    const effectiveSgst = parseFloat(sgstAmount !== undefined ? sgstAmount : existing.sgst_amount) || 0;
    const effectiveIgst = parseFloat(igstAmount !== undefined ? igstAmount : existing.igst_amount) || 0;
    const effectiveTotalTax = parseFloat(totalTax !== undefined ? totalTax : existing.total_tax) || 0;

    // Effective items: use body items if provided, else load from DB.
    let effectiveItems = items;
    if (!effectiveItems) {
      const dbItems = await sql`SELECT * FROM invoice_items WHERE invoice_id = ${id} ORDER BY position ASC`;
      effectiveItems = dbItems.map((it) => ({
        itemName: it.item_name,
        hsnSacCode: it.hsn_sac_code,
      }));
    }

    const settings = (await sql`SELECT state_code, turnover_above_5cr FROM company_settings ORDER BY id ASC LIMIT 1`)[0] || {};
    const cust = effectiveCustomerId
      ? (await sql`SELECT gst_treatment, state_code, gstin FROM customers WHERE id = ${effectiveCustomerId}`)[0]
      : null;

    const treatment = (effectiveGstCategory && GST_TREATMENTS.includes(effectiveGstCategory))
      ? effectiveGstCategory
      : (cust?.gst_treatment || (cust?.gstin ? "registered_regular" : "unregistered"));

    const ctx = deriveTaxContext({
      gstTreatment: treatment,
      sellerStateCode: settings.state_code || null,
      partyStateCode: cust?.state_code || null,
      placeOfSupplyCode: effectivePlaceOfSupplyCode || null,
    });

    // GUARD: zero-rated supplies must carry no tax.
    if (ctx.zeroRated && effectiveTotalTax > 0.01) {
      return Response.json({ error: "Export/SEZ-without-payment supplies are zero-rated — tax must be 0. Set treatment correctly or use SEZ with payment." }, { status: 400 });
    }
    // GUARD: tax split must match server-derived interstate flag.
    if (!ctx.zeroRated) {
      if (ctx.isInterstate && (effectiveCgst > 0.01 || effectiveSgst > 0.01)) {
        return Response.json({ error: "Inter-state supply must use IGST, not CGST/SGST. Recheck place of supply." }, { status: 400 });
      }
      if (!ctx.isInterstate && effectiveIgst > 0.01) {
        return Response.json({ error: "Intra-state supply must use CGST/SGST, not IGST. Recheck place of supply." }, { status: 400 });
      }
    }
    // GUARD: HSN/SAC mandatory on B2B lines.
    const isB2b = B2B_TREATMENTS.includes(treatment);
    for (const it of effectiveItems) {
      const v = validateHsnSac(it.hsnSacCode, { b2b: isB2b, turnoverAbove5cr: !!settings.turnover_above_5cr });
      if (!v.ok) return Response.json({ error: `${v.reason} (item: ${it.itemName || "—"})` }, { status: 400 });
    }
    // --- End GST derivation + validation ---

    // Get current version number
    const versions = await sql`
      SELECT MAX(version_number) as max_version
      FROM invoice_versions
      WHERE invoice_id = ${id}
    `;
    const nextVersion = (versions[0].max_version || 0) + 1;

    // Update invoice
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (customerId !== undefined) {
      updates.push(`customer_id = $${paramIndex++}`);
      values.push(customerId);
    }
    if (invoiceDate !== undefined) {
      updates.push(`invoice_date = $${paramIndex++}`);
      values.push(invoiceDate);
    }
    if (dueDate !== undefined) {
      updates.push(`due_date = $${paramIndex++}`);
      values.push(dueDate);
    }
    if (poNumber !== undefined) {
      updates.push(`po_number = $${paramIndex++}`);
      values.push(poNumber);
    }
    if (reverseCharge !== undefined) {
      updates.push(`reverse_charge = $${paramIndex++}`);
      values.push(reverseCharge);
    }
    if (paymentTerms !== undefined) {
      updates.push(`payment_terms = $${paramIndex++}`);
      values.push(paymentTerms);
    }
    if (placeOfSupply !== undefined) {
      updates.push(`place_of_supply = $${paramIndex++}`);
      values.push(placeOfSupply);
    }
    // Always persist server-derived place_of_supply_code.
    updates.push(`place_of_supply_code = $${paramIndex++}`);
    values.push(ctx.placeOfSupplyCode);
    if (currency !== undefined) {
      updates.push(`currency = $${paramIndex++}`);
      values.push(currency);
    }
    if (exchangeRate !== undefined) {
      updates.push(`exchange_rate = $${paramIndex++}`);
      values.push(exchangeRate);
    }
    if (subtotal !== undefined) {
      updates.push(`subtotal = $${paramIndex++}`);
      values.push(subtotal);
    }
    if (totalDiscount !== undefined) {
      updates.push(`total_discount = $${paramIndex++}`);
      values.push(totalDiscount);
    }
    if (taxableAmount !== undefined) {
      updates.push(`taxable_amount = $${paramIndex++}`);
      values.push(taxableAmount);
    }
    if (cgstAmount !== undefined) {
      updates.push(`cgst_amount = $${paramIndex++}`);
      values.push(cgstAmount);
    }
    if (sgstAmount !== undefined) {
      updates.push(`sgst_amount = $${paramIndex++}`);
      values.push(sgstAmount);
    }
    if (igstAmount !== undefined) {
      updates.push(`igst_amount = $${paramIndex++}`);
      values.push(igstAmount);
    }
    if (totalTax !== undefined) {
      updates.push(`total_tax = $${paramIndex++}`);
      values.push(totalTax);
    }
    if (roundOff !== undefined) {
      updates.push(`round_off = $${paramIndex++}`);
      values.push(roundOff);
    }
    if (grandTotal !== undefined) {
      updates.push(`grand_total = $${paramIndex++}`);
      values.push(grandTotal);
    }
    if (amountInWords !== undefined) {
      updates.push(`amount_in_words = $${paramIndex++}`);
      values.push(amountInWords);
    }
    if (taxInclusive !== undefined) {
      updates.push(`tax_inclusive = $${paramIndex++}`);
      values.push(taxInclusive);
    }
    // Always persist server-derived values (overrides any client-supplied is_interstate).
    updates.push(`is_interstate = $${paramIndex++}`);
    values.push(ctx.isInterstate);
    if (notes !== undefined) {
      updates.push(`notes = $${paramIndex++}`);
      values.push(notes);
    }
    if (terms !== undefined) {
      updates.push(`terms = $${paramIndex++}`);
      values.push(terms);
    }
    if (paymentInstructions !== undefined) {
      updates.push(`payment_instructions = $${paramIndex++}`);
      values.push(paymentInstructions);
    }
    if (declaration !== undefined) {
      updates.push(`declaration = $${paramIndex++}`);
      values.push(declaration);
    }
    if (templateId !== undefined) {
      updates.push(`template_id = $${paramIndex++}`);
      values.push(templateId);
    }
    if (status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(status);
    }
    if (snapshotSeller !== undefined) {
      updates.push(`snapshot_seller_json = $${paramIndex++}`);
      values.push(JSON.stringify(snapshotSeller));
    }
    if (snapshotBuyer !== undefined) {
      updates.push(`snapshot_buyer_json = $${paramIndex++}`);
      values.push(JSON.stringify(snapshotBuyer));
    }
    if (paymentMethod !== undefined) {
      updates.push(`payment_method = $${paramIndex++}`);
      values.push(paymentMethod);
    }
    if (servicePeriodFrom !== undefined) {
      updates.push(`service_period_from = $${paramIndex++}`);
      values.push(servicePeriodFrom || null);
    }
    if (servicePeriodTo !== undefined) {
      updates.push(`service_period_to = $${paramIndex++}`);
      values.push(servicePeriodTo || null);
    }
    // Always persist server-derived treatment as gst_category.
    updates.push(`gst_category = $${paramIndex++}`);
    values.push(treatment);
    if (projectId !== undefined) {
      updates.push(`project_id = $${paramIndex++}`);
      values.push(projectId || null);
    }

    updates.push(`updated_at = NOW()`);

    if (updates.length > 1) {
      values.push(id);
      const query = `UPDATE invoices SET ${updates.join(", ")} WHERE id = $${paramIndex} RETURNING *`;
      await sql(query, values);
    }

    // Immutable edit log (Rule 11(g)) — record field-level before/after on material fields.
    const updatedRow = (await sql`SELECT * FROM invoices WHERE id = ${id}`)[0];
    await logChange({
      entityType: "invoice", entityId: parseInt(id), action: "update",
      before: existing, after: updatedRow, user, request,
      keys: ["invoice_date", "due_date", "grand_total", "taxable_amount", "total_tax", "cgst_amount", "sgst_amount", "igst_amount", "status", "customer_id", "gst_category", "is_interstate", "place_of_supply_code", "notes", "terms"],
    });

    // Update items if provided
    if (items) {
      // Delete existing items
      await sql`DELETE FROM invoice_items WHERE invoice_id = ${id}`;

      // Insert new items
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        await sql`
          INSERT INTO invoice_items (
            invoice_id, position, item_name, description, hsn_sac_code, quantity,
            unit, unit_price, discount_percent, discount_amount, taxable_value,
            gst_rate, cgst_rate, sgst_rate, igst_rate, cgst_amount, sgst_amount,
            igst_amount, total_tax, line_total
          )
          VALUES (
            ${id}, ${i}, ${item.itemName}, ${item.description || null},
            ${item.hsnSacCode || null}, ${item.quantity}, ${item.unit || "Nos"},
            ${item.unitPrice}, ${item.discountPercent || 0}, ${item.discountAmount || 0},
            ${item.taxableValue}, ${item.gstRate}, ${item.cgstRate || 0},
            ${item.sgstRate || 0}, ${item.igstRate || 0}, ${item.cgstAmount || 0},
            ${item.sgstAmount || 0}, ${item.igstAmount || 0}, ${item.totalTax || 0},
            ${item.lineTotal}
          )
        `;
      }
    }

    // Create version snapshot
    await sql`
      INSERT INTO invoice_versions (invoice_id, version_number, snapshot_json, changed_by, change_summary)
      VALUES (
        ${id}, ${nextVersion}, ${JSON.stringify({ invoice: body, items: items || [] })}, ${user.id}, 'Updated'
      )
    `;

    // Log audit
    await logAudit({
      userId: user.id,
      action: "update",
      entityType: "invoice",
      entityId: parseInt(id),
      metadata: { status: status },
      request,
    });

    return Response.json({ message: "Invoice updated successfully" });
  } catch (error) {
    if (error.message === "UNAUTHORIZED") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Update invoice error:", error);
    return Response.json(
      { error: "Failed to update invoice" },
      { status: 500 },
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    const user = await requireAuth(request);
    const { id } = params;

    // Self-heal: archive columns may not exist on older databases.
    await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false`;
    await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ`;

    const existing = (await sql`SELECT invoice_date, status FROM invoices WHERE id = ${id} AND is_archived = false`)[0];
    if (!existing) return Response.json({ error: "Invoice not found" }, { status: 404 });

    // Period lock: cannot delete a filed-period invoice.
    const lockDate = await getBooksLockDate();
    if (isPeriodLocked(existing.invoice_date, lockDate)) {
      return Response.json({ error: `This invoice is in a locked period (filed up to ${lockDate}). Cancel it with a credit note instead.` }, { status: 403 });
    }
    // No hard-delete of issued documents — only drafts/saved can be removed; issued
    // invoices must be reversed via a credit note (GST series integrity).
    if (!["draft", "saved"].includes(existing.status)) {
      return Response.json({ error: `A ${existing.status} invoice can't be deleted (GST series integrity). Issue a credit note to reverse it.` }, { status: 400 });
    }

    // Soft delete
    await sql`
      UPDATE invoices
      SET is_archived = true, archived_at = NOW(), updated_at = NOW()
      WHERE id = ${id}
    `;

    await logChange({ entityType: "invoice", entityId: parseInt(id), action: "delete", after: { status: existing.status }, user, request });
    // Log audit
    await logAudit({
      userId: user.id,
      action: "delete",
      entityType: "invoice",
      entityId: parseInt(id),
      metadata: {},
      request,
    });

    return Response.json({ message: "Invoice deleted successfully" });
  } catch (error) {
    if (error.message === "UNAUTHORIZED") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Delete invoice error:", error);
    return Response.json(
      { error: "Failed to delete invoice" },
      { status: 500 },
    );
  }
}
