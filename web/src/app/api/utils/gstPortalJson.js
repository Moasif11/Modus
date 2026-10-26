// Pure transforms → GST portal offline-utility JSON. No DB, no imports.
// Takes the already-built report data (from reportData.js) and shapes it into the
// JSON the government GSTR-1 / GSTR-3B offline tools accept for upload.

const r2 = (n) => Math.round((parseFloat(n) || 0) * 100) / 100;

// Financial period MMYYYY from an ISO/date string (uses the period-end date).
export function fpFromDate(dateStr) {
  const d = new Date(dateStr);
  return `${String(d.getMonth() + 1).padStart(2, "0")}${d.getFullYear()}`;
}

// DD-MM-YYYY for portal invoice dates.
function idt(dateStr) {
  const d = new Date(dateStr);
  return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
}

function rate(taxable, tax) {
  const t = parseFloat(taxable) || 0;
  return t > 0 ? Math.round(((parseFloat(tax) || 0) / t) * 100) : 0;
}

function invItms(row) {
  const totalTax = (parseFloat(row.cgst) || 0) + (parseFloat(row.sgst) || 0) + (parseFloat(row.igst) || 0);
  return [{
    num: 1,
    itm_det: {
      rt: rate(row.taxableAmount, totalTax),
      txval: r2(row.taxableAmount),
      iamt: r2(row.igst),
      camt: r2(row.cgst),
      samt: r2(row.sgst),
      csamt: 0,
    },
  }];
}

function posCode(placeOfSupply) {
  // "Kerala (32)" → "32"
  const m = String(placeOfSupply || "").match(/\((\d{1,2})\)/);
  return m ? m[1].padStart(2, "0") : "";
}

// GSTR-1 offline JSON from buildGstr1 output.
export function toGstr1Json(g, gstin, periodDate) {
  const fp = fpFromDate(periodDate);

  // B2B grouped by counterparty GSTIN.
  const b2bMap = {};
  for (const r of g.b2b || []) {
    const ctin = r.customerGstin;
    if (!ctin) continue;
    (b2bMap[ctin] = b2bMap[ctin] || []).push({
      inum: r.invoiceNumber, idt: idt(r.invoiceDate), val: r2(r.grandTotal),
      pos: posCode(r.placeOfSupply), rchrg: r.reverseCharge || "N", inv_typ: "R", itms: invItms(r),
    });
  }
  const b2b = Object.entries(b2bMap).map(([ctin, inv]) => ({ ctin, inv }));

  // B2CL grouped by POS.
  const b2clMap = {};
  for (const r of g.b2cl || []) {
    const pos = posCode(r.placeOfSupply);
    (b2clMap[pos] = b2clMap[pos] || []).push({
      inum: r.invoiceNumber, idt: idt(r.invoiceDate), val: r2(r.grandTotal), itms: invItms(r),
    });
  }
  const b2cl = Object.entries(b2clMap).map(([pos, inv]) => ({ pos, inv }));

  // B2CS aggregated rate-wise × POS × supply-type.
  const b2csMap = {};
  for (const r of g.b2cs || []) {
    const totalTax = (parseFloat(r.cgst) || 0) + (parseFloat(r.sgst) || 0) + (parseFloat(r.igst) || 0);
    const rt = rate(r.taxableAmount, totalTax);
    const pos = posCode(r.placeOfSupply);
    const sply_ty = (parseFloat(r.igst) || 0) > 0 ? "INTER" : "INTRA";
    const k = `${sply_ty}|${rt}|${pos}`;
    if (!b2csMap[k]) b2csMap[k] = { sply_ty, rt, typ: "OE", pos, txval: 0, iamt: 0, camt: 0, samt: 0, csamt: 0 };
    b2csMap[k].txval = r2(b2csMap[k].txval + (parseFloat(r.taxableAmount) || 0));
    b2csMap[k].iamt = r2(b2csMap[k].iamt + (parseFloat(r.igst) || 0));
    b2csMap[k].camt = r2(b2csMap[k].camt + (parseFloat(r.cgst) || 0));
    b2csMap[k].samt = r2(b2csMap[k].samt + (parseFloat(r.sgst) || 0));
  }
  const b2cs = Object.values(b2csMap);

  // Exports (Table 6A) grouped by payment type.
  const expMap = {};
  for (const r of g.exports || []) {
    const typ = r.paymentType === "WPAY" ? "WPAY" : "WOPAY";
    (expMap[typ] = expMap[typ] || []).push({
      inum: r.invoiceNumber, idt: idt(r.invoiceDate), val: r2(r.grandTotal),
      itms: [{ txval: r2(r.taxableAmount), rt: 0, iamt: r2(r.igst), csamt: 0 }],
    });
  }
  const exp = Object.entries(expMap).map(([exp_typ, inv]) => ({ exp_typ, inv }));

  // Credit notes to registered (Table 9B / CDNR), grouped by counterparty GSTIN.
  const cdnrMap = {};
  for (const c of g.cdnr || []) {
    const ctin = c.customerGstin;
    if (!ctin) continue;
    (cdnrMap[ctin] = cdnrMap[ctin] || []).push({
      ntty: "C", nt_num: c.noteNumber, nt_dt: idt(c.noteDate), val: r2(c.totalAmount),
      pos: posCode(c.placeOfSupply), itms: invItms(c),
    });
  }
  const cdnr = Object.entries(cdnrMap).map(([ctin, nt]) => ({ ctin, nt }));

  return { gstin, fp, version: "GST3.2.0", hash: "hash", b2b, b2cl, b2cs, exp, cdnr };
}

// GSTR-3B offline JSON (summary) from buildGstr3b output.
export function toGstr3bJson(g, gstin, periodDate) {
  const t31a = g.table31?.a || {};
  const t31d = g.table31?.d || {};
  const t4 = g.table4 || {};
  return {
    gstin,
    ret_period: fpFromDate(periodDate),
    sup_details: {
      osup_det: { txval: r2(t31a.taxableValue), iamt: r2(t31a.igst), camt: r2(t31a.cgst), samt: r2(t31a.sgst), csamt: 0 },
      isup_rev: { txval: r2(t31d.taxableValue), iamt: r2(t31d.igst), camt: r2(t31d.cgst), samt: r2(t31d.sgst), csamt: 0 },
    },
    itc_elg: {
      itc_avl: [
        { ty: "IMPS", iamt: 0, camt: 0, samt: 0, csamt: 0 },
        { ty: "ISRC", iamt: r2(t4.A?.rcSupplies), camt: 0, samt: 0, csamt: 0 },
        { ty: "OTH", iamt: 0, camt: r2(t4.A?.allOther), samt: 0, csamt: 0 },
      ],
      itc_inelg: [{ ty: "OTH", iamt: 0, camt: r2(t4.D?.ineligible), samt: 0, csamt: 0 }],
    },
  };
}
