import sql from "@/app/api/utils/sql";
import { requireAuth } from "@/app/api/utils/auth";
import { parse2bInvoices, reconcile2b } from "@/app/api/utils/reconcile2b";

// POST a downloaded GSTR-2B JSON → reconcile against the eligible-ITC bills in the period.
export async function POST(request) {
  try {
    await requireAuth(request);
    const body = await request.json();
    const { from, to, twob } = body;
    if (!from || !to) return Response.json({ error: "from and to dates required" }, { status: 400 });
    if (!twob) return Response.json({ error: "Upload a GSTR-2B JSON file" }, { status: 400 });

    const portal = parse2bInvoices(typeof twob === "string" ? JSON.parse(twob) : twob);

    const billRows = await sql`
      SELECT b.id, b.bill_number, b.reference_number, b.tax, b.rcm_tax_amount, b.is_rcm,
             b.bill_date, v.gstin AS vendor_gstin, COALESCE(v.name, b.payee, '—') AS vendor_name
      FROM bills b
      LEFT JOIN vendors v ON b.vendor_id = v.id
      WHERE b.itc_eligibility = 'eligible'
        AND b.status NOT IN ('cancelled', 'pending', 'rejected', 'draft')
        AND b.bill_date >= ${from} AND b.bill_date <= ${to}
    `;
    const bills = billRows.map((b) => ({
      id: b.id,
      billNumber: b.bill_number,
      vendorName: b.vendor_name,
      vendorGstin: b.vendor_gstin || "",
      supplierInvNo: b.reference_number || "",
      tax: b.is_rcm ? parseFloat(b.rcm_tax_amount || 0) : parseFloat(b.tax || 0),
      billDate: b.bill_date,
    }));

    const result = reconcile2b(bills, portal);
    return Response.json({ period: { from, to }, ...result });
  } catch (error) {
    if (error.message === "UNAUTHORIZED") return Response.json({ error: "Unauthorized" }, { status: 401 });
    return Response.json({ error: "Reconciliation failed — check the file is a valid GSTR-2B JSON. " + error.message }, { status: 500 });
  }
}
