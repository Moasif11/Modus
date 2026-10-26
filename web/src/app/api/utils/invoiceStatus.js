import sql from "@/app/api/utils/sql";
import { ensureCreditNoteTables } from "@/app/api/utils/refundSchema";
import { ensureTdsColumns } from "@/app/api/utils/tdsSchema";
import { invoiceStatus, invoiceBalanceDue } from "@/app/api/utils/refundMath";

// Single source of truth for invoice balance + status.
// Recomputes from grand_total, issued credit notes, payments, refunds, and client-deducted TDS.
export async function recomputeInvoiceStatus(invoiceId) {
  await ensureCreditNoteTables();
  await ensureTdsColumns();

  const inv = (await sql`SELECT grand_total, status, tds_amount FROM invoices WHERE id = ${invoiceId}`)[0];
  if (!inv) return null;

  const [{ total: creditsTotal }] = await sql`
    SELECT COALESCE(SUM(total_amount), 0) AS total FROM credit_notes
    WHERE invoice_id = ${invoiceId} AND status = 'issued'
  `;
  const [{ total: paymentsTotal }] = await sql`
    SELECT COALESCE(SUM(amount), 0) AS total FROM payments WHERE invoice_id = ${invoiceId}
  `;
  const [{ total: refundsTotal }] = await sql`
    SELECT COALESCE(SUM(amount), 0) AS total FROM refund_disbursements WHERE invoice_id = ${invoiceId}
  `;

  const grandTotal = parseFloat(inv.grand_total) || 0;
  const tdsReceivable = parseFloat(inv.tds_amount) || 0;
  // Client-deducted TDS settles part of the invoice (it's remitted to govt on our behalf),
  // so it counts toward "received" alongside cash payments.
  const settled = parseFloat(paymentsTotal) + tdsReceivable;
  const newStatus = invoiceStatus({
    grandTotal,
    creditsTotal: parseFloat(creditsTotal),
    paymentsTotal: settled,
    refundsTotal: parseFloat(refundsTotal),
    currentStatus: inv.status,
  });
  const balanceDue = invoiceBalanceDue(
    grandTotal, parseFloat(creditsTotal), settled, parseFloat(refundsTotal),
  );

  if (newStatus !== inv.status) {
    await sql`UPDATE invoices SET status = ${newStatus}, updated_at = NOW() WHERE id = ${invoiceId}`;
  }
  return {
    status: newStatus,
    balanceDue,
    creditsTotal: parseFloat(creditsTotal),
    paymentsTotal: parseFloat(paymentsTotal),
    refundsTotal: parseFloat(refundsTotal),
    tdsReceivable,
  };
}
