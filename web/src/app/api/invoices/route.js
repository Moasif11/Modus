import sql from "@/app/api/utils/sql";
import { requireAuth, logAudit } from "@/app/api/utils/auth";
import { ensureGstTreatmentColumns } from "@/app/api/utils/gstSchema";
import { deriveTaxContext, GST_TREATMENTS, B2B_TREATMENTS } from "@/app/api/utils/gstTreatment";
import { validateHsnSac } from "@/app/api/utils/gstValidation";
import { generateInvoiceNumber, ensureInvoiceNumberUnique, isDuplicateInvoiceNumberError } from "@/app/api/utils/invoiceNumber";
import { getNotificationPrefs, notifySuperAdmins } from "@/app/api/utils/notify";

async function ensureInvoicesColumns() {
  try {
    await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'INR'`;
    await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(12,6) DEFAULT 1.0`;
    await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS overdue_notified_at TIMESTAMPTZ`;
  } catch (error) {
    console.error("Error ensuring invoices columns exist:", error);
  }
}

// Lazy overdue alerts (no cron): whenever the list loads, notify superadmins once
// per invoice that has crossed its due date. Gated by Settings → Notifications.
async function notifyNewlyOverdue() {
  const prefs = await getNotificationPrefs();
  if (!prefs.invoiceOverdue) return;
  const newly = await sql`
    SELECT id, invoice_number, due_date, grand_total FROM invoices
    WHERE is_archived = false
      AND status IN ('sent', 'partially_paid', 'overdue')
      AND due_date < CURRENT_DATE
      AND overdue_notified_at IS NULL
    LIMIT 20
  `;
  for (const inv of newly) {
    await notifySuperAdmins({
      type: "invoice_overdue",
      title: `Invoice overdue — ${inv.invoice_number}`,
      body: `₹${Number(inv.grand_total || 0).toLocaleString("en-IN")} was due ${new Date(inv.due_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`,
      link: `/invoices/${inv.id}`,
      relatedId: inv.id,
    });
    await sql`UPDATE invoices SET overdue_notified_at = NOW() WHERE id = ${inv.id}`;
  }
}

export async function GET(request) {
  try {
    await requireAuth(request);
    await ensureInvoicesColumns();

    // Fire-and-forget so list latency is unaffected
    notifyNewlyOverdue().catch((e) => console.error("Overdue notify failed:", e.message));

    const url = new URL(request.url);
    const search = url.searchParams.get("search") || "";
    const status = url.searchParams.get("status") || "";
    const fromDate = url.searchParams.get("from") || "";
    const toDate = url.searchParams.get("to") || "";
    const limit = parseInt(url.searchParams.get("limit") || "50");
    const offset = parseInt(url.searchParams.get("offset") || "0");

    let whereConditions = ["i.is_archived = false"];
    const params = [];
    let paramIndex = 1;

    if (search) {
      whereConditions.push(`(
        LOWER(i.invoice_number) LIKE LOWER($${paramIndex})
        OR LOWER(c.name) LIKE LOWER($${paramIndex})
        OR LOWER(c.company_name) LIKE LOWER($${paramIndex})
        OR LOWER(c.gstin) LIKE LOWER($${paramIndex})
      )`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (status) {
      if (status === "overdue") {
        whereConditions.push(`(i.status = 'overdue' OR (i.status IN ('sent', 'partially_paid') AND i.due_date < CURRENT_DATE))`);
      } else {
        whereConditions.push(`i.status = $${paramIndex}`);
        params.push(status);
        paramIndex++;
      }
    }

    if (fromDate) {
      whereConditions.push(`i.invoice_date >= $${paramIndex}`);
      params.push(fromDate);
      paramIndex++;
    }

    if (toDate) {
      whereConditions.push(`i.invoice_date <= $${paramIndex}`);
      params.push(toDate);
      paramIndex++;
    }

    const whereClause = whereConditions.join(" AND ");

    params.push(limit);
    params.push(offset);

    const invoicesQuery = `
      SELECT 
        i.*,
        c.name as customer_name,
        c.company_name as customer_company,
        c.gstin as customer_gstin,
        COALESCE((SELECT SUM(amount) FROM payments WHERE invoice_id = i.id), 0) as total_paid
      FROM invoices i
      LEFT JOIN customers c ON i.customer_id = c.id
      WHERE ${whereClause}
      ORDER BY i.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const invoices = await sql(invoicesQuery, params);

    const countQuery = `
      SELECT COUNT(*) as count
      FROM invoices i
      LEFT JOIN customers c ON i.customer_id = c.id
      WHERE ${whereClause}
    `;

    const countResult = await sql(countQuery, params.slice(0, -2));
    const totalCount = parseInt(countResult[0].count);

    // Calculate total AR outstanding in INR
    const outstandingRes = await sql`
      SELECT COALESCE(SUM((grand_total - COALESCE((SELECT SUM(amount) FROM payments WHERE invoice_id = invoices.id), 0)) * COALESCE(exchange_rate, 1.0)), 0) as total
      FROM invoices
      WHERE is_archived = false
      AND status IN ('sent', 'partially_paid', 'overdue', 'saved')
    `;
    const outstanding = parseFloat(outstandingRes[0].total);

    // Calculate total AR overdue count
    const overdueCountRes = await sql`
      SELECT COUNT(*) as count
      FROM invoices
      WHERE is_archived = false
      AND status NOT IN ('draft', 'saved', 'paid', 'cancelled')
      AND due_date < CURRENT_DATE
      AND grand_total > COALESCE((SELECT SUM(amount) FROM payments WHERE invoice_id = invoices.id), 0)
    `;
    const overdueCount = parseInt(overdueCountRes[0].count);

    return Response.json({
      invoices: invoices.map((inv) => {
        const totalPaid = parseFloat(inv.total_paid || 0);
        const grandTotal = parseFloat(inv.grand_total || 0);
        const balanceDue = grandTotal - totalPaid;
        
        // Dynamically compute overdue status
        let computedStatus = inv.status;
        if (inv.status !== "draft" && inv.status !== "saved" && inv.status !== "paid" && inv.status !== "cancelled" && inv.due_date) {
          const dueDateObj = new Date(inv.due_date);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          if (dueDateObj < today && balanceDue > 0) {
            computedStatus = "overdue";
          }
        }

        return {
          id: inv.id,
          invoiceNumber: inv.invoice_number,
          customerId: inv.customer_id,
          customerName: inv.customer_company || inv.customer_name,
          customerGstin: inv.customer_gstin,
          invoiceDate: inv.invoice_date,
          dueDate: inv.due_date,
          grandTotal,
          taxableAmount: parseFloat(inv.taxable_amount),
          cgstAmount: parseFloat(inv.cgst_amount),
          sgstAmount: parseFloat(inv.sgst_amount),
          igstAmount: parseFloat(inv.igst_amount),
          totalTax: parseFloat(inv.total_tax),
          isInterstate: inv.is_interstate,
          gstCategory: inv.gst_category,
          status: computedStatus,
          totalPaid,
          balanceDue,
          createdAt: inv.created_at,
          currency: inv.currency || "INR",
          exchangeRate: parseFloat(inv.exchange_rate || 1.0),
        };
      }),
      total: totalCount,
      outstanding,
      overdueCount,
      limit,
      offset,
    });
  } catch (error) {
    if (error.message === "UNAUTHORIZED") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Get invoices error:", error);
    return Response.json(
      { error: "Failed to get invoices" },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  try {
    const user = await requireAuth(request);
    await ensureInvoicesColumns();
    await ensureGstTreatmentColumns();
    const body = await request.json();

    const {
      invoiceNumber,
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

    if (!invoiceNumber || !invoiceDate) {
      return Response.json(
        { error: "Invoice number and date are required" },
        { status: 400 },
      );
    }

    if (!items || items.length === 0) {
      return Response.json(
        { error: "At least one line item is required" },
        { status: 400 },
      );
    }

    // Server-side GST derivation + validation (never trust the client for tax classification).
    const settings = (await sql`SELECT state_code, turnover_above_5cr FROM company_settings ORDER BY id ASC LIMIT 1`)[0] || {};
    const sellerStateCode = settings.state_code || null;
    const cust = customerId ? (await sql`SELECT gst_treatment, state_code, gstin FROM customers WHERE id = ${customerId}`)[0] : null;

    const treatment = (gstCategory && GST_TREATMENTS.includes(gstCategory))
      ? gstCategory
      : (cust?.gst_treatment || (cust?.gstin ? "registered_regular" : "unregistered"));

    const ctx = deriveTaxContext({
      gstTreatment: treatment,
      sellerStateCode,
      partyStateCode: cust?.state_code || null,
      placeOfSupplyCode: placeOfSupplyCode || null,
    });

    // GUARD: zero-rated supplies must carry no tax.
    if (ctx.zeroRated && (parseFloat(totalTax) || 0) > 0.01) {
      return Response.json({ error: "Export/SEZ-without-payment supplies are zero-rated — tax must be 0. Set treatment correctly or use SEZ with payment." }, { status: 400 });
    }
    // GUARD: client tax split must match server-derived interstate flag (taxable supplies only).
    if (!ctx.zeroRated) {
      const clientUsedIgst = (parseFloat(igstAmount) || 0) > 0.01;
      const clientUsedCgstSgst = (parseFloat(cgstAmount) || 0) > 0.01 || (parseFloat(sgstAmount) || 0) > 0.01;
      if (ctx.isInterstate && clientUsedCgstSgst) return Response.json({ error: "Inter-state supply must use IGST, not CGST/SGST. Recheck place of supply." }, { status: 400 });
      if (!ctx.isInterstate && clientUsedIgst) return Response.json({ error: "Intra-state supply must use CGST/SGST, not IGST. Recheck place of supply." }, { status: 400 });
    }
    // GUARD: HSN/SAC mandatory on B2B lines.
    const isB2b = B2B_TREATMENTS.includes(treatment);
    for (const it of items) {
      const v = validateHsnSac(it.hsnSacCode, { b2b: isB2b, turnoverAbove5cr: !!settings.turnover_above_5cr });
      if (!v.ok) return Response.json({ error: `${v.reason} (item: ${it.itemName || "—"})` }, { status: 400 });
    }

    // Unique serial enforced at the DB; on concurrent collision regenerate and retry.
    await ensureInvoiceNumberUnique();

    let invoice;
    let numberToUse = invoiceNumber;
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

    async function insertInvoice(invNumber) {
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
        ${invNumber}, ${customerId || null}, ${invoiceDate}, ${dueDate || null},
        ${poNumber || null}, ${reverseCharge || false}, ${paymentTerms || null},
        ${placeOfSupply || null}, ${ctx.placeOfSupplyCode}, ${currency || "INR"},
        ${exchangeRate || 1.0},
        ${subtotal || 0}, ${totalDiscount || 0}, ${taxableAmount || 0},
        ${cgstAmount || 0}, ${sgstAmount || 0}, ${igstAmount || 0}, ${totalTax || 0},
        ${roundOff || 0}, ${grandTotal || 0}, ${amountInWords || null},
        ${taxInclusive || false}, ${ctx.isInterstate}, ${notes || null},
        ${terms || null}, ${paymentInstructions || null}, ${declaration || null},
        ${templateId || null}, ${status || "draft"}, ${user.id},
        ${JSON.stringify(snapshotSeller || {})}, ${JSON.stringify(snapshotBuyer || {})},
        ${paymentMethod || null}, ${servicePeriodFrom || null}, ${servicePeriodTo || null},
        ${treatment}, ${projectId || null}
      )
      RETURNING *
    `;
      return invoiceResult[0];
    }

    // Insert line items
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
          ${invoice.id}, ${i}, ${item.itemName}, ${item.description || null},
          ${item.hsnSacCode || null}, ${item.quantity}, ${item.unit || "Nos"},
          ${item.unitPrice}, ${item.discountPercent || 0}, ${item.discountAmount || 0},
          ${item.taxableValue}, ${item.gstRate}, ${item.cgstRate || 0},
          ${item.sgstRate || 0}, ${item.igstRate || 0}, ${item.cgstAmount || 0},
          ${item.sgstAmount || 0}, ${item.igstAmount || 0}, ${item.totalTax || 0},
          ${item.lineTotal}
        )
      `;
    }

    // Increment invoice number if this is not a draft
    if (status !== "draft") {
      await sql`
        UPDATE company_settings
        SET next_invoice_number = next_invoice_number + 1
        WHERE id = 1
      `;
    }

    // Create initial version snapshot
    await sql`
      INSERT INTO invoice_versions (invoice_id, version_number, snapshot_json, changed_by, change_summary)
      VALUES (
        ${invoice.id}, 1, ${JSON.stringify({ invoice, items })}, ${user.id}, 'Initial creation'
      )
    `;

    // Log audit
    await logAudit({
      userId: user.id,
      action: "create",
      entityType: "invoice",
      entityId: invoice.id,
      metadata: {
        invoiceNumber: invoice.invoice_number,
        status: invoice.status,
      },
      request,
    });

    return Response.json({
      id: invoice.id,
      invoiceNumber: invoice.invoice_number,
      message: "Invoice created successfully",
    });
  } catch (error) {
    if (error.message === "UNAUTHORIZED") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Create invoice error:", error);
    return Response.json(
      { error: "Failed to create invoice" },
      { status: 500 },
    );
  }
}
