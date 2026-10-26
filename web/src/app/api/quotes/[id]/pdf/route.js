import sql from "@/app/api/utils/sql";
import { requireAuth } from "@/app/api/utils/auth";
import { generateInvoicePDF } from "@/app/api/invoices/[id]/send/route";

// GET /api/quotes/:id/pdf — returns the A4 quotation PDF (Puppeteer-rendered),
// the same renderer the invoice PDF uses. Used by the "PDF" button.
export async function GET(request, { params }) {
  try {
    await requireAuth(request);
    const { id } = await params;

    const rows = await sql`
      SELECT
        q.*,
        c.name AS customer_name, c.company_name AS customer_company_name,
        c.email AS customer_email, c.gstin AS customer_gstin,
        c.billing_address AS customer_billing_address,
        c.city AS customer_city, c.state AS customer_state,
        c.pincode AS customer_pincode, c.country AS customer_country,
        c.phone AS customer_phone, c.pan AS customer_pan,
        cs.legal_name AS company_legal_name, cs.email AS company_email,
        cs.gstin AS company_gstin, cs.logo_url AS company_logo_url,
        cs.logo_dark_url AS company_logo_dark_url, cs.website AS company_website,
        cs.address_line1 AS company_address_line1, cs.address_line2 AS company_address_line2,
        cs.city AS company_city, cs.state AS company_state, cs.pincode AS company_pincode,
        cs.phone AS company_phone, cs.pan AS company_pan,
        cs.bank_name AS company_bank_name, cs.account_number AS company_account_number,
        cs.account_holder_name AS company_account_holder_name, cs.ifsc AS company_ifsc,
        cs.upi_id AS company_upi_id, cs.signature_url AS company_signature_url
      FROM quotes q
      LEFT JOIN customers c ON q.customer_id = c.id
      LEFT JOIN company_settings cs ON cs.id = 1
      WHERE q.id = ${id}
    `;
    if (!rows.length) return Response.json({ error: "Quote not found" }, { status: 404 });

    const items = await sql`SELECT * FROM quote_items WHERE quote_id = ${id} ORDER BY position`;
    const buffer = await generateInvoicePDF(rows[0], items, "quote");

    return new Response(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Quotation-${rows[0].quote_number || id}.pdf"`,
      },
    });
  } catch (error) {
    if (error.message === "UNAUTHORIZED") return Response.json({ error: "Unauthorized" }, { status: 401 });
    console.error("Quote PDF error:", error);
    return Response.json({ error: "PDF generation failed" }, { status: 500 });
  }
}
