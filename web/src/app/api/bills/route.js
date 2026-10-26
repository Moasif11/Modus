import sql from "@/app/api/utils/sql";
import { requireAuth, logAudit } from "@/app/api/utils/auth";
import { notifySuperAdmins, getSuperAdminEmails, sendEmail, getNotificationPrefs } from "@/app/api/utils/notify";
import { emailShell } from "@/app/api/utils/emailTemplate";
import { ensureApGstColumns, getNextSelfInvoiceNumber } from "@/app/api/utils/apSchema";
import { defaultItcEligibility, isBlockedItc } from "@/app/api/utils/itcRules";
import { computeRcmTax } from "@/app/api/utils/rcmMath";
import { deriveTaxContext } from "@/app/api/utils/gstTreatment";
import { ensureTdsColumns } from "@/app/api/utils/tdsSchema";
import { computeTds, tdsBase, isValidTdsSection } from "@/app/api/utils/tdsRules";

function fmtINR(n) {
  return `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

async function ensureBillsTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS bills (
      id               SERIAL PRIMARY KEY,
      bill_number      VARCHAR(20) UNIQUE,
      title            VARCHAR(500) NOT NULL,
      description      TEXT,
      category         VARCHAR(50) NOT NULL DEFAULT 'expense',
      vendor_id        INTEGER,
      employee_id      INTEGER,
      amount           NUMERIC(12,2) NOT NULL DEFAULT 0,
      amount_paid      NUMERIC(12,2) NOT NULL DEFAULT 0,
      bill_date        DATE NOT NULL DEFAULT CURRENT_DATE,
      due_date         DATE,
      status           VARCHAR(30) NOT NULL DEFAULT 'approved',
      reference_number VARCHAR(255),
      notes            TEXT,
      created_by       INTEGER,
      created_at       TIMESTAMPTZ DEFAULT NOW(),
      updated_at       TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`ALTER TABLE bills ADD COLUMN IF NOT EXISTS tax NUMERIC(12,2) DEFAULT 0`;
  await sql`ALTER TABLE bills ADD COLUMN IF NOT EXISTS due_soon_notified_at TIMESTAMPTZ`;
  await sql`ALTER TABLE bills ADD COLUMN IF NOT EXISTS receipt_url TEXT`;
  await sql`ALTER TABLE bills ADD COLUMN IF NOT EXISTS receipt_object_key TEXT`;
  await sql`ALTER TABLE bills ADD COLUMN IF NOT EXISTS project VARCHAR(255)`;
  await sql`ALTER TABLE bills ADD COLUMN IF NOT EXISTS project_id INTEGER`;

  await sql`
    CREATE TABLE IF NOT EXISTS bill_payments (
      id               SERIAL PRIMARY KEY,
      bill_id          INTEGER REFERENCES bills(id) ON DELETE CASCADE,
      amount           NUMERIC(12,2) NOT NULL,
      payment_date     DATE NOT NULL,
      payment_method   VARCHAR(50) DEFAULT 'bank_transfer',
      reference_number VARCHAR(255),
      notes            TEXT,
      created_at       TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`ALTER TABLE bills ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'INR'`;
  await sql`ALTER TABLE bills ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(12,6) DEFAULT 1.0`;
  await sql`ALTER TABLE bill_payments ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'INR'`;
  await sql`ALTER TABLE bill_payments ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(12,6) DEFAULT 1.0`;
  // Approval workflow
  await sql`ALTER TABLE bills ADD COLUMN IF NOT EXISTS approved_by INTEGER`;
  await sql`ALTER TABLE bills ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ`;
  await sql`ALTER TABLE bills ADD COLUMN IF NOT EXISTS rejected_reason TEXT`;
  await sql`ALTER TABLE bills ADD COLUMN IF NOT EXISTS payee VARCHAR(255)`;
  // Foreign-currency model: amount/currency are ALWAYS stored in INR (the actual amount
  // debited). The original foreign amount + currency are kept as reference only.
  await sql`ALTER TABLE bills ADD COLUMN IF NOT EXISTS foreign_amount NUMERIC(14,2)`;
  await sql`ALTER TABLE bills ADD COLUMN IF NOT EXISTS foreign_currency VARCHAR(10)`;
  // One-time backfill: convert legacy foreign bills (amount stored in foreign currency) to
  // the INR-primary model. Idempotent — after conversion currency='INR' so it won't re-match.
  await sql`
    UPDATE bills
    SET foreign_amount   = amount,
        foreign_currency = currency,
        amount           = ROUND(amount * COALESCE(exchange_rate, 1), 2),
        amount_paid      = ROUND(amount_paid * COALESCE(exchange_rate, 1), 2),
        tax              = ROUND(COALESCE(tax, 0) * COALESCE(exchange_rate, 1), 2),
        currency         = 'INR'
    WHERE currency IS NOT NULL AND currency <> 'INR' AND foreign_currency IS NULL
  `;
}

async function nextBillNumber() {
  const result = await sql`
    SELECT bill_number FROM bills
    WHERE bill_number LIKE 'HB-%'
    ORDER BY id DESC LIMIT 1
  `;
  if (result.length === 0) return "HB-000001";
  const last = result[0].bill_number;
  const num = parseInt(last.replace("HB-", ""), 10);
  return `HB-${String(num + 1).padStart(6, "0")}`;
}

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
    createdBy: b.created_by || null,
    createdByName: b.creator_name || null,
    rejectedReason: b.rejected_reason || null,
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
    // Net actually payable to the vendor after withholding TDS.
    netPayable: parseFloat(b.amount || 0) - parseFloat(b.tds_amount || 0),
  };
}

// Lazy "bill due soon" alerts (no cron): on list load, notify superadmins once per
// unpaid bill due within 3 days. Gated by Settings → Notifications.
async function notifyBillsDueSoon() {
  const prefs = await getNotificationPrefs();
  if (!prefs.billDueSoon) return;
  const soon = await sql`
    SELECT id, bill_number, title, due_date, amount, amount_paid, COALESCE(tds_amount, 0) AS tds_amount FROM bills
    WHERE status IN ('approved', 'partially_paid')
      AND due_date IS NOT NULL
      AND due_date >= CURRENT_DATE
      AND due_date <= CURRENT_DATE + INTERVAL '3 days'
      AND due_soon_notified_at IS NULL
    LIMIT 20
  `;
  for (const b of soon) {
    const unpaid = parseFloat(b.amount || 0) - parseFloat(b.tds_amount || 0) - parseFloat(b.amount_paid || 0);
    await notifySuperAdmins({
      type: "bill_due_soon",
      title: `Bill due soon — ${b.bill_number || b.title}`,
      body: `${fmtINR(unpaid)} due ${new Date(b.due_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`,
      link: `/payables/${b.id}`,
      relatedId: b.id,
    });
    await sql`UPDATE bills SET due_soon_notified_at = NOW() WHERE id = ${b.id}`;
  }
}

// Financial-year-to-date figures behind the Payables "Paid" stat.
//
// Cash comes from the bill_payments ledger, keyed on payment_date, so a partial
// payment counts on the day the money actually left. TDS is keyed on bill_date
// instead — that's the deduction event we report in 26Q, and it keeps this card
// agreeing with the TDS register in reportData.buildTds.
async function fyPaidStats() {
  const today = new Date();
  // Indian FY starts 1 April (month index 3).
  const startYear = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
  const fyStart = `${startYear}-04-01`;
  const fyLabel = `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;

  const [paid] = await sql`
    SELECT COALESCE(SUM(p.amount), 0) AS total
    FROM bill_payments p
    JOIN bills b ON b.id = p.bill_id
    WHERE p.payment_date >= ${fyStart}::date
      AND b.status NOT IN ('cancelled', 'rejected', 'draft')
  `;
  const [tds] = await sql`
    SELECT COALESCE(SUM(COALESCE(tds_amount, 0)), 0) AS total
    FROM bills
    WHERE bill_date >= ${fyStart}::date
      AND status NOT IN ('cancelled', 'rejected', 'draft')
  `;

  return { paidFy: parseFloat(paid.total), tdsFy: parseFloat(tds.total), fyLabel };
}

export async function GET(request) {
  try {
    await requireAuth(request);
    await ensureBillsTables();
    // fyPaidStats() sums tds_amount in SQL, so the column has to exist.
    await ensureTdsColumns();

    // Fire-and-forget so list latency is unaffected
    notifyBillsDueSoon().catch((e) => console.error("Due-soon notify failed:", e.message));

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const category = searchParams.get("category") || "";
    const vendorId = searchParams.get("vendor_id") || "";
    const from = searchParams.get("from") || null;
    const to = searchParams.get("to") || null;

    const bills = await sql`
      SELECT b.*,
             v.name AS vendor_name,
             e.name AS employee_name,
             u.full_name AS creator_name
      FROM bills b
      LEFT JOIN vendors v ON b.vendor_id = v.id
      LEFT JOIN employees e ON b.employee_id = e.id
      LEFT JOIN users u ON b.created_by = u.id
      WHERE (
        ${search} = '' OR
        b.title ILIKE ${"%" + search + "%"} OR
        b.bill_number ILIKE ${"%" + search + "%"} OR
        v.name ILIKE ${"%" + search + "%"} OR
        e.name ILIKE ${"%" + search + "%"}
      )
      AND (${status} = '' OR b.status = ${status})
      AND (${category} = '' OR b.category = ${category})
      AND (${vendorId} = '' OR b.vendor_id = ${vendorId ? parseInt(vendorId) : null})
      AND (${from}::text IS NULL OR b.bill_date >= ${from}::date)
      AND (${to}::text IS NULL OR b.bill_date <= ${to}::date)
      ORDER BY b.created_at DESC
    `;

    // Compute overdue status for display
    const now = new Date();
    const mapped = bills.map((b) => {
      const bill = mapBill(b);
      if (
        bill.status !== "paid" &&
        bill.status !== "cancelled" &&
        bill.dueDate &&
        new Date(bill.dueDate) < now
      ) {
        bill.isOverdue = true;
      } else {
        bill.isOverdue = false;
      }
      return bill;
    });

    // Summary stats. Amounts are already stored in INR (foreign bills convert on
    // write), so nothing to multiply by exchange_rate here.
    const outstanding = mapped
      .filter((b) => !["paid", "cancelled", "pending", "rejected"].includes(b.status))
      .reduce((sum, b) => sum + b.amountDue, 0);

    const overdueCount = mapped.filter((b) => b.isOverdue).length;

    // Financial-year-to-date cash out + TDS withheld. Ignores the list filters on
    // purpose — this is a company-wide figure, not a view of the current search.
    const { paidFy, tdsFy, fyLabel } = await fyPaidStats();

    return Response.json({ bills: mapped, outstanding, overdueCount, paidFy, tdsFy, fyLabel });
  } catch (error) {
    if (error.message === "UNAUTHORIZED")
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    console.error("GET /api/bills error:", error);
    return Response.json({ error: error.code ? "Database error" : error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const user = await requireAuth(request);
    await ensureBillsTables();
    await ensureApGstColumns();
    await ensureTdsColumns();

    const body = await request.json();
    const {
      title, description, category = "expense",
      vendorId, employeeId, payee,
      amount, tax, receiptUrl, receiptObjectKey, project, projectId, billDate, dueDate,
      referenceNumber, notes,
      quickPay = false, status: reqStatus,
      currency, inrCharged,
      isRcm, rcmSection, rcmRate, itcEligibility,
      tdsSection, tdsRate,
    } = body;

    if (!title?.trim()) return Response.json({ error: "Title is required" }, { status: 400 });
    if (!amount || parseFloat(amount) <= 0) return Response.json({ error: "Valid amount required" }, { status: 400 });

    // Foreign-currency: store everything in INR (the actual amount debited), keep foreign as reference.
    const cur = (currency || "INR").toUpperCase();
    const isForeign = cur !== "INR";
    let inrAmount, foreignAmount = null, foreignCurrency = null, fxRate = 1.0;
    if (isForeign) {
      if (!inrCharged || parseFloat(inrCharged) <= 0) {
        return Response.json({ error: "Enter the actual INR amount debited (incl. forex markup) for foreign-currency bills." }, { status: 400 });
      }
      inrAmount = parseFloat(inrCharged);
      foreignAmount = parseFloat(amount);
      foreignCurrency = cur;
      fxRate = foreignAmount > 0 ? inrAmount / foreignAmount : 1.0;
    } else {
      inrAmount = parseFloat(amount);
    }
    const taxInr = tax ? parseFloat(tax) : 0;

    // ── GST buy-side: ITC eligibility + reverse charge (RCM) ──────────────────
    // ITC eligibility: explicit override else category default (Sec 17(5) blocks petrol/food/travel).
    const itcElig = itcEligibility || defaultItcEligibility(category);

    // Vendor treatment drives RCM auto-detect (import of service => RCM on recipient).
    const vendorRow = vendorId ? (await sql`SELECT gst_treatment, gstin, state_code FROM vendors WHERE id = ${parseInt(vendorId)}`)[0] : null;
    const settingsRow = (await sql`SELECT state_code FROM company_settings ORDER BY id ASC LIMIT 1`)[0] || {};
    const ctx = deriveTaxContext({
      gstTreatment: vendorRow?.gst_treatment || "unregistered",
      sellerStateCode: settingsRow.state_code || null,
      partyStateCode: vendorRow?.state_code || null,
      side: "purchase",
      vendorTreatment: vendorRow?.gst_treatment || null,
    });
    const rcm = (isRcm === undefined) ? ctx.rcmApplicable : !!isRcm; // auto-suggest from import-of-service hint
    const rcmInterstate = ctx.isInterstate || vendorRow?.gst_treatment === "overseas";
    let rcmTaxAmount = 0;
    let selfInvoiceNumber = null;
    if (rcm) {
      rcmTaxAmount = computeRcmTax({ taxableAmount: inrAmount, rate: rcmRate || 0, isInterstate: rcmInterstate }).total;
      selfInvoiceNumber = await getNextSelfInvoiceNumber();
      await sql`UPDATE company_settings SET next_self_invoice_number = COALESCE(next_self_invoice_number,1) + 1 WHERE id = (SELECT id FROM company_settings ORDER BY id ASC LIMIT 1)`;
    }

    // GUARD: eligible ITC on a normal (non-RCM) taxed bill needs a registered vendor +
    // supplier invoice no + bill date (Sec 16(2)(aa) / Rule 36(4)).
    if (!isBlockedItc(itcElig) && taxInr > 0 && !rcm) {
      if (!vendorRow?.gstin) return Response.json({ error: "Eligible ITC requires a registered vendor with a GSTIN. Mark ITC ineligible or select a GST-registered vendor." }, { status: 400 });
      if (!referenceNumber) return Response.json({ error: "Eligible ITC requires the supplier invoice number (reference number)." }, { status: 400 });
      if (!billDate) return Response.json({ error: "Eligible ITC requires the bill/invoice date." }, { status: 400 });
    }

    // ── TDS payable: tax we deduct at source on this bill (deposit + 26Q) ──────
    if (!isValidTdsSection(tdsSection)) return Response.json({ error: "Invalid TDS section" }, { status: 400 });
    const tdsRateNum = tdsSection ? (parseFloat(tdsRate) || 0) : 0;
    // TDS base excludes GST (CBDT Circular 23/2017).
    const tdsAmount = tdsSection ? computeTds(tdsBase(inrAmount, taxInr), tdsRateNum) : 0;

    const billNumber = await nextBillNumber();

    // Approval workflow: only superadmin can create an already-approved/paid expense.
    // Everyone else (admin, user) creates a PENDING expense that a superadmin must approve.
    const isSuperAdmin = user.role === "superadmin";
    const requiresApproval = !isSuperAdmin;

    const finalStatus = requiresApproval
      ? "pending"
      : (reqStatus || (quickPay ? "paid" : "approved"));
    // Pending expenses cannot be quick-paid before approval.
    const effectiveQuickPay = requiresApproval ? false : quickPay;
    const amountPaid = effectiveQuickPay ? inrAmount : 0;

    const result = await sql`
      INSERT INTO bills
        (bill_number, title, description, category, vendor_id, employee_id, payee,
         amount, tax, receipt_url, receipt_object_key, project, project_id, amount_paid, bill_date, due_date, status, reference_number, notes, created_by, currency, exchange_rate, foreign_amount, foreign_currency,
         is_rcm, rcm_section, rcm_rate, rcm_tax_amount, itc_eligibility, self_invoice_number,
         tds_section, tds_rate, tds_amount)
      VALUES
        (${billNumber}, ${title.trim()}, ${description || null}, ${category},
         ${vendorId ? parseInt(vendorId) : null}, ${employeeId ? parseInt(employeeId) : null}, ${payee?.trim() || null},
         ${inrAmount}, ${taxInr}, ${receiptUrl || null}, ${receiptObjectKey || null}, ${project || null},
         ${projectId ? parseInt(projectId) : null}, ${amountPaid},
         ${billDate || new Date().toISOString().split("T")[0]},
         ${dueDate || null},
         ${finalStatus}, ${referenceNumber || null}, ${notes || null}, ${user.id},
         'INR', ${fxRate}, ${foreignAmount}, ${foreignCurrency},
         ${rcm}, ${rcmSection || null}, ${rcmRate || 0}, ${rcmTaxAmount}, ${itcElig}, ${selfInvoiceNumber},
         ${tdsSection || null}, ${tdsRateNum}, ${tdsAmount})
      RETURNING *
    `;

    const bill = result[0];

    // If quick-pay (superadmin only), also insert a payment record (in INR)
    if (effectiveQuickPay && inrAmount > 0) {
      await sql`
        INSERT INTO bill_payments (bill_id, amount, payment_date, payment_method, notes, currency, exchange_rate)
        VALUES (${bill.id}, ${inrAmount}, ${billDate || new Date().toISOString().split("T")[0]}, 'bank_transfer', 'Quick pay on creation', 'INR', 1.0)
      `;
    }

    // Notify superadmins that an expense awaits approval (in-app + email).
    if (requiresApproval) {
      const submitter = user.fullName || user.name || user.email || "A team member";
      const amtLabel = `${fmtINR(inrAmount)}${foreignCurrency ? ` (${foreignCurrency} ${foreignAmount})` : ""}`;
      try {
        await notifySuperAdmins({
          type: "expense_pending",
          title: "Expense awaiting approval",
          body: `${submitter} submitted "${title.trim()}" — ${amtLabel}`,
          link: `/payables?tab=pending`,
          relatedId: bill.id,
        });
        const emails = await getSuperAdminEmails();
        const appUrl = process.env.APP_URL || "http://localhost:4000";
        await sendEmail({
          to: emails,
          subject: `Expense approval needed — ${amtLabel}`,
          html: emailShell({
            preheader: `${submitter} submitted ${amtLabel} for approval`,
            heading: "Expense awaiting your approval",
            intro: `<strong>${submitter}</strong> submitted a new expense that needs your approval before it's recorded.`,
            rows: [
              ["Bill", billNumber],
              ["Title", title.trim()],
              ["Amount", amtLabel],
              ["Category", (category || "").replace(/_/g, " ")],
            ],
            ctaText: "Review & Approve",
            ctaUrl: `${appUrl}/payables?tab=pending`,
            note: "You're receiving this because you're a superadmin on MODUS.",
          }),
        });
      } catch (notifyErr) {
        console.error("Pending-expense notification failed:", notifyErr.message);
      }
    }

    await logAudit({
      userId: user.id,
      action: "create_bill",
      entityType: "bill",
      entityId: bill.id,
      metadata: { billNumber, amount: parseFloat(amount), category },
      request,
    });

    return Response.json(mapBill(bill), { status: 201 });
  } catch (error) {
    if (error.message === "UNAUTHORIZED")
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    console.error("POST /api/bills error:", error);
    return Response.json({ error: error.code ? "Database error" : error.message }, { status: 500 });
  }
}
