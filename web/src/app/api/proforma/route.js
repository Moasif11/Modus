import sql from "@/app/api/utils/sql";
import { requireAuth, logAudit } from "@/app/api/utils/auth";

async function ensureProformaTables() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS proforma (
        id SERIAL PRIMARY KEY,
        proforma_number VARCHAR NOT NULL,
        customer_id INTEGER REFERENCES customers(id),
        project_id INTEGER,
        proforma_date DATE NOT NULL,
        valid_until DATE,
        subtotal NUMERIC(14,2) DEFAULT 0,
        total_discount NUMERIC(14,2) DEFAULT 0,
        taxable_amount NUMERIC(14,2) DEFAULT 0,
        cgst_amount NUMERIC(14,2) DEFAULT 0,
        sgst_amount NUMERIC(14,2) DEFAULT 0,
        igst_amount NUMERIC(14,2) DEFAULT 0,
        total_tax NUMERIC(14,2) DEFAULT 0,
        round_off NUMERIC(14,2) DEFAULT 0,
        grand_total NUMERIC(14,2) DEFAULT 0,
        amount_in_words TEXT,
        tax_inclusive BOOLEAN DEFAULT false,
        is_interstate BOOLEAN DEFAULT false,
        gst_category VARCHAR DEFAULT 'B2B',
        place_of_supply VARCHAR,
        place_of_supply_code VARCHAR,
        reverse_charge BOOLEAN DEFAULT false,
        status VARCHAR DEFAULT 'draft',
        currency VARCHAR(10) DEFAULT 'INR',
        exchange_rate NUMERIC(12,6) DEFAULT 1.0,
        notes TEXT,
        terms TEXT,
        declaration TEXT,
        payment_method TEXT,
        service_period_from DATE,
        service_period_to DATE,
        snapshot_seller_json JSONB,
        snapshot_buyer_json JSONB,
        template_id INTEGER,
        is_archived BOOLEAN DEFAULT false,
        archived_at TIMESTAMP,
        created_by INTEGER,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS proforma_items (
        id SERIAL PRIMARY KEY,
        proforma_id INTEGER REFERENCES proforma(id) ON DELETE CASCADE,
        position INTEGER,
        item_name VARCHAR,
        description TEXT,
        hsn_sac_code VARCHAR,
        quantity NUMERIC(14,2),
        unit VARCHAR,
        unit_price NUMERIC(14,2),
        discount_percent NUMERIC(6,2) DEFAULT 0,
        discount_amount NUMERIC(14,2) DEFAULT 0,
        taxable_value NUMERIC(14,2),
        gst_rate NUMERIC(6,2),
        cgst_rate NUMERIC(6,2) DEFAULT 0,
        cgst_amount NUMERIC(14,2) DEFAULT 0,
        sgst_rate NUMERIC(6,2) DEFAULT 0,
        sgst_amount NUMERIC(14,2) DEFAULT 0,
        igst_rate NUMERIC(6,2) DEFAULT 0,
        igst_amount NUMERIC(14,2) DEFAULT 0,
        total_tax NUMERIC(14,2) DEFAULT 0,
        line_total NUMERIC(14,2)
      )
    `;
  } catch (error) {
    console.error("Error ensuring proforma tables exist:", error);
  }
}

export async function GET(request) {
  try {
    await requireAuth(request);
    await ensureProformaTables();

    const url = new URL(request.url);
    const search = url.searchParams.get("search") || "";
    const status = url.searchParams.get("status") || "";
    const fromDate = url.searchParams.get("from") || "";
    const toDate = url.searchParams.get("to") || "";
    const limit = parseInt(url.searchParams.get("limit") || "50");
    const offset = parseInt(url.searchParams.get("offset") || "0");

    let whereConditions = ["p.is_archived = false"];
    const params = [];
    let paramIndex = 1;

    if (search) {
      whereConditions.push(`(
        LOWER(p.proforma_number) LIKE LOWER($${paramIndex})
        OR LOWER(c.name) LIKE LOWER($${paramIndex})
        OR LOWER(c.company_name) LIKE LOWER($${paramIndex})
        OR LOWER(c.gstin) LIKE LOWER($${paramIndex})
      )`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (status) {
      if (status === "expired") {
        whereConditions.push(`p.status = 'sent' AND p.valid_until IS NOT NULL AND p.valid_until < CURRENT_DATE`);
      } else if (status === "sent") {
        whereConditions.push(`p.status = 'sent' AND (p.valid_until IS NULL OR p.valid_until >= CURRENT_DATE)`);
      } else {
        whereConditions.push(`p.status = $${paramIndex}`);
        params.push(status);
        paramIndex++;
      }
    }

    if (fromDate) {
      whereConditions.push(`p.proforma_date >= $${paramIndex}`);
      params.push(fromDate);
      paramIndex++;
    }

    if (toDate) {
      whereConditions.push(`p.proforma_date <= $${paramIndex}`);
      params.push(toDate);
      paramIndex++;
    }

    const whereClause = whereConditions.join(" AND ");

    params.push(limit);
    params.push(offset);

    const proformaQuery = `
      SELECT
        p.*,
        c.name as customer_name,
        c.company_name as customer_company,
        c.gstin as customer_gstin
      FROM proforma p
      LEFT JOIN customers c ON p.customer_id = c.id
      WHERE ${whereClause}
      ORDER BY p.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const proformas = await sql(proformaQuery, params);

    const countQuery = `
      SELECT COUNT(*) as count
      FROM proforma p
      LEFT JOIN customers c ON p.customer_id = c.id
      WHERE ${whereClause}
    `;

    const countResult = await sql(countQuery, params.slice(0, -2));
    const totalCount = parseInt(countResult[0].count);

    return Response.json({
      proformas: proformas.map((p) => {
        let computedStatus = p.status;
        if (p.status === "sent" && p.valid_until) {
          const validUntilObj = new Date(p.valid_until);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          if (validUntilObj < today) {
            computedStatus = "expired";
          }
        }

        return {
          id: p.id,
          proformaNumber: p.proforma_number,
          customerId: p.customer_id,
          customerName: p.customer_company || p.customer_name,
          customerGstin: p.customer_gstin,
          proformaDate: p.proforma_date,
          validUntil: p.valid_until,
          grandTotal: parseFloat(p.grand_total || 0),
          taxableAmount: parseFloat(p.taxable_amount || 0),
          cgstAmount: parseFloat(p.cgst_amount || 0),
          sgstAmount: parseFloat(p.sgst_amount || 0),
          igstAmount: parseFloat(p.igst_amount || 0),
          totalTax: parseFloat(p.total_tax || 0),
          isInterstate: p.is_interstate,
          gstCategory: p.gst_category,
          status: computedStatus,
          currency: p.currency || "INR",
          exchangeRate: parseFloat(p.exchange_rate || 1.0),
          createdAt: p.created_at,
        };
      }),
      total: totalCount,
      limit,
      offset,
    });
  } catch (error) {
    if (error.message === "UNAUTHORIZED") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Get proforma error:", error);
    return Response.json(
      { error: "Failed to get proforma" },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  try {
    const user = await requireAuth(request);
    await ensureProformaTables();
    const body = await request.json();

    const {
      proformaNumber,
      customerId,
      proformaDate,
      validUntil,
      reverseCharge,
      placeOfSupply,
      placeOfSupplyCode,
      currency,
      exchangeRate,
      subtotal,
      totalDiscount,
      taxableAmount,
      cgstAmount,
      sgstAmount,
      igstAmount,
      totalTax,
      roundOff,
      grandTotal,
      amountInWords,
      taxInclusive,
      isInterstate,
      notes,
      terms,
      declaration,
      templateId,
      status,
      items,
      snapshotSeller,
      snapshotBuyer,
      paymentMethod,
      servicePeriodFrom,
      servicePeriodTo,
      gstCategory,
      projectId,
    } = body;

    if (!proformaNumber || !proformaDate) {
      return Response.json(
        { error: "Proforma number and date are required" },
        { status: 400 },
      );
    }

    if (!items || items.length === 0) {
      return Response.json(
        { error: "At least one line item is required" },
        { status: 400 },
      );
    }

    const proformaResult = await sql`
      INSERT INTO proforma (
        proforma_number, customer_id, project_id, proforma_date, valid_until,
        subtotal, total_discount, taxable_amount, cgst_amount, sgst_amount, igst_amount,
        total_tax, round_off, grand_total, amount_in_words, tax_inclusive, is_interstate,
        gst_category, place_of_supply, place_of_supply_code, reverse_charge, status,
        currency, exchange_rate, notes, terms, declaration, payment_method,
        service_period_from, service_period_to, snapshot_seller_json, snapshot_buyer_json,
        template_id, created_by
      )
      VALUES (
        ${proformaNumber}, ${customerId || null}, ${projectId || null}, ${proformaDate}, ${validUntil || null},
        ${subtotal || 0}, ${totalDiscount || 0}, ${taxableAmount || 0}, ${cgstAmount || 0},
        ${sgstAmount || 0}, ${igstAmount || 0}, ${totalTax || 0}, ${roundOff || 0},
        ${grandTotal || 0}, ${amountInWords || null}, ${taxInclusive || false}, ${isInterstate || false},
        ${gstCategory || "B2B"}, ${placeOfSupply || null}, ${placeOfSupplyCode || null},
        ${reverseCharge || false}, ${status || "draft"}, ${currency || "INR"}, ${exchangeRate || 1.0},
        ${notes || null}, ${terms || null}, ${declaration || null}, ${paymentMethod || null},
        ${servicePeriodFrom || null}, ${servicePeriodTo || null},
        ${JSON.stringify(snapshotSeller || {})}, ${JSON.stringify(snapshotBuyer || {})},
        ${templateId || null}, ${user.id}
      )
      RETURNING *
    `;

    const proforma = proformaResult[0];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      await sql`
        INSERT INTO proforma_items (
          proforma_id, position, item_name, description, hsn_sac_code, quantity,
          unit, unit_price, discount_percent, discount_amount, taxable_value,
          gst_rate, cgst_rate, sgst_rate, igst_rate, cgst_amount, sgst_amount,
          igst_amount, total_tax, line_total
        )
        VALUES (
          ${proforma.id}, ${i}, ${item.itemName}, ${item.description || null},
          ${item.hsnSacCode || null}, ${item.quantity}, ${item.unit || "Nos"},
          ${item.unitPrice}, ${item.discountPercent || 0}, ${item.discountAmount || 0},
          ${item.taxableValue}, ${item.gstRate}, ${item.cgstRate || 0},
          ${item.sgstRate || 0}, ${item.igstRate || 0}, ${item.cgstAmount || 0},
          ${item.sgstAmount || 0}, ${item.igstAmount || 0}, ${item.totalTax || 0},
          ${item.lineTotal}
        )
      `;
    }

    await logAudit({
      userId: user.id,
      action: "create",
      entityType: "proforma",
      entityId: proforma.id,
      metadata: {
        proformaNumber: proforma.proforma_number,
        status: proforma.status,
      },
      request,
    });

    return Response.json({
      id: proforma.id,
      proformaNumber: proforma.proforma_number,
      message: "Proforma created successfully",
    });
  } catch (error) {
    if (error.message === "UNAUTHORIZED") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Create proforma error:", error);
    return Response.json(
      { error: "Failed to create proforma" },
      { status: 500 },
    );
  }
}
