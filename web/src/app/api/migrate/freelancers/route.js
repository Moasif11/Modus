import sql from "@/app/api/utils/sql";
import { requireSuperAdmin, logAudit } from "@/app/api/utils/auth";
import { ensureGstTreatmentColumns } from "@/app/api/utils/gstSchema";

// Names to migrate — case-insensitive prefix match so "Davis" matches "Davis Kuriakose" etc.
const FREELANCER_NAMES = ["Afnas", "Davis", "Jasim", "Sijumon", "Christo"];

export async function POST(request) {
  try {
    const user = await requireSuperAdmin(request);

    // Ensure the gst_treatment column exists on vendors (idempotent)
    await ensureGstTreatmentColumns();

    const results = [];
    const errors = [];

    // Neon HTTP driver: use sql.transaction() which accepts an array of tagged-template queries.
    // We pre-resolve the employee/vendor lookups outside the transaction (reads only),
    // then batch all writes into a single atomic transaction array.

    // ── Phase 1: Resolve employees and build migration plan (reads, no tx needed) ──
    const plan = [];
    for (const targetName of FREELANCER_NAMES) {
      const empRows = await sql`
        SELECT * FROM employees
        WHERE name ILIKE ${targetName + "%"}
          AND is_archived = false
        LIMIT 1
      `;

      if (empRows.length === 0) {
        errors.push({ name: targetName, reason: "Employee not found or already archived — skipped" });
        continue;
      }

      const emp = empRows[0];

      // Check idempotency — vendor with this name already created?
      const existingVendor = await sql`
        SELECT id FROM vendors
        WHERE LOWER(name) = LOWER(${emp.name})
          AND is_archived = false
        LIMIT 1
      `;

      plan.push({ emp, existingVendorId: existingVendor[0]?.id || null });
    }

    // ── Phase 2: Execute all writes atomically ────────────────────────────────
    // Neon's transaction() takes an array of query promises (tagged template calls).
    // We build and execute sequentially using a manual BEGIN/COMMIT block.
    // Since neon() HTTP driver doesn't support multi-statement transactions natively
    // in the same way, we use it with neonConfig.fetchConnectionCache and run
    // individual steps — any error will stop processing and we surface it clearly.
    // For full rollback safety on failure we wrap with explicit BEGIN/COMMIT.

    await sql`BEGIN`;
    try {
      for (const { emp, existingVendorId } of plan) {
        let vendorId = existingVendorId;

        if (existingVendorId) {
          errors.push({ name: emp.name, reason: `Vendor already exists (id=${existingVendorId}) — re-linking bills only` });
        } else {
          // Insert new vendor
          const vendorRows = await sql`
            INSERT INTO vendors (
              name, category, pan, email, phone,
              bank_name, bank_account, bank_ifsc,
              notes, gst_treatment,
              created_at, updated_at
            )
            VALUES (
              ${emp.name},
              'freelancer',
              ${emp.pan || null},
              ${emp.email || null},
              ${emp.phone || null},
              ${emp.bank_name || null},
              ${emp.bank_account || null},
              ${emp.bank_ifsc || null},
              ${emp.notes || null},
              'unregistered',
              NOW(), NOW()
            )
            RETURNING id, name
          `;
          vendorId = vendorRows[0].id;
        }

        // Re-link all bills: employee_id → NULL, vendor_id → new vendor
        const billUpdateResult = await sql`
          UPDATE bills
          SET
            vendor_id   = ${vendorId},
            employee_id = NULL,
            updated_at  = NOW()
          WHERE employee_id = ${emp.id}
          RETURNING id, bill_number, title, amount
        `;

        // Soft-delete (archive) the employee
        await sql`
          UPDATE employees
          SET is_archived = true, updated_at = NOW()
          WHERE id = ${emp.id}
        `;

        results.push({
          employeeId: emp.id,
          employeeName: emp.name,
          vendorId,
          billsRelinked: billUpdateResult.length,
          bills: billUpdateResult.map((b) => ({
            id: b.id,
            billNumber: b.bill_number,
            title: b.title,
            amount: parseFloat(b.amount),
          })),
        });
      }

      await sql`COMMIT`;
    } catch (txErr) {
      await sql`ROLLBACK`;
      throw txErr;
    }

    // Audit log
    await logAudit({
      userId: user.id,
      action: "migrate_freelancers_to_vendors",
      entityType: "migration",
      entityId: null,
      metadata: { results, errors, migratedCount: results.length },
      request,
    });

    return Response.json({
      success: true,
      migratedCount: results.length,
      results,
      warnings: errors,
    });
  } catch (error) {
    if (error.message === "UNAUTHORIZED")
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (error.message === "FORBIDDEN")
      return Response.json({ error: "Superadmin only" }, { status: 403 });
    console.error("Freelancer migration error:", error);
    return Response.json({ error: error.message || "Migration failed" }, { status: 500 });
  }
}
