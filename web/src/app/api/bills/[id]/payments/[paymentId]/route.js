import sql from "@/app/api/utils/sql";
import { requireAuth, requireAdmin, logAudit } from "@/app/api/utils/auth";

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

export async function PUT(request, { params }) {
  try {
    const user = await requireAuth(request);
    const { id, paymentId } = params;
    const body = await request.json();
    const { amount, paymentDate, paymentMethod, referenceNumber, notes } = body;

    if (amount != null && parseFloat(amount) <= 0)
      return Response.json({ error: "Valid amount is required" }, { status: 400 });

    const existing = await sql`SELECT amount FROM bill_payments WHERE id = ${paymentId} AND bill_id = ${id}`;
    if (existing.length === 0)
      return Response.json({ error: "Payment not found" }, { status: 404 });

    // Overpayment guard: cap at net owed (bill − TDS), excluding this entry's own amount.
    if (amount != null) {
      const billRows = await sql`SELECT amount, COALESCE(tds_amount, 0) AS tds_amount FROM bills WHERE id = ${id}`;
      const otherPaid = await sql`SELECT COALESCE(SUM(amount), 0) AS total FROM bill_payments WHERE bill_id = ${id} AND id <> ${paymentId}`;
      const remaining = parseFloat(billRows[0].amount) - parseFloat(billRows[0].tds_amount) - parseFloat(otherPaid[0].total);
      if (parseFloat(amount) > remaining + 0.01)
        return Response.json({ error: `Payment exceeds outstanding balance of ₹${remaining.toFixed(2)}` }, { status: 400 });
    }

    const result = await sql`
      UPDATE bill_payments SET
        amount           = COALESCE(${amount != null ? parseFloat(amount) : null}, amount),
        payment_date     = COALESCE(${paymentDate || null}, payment_date),
        payment_method   = COALESCE(${paymentMethod || null}, payment_method),
        reference_number = ${referenceNumber ?? null},
        notes            = ${notes ?? null}
      WHERE id = ${paymentId} AND bill_id = ${id}
      RETURNING *
    `;

    await syncBillStatus(id);

    await logAudit({
      userId: user.id, action: "update_bill_payment", entityType: "bill_payment",
      entityId: parseInt(paymentId), metadata: { billId: parseInt(id) }, request,
    });

    return Response.json({ success: true, payment: result[0] });
  } catch (error) {
    if (error.message === "UNAUTHORIZED")
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    console.error("Update bill payment error:", error);
    return Response.json({ error: "Failed to update payment" }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    await requireAdmin(request);
    const { id, paymentId } = params;

    const result = await sql`DELETE FROM bill_payments WHERE id = ${paymentId} AND bill_id = ${id} RETURNING id`;
    if (result.length === 0)
      return Response.json({ error: "Payment not found" }, { status: 404 });

    await syncBillStatus(id);
    return Response.json({ success: true });
  } catch (error) {
    if (error.message === "UNAUTHORIZED")
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (error.message === "FORBIDDEN")
      return Response.json({ error: "Only admins can delete payment records" }, { status: 403 });
    console.error("Delete bill payment error:", error);
    return Response.json({ error: "Failed to delete payment" }, { status: 500 });
  }
}
