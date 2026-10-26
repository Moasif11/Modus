import sql from "@/app/api/utils/sql";
import { requireAuth, requireAdmin, logAudit } from "@/app/api/utils/auth";
import { isValidGstin, stateCodeFromGstin } from "@/app/api/utils/gstValidation";
import { ensureGstTreatmentColumns } from "@/app/api/utils/gstSchema";

function mapCustomer(c) {
  return {
    id: c.id,
    name: c.name,
    companyName: c.company_name,
    gstin: c.gstin,
    pan: c.pan,
    email: c.email,
    phone: c.phone,
    website: c.website,
    customerType: c.customer_type || "business",
    creditLimit: c.credit_limit ? parseFloat(c.credit_limit) : null,
    billingAddress: c.billing_address,
    shippingAddress: c.shipping_address,
    city: c.city,
    state: c.state,
    stateCode: c.state_code,
    pincode: c.pincode,
    country: c.country,
    contactPerson: c.contact_person,
    notes: c.notes,
    imageUrl: c.image_url || null,
    createdAt: c.created_at,
    updatedAt: c.updated_at,
  };
}

export async function GET(request, { params }) {
  try {
    await requireAuth(request);
    const { id } = params;

    const customers = await sql`
      SELECT * FROM customers WHERE id = ${id} AND is_archived = false LIMIT 1
    `;

    if (customers.length === 0) {
      return Response.json({ error: "Customer not found" }, { status: 404 });
    }

    const c = customers[0];

    // Financial summary
    const financials = await sql`
      SELECT
        COALESCE(SUM(i.grand_total), 0) as total_billed,
        COALESCE(SUM(p.paid), 0) as total_paid,
        COUNT(i.id) as invoice_count
      FROM invoices i
      LEFT JOIN (
        SELECT invoice_id, SUM(amount) as paid FROM payments GROUP BY invoice_id
      ) p ON p.invoice_id = i.id
      WHERE i.customer_id = ${id} AND i.is_archived = false
    `;

    const fin = financials[0];
    const totalBilled = parseFloat(fin.total_billed || 0);
    const totalPaid = parseFloat(fin.total_paid || 0);

    // Recent invoices
    const invoices = await sql`
      SELECT i.id, i.invoice_number, i.invoice_date, i.due_date, i.grand_total, i.status,
        COALESCE((SELECT SUM(amount) FROM payments WHERE invoice_id = i.id), 0) as total_paid
      FROM invoices i
      WHERE i.customer_id = ${id} AND i.is_archived = false
      ORDER BY i.created_at DESC
      LIMIT 20
    `;

    // Recent payments
    const payments = await sql`
      SELECT p.id, p.amount, p.payment_date, p.payment_method, p.reference_number, p.notes,
        i.invoice_number
      FROM payments p
      JOIN invoices i ON p.invoice_id = i.id
      WHERE i.customer_id = ${id}
      ORDER BY p.payment_date DESC
      LIMIT 20
    `;

    return Response.json({
      ...mapCustomer(c),
      totalBilled,
      totalPaid,
      outstandingBalance: totalBilled - totalPaid,
      invoiceCount: parseInt(fin.invoice_count || 0),
      invoices: invoices.map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.invoice_number,
        invoiceDate: inv.invoice_date,
        dueDate: inv.due_date,
        grandTotal: parseFloat(inv.grand_total || 0),
        totalPaid: parseFloat(inv.total_paid || 0),
        balanceDue: parseFloat(inv.grand_total || 0) - parseFloat(inv.total_paid || 0),
        status: inv.status,
      })),
      payments: payments.map((p) => ({
        id: p.id,
        amount: parseFloat(p.amount || 0),
        paymentDate: p.payment_date,
        paymentMethod: p.payment_method,
        referenceNumber: p.reference_number,
        notes: p.notes,
        invoiceNumber: p.invoice_number,
      })),
    });
  } catch (error) {
    if (error.message === "UNAUTHORIZED") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Get customer error:", error);
    return Response.json(
      { error: "Failed to get customer" },
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
      name, companyName, gstin, pan, email, phone, website, customerType,
      creditLimit, billingAddress, shippingAddress, city, state, stateCode,
      pincode, country, contactPerson, notes, gstTreatment, imageUrl,
    } = body;

    if (gstin && !isValidGstin(gstin)) {
      return Response.json({ error: "Invalid GSTIN — failed format/checksum validation" }, { status: 400 });
    }
    const derivedStateCode = stateCodeFromGstin(gstin) || stateCode || undefined;
    const treatment = (gstTreatment !== undefined || gstin !== undefined)
      ? (gstTreatment || (gstin ? "registered_regular" : "unregistered"))
      : undefined;

    await ensureGstTreatmentColumns();

    const updates = [];
    const values = [];
    let paramIndex = 1;

    const fields = {
      name, company_name: companyName, gstin, pan, email, phone, website,
      customer_type: customerType, credit_limit: creditLimit || null,
      billing_address: billingAddress, shipping_address: shippingAddress,
      city, state, state_code: derivedStateCode, pincode, country,
      contact_person: contactPerson, notes, gst_treatment: treatment,
      image_url: imageUrl,
    };

    for (const [col, val] of Object.entries(fields)) {
      if (val !== undefined) {
        updates.push(`${col} = $${paramIndex++}`);
        values.push(val);
      }
    }

    updates.push(`updated_at = NOW()`);

    if (updates.length === 1) {
      return Response.json({ error: "No fields to update" }, { status: 400 });
    }

    values.push(id);
    const query = `UPDATE customers SET ${updates.join(", ")} WHERE id = $${paramIndex} AND is_archived = false RETURNING *`;
    const result = await sql(query, values);

    if (result.length === 0) {
      return Response.json({ error: "Customer not found" }, { status: 404 });
    }

    const c = result[0];

    await logAudit({
      userId: user.id,
      action: "update",
      entityType: "customer",
      entityId: c.id,
      metadata: { name: c.name },
      request,
    });

    return Response.json(mapCustomer(c));
  } catch (error) {
    if (error.message === "UNAUTHORIZED") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Update customer error:", error);
    return Response.json(
      { error: "Failed to update customer" },
      { status: 500 },
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    const user = await requireAdmin(request);
    const { id } = params;

    await sql`
      UPDATE customers 
      SET is_archived = true, updated_at = NOW()
      WHERE id = ${id}
    `;

    await logAudit({
      userId: user.id,
      action: "delete",
      entityType: "customer",
      entityId: parseInt(id),
      metadata: {},
      request,
    });

    return Response.json({ message: "Customer deleted successfully" });
  } catch (error) {
    if (error.message === "UNAUTHORIZED") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error.message === "FORBIDDEN") {
      return Response.json({ error: "Only admins can delete customers" }, { status: 403 });
    }
    console.error("Delete customer error:", error);
    return Response.json(
      { error: "Failed to delete customer" },
      { status: 500 },
    );
  }
}



