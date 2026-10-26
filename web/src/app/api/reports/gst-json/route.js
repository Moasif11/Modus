import sql from "@/app/api/utils/sql";
import { requireAuth } from "@/app/api/utils/auth";
import { buildGstr1, buildGstr3b } from "@/app/api/utils/reportData";
import { toGstr1Json, toGstr3bJson, fpFromDate } from "@/app/api/utils/gstPortalJson";

// Government offline-utility JSON for GSTR-1 / GSTR-3B upload.
export async function GET(request) {
  try {
    await requireAuth(request);
    const url = new URL(request.url);
    const type = url.searchParams.get("type") || "gstr1";
    const from = url.searchParams.get("from") || "";
    const to = url.searchParams.get("to") || "";
    if (!from || !to) return Response.json({ error: "from and to dates required" }, { status: 400 });

    const cs = (await sql`SELECT gstin FROM company_settings ORDER BY id ASC LIMIT 1`)[0];
    const gstin = cs?.gstin || "";
    if (!gstin) return Response.json({ error: "Set your company GSTIN in Settings before exporting a return." }, { status: 400 });

    let json, filename;
    if (type === "gstr3b") {
      json = toGstr3bJson(await buildGstr3b(from, to), gstin, to);
      filename = `GSTR3B_${gstin}_${fpFromDate(to)}.json`;
    } else {
      json = toGstr1Json(await buildGstr1(from, to), gstin, to);
      filename = `GSTR1_${gstin}_${fpFromDate(to)}.json`;
    }

    return new Response(JSON.stringify(json, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    if (error.message === "UNAUTHORIZED") return Response.json({ error: "Unauthorized" }, { status: 401 });
    return Response.json({ error: error.code ? "Database error" : error.message }, { status: 500 });
  }
}
