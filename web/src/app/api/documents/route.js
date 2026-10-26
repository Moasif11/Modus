import sql from "@/app/api/utils/sql";
import { requireAuth, logAudit } from "@/app/api/utils/auth";
import { getSignedR2Url } from "@/app/api/utils/r2";

async function ensureDocumentsTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS documents (
      id            SERIAL PRIMARY KEY,
      entity_type   VARCHAR(50) NOT NULL, -- 'project', 'invoice', 'bill', etc.
      entity_id     INTEGER NOT NULL,
      document_type VARCHAR(50) NOT NULL, -- 'contract', 'quotation', 'purchase_order', 'attachment', etc.
      document_name VARCHAR(255) NOT NULL,
      document_url  TEXT NOT NULL,
      object_key    TEXT NOT NULL,
      created_by    INTEGER,
      created_at    TIMESTAMPTZ DEFAULT NOW(),
      updated_at    TIMESTAMPTZ DEFAULT NOW()
    );
  `;
}

function mapDocument(d) {
  return {
    id: d.id,
    entityType: d.entity_type,
    entityId: d.entity_id,
    documentType: d.document_type,
    documentName: d.document_name,
    documentUrl: d.document_url,
    objectKey: d.object_key,
    createdBy: d.created_by,
    createdAt: d.created_at,
    updatedAt: d.updated_at,
  };
}

export async function GET(request) {
  try {
    await requireAuth(request);
    await ensureDocumentsTable();

    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get("entityType") || "";
    const entityId = searchParams.get("entityId") || "";

    if (!entityType || !entityId) {
      return Response.json({ error: "entityType and entityId are required" }, { status: 400 });
    }

    const documents = await sql`
      SELECT * FROM documents
      WHERE entity_type = ${entityType}
        AND entity_id = ${parseInt(entityId)}
      ORDER BY created_at DESC
    `;

    // Serve time-limited signed URLs (10 min) instead of permanent public links —
    // keeps working after the bucket goes private. Falls back to the stored URL.
    const mapped = await Promise.all(
      documents.map(async (d) => {
        const doc = mapDocument(d);
        if (d.object_key) {
          try { doc.documentUrl = await getSignedR2Url(d.object_key); } catch {}
        }
        return doc;
      }),
    );

    return Response.json({ documents: mapped });
  } catch (error) {
    if (error.message === "UNAUTHORIZED") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("GET /api/documents error:", error);
    return Response.json({ error: error.code ? "Database error" : error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const user = await requireAuth(request);
    await ensureDocumentsTable();

    const body = await request.json();
    const {
      entityType,
      entityId,
      documentType = "attachment",
      documentName,
      documentUrl,
      objectKey,
    } = body;

    if (!entityType || !entityId) {
      return Response.json({ error: "entityType and entityId are required" }, { status: 400 });
    }
    // Company-level documents (registration, tax, banking…) are admin-managed.
    if (entityType === "company" && user.role !== "admin" && user.role !== "superadmin") {
      return Response.json({ error: "Only admins can upload company documents" }, { status: 403 });
    }
    if (!documentName?.trim()) {
      return Response.json({ error: "Document name is required" }, { status: 400 });
    }
    if (!documentUrl || !objectKey) {
      return Response.json({ error: "File upload is required" }, { status: 400 });
    }

    const result = await sql`
      INSERT INTO documents 
        (entity_type, entity_id, document_type, document_name, document_url, object_key, created_by)
      VALUES 
        (${entityType}, ${parseInt(entityId)}, ${documentType}, ${documentName.trim()}, ${documentUrl}, ${objectKey}, ${user.id})
      RETURNING *
    `;

    const doc = result[0];

    await logAudit({
      userId: user.id,
      action: "create_document",
      entityType,
      entityId: parseInt(entityId),
      metadata: { documentName, documentType, docId: doc.id },
      request,
    });

    return Response.json(mapDocument(doc), { status: 201 });
  } catch (error) {
    if (error.message === "UNAUTHORIZED") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("POST /api/documents error:", error);
    return Response.json({ error: error.code ? "Database error" : error.message }, { status: 500 });
  }
}
