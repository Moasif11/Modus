// Pure GSTR-2B reconciliation. No DB, no imports.
// Matches purchase invoices reported by suppliers (from a downloaded GSTR-2B JSON)
// against the ITC bills in our books — the Sec 16(2)(aa)/Rule 36(4) check.

const norm = (s) => String(s || "").trim().toUpperCase().replace(/\s+/g, "");
const round2 = (n) => Math.round((parseFloat(n) || 0) * 100) / 100;

// Extract the flat list of B2B invoices from a raw GSTR-2B JSON download.
// Handles the common shape: { data: { docdata: { b2b: [ { ctin, inv: [ { inum, dt, val, txval, ... itms:[{itm_det:{iamt,camt,samt}}] } ] } ] } } }
export function parse2bInvoices(raw) {
  const out = [];
  const b2b = raw?.data?.docdata?.b2b || raw?.docdata?.b2b || raw?.b2b || [];
  for (const supplier of b2b) {
    const ctin = supplier.ctin || supplier.gstin || "";
    for (const inv of supplier.inv || []) {
      // Tax can be at invoice level or summed from items.
      let iamt = inv.iamt, camt = inv.camt, samt = inv.samt, txval = inv.txval;
      if (iamt == null && Array.isArray(inv.itms)) {
        iamt = 0; camt = 0; samt = 0; txval = txval || 0;
        for (const it of inv.itms) {
          const d = it.itm_det || it;
          iamt += parseFloat(d.iamt) || 0;
          camt += parseFloat(d.camt) || 0;
          samt += parseFloat(d.samt) || 0;
          if (inv.txval == null) txval += parseFloat(d.txval) || 0;
        }
      }
      const tax = round2((parseFloat(iamt) || 0) + (parseFloat(camt) || 0) + (parseFloat(samt) || 0));
      out.push({
        supplierGstin: ctin,
        invoiceNumber: inv.inum || "",
        invoiceDate: inv.dt || null,
        taxable: round2(txval),
        tax,
        value: round2(inv.val),
      });
    }
  }
  return out;
}

// Reconcile book bills vs portal (2B) invoices.
// bills: [{ id, billNumber, vendorGstin, supplierInvNo, tax }]
// portal: [{ supplierGstin, invoiceNumber, tax, ... }]
export function reconcile2b(bills, portal) {
  const key = (gstin, inum) => `${norm(gstin)}|${norm(inum)}`;
  const portalMap = new Map();
  for (const p of portal) portalMap.set(key(p.supplierGstin, p.invoiceNumber), p);

  const matched = [], mismatched = [], missingIn2b = [];
  const usedPortalKeys = new Set();

  for (const b of bills) {
    const k = key(b.vendorGstin, b.supplierInvNo);
    const p = portalMap.get(k);
    if (!p) { missingIn2b.push(b); continue; }
    usedPortalKeys.add(k);
    if (Math.abs((parseFloat(b.tax) || 0) - (parseFloat(p.tax) || 0)) <= 1) {
      matched.push({ bill: b, portal: p });
    } else {
      mismatched.push({ bill: b, portal: p, taxDiff: round2((parseFloat(b.tax) || 0) - (parseFloat(p.tax) || 0)) });
    }
  }

  const missingInBooks = portal.filter((p) => !usedPortalKeys.has(key(p.supplierGstin, p.invoiceNumber)));

  return {
    matched,
    mismatched,
    missingIn2b,       // claimed in books, NOT in 2B → ITC at risk
    missingInBooks,    // in 2B, not in our books → unrecorded purchase / unclaimed ITC
    summary: {
      matchedCount: matched.length,
      mismatchedCount: mismatched.length,
      missingIn2bCount: missingIn2b.length,
      missingInBooksCount: missingInBooks.length,
      matchedTax: round2(matched.reduce((s, m) => s + (parseFloat(m.bill.tax) || 0), 0)),
      atRiskTax: round2(missingIn2b.reduce((s, b) => s + (parseFloat(b.tax) || 0), 0)),
    },
  };
}
