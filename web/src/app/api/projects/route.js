import sql from "@/app/api/utils/sql";
import { requireAuth, logAudit } from "@/app/api/utils/auth";

async function ensureProjectsTables() {
  // Projects table
  await sql`
    CREATE TABLE IF NOT EXISTS projects (
      id            BIGSERIAL PRIMARY KEY,
      name          VARCHAR(500) NOT NULL,
      client_id     INTEGER REFERENCES customers(id) ON DELETE SET NULL,
      status        VARCHAR(30) NOT NULL DEFAULT 'active',
      start_date    DATE,
      end_date      DATE,
      budget        NUMERIC(14,2) DEFAULT 0,
      notes         TEXT,
      created_by    INTEGER,
      created_at    TIMESTAMPTZ DEFAULT NOW(),
      updated_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  // Add project_id to invoices (links AR invoices to a project)
  await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL`;
  // Add project_id to bills (links AP bills/expenses to a project)
  await sql`ALTER TABLE bills ADD COLUMN IF NOT EXISTS project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL`;
}

// ── GET /api/projects ─────────────────────────────────────────────────────────
export async function GET(request) {
  try {
    await requireAuth(request);
    await ensureProjectsTables();

    const url = new URL(request.url);
    const search  = url.searchParams.get("search")  || "";
    const status  = url.searchParams.get("status")  || "";

    const rows = await sql`
      SELECT
        p.id,
        p.name,
        p.status,
        p.start_date,
        p.end_date,
        p.budget,
        p.notes,
        p.created_at,
        c.name AS client_name,
        c.id   AS client_id,

        -- AR: total invoiced on this project
        COALESCE((
          SELECT SUM(i.grand_total)
          FROM invoices i
          WHERE i.project_id = p.id AND i.is_archived = false
        ), 0) AS total_invoiced,

        -- AR: total paid on this project
        COALESCE((
          SELECT SUM(py.amount)
          FROM invoices i
          JOIN payments py ON py.invoice_id = i.id
          WHERE i.project_id = p.id AND i.is_archived = false
        ), 0) AS total_received,

        -- AP: total billed (expenses) on this project
        COALESCE((
          SELECT SUM(b.amount)
          FROM bills b
          WHERE b.project_id = p.id
        ), 0) AS total_expenses,

        -- AP: total paid out on this project
        COALESCE((
          SELECT SUM(b.amount_paid)
          FROM bills b
          WHERE b.project_id = p.id
        ), 0) AS total_paid_out,

        -- AP: total TDS withheld (remitted to govt, not owed to vendor)
        COALESCE((
          SELECT SUM(COALESCE(b.tds_amount, 0))
          FROM bills b
          WHERE b.project_id = p.id
        ), 0) AS total_tds_withheld,

        -- Invoice count
        (SELECT COUNT(*) FROM invoices i WHERE i.project_id = p.id AND i.is_archived = false) AS invoice_count,
        -- Bill count
        (SELECT COUNT(*) FROM bills b WHERE b.project_id = p.id) AS bill_count

      FROM projects p
      LEFT JOIN customers c ON c.id = p.client_id
      WHERE
        (${search} = '' OR p.name ILIKE ${'%' + search + '%'} OR c.name ILIKE ${'%' + search + '%'})
        AND (${status} = '' OR p.status = ${status})
      ORDER BY p.created_at DESC
    `;

    const projects = rows.map((p) => ({
      id: p.id,
      name: p.name,
      status: p.status,
      startDate: p.start_date,
      endDate: p.end_date,
      budget: parseFloat(p.budget) || 0,
      notes: p.notes,
      createdAt: p.created_at,
      clientId: p.client_id,
      clientName: p.client_name,
      totalInvoiced: parseFloat(p.total_invoiced) || 0,
      totalReceived: parseFloat(p.total_received) || 0,
      totalExpenses: parseFloat(p.total_expenses) || 0,
      totalPaidOut: parseFloat(p.total_paid_out) || 0,
      invoiceCount: parseInt(p.invoice_count) || 0,
      billCount: parseInt(p.bill_count) || 0,
      // Derived
      outstandingReceivables: (parseFloat(p.total_invoiced) || 0) - (parseFloat(p.total_received) || 0),
      outstandingPayables: (parseFloat(p.total_expenses) || 0) - (parseFloat(p.total_tds_withheld) || 0) - (parseFloat(p.total_paid_out) || 0),
      netProfit: (parseFloat(p.total_received) || 0) - (parseFloat(p.total_expenses) || 0),
      budgetUsed: p.budget > 0
        ? Math.round(((parseFloat(p.total_expenses) || 0) / parseFloat(p.budget)) * 100)
        : 0,
    }));

    return Response.json({ projects });
  } catch (err) {
    console.error("GET /api/projects error:", err);
    return Response.json({ error: err.code ? "Database error" : err.message }, { status: 500 });
  }
}

// ── POST /api/projects ────────────────────────────────────────────────────────
export async function POST(request) {
  try {
    const user = await requireAuth(request);
    await ensureProjectsTables();

    const { name, clientId, status = "active", startDate, endDate, budget, notes } = await request.json();

    if (!name?.trim()) return Response.json({ error: "Project name is required" }, { status: 400 });

    const [row] = await sql`
      INSERT INTO projects (name, client_id, status, start_date, end_date, budget, notes, created_by)
      VALUES (
        ${name.trim()},
        ${clientId || null},
        ${status},
        ${startDate || null},
        ${endDate || null},
        ${parseFloat(budget) || 0},
        ${notes || null},
        ${user.id}
      )
      RETURNING id
    `;

    await logAudit(user.id, "project_created", "projects", row.id, { name });
    return Response.json({ id: row.id }, { status: 201 });
  } catch (err) {
    console.error("POST /api/projects error:", err);
    return Response.json({ error: err.code ? "Database error" : err.message }, { status: 500 });
  }
}
