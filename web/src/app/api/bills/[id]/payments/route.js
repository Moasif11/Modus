import sql from "@/app/api/utils/sql";
import { requireAuth, logAudit } from "@/app/api/utils/auth";

async function ensureReceiptUrlColumn() {
  await sql`
    ALTER TABLE bill_payments
    ADD COLUMN IF NOT EXISTS receipt_url TEXT
  `;
  await sql`
    ALTER TABLE bill_payments
    ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'INR'
  `;
  await sql`
    ALTER TABLE bill_payments
    ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(12,6) DEFAULT 1.0
  `;
}

async function syncBillStatus(billId) {
  const bills = await sql`SELECT amount, COALESCE(tds_amount, 0) AS tds_amount FROM bills WHERE id = ${billId}`;
  if (bills.length === 0) return;

  const totalBill = parseFloat(bills[0].amount);
  const tds = parseFloat(bills[0].tds_amount) || 0;
  const paymentsSum = await sql`
    SELECT COALESCE(SUM(amount), 0) as total FROM bill_payments WHERE bill_id = ${billId}
  `;
  const totalPaid = parseFloat(paymentsSum[0].total);
  // TDS withheld settles the vendor's dues alongside cash paid (it's remitted to govt).
  const settled = totalPaid + tds;

  let newStatus;
  if (settled <= 0) newStatus = "approved";
  else if (settled >= totalBill) newStatus = "paid";
  else newStatus = "partially_paid";

  await sql`
    UPDATE bills
    SET amount_paid = ${totalPaid}, status = ${newStatus}, updated_at = NOW()
    WHERE id = ${billId}
  `;
}

export async function GET(request, { params }) {
  try {
    await requireAuth(request);
    await ensureReceiptUrlColumn();
    const { id } = params;

    const payments = await sql`
      SELECT * FROM bill_payments
      WHERE bill_id = ${id}
      ORDER BY payment_date DESC, created_at DESC
    `;

    return Response.json({
      payments: payments.map((p) => ({
        id: p.id,
        billId: p.bill_id,
        amount: parseFloat(p.amount),
        paymentDate: p.payment_date,
        paymentMethod: p.payment_method,
        referenceNumber: p.reference_number,
        notes: p.notes,
        receiptUrl: p.receipt_url || null,
        createdAt: p.created_at,
        currency: p.currency || "INR",
        exchangeRate: parseFloat(p.exchange_rate || 1.0),
      })),
    });
  } catch (error) {
    if (error.message === "UNAUTHORIZED")
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    return Response.json({ error: error.code ? "Database error" : error.message }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    const user = await requireAuth(request);
    await ensureReceiptUrlColumn();
    const { id } = params;
    const body = await request.json();

    const { amount, paymentDate, paymentMethod = "bank_transfer", referenceNumber, notes, receiptUrl, currency, exchangeRate } = body;

    if (!amount || parseFloat(amount) <= 0)
      return Response.json({ error: "Valid amount is required" }, { status: 400 });
    if (!paymentDate)
      return Response.json({ error: "Payment date is required" }, { status: 400 });

    // Prevent overpayment
    const billRows = await sql`SELECT amount, amount_paid, currency, exchange_rate, COALESCE(tds_amount, 0) AS tds_amount FROM bills WHERE id = ${id}`;
    if (billRows.length === 0)
      return Response.json({ error: "Bill not found" }, { status: 404 });

    const bill = billRows[0];
    // Vendor is only owed net of TDS withheld — cap payments at that, not the gross bill.
    const remaining = parseFloat(bill.amount) - parseFloat(bill.tds_amount) - parseFloat(bill.amount_paid);
    
    // Check if the formatting should prefer symbol or code for showing outstanding
    const billSymbol = bill.currency === 'USD' ? '$' : (bill.currency === 'INR' ? '₹' : (bill.currency === 'AED' ? 'د.إ' : bill.currency));
    if (parseFloat(amount) > remaining + 0.01) {
      return Response.json(
        { error: `Payment exceeds outstanding balance of ${billSymbol}${remaining.toFixed(2)}` },
        { status: 400 }
      );
    }

    const result = await sql`
      INSERT INTO bill_payments (bill_id, amount, payment_date, payment_method, reference_number, notes, receipt_url, currency, exchange_rate)
      VALUES (${parseInt(id)}, ${parseFloat(amount)}, ${paymentDate}, ${paymentMethod}, ${referenceNumber || null}, ${notes || null}, ${receiptUrl || null}, ${currency || bill.currency || 'INR'}, ${exchangeRate || bill.exchange_rate || 1.0})
      RETURNING *
    `;

    await syncBillStatus(id);

    await logAudit({
      userId: user.id,
      action: "record_bill_payment",
      entityType: "bill_payment",
      entityId: result[0].id,
      metadata: { billId: parseInt(id), amount: parseFloat(amount), paymentMethod },
      request,
    });

    return Response.json({
      id: result[0].id,
      billId: result[0].bill_id,
      amount: parseFloat(result[0].amount),
      paymentDate: result[0].payment_date,
      paymentMethod: result[0].payment_method,
      referenceNumber: result[0].reference_number,
      notes: result[0].notes,
      receiptUrl: result[0].receipt_url || null,
      createdAt: result[0].created_at,
      currency: result[0].currency || "INR",
      exchangeRate: parseFloat(result[0].exchange_rate || 1.0),
    }, { status: 201 });
  } catch (error) {
    if (error.message === "UNAUTHORIZED")
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    console.error("POST bill payment error:", error);
    return Response.json({ error: error.code ? "Database error" : error.message }, { status: 500 });
  }
}
