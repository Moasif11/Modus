import sql from "@/app/api/utils/sql";
import { requireAuth, logAudit } from "@/app/api/utils/auth";
import { isValidGstin, stateCodeFromGstin } from "@/app/api/utils/gstValidation";
import { ensureGstTreatmentColumns } from "@/app/api/utils/gstSchema";

// Auto-create vendors table if missing
async function ensureVendorsTable() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS vendors (
        id BIGSERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        company_name VARCHAR(255),
        category VARCHAR(50) DEFAULT 'supplier',
        gstin VARCHAR(20),
        pan VARCHAR(15),
        email VARCHAR(255),
        phone VARCHAR(30),
        billing_address TEXT,
        city VARCHAR(100),
        state VARCHAR(100),
        state_code VARCHAR(10),
        pincode VARCHAR(10),
        country VARCHAR(100) DEFAULT 'India',
        contact_person VARCHAR(255),
        website VARCHAR(255),
        bank_name VARCHAR(100),
        bank_account VARCHAR(50),
        bank_ifsc VARCHAR(20),
        notes TEXT,
        is_archived BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;
  } catch (_) {}
}

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
    billCount: parseInt(v.bill_count || 0),
    totalPayable: parseFloat(v.total_payable || 0),
  };
}

export async function GET(request) {
  try {
    await requireAuth(request);
    await ensureVendorsTable();

    const url = new URL(request.url);
    const search = url.searchParams.get("search") || "";
    const category = url.searchParams.get("category") || "";
    const limit = parseInt(url.searchParams.get("limit") || "100");
    const offset = parseInt(url.searchParams.get("offset") || "0");

    const conditions = ["v.is_archived = false"];
    const params = [];
    let idx = 1;

    if (search) {
      conditions.push(`(
        LOWER(v.name) LIKE LOWER($${idx})
        OR LOWER(v.company_name) LIKE LOWER($${idx})
        OR LOWER(v.gstin) LIKE LOWER($${idx})
        OR LOWER(v.email) LIKE LOWER($${idx})
      )`);
      params.push(`%${search}%`);
      idx++;
    }
    if (category) {
      conditions.push(`v.category = $${idx}`);
      params.push(category);
      idx++;
    }

    const where = conditions.join(" AND ");
    params.push(limit);
    params.push(offset);

    const vendors = await sql(
      `SELECT v.*,
              COALESCE(b.bill_count, 0)    AS bill_count,
              COALESCE(b.total_payable, 0) AS total_payable
       FROM vendors v
       LEFT JOIN (
         SELECT vendor_id,
                COUNT(*)                                                                     AS bill_count,
                SUM(CASE WHEN status IN ('approved','partially_paid','scheduled')
                         THEN GREATEST(amount - COALESCE(tds_amount,0) - amount_paid, 0)
                         ELSE 0 END)                                                         AS total_payable
         FROM bills
         WHERE status NOT IN ('cancelled', 'rejected', 'draft')
         GROUP BY vendor_id
       ) b ON b.vendor_id = v.id
       WHERE ${where}
       ORDER BY v.created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      params
    );

    const countResult = await sql(
      `SELECT COUNT(*) as count FROM vendors v WHERE ${where}`,
      params.slice(0, -2)
    );

    return Response.json({
      vendors: vendors.map(mapVendor),
      total: parseInt(countResult[0].count),
      limit,
      offset,
    });
  } catch (error) {
    if (error.message === "UNAUTHORIZED") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Get vendors error:", error);
    return Response.json(
      { error: "Failed to get vendors" },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const user = await requireAuth(request);
    await ensureVendorsTable();
    const body = await request.json();

    const {
      name, companyName, category, gstin, pan, email, phone,
      billingAddress, city, state, stateCode, pincode, country,
      contactPerson, website, bankName, bankAccount, bankIfsc, notes,
      gstTreatment, imageUrl,
    } = body;

    if (!name) {
      return Response.json({ error: "Name is required" }, { status: 400 });
    }

    if (gstin && !isValidGstin(gstin)) {
      return Response.json({ error: "Invalid GSTIN — failed format/checksum validation" }, { status: 400 });
    }
    const derivedStateCode = stateCodeFromGstin(gstin) || stateCode || null;
    const treatment = gstTreatment || (gstin ? "registered_regular" : "unregistered");

    await ensureGstTreatmentColumns();

    const result = await sql`
      INSERT INTO vendors (
        name, company_name, category, gstin, pan, email, phone,
        billing_address, city, state, state_code, pincode, country,
        contact_person, website, bank_name, bank_account, bank_ifsc, notes,
        gst_treatment, image_url
      )
      VALUES (
        ${name}, ${companyName || null}, ${category || "supplier"},
        ${gstin || null}, ${pan || null}, ${email || null}, ${phone || null},
        ${billingAddress || null}, ${city || null}, ${state || null},
        ${derivedStateCode}, ${pincode || null}, ${country || "India"},
        ${contactPerson || null}, ${website || null},
        ${bankName || null}, ${bankAccount || null}, ${bankIfsc || null}, ${notes || null},
        ${treatment}, ${imageUrl || null}
      )
      RETURNING *
    `;

    const vendor = result[0];

    await logAudit({
      userId: user.id,
      action: "create",
      entityType: "vendor",
      entityId: vendor.id,
      metadata: { name: vendor.name },
      request,
    });

    return Response.json(mapVendor(vendor));
  } catch (error) {
    if (error.message === "UNAUTHORIZED") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Create vendor error:", error);
    return Response.json(
      { error: "Failed to create vendor" },
      { status: 500 }
    );
  }
}
