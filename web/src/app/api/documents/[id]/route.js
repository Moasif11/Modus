import sql from "@/app/api/utils/sql";
import { requireAuth, logAudit } from "@/app/api/utils/auth";
import { deleteFromR2 } from "@/app/api/utils/r2";

export async function DELETE(request, { params }) {
  try {
    const user = await requireAuth(request);
    const { id } = params;

    // 1. Fetch document metadata to retrieve object key
    const docs = await sql`
      SELECT * FROM documents WHERE id = ${parseInt(id)}
    `;

    if (docs.length === 0) {
      return Response.json({ error: "Document not found" }, { status: 404 });
    }

    const doc = docs[0];

    // Company and client-folder documents are admin-managed (matches the UI, which
    // only offers Delete to admins).
    if (
      (doc.entity_type === "company" || doc.entity_type === "folder") &&
      user.role !== "admin" && user.role !== "superadmin"
    ) {
      return Response.json({ error: "Only admins can delete these documents" }, { status: 403 });
    }

    // 2. Delete the file object from Cloudflare R2
    if (doc.object_key) {
      try {
        await deleteFromR2(doc.object_key);
      } catch (cleanupErr) {
        console.warn("Could not clean up document from R2 during delete:", cleanupErr.message);
      }
    }

    // 3. Delete the database record
    await sql`
      DELETE FROM documents WHERE id = ${parseInt(id)}
    `;

    // 4. Log audit trail
    await logAudit({
      userId: user.id,
      action: "delete_document",
      entityType: doc.entity_type,
      entityId: doc.entity_id,
      metadata: { documentName: doc.document_name, documentType: doc.document_type },
      request,
    });

    return Response.json({ success: true, message: "Document deleted successfully" });
  } catch (error) {
    if (error.message === "UNAUTHORIZED") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("DELETE /api/documents/[id] error:", error);
    return Response.json({ error: error.code ? "Database error" : error.message }, { status: 500 });
  }
}
