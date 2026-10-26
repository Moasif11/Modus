import sql from "@/app/api/utils/sql";
import { requireAuth } from "@/app/api/utils/auth";

export async function GET(request) {
  try {
    await requireAuth(request);

    const settings = await sql`
      SELECT quote_prefix, next_quote_number FROM company_settings LIMIT 1
    `;

    if (settings.length === 0) {
      return Response.json(
        { error: "Company settings not found" },
        { status: 404 },
      );
    }

    const { quote_prefix, next_quote_number } = settings[0];
    const quoteNumber = `${quote_prefix}-${String(next_quote_number).padStart(5, "0")}`;

    return Response.json({
      quoteNumber,
      prefix: quote_prefix,
      number: next_quote_number,
    });
  } catch (error) {
    if (error.message === "UNAUTHORIZED") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Get next quote number error:", error);
    return Response.json(
      { error: "Failed to get next quote number" },
      { status: 500 },
    );
  }
}
