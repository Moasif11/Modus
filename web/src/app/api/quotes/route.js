import sql from "@/app/api/utils/sql";
import { requireAuth, logAudit } from "@/app/api/utils/auth";

async function ensureQuotesTables() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS quotes (
        id SERIAL PRIMARY KEY,
        quote_number VARCHAR NOT NULL,
        customer_id INTEGER REFERENCES customers(id),
        project_id INTEGER,
        quote_date DATE NOT NULL,
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
      CREATE TABLE IF NOT EXISTS quote_items (
        id SERIAL PRIMARY KEY,
        quote_id INTEGER REFERENCES quotes(id) ON DELETE CASCADE,
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
    console.error("Error ensuring quotes tables exist:", error);
  }
}

export async function GET(request) {
  try {
    await requireAuth(request);
    await ensureQuotesTables();

    const url = new URL(request.url);
    const search = url.searchParams.get("search") || "";
    const status = url.searchParams.get("status") || "";
    const fromDate = url.searchParams.get("from") || "";
    const toDate = url.searchParams.get("to") || "";
    const limit = parseInt(url.searchParams.get("limit") || "50");
    const offset = parseInt(url.searchParams.get("offset") || "0");

    let whereConditions = ["q.is_archived = false"];
    const params = [];
    let paramIndex = 1;

    if (search) {
      whereConditions.push(`(
        LOWER(q.quote_number) LIKE LOWER($${paramIndex})
        OR LOWER(c.name) LIKE LOWER($${paramIndex})
        OR LOWER(c.company_name) LIKE LOWER($${paramIndex})
        OR LOWER(c.gstin) LIKE LOWER($${paramIndex})
      )`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (status) {
      if (status === "expired") {
        whereConditions.push(`q.status = 'sent' AND q.valid_until IS NOT NULL AND q.valid_until < CURRENT_DATE`);
      } else if (status === "sent") {
        whereConditions.push(`q.status = 'sent' AND (q.valid_until IS NULL OR q.valid_until >= CURRENT_DATE)`);
      } else {
        whereConditions.push(`q.status = $${paramIndex}`);
        params.push(status);
        paramIndex++;
      }
    }

    if (fromDate) {
      whereConditions.push(`q.quote_date >= $${paramIndex}`);
      params.push(fromDate);
      paramIndex++;
    }

    if (toDate) {
      whereConditions.push(`q.quote_date <= $${paramIndex}`);
      params.push(toDate);
      paramIndex++;
    }

    const whereClause = whereConditions.join(" AND ");

    params.push(limit);
    params.push(offset);

    const quotesQuery = `
      SELECT
        q.*,
        c.name as customer_name,
        c.company_name as customer_company,
        c.gstin as customer_gstin
      FROM quotes q
      LEFT JOIN customers c ON q.customer_id = c.id
      WHERE ${whereClause}
      ORDER BY q.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const quotes = await sql(quotesQuery, params);

    const countQuery = `
      SELECT COUNT(*) as count
      FROM quotes q
      LEFT JOIN customers c ON q.customer_id = c.id
      WHERE ${whereClause}
    `;

    const countResult = await sql(countQuery, params.slice(0, -2));
    const totalCount = parseInt(countResult[0].count);

    return Response.json({
      quotes: quotes.map((q) => {
        let computedStatus = q.status;
        if (q.status === "sent" && q.valid_until) {
          const validUntilObj = new Date(q.valid_until);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          if (validUntilObj < today) {
            computedStatus = "expired";
          }
        }

        return {
          id: q.id,
          quoteNumber: q.quote_number,
          customerId: q.customer_id,
          customerName: q.customer_company || q.customer_name,
          customerGstin: q.customer_gstin,
          quoteDate: q.quote_date,
          validUntil: q.valid_until,
          grandTotal: parseFloat(q.grand_total || 0),
          taxableAmount: parseFloat(q.taxable_amount || 0),
          cgstAmount: parseFloat(q.cgst_amount || 0),
          sgstAmount: parseFloat(q.sgst_amount || 0),
          igstAmount: parseFloat(q.igst_amount || 0),
          totalTax: parseFloat(q.total_tax || 0),
          isInterstate: q.is_interstate,
          gstCategory: q.gst_category,
          status: computedStatus,
          currency: q.currency || "INR",
          exchangeRate: parseFloat(q.exchange_rate || 1.0),
          createdAt: q.created_at,
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
    console.error("Get quotes error:", error);
    return Response.json(
      { error: "Failed to get quotes" },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  try {
    const user = await requireAuth(request);
    await ensureQuotesTables();
    const body = await request.json();

    const {
      quoteNumber,
      customerId,
      quoteDate,
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

    if (!quoteNumber || !quoteDate) {
      return Response.json(
        { error: "Quote number and date are required" },
        { status: 400 },
      );
    }

    if (!items || items.length === 0) {
      return Response.json(
        { error: "At least one line item is required" },
        { status: 400 },
      );
    }

    const quoteResult = await sql`
      INSERT INTO quotes (
        quote_number, customer_id, project_id, quote_date, valid_until,
        subtotal, total_discount, taxable_amount, cgst_amount, sgst_amount, igst_amount,
        total_tax, round_off, grand_total, amount_in_words, tax_inclusive, is_interstate,
        gst_category, place_of_supply, place_of_supply_code, reverse_charge, status,
        currency, exchange_rate, notes, terms, declaration, payment_method,
        service_period_from, service_period_to, snapshot_seller_json, snapshot_buyer_json,
        template_id, created_by
      )
      VALUES (
        ${quoteNumber}, ${customerId || null}, ${projectId || null}, ${quoteDate}, ${validUntil || null},
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

    const quote = quoteResult[0];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      await sql`
        INSERT INTO quote_items (
          quote_id, position, item_name, description, hsn_sac_code, quantity,
          unit, unit_price, discount_percent, discount_amount, taxable_value,
          gst_rate, cgst_rate, sgst_rate, igst_rate, cgst_amount, sgst_amount,
          igst_amount, total_tax, line_total
        )
        VALUES (
          ${quote.id}, ${i}, ${item.itemName}, ${item.description || null},
          ${item.hsnSacCode || null}, ${item.quantity}, ${item.unit || "Nos"},
          ${item.unitPrice}, ${item.discountPercent || 0}, ${item.discountAmount || 0},
          ${item.taxableValue}, ${item.gstRate}, ${item.cgstRate || 0},
          ${item.sgstRate || 0}, ${item.igstRate || 0}, ${item.cgstAmount || 0},
          ${item.sgstAmount || 0}, ${item.igstAmount || 0}, ${item.totalTax || 0},
          ${item.lineTotal}
        )
      `;
    }

    if (status !== "draft") {
      await sql`
        UPDATE company_settings
        SET next_quote_number = next_quote_number + 1
        WHERE id = 1
      `;
    }

    await logAudit({
      userId: user.id,
      action: "create",
      entityType: "quote",
      entityId: quote.id,
      metadata: {
        quoteNumber: quote.quote_number,
        status: quote.status,
      },
      request,
    });

    return Response.json({
      id: quote.id,
      quoteNumber: quote.quote_number,
      message: "Quote created successfully",
    });
  } catch (error) {
    if (error.message === "UNAUTHORIZED") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Create quote error:", error);
    return Response.json(
      { error: "Failed to create quote" },
      { status: 500 },
    );
  }
}
