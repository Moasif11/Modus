import sql from "@/app/api/utils/sql";
import { requireAuth } from "@/app/api/utils/auth";
import { launchBrowser } from "@/app/api/utils/browser";

function fmt(n) {
  return `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(d) {
  if (!d) return "";
  let day, month, year;
  if (d instanceof Date) {
    day = d.getUTCDate(); month = d.getUTCMonth() + 1; year = d.getUTCFullYear();
  } else {
    const iso = String(d).slice(0, 10).split("-");
    if (iso.length !== 3) return String(d);
    [year, month, day] = iso.map(Number);
  }
  return `${String(day).padStart(2,"0")}/${String(month).padStart(2,"0")}/${String(year).slice(2)}`;
}

function buildBillsHtml({ company, bills, from, to }) {
  const totals = bills.reduce(
    (acc, b) => {
      const ex = parseFloat(b.exchange_rate || 1.0);
      const amountINR = Number(b.amount || 0) * ex;
      const paidINR = Number(b.amount_paid || 0) * ex;
      const dueINR = amountINR - paidINR;
      return {
        amount: acc.amount + amountINR,
        paid: acc.paid + paidINR,
        due: acc.due + dueINR,
      };
    },
    { amount: 0, paid: 0, due: 0 }
  );

  const statusStyle = {
    paid: "background:#D1FAE5;color:#059669",
    approved: "background:#F3F4F6;color:#374151",
    partially_paid: "background:#FEF3C7;color:#D97706",
    draft: "background:#F3F4F6;color:#6B7280",
    cancelled: "background:#F3F4F6;color:#9CA3AF",
  };

  const rows = bills.map((b) => {
    const style = statusStyle[b.status] || "background:#F3F4F6;color:#374151";
    const ex = parseFloat(b.exchange_rate || 1.0);
    const amountINR = Number(b.amount || 0) * ex;
    const paidINR = Number(b.amount_paid || 0) * ex;
    const dueINR = amountINR - paidINR;
    return `
      <tr>
        <td style="font-weight:700;color:#0A0A0A;white-space:nowrap">${b.bill_number || ""}</td>
        <td style="white-space:nowrap">${fmtDate(b.bill_date)}</td>
        <td>${b.title || "\u2014"}</td>
        <td>${b.vendor_name || b.employee_name || "\u2014"}</td>
        <td style="text-transform:capitalize">${(b.category || "").replace(/_/g, " ")}</td>
        <td class="num">${fmt(amountINR)}</td>
        <td class="num" style="color:#059669">${fmt(paidINR)}</td>
        <td class="num" style="${dueINR > 0 ? "color:#E11D2C;font-weight:700" : ""}">${fmt(dueINR)}</td>
        <td><span style="display:inline-block;padding:2px 8px;border-radius:100px;font-size:9px;font-weight:700;text-transform:capitalize;white-space:nowrap;${style}">${(b.status || "").replace(/_/g, " ")}</span></td>
      </tr>`;
  }).join("");

  // Use dark logo (white version) if available, otherwise invert regular logo via CSS
  const logoSrc = company?.logo_dark_url || company?.logo_url;
  const logoFilter = (!company?.logo_dark_url && company?.logo_url) ? "filter:brightness(0) invert(1);" : "";
  const logoHtml = logoSrc
    ? `<img src="${logoSrc}" style="height:52px;max-width:180px;object-fit:contain;${logoFilter}" />`
    : `<div style="font-size:24px;font-weight:900;color:#FFF;letter-spacing:-0.04em">${company?.legal_name || "MODUS"}<span style="color:#E11D2C">.</span></div>`;

  const now = new Date();
  const nowStr = `${fmtDate(now.toISOString())} ${now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  @page { size: A4; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 210mm; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; color: #0A0A0A; background: #FFF; font-size: 12px; }

  /* Fixed header - repeats every page */
  .header-fixed { position: fixed; top: 0; left: 0; right: 0; z-index: 200; }
  .accent-bar { height: 3px; background: #E11D2C; }
  .header-band { background: #0A0A0A; padding: 18px 36px; display: flex; justify-content: space-between; align-items: center; }
  .header-right { text-align: right; }
  .report-title { font-size: 15px; font-weight: 800; color: #FFF; letter-spacing: -0.01em; }
  .report-meta { font-size: 10px; color: rgba(255,255,255,0.55); margin-top: 5px; line-height: 1.8; }

  /* Fixed footer */
  .footer-band { position: fixed; bottom: 0; left: 0; right: 0; background: #0A0A0A; padding: 10px 36px; display: flex; justify-content: space-between; align-items: center; z-index: 100; }
  .footer-left { font-size: 9px; color: rgba(255,255,255,0.45); }
  .footer-brand { font-size: 10px; color: #FFF; font-weight: 700; letter-spacing: 0.04em; }
  .footer-dot { display: inline-block; width: 7px; height: 7px; background: #E11D2C; border-radius: 2px; margin-right: 5px; vertical-align: middle; }

  /* Padding so content clears fixed elements */
  .page-wrap { padding-top: 114px; padding-bottom: 52px; }
  .body { padding: 20px 36px 24px; }

  /* Stats */
  .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 22px; }
  .stat { background: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 8px; padding: 13px 16px; }
  .stat-label { font-size: 8px; font-weight: 700; color: #9CA3AF; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 6px; }
  .stat-value { font-size: 17px; font-weight: 800; color: #0A0A0A; }
  .stat-value.red { color: #E11D2C; }

  /* Box table with vertical lines */
  table { width: 100%; border-collapse: collapse; border: 1px solid #E5E7EB; }
  thead { display: table-header-group; }
  th { background: #1A1A1A; padding: 8px 9px; text-align: left; font-size: 8px; font-weight: 700; color: rgba(255,255,255,0.75); text-transform: uppercase; letter-spacing: 0.08em; white-space: nowrap; border-right: 1px solid rgba(255,255,255,0.12); }
  th:last-child { border-right: none; }
  td { padding: 8px 9px; border-bottom: 1px solid #F0F0F0; border-right: 1px solid #E5E7EB; color: #374151; font-size: 11px; }
  td:last-child { border-right: none; }
  tr:nth-child(even) td { background: #FAFAFA; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .tfoot-row td { background: #0A0A0A; color: #FFF; font-weight: 700; border-top: 2px solid #E11D2C; border-bottom: none; border-right: 1px solid rgba(255,255,255,0.12); }
  .tfoot-row td:last-child { border-right: none; }
  tr { page-break-inside: avoid; }
</style>
</head>
<body>
  <div class="header-fixed">
    <div class="accent-bar"></div>
    <div class="header-band">
      <div>${logoHtml}</div>
      <div class="header-right">
        <div class="report-title">Payables Report</div>
        <div class="report-meta">
          Period: ${from ? fmtDate(from) : "\u2014"} \u2013 ${to ? fmtDate(to) : "\u2014"}<br/>
          ${bills.length} bill${bills.length !== 1 ? "s" : ""} &nbsp;\u00b7&nbsp; Generated ${nowStr}
          ${company?.gstin ? `<br/>GSTIN: ${company.gstin}` : ""}
        </div>
      </div>
    </div>
  </div>

  <div class="page-wrap">
    <div class="body">
      <div class="stats">
        <div class="stat"><div class="stat-label">Total Amount (INR)</div><div class="stat-value">${fmt(totals.amount)}</div></div>
        <div class="stat"><div class="stat-label">Total Paid (INR)</div><div class="stat-value" style="color:#059669">${fmt(totals.paid)}</div></div>
        <div class="stat"><div class="stat-label">Outstanding (INR)</div><div class="stat-value red">${fmt(totals.due)}</div></div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Bill #</th><th>Date</th><th>Title</th><th>Vendor / Employee</th><th>Category</th>
            <th style="text-align:right">Amount (INR)</th>
            <th style="text-align:right">Paid (INR)</th>
            <th style="text-align:right">Due (INR)</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr class="tfoot-row">
            <td colspan="5">Totals (${bills.length} bills, INR)</td>
            <td class="num">${fmt(totals.amount)}</td>
            <td class="num" style="color:#4ADE80">${fmt(totals.paid)}</td>
            <td class="num" style="color:#F87171">${fmt(totals.due)}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    </div>
  </div>

  <div class="footer-band">
    <div class="footer-left">Generated ${nowStr}</div>
    <div class="footer-brand"><span class="footer-dot"></span>ACUITY STUDIOS PVT LTD</div>
  </div>
</body>
</html>`;
}

export async function GET(request) {
  try {
    await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from") || "";
    const to = searchParams.get("to") || "";

    const [company] = await sql`SELECT * FROM company_settings LIMIT 1`;

    const bills = await sql`
      SELECT
        b.id, b.bill_number, b.title, b.category, b.status,
        b.amount, b.amount_paid, b.tax, b.bill_date, b.due_date,
        b.currency, b.exchange_rate,
        v.name AS vendor_name,
        e.name AS employee_name
      FROM bills b
      LEFT JOIN vendors v ON b.vendor_id = v.id
      LEFT JOIN employees e ON b.employee_id = e.id
      WHERE b.status != 'cancelled'
        AND (NULLIF(${from}, '') IS NULL OR b.bill_date >= NULLIF(${from}, '')::date)
        AND (NULLIF(${to}, '') IS NULL OR b.bill_date <= NULLIF(${to}, '')::date)
      ORDER BY b.bill_date ASC
    `;

    const html = buildBillsHtml({ company: company || null, bills, from, to });

    const browser = await launchBrowser();
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdf = await page.pdf({
      format: "A4",
      margin: { top: "0mm", right: "0mm", bottom: "0mm", left: "0mm" },
      printBackground: true,
    });
    await browser.close();

    return new Response(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="MODUS-Payables-${from || "all"}-to-${to || "all"}.pdf"`,
      },
    });
  } catch (err) {
    console.error("Bills PDF export error:", err);
    return Response.json({ error: "Export failed" }, { status: 500 });
  }
}
