import sql from "@/app/api/utils/sql";
import { requireAuth, requireAdmin, logAudit } from "@/app/api/utils/auth";
import { ensureFolderTable } from "@/app/api/document-folders/route";

export async function PUT(request, { params }) {
  try {
    const user = await requireAuth(request);
    await ensureFolderTable();
    const { id } = params;

    const rows = await sql`SELECT * FROM document_folders WHERE id = ${parseInt(id)} LIMIT 1`;
    if (!rows.length) return Response.json({ error: "Folder not found" }, { status: 404 });

    // Client folders take their name from the customer record — rename the client instead.
    if (rows[0].customer_id != null) {
      return Response.json(
        { error: "Client folders are named after the client. Rename the client instead." },
        { status: 400 },
      );
    }

    const { name } = await request.json();
    if (!name?.trim()) return Response.json({ error: "Folder name is required" }, { status: 400 });

    const result = await sql`
      UPDATE document_folders
      SET name = ${name.trim()}, updated_at = NOW()
      WHERE id = ${parseInt(id)}
      RETURNING *
    `;

    await logAudit({
      userId: user.id,
      action: "update",
      entityType: "document_folder",
      entityId: parseInt(id),
      metadata: { from: rows[0].name, to: name.trim() },
      request,
    });

    return Response.json({ id: result[0].id, name: result[0].name });
  } catch (error) {
    if (error.message === "UNAUTHORIZED") return Response.json({ error: "Unauthorized" }, { status: 401 });
    console.error("PUT /api/document-folders/[id] error:", error);
    return Response.json({ error: error.code ? "Database error" : error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const user = await requireAdmin(request);
    await ensureFolderTable();
    const { id } = params;

    const rows = await sql`SELECT * FROM document_folders WHERE id = ${parseInt(id)} LIMIT 1`;
    if (!rows.length) return Response.json({ error: "Folder not found" }, { status: 404 });

    // A client's folder belongs to the client record, not to whoever is tidying up.
    if (rows[0].customer_id != null) {
      return Response.json(
        { error: "Client folders are removed with the client. Delete the client instead." },
        { status: 400 },
      );
    }

    const [{ count }] = await sql`
      SELECT COUNT(*) AS count FROM documents
      WHERE entity_type = 'folder' AND entity_id = ${parseInt(id)}
    `;
    if (parseInt(count) > 0) {
      return Response.json(
        { error: `Folder still holds ${count} file(s). Delete them first.` },
        { status: 400 },
      );
    }

    await sql`DELETE FROM document_folders WHERE id = ${parseInt(id)}`;

    await logAudit({
      userId: user.id,
      action: "delete",
      entityType: "document_folder",
      entityId: parseInt(id),
      metadata: { name: rows[0].name },
      request,
    });

    return Response.json({ success: true });
  } catch (error) {
    if (error.message === "UNAUTHORIZED") return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (error.message === "FORBIDDEN") {
      return Response.json({ error: "Only admins can delete folders" }, { status: 403 });
    }
    console.error("DELETE /api/document-folders/[id] error:", error);
    return Response.json({ error: error.code ? "Database error" : error.message }, { status: 500 });
  }
}
