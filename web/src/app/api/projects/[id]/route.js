import sql from "@/app/api/utils/sql";
import { requireAuth, requireAdmin, logAudit } from "@/app/api/utils/auth";

async function ensureProjectsTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS projects (
      id BIGSERIAL PRIMARY KEY, name VARCHAR(500) NOT NULL,
      client_id INTEGER, status VARCHAR(30) NOT NULL DEFAULT 'active',
      start_date DATE, end_date DATE, budget NUMERIC(14,2) DEFAULT 0,
      notes TEXT, created_by INTEGER,
      created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS project_id INTEGER`;
  await sql`ALTER TABLE bills ADD COLUMN IF NOT EXISTS project_id INTEGER`;
}

// ── GET /api/projects/:id  ────────────────────────────────────────────────────
export async function GET(request, { params }) {
  try {
    await requireAuth(request);
    await ensureProjectsTables();
    const { id } = await params;

    const [p] = await sql`
      SELECT p.*, c.name AS client_name, c.email AS client_email, c.phone AS client_phone
      FROM projects p
      LEFT JOIN customers c ON c.id = p.client_id
      WHERE p.id = ${id}
    `;
    if (!p) return Response.json({ error: "Not found" }, { status: 404 });

    // ── Linked Invoices (AR) ─────────────────────────────────────────────────
    const invoices = await sql`
      SELECT
        i.id, i.invoice_number, i.invoice_date, i.due_date,
        i.grand_total, i.total_paid, i.status,
        (i.grand_total - COALESCE(i.total_paid, 0)) AS balance_due,
        c.name AS customer_name
      FROM invoices i
      LEFT JOIN customers c ON c.id = i.customer_id
      WHERE i.project_id = ${id} AND i.is_archived = false AND i.status != 'draft'
      ORDER BY i.invoice_date DESC
    `;

    // ── Linked Bills (AP) ────────────────────────────────────────────────────
    const bills = await sql`
      SELECT
        b.id, b.bill_number, b.title, b.category, b.bill_date, b.due_date,
        b.amount, b.amount_paid, b.status, COALESCE(b.tds_amount, 0) AS tds_amount,
        (b.amount - COALESCE(b.tds_amount, 0) - b.amount_paid) AS balance_due,
        v.name AS vendor_name,
        e.name AS employee_name
      FROM bills b
      LEFT JOIN vendors v ON v.id = b.vendor_id
      LEFT JOIN employees e ON e.id = b.employee_id
      WHERE b.project_id = ${id}
      ORDER BY b.bill_date DESC
    `;

    // ── Aggregate Financials ─────────────────────────────────────────────────
    const totalInvoiced   = invoices.reduce((s, i) => s + (parseFloat(i.grand_total) || 0), 0);
    const totalReceived   = invoices.reduce((s, i) => s + (parseFloat(i.total_paid)  || 0), 0);
    const totalExpenses   = bills.reduce((s, b)   => s + (parseFloat(b.amount)       || 0), 0);
    const totalPaidOut    = bills.reduce((s, b)   => s + (parseFloat(b.amount_paid)  || 0), 0);
    const totalTdsWithheld= bills.reduce((s, b)   => s + (parseFloat(b.tds_amount)   || 0), 0);
    const outstandingAR   = totalInvoiced - totalReceived;
    // Cash still owed vendors = gross expense − TDS withheld (remitted to govt) − cash paid.
    const outstandingAP   = totalExpenses - totalTdsWithheld - totalPaidOut;
    const netProfit       = totalReceived - totalExpenses;
    const budget          = parseFloat(p.budget) || 0;
    const budgetUsed      = budget > 0 ? Math.round((totalExpenses / budget) * 100) : 0;

    // ── Recent Activity timeline ─────────────────────────────────────────────
    const activity = [
      ...invoices.map((i) => ({
        type: "invoice",
        id: i.id,
        date: i.invoice_date,
        label: `Invoice ${i.invoice_number}`,
        amount: parseFloat(i.grand_total) || 0,
        status: i.status,
        entity: i.customer_name,
      })),
      ...bills.map((b) => ({
        type: "bill",
        id: b.id,
        date: b.bill_date,
        label: b.title,
        amount: parseFloat(b.amount) || 0,
        status: b.status,
        entity: b.vendor_name || b.employee_name || "—",
        category: b.category,
      })),
    ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 30);

    return Response.json({
      project: {
        id: p.id,
        name: p.name,
        status: p.status,
        startDate: p.start_date,
        endDate: p.end_date,
        budget,
        notes: p.notes,
        createdAt: p.created_at,
        clientId: p.client_id,
        clientName: p.client_name,
        clientEmail: p.client_email,
        clientPhone: p.client_phone,
      },
      financials: {
        totalInvoiced, totalReceived, totalExpenses, totalPaidOut,
        outstandingAR, outstandingAP, netProfit, budget, budgetUsed,
      },
      invoices: invoices.map((i) => ({
        id: i.id,
        invoiceNumber: i.invoice_number,
        invoiceDate: i.invoice_date,
        dueDate: i.due_date,
        grandTotal: parseFloat(i.grand_total) || 0,
        totalPaid: parseFloat(i.total_paid) || 0,
        balanceDue: parseFloat(i.balance_due) || 0,
        status: i.status,
        customerName: i.customer_name,
      })),
      bills: bills.map((b) => ({
        id: b.id,
        billNumber: b.bill_number,
        title: b.title,
        category: b.category,
        billDate: b.bill_date,
        amount: parseFloat(b.amount) || 0,
        amountPaid: parseFloat(b.amount_paid) || 0,
        balanceDue: parseFloat(b.balance_due) || 0,
        status: b.status,
        vendorName: b.vendor_name,
        employeeName: b.employee_name,
      })),
      activity,
    });
  } catch (err) {
    console.error("GET /api/projects/:id error:", err);
    return Response.json({ error: err.code ? "Database error" : err.message }, { status: 500 });
  }
}

// ── PUT /api/projects/:id ─────────────────────────────────────────────────────
export async function PUT(request, { params }) {
  try {
    const user = await requireAuth(request);
    await ensureProjectsTables();
    const { id } = await params;
    const { name, clientId, status, startDate, endDate, budget, notes } = await request.json();

    await sql`
      UPDATE projects SET
        name       = COALESCE(${name?.trim() || null}, name),
        client_id  = ${clientId !== undefined ? (clientId || null) : sql`client_id`},
        status     = COALESCE(${status || null}, status),
        start_date = ${startDate !== undefined ? (startDate || null) : sql`start_date`},
        end_date   = ${endDate !== undefined ? (endDate || null) : sql`end_date`},
        budget     = ${budget !== undefined ? (parseFloat(budget) || 0) : sql`budget`},
        notes      = ${notes !== undefined ? (notes || null) : sql`notes`},
        updated_at = NOW()
      WHERE id = ${id}
    `;

    await logAudit({ userId: user.id, action: "project_updated", entityType: "project", entityId: parseInt(id), metadata: { name }, request });
    return Response.json({ ok: true });
  } catch (err) {
    if (err.message === "UNAUTHORIZED") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("PUT /api/projects/:id error:", err);
    return Response.json({ error: "Failed to update project" }, { status: 500 });
  }
}

// ── DELETE /api/projects/:id ──────────────────────────────────────────────────
export async function DELETE(request, { params }) {
  try {
    const user = await requireAdmin(request);
    const { id } = await params;
    // Unlink invoices/bills first — project deletion must not orphan FK references.
    await sql`UPDATE invoices SET project_id = NULL WHERE project_id = ${id}`;
    await sql`UPDATE bills SET project_id = NULL WHERE project_id = ${id}`;
    await sql`DELETE FROM projects WHERE id = ${id}`;
    await logAudit({ userId: user.id, action: "project_deleted", entityType: "project", entityId: parseInt(id), metadata: {}, request });
    return Response.json({ ok: true });
  } catch (err) {
    if (err.message === "UNAUTHORIZED") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err.message === "FORBIDDEN") {
      return Response.json({ error: "Only admins can delete projects" }, { status: 403 });
    }
    console.error("DELETE /api/projects/:id error:", err);
    return Response.json({ error: "Failed to delete project" }, { status: 500 });
  }
}
