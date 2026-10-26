import sql from "@/app/api/utils/sql";
import { requireSuperAdmin, logAudit, handleRouteError } from "@/app/api/utils/auth";
import { createNotification, sendEmail } from "@/app/api/utils/notify";
import { emailShell } from "@/app/api/utils/emailTemplate";

function fmtINR(n) {
  return `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// POST /api/bills/:id/review  body: { action: "approve" | "reject", reason? }
// Superadmin-only. Approves or rejects a pending expense.
export async function POST(request, { params }) {
  try {
    const user = await requireSuperAdmin(request);
    const { id } = params;
    const body = await request.json().catch(() => ({}));
    const action = body.action;

    if (!["approve", "reject"].includes(action)) {
      return Response.json({ error: "action must be 'approve' or 'reject'" }, { status: 400 });
    }

    const existing = await sql`SELECT * FROM bills WHERE id = ${id}`;
    if (existing.length === 0) return Response.json({ error: "Bill not found" }, { status: 404 });
    const bill = existing[0];

    if (bill.status !== "pending") {
      return Response.json({ error: `Expense is not pending (currently ${bill.status})` }, { status: 400 });
    }

    let updated;
    if (action === "approve") {
      updated = await sql`
        UPDATE bills SET status = 'approved', approved_by = ${user.id}, approved_at = NOW(), rejected_reason = NULL, updated_at = NOW()
        WHERE id = ${id} RETURNING *
      `;
    } else {
      updated = await sql`
        UPDATE bills SET status = 'rejected', rejected_reason = ${body.reason || null}, updated_at = NOW()
        WHERE id = ${id} RETURNING *
      `;
    }

    // Notify the submitter of the outcome.
    if (bill.created_by) {
      const amtLabel = fmtINR(bill.amount);
      const approved = action === "approve";
      await createNotification({
        userId: bill.created_by,
        type: approved ? "expense_approved" : "expense_rejected",
        title: approved ? "Expense approved" : "Expense rejected",
        body: approved
          ? `Your expense "${bill.title}" (${amtLabel}) was approved.`
          : `Your expense "${bill.title}" (${amtLabel}) was rejected${body.reason ? `: ${body.reason}` : ""}.`,
        link: `/payables/${bill.id}`,
        relatedId: bill.id,
      });

      // Email the submitter the outcome.
      const [submitter] = await sql`SELECT email, full_name, name FROM users WHERE id = ${bill.created_by}`;
      if (submitter?.email) {
        const appUrl = process.env.APP_URL || "http://localhost:4000";
        await sendEmail({
          to: submitter.email,
          subject: approved ? `Expense approved — ${amtLabel}` : `Expense rejected — ${amtLabel}`,
          html: emailShell({
            preheader: approved ? "Your expense was approved" : "Your expense was rejected",
            heading: approved ? "Expense approved ✓" : "Expense rejected",
            intro: approved
              ? `Your expense <strong>${bill.title}</strong> has been approved and recorded.`
              : `Your expense <strong>${bill.title}</strong> was not approved.`,
            rows: [
              ["Bill", bill.bill_number || `#${bill.id}`],
              ["Amount", amtLabel],
              ...(approved ? [] : [["Reason", body.reason || "—"]]),
            ],
            ctaText: "View expense",
            ctaUrl: `${appUrl}/payables/${bill.id}`,
            accent: approved ? "#059669" : "#E11D2C",
          }),
        });
      }
    }

    await logAudit({
      userId: user.id,
      action: action === "approve" ? "approve_bill" : "reject_bill",
      entityType: "bill",
      entityId: Number(id),
      metadata: { billNumber: bill.bill_number, reason: body.reason || null },
      request,
    });

    return Response.json({ success: true, status: updated[0].status });
  } catch (error) {
    const handled = handleRouteError(error);
    if (handled) return handled;
    console.error("POST /api/bills/[id]/review error:", error);
    return Response.json({ error: error.code ? "Database error" : error.message }, { status: 500 });
  }
}
