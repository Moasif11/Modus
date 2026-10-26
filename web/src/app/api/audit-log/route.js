import sql from "@/app/api/utils/sql";
import { requireAuth } from "@/app/api/utils/auth";
import { ensureChangeLog } from "@/app/api/utils/auditLog";

// Read-only view of the immutable edit log (Companies Act Rule 11(g)).
export async function GET(request) {
  try {
    await requireAuth(request);
    await ensureChangeLog();
    const url = new URL(request.url);
    const entityType = url.searchParams.get("entityType") || "";
    const entityId = url.searchParams.get("entityId") || "";
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "200", 10), 500);

    const rows = (entityType && entityId)
      ? await sql`SELECT * FROM change_log WHERE entity_type = ${entityType} AND entity_id = ${parseInt(entityId)} ORDER BY changed_at DESC LIMIT ${limit}`
      : entityType
        ? await sql`SELECT * FROM change_log WHERE entity_type = ${entityType} ORDER BY changed_at DESC LIMIT ${limit}`
        : await sql`SELECT * FROM change_log ORDER BY changed_at DESC LIMIT ${limit}`;

    return Response.json({
      entries: rows.map((r) => ({
        id: r.id,
        entityType: r.entity_type,
        entityId: r.entity_id,
        action: r.action,
        changes: r.changes,
        changedBy: r.changed_by,
        changedByName: r.changed_by_name || "—",
        changedAt: r.changed_at,
        ip: r.ip,
      })),
    });
  } catch (error) {
    if (error.message === "UNAUTHORIZED") return Response.json({ error: "Unauthorized" }, { status: 401 });
    return Response.json({ error: error.code ? "Database error" : error.message }, { status: 500 });
  }
}
