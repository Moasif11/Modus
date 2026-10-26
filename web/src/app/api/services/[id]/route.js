import sql from "@/app/api/utils/sql";
import { requireAuth, requireAdmin, logAudit } from "@/app/api/utils/auth";

export async function GET(request, { params }) {
  try {
    await requireAuth(request);
    const { id } = params;

    const services = await sql`
      SELECT * FROM services WHERE id = ${id} LIMIT 1
    `;

    if (services.length === 0) {
      return Response.json({ error: "Service not found" }, { status: 404 });
    }

    const s = services[0];

    return Response.json({
      id: s.id,
      name: s.name,
      description: s.description,
      defaultPrice: parseFloat(s.default_price),
      gstRate: parseFloat(s.gst_rate),
      hsnSacCode: s.hsn_sac_code,
      createdAt: s.created_at,
      updatedAt: s.updated_at,
    });
  } catch (error) {
    if (error.message === "UNAUTHORIZED") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Get service error:", error);
    return Response.json(
      { error: "Failed to get service" },
      { status: 500 },
    );
  }
}

export async function PUT(request, { params }) {
  try {
    const user = await requireAuth(request);
    const { id } = params;
    const body = await request.json();

    const {
      name,
      description,
      defaultPrice,
      gstRate,
      hsnSacCode,
    } = body;

    // Build update query dynamically
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(name);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(description);
    }
    if (defaultPrice !== undefined) {
      updates.push(`default_price = $${paramIndex++}`);
      values.push(defaultPrice);
    }
    if (gstRate !== undefined) {
      updates.push(`gst_rate = $${paramIndex++}`);
      values.push(gstRate);
    }
    if (hsnSacCode !== undefined) {
      updates.push(`hsn_sac_code = $${paramIndex++}`);
      values.push(hsnSacCode);
    }

    updates.push(`updated_at = NOW()`);

    if (updates.length === 1) {
      return Response.json({ error: "No fields to update" }, { status: 400 });
    }

    values.push(id);
    const query = `UPDATE services SET ${updates.join(", ")} WHERE id = $${paramIndex} RETURNING *`;
    const result = await sql(query, values);

    if (result.length === 0) {
      return Response.json({ error: "Service not found" }, { status: 404 });
    }

    const s = result[0];

    // Log audit
    await logAudit({
      userId: user.id,
      action: "update",
      entityType: "service",
      entityId: s.id,
      metadata: { name: s.name },
      request,
    });

    return Response.json({
      id: s.id,
      name: s.name,
      description: s.description,
      defaultPrice: parseFloat(s.default_price),
      gstRate: parseFloat(s.gst_rate),
      hsnSacCode: s.hsn_sac_code,
      createdAt: s.created_at,
      updatedAt: s.updated_at,
    });
  } catch (error) {
    if (error.message === "UNAUTHORIZED") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Update service error:", error);
    return Response.json(
      { error: "Failed to update service" },
      { status: 500 },
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    const user = await requireAdmin(request);
    const { id } = params;

    // Hard delete
    await sql`
      DELETE FROM services WHERE id = ${id}
    `;

    // Log audit
    await logAudit({
      userId: user.id,
      action: "delete",
      entityType: "service",
      entityId: parseInt(id),
      metadata: {},
      request,
    });

    return Response.json({ message: "Service deleted successfully" });
  } catch (error) {
    if (error.message === "UNAUTHORIZED") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error.message === "FORBIDDEN") {
      return Response.json({ error: "Only admins can delete services" }, { status: 403 });
    }
    console.error("Delete service error:", error);
    return Response.json(
      { error: "Failed to delete service" },
      { status: 500 },
    );
  }
}
