import sql from "@/app/api/utils/sql";
import { requireAuth } from "@/app/api/utils/auth";
import { ensureNotificationsTable } from "@/app/api/utils/notify";

export async function GET(request) {
  try {
    const user = await requireAuth(request);
    await ensureNotificationsTable();

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "30", 10), 100);

    const rows = await sql`
      SELECT id, type, title, body, link, related_id, is_read, created_at
      FROM notifications
      WHERE user_id = ${user.id}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;

    const [{ count }] = await sql`
      SELECT COUNT(*)::int AS count FROM notifications
      WHERE user_id = ${user.id} AND is_read = false
    `;

    return Response.json({
      notifications: rows.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.body,
        link: n.link,
        relatedId: n.related_id,
        isRead: n.is_read,
        createdAt: n.created_at,
      })),
      unreadCount: count,
    });
  } catch (error) {
    if (error.message === "UNAUTHORIZED") return Response.json({ error: "Unauthorized" }, { status: 401 });
    console.error("GET /api/notifications error:", error);
    return Response.json({ error: error.code ? "Database error" : error.message }, { status: 500 });
  }
}

// Mark notifications read. Body: { id } for one, or {} / { all: true } for all.
export async function POST(request) {
  try {
    const user = await requireAuth(request);
    await ensureNotificationsTable();
    const body = await request.json().catch(() => ({}));

    if (body.id) {
      await sql`UPDATE notifications SET is_read = true WHERE id = ${body.id} AND user_id = ${user.id}`;
    } else {
      await sql`UPDATE notifications SET is_read = true WHERE user_id = ${user.id} AND is_read = false`;
    }

    return Response.json({ success: true });
  } catch (error) {
    if (error.message === "UNAUTHORIZED") return Response.json({ error: "Unauthorized" }, { status: 401 });
    console.error("POST /api/notifications error:", error);
    return Response.json({ error: error.code ? "Database error" : error.message }, { status: 500 });
  }
}
