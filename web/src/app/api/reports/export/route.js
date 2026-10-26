import sql from "@/app/api/utils/sql";
import { requireAuth } from "@/app/api/utils/auth";
import { launchBrowser } from "@/app/api/utils/browser";
import { buildGstSummary, buildGstr1, buildGstr3b, buildHsn, buildProfitLoss } from "@/app/api/utils/reportData";

function fmt(n) {
  return `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtDate(d) {
  if (!d) return "";
  const iso = String(d).slice(0, 10).split("-");
  if (iso.length !== 3) return String(d);
  return `${iso[2]}/${iso[1]}/${iso[0].slice(2)}`;
}
function monthYear(d) {
  if (!d) return "";
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const iso = String(d).slice(0, 10).split("-");
  return `${months[Number(iso[1]) - 1]} ${iso[0]}`;
}

const REPORT_META = {
  summary: { title: "GST / Invoice Summary" },
  gstr1:   { title: "GSTR-1 — Outward Supplies" },
  gstr3b:  { title: "GSTR-3B — Summary Return" },
  hsn:     { title: "HSN-wise Summary" },
  pnl:     { title: "Profit & Loss Statement" },
};

// ── Shared page chrome ────────────────────────────────────────────────────────
const SHARED_CSS = `
  @page { size: A4; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 210mm; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; background:#FFF; color:#111827; font-size:11px; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  .body { padding: 22px 32px 26px; }
  .section { margin-bottom: 20px; }
  .section-title { font-size: 11px; font-weight: 800; color:#111827; letter-spacing:.04em; text-transform:uppercase; margin-bottom: 10px; display:flex; align-items:center; gap:8px; }
  .section-title::before { content:''; display:inline-block; width:3px; height:13px; background:#E11D2C; border-radius:2px; }
  .sub { font-size: 9.5px; color:#6B7280; margin: -6px 0 10px; }
  table { width:100%; border-collapse:collapse; border:1px solid #E5E7EB; }
  thead { display: table-header-group; }
  th { background:#111827; padding:7px 8px; text-align:left; font-size:8px; font-weight:700; color:rgba(255,255,255,.8); text-transform:uppercase; letter-spacing:.05em; border-right:1px solid rgba(255,255,255,.1); white-space:nowrap; }
  th:last-child { border-right:none; }
  td { padding:7px 8px; border-bottom:1px solid #F0F0F0; border-right:1px solid #EEE; font-size:9.5px; color:#374151; }
  td:last-child { border-right:none; }
  tr:nth-child(even) td { background:#FAFAFA; }
  tr { page-break-inside: avoid; }
  .num { text-align:right; font-variant-numeric:tabular-nums; }
  .tfoot td { background:#111827; color:#FFF; font-weight:700; border-bottom:none; font-size:9.5px; }
  .kpis { display:flex; gap:10px; margin-bottom:20px; }
  .kpi { flex:1; border:1px solid #E5E7EB; border-radius:10px; padding:12px 14px; background:#FFF; }
  .kpi-label { font-size:8px; font-weight:700; color:#9CA3AF; text-transform:uppercase; letter-spacing:.07em; margin-bottom:5px; }
  .kpi-value { font-size:15px; font-weight:800; color:#111827; letter-spacing:-.01em; }
  .muted { color:#9CA3AF; }
`;

function headerTemplate(company, title, from, to) {
  const logoSrc = company?.logo_dark_url || company?.logo_url;
  const logoFilter = (!company?.logo_dark_url && company?.logo_url) ? "filter:brightness(0) invert(1);" : "";
  const logoHtml = logoSrc
    ? `<img src="${logoSrc}" style="height:34px;max-width:120px;object-fit:contain;${logoFilter}" />`
    : `<span style="font-size:20px;font-weight:900;color:#FFF;letter-spacing:-.04em">${company?.legal_name || "MODUS"}<span style="color:#E11D2C">.</span></span>`;
  const period = from ? (to && to !== from ? `${monthYear(from)} – ${monthYear(to)}` : monthYear(from)) : "";
  const gstin = company?.gstin ? `<br/>GSTIN: ${company.gstin}` : "";
  return `
    <div style="width:100%;background:#0A0A0A;font-family:Arial,Helvetica,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact;">
      <div style="padding:13px 32px 11px;display:flex;justify-content:space-between;align-items:center;">
        <div>${logoHtml}</div>
        <div style="text-align:right;">
          <div style="font-size:12px;font-weight:900;color:#FFF;letter-spacing:.05em;text-transform:uppercase;">${title}</div>
          <div style="font-size:9px;font-weight:700;color:#E11D2C;margin-top:2px;">${period}</div>
          <div style="font-size:8px;color:rgba(255,255,255,.5);margin-top:3px;">${company?.legal_name || ""}${gstin}</div>
        </div>
      </div>
      <div style="height:3px;background:linear-gradient(to right,#E11D2C,#FF6B6B);"></div>
    </div>`;
}

function footerTemplate() {
  const now = new Date();
  const nowStr = `${String(now.getDate()).padStart(2,"0")}/${String(now.getMonth()+1).padStart(2,"0")}/${String(now.getFullYear()).slice(2)}`;
  return `
    <div style="width:100%;background:#0A0A0A;font-family:Arial,Helvetica,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact;padding:0 32px;height:32px;display:flex;justify-content:space-between;align-items:center;">
      <div style="font-size:8px;color:rgba(255,255,255,.45);">Generated ${nowStr}</div>
      <div style="font-size:8px;font-weight:700;color:#FFF;">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>
    </div>`;
}

// ── Body builders ─────────────────────────────────────────────────────────────
function bodySummary(d) {
  const rows = d.rows.map((r) => `
    <tr>
      <td style="font-weight:600;color:#111827;white-space:nowrap">${r.invoiceNumber || ""}</td>
      <td style="white-space:nowrap">${fmtDate(r.invoiceDate)}</td>
      <td>${r.customerName}</td>
      <td style="white-space:nowrap;font-size:8.5px" class="muted">${r.customerGstin || "—"}</td>
      <td class="num">${fmt(r.taxable)}</td>
      <td class="num">${fmt(r.cgst)}</td>
      <td class="num">${fmt(r.sgst)}</td>
      <td class="num">${fmt(r.igst)}</td>
      <td class="num">${fmt(r.totalTax)}</td>
      <td class="num" style="font-weight:700;color:#111827">${fmt(r.grandTotal)}</td>
    </tr>`).join("");
  const t = d.totals;
  return `
    <div class="kpis">
      <div class="kpi"><div class="kpi-label">Invoices</div><div class="kpi-value">${t.count}</div></div>
      <div class="kpi"><div class="kpi-label">Taxable Value</div><div class="kpi-value">${fmt(t.taxable)}</div></div>
      <div class="kpi"><div class="kpi-label">Total GST</div><div class="kpi-value" style="color:#E11D2C">${fmt(t.totalTax)}</div></div>
      <div class="kpi"><div class="kpi-label">Grand Total</div><div class="kpi-value">${fmt(t.grandTotal)}</div></div>
    </div>
    <div class="section">
      <div class="section-title">Invoice-wise GST Summary</div>
      <table>
        <thead><tr><th>Invoice</th><th>Date</th><th>Client</th><th>GSTIN</th><th class="num">Taxable</th><th class="num">CGST</th><th class="num">SGST</th><th class="num">IGST</th><th class="num">Total GST</th><th class="num">Grand Total</th></tr></thead>
        <tbody>${rows || `<tr><td colspan="10" style="text-align:center;padding:20px" class="muted">No invoices in this period</td></tr>`}</tbody>
        <tfoot><tr class="tfoot"><td colspan="4">TOTAL (${t.count})</td><td class="num">${fmt(t.taxable)}</td><td class="num">${fmt(t.cgst)}</td><td class="num">${fmt(t.sgst)}</td><td class="num">${fmt(t.igst)}</td><td class="num">${fmt(t.totalTax)}</td><td class="num">${fmt(t.grandTotal)}</td></tr></tfoot>
      </table>
    </div>`;
}

function gstrTable(title, tag, rows) {
  const body = rows.map((r) => `
    <tr>
      <td style="font-weight:600;white-space:nowrap">${r.invoiceNumber}</td>
      <td style="white-space:nowrap">${fmtDate(r.invoiceDate)}</td>
      <td>${r.customerName}</td>
      <td style="font-size:8.5px" class="muted">${r.customerGstin || "—"}</td>
      <td style="font-size:8.5px">${r.placeOfSupply || "—"}</td>
      <td class="num">${fmt(r.taxableAmount)}</td>
      <td class="num">${fmt(r.cgst + r.sgst)}</td>
      <td class="num">${fmt(r.igst)}</td>
      <td class="num" style="font-weight:700">${fmt(r.grandTotal)}</td>
    </tr>`).join("");
  const tax = rows.reduce((s, r) => s + r.taxableAmount, 0);
  const gt = rows.reduce((s, r) => s + r.grandTotal, 0);
  return `
    <div class="section">
      <div class="section-title">${tag} · ${title}</div>
      <table>
        <thead><tr><th>Invoice</th><th>Date</th><th>Recipient</th><th>GSTIN</th><th>Place of Supply</th><th class="num">Taxable</th><th class="num">CGST+SGST</th><th class="num">IGST</th><th class="num">Total</th></tr></thead>
        <tbody>${body || `<tr><td colspan="9" style="text-align:center;padding:16px" class="muted">No ${tag} supplies</td></tr>`}</tbody>
        ${rows.length ? `<tfoot><tr class="tfoot"><td colspan="5">TOTAL (${rows.length})</td><td class="num">${fmt(tax)}</td><td class="num">${fmt(rows.reduce((s,r)=>s+r.cgst+r.sgst,0))}</td><td class="num">${fmt(rows.reduce((s,r)=>s+r.igst,0))}</td><td class="num">${fmt(gt)}</td></tr></tfoot>` : ""}
      </table>
    </div>`;
}

function bodyGstr1(d) {
  return gstrTable("Supplies to Registered Businesses", "B2B", d.b2b)
    + gstrTable("Large Supplies to Unregistered (&gt; ₹2.5L)", "B2CL", d.b2cl)
    + gstrTable("Small Supplies to Unregistered", "B2CS", d.b2cs);
}

function bodyHsn(rows) {
  const body = rows.map((r) => `
    <tr>
      <td style="font-weight:600;white-space:nowrap">${r.hsn_sac_code || "—"}</td>
      <td>${r.item_name || ""}</td>
      <td class="muted">${r.unit || ""}</td>
      <td class="num">${Number(r.total_qty || 0).toFixed(2)}</td>
      <td class="num">${Number(r.gst_rate || 0).toFixed(0)}%</td>
      <td class="num">${fmt(r.taxable_value)}</td>
      <td class="num">${fmt(r.cgst)}</td>
      <td class="num">${fmt(r.sgst)}</td>
      <td class="num">${fmt(r.igst)}</td>
      <td class="num" style="font-weight:700">${fmt(r.total_value)}</td>
    </tr>`).join("");
  const sum = (f) => rows.reduce((s, r) => s + (parseFloat(r[f]) || 0), 0);
  return `
    <div class="section">
      <div class="section-title">HSN / SAC-wise Summary</div>
      <div class="sub">Consolidated outward supplies grouped by HSN/SAC code for the period.</div>
      <table>
        <thead><tr><th>HSN/SAC</th><th>Description</th><th>Unit</th><th class="num">Qty</th><th class="num">Rate</th><th class="num">Taxable</th><th class="num">CGST</th><th class="num">SGST</th><th class="num">IGST</th><th class="num">Total Value</th></tr></thead>
        <tbody>${body || `<tr><td colspan="10" style="text-align:center;padding:20px" class="muted">No data in this period</td></tr>`}</tbody>
        <tfoot><tr class="tfoot"><td colspan="5">TOTAL (${rows.length})</td><td class="num">${fmt(sum("taxable_value"))}</td><td class="num">${fmt(sum("cgst"))}</td><td class="num">${fmt(sum("sgst"))}</td><td class="num">${fmt(sum("igst"))}</td><td class="num">${fmt(sum("total_value"))}</td></tr></tfoot>
      </table>
    </div>`;
}

function bodyGstr3b(d) {
  const s = d.summary;
  const r31 = (label, t) => `<tr><td>${label}</td><td class="num">${fmt(t.taxableValue)}</td><td class="num">${fmt(t.igst || 0)}</td><td class="num">${fmt(t.cgst || 0)}</td><td class="num">${fmt(t.sgst || 0)}</td></tr>`;
  const t6 = (label, x) => `<tr><td>${label}</td><td class="num">${fmt(x.liability)}</td><td class="num">${fmt(x.itcPaid)}</td><td class="num">${fmt(x.cashPaid)}</td></tr>`;
  return `
    <div class="kpis">
      <div class="kpi"><div class="kpi-label">Outward Taxable</div><div class="kpi-value">${fmt(s.totalOutwardTaxable)}</div></div>
      <div class="kpi"><div class="kpi-label">Output Tax</div><div class="kpi-value">${fmt(s.totalOutwardTax)}</div></div>
      <div class="kpi"><div class="kpi-label">ITC Available</div><div class="kpi-value" style="color:#059669">${fmt(s.totalITC)}</div></div>
      <div class="kpi"><div class="kpi-label">Net Payable</div><div class="kpi-value" style="color:#E11D2C">${fmt(s.netTaxPayable)}</div></div>
    </div>
    <div class="section">
      <div class="section-title">3.1 — Outward & RC Supplies</div>
      <table>
        <thead><tr><th>Nature of Supply</th><th class="num">Taxable Value</th><th class="num">IGST</th><th class="num">CGST</th><th class="num">SGST</th></tr></thead>
        <tbody>
          ${r31("(a) Outward taxable (other than zero/nil)", d.table31.a)}
          ${r31("(b) Outward zero-rated", d.table31.b)}
          ${r31("(c) Other outward (nil/exempt)", d.table31.c)}
          ${r31("(d) Inward liable to reverse charge", d.table31.d)}
          <tr><td>(e) Non-GST outward</td><td class="num">${fmt(d.table31.e.taxableValue)}</td><td class="num">—</td><td class="num">—</td><td class="num">—</td></tr>
        </tbody>
      </table>
    </div>
    <div class="section">
      <div class="section-title">4 — Eligible ITC</div>
      <table>
        <thead><tr><th>Details</th><th class="num">IGST/CGST/SGST (Total)</th></tr></thead>
        <tbody>
          <tr><td>(A)(3) Inward supplies liable to reverse charge</td><td class="num">${fmt(d.table4.A.rcSupplies)}</td></tr>
          <tr><td>(A)(5) All other ITC</td><td class="num">${fmt(d.table4.A.allOther)}</td></tr>
          <tr class="tfoot"><td>(C) Net ITC Available</td><td class="num">${fmt(d.table4.C.net)}</td></tr>
        </tbody>
      </table>
    </div>
    <div class="section">
      <div class="section-title">6.1 — Payment of Tax</div>
      <table>
        <thead><tr><th>Head</th><th class="num">Tax Payable</th><th class="num">Paid via ITC</th><th class="num">Paid in Cash</th></tr></thead>
        <tbody>
          ${t6("IGST", d.table6.igst)}
          ${t6("CGST", d.table6.cgst)}
          ${t6("SGST/UTGST", d.table6.sgst)}
        </tbody>
      </table>
    </div>`;
}

function bodyPnl(d) {
  const CAT_LABEL = { expense:"General Expense", salary:"Salaries & Wages", utility:"Utilities", rent:"Rent", software:"Software & Subscriptions", travel:"Travel", marketing:"Marketing", equipment:"Equipment", professional:"Professional Fees", import:"Imports", other:"Other" };
  const expRows = d.expenseCategories.map((c) => `
    <tr>
      <td style="text-transform:capitalize">${CAT_LABEL[c.category] || (c.category || "Other").replace(/_/g," ")}</td>
      <td class="num muted">${c.billCount}</td>
      <td class="num">${fmt(c.netAmount)}</td>
    </tr>`).join("");
  const profitColor = d.netProfit >= 0 ? "#059669" : "#E11D2C";
  return `
    <div class="kpis">
      <div class="kpi"><div class="kpi-label">Revenue (net)</div><div class="kpi-value">${fmt(d.revenue.net)}</div></div>
      <div class="kpi"><div class="kpi-label">Total Expenses</div><div class="kpi-value">${fmt(d.totalExpenses)}</div></div>
      <div class="kpi"><div class="kpi-label">Net Profit</div><div class="kpi-value" style="color:${profitColor}">${fmt(d.netProfit)}</div></div>
      <div class="kpi"><div class="kpi-label">Margin</div><div class="kpi-value" style="color:${profitColor}">${d.margin.toFixed(1)}%</div></div>
    </div>
    <div class="section">
      <div class="section-title">Income</div>
      <table>
        <thead><tr><th>Description</th><th class="num">Count</th><th class="num">Amount</th></tr></thead>
        <tbody><tr><td>Invoiced revenue (excl. GST)</td><td class="num muted">${d.revenue.invoiceCount}</td><td class="num">${fmt(d.revenue.net)}</td></tr></tbody>
        <tfoot><tr class="tfoot"><td colspan="2">Total Income</td><td class="num">${fmt(d.revenue.net)}</td></tr></tfoot>
      </table>
    </div>
    <div class="section">
      <div class="section-title">Expenses by Category</div>
      <div class="sub">Approved &amp; paid expenses only (pending / rejected excluded). Net of input tax.</div>
      <table>
        <thead><tr><th>Category</th><th class="num">Bills</th><th class="num">Amount</th></tr></thead>
        <tbody>${expRows || `<tr><td colspan="3" style="text-align:center;padding:16px" class="muted">No expenses in this period</td></tr>`}</tbody>
        <tfoot><tr class="tfoot"><td colspan="2">Total Expenses</td><td class="num">${fmt(d.totalExpenses)}</td></tr></tfoot>
      </table>
    </div>
    <div class="section">
      <table>
        <tbody>
          <tr><td style="font-weight:700">Total Income</td><td class="num" style="font-weight:700">${fmt(d.revenue.net)}</td></tr>
          <tr><td style="font-weight:700">Less: Total Expenses</td><td class="num" style="font-weight:700">(${fmt(d.totalExpenses)})</td></tr>
          <tr class="tfoot"><td>NET PROFIT / (LOSS)</td><td class="num" style="color:${d.netProfit>=0?'#4ADE80':'#F87171'}">${fmt(d.netProfit)}</td></tr>
        </tbody>
      </table>
    </div>`;
}

async function buildBody(report, from, to) {
  switch (report) {
    case "summary": return bodySummary(await buildGstSummary(from, to));
    case "gstr1":   return bodyGstr1(await buildGstr1(from, to));
    case "gstr3b":  return bodyGstr3b(await buildGstr3b(from, to));
    case "hsn":     return bodyHsn(await buildHsn(from, to));
    case "pnl":     return bodyPnl(await buildProfitLoss(from, to));
    default:        return bodySummary(await buildGstSummary(from, to));
  }
}

export async function GET(request) {
  try {
    await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from") || "";
    const to = searchParams.get("to") || "";
    const report = searchParams.get("report") || "summary";
    const meta = REPORT_META[report] || REPORT_META.summary;

    const [company] = await sql`SELECT * FROM company_settings LIMIT 1`;
    const body = await buildBody(report, from, to);

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${SHARED_CSS}</style></head><body><div class="body">${body}</div></body></html>`;

    const browser = await launchBrowser();
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdf = await page.pdf({
      format: "A4",
      displayHeaderFooter: true,
      headerTemplate: headerTemplate(company || null, meta.title, from, to),
      footerTemplate: footerTemplate(),
      margin: { top: "22mm", right: "0mm", bottom: "13mm", left: "0mm" },
      printBackground: true,
    });
    await browser.close();

    const label = from && to ? `${from}-to-${to}` : "all";
    return new Response(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${meta.title.replace(/[^a-z0-9]+/gi, "-")}-${label}.pdf"`,
      },
    });
  } catch (err) {
    console.error("Reports export error:", err);
    return Response.json({ error: "Export failed" }, { status: 500 });
  }
}
