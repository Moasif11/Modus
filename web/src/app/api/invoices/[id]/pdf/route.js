import { requireAuth } from "@/app/api/utils/auth";
import { getInvoicePdfBuffer } from "@/app/api/invoices/[id]/send/route";

// GET /api/invoices/:id/pdf — returns the A4 invoice PDF (Puppeteer-rendered),
// the same document that gets attached to the email. Used by the "PDF" button.
export async function GET(request, { params }) {
  try {
    await requireAuth(request);
    const { id } = await params;

    const result = await getInvoicePdfBuffer(id);
    if (!result) return Response.json({ error: "Invoice not found" }, { status: 404 });

    return new Response(result.buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Invoice-${result.invoiceNumber || id}.pdf"`,
      },
    });
  } catch (error) {
    if (error.message === "UNAUTHORIZED") return Response.json({ error: "Unauthorized" }, { status: 401 });
    console.error("Invoice PDF error:", error);
    return Response.json({ error: "PDF generation failed" }, { status: 500 });
  }
}
