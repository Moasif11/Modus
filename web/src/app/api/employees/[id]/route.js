import sql from "@/app/api/utils/sql";
import { requireAuth, requireAdmin, logAudit } from "@/app/api/utils/auth";

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

export async function GET(request, { params }) {
  try {
    await requireAuth(request);
    const { id } = params;

    const employees = await sql`
      SELECT * FROM employees WHERE id = ${id} AND is_archived = false LIMIT 1
    `;

    if (employees.length === 0) {
      return Response.json({ error: "Employee not found" }, { status: 404 });
    }

    return Response.json(mapEmployee(employees[0]));
  } catch (error) {
    if (error.message === "UNAUTHORIZED") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    return Response.json(
      { error: "Failed to get employee" },
      { status: 500 }
    );
  }
}

export async function PUT(request, { params }) {
  try {
    const user = await requireAuth(request);
    const { id } = params;
    const body = await request.json();

    const {
      name, designation, department, email, phone, employeeId, pan,
      joinDate, salaryAmount, salaryFrequency,
      bankName, bankAccount, bankIfsc, status, notes, imageUrl,
    } = body;

    const updates = [];
    const values = [];
    let paramIndex = 1;

    const fields = {
      name, designation, department, email, phone,
      employee_id: employeeId, pan, join_date: joinDate,
      salary_amount: salaryAmount, salary_frequency: salaryFrequency,
      bank_name: bankName, bank_account: bankAccount, bank_ifsc: bankIfsc,
      status, notes, image_url: imageUrl,
    };

    for (const [col, val] of Object.entries(fields)) {
      if (val !== undefined) {
        updates.push(`${col} = $${paramIndex++}`);
        values.push(val === "" ? null : val);
      }
    }

    updates.push(`updated_at = NOW()`);

    if (updates.length === 1) {
      return Response.json({ error: "No fields to update" }, { status: 400 });
    }

    values.push(id);
    const query = `UPDATE employees SET ${updates.join(", ")} WHERE id = $${paramIndex} AND is_archived = false RETURNING *`;
    const result = await sql(query, values);

    if (result.length === 0) {
      return Response.json({ error: "Employee not found" }, { status: 404 });
    }

    await logAudit({
      userId: user.id,
      action: "update",
      entityType: "employee",
      entityId: result[0].id,
      metadata: { name: result[0].name },
      request,
    });

    return Response.json(mapEmployee(result[0]));
  } catch (error) {
    if (error.message === "UNAUTHORIZED") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    return Response.json(
      { error: "Failed to update employee" },
      { status: 500 }
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    const user = await requireAdmin(request);
    const { id } = params;

    await sql`
      UPDATE employees SET is_archived = true, updated_at = NOW() WHERE id = ${id}
    `;

    await logAudit({
      userId: user.id,
      action: "delete",
      entityType: "employee",
      entityId: parseInt(id),
      metadata: {},
      request,
    });

    return Response.json({ message: "Employee deleted successfully" });
  } catch (error) {
    if (error.message === "UNAUTHORIZED") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error.message === "FORBIDDEN") {
      return Response.json({ error: "Only admins can delete employees" }, { status: 403 });
    }
    console.error("Delete employee error:", error);
    return Response.json(
      { error: "Failed to delete employee" },
      { status: 500 }
    );
  }
}
