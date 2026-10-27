import sql from "@/app/api/utils/sql";

export async function GET() {
  try {
    const rows = await sql`
      SELECT legal_name, trade_name, logo_url, logo_dark_url,
             brand_color, brand_color_dark, app_name, tagline, favicon_url
      FROM company_settings
      ORDER BY id ASC
      LIMIT 1
    `;

    if (rows.length === 0) {
      return Response.json({
        appName: "MODUS ERP",
        legalName: "Modus Technologies",
        tradeName: "Modus",
        logoUrl: null,
        logoDarkUrl: null,
        brandColor: "#E11D2C",
        brandColorDark: "#991B1B",
        tagline: "Open Source Studio Management & GST Invoicing",
        faviconUrl: null,
      });
    }

    const s = rows[0];
    return Response.json({
      appName: s.app_name || "MODUS ERP",
      legalName: s.legal_name || "Modus Technologies",
      tradeName: s.trade_name || "Modus",
      logoUrl: s.logo_url || null,
      logoDarkUrl: s.logo_dark_url || null,
      brandColor: s.brand_color || "#E11D2C",
      brandColorDark: s.brand_color_dark || "#991B1B",
      tagline: s.tagline || "Open Source Studio Management & GST Invoicing",
      faviconUrl: s.favicon_url || null,
    });
  } catch (error) {
    console.error("Public branding error:", error);
    return Response.json({
      appName: "MODUS ERP",
      legalName: "Modus Technologies",
      tradeName: "Modus",
      logoUrl: null,
      logoDarkUrl: null,
      brandColor: "#E11D2C",
      brandColorDark: "#991B1B",
      tagline: "Open Source Studio Management & GST Invoicing",
      faviconUrl: null,
    });
  }
}
