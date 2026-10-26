import { requireAuth } from "@/app/api/utils/auth";
import { buildGstSummary, buildGstr1, buildGstr3b, buildHsn, buildProfitLoss, buildTds } from "@/app/api/utils/reportData";

export async function GET(request) {
  try {
    await requireAuth(request);
    const url = new URL(request.url);
    const from = url.searchParams.get("from") || "";
    const to = url.searchParams.get("to") || "";
    const type = url.searchParams.get("type") || "gstr1"; // summary | gstr1 | gstr3b | hsn | pnl

    if (!from || !to) {
      return Response.json({ error: "from and to dates required" }, { status: 400 });
    }

    if (type === "summary") return Response.json(await buildGstSummary(from, to));
    if (type === "gstr3b")  return Response.json(await buildGstr3b(from, to));
    if (type === "hsn")     return Response.json({ hsn: await buildHsn(from, to) });
    if (type === "pnl")     return Response.json(await buildProfitLoss(from, to));
    if (type === "tds")     return Response.json(await buildTds(from, to));

    return Response.json(await buildGstr1(from, to));
  } catch (error) {
    if (error.message === "UNAUTHORIZED") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Reports error:", error);
    return Response.json({ error: "Failed to load report" }, { status: 500 });
  }
}
