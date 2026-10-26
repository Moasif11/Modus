import sql from "@/app/api/utils/sql";
import { requireAuth, logAudit } from "@/app/api/utils/auth";
import { deleteFromR2 } from "@/app/api/utils/r2";
import { ensureApGstColumns, getNextSelfInvoiceNumber } from "@/app/api/utils/apSchema";
import { ensureTdsColumns } from "@/app/api/utils/tdsSchema";
import { computeTds, tdsBase, isValidTdsSection } from "@/app/api/utils/tdsRules";
import { isPeriodLocked } from "@/app/api/utils/periodLock";
import { logChange, getBooksLockDate } from "@/app/api/utils/auditLog";
import { defaultItcEligibility, isBlockedItc } from "@/app/api/utils/itcRules";
import { computeRcmTax } from "@/app/api/utils/rcmMath";
import { deriveTaxContext } from "@/app/api/utils/gstTreatment";

function mapBill(b) {
  return {
    id: b.id,
    billNumber: b.bill_number,
    title: b.title,
    description: b.description,
    category: b.category,
    vendorId: b.vendor_id,
    vendorName: b.vendor_name || null,
    payee: b.payee || null,
    employeeId: b.employee_id,
    employeeName: b.employee_name || null,
    amount: parseFloat(b.amount),
    tax: parseFloat(b.tax || 0),
    receiptUrl: b.receipt_url || null,
    receiptObjectKey: b.receipt_object_key || null,
    project: b.project || null,
    projectId: b.project_id || null,
    amountPaid: parseFloat(b.amount_paid),
    // Cash still owed the vendor = net (amount − TDS withheld) − already paid.
    amountDue: parseFloat(b.amount) - parseFloat(b.tds_amount || 0) - parseFloat(b.amount_paid),
    billDate: b.bill_date,
    dueDate: b.due_date,
    status: b.status,
    referenceNumber: b.reference_number,
    notes: b.notes,
    createdAt: b.created_at,
    updatedAt: b.updated_at,
    currency: b.currency || "INR",
    exchangeRate: parseFloat(b.exchange_rate || 1.0),
    foreignAmount: b.foreign_amount != null ? parseFloat(b.foreign_amount) : null,
    foreignCurrency: b.foreign_currency || null,
    isRcm: !!b.is_rcm,
    rcmSection: b.rcm_section || null,
    rcmRate: parseFloat(b.rcm_rate || 0),
    rcmTaxAmount: parseFloat(b.rcm_tax_amount || 0),
    itcEligibility: b.itc_eligibility || null,
    selfInvoiceNumber: b.self_invoice_number || null,
    tdsSection: b.tds_section || null,
    tdsRate: parseFloat(b.tds_rate || 0),
    tdsAmount: parseFloat(b.tds_amount || 0),
    tdsDeposited: !!b.tds_deposited,
    netPayable: parseFloat(b.amount || 0) - parseFloat(b.tds_amount || 0),
  };
}

export async function GET(request, { params }) {
  try {
    await requireAuth(request);
    const { id } = params;

    const bills = await sql`
      SELECT b.*,
             v.name AS vendor_name,
             e.name AS employee_name
      FROM bills b
      LEFT JOIN vendors v ON b.vendor_id = v.id
      LEFT JOIN employees e ON b.employee_id = e.id
      WHERE b.id = ${id}
    `;
    if (bills.length === 0)
      return Response.json({ error: "Bill not found" }, { status: 404 });

    const payments = await sql`
      SELECT * FROM bill_payments
      WHERE bill_id = ${id}
      ORDER BY payment_date DESC, created_at DESC
    `;

    const bill = mapBill(bills[0]);
    bill.payments = payments.map((p) => ({
      id: p.id,
      billId: p.bill_id,
      amount: parseFloat(p.amount),
      paymentDate: p.payment_date,
      paymentMethod: p.payment_method,
      referenceNumber: p.reference_number,
      notes: p.notes,
      createdAt: p.created_at,
    }));

    return Response.json(bill);
  } catch (error) {
    if (error.message === "UNAUTHORIZED")
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    return Response.json({ error: error.code ? "Database error" : error.message }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const user = await requireAuth(request);
    await ensureApGstColumns();
    await ensureTdsColumns();
    const { id } = params;
    const body = await request.json();

    const {
      title, description, category, vendorId, employeeId, payee,
      amount, tax, receiptUrl, receiptObjectKey, project, projectId, billDate, dueDate, referenceNumber, notes, status,
      currency, inrCharged,
      isRcm, rcmSection, rcmRate, itcEligibility,
      tdsSection, tdsRate,
    } = body;

    // Foreign-currency: store everything in INR, keep foreign as reference (mirrors POST).
    const amountProvided = amount !== undefined && amount !== null && amount !== "";
    let inrAmount = null, foreignAmount = null, foreignCurrency = null, fxRate = null, taxInr = null, setCurrency = null;
    if (amountProvided) {
      const cur = (currency || "INR").toUpperCase();
      if (cur !== "INR") {
        if (!inrCharged || parseFloat(inrCharged) <= 0) {
          return Response.json({ error: "Enter the actual INR amount debited (incl. forex markup) for foreign-currency bills." }, { status: 400 });
        }
        inrAmount = parseFloat(inrCharged);
        foreignAmount = parseFloat(amount);
        foreignCurrency = cur;
        fxRate = foreignAmount > 0 ? inrAmount / foreignAmount : 1.0;
      } else {
        inrAmount = parseFloat(amount);
        fxRate = 1.0;
      }
      setCurrency = "INR";
      taxInr = tax ? parseFloat(tax) : 0;
    }

    // Load the existing bill (for receipt cleanup + to fill fields omitted from this update).
    const currentBill = await sql`SELECT * FROM bills WHERE id = ${id}`;
    if (currentBill.length === 0)
      return Response.json({ error: "Bill not found" }, { status: 404 });
    const existing = currentBill[0];

    // Period lock (Rule 11(g)): block edits to filed-period bills.
    const lockDate = await getBooksLockDate();
    if (isPeriodLocked(existing.bill_date, lockDate)) {
      return Response.json({ error: `This bill is in a locked period (filed up to ${lockDate}). Move the books-lock date in Settings to edit it.` }, { status: 403 });
    }

    if (existing.receipt_object_key && receiptObjectKey && existing.receipt_object_key !== receiptObjectKey) {
      try {
        await deleteFromR2(existing.receipt_object_key);
      } catch (cleanupErr) {
        console.warn("Could not clean up previous receipt from R2:", cleanupErr.message);
      }
    }

    // ── GST buy-side recompute (mirrors POST) ─────────────────────────────────
    const effCategory = category || existing.category;
    const effTaxInr = taxInr != null ? taxInr : parseFloat(existing.tax || 0);
    const effInrAmount = inrAmount != null ? inrAmount : parseFloat(existing.amount || 0);
    const effVendorId = vendorId ? parseInt(vendorId) : (existing.vendor_id || null);
    const effRef = referenceNumber !== undefined ? referenceNumber : existing.reference_number;
    const effBillDate = billDate || existing.bill_date;

    const itcElig = itcEligibility || defaultItcEligibility(effCategory);

    const vendorRow = effVendorId ? (await sql`SELECT gst_treatment, gstin, state_code FROM vendors WHERE id = ${effVendorId}`)[0] : null;
    const settingsRow = (await sql`SELECT state_code FROM company_settings ORDER BY id ASC LIMIT 1`)[0] || {};
    const ctx = deriveTaxContext({
      gstTreatment: vendorRow?.gst_treatment || "unregistered",
      sellerStateCode: settingsRow.state_code || null,
      partyStateCode: vendorRow?.state_code || null,
      side: "purchase",
      vendorTreatment: vendorRow?.gst_treatment || null,
    });
    const rcm = (isRcm === undefined) ? !!existing.is_rcm : !!isRcm;
    const effRcmRate = rcmRate !== undefined ? rcmRate : parseFloat(existing.rcm_rate || 0);
    const effRcmSection = rcmSection !== undefined ? rcmSection : (existing.rcm_section || null);
    const rcmInterstate = ctx.isInterstate || vendorRow?.gst_treatment === "overseas";
    let rcmTaxAmount = 0;
    let selfInvoiceNumber = existing.self_invoice_number || null;
    if (rcm) {
      rcmTaxAmount = computeRcmTax({ taxableAmount: effInrAmount, rate: effRcmRate || 0, isInterstate: rcmInterstate }).total;
      if (!selfInvoiceNumber) {
        selfInvoiceNumber = await getNextSelfInvoiceNumber();
        await sql`UPDATE company_settings SET next_self_invoice_number = COALESCE(next_self_invoice_number,1) + 1 WHERE id = (SELECT id FROM company_settings ORDER BY id ASC LIMIT 1)`;
      }
    }

    // GUARD: eligible ITC on a normal (non-RCM) taxed bill needs registered vendor + supplier invoice no + date.
    if (!isBlockedItc(itcElig) && effTaxInr > 0 && !rcm) {
      if (!vendorRow?.gstin) return Response.json({ error: "Eligible ITC requires a registered vendor with a GSTIN. Mark ITC ineligible or select a GST-registered vendor." }, { status: 400 });
      if (!effRef) return Response.json({ error: "Eligible ITC requires the supplier invoice number (reference number)." }, { status: 400 });
      if (!effBillDate) return Response.json({ error: "Eligible ITC requires the bill/invoice date." }, { status: 400 });
    }

    // TDS payable recompute (base excludes GST).
    if (!isValidTdsSection(tdsSection)) return Response.json({ error: "Invalid TDS section" }, { status: 400 });
    const effTdsSection = tdsSection !== undefined ? tdsSection : (existing.tds_section || null);
    const effTdsRate = tdsRate !== undefined ? (parseFloat(tdsRate) || 0) : parseFloat(existing.tds_rate || 0);
    const effTdsAmount = effTdsSection ? computeTds(tdsBase(effInrAmount, effTaxInr), effTdsRate) : 0;

    const result = await sql`
      UPDATE bills SET
        title            = COALESCE(${title || null}, title),
        description      = ${description !== undefined ? description : null},
        category         = COALESCE(${category || null}, category),
        vendor_id        = ${vendorId ? parseInt(vendorId) : null},
        employee_id      = ${employeeId ? parseInt(employeeId) : null},
        payee            = ${payee !== undefined ? (payee?.trim() || null) : null},
        amount           = COALESCE(${inrAmount}, amount),
        tax              = COALESCE(${taxInr}, tax),
        receipt_url      = ${receiptUrl !== undefined ? receiptUrl : null},
        receipt_object_key = ${receiptObjectKey !== undefined ? receiptObjectKey : null},
        project          = COALESCE(${project || null}, project),
        project_id       = ${projectId ? parseInt(projectId) : null},
        bill_date        = COALESCE(${billDate || null}, bill_date),
        due_date         = ${dueDate || null},
        status           = COALESCE(${status || null}, status),
        reference_number = ${referenceNumber || null},
        notes            = ${notes || null},
        currency         = COALESCE(${setCurrency}, currency),
        exchange_rate    = COALESCE(${fxRate}, exchange_rate),
        foreign_amount   = CASE WHEN ${amountProvided} THEN ${foreignAmount} ELSE foreign_amount END,
        foreign_currency = CASE WHEN ${amountProvided} THEN ${foreignCurrency} ELSE foreign_currency END,
        is_rcm           = ${rcm},
        rcm_section      = ${effRcmSection},
        rcm_rate         = ${effRcmRate || 0},
        rcm_tax_amount   = ${rcmTaxAmount},
        itc_eligibility  = ${itcElig},
        self_invoice_number = ${selfInvoiceNumber},
        tds_section      = ${effTdsSection},
        tds_rate         = ${effTdsRate},
        tds_amount       = ${effTdsAmount},
        updated_at       = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

    if (result.length === 0)
      return Response.json({ error: "Bill not found" }, { status: 404 });

    await logChange({
      entityType: "bill", entityId: parseInt(id), action: "update",
      before: existing, after: result[0], user, request,
      keys: ["bill_date", "due_date", "amount", "tax", "status", "category", "vendor_id", "tds_amount", "rcm_tax_amount", "itc_eligibility", "reference_number", "notes"],
    });
    return Response.json(mapBill(result[0]));
  } catch (error) {
    if (error.message === "UNAUTHORIZED")
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    return Response.json({ error: error.code ? "Database error" : error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const user = await requireAuth(request);
    const { id } = params;

    const billRow = (await sql`SELECT bill_date, status FROM bills WHERE id = ${id}`)[0];
    if (!billRow) return Response.json({ error: "Bill not found" }, { status: 404 });

    // Period lock: cannot delete a filed-period bill.
    const lockDate = await getBooksLockDate();
    if (isPeriodLocked(billRow.bill_date, lockDate)) {
      return Response.json({ error: `This bill is in a locked period (filed up to ${lockDate}).` }, { status: 403 });
    }
    // No hard-delete of approved/paid bills (books integrity) — only draft/pending/rejected.
    if (!["draft", "pending", "rejected"].includes(billRow.status)) {
      return Response.json({ error: `A ${billRow.status} bill can't be deleted. Reverse it via a debit note / adjustment instead.` }, { status: 400 });
    }

    // Only allow delete if no payments recorded
    const payments = await sql`SELECT COUNT(*) as count FROM bill_payments WHERE bill_id = ${id}`;
    if (parseInt(payments[0].count) > 0) {
      return Response.json(
        { error: "Cannot delete a bill with recorded payments. Cancel it instead." },
        { status: 400 }
      );
    }

    await logChange({ entityType: "bill", entityId: parseInt(id), action: "delete", after: { status: billRow.status }, user, request });

    // Fetch bill to check if it has a receipt associated with it on R2
    const currentBills = await sql`SELECT receipt_object_key FROM bills WHERE id = ${id}`;
    if (currentBills.length > 0 && currentBills[0].receipt_object_key) {
      try {
        await deleteFromR2(currentBills[0].receipt_object_key);
      } catch (cleanupErr) {
        console.warn("Could not clean up receipt from R2 on bill delete:", cleanupErr.message);
      }
    }

    const result = await sql`DELETE FROM bills WHERE id = ${id} RETURNING id`;
    if (result.length === 0)
      return Response.json({ error: "Bill not found" }, { status: 404 });

    return Response.json({ success: true });
  } catch (error) {
    if (error.message === "UNAUTHORIZED")
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    return Response.json({ error: error.code ? "Database error" : error.message }, { status: 500 });
  }
}
