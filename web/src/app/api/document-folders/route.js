import sql from "@/app/api/utils/sql";
import { requireAuth, logAudit } from "@/app/api/utils/auth";

// Folders for client paperwork. Files themselves live in the existing `documents`
// table under entity_type = 'folder', entity_id = <folder id>, so the upload /
// view / download / delete routes are reused as-is.
export async function ensureFolderTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS document_folders (
      id          SERIAL PRIMARY KEY,
      name        VARCHAR(255) NOT NULL,
      customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
      created_by  INTEGER,
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      updated_at  TIMESTAMPTZ DEFAULT NOW()
    );
  `;
  // One folder per customer; manual folders (customer_id NULL) are unconstrained.
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS document_folders_customer_unique
    ON document_folders (customer_id) WHERE customer_id IS NOT NULL
  `;
}

// Give every customer a folder — covers clients added before this feature existed
// and any customer whose folder creation failed at signup time.
export async function syncCustomerFolders(userId = null) {
  await ensureFolderTable();
  await sql`
    INSERT INTO document_folders (name, customer_id, created_by)
    SELECT COALESCE(NULLIF(TRIM(c.company_name), ''), c.name), c.id, ${userId}
    FROM customers c
    WHERE c.is_archived = false
      AND NOT EXISTS (SELECT 1 FROM document_folders f WHERE f.customer_id = c.id)
  `;
}

function mapFolder(f) {
  return {
    id: f.id,
    name: f.name,
    customerId: f.customer_id,
    isClient: f.customer_id != null,
    fileCount: parseInt(f.file_count || 0),
    createdAt: f.created_at,
  };
}

export async function GET(request) {
  try {
    const user = await requireAuth(request);
    await syncCustomerFolders(user.id);

    const folders = await sql`
      SELECT f.*,
             COALESCE(c.company_name, c.name) AS customer_name,
             (SELECT COUNT(*) FROM documents d
               WHERE d.entity_type = 'folder' AND d.entity_id = f.id) AS file_count
      FROM document_folders f
      LEFT JOIN customers c ON c.id = f.customer_id
      -- Deleting a client only archives it, so hide its folder too. The row and
      -- its files survive, and come back if the client is ever restored.
      WHERE f.customer_id IS NULL OR c.is_archived = false
      ORDER BY (f.customer_id IS NULL) DESC, f.name ASC
    `;

    return Response.json({
      folders: folders.map((f) => ({
        ...mapFolder(f),
        name: f.customer_name || f.name,
      })),
    });
  } catch (error) {
    if (error.message === "UNAUTHORIZED") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("GET /api/document-folders error:", error);
    return Response.json({ error: error.code ? "Database error" : error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const user = await requireAuth(request);
    await ensureFolderTable();

    const { name } = await request.json();
    if (!name?.trim()) {
      return Response.json({ error: "Folder name is required" }, { status: 400 });
    }

    const existing = await sql`
      SELECT id FROM document_folders
      WHERE customer_id IS NULL AND LOWER(name) = LOWER(${name.trim()})
      LIMIT 1
    `;
    if (existing.length) {
      return Response.json({ error: "A folder with that name already exists" }, { status: 409 });
    }

    const result = await sql`
      INSERT INTO document_folders (name, customer_id, created_by)
      VALUES (${name.trim()}, NULL, ${user.id})
      RETURNING *
    `;

    await logAudit({
      userId: user.id,
      action: "create",
      entityType: "document_folder",
      entityId: result[0].id,
      metadata: { name: name.trim() },
      request,
    });

    return Response.json(mapFolder(result[0]), { status: 201 });
  } catch (error) {
    if (error.message === "UNAUTHORIZED") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("POST /api/document-folders error:", error);
    return Response.json({ error: error.code ? "Database error" : error.message }, { status: 500 });
  }
}
