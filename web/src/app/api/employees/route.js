import sql from "@/app/api/utils/sql";
import { requireAuth, logAudit } from "@/app/api/utils/auth";

// Auto-create employees table if missing
async function ensureEmployeesTable() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS employees (
        id BIGSERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        designation VARCHAR(100),
        department VARCHAR(100),
        email VARCHAR(255),
        phone VARCHAR(30),
        employee_id VARCHAR(50),
        pan VARCHAR(15),
        join_date DATE,
        salary_amount DECIMAL(12,2),
        salary_frequency VARCHAR(20) DEFAULT 'monthly',
        bank_name VARCHAR(100),
        bank_account VARCHAR(50),
        bank_ifsc VARCHAR(20),
        status VARCHAR(20) DEFAULT 'active',
        notes TEXT,
        is_archived BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;
  } catch (_) {}
}

function mapEmployee(e) {
  return {
    id: e.id,
    name: e.name,
    designation: e.designation,
    department: e.department,
    email: e.email,
    phone: e.phone,
    employeeId: e.employee_id,
    pan: e.pan,
    joinDate: e.join_date,
    salaryAmount: e.salary_amount ? parseFloat(e.salary_amount) : null,
    salaryFrequency: e.salary_frequency || "monthly",
    bankName: e.bank_name,
    bankAccount: e.bank_account,
    bankIfsc: e.bank_ifsc,
    status: e.status || "active",
    notes: e.notes,
    imageUrl: e.image_url || null,
    createdAt: e.created_at,
    updatedAt: e.updated_at,
  };
}

export async function GET(request) {
  try {
    await requireAuth(request);
    await ensureEmployeesTable();

    const url = new URL(request.url);
    const search = url.searchParams.get("search") || "";
    const status = url.searchParams.get("status") || "";
    const limit = parseInt(url.searchParams.get("limit") || "100");
    const offset = parseInt(url.searchParams.get("offset") || "0");

    const conditions = ["e.is_archived = false"];
    const params = [];
    let idx = 1;

    if (search) {
      conditions.push(`(
        LOWER(e.name) LIKE LOWER($${idx})
        OR LOWER(e.email) LIKE LOWER($${idx})
        OR LOWER(e.designation) LIKE LOWER($${idx})
        OR LOWER(e.department) LIKE LOWER($${idx})
        OR LOWER(e.employee_id) LIKE LOWER($${idx})
      )`);
      params.push(`%${search}%`);
      idx++;
    }
    if (status) {
      conditions.push(`e.status = $${idx}`);
      params.push(status);
      idx++;
    }

    const where = conditions.join(" AND ");
    params.push(limit);
    params.push(offset);

    const employees = await sql(
      `SELECT e.* FROM employees e
       WHERE ${where}
       ORDER BY e.created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      params
    );

    const countResult = await sql(
      `SELECT COUNT(*) as count FROM employees e WHERE ${where}`,
      params.slice(0, -2)
    );

    return Response.json({
      employees: employees.map(mapEmployee),
      total: parseInt(countResult[0].count),
      limit,
      offset,
    });
  } catch (error) {
    if (error.message === "UNAUTHORIZED") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Get employees error:", error);
    return Response.json(
      { error: "Failed to get employees" },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const user = await requireAuth(request);
    await ensureEmployeesTable();
    const body = await request.json();

    const {
      name, designation, department, email, phone, employeeId, pan,
      joinDate, salaryAmount, salaryFrequency,
      bankName, bankAccount, bankIfsc, status, notes, imageUrl,
    } = body;

    if (!name) {
      return Response.json({ error: "Name is required" }, { status: 400 });
    }

    const result = await sql`
      INSERT INTO employees (
        name, designation, department, email, phone, employee_id, pan,
        join_date, salary_amount, salary_frequency,
        bank_name, bank_account, bank_ifsc, status, notes, image_url
      )
      VALUES (
        ${name}, ${designation || null}, ${department || null},
        ${email || null}, ${phone || null}, ${employeeId || null}, ${pan || null},
        ${joinDate || null}, ${salaryAmount || null}, ${salaryFrequency || "monthly"},
        ${bankName || null}, ${bankAccount || null}, ${bankIfsc || null},
        ${status || "active"}, ${notes || null}, ${imageUrl || null}
      )
      RETURNING *
    `;

    const employee = result[0];

    await logAudit({
      userId: user.id,
      action: "create",
      entityType: "employee",
      entityId: employee.id,
      metadata: { name: employee.name },
      request,
    });

    return Response.json(mapEmployee(employee));
  } catch (error) {
    if (error.message === "UNAUTHORIZED") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Create employee error:", error);
    return Response.json(
      { error: "Failed to create employee" },
      { status: 500 }
    );
  }
}
