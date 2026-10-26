import sql from "@/app/api/utils/sql";
import { requireAuth, requireAdmin, logAudit } from "@/app/api/utils/auth";
import { isValidGstin, stateCodeFromGstin } from "@/app/api/utils/gstValidation";
import { ensureGstTreatmentColumns } from "@/app/api/utils/gstSchema";

function mapVendor(v) {
  return {
    id: v.id,
    name: v.name,
    companyName: v.company_name,
    category: v.category || "supplier",
    gstin: v.gstin,
    pan: v.pan,
    email: v.email,
    phone: v.phone,
    billingAddress: v.billing_address,
    city: v.city,
    state: v.state,
    stateCode: v.state_code,
    pincode: v.pincode,
    country: v.country,
    contactPerson: v.contact_person,
    website: v.website,
    bankName: v.bank_name,
    bankAccount: v.bank_account,
    bankIfsc: v.bank_ifsc,
    notes: v.notes,
    imageUrl: v.image_url || null,
    createdAt: v.created_at,
    updatedAt: v.updated_at,
  };
}

export async function GET(request, { params }) {
  try {
    await requireAuth(request);
    const { id } = params;

    const vendors = await sql`
      SELECT * FROM vendors WHERE id = ${id} AND is_archived = false LIMIT 1
    `;

    if (vendors.length === 0) {
      return Response.json({ error: "Vendor not found" }, { status: 404 });
    }

    return Response.json(mapVendor(vendors[0]));
  } catch (error) {
    if (error.message === "UNAUTHORIZED") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Get vendor error:", error);
    return Response.json(
      { error: "Failed to get vendor" },
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
      name, companyName, category, gstin, pan, email, phone,
      billingAddress, city, state, stateCode, pincode, country,
      contactPerson, website, bankName, bankAccount, bankIfsc, notes,
      gstTreatment, imageUrl,
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
      name, company_name: companyName, category, gstin, pan, email, phone,
      billing_address: billingAddress, city, state, state_code: derivedStateCode,
      pincode, country, contact_person: contactPerson, website,
      bank_name: bankName, bank_account: bankAccount, bank_ifsc: bankIfsc, notes,
      image_url: imageUrl,
      gst_treatment: treatment,
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
    const query = `UPDATE vendors SET ${updates.join(", ")} WHERE id = $${paramIndex} AND is_archived = false RETURNING *`;
    const result = await sql(query, values);

    if (result.length === 0) {
      return Response.json({ error: "Vendor not found" }, { status: 404 });
    }

    await logAudit({
      userId: user.id,
      action: "update",
      entityType: "vendor",
      entityId: result[0].id,
      metadata: { name: result[0].name },
      request,
    });

    return Response.json(mapVendor(result[0]));
  } catch (error) {
    if (error.message === "UNAUTHORIZED") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Update vendor error:", error);
    return Response.json(
      { error: "Failed to update vendor" },
      { status: 500 }
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    const user = await requireAdmin(request);
    const { id } = params;

    await sql`
      UPDATE vendors SET is_archived = true, updated_at = NOW() WHERE id = ${id}
    `;

    await logAudit({
      userId: user.id,
      action: "delete",
      entityType: "vendor",
      entityId: parseInt(id),
      metadata: {},
      request,
    });

    return Response.json({ message: "Vendor deleted successfully" });
  } catch (error) {
    if (error.message === "UNAUTHORIZED") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error.message === "FORBIDDEN") {
      return Response.json({ error: "Only admins can delete vendors" }, { status: 403 });
    }
    console.error("Delete vendor error:", error);
    return Response.json(
      { error: "Failed to delete vendor" },
      { status: 500 }
    );
  }
}
