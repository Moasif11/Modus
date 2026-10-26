import sql from "@/app/api/utils/sql";
import { isExportSupply, exportTable, exportPaymentType, toINR } from "@/app/api/utils/exportReporting";
import { ensureCreditNoteTables } from "@/app/api/utils/refundSchema";

const B2C_LARGE_LIMIT = 250000;

function sumInv(rows, field) {
  return rows.reduce((s, r) => s + (parseFloat(r[field]) || 0), 0);
}

// ── GST / Invoice Summary ─────────────────────────────────────────────────────
export async function buildGstSummary(from, to) {
  const invoices = await sql`
    SELECT
      i.id, i.invoice_number, i.invoice_date, i.status,
      i.grand_total, i.taxable_amount,
      i.cgst_amount, i.sgst_amount, i.igst_amount, i.total_tax,
      i.is_interstate,
      c.company_name AS customer_company, c.name AS customer_name, c.gstin AS customer_gstin
    FROM invoices i
    LEFT JOIN customers c ON i.customer_id = c.id
    WHERE i.is_archived = false
      AND i.status NOT IN ('draft', 'cancelled')
      AND i.invoice_date >= ${from}
      AND i.invoice_date <= ${to}
    ORDER BY i.invoice_date ASC
  `;
  const rows = invoices.map((i) => ({
    invoiceNumber: i.invoice_number,
    invoiceDate: i.invoice_date,
    customerName: i.customer_company || i.customer_name || "—",
    customerGstin: i.customer_gstin || "",
    taxable: parseFloat(i.taxable_amount ?? (i.grand_total - i.total_tax)) || 0,
    cgst: parseFloat(i.cgst_amount) || 0,
    sgst: parseFloat(i.sgst_amount) || 0,
    igst: parseFloat(i.igst_amount) || 0,
    totalTax: parseFloat(i.total_tax) || 0,
    grandTotal: parseFloat(i.grand_total) || 0,
    status: i.status,
  }));
  const totals = {
    count: rows.length,
    taxable: sumInv(rows, "taxable"),
    cgst: sumInv(rows, "cgst"),
    sgst: sumInv(rows, "sgst"),
    igst: sumInv(rows, "igst"),
    totalTax: sumInv(rows, "totalTax"),
    grandTotal: sumInv(rows, "grandTotal"),
  };
  return { rows, totals };
}

// ── GSTR-1 — Outward supplies (B2B / B2CL / B2CS) ─────────────────────────────
export async function buildGstr1(from, to) {
  const invoices = await sql`
    SELECT
      i.id, i.invoice_number, i.invoice_date, i.grand_total, i.taxable_amount,
      i.cgst_amount, i.sgst_amount, i.igst_amount, i.total_tax,
      i.is_interstate, i.place_of_supply, i.place_of_supply_code,
      i.reverse_charge, i.gst_category, i.currency, i.exchange_rate,
      c.company_name AS customer_company, c.name AS customer_name,
      c.gstin AS customer_gstin, c.state AS customer_state, c.state_code AS customer_state_code
    FROM invoices i
    LEFT JOIN customers c ON i.customer_id = c.id
    WHERE i.is_archived = false
      AND i.status NOT IN ('draft', 'cancelled')
      AND i.invoice_date >= ${from}
      AND i.invoice_date <= ${to}
    ORDER BY i.invoice_date ASC
  `;
  const b2b = [], b2cl = [], b2cs = [], exports = [];
  for (const inv of invoices) {
    const category = inv.gst_category || (inv.customer_gstin ? "B2B" : "B2C");

    // Exports / SEZ / deemed exports (Table 6) — zero-rated, reported in INR. Excluded from B2B/B2C.
    if (isExportSupply(category)) {
      const rate = inv.exchange_rate;
      exports.push({
        invoiceNumber: inv.invoice_number,
        invoiceDate: inv.invoice_date,
        customerName: inv.customer_company || inv.customer_name || "—",
        currency: inv.currency || "INR",
        exchangeRate: parseFloat(inv.exchange_rate || 1),
        table: exportTable(category),               // 6A / 6B / 6C
        paymentType: exportPaymentType(category),   // WPAY / WOPAY
        taxableAmount: toINR(inv.taxable_amount, rate),
        igst: toINR(inv.igst_amount, rate),          // 0 for WOPAY (LUT)
        grandTotal: toINR(inv.grand_total, rate),
        gstCategory: category,
      });
      continue;
    }

    const row = {
      invoiceNumber: inv.invoice_number,
      invoiceDate: inv.invoice_date,
      customerName: inv.customer_company || inv.customer_name || "—",
      customerGstin: inv.customer_gstin || "",
      placeOfSupply: `${inv.place_of_supply || ""} (${inv.place_of_supply_code || ""})`.trim(),
      taxableAmount: parseFloat(inv.taxable_amount) || 0,
      cgst: parseFloat(inv.cgst_amount) || 0,
      sgst: parseFloat(inv.sgst_amount) || 0,
      igst: parseFloat(inv.igst_amount) || 0,
      totalTax: parseFloat(inv.total_tax) || 0,
      grandTotal: parseFloat(inv.grand_total) || 0,
      reverseCharge: inv.reverse_charge ? "Y" : "N",
      gstCategory: category,
    };
    if (category === "B2B" || inv.customer_gstin) b2b.push(row);
    // B2CL = inter-state unregistered supplies above the threshold; intra-state large B2C falls to B2CS.
    else if (inv.is_interstate && parseFloat(inv.grand_total) > B2C_LARGE_LIMIT) b2cl.push(row);
    else b2cs.push(row);
  }

  // Credit notes (Sec 34) — GSTR-1 Table 9B: CDNR (to registered) / CDNUR (to unregistered).
  await ensureCreditNoteTables();
  const cnRows = await sql`
    SELECT cn.credit_note_number, cn.credit_note_date, cn.taxable_amount, cn.cgst_amount,
           cn.sgst_amount, cn.igst_amount, cn.total_tax, cn.total_amount, cn.gst_category,
           cn.place_of_supply, cn.place_of_supply_code, cn.is_interstate,
           i.invoice_number AS orig_invoice_number, i.invoice_date AS orig_invoice_date,
           c.company_name AS customer_company, c.name AS customer_name, c.gstin AS customer_gstin
    FROM credit_notes cn
    LEFT JOIN invoices i ON cn.invoice_id = i.id
    LEFT JOIN customers c ON cn.customer_id = c.id
    WHERE cn.status = 'issued'
      AND cn.credit_note_date >= ${from} AND cn.credit_note_date <= ${to}
    ORDER BY cn.credit_note_date ASC
  `;
  const cdnr = [], cdnur = [];
  for (const cn of cnRows) {
    const r = {
      noteNumber: cn.credit_note_number,
      noteDate: cn.credit_note_date,
      noteType: "C", // Credit note
      originalInvoice: cn.orig_invoice_number || "—",
      originalInvoiceDate: cn.orig_invoice_date,
      customerName: cn.customer_company || cn.customer_name || "—",
      customerGstin: cn.customer_gstin || "",
      placeOfSupply: `${cn.place_of_supply || ""} (${cn.place_of_supply_code || ""})`.trim(),
      taxableAmount: parseFloat(cn.taxable_amount) || 0,
      cgst: parseFloat(cn.cgst_amount) || 0,
      sgst: parseFloat(cn.sgst_amount) || 0,
      igst: parseFloat(cn.igst_amount) || 0,
      totalTax: parseFloat(cn.total_tax) || 0,
      totalAmount: parseFloat(cn.total_amount) || 0,
    };
    if (cn.gst_category === "registered_regular" || cn.gst_category === "registered_composition" || cn.customer_gstin) cdnr.push(r);
    else cdnur.push(r);
  }

  return { b2b, b2cl, b2cs, exports, cdnr, cdnur };
}

// ── HSN/SAC-wise summary (raw snake_case rows; consumed by UI + export) ────────
export async function buildHsn(from, to) {
  return await sql`
    SELECT
      ii.hsn_sac_code, ii.item_name, ii.unit,
      SUM(ii.quantity)      AS total_qty,
      SUM(ii.taxable_value) AS taxable_value,
      SUM(ii.cgst_amount)   AS cgst,
      SUM(ii.sgst_amount)   AS sgst,
      SUM(ii.igst_amount)   AS igst,
      SUM(ii.total_tax)     AS total_tax,
      SUM(ii.line_total)    AS total_value,
      MAX(ii.gst_rate)      AS gst_rate
    FROM invoice_items ii
    JOIN invoices i ON ii.invoice_id = i.id
    WHERE i.is_archived = false
      AND i.status NOT IN ('draft', 'cancelled')
      AND i.invoice_date >= ${from}
      AND i.invoice_date <= ${to}
    GROUP BY ii.hsn_sac_code, ii.item_name, ii.unit
    ORDER BY SUM(ii.taxable_value) DESC
  `;
}

// ── GSTR-3B — Summary return ──────────────────────────────────────────────────
export async function buildGstr3b(from, to) {
  const invoices = await sql`
    SELECT
      i.id, i.invoice_number, i.invoice_date,
      i.grand_total, i.taxable_amount,
      i.cgst_amount, i.sgst_amount, i.igst_amount, i.total_tax,
      i.is_interstate, i.place_of_supply, i.place_of_supply_code,
      i.reverse_charge, i.gst_category,
      c.gstin AS customer_gstin, c.state AS customer_state
    FROM invoices i
    LEFT JOIN customers c ON i.customer_id = c.id
    WHERE i.is_archived = false
      AND i.status NOT IN ('draft', 'cancelled')
      AND i.invoice_date >= ${from}
      AND i.invoice_date <= ${to}
  `;
  // 3.1(a): all outward taxable supplies (a service agency rarely issues RC outward invoices),
  // NET of issued credit notes (Sec 34) dated in the period.
  const normalInvoices = invoices;
  await ensureCreditNoteTables();
  const cnAgg = (await sql`
    SELECT
      COALESCE(SUM(taxable_amount),0) AS taxable,
      COALESCE(SUM(CASE WHEN is_interstate THEN igst_amount ELSE 0 END),0) AS igst,
      COALESCE(SUM(CASE WHEN NOT is_interstate THEN cgst_amount ELSE 0 END),0) AS cgst,
      COALESCE(SUM(CASE WHEN NOT is_interstate THEN sgst_amount ELSE 0 END),0) AS sgst,
      COALESCE(SUM(total_tax),0) AS total_tax
    FROM credit_notes
    WHERE status = 'issued' AND credit_note_date >= ${from} AND credit_note_date <= ${to}
  `)[0];
  const cnTaxable = parseFloat(cnAgg.taxable) || 0;
  const cnIgst = parseFloat(cnAgg.igst) || 0;
  const cnCgst = parseFloat(cnAgg.cgst) || 0;
  const cnSgst = parseFloat(cnAgg.sgst) || 0;
  const cnTotalTax = parseFloat(cnAgg.total_tax) || 0;

  const taxable31a = {
    taxableValue: sumInv(normalInvoices, "taxable_amount") - cnTaxable,
    igst: sumInv(normalInvoices.filter((i) => i.is_interstate), "igst_amount") - cnIgst,
    cgst: sumInv(normalInvoices.filter((i) => !i.is_interstate), "cgst_amount") - cnCgst,
    sgst: sumInv(normalInvoices.filter((i) => !i.is_interstate), "sgst_amount") - cnSgst,
    cess: 0,
  };
  const taxable31b = { taxableValue: 0, igst: 0, cgst: 0, sgst: 0, cess: 0 };
  const taxable31c = { taxableValue: 0, igst: 0, cgst: 0, sgst: 0, cess: 0 };

  // 3.1(d): INWARD supplies liable to reverse charge — sourced from RCM bills (self-invoiced),
  // not outward invoices (audit M4 fix). Imports of service => IGST.
  const rcmBillRows = await sql`
    SELECT rcm_rate, rcm_tax_amount FROM bills
    WHERE is_rcm = true AND status NOT IN ('cancelled', 'pending', 'rejected', 'draft')
      AND bill_date >= ${from} AND bill_date <= ${to}
  `;
  const rcmLiability = rcmBillRows.reduce((s, b) => s + (parseFloat(b.rcm_tax_amount) || 0), 0);
  const rcmTaxable = rcmBillRows.reduce((s, b) => {
    const rate = parseFloat(b.rcm_rate) || 0;
    return s + (rate > 0 ? (parseFloat(b.rcm_tax_amount) || 0) / (rate / 100) : 0);
  }, 0);
  const r2 = (n) => Math.round((n || 0) * 100) / 100;
  const taxable31d = { taxableValue: r2(rcmTaxable), igst: r2(rcmLiability), cgst: 0, sgst: 0, cess: 0 };
  const taxable31e = { taxableValue: 0 };

  const interstateUnreg = normalInvoices.filter((i) => i.is_interstate && (!i.customer_gstin || ["B2C", "B2CL", "B2CS"].includes(i.gst_category)));
  const posSummary = {};
  for (const inv of interstateUnreg) {
    const pos = `${inv.place_of_supply || "—"} (${inv.place_of_supply_code || "—"})`;
    if (!posSummary[pos]) posSummary[pos] = { pos, taxableValue: 0, igst: 0 };
    posSummary[pos].taxableValue += parseFloat(inv.taxable_amount) || 0;
    posSummary[pos].igst += parseFloat(inv.igst_amount) || 0;
  }
  const table32Unreg = Object.values(posSummary);

  // ITC split by eligibility (audit C2): only 'eligible' bills feed Table 4(A); blocked
  // (Sec 17(5) / out-of-scope) credits go to Table 4(D). RCM ITC is shown in 4(A)(3).
  const itcBills = await sql`
    SELECT tax, itc_eligibility, is_rcm, rcm_tax_amount
    FROM bills
    WHERE bill_date >= ${from} AND bill_date <= ${to}
      AND status NOT IN ('cancelled', 'pending', 'rejected', 'draft')
  `;
  const eligibleNonRcmItc = itcBills.filter((b) => b.itc_eligibility === "eligible" && !b.is_rcm).reduce((s, b) => s + (parseFloat(b.tax) || 0), 0);
  const rcmItc = itcBills.filter((b) => b.is_rcm && b.itc_eligibility === "eligible").reduce((s, b) => s + (parseFloat(b.rcm_tax_amount) || 0), 0);
  const blockedItc = itcBills.filter((b) => b.itc_eligibility && b.itc_eligibility !== "eligible").reduce((s, b) => s + (parseFloat(b.tax) || 0) + (parseFloat(b.rcm_tax_amount) || 0), 0);
  const table4A = {
    importGoods: 0, importServices: 0,
    rcSupplies: r2(rcmItc),
    isd: 0, allOther: r2(eligibleNonRcmItc), total: r2(rcmItc + eligibleNonRcmItc),
  };
  const table4B = { rcRules42: 0, rcRules43: 0, total: 0 };
  const table4C = { net: r2(table4A.total - table4B.total) };
  const table4D = { ineligible: r2(blockedItc), reversedOther: 0 };
  const itcTotal = table4A.total;

  const table5 = {
    interstateSuppliesFromReg: 0, interstateSuppliesFromUnreg: 0,
    intrastateSuppliesFromReg: 0, intrastateSuppliesFromUnreg: 0,
  };

  // Output liability is net of issued credit notes (Sec 34) + RCM added in cash.
  const totalIgstLiability = sumInv(invoices.filter((i) => i.is_interstate), "igst_amount") - cnIgst + rcmLiability;
  const totalCgstLiability = sumInv(invoices.filter((i) => !i.is_interstate), "cgst_amount") - cnCgst;
  const totalSgstLiability = sumInv(invoices.filter((i) => !i.is_interstate), "sgst_amount") - cnSgst;
  const netIgst = Math.max(0, totalIgstLiability - table4C.net);

  const table6 = {
    igst: { liability: totalIgstLiability, itcPaid: Math.min(table4C.net, totalIgstLiability), cashPaid: netIgst, interest: 0, late_fee: 0 },
    cgst: { liability: totalCgstLiability, itcPaid: 0, cashPaid: Math.max(0, totalCgstLiability), interest: 0, late_fee: 0 },
    sgst: { liability: totalSgstLiability, itcPaid: 0, cashPaid: Math.max(0, totalSgstLiability), interest: 0, late_fee: 0 },
    cess: { liability: 0, itcPaid: 0, cashPaid: 0, interest: 0, late_fee: 0 },
  };

  const totalOutwardTaxable = taxable31a.taxableValue + taxable31d.taxableValue;
  // RCM liability is paid in cash (3.1(d)) and offset by its ITC (4A(3)).
  const totalOutwardTax = sumInv(invoices, "total_tax") - cnTotalTax + rcmLiability;
  const totalITC = table4C.net;
  const netTaxPayable = Math.max(0, totalOutwardTax - totalITC);

  return {
    period: { from, to },
    summary: { totalOutwardTaxable, totalOutwardTax, totalITC, netTaxPayable, invoiceCount: invoices.length, billCount: itcBills.length },
    table31: { a: taxable31a, b: taxable31b, c: taxable31c, d: taxable31d, e: taxable31e },
    table32: { unregistered: table32Unreg, compositionTax: [], uin: [] },
    table4: { A: table4A, B: table4B, C: table4C, D: table4D },
    table5,
    table6,
  };
}

// ── Profit & Loss ─────────────────────────────────────────────────────────────
export async function buildProfitLoss(from, to) {
  const [rev] = await sql`
    SELECT
      COALESCE(SUM(taxable_amount), 0) AS revenue_taxable,
      COALESCE(SUM(grand_total - total_tax), 0) AS revenue_net,
      COALESCE(SUM(total_tax), 0) AS output_tax,
      COUNT(*) AS invoice_count
    FROM invoices
    WHERE is_archived = false
      AND status NOT IN ('draft', 'cancelled')
      AND invoice_date >= ${from} AND invoice_date <= ${to}
  `;
  // Expenses by category (approved/paid only — exclude pending/rejected/cancelled).
  const byCategory = await sql`
    SELECT category,
           COALESCE(SUM((amount - tax) * COALESCE(exchange_rate, 1.0)), 0) AS net_amount,
           COALESCE(SUM(tax * COALESCE(exchange_rate, 1.0)), 0) AS input_tax,
           COUNT(*) AS bill_count
    FROM bills
    WHERE status NOT IN ('cancelled', 'pending', 'rejected', 'draft')
      AND bill_date >= ${from} AND bill_date <= ${to}
    GROUP BY category
    ORDER BY net_amount DESC
  `;
  const expenseCategories = byCategory.map((r) => ({
    category: r.category || "other",
    netAmount: parseFloat(r.net_amount) || 0,
    inputTax: parseFloat(r.input_tax) || 0,
    billCount: parseInt(r.bill_count) || 0,
  }));
  const revenueNet = parseFloat(rev.revenue_net) || 0;
  const totalExpenses = expenseCategories.reduce((s, c) => s + c.netAmount, 0);
  const netProfit = revenueNet - totalExpenses;
  const margin = revenueNet > 0 ? (netProfit / revenueNet) * 100 : 0;

  return {
    period: { from, to },
    revenue: {
      net: revenueNet,
      taxable: parseFloat(rev.revenue_taxable) || 0,
      outputTax: parseFloat(rev.output_tax) || 0,
      invoiceCount: parseInt(rev.invoice_count) || 0,
    },
    expenseCategories,
    totalExpenses,
    netProfit,
    margin,
  };
}

// ── TDS — payable (26Q register) + receivable (26AS reconciliation) ───────────
export async function buildTds(from, to) {
  // TDS we deducted on vendor/contractor bills (deposit + file 26Q).
  const payableRows = await sql`
    SELECT b.bill_number, b.bill_date, b.tds_section, b.tds_rate, b.tds_amount,
           b.amount, b.tax, b.tds_deposited,
           COALESCE(v.name, b.payee, e.name, '—') AS deductee,
           v.pan AS vendor_pan, e.pan AS employee_pan
    FROM bills b
    LEFT JOIN vendors v ON b.vendor_id = v.id
    LEFT JOIN employees e ON b.employee_id = e.id
    WHERE b.tds_amount > 0
      AND b.status NOT IN ('cancelled', 'rejected', 'draft')
      AND b.bill_date >= ${from} AND b.bill_date <= ${to}
    ORDER BY b.bill_date ASC
  `;
  const payable = payableRows.map((r) => ({
    billNumber: r.bill_number,
    billDate: r.bill_date,
    deductee: r.deductee,
    pan: r.vendor_pan || r.employee_pan || "—",
    section: r.tds_section || "—",
    rate: parseFloat(r.tds_rate) || 0,
    base: (parseFloat(r.amount) || 0) - (parseFloat(r.tax) || 0),
    tdsAmount: parseFloat(r.tds_amount) || 0,
    deposited: !!r.tds_deposited,
  }));
  const bySection = {};
  for (const r of payable) {
    if (!bySection[r.section]) bySection[r.section] = { section: r.section, count: 0, tds: 0 };
    bySection[r.section].count += 1;
    bySection[r.section].tds += r.tdsAmount;
  }

  // TDS clients deducted on our invoices (reconcile with 26AS/AIS, claim in ITR).
  const receivableRows = await sql`
    SELECT i.invoice_number, i.invoice_date, i.tds_section, i.tds_rate, i.tds_amount,
           COALESCE(c.company_name, c.name, '—') AS customer
    FROM invoices i
    LEFT JOIN customers c ON i.customer_id = c.id
    WHERE i.tds_amount > 0 AND i.is_archived = false
      AND i.status NOT IN ('draft', 'cancelled')
      AND i.invoice_date >= ${from} AND i.invoice_date <= ${to}
    ORDER BY i.invoice_date ASC
  `;
  const receivable = receivableRows.map((r) => ({
    invoiceNumber: r.invoice_number,
    invoiceDate: r.invoice_date,
    customer: r.customer,
    section: r.tds_section || "—",
    rate: parseFloat(r.tds_rate) || 0,
    tdsAmount: parseFloat(r.tds_amount) || 0,
  }));

  return {
    period: { from, to },
    payable,
    payableBySection: Object.values(bySection),
    payableTotal: payable.reduce((s, r) => s + r.tdsAmount, 0),
    receivable,
    receivableTotal: receivable.reduce((s, r) => s + r.tdsAmount, 0),
  };
}
