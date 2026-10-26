import sql from "@/app/api/utils/sql";
import { requireAdmin, logAudit } from "@/app/api/utils/auth";
import { deleteFromR2 } from "@/app/api/utils/r2";
import { recomputeInvoiceStatus } from "@/app/api/utils/invoiceStatus";

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

export async function DELETE(request, { params }) {
  try {
    const user = await requireAdmin(request);
    const { id } = params;

    await ensurePaymentsTable();

    // 1. Fetch the payment record to get invoice details before deleting
    const payments = await sql`
      SELECT * FROM payments WHERE id = ${id}
    `;

    if (payments.length === 0) {
      return Response.json({ error: "Payment not found" }, { status: 404 });
    }

    const payment = payments[0];
    const invoiceId = payment.invoice_id;

    // Clean up receipt object from R2 on payment deletion
    if (payment.receipt_object_key) {
      try {
        await deleteFromR2(payment.receipt_object_key);
      } catch (cleanupErr) {
        console.warn("Could not clean up payment receipt from R2 on payment delete:", cleanupErr.message);
      }
    }

    // 2. Delete the payment
    await sql`
      DELETE FROM payments WHERE id = ${id}
    `;

    // 3. Recalculate invoice status (single source of truth: payments − refunds vs grand_total − credits)
    await recomputeInvoiceStatus(invoiceId);

    // 4. Log audit
    await logAudit({
      userId: user.id,
      action: "delete_payment",
      entityType: "payment",
      entityId: parseInt(id),
      metadata: { invoiceId, amount: parseFloat(payment.amount) },
      request,
    });

    return Response.json({ message: "Payment deleted successfully" });
  } catch (error) {
    if (error.message === "UNAUTHORIZED") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error.message === "FORBIDDEN") {
      return Response.json({ error: "Only admins can delete payment records" }, { status: 403 });
    }
    console.error("Delete payment error:", error);
    return Response.json(
      { error: "Failed to delete payment" },
      { status: 500 },
    );
  }
}

export async function PUT(request, { params }) {
  try {
    const user = await requireAdmin(request);
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

    // 1. Fetch payment to verify it exists and get its invoiceId
    const payments = await sql`
      SELECT * FROM payments WHERE id = ${id}
    `;
    if (payments.length === 0) {
      return Response.json({ error: "Payment record not found" }, { status: 404 });
    }
    const oldPayment = payments[0];
    const invoiceId = oldPayment.invoice_id;

    // Clean up previous receipt from R2 if it changed
    if (oldPayment.receipt_object_key && receiptObjectKey && oldPayment.receipt_object_key !== receiptObjectKey) {
      try {
        await deleteFromR2(oldPayment.receipt_object_key);
      } catch (cleanupErr) {
        console.warn("Could not clean up previous payment receipt from R2:", cleanupErr.message);
      }
    }

    // 2. Update payment
    const result = await sql`
      UPDATE payments
      SET amount = ${parseFloat(amount)},
          payment_date = ${paymentDate},
          payment_method = ${paymentMethod || null},
          reference_number = ${referenceNumber || null},
          notes = ${notes || null},
          receipt_url = ${receiptUrl || null},
          receipt_object_key = ${receiptObjectKey || null},
          currency = ${currency || oldPayment.currency || 'INR'},
          exchange_rate = ${exchangeRate || oldPayment.exchange_rate || 1.0}
      WHERE id = ${id}
      RETURNING *
    `;
    const updatedPayment = result[0];

    // 3. Recalculate invoice status (single source of truth)
    await recomputeInvoiceStatus(invoiceId);

    // 4. Log audit
    await logAudit({
      userId: user.id,
      action: "edit_payment",
      entityType: "payment",
      entityId: parseInt(id),
      metadata: { invoiceId, amount: parseFloat(amount), oldAmount: parseFloat(oldPayment.amount) },
      request,
    });

    return Response.json({
      id: updatedPayment.id,
      invoiceId: updatedPayment.invoice_id,
      amount: parseFloat(updatedPayment.amount),
      paymentDate: updatedPayment.payment_date,
      paymentMethod: updatedPayment.payment_method,
      referenceNumber: updatedPayment.reference_number,
      notes: updatedPayment.notes,
      receiptUrl: updatedPayment.receipt_url,
      receiptObjectKey: updatedPayment.receipt_object_key,
      createdAt: updatedPayment.created_at,
      currency: updatedPayment.currency || "INR",
      exchangeRate: parseFloat(updatedPayment.exchange_rate || 1.0),
    });
  } catch (error) {
    if (error.message === "UNAUTHORIZED") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error.message === "FORBIDDEN") {
      return Response.json({ error: "Only admins can edit payment records" }, { status: 403 });
    }
    console.error("Edit payment error:", error);
    return Response.json(
      { error: "Failed to edit payment" },
      { status: 500 },
    );
  }
}

