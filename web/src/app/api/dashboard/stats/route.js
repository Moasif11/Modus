import sql from "@/app/api/utils/sql";
import { requireAuth } from "@/app/api/utils/auth";
import { getNotificationPrefs, notifySuperAdmins, getSuperAdminEmails, sendEmail, ensureNotificationsTable } from "@/app/api/utils/notify";
import { emailShell } from "@/app/api/utils/emailTemplate";

function fmtINR(n) {
  return `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

// Lazy GST filing reminders (no cron): in the 3 days before the GSTR-1 (11th) and
// GSTR-3B (20th) deadlines, notify superadmins once per deadline per month.
async function notifyGstDeadlines(prefs) {
  if (!prefs.gstReminders) return;
  await ensureNotificationsTable();
  const now = new Date();
  const deadlines = [
    { day: 11, name: "GSTR-1" },
    { day: 20, name: "GSTR-3B" },
  ];
  for (const dl of deadlines) {
    if (now.getDate() < dl.day - 3 || now.getDate() > dl.day) continue;
    const already = await sql`
      SELECT 1 FROM notifications
      WHERE type = 'gst_reminder' AND title LIKE ${"%" + dl.name + "%"}
        AND created_at >= date_trunc('month', CURRENT_DATE)
      LIMIT 1
    `;
    if (already.length > 0) continue;
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      .toLocaleDateString("en-IN", { month: "long", year: "numeric" });
    await notifySuperAdmins({
      type: "gst_reminder",
      title: `${dl.name} filing due by the ${dl.day}th`,
      body: `File ${dl.name} for ${prevMonth} by ${dl.day} ${now.toLocaleDateString("en-IN", { month: "long" })}.`,
      link: "/reports",
    });
  }
}

// Lazy weekly summary (no cron): first dashboard load each week (Mon 00:00 onward)
// emails superadmins an AR/AP snapshot, deduped via the notifications table.
async function sendWeeklySummary(prefs, snapshot) {
  if (!prefs.weeklySummary) return;
  await ensureNotificationsTable();
  const already = await sql`
    SELECT 1 FROM notifications
    WHERE type = 'weekly_summary' AND created_at >= date_trunc('week', CURRENT_DATE)
    LIMIT 1
  `;
  if (already.length > 0) return;
  await notifySuperAdmins({
    type: "weekly_summary",
    title: "Weekly summary",
    body: `AR outstanding ${fmtINR(snapshot.arOutstanding)} · AP payable ${fmtINR(snapshot.apPayable)} · ${snapshot.invoicesThisMonth} invoices this month`,
    link: "/dashboard",
  });
  const emails = await getSuperAdminEmails();
  if (emails.length === 0) return;
  const appUrl = process.env.APP_URL || "http://localhost:4000";
  await sendEmail({
    to: emails,
    subject: "MODUS — your weekly summary",
    html: emailShell({
      preheader: `AR outstanding ${fmtINR(snapshot.arOutstanding)}`,
      heading: "Weekly summary",
      intro: "Here's where the business stands this week.",
      rows: [
        ["AR outstanding", fmtINR(snapshot.arOutstanding)],
        ["AP payable", fmtINR(snapshot.apPayable)],
        ["Invoices this month", String(snapshot.invoicesThisMonth)],
        ["Total invoices", String(snapshot.totalInvoices)],
      ],
      ctaText: "Open Dashboard",
      ctaUrl: `${appUrl}/dashboard`,
      note: "You can turn this summary off in Settings → Notifications.",
    }),
  });
}

async function ensureAllColumns() {
  try {
    await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'INR'`;
    await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(12,6) DEFAULT 1.0`;
    await sql`ALTER TABLE payments ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'INR'`;
    await sql`ALTER TABLE payments ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(12,6) DEFAULT 1.0`;
    await sql`ALTER TABLE bills ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'INR'`;
    await sql`ALTER TABLE bills ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(12,6) DEFAULT 1.0`;
    await sql`ALTER TABLE bills ADD COLUMN IF NOT EXISTS tds_amount NUMERIC(14,2) DEFAULT 0`;
    await sql`ALTER TABLE bill_payments ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'INR'`;
    await sql`ALTER TABLE bill_payments ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(12,6) DEFAULT 1.0`;
  } catch (error) {
    console.error("Error ensuring all columns exist:", error);
  }
}

export async function GET(request) {
  try {
    await requireAuth(request);
    await ensureAllColumns();

    const url = new URL(request.url);
    const from = url.searchParams.get("from") || null;
    const to   = url.searchParams.get("to")   || null;
    const hasRange = from && to;

    // ── AR Stats ──────────────────────────────────────────────
    const totalInvoicesResult = hasRange
      ? await sql`
          SELECT COUNT(*) as count FROM invoices
          WHERE is_archived = false AND status != 'draft'
            AND invoice_date::date >= ${from}::date AND invoice_date::date <= ${to}::date`
      : await sql`
          SELECT COUNT(*) as count FROM invoices
          WHERE is_archived = false AND status != 'draft'`;

    const totalTaxableResult = hasRange
      ? await sql`
          SELECT COALESCE(SUM(taxable_amount * COALESCE(exchange_rate, 1.0)), 0) as total
          FROM invoices WHERE is_archived = false AND status != 'draft'
            AND invoice_date::date >= ${from}::date AND invoice_date::date <= ${to}::date`
      : await sql`
          SELECT COALESCE(SUM(taxable_amount * COALESCE(exchange_rate, 1.0)), 0) as total
          FROM invoices WHERE is_archived = false AND status != 'draft'`;

    const totalGSTResult = hasRange
      ? await sql`
          SELECT COALESCE(SUM((cgst_amount + sgst_amount + igst_amount) * COALESCE(exchange_rate, 1.0)), 0) as total
          FROM invoices WHERE is_archived = false AND status != 'draft'
            AND invoice_date::date >= ${from}::date AND invoice_date::date <= ${to}::date`
      : await sql`
          SELECT COALESCE(SUM((cgst_amount + sgst_amount + igst_amount) * COALESCE(exchange_rate, 1.0)), 0) as total
          FROM invoices WHERE is_archived = false AND status != 'draft'`;

    const thisMonthResult = hasRange
      ? await sql`
          SELECT COUNT(*) as count FROM invoices
          WHERE is_archived = false AND status != 'draft'
            AND invoice_date::date >= ${from}::date AND invoice_date::date <= ${to}::date`
      : await sql`
          SELECT COUNT(*) as count FROM invoices
          WHERE is_archived = false AND status != 'draft'
            AND DATE_TRUNC('month', invoice_date) = DATE_TRUNC('month', CURRENT_DATE)`;

    const statusBreakdown = hasRange
      ? await sql`
          WITH computed_invoices AS (
            SELECT
              CASE
                WHEN status NOT IN ('draft', 'saved', 'paid', 'cancelled')
                     AND due_date < CURRENT_DATE
                     AND grand_total > COALESCE((SELECT SUM(amount) FROM payments WHERE invoice_id = invoices.id), 0)
                THEN 'overdue'
                ELSE status
              END as computed_status
            FROM invoices
            WHERE is_archived = false AND status != 'draft'
              AND invoice_date::date >= ${from}::date AND invoice_date::date <= ${to}::date
          )
          SELECT computed_status as status, COUNT(*) as count
          FROM computed_invoices GROUP BY computed_status`
      : await sql`
          WITH computed_invoices AS (
            SELECT
              CASE
                WHEN status NOT IN ('draft', 'saved', 'paid', 'cancelled')
                     AND due_date < CURRENT_DATE
                     AND grand_total > COALESCE((SELECT SUM(amount) FROM payments WHERE invoice_id = invoices.id), 0)
                THEN 'overdue'
                ELSE status
              END as computed_status
            FROM invoices
            WHERE is_archived = false AND status != 'draft'
          )
          SELECT computed_status as status, COUNT(*) as count
          FROM computed_invoices GROUP BY computed_status`;

    const arOutstandingResult = hasRange
      ? await sql`
          WITH paid AS (
            SELECT invoice_id, COALESCE(SUM(amount), 0) AS total
            FROM payments GROUP BY invoice_id
          )
          SELECT COALESCE(SUM((i.grand_total - COALESCE(paid.total, 0)) * COALESCE(i.exchange_rate, 1.0)), 0) AS total
          FROM invoices i
          LEFT JOIN paid ON paid.invoice_id = i.id
          WHERE i.is_archived = false
            AND i.status IN ('sent', 'partially_paid')
            AND i.invoice_date::date >= ${from}::date AND i.invoice_date::date <= ${to}::date`
      : await sql`
          WITH paid AS (
            SELECT invoice_id, COALESCE(SUM(amount), 0) AS total
            FROM payments GROUP BY invoice_id
          )
          SELECT COALESCE(SUM((i.grand_total - COALESCE(paid.total, 0)) * COALESCE(i.exchange_rate, 1.0)), 0) AS total
          FROM invoices i
          LEFT JOIN paid ON paid.invoice_id = i.id
          WHERE i.is_archived = false AND i.status IN ('sent', 'partially_paid')`;

    // ── Monthly Revenue ───────────────────────────────────────
    let monthlyRevenue = [];
    try {
      const monthlyResult = hasRange
        ? await sql`
            WITH paid AS (
              SELECT invoice_id, COALESCE(SUM(amount), 0) AS total
              FROM payments GROUP BY invoice_id
            )
            SELECT
              TO_CHAR(DATE_TRUNC('month', i.invoice_date::date), 'Mon') AS m,
              COALESCE(SUM(i.grand_total * COALESCE(i.exchange_rate, 1.0)), 0) AS billed,
              COALESCE(SUM(COALESCE(paid.total, 0) * COALESCE(i.exchange_rate, 1.0)), 0) AS collected
            FROM invoices i
            LEFT JOIN paid ON paid.invoice_id = i.id
            WHERE i.is_archived = false AND i.status NOT IN ('draft', 'cancelled')
              AND i.invoice_date::date >= ${from}::date AND i.invoice_date::date <= ${to}::date
            GROUP BY DATE_TRUNC('month', i.invoice_date::date)
            ORDER BY DATE_TRUNC('month', i.invoice_date::date) ASC`
        : await sql`
            WITH paid AS (
              SELECT invoice_id, COALESCE(SUM(amount), 0) AS total
              FROM payments GROUP BY invoice_id
            )
            SELECT
              TO_CHAR(DATE_TRUNC('month', i.invoice_date::date), 'Mon') AS m,
              COALESCE(SUM(i.grand_total * COALESCE(i.exchange_rate, 1.0)), 0) AS billed,
              COALESCE(SUM(COALESCE(paid.total, 0) * COALESCE(i.exchange_rate, 1.0)), 0) AS collected
            FROM invoices i
            LEFT JOIN paid ON paid.invoice_id = i.id
            WHERE i.is_archived = false AND i.status NOT IN ('draft', 'cancelled')
              AND i.invoice_date::date >= CURRENT_DATE - INTERVAL '8 months'
            GROUP BY DATE_TRUNC('month', i.invoice_date::date)
            ORDER BY DATE_TRUNC('month', i.invoice_date::date) ASC`;

      monthlyRevenue = monthlyResult.map((r) => ({
        m: r.m,
        billed: parseFloat(r.billed),
        collected: parseFloat(r.collected),
      }));
    } catch (err) {
      console.error("monthlyRevenue query failed:", err.message);
    }

    // ── Top Clients ───────────────────────────────────────────
    let topClients = [];
    try {
      const topClientsResult = hasRange
        ? await sql`
            WITH paid AS (
              SELECT invoice_id, COALESCE(SUM(amount), 0) AS total
              FROM payments GROUP BY invoice_id
            )
            SELECT
              c.name,
              COALESCE(SUM((i.grand_total - COALESCE(paid.total, 0)) * COALESCE(i.exchange_rate, 1.0)), 0) AS outstanding
            FROM invoices i
            JOIN customers c ON i.customer_id = c.id
            LEFT JOIN paid ON paid.invoice_id = i.id
            WHERE i.is_archived = false AND i.status NOT IN ('draft', 'cancelled', 'paid')
              AND i.invoice_date::date >= ${from}::date AND i.invoice_date::date <= ${to}::date
            GROUP BY c.id, c.name
            ORDER BY outstanding DESC LIMIT 5`
        : await sql`
            WITH paid AS (
              SELECT invoice_id, COALESCE(SUM(amount), 0) AS total
              FROM payments GROUP BY invoice_id
            )
            SELECT
              c.name,
              COALESCE(SUM((i.grand_total - COALESCE(paid.total, 0)) * COALESCE(i.exchange_rate, 1.0)), 0) AS outstanding
            FROM invoices i
            JOIN customers c ON i.customer_id = c.id
            LEFT JOIN paid ON paid.invoice_id = i.id
            WHERE i.is_archived = false AND i.status NOT IN ('draft', 'cancelled', 'paid')
            GROUP BY c.id, c.name
            ORDER BY outstanding DESC LIMIT 5`;

      topClients = topClientsResult.map((r) => ({
        name: r.name,
        outstanding: parseFloat(r.outstanding),
      }));
    } catch (err) {
      console.error("topClients query failed:", err.message);
    }

    // ── AP Stats ──────────────────────────────────────────────
    let apStats = { totalPayable: 0, overduePayable: 0, billsCount: 0, paidThisMonth: 0 };
    try {
      const apOutstandingResult = hasRange
        ? await sql`
            SELECT COALESCE(SUM((amount - COALESCE(tds_amount, 0) - amount_paid) * COALESCE(exchange_rate, 1.0)), 0) as total, COUNT(*) as count
            FROM bills
            WHERE status NOT IN ('paid', 'cancelled')
              AND bill_date::date >= ${from}::date AND bill_date::date <= ${to}::date`
        : await sql`
            SELECT COALESCE(SUM((amount - COALESCE(tds_amount, 0) - amount_paid) * COALESCE(exchange_rate, 1.0)), 0) as total, COUNT(*) as count
            FROM bills WHERE status NOT IN ('paid', 'cancelled')`;

      const apOverdueResult = hasRange
        ? await sql`
            SELECT COALESCE(SUM((amount - COALESCE(tds_amount, 0) - amount_paid) * COALESCE(exchange_rate, 1.0)), 0) as total
            FROM bills
            WHERE status NOT IN ('paid', 'cancelled') AND due_date < CURRENT_DATE
              AND bill_date::date >= ${from}::date AND bill_date::date <= ${to}::date`
        : await sql`
            SELECT COALESCE(SUM((amount - COALESCE(tds_amount, 0) - amount_paid) * COALESCE(exchange_rate, 1.0)), 0) as total
            FROM bills WHERE status NOT IN ('paid', 'cancelled') AND due_date < CURRENT_DATE`;

      const apPaidThisMonth = hasRange
        ? await sql`
            SELECT COALESCE(SUM(amount * COALESCE(exchange_rate, 1.0)), 0) as total
            FROM bill_payments
            WHERE payment_date::date >= ${from}::date AND payment_date::date <= ${to}::date`
        : await sql`
            SELECT COALESCE(SUM(amount * COALESCE(exchange_rate, 1.0)), 0) as total
            FROM bill_payments
            WHERE DATE_TRUNC('month', payment_date) = DATE_TRUNC('month', CURRENT_DATE)`;

      apStats = {
        totalPayable: parseFloat(apOutstandingResult[0].total),
        overduePayable: parseFloat(apOverdueResult[0].total),
        billsCount: parseInt(apOutstandingResult[0].count),
        paidThisMonth: parseFloat(apPaidThisMonth[0].total),
      };
    } catch (err) {
      if (!err.message?.includes("does not exist")) {
        console.error("AP stats query failed:", err.message);
      }
    }

    // Fire-and-forget lazy reminders — dashboard latency unaffected
    (async () => {
      const prefs = await getNotificationPrefs();
      await notifyGstDeadlines(prefs);
      await sendWeeklySummary(prefs, {
        arOutstanding: parseFloat(arOutstandingResult[0].total),
        apPayable: apStats?.totalPayable || 0,
        invoicesThisMonth: parseInt(thisMonthResult[0].count),
        totalInvoices: parseInt(totalInvoicesResult[0].count),
      });
    })().catch((e) => console.error("Lazy reminders failed:", e.message));

    return Response.json({
      totalInvoices: parseInt(totalInvoicesResult[0].count),
      totalTaxable: parseFloat(totalTaxableResult[0].total),
      totalGST: parseFloat(totalGSTResult[0].total),
      invoicesThisMonth: parseInt(thisMonthResult[0].count),
      arOutstanding: parseFloat(arOutstandingResult[0].total),
      statusBreakdown: statusBreakdown.map((item) => ({
        status: item.status,
        count: parseInt(item.count),
      })),
      monthlyRevenue,
      topClients,
      ap: apStats,
    });
  } catch (error) {
    if (error.message === "UNAUTHORIZED") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Dashboard stats error:", error);
    return Response.json(
      { error: "Failed to get dashboard stats" },
      { status: 500 },
    );
  }
}
