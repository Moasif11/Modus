import { requireAuth } from "@/app/api/utils/auth";
import { getNextCreditNoteNumber } from "@/app/api/utils/refundSchema";

export async function GET(request) {
  try {
    await requireAuth(request);
    const number = await getNextCreditNoteNumber();
    return Response.json({ number });
  } catch (error) {
    if (error.message === "UNAUTHORIZED") return Response.json({ error: "Unauthorized" }, { status: 401 });
    return Response.json({ error: "Failed to compute next credit note number" }, { status: 500 });
  }
}
