import sql from "@/app/api/utils/sql";
import { requireAuth, logAudit } from "@/app/api/utils/auth";

export async function GET(request, { params }) {
  try {
    await requireAuth(request);
    const { id } = params;

    const quotes = await sql`
      SELECT q.*, c.*,
        q.id as quote_id,
        c.id as customer_id
      FROM quotes q
      LEFT JOIN customers c ON q.customer_id = c.id
      WHERE q.id = ${id} AND q.is_archived = false
      LIMIT 1
    `;

    if (quotes.length === 0) {
      return Response.json({ error: "Quote not found" }, { status: 404 });
    }

    const q = quotes[0];

    const items = await sql`
      SELECT * FROM quote_items
      WHERE quote_id = ${id}
      ORDER BY position ASC
    `;

    let computedStatus = q.status;
    if (q.status === "sent" && q.valid_until) {
      const validUntilObj = new Date(q.valid_until);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (validUntilObj < today) {
        computedStatus = "expired";
      }
    }

    return Response.json({
      quote: {
        id: q.quote_id,
        quoteNumber: q.quote_number,
        customerId: q.customer_id,
        projectId: q.project_id || null,
        quoteDate: q.quote_date,
        validUntil: q.valid_until,
        reverseCharge: q.reverse_charge,
        placeOfSupply: q.place_of_supply,
        placeOfSupplyCode: q.place_of_supply_code,
        currency: q.currency || "INR",
        exchangeRate: parseFloat(q.exchange_rate || 1.0),
        subtotal: parseFloat(q.subtotal),
        totalDiscount: parseFloat(q.total_discount),
        taxableAmount: parseFloat(q.taxable_amount),
        cgstAmount: parseFloat(q.cgst_amount),
        sgstAmount: parseFloat(q.sgst_amount),
        igstAmount: parseFloat(q.igst_amount),
        totalTax: parseFloat(q.total_tax),
        roundOff: parseFloat(q.round_off),
        grandTotal: parseFloat(q.grand_total),
        amountInWords: q.amount_in_words,
        taxInclusive: q.tax_inclusive,
        isInterstate: q.is_interstate,
        gstCategory: q.gst_category || "B2B",
        notes: q.notes,
        terms: q.terms,
        declaration: q.declaration,
        templateId: q.template_id,
        status: computedStatus,
        snapshotSeller: q.snapshot_seller_json,
        snapshotBuyer: q.snapshot_buyer_json,
        paymentMethod: q.payment_method,
        servicePeriodFrom: q.service_period_from,
        servicePeriodTo: q.service_period_to,
        createdAt: q.created_at,
        updatedAt: q.updated_at,
      },
      customer: q.customer_id
        ? {
            id: q.customer_id,
            name: q.name,
            companyName: q.company_name,
            gstin: q.gstin,
            email: q.email,
            phone: q.phone,
            billingAddress: q.billing_address,
            shippingAddress: q.shipping_address,
            city: q.city,
            state: q.state,
            stateCode: q.state_code,
            pincode: q.pincode,
            country: q.country,
          }
        : null,
      items: items.map((item) => ({
        id: item.id,
        position: item.position,
        itemName: item.item_name,
        description: item.description,
        hsnSacCode: item.hsn_sac_code,
        quantity: parseFloat(item.quantity),
        unit: item.unit,
        unitPrice: parseFloat(item.unit_price),
        discountPercent: parseFloat(item.discount_percent),
        discountAmount: parseFloat(item.discount_amount),
        taxableValue: parseFloat(item.taxable_value),
        gstRate: parseFloat(item.gst_rate),
        cgstRate: parseFloat(item.cgst_rate),
        sgstRate: parseFloat(item.sgst_rate),
        igstRate: parseFloat(item.igst_rate),
        cgstAmount: parseFloat(item.cgst_amount),
        sgstAmount: parseFloat(item.sgst_amount),
        igstAmount: parseFloat(item.igst_amount),
        totalTax: parseFloat(item.total_tax),
        lineTotal: parseFloat(item.line_total),
      })),
    });
  } catch (error) {
    if (error.message === "UNAUTHORIZED") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Get quote error:", error);
    return Response.json(
      { error: "Failed to get quote" },
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

    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (customerId !== undefined) {
      updates.push(`customer_id = $${paramIndex++}`);
      values.push(customerId);
    }
    if (quoteDate !== undefined) {
      updates.push(`quote_date = $${paramIndex++}`);
      values.push(quoteDate);
    }
    if (validUntil !== undefined) {
      updates.push(`valid_until = $${paramIndex++}`);
      values.push(validUntil || null);
    }
    if (reverseCharge !== undefined) {
      updates.push(`reverse_charge = $${paramIndex++}`);
      values.push(reverseCharge);
    }
    if (placeOfSupply !== undefined) {
      updates.push(`place_of_supply = $${paramIndex++}`);
      values.push(placeOfSupply);
    }
    if (placeOfSupplyCode !== undefined) {
      updates.push(`place_of_supply_code = $${paramIndex++}`);
      values.push(placeOfSupplyCode);
    }
    if (currency !== undefined) {
      updates.push(`currency = $${paramIndex++}`);
      values.push(currency);
    }
    if (exchangeRate !== undefined) {
      updates.push(`exchange_rate = $${paramIndex++}`);
      values.push(exchangeRate);
    }
    if (subtotal !== undefined) {
      updates.push(`subtotal = $${paramIndex++}`);
      values.push(subtotal);
    }
    if (totalDiscount !== undefined) {
      updates.push(`total_discount = $${paramIndex++}`);
      values.push(totalDiscount);
    }
    if (taxableAmount !== undefined) {
      updates.push(`taxable_amount = $${paramIndex++}`);
      values.push(taxableAmount);
    }
    if (cgstAmount !== undefined) {
      updates.push(`cgst_amount = $${paramIndex++}`);
      values.push(cgstAmount);
    }
    if (sgstAmount !== undefined) {
      updates.push(`sgst_amount = $${paramIndex++}`);
      values.push(sgstAmount);
    }
    if (igstAmount !== undefined) {
      updates.push(`igst_amount = $${paramIndex++}`);
      values.push(igstAmount);
    }
    if (totalTax !== undefined) {
      updates.push(`total_tax = $${paramIndex++}`);
      values.push(totalTax);
    }
    if (roundOff !== undefined) {
      updates.push(`round_off = $${paramIndex++}`);
      values.push(roundOff);
    }
    if (grandTotal !== undefined) {
      updates.push(`grand_total = $${paramIndex++}`);
      values.push(grandTotal);
    }
    if (amountInWords !== undefined) {
      updates.push(`amount_in_words = $${paramIndex++}`);
      values.push(amountInWords);
    }
    if (taxInclusive !== undefined) {
      updates.push(`tax_inclusive = $${paramIndex++}`);
      values.push(taxInclusive);
    }
    if (isInterstate !== undefined) {
      updates.push(`is_interstate = $${paramIndex++}`);
      values.push(isInterstate);
    }
    if (notes !== undefined) {
      updates.push(`notes = $${paramIndex++}`);
      values.push(notes);
    }
    if (terms !== undefined) {
      updates.push(`terms = $${paramIndex++}`);
      values.push(terms);
    }
    if (declaration !== undefined) {
      updates.push(`declaration = $${paramIndex++}`);
      values.push(declaration);
    }
    if (templateId !== undefined) {
      updates.push(`template_id = $${paramIndex++}`);
      values.push(templateId);
    }
    if (status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(status);
    }
    if (snapshotSeller !== undefined) {
      updates.push(`snapshot_seller_json = $${paramIndex++}`);
      values.push(JSON.stringify(snapshotSeller));
    }
    if (snapshotBuyer !== undefined) {
      updates.push(`snapshot_buyer_json = $${paramIndex++}`);
      values.push(JSON.stringify(snapshotBuyer));
    }
    if (paymentMethod !== undefined) {
      updates.push(`payment_method = $${paramIndex++}`);
      values.push(paymentMethod);
    }
    if (servicePeriodFrom !== undefined) {
      updates.push(`service_period_from = $${paramIndex++}`);
      values.push(servicePeriodFrom || null);
    }
    if (servicePeriodTo !== undefined) {
      updates.push(`service_period_to = $${paramIndex++}`);
      values.push(servicePeriodTo || null);
    }
    if (gstCategory !== undefined) {
      updates.push(`gst_category = $${paramIndex++}`);
      values.push(gstCategory);
    }
    if (projectId !== undefined) {
      updates.push(`project_id = $${paramIndex++}`);
      values.push(projectId || null);
    }

    updates.push(`updated_at = NOW()`);

    if (updates.length > 1) {
      values.push(id);
      const query = `UPDATE quotes SET ${updates.join(", ")} WHERE id = $${paramIndex} RETURNING *`;
      await sql(query, values);
    }

    if (items) {
      await sql`DELETE FROM quote_items WHERE quote_id = ${id}`;

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
            ${id}, ${i}, ${item.itemName}, ${item.description || null},
            ${item.hsnSacCode || null}, ${item.quantity}, ${item.unit || "Nos"},
            ${item.unitPrice}, ${item.discountPercent || 0}, ${item.discountAmount || 0},
            ${item.taxableValue}, ${item.gstRate}, ${item.cgstRate || 0},
            ${item.sgstRate || 0}, ${item.igstRate || 0}, ${item.cgstAmount || 0},
            ${item.sgstAmount || 0}, ${item.igstAmount || 0}, ${item.totalTax || 0},
            ${item.lineTotal}
          )
        `;
      }
    }

    await logAudit({
      userId: user.id,
      action: "update",
      entityType: "quote",
      entityId: parseInt(id),
      metadata: { status: status },
      request,
    });

    return Response.json({ message: "Quote updated successfully" });
  } catch (error) {
    if (error.message === "UNAUTHORIZED") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Update quote error:", error);
    return Response.json(
      { error: "Failed to update quote" },
      { status: 500 },
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    const user = await requireAuth(request);
    const { id } = params;

    // Self-heal: archive columns may not exist on older databases.
    await sql`ALTER TABLE quotes ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false`;
    await sql`ALTER TABLE quotes ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ`;

    await sql`
      UPDATE quotes
      SET is_archived = true, archived_at = NOW(), updated_at = NOW()
      WHERE id = ${id}
    `;

    await logAudit({
      userId: user.id,
      action: "delete",
      entityType: "quote",
      entityId: parseInt(id),
      metadata: {},
      request,
    });

    return Response.json({ message: "Quote deleted successfully" });
  } catch (error) {
    if (error.message === "UNAUTHORIZED") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Delete quote error:", error);
    return Response.json(
      { error: "Failed to delete quote" },
      { status: 500 },
    );
  }
}
