import sql from "@/app/api/utils/sql";
import { requireAuth, logAudit } from "@/app/api/utils/auth";

export async function GET(request, { params }) {
  try {
    await requireAuth(request);
    const { id } = params;

    const proformas = await sql`
      SELECT p.*, c.*,
        p.id as proforma_id,
        c.id as customer_id
      FROM proforma p
      LEFT JOIN customers c ON p.customer_id = c.id
      WHERE p.id = ${id} AND p.is_archived = false
      LIMIT 1
    `;

    if (proformas.length === 0) {
      return Response.json({ error: "Proforma not found" }, { status: 404 });
    }

    const p = proformas[0];

    const items = await sql`
      SELECT * FROM proforma_items
      WHERE proforma_id = ${id}
      ORDER BY position ASC
    `;

    let computedStatus = p.status;
    if (p.status === "sent" && p.valid_until) {
      const validUntilObj = new Date(p.valid_until);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (validUntilObj < today) {
        computedStatus = "expired";
      }
    }

    return Response.json({
      proforma: {
        id: p.proforma_id,
        proformaNumber: p.proforma_number,
        customerId: p.customer_id,
        projectId: p.project_id || null,
        proformaDate: p.proforma_date,
        validUntil: p.valid_until,
        reverseCharge: p.reverse_charge,
        placeOfSupply: p.place_of_supply,
        placeOfSupplyCode: p.place_of_supply_code,
        currency: p.currency || "INR",
        exchangeRate: parseFloat(p.exchange_rate || 1.0),
        subtotal: parseFloat(p.subtotal),
        totalDiscount: parseFloat(p.total_discount),
        taxableAmount: parseFloat(p.taxable_amount),
        cgstAmount: parseFloat(p.cgst_amount),
        sgstAmount: parseFloat(p.sgst_amount),
        igstAmount: parseFloat(p.igst_amount),
        totalTax: parseFloat(p.total_tax),
        roundOff: parseFloat(p.round_off),
        grandTotal: parseFloat(p.grand_total),
        amountInWords: p.amount_in_words,
        taxInclusive: p.tax_inclusive,
        isInterstate: p.is_interstate,
        gstCategory: p.gst_category || "B2B",
        notes: p.notes,
        terms: p.terms,
        declaration: p.declaration,
        templateId: p.template_id,
        status: computedStatus,
        snapshotSeller: p.snapshot_seller_json,
        snapshotBuyer: p.snapshot_buyer_json,
        paymentMethod: p.payment_method,
        servicePeriodFrom: p.service_period_from,
        servicePeriodTo: p.service_period_to,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
      },
      customer: p.customer_id
        ? {
            id: p.customer_id,
            name: p.name,
            companyName: p.company_name,
            gstin: p.gstin,
            email: p.email,
            phone: p.phone,
            billingAddress: p.billing_address,
            shippingAddress: p.shipping_address,
            city: p.city,
            state: p.state,
            stateCode: p.state_code,
            pincode: p.pincode,
            country: p.country,
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
    console.error("Get proforma error:", error);
    return Response.json(
      { error: "Failed to get proforma" },
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

    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (customerId !== undefined) {
      updates.push(`customer_id = $${paramIndex++}`);
      values.push(customerId);
    }
    if (proformaDate !== undefined) {
      updates.push(`proforma_date = $${paramIndex++}`);
      values.push(proformaDate);
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
      const query = `UPDATE proforma SET ${updates.join(", ")} WHERE id = $${paramIndex} RETURNING *`;
      await sql(query, values);
    }

    if (items) {
      await sql`DELETE FROM proforma_items WHERE proforma_id = ${id}`;

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
      entityType: "proforma",
      entityId: parseInt(id),
      metadata: { status: status },
      request,
    });

    return Response.json({ message: "Proforma updated successfully" });
  } catch (error) {
    if (error.message === "UNAUTHORIZED") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Update proforma error:", error);
    return Response.json(
      { error: "Failed to update proforma" },
      { status: 500 },
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    const user = await requireAuth(request);
    const { id } = params;

    // Self-heal: archive columns may not exist on older databases.
    await sql`ALTER TABLE proforma ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false`;
    await sql`ALTER TABLE proforma ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ`;

    await sql`
      UPDATE proforma
      SET is_archived = true, archived_at = NOW(), updated_at = NOW()
      WHERE id = ${id}
    `;

    await logAudit({
      userId: user.id,
      action: "delete",
      entityType: "proforma",
      entityId: parseInt(id),
      metadata: {},
      request,
    });

    return Response.json({ message: "Proforma deleted successfully" });
  } catch (error) {
    if (error.message === "UNAUTHORIZED") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Delete proforma error:", error);
    return Response.json(
      { error: "Failed to delete proforma" },
      { status: 500 },
    );
  }
}
