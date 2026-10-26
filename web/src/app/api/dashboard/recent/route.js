import sql from "@/app/api/utils/sql";
import { requireAuth } from "@/app/api/utils/auth";

export async function GET(request) {
  try {
    await requireAuth(request);

    const url = new URL(request.url);
    const from = url.searchParams.get("from") || null;
    const to   = url.searchParams.get("to")   || null;
    const hasRange = from && to;

    const recentInvoices = hasRange
      ? await sql`
          SELECT
            i.id, i.invoice_number, i.invoice_date, i.grand_total,
            i.cgst_amount, i.sgst_amount, i.igst_amount, i.status,
            c.name as customer_name, c.company_name as customer_company
          FROM invoices i
          LEFT JOIN customers c ON i.customer_id = c.id
          WHERE i.is_archived = false
            AND i.invoice_date::date >= ${from}::date AND i.invoice_date::date <= ${to}::date
          ORDER BY i.created_at DESC LIMIT 10`
      : await sql`
          SELECT
            i.id, i.invoice_number, i.invoice_date, i.grand_total,
            i.cgst_amount, i.sgst_amount, i.igst_amount, i.status,
            c.name as customer_name, c.company_name as customer_company
          FROM invoices i
          LEFT JOIN customers c ON i.customer_id = c.id
          WHERE i.is_archived = false
          ORDER BY i.created_at DESC LIMIT 10`;

    return Response.json({
      invoices: recentInvoices.map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.invoice_number,
        invoiceDate: inv.invoice_date,
        grandTotal: parseFloat(inv.grand_total),
        totalGST:
          parseFloat(inv.cgst_amount || 0) +
          parseFloat(inv.sgst_amount || 0) +
          parseFloat(inv.igst_amount || 0),
        status: inv.status,
        customerName: inv.customer_company || inv.customer_name || "N/A",
      })),
    });
  } catch (error) {
    if (error.message === "UNAUTHORIZED") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Recent invoices error:", error);
    return Response.json(
      { error: "Failed to get recent invoices" },
      { status: 500 },
    );
  }
}
