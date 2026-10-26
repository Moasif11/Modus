import sql from "@/app/api/utils/sql";
import { requireAuth, logAudit } from "@/app/api/utils/auth";
import { recomputeInvoiceStatus } from "@/app/api/utils/invoiceStatus";
import { getNotificationPrefs, notifySuperAdmins, getSuperAdminEmails, sendEmail } from "@/app/api/utils/notify";
import { emailShell } from "@/app/api/utils/emailTemplate";

async function ensurePaymentsTable() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS payments (
        id SERIAL PRIMARY KEY,
        invoice_id INTEGER REFERENCES invoices(id) ON DELETE CASCADE,
        amount NUMERIC NOT NULL,
        payment_date DATE NOT NULL,
        payment_method VARCHAR(255),
        reference_number VARCHAR(255),
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;
    // Add receipt_url and receipt_object_key columns dynamically if missing
    await sql`
      ALTER TABLE payments ADD COLUMN IF NOT EXISTS receipt_url TEXT;
    `;
    await sql`
      ALTER TABLE payments ADD COLUMN IF NOT EXISTS receipt_object_key TEXT;
    `;
    await sql`
      ALTER TABLE payments ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'INR';
    `;
    await sql`
      ALTER TABLE payments ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(12,6) DEFAULT 1.0;
    `;
  } catch (error) {
    console.error("Error ensuring payments table exists:", error);
  }
}

export async function GET(request, { params }) {
  try {
    await requireAuth(request);
    const { id } = params;

    await ensurePaymentsTable();

    const payments = await sql`
      SELECT * FROM payments
      WHERE invoice_id = ${id}
      ORDER BY payment_date DESC, created_at DESC
    `;

    return Response.json({
      payments: payments.map((p) => ({
        id: p.id,
        invoiceId: p.invoice_id,
        amount: parseFloat(p.amount),
        paymentDate: p.payment_date,
        paymentMethod: p.payment_method,
        referenceNumber: p.reference_number,
        notes: p.notes,
        receiptUrl: p.receipt_url,
        receiptObjectKey: p.receipt_object_key,
        createdAt: p.created_at,
        currency: p.currency || "INR",
        exchangeRate: parseFloat(p.exchange_rate || 1.0),
      }))
    });
  } catch (error) {
    if (error.message === "UNAUTHORIZED") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Get payments error:", error);
    return Response.json(
      { error: "Failed to get payments" },
      { status: 500 },
    );
  }
}

export async function POST(request, { params }) {
  try {
    const user = await requireAuth(request);
    const { id } = params;
    const body = await request.json();

    const { amount, paymentDate, paymentMethod, referenceNumber, notes, receiptUrl, receiptObjectKey, currency, exchangeRate } = body;

    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      return Response.json({ error: "Valid amount is required" }, { status: 400 });
    }
    if (!paymentDate) {
      return Response.json({ error: "Payment date is required" }, { status: 400 });
    }
    if (new Date(paymentDate) > new Date(new Date().toDateString())) {
      return Response.json({ error: "Payment date cannot be in the future" }, { status: 400 });
    }

    await ensurePaymentsTable();

    // 1. Fetch invoice to recalculate status and get currency details
    const invoices = await sql`
      SELECT grand_total, status, currency, exchange_rate FROM invoices WHERE id = ${id}
    `;

    if (invoices.length === 0) {
      return Response.json({ error: "Invoice not found" }, { status: 404 });
    }

    const invoice = invoices[0];

    // Overpayment guard: total recorded payments must not exceed the invoice amount.
    const paidRow = await sql`
      SELECT COALESCE(SUM(amount), 0) AS paid FROM payments WHERE invoice_id = ${id}
    `;
    const alreadyPaid = parseFloat(paidRow[0].paid) || 0;
    const balance = (parseFloat(invoice.grand_total) || 0) - alreadyPaid;
    if (parseFloat(amount) > balance + 0.01) {
      return Response.json(
        { error: `Payment exceeds balance due (₹${balance.toFixed(2)}). Record the excess as an advance or credit note instead.` },
        { status: 400 },
      );
    }

    // 2. Insert payment entry
    const result = await sql`
      INSERT INTO payments (invoice_id, amount, payment_date, payment_method, reference_number, notes, receipt_url, receipt_object_key, currency, exchange_rate)
      VALUES (${id}, ${parseFloat(amount)}, ${paymentDate}, ${paymentMethod || null}, ${referenceNumber || null}, ${notes || null}, ${receiptUrl || null}, ${receiptObjectKey || null}, ${currency || invoice.currency || 'INR'}, ${exchangeRate || invoice.exchange_rate || 1.0})
      RETURNING *
    `;

    const payment = result[0];

    // Recompute invoice balance + status from the single source of truth
    // (payments − refunds vs grand_total − credit notes).
    await recomputeInvoiceStatus(id);

    // 3. Log audit
    await logAudit({
      userId: user.id,
      action: "record_payment",
      entityType: "payment",
      entityId: payment.id,
      metadata: { invoiceId: parseInt(id), amount: parseFloat(amount), paymentMethod },
      request,
    });

    // 4. Notify superadmins — gated by Settings → Notifications "Payment received".
    try {
      const prefs = await getNotificationPrefs();
      if (prefs.paymentReceived) {
        const invRow = await sql`SELECT invoice_number FROM invoices WHERE id = ${id}`;
        const invNo = invRow[0]?.invoice_number || `#${id}`;
        const amtLabel = "₹" + parseFloat(amount).toLocaleString("en-IN", { maximumFractionDigits: 2 });
        await notifySuperAdmins({
          type: "payment_received",
          title: `Payment received — ${invNo}`,
          body: `${amtLabel} recorded on ${invNo}${paymentMethod ? ` via ${String(paymentMethod).replace(/_/g, " ")}` : ""}`,
          link: `/invoices/${id}`,
          relatedId: parseInt(id),
        });
        const emails = await getSuperAdminEmails();
        if (emails.length > 0) {
          const appUrl = process.env.APP_URL || "http://localhost:4000";
          await sendEmail({
            to: emails,
            subject: `Payment received — ${amtLabel} on ${invNo}`,
            html: emailShell({
              preheader: `${amtLabel} recorded on ${invNo}`,
              heading: "Payment received",
              intro: `A payment was recorded against invoice <strong>${invNo}</strong>.`,
              rows: [
                ["Invoice", invNo],
                ["Amount", amtLabel],
                ["Date", paymentDate],
                ["Method", (paymentMethod || "—").replace(/_/g, " ")],
              ],
              ctaText: "View Invoice",
              ctaUrl: `${appUrl}/invoices/${id}`,
              note: "You can turn this alert off in Settings → Notifications.",
            }),
          });
        }
      }
    } catch (notifyErr) {
      console.error("Payment notification failed:", notifyErr.message);
    }

    return Response.json({
      id: payment.id,
      invoiceId: payment.invoice_id,
      amount: parseFloat(payment.amount),
      paymentDate: payment.payment_date,
      paymentMethod: payment.payment_method,
      referenceNumber: payment.reference_number,
      notes: payment.notes,
      receiptUrl: payment.receipt_url,
      receiptObjectKey: payment.receipt_object_key,
      createdAt: payment.created_at,
      currency: payment.currency || "INR",
      exchangeRate: parseFloat(payment.exchange_rate || 1.0),
    });
  } catch (error) {
    if (error.message === "UNAUTHORIZED") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Create payment error:", error);
    return Response.json(
      { error: "Failed to create payment" },
      { status: 500 },
    );
  }
}
