import sql from "@/app/api/utils/sql";
import { requireAuth, logAudit } from "@/app/api/utils/auth";
import { isValidGstin, stateCodeFromGstin } from "@/app/api/utils/gstValidation";
import { ensureGstTreatmentColumns } from "@/app/api/utils/gstSchema";
import { ensureFolderTable } from "@/app/api/document-folders/route";

// Auto-migrate additional customer columns
async function ensureCustomerColumns() {
  try {
    await sql`ALTER TABLE customers ADD COLUMN IF NOT EXISTS website VARCHAR(255)`;
    await sql`ALTER TABLE customers ADD COLUMN IF NOT EXISTS customer_type VARCHAR(50) DEFAULT 'business'`;
    await sql`ALTER TABLE customers ADD COLUMN IF NOT EXISTS credit_limit DECIMAL(12,2)`;
  } catch (_) {}
}

export async function GET(request) {
  try {
    await requireAuth(request);
    await ensureCustomerColumns();

    const url = new URL(request.url);
    const search = url.searchParams.get("search") || "";
    const customerType = url.searchParams.get("customerType") || "";
    const limit = parseInt(url.searchParams.get("limit") || "100");
    const offset = parseInt(url.searchParams.get("offset") || "0");

    let customers;
    let totalCount;

    // Build parameterized query
    const conditions = ["c.is_archived = false"];
    const params = [];
    let idx = 1;

    if (search) {
      conditions.push(`(
        LOWER(c.name) LIKE LOWER($${idx})
        OR LOWER(c.company_name) LIKE LOWER($${idx})
        OR LOWER(c.gstin) LIKE LOWER($${idx})
        OR LOWER(c.email) LIKE LOWER($${idx})
      )`);
      params.push(`%${search}%`);
      idx++;
    }
    if (customerType) {
      conditions.push(`c.customer_type = $${idx}`);
      params.push(customerType);
      idx++;
    }

    const where = conditions.join(" AND ");
    params.push(limit);
    params.push(offset);

    customers = await sql(
      `SELECT c.*,
        COALESCE((SELECT SUM(i.grand_total) FROM invoices i WHERE i.customer_id = c.id AND i.is_archived = false), 0) as total_billed,
        COALESCE((SELECT SUM(p.amount) FROM payments p JOIN invoices i ON p.invoice_id = i.id WHERE i.customer_id = c.id), 0) as total_paid,
        COALESCE((SELECT COUNT(*) FROM invoices i WHERE i.customer_id = c.id AND i.is_archived = false), 0) as invoice_count
       FROM customers c
       WHERE ${where}
       ORDER BY c.created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      params
    );

    const countResult = await sql(
      `SELECT COUNT(*) as count FROM customers c WHERE ${where}`,
      params.slice(0, -2)
    );
    totalCount = parseInt(countResult[0].count);

    return Response.json({
      customers: customers.map((c) => ({
        id: c.id,
        name: c.name,
        companyName: c.company_name,
        gstin: c.gstin,
        pan: c.pan,
        email: c.email,
        phone: c.phone,
        website: c.website,
        customerType: c.customer_type || 'business',
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
        totalBilled: parseFloat(c.total_billed || 0),
        totalPaid: parseFloat(c.total_paid || 0),
        outstandingBalance: parseFloat(c.total_billed || 0) - parseFloat(c.total_paid || 0),
        invoiceCount: parseInt(c.invoice_count || 0),
        createdAt: c.created_at,
        updatedAt: c.updated_at,
      })),
      total: totalCount,
      limit,
      offset,
    });
  } catch (error) {
    if (error.message === "UNAUTHORIZED") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Get customers error:", error);
    return Response.json(
      { error: "Failed to get customers" },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();

    const {
      name,
      companyName,
      gstin,
      pan,
      email,
      phone,
      website,
      customerType,
      creditLimit,
      billingAddress,
      shippingAddress,
      city,
      state,
      stateCode,
      pincode,
      country,
      contactPerson,
      notes,
      gstTreatment,
      imageUrl,
    } = body;

    if (!companyName?.trim()) {
      return Response.json({ error: "Company name is required" }, { status: 400 });
    }

    if (gstin && !isValidGstin(gstin)) {
      return Response.json({ error: "Invalid GSTIN — failed format/checksum validation" }, { status: 400 });
    }
    const derivedStateCode = stateCodeFromGstin(gstin) || stateCode || null;
    const treatment = gstTreatment || (gstin ? "registered_regular" : "unregistered");

    await ensureCustomerColumns();
    await ensureGstTreatmentColumns();

    const result = await sql`
      INSERT INTO customers (
        name, company_name, gstin, pan, email, phone, website, customer_type, credit_limit,
        billing_address, shipping_address, city, state, state_code, pincode, country, contact_person, notes,
        gst_treatment, image_url
      )
      VALUES (
        ${name || companyName}, ${companyName || null}, ${gstin || null}, ${pan || null},
        ${email || null}, ${phone || null}, ${website || null}, ${customerType || 'business'}, ${creditLimit || null},
        ${billingAddress || null}, ${shippingAddress || null},
        ${city || null}, ${state || null}, ${derivedStateCode}, ${pincode || null},
        ${country || null}, ${contactPerson || null}, ${notes || null},
        ${treatment}, ${imageUrl || null}
      )
      RETURNING *
    `;

    const customer = result[0];

    // Every client gets a document folder. Non-fatal: the folder list self-heals
    // any customer that ends up without one, so a failure here can't block signup.
    try {
      await ensureFolderTable();
      await sql`
        INSERT INTO document_folders (name, customer_id, created_by)
        VALUES (${customer.company_name || customer.name}, ${customer.id}, ${user.id})
        ON CONFLICT DO NOTHING
      `;
    } catch (folderErr) {
      console.error("Client folder creation failed:", folderErr.message);
    }

    // Log audit
    await logAudit({
      userId: user.id,
      action: "create",
      entityType: "customer",
      entityId: customer.id,
      metadata: { name: customer.name },
      request,
    });

    return Response.json({
      id: customer.id,
      name: customer.name,
      companyName: customer.company_name,
      gstin: customer.gstin,
      pan: customer.pan,
      email: customer.email,
      phone: customer.phone,
      website: customer.website,
      customerType: customer.customer_type || 'business',
      creditLimit: customer.credit_limit ? parseFloat(customer.credit_limit) : null,
      billingAddress: customer.billing_address,
      shippingAddress: customer.shipping_address,
      city: customer.city,
      state: customer.state,
      stateCode: customer.state_code,
      pincode: customer.pincode,
      country: customer.country,
      contactPerson: customer.contact_person,
      notes: customer.notes,
      imageUrl: customer.image_url || null,
      createdAt: customer.created_at,
      updatedAt: customer.updated_at,
    });
  } catch (error) {
    if (error.message === "UNAUTHORIZED") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Create customer error:", error);
    return Response.json(
      { error: "Failed to create customer" },
      { status: 500 },
    );
  }
}
