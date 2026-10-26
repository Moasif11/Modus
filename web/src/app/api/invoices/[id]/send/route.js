import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import sql from "@/app/api/utils/sql";
import { requireAuth, logAudit } from "@/app/api/utils/auth";
import { sendMail } from "@/app/api/utils/mailer";
import InvoiceDocument from "@/components/InvoiceDocument";

// Map a DB invoice row (with company_* / customer_* joins + snapshots) to the EXACT props
// the on-screen <InvoiceDocument> preview uses, then render the real component to HTML so the
// emailed PDF (and body) are pixel-identical to the preview.
const TEMPLATE_BY_ID = { 1: "modern", 2: "minimal", 3: "classic" };
function parseSnap(v) {
  if (!v) return null;
  try { return typeof v === "string" ? JSON.parse(v) : v; } catch { return null; }
}
function buildInvoiceDocHtml(inv, items, forEmail = false, docType = "invoice") {
  const snapSeller = parseSnap(inv.snapshot_seller_json);
  const snapBuyer = parseSnap(inv.snapshot_buyer_json);

  const seller = (snapSeller && Object.keys(snapSeller).length)
    ? { ...snapSeller, registeredName: snapSeller.registeredName || inv.company_registered_name }
    : {
        legalName: inv.company_legal_name, registeredName: inv.company_registered_name,
        addressLine1: inv.company_address_line1, addressLine2: inv.company_address_line2,
        city: inv.company_city, state: inv.company_state, pincode: inv.company_pincode,
        gstin: inv.company_gstin, email: inv.company_email, phone: inv.company_phone,
        bankName: inv.company_bank_name, accountNumber: inv.company_account_number,
        accountHolderName: inv.company_account_holder_name, ifsc: inv.company_ifsc,
        upiId: inv.company_upi_id, signatureUrl: inv.company_signature_url, website: inv.company_website,
      };

  const customer = (snapBuyer && Object.keys(snapBuyer).length)
    ? snapBuyer
    : {
        companyName: inv.customer_company_name, name: inv.customer_name, gstin: inv.customer_gstin,
        billingAddress: inv.customer_billing_address, city: inv.customer_city, state: inv.customer_state,
        pincode: inv.customer_pincode, country: inv.customer_country,
        email: inv.customer_email, phone: inv.customer_phone,
      };

  // Proforma and quote rows name these columns differently, but carry the same meaning.
  const invoice = {
    invoiceNumber: inv.invoice_number || inv.proforma_number || inv.quote_number,
    invoiceDate: inv.invoice_date || inv.proforma_date || inv.quote_date,
    dueDate: inv.due_date || inv.valid_until,
    poNumber: inv.po_number, reverseCharge: inv.reverse_charge, paymentTerms: inv.payment_terms,
    currency: inv.currency || "INR", subtotal: parseFloat(inv.subtotal || 0),
    totalDiscount: parseFloat(inv.total_discount || 0), taxableAmount: parseFloat(inv.taxable_amount || 0),
    cgstAmount: parseFloat(inv.cgst_amount || 0), sgstAmount: parseFloat(inv.sgst_amount || 0),
    igstAmount: parseFloat(inv.igst_amount || 0), roundOff: parseFloat(inv.round_off || 0),
    grandTotal: parseFloat(inv.grand_total || 0), amountInWords: inv.amount_in_words,
    isInterstate: inv.is_interstate, notes: inv.notes, terms: inv.terms, declaration: inv.declaration,
    paymentMethod: inv.payment_method, servicePeriodFrom: inv.service_period_from, servicePeriodTo: inv.service_period_to,
  };

  const docItems = (items || []).map((it) => ({
    itemName: it.item_name, description: it.description, hsnSacCode: it.hsn_sac_code,
    quantity: parseFloat(it.quantity || 0), unit: it.unit, unitPrice: parseFloat(it.unit_price || 0),
    taxableValue: parseFloat(it.taxable_value || 0), gstRate: parseFloat(it.gst_rate || 0),
    cgstRate: parseFloat(it.cgst_rate || 0), sgstRate: parseFloat(it.sgst_rate || 0), igstRate: parseFloat(it.igst_rate || 0),
    cgstAmount: parseFloat(it.cgst_amount || 0), sgstAmount: parseFloat(it.sgst_amount || 0), igstAmount: parseFloat(it.igst_amount || 0),
    lineTotal: parseFloat(it.line_total || 0),
  }));

  const template = TEMPLATE_BY_ID[inv.template_id] || "modern";
  const inner = renderToStaticMarkup(
    React.createElement(InvoiceDocument, { invoice, customer, items: docItems, seller, template, mode: "print", docType }),
  );

  const fonts = `@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap');`;

  if (forEmail) {
    // Email body: invoice sits on a faint off-white backdrop so the white sheet stands out,
    // with a short greeting line. (PDF attachment below is the exact A4 copy.)
    const buyerName = (snapBuyer && (snapBuyer.companyName || snapBuyer.name)) || inv.customer_company_name || inv.customer_name || "there";
    return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<style>${fonts}
* { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
html, body { margin: 0; padding: 0; background: #ECECEE; font-family: 'Manrope', sans-serif; }</style></head>
<body>
  <div style="max-width: 840px; margin: 0 auto; padding: 26px 18px 32px;">
    <p style="font-size: 14px; line-height: 1.6; color: #374151; margin: 0 0 18px;">Hi ${escHtml(buyerName)},<br/>Please find your invoice <strong>${escHtml(inv.invoice_number)}</strong> below. A printable PDF copy is attached for your records.</p>
    <div style="border-radius: 8px; overflow: hidden; box-shadow: 0 8px 30px rgba(0,0,0,0.12); border: 1px solid #E2E2E5;">${inner}</div>
    <p style="font-size: 11.5px; color: #9CA3AF; text-align: center; margin: 20px 0 0;">This is an automated email from ${escHtml(inv.company_registered_name || inv.company_legal_name || "MODUS")}.</p>
  </div>
</body></html>`;
  }

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8" />
<style>${fonts}
@page { size: A4; margin: 0; }
* { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
html, body { margin: 0; padding: 0; background: #fff; }
</style></head><body>${inner}</body></html>`;
}

const SOCIALS = {
  instagram: "",
  linkedin: "",
  x: "",
};

const PAYMENT_LABELS = {
  bank_transfer: "Bank Transfer (NEFT/RTGS/IMPS)",
  upi: "UPI",
  cheque: "Cheque",
  cash: "Cash",
  card: "Card",
  wire: "International Wire Transfer",
  other: "Other",
};

function fmt(n) {
  return `₹${Number(n || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function fmtDate(d) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function escHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── A4 invoice HTML — mirrors InvoiceDocument.jsx exactly ─────────────────────

function buildA4InvoiceHtml(inv, items) {
  let snapshotSeller = {};
  let snapshotBuyer = {};
  try { snapshotSeller = inv.snapshot_seller_json ? JSON.parse(inv.snapshot_seller_json) : {}; } catch {}
  try { snapshotBuyer = inv.snapshot_buyer_json ? JSON.parse(inv.snapshot_buyer_json) : {}; } catch {}

  const s = {
    legalName: snapshotSeller.legalName || inv.company_legal_name || "MODUS",
    gstin: snapshotSeller.gstin || inv.company_gstin || "",
    pan: snapshotSeller.pan || inv.company_pan || "",
    email: snapshotSeller.email || inv.company_email || "",
    phone: snapshotSeller.phone || inv.company_phone || "",
    addressLine1: snapshotSeller.addressLine1 || inv.company_address_line1 || "",
    addressLine2: snapshotSeller.addressLine2 || inv.company_address_line2 || "",
    city: snapshotSeller.city || inv.company_city || "",
    state: snapshotSeller.state || inv.company_state || "",
    pincode: snapshotSeller.pincode || inv.company_pincode || "",
    website: snapshotSeller.website || inv.company_website || "",
    logoUrl: snapshotSeller.logoUrl || inv.company_logo_url || "",
    logoDarkUrl: snapshotSeller.logoDarkUrl || inv.company_logo_dark_url || "",
    bankName: snapshotSeller.bankName || inv.company_bank_name || "",
    accountNumber: snapshotSeller.accountNumber || inv.company_account_number || "",
    accountHolderName: snapshotSeller.accountHolderName || inv.company_account_holder_name || "",
    ifsc: snapshotSeller.ifsc || inv.company_ifsc || "",
    upiId: snapshotSeller.upiId || inv.company_upi_id || "",
    signatureUrl: snapshotSeller.signatureUrl || inv.company_signature_url || "",
  };

  const b = {
    companyName: snapshotBuyer.companyName || inv.customer_company_name || "",
    name: snapshotBuyer.name || inv.customer_name || "",
    email: snapshotBuyer.email || inv.customer_email || "",
    gstin: snapshotBuyer.gstin || inv.customer_gstin || "",
    pan: snapshotBuyer.pan || inv.customer_pan || "",
    billingAddress: snapshotBuyer.billingAddress || inv.customer_billing_address || "",
    city: snapshotBuyer.city || inv.customer_city || "",
    state: snapshotBuyer.state || inv.customer_state || "",
    phone: snapshotBuyer.phone || inv.customer_phone || "",
  };

  const isInterstate = !!inv.is_interstate;
  const paymentMethodList = (() => {
    if (!inv.payment_method) return [];
    try { const p = JSON.parse(inv.payment_method); return Array.isArray(p) ? p : [p]; }
    catch { return [inv.payment_method]; }
  })();
  const paymentLabel = paymentMethodList.map((m) => PAYMENT_LABELS[m] || m).join(" / ");
  const customerDisplayName = b.companyName || b.name || "";

  const subtotal = parseFloat(inv.subtotal || 0);
  const discount = parseFloat(inv.total_discount || 0);
  const taxable = parseFloat(inv.taxable_amount || 0);
  const cgst = parseFloat(inv.cgst_amount || 0);
  const sgst = parseFloat(inv.sgst_amount || 0);
  const igst = parseFloat(inv.igst_amount || 0);
  const grandTotal = parseFloat(inv.grand_total || 0);

  const colHeaders = isInterstate
    ? ["#", "Service Description", "SAC", "Qty", "Rate", "Taxable", "IGST", "Total"]
    : ["#", "Service Description", "SAC", "Qty", "Rate", "Taxable", "CGST", "SGST", "Total"];

  const colHeadersHtml = colHeaders.map((h, i) =>
    `<th style="padding:8px 10px;text-align:${i < 2 ? "left" : "right"};font-size:9px;font-weight:700;color:rgba(255,255,255,0.9);letter-spacing:0.08em;text-transform:uppercase">${h}</th>`
  ).join("");

  const itemRowsHtml = items.map((item, i) => {
    const rowBg = i % 2 === 0 ? "#FAFAFA" : "#FFFFFF";
    const taxCells = isInterstate
      ? `<td style="padding:10px;text-align:right;font-size:10px;color:#6B7280">
           <div style="font-size:9px;color:#9CA3AF">${Number(item.igst_rate || 0).toFixed(0)}%</div>
           ₹${Number(item.igst_amount || 0).toFixed(2)}
         </td>`
      : `<td style="padding:10px;text-align:right;font-size:10px;color:#6B7280">
           <div style="font-size:9px;color:#9CA3AF">${Number(item.cgst_rate || 0).toFixed(1)}%</div>
           ₹${Number(item.cgst_amount || 0).toFixed(2)}
         </td>
         <td style="padding:10px;text-align:right;font-size:10px;color:#6B7280">
           <div style="font-size:9px;color:#9CA3AF">${Number(item.sgst_rate || 0).toFixed(1)}%</div>
           ₹${Number(item.sgst_amount || 0).toFixed(2)}
         </td>`;
    return `
      <tr style="border-bottom:1px solid #F3F4F6;background:${rowBg}">
        <td style="padding:10px;text-align:center;font-size:11px;color:#9CA3AF">${i + 1}</td>
        <td style="padding:10px">
          <div style="font-size:12px;font-weight:600;color:#0A0A0A;line-height:1.4">${escHtml(item.item_name || "")}</div>
          ${item.description ? `<div style="font-size:10px;color:#6B7280;margin-top:2px;line-height:1.4">${escHtml(item.description)}</div>` : ""}
        </td>
        <td style="padding:10px;text-align:center;font-size:10px;color:#6B7280;font-family:monospace">${item.hsn_sac_code || "—"}</td>
        <td style="padding:10px;text-align:right;font-size:11px;color:#374151">${Number(item.quantity || 0).toFixed(2)} <span style="color:#9CA3AF">${item.unit || ""}</span></td>
        <td style="padding:10px;text-align:right;font-size:11px;color:#374151">₹${Number(item.unit_price || 0).toFixed(2)}</td>
        <td style="padding:10px;text-align:right;font-size:11px;color:#374151">₹${Number(item.taxable_value || 0).toFixed(2)}</td>
        ${taxCells}
        <td style="padding:10px;text-align:right;font-size:12px;font-weight:700;color:#0A0A0A">₹${Number(item.line_total || 0).toFixed(2)}</td>
      </tr>`;
  }).join("");

  let totalsHtml = `
    <div style="display:flex;justify-content:space-between;margin-bottom:7px">
      <span style="font-size:11px;color:#6B7280">Subtotal</span>
      <span style="font-size:11px;color:#0A0A0A;font-weight:500">₹${subtotal.toFixed(2)}</span>
    </div>`;
  if (discount > 0) totalsHtml += `
    <div style="display:flex;justify-content:space-between;margin-bottom:7px">
      <span style="font-size:11px;color:#6B7280">Discount</span>
      <span style="font-size:11px;color:#059669;font-weight:500">-₹${discount.toFixed(2)}</span>
    </div>`;
  totalsHtml += `
    <div style="display:flex;justify-content:space-between;margin-bottom:7px;padding-top:6px;border-top:1px solid #E5E7EB">
      <span style="font-size:11px;color:#6B7280;font-weight:600">Taxable Value</span>
      <span style="font-size:11px;color:#0A0A0A;font-weight:600">₹${taxable.toFixed(2)}</span>
    </div>`;
  if (isInterstate) {
    if (igst > 0) totalsHtml += `
    <div style="display:flex;justify-content:space-between;margin-bottom:5px">
      <span style="font-size:11px;color:#6B7280">IGST</span>
      <span style="font-size:11px;color:#0A0A0A">₹${igst.toFixed(2)}</span>
    </div>`;
  } else {
    if (cgst > 0) totalsHtml += `
    <div style="display:flex;justify-content:space-between;margin-bottom:5px">
      <span style="font-size:11px;color:#6B7280">CGST</span>
      <span style="font-size:11px;color:#0A0A0A">₹${cgst.toFixed(2)}</span>
    </div>`;
    if (sgst > 0) totalsHtml += `
    <div style="display:flex;justify-content:space-between;margin-bottom:5px">
      <span style="font-size:11px;color:#6B7280">SGST</span>
      <span style="font-size:11px;color:#0A0A0A">₹${sgst.toFixed(2)}</span>
    </div>`;
  }
  totalsHtml += `
    <div style="border-top:2px solid #0A0A0A;padding-top:10px;margin-top:10px;display:flex;justify-content:space-between;align-items:baseline">
      <span style="font-size:12px;font-weight:700;color:#0A0A0A">Grand Total</span>
      <span style="font-size:20px;font-weight:800;color:#0A0A0A;letter-spacing:-0.02em">₹${grandTotal.toFixed(2)}</span>
    </div>`;
  if (inv.amount_in_words) totalsHtml += `<p style="font-size:10px;color:#6B7280;font-style:italic;margin-top:8px;line-height:1.5">${escHtml(inv.amount_in_words)}</p>`;

  const showBank = paymentMethodList.length === 0 || paymentMethodList.includes("bank_transfer");
  const showUpi = paymentMethodList.length === 0 || paymentMethodList.includes("upi");
  const bankHtml = (showBank && (s.bankName || s.accountNumber)) ? `
    <div style="padding:12px 14px;background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;margin-bottom:14px">
      <p style="font-size:9px;font-weight:700;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 6px">Bank Details</p>
      ${s.bankName ? `<p style="font-size:11px;color:#374151;margin:0 0 2px">Bank: <strong>${escHtml(s.bankName)}</strong></p>` : ""}
      ${s.accountHolderName ? `<p style="font-size:11px;color:#374151;margin:0 0 2px">A/C Holder: <strong>${escHtml(s.accountHolderName)}</strong></p>` : ""}
      ${s.accountNumber ? `<p style="font-size:11px;color:#374151;margin:0 0 2px;font-family:monospace">A/C: ${escHtml(s.accountNumber)}</p>` : ""}
      ${s.ifsc ? `<p style="font-size:11px;color:#374151;margin:0 0 2px;font-family:monospace">IFSC: ${escHtml(s.ifsc)}</p>` : ""}
    </div>` : "";
  const upiHtml = (showUpi && s.upiId) ? `
    <div style="padding:12px 14px;background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;margin-bottom:14px">
      <p style="font-size:9px;font-weight:700;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 6px">UPI Payment</p>
      <p style="font-size:11px;color:#374151;margin:0">UPI ID: <strong style="font-family:monospace">${escHtml(s.upiId)}</strong></p>
    </div>` : "";

  const paymentMethodHtml = paymentLabel ? `
    <div style="margin-bottom:14px;padding:10px 14px;background:#FEF2F2;border:1px solid #FECACA;border-radius:8px">
      <p style="font-size:9px;font-weight:700;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 4px">Payment Method</p>
      <p style="font-size:12px;font-weight:700;color:#E11D2C;margin:0">${escHtml(paymentLabel)}</p>
    </div>` : "";

  const notesHtml = inv.notes ? `
    <div style="margin-bottom:12px">
      <p style="font-size:9px;font-weight:700;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 4px">Notes</p>
      <p style="font-size:11px;color:#374151;line-height:1.6;white-space:pre-line;margin:0">${escHtml(inv.notes)}</p>
    </div>` : "";

  const gstCatColor = inv.gst_category === "B2B" ? "#2563EB" : "#16A34A";
  const gstCatBg = inv.gst_category === "B2B" ? "#EFF6FF" : "#F0FDF4";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Invoice ${escHtml(inv.invoice_number)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    @page { size: A4; margin: 0; }
    html, body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      background: #fff;
    }
    .page { width: 210mm; min-height: 297mm; background: #fff; }
    table { border-collapse: collapse; }
  </style>
</head>
<body>
<div class="page">

  <!-- HEADER -->
  <div style="background:#0A0A0A;padding:28px 36px;display:flex;justify-content:space-between;align-items:flex-start">
    <div>
      ${(s.logoDarkUrl || s.logoUrl)
        ? `<img src="${s.logoDarkUrl || s.logoUrl}" alt="${escHtml(s.legalName)}" style="height:30px;display:block;margin-bottom:10px" crossorigin="anonymous">`
        : `<h2 style="font-size:20px;font-weight:800;color:#FFFFFF;letter-spacing:-0.02em;margin:0 0 6px">${escHtml(s.legalName)}</h2>`}
      ${s.gstin ? `<p style="font-size:11px;color:rgba(255,255,255,0.5);margin:0;font-family:monospace">GSTIN: ${escHtml(s.gstin)}</p>` : ""}
      ${s.website ? `<p style="font-size:11px;color:rgba(255,255,255,0.4);margin:2px 0 0">${escHtml(s.website)}</p>` : ""}
    </div>
    <div style="text-align:right">
      <div style="display:inline-block;background:#E11D2C;padding:4px 12px;border-radius:4px;margin-bottom:8px">
        <p style="font-size:10px;font-weight:800;color:#FFFFFF;letter-spacing:0.12em;margin:0">TAX INVOICE</p>
      </div>
      <p style="font-size:18px;font-weight:800;color:#FFFFFF;margin:0 0 4px;letter-spacing:0.02em">${escHtml(inv.invoice_number)}</p>
      <p style="font-size:11px;color:rgba(255,255,255,0.5);margin:0">Date: ${fmtDate(inv.invoice_date)}</p>
      ${inv.due_date ? `<p style="font-size:11px;color:rgba(255,255,255,0.4);margin:2px 0 0">Due: ${fmtDate(inv.due_date)}</p>` : ""}
    </div>
  </div>

  <!-- FROM / TO -->
  <div style="display:grid;grid-template-columns:1fr 1fr;border-bottom:1px solid #E5E7EB">
    <div style="padding:20px 24px 18px 36px;border-right:1px solid #E5E7EB">
      <p style="font-size:9px;font-weight:700;color:#9CA3AF;letter-spacing:0.1em;text-transform:uppercase;margin:0 0 8px">Service Provider</p>
      <p style="font-size:13px;font-weight:700;color:#0A0A0A;margin:0 0 4px">${escHtml(s.legalName)}</p>
      ${s.addressLine1 ? `<p style="font-size:11px;color:#374151;margin:0 0 1px;line-height:1.5">${escHtml(s.addressLine1)}</p>` : ""}
      ${s.addressLine2 ? `<p style="font-size:11px;color:#374151;margin:0 0 1px;line-height:1.5">${escHtml(s.addressLine2)}</p>` : ""}
      ${(s.city || s.state) ? `<p style="font-size:11px;color:#374151;margin:0 0 1px;line-height:1.5">${[s.city, s.state, s.pincode].filter(Boolean).map(escHtml).join(", ")}</p>` : ""}
      ${s.gstin ? `<p style="font-size:10px;color:#6B7280;margin:4px 0 0;font-family:monospace">GSTIN: ${escHtml(s.gstin)}</p>` : ""}
      ${s.pan ? `<p style="font-size:10px;color:#6B7280;margin:1px 0 0;font-family:monospace">PAN: ${escHtml(s.pan)}</p>` : ""}
      ${s.email ? `<p style="font-size:10px;color:#6B7280;margin:3px 0 0">${escHtml(s.email)}</p>` : ""}
      ${s.phone ? `<p style="font-size:10px;color:#6B7280;margin:1px 0 0">${escHtml(s.phone)}</p>` : ""}
    </div>
    <div style="padding:20px 36px 18px 24px">
      <p style="font-size:9px;font-weight:700;color:#9CA3AF;letter-spacing:0.1em;text-transform:uppercase;margin:0 0 8px">Bill To (Recipient of Service)</p>
      ${customerDisplayName ? `
        <p style="font-size:13px;font-weight:700;color:#0A0A0A;margin:0 0 4px">${escHtml(customerDisplayName)}</p>
        ${b.billingAddress ? `<p style="font-size:11px;color:#374151;margin:0 0 1px;line-height:1.5;white-space:pre-line">${escHtml(b.billingAddress)}</p>` : ""}
        ${(b.city || b.state) ? `<p style="font-size:11px;color:#374151;margin:0 0 1px;line-height:1.5">${[b.city, b.state].filter(Boolean).map(escHtml).join(", ")}</p>` : ""}
        ${b.gstin ? `<p style="font-size:10px;color:#6B7280;margin:4px 0 0;font-family:monospace">GSTIN: ${escHtml(b.gstin)}</p>` : ""}
        ${(b.pan && !b.gstin) ? `<p style="font-size:10px;color:#6B7280;margin:1px 0 0;font-family:monospace">PAN: ${escHtml(b.pan)}</p>` : ""}
        ${b.email ? `<p style="font-size:10px;color:#6B7280;margin:3px 0 0">${escHtml(b.email)}</p>` : ""}
        ${b.phone ? `<p style="font-size:10px;color:#6B7280;margin:1px 0 0">${escHtml(b.phone)}</p>` : ""}
      ` : `<p style="font-size:12px;color:#D1D5DB;font-style:italic">No client specified</p>`}
    </div>
  </div>

  <!-- META ROW -->
  <div style="padding:10px 36px;background:#FAFAFA;border-bottom:1px solid #E5E7EB;display:flex;flex-wrap:wrap;gap:24px;align-items:center">
    ${inv.gst_category ? `
    <div>
      <p style="font-size:9px;font-weight:700;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 2px">Supply Type</p>
      <span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:700;background:${gstCatBg};color:${gstCatColor}">${escHtml(inv.gst_category)}</span>
    </div>` : ""}
    ${inv.place_of_supply ? `
    <div>
      <p style="font-size:9px;font-weight:700;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 2px">Place of Supply</p>
      <p style="font-size:12px;font-weight:600;color:#0A0A0A;margin:0">${escHtml(inv.place_of_supply)}</p>
    </div>` : ""}
    ${inv.payment_terms ? `
    <div>
      <p style="font-size:9px;font-weight:700;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 2px">Payment Terms</p>
      <p style="font-size:12px;font-weight:600;color:#0A0A0A;margin:0">${escHtml(inv.payment_terms)}</p>
    </div>` : ""}
    ${(b.pan && !b.gstin) ? `
    <div>
      <p style="font-size:9px;font-weight:700;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 2px">PAN</p>
      <p style="font-size:12px;font-weight:600;color:#0A0A0A;margin:0;font-family:monospace">${escHtml(b.pan)}</p>
    </div>` : ""}
  </div>

  <!-- ITEMS TABLE -->
  <div style="padding:0 36px;margin-top:16px">
    <table style="width:100%;border-collapse:collapse;font-size:11px">
      <thead>
        <tr style="background:#0A0A0A">
          ${colHeadersHtml}
        </tr>
      </thead>
      <tbody>
        ${itemRowsHtml}
      </tbody>
    </table>
  </div>

  <!-- TOTALS + BANK -->
  <div style="display:grid;grid-template-columns:1fr 280px;padding:16px 36px 0;gap:24px">
    <div>
      ${paymentMethodHtml}
      ${bankHtml}
      ${upiHtml}
      ${notesHtml}
    </div>
    <div>
      <div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;padding:16px 18px">
        ${totalsHtml}
      </div>
    </div>
  </div>

  <!-- FOOTER -->
  <div style="padding:20px 36px 24px;border-top:1px solid #E5E7EB;margin-top:20px;display:flex;justify-content:space-between;align-items:flex-end">
    <p style="font-size:9px;color:#D1D5DB;margin:0">${escHtml(s.website || "")}</p>
    <div style="text-align:right">
      ${s.signatureUrl ? `<img src="${s.signatureUrl}" alt="Signature" style="height:40px;margin-bottom:4px;display:block;margin-left:auto">` : ""}
      <div style="border-top:1px solid #0A0A0A;padding-top:4px;min-width:160px">
        <p style="font-size:10px;font-weight:600;color:#0A0A0A;margin:0">For ${escHtml(s.legalName)}</p>
        <p style="font-size:9px;color:#6B7280;margin:1px 0 0">Authorised Signatory</p>
      </div>
    </div>
  </div>

</div>
</body>
</html>`;
}

// ── Puppeteer PDF generation ──────────────────────────────────────────────────

// Wait for fonts + external images (QR / signature) without hanging on networkidle0
// (the external QR can keep a connection open forever → networkidle0 times out → no PDF).
async function settlePage(page) {
  try { await page.evaluate(async () => { try { await document.fonts.ready; } catch {} }); } catch {}
  await new Promise((r) => setTimeout(r, 1800));
}

export async function generateInvoicePDF(inv, items, docType = "invoice") {
  const { launchBrowser } = await import("@/app/api/utils/browser");
  const html = buildInvoiceDocHtml(inv, items, false, docType);
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 20000 });
    await settlePage(page);
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });
    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}

// Render the invoice to a PNG (for the email body — Gmail strips flexbox + inline SVG,
// so an image is the only way the layout + logo render correctly in every client).
export async function generateInvoiceImage(inv, items) {
  const { launchBrowser } = await import("@/app/api/utils/browser");
  const html = buildInvoiceDocHtml(inv, items);
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 20000 });
    await settlePage(page);
    const el = await page.$(".modus-invoice-doc");
    const buf = el
      ? await el.screenshot({ type: "png" })
      : await page.screenshot({ type: "png", fullPage: true });
    return Buffer.from(buf);
  } finally {
    await browser.close();
  }
}

// Fetch an invoice (with company + customer joins) and render its A4 PDF.
// Shared by the email-send route and the download endpoint so both produce
// the identical, Puppeteer-rendered document.
export async function getInvoicePdfBuffer(id) {
  const rows = await sql`
    SELECT
      i.*,
      c.name AS customer_name, c.company_name AS customer_company_name,
      c.email AS customer_email, c.gstin AS customer_gstin,
      c.billing_address AS customer_billing_address,
      c.city AS customer_city, c.state AS customer_state,
      c.phone AS customer_phone, c.pan AS customer_pan,
      cs.legal_name AS company_legal_name, cs.email AS company_email,
      cs.gstin AS company_gstin, cs.logo_url AS company_logo_url,
      cs.logo_dark_url AS company_logo_dark_url, cs.website AS company_website,
      cs.address_line1 AS company_address_line1, cs.address_line2 AS company_address_line2,
      cs.city AS company_city, cs.state AS company_state, cs.pincode AS company_pincode,
      cs.phone AS company_phone, cs.pan AS company_pan,
      cs.bank_name AS company_bank_name, cs.account_number AS company_account_number,
      cs.account_holder_name AS company_account_holder_name, cs.ifsc AS company_ifsc,
      cs.upi_id AS company_upi_id, cs.signature_url AS company_signature_url
    FROM invoices i
    LEFT JOIN customers c ON i.customer_id = c.id
    LEFT JOIN company_settings cs ON cs.id = 1
    WHERE i.id = ${id}
  `;
  if (!rows.length) return null;
  const inv = rows[0];
  const items = await sql`SELECT * FROM invoice_items WHERE invoice_id = ${id} ORDER BY position`;
  const buffer = await generateInvoicePDF(inv, items);
  return { buffer, invoiceNumber: inv.invoice_number };
}

// ── Responsive email HTML ─────────────────────────────────────────────────────

function buildEmailHtml({ inv, items, companyName, customerName, invoiceNumber, invoiceDate, websiteUrl }) {
  const subtotal = parseFloat(inv.subtotal || 0);
  const discount = parseFloat(inv.total_discount || 0);
  const taxable = parseFloat(inv.taxable_amount || 0);
  const cgst = parseFloat(inv.cgst_amount || 0);
  const sgst = parseFloat(inv.sgst_amount || 0);
  const igst = parseFloat(inv.igst_amount || 0);
  const total = parseFloat(inv.grand_total || 0);
  const isInterstate = inv.is_interstate;
  const paymentMethodList2 = (() => {
    if (!inv.payment_method) return [];
    try { const p = JSON.parse(inv.payment_method); return Array.isArray(p) ? p : [p]; }
    catch { return [inv.payment_method]; }
  })();
  const paymentLabel = paymentMethodList2.map((m) => PAYMENT_LABELS[m] || m).join(" / ");

  const logoUrl = inv.company_logo_dark_url || inv.company_logo_url
    || "https://dtvoeevhaseb5.cloudfront.net/user-uploads/46840a26-50f6-4562-bc95-89383cd30be1.png";

  const summaryRows = [
    { label: "Subtotal", value: fmt(subtotal) },
    ...(discount > 0 ? [{ label: "Discount", value: `-${fmt(discount)}`, green: true }] : []),
    { label: "Taxable Value", value: fmt(taxable) },
    ...(isInterstate
      ? [{ label: "IGST", value: fmt(igst) }]
      : [
        ...(cgst > 0 ? [{ label: "CGST", value: fmt(cgst) }] : []),
        ...(sgst > 0 ? [{ label: "SGST", value: fmt(sgst) }] : []),
      ]
    ),
  ];

  const summaryRowsHtml = summaryRows.map(r => `
    <tr>
      <td style="padding:5px 0;font-size:13px;color:${r.green ? "#16A34A" : "#6B7280"};font-weight:${r.green ? "600" : "400"}">${r.label}</td>
      <td style="padding:5px 0;font-size:13px;color:${r.green ? "#16A34A" : "#374151"};text-align:right;font-weight:600">${r.value}</td>
    </tr>`).join("");

  const itemRowsHtml = items.map((it, i) => `
    <tr style="border-bottom:1px solid #F3F4F6;background:${i % 2 === 0 ? "#FAFAFA" : "#FFFFFF"}">
      <td style="padding:12px 16px;font-size:13px;color:#0A0A0A;font-weight:600;line-height:1.4">
        ${escHtml(it.item_name || "")}
        ${it.description ? `<br><span style="font-size:11px;color:#9CA3AF;font-weight:400">${escHtml(it.description)}</span>` : ""}
      </td>
      <td style="padding:12px 16px;text-align:right;font-size:12px;color:#6B7280;white-space:nowrap">
        ${Number(it.quantity).toFixed(2)} ${it.unit || ""}
      </td>
      <td style="padding:12px 16px;text-align:right;font-size:12px;color:#374151;white-space:nowrap">
        ${fmt(it.unit_price)}
      </td>
      <td style="padding:12px 16px;text-align:right;font-size:12px;white-space:nowrap;${it.discount_amount > 0 ? "color:#16A34A;font-weight:600" : "color:#9CA3AF"}">
        ${it.discount_amount > 0 ? `-${fmt(it.discount_amount)}` : "—"}
      </td>
      <td style="padding:12px 16px;text-align:right;font-size:13px;font-weight:700;color:#0A0A0A;white-space:nowrap">
        ${fmt(it.line_total)}
      </td>
    </tr>`).join("");

  const siteUrl = websiteUrl || "";
  const siteDisplay = siteUrl.replace(/^https?:\/\//, "");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Invoice ${invoiceNumber}</title>
  <style>
    @media only screen and (max-width:600px) {
      .email-outer {
        margin: 0 !important;
        border-radius: 0 !important;
        width: 100% !important;
      }
      .email-pad {
        padding-left: 16px !important;
        padding-right: 16px !important;
      }
      .from-cell {
        display: block !important;
        width: 100% !important;
        border-right: 0 !important;
        border-bottom: 1px solid rgba(255,255,255,0.08) !important;
        box-sizing: border-box !important;
      }
      .to-cell {
        display: block !important;
        width: 100% !important;
        box-sizing: border-box !important;
      }
      .meta-row td {
        display: block !important;
        padding: 4px 16px 10px !important;
      }
      .items-wrap {
        overflow-x: auto !important;
        -webkit-overflow-scrolling: touch !important;
      }
      .items-tbl {
        min-width: 440px !important;
      }
      .sum-left {
        display: block !important;
        width: 100% !important;
        border-bottom: 1px solid #F3F4F6 !important;
        padding-bottom: 16px !important;
        margin-bottom: 8px !important;
      }
      .sum-right {
        display: block !important;
        width: 100% !important;
      }
      .inv-number {
        font-size: 16px !important;
      }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#F4F4F5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased">

  <div class="email-outer" style="max-width:620px;margin:32px auto 48px;border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.12)">

    <!-- HEADER -->
    <div class="email-pad" style="background:#0A0A0A;padding:24px 36px 22px">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
        <tr>
          <td style="vertical-align:middle">
            <img
              src="${logoUrl}"
              alt="${escHtml(companyName)}"
              width="120"
              style="height:30px;width:auto;max-width:160px;display:block"
            />
            ${inv.company_gstin ? `<div style="font-size:10px;color:rgba(255,255,255,0.4);margin-top:6px;font-family:monospace">GSTIN: ${inv.company_gstin}</div>` : ""}
          </td>
          <td style="text-align:right;vertical-align:top">
            <div style="display:inline-block;background:#E11D2C;padding:3px 10px;border-radius:4px;margin-bottom:8px">
              <span style="color:#FFFFFF;font-size:9px;font-weight:800;letter-spacing:0.12em">TAX INVOICE</span>
            </div>
            <div class="inv-number" style="color:#FFFFFF;font-size:20px;font-weight:800;letter-spacing:0.02em;line-height:1">${invoiceNumber}</div>
            <div style="color:rgba(255,255,255,0.5);font-size:11px;margin-top:3px">Date: ${invoiceDate}</div>
            ${inv.due_date ? `<div style="color:rgba(255,255,255,0.35);font-size:10px;margin-top:1px">Due: ${fmtDate(inv.due_date)}</div>` : ""}
          </td>
        </tr>
      </table>
    </div>

    <!-- FROM / TO -->
    <div style="background:#1A1A1A">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
        <tr>
          <td class="from-cell email-pad" style="width:50%;padding:18px 36px 18px 36px;border-right:1px solid rgba(255,255,255,0.08);vertical-align:top">
            <div style="font-size:9px;font-weight:700;color:#6B7280;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:6px">From</div>
            <div style="font-size:14px;font-weight:700;color:#FFFFFF;margin-bottom:3px">${escHtml(companyName)}</div>
            ${inv.company_email ? `<div style="font-size:11px;color:#6B7280;margin-top:2px">${escHtml(inv.company_email)}</div>` : ""}
            ${inv.company_gstin ? `<div style="font-size:10px;color:#6B7280;margin-top:4px;font-family:monospace">GSTIN: ${inv.company_gstin}</div>` : ""}
          </td>
          <td class="to-cell email-pad" style="width:50%;padding:18px 36px 18px 24px;vertical-align:top">
            <div style="font-size:9px;font-weight:700;color:#6B7280;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:6px">To</div>
            <div style="font-size:14px;font-weight:700;color:#FFFFFF;margin-bottom:3px">${escHtml(customerName)}</div>
            ${inv.customer_email ? `<div style="font-size:11px;color:#6B7280;margin-top:2px">${escHtml(inv.customer_email)}</div>` : ""}
            ${inv.customer_gstin ? `<div style="font-size:10px;color:#6B7280;margin-top:4px;font-family:monospace">GSTIN: ${inv.customer_gstin}</div>` : ""}
          </td>
        </tr>
      </table>
    </div>

    <!-- META STRIP -->
    ${(inv.payment_method || inv.place_of_supply || inv.gst_category) ? `
    <div style="background:#141414;border-top:1px solid rgba(255,255,255,0.06);border-bottom:1px solid rgba(255,255,255,0.06)">
      <table class="meta-row email-pad" width="100%" cellpadding="0" cellspacing="0" role="presentation">
        <tr>
          ${inv.invoice_number ? `<td style="padding:12px 36px 12px 36px"><div style="font-size:9px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:3px">Invoice No.</div><div style="font-size:12px;font-weight:600;color:#FFFFFF">${inv.invoice_number}</div></td>` : ""}
          ${inv.payment_method ? `<td style="padding:12px 28px 12px 0"><div style="font-size:9px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:3px">Payment Method</div><div style="font-size:12px;font-weight:600;color:#FFFFFF">${escHtml(paymentLabel)}</div></td>` : ""}
          ${inv.place_of_supply ? `<td style="padding:12px 28px 12px 0"><div style="font-size:9px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:3px">Place of Supply</div><div style="font-size:12px;font-weight:600;color:#FFFFFF">${escHtml(inv.place_of_supply)}</div></td>` : ""}
          ${inv.gst_category ? `<td style="padding:12px 36px 12px 0"><div style="font-size:9px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:3px">Supply Type</div><span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:700;background:${inv.gst_category === "B2B" ? "rgba(37,99,235,0.2)" : "rgba(22,163,74,0.2)"};color:${inv.gst_category === "B2B" ? "#93C5FD" : "#6EE7B7"}">${inv.gst_category}</span></td>` : ""}
        </tr>
      </table>
    </div>` : ""}

    <!-- GREETING -->
    <div class="email-pad" style="background:#FFFFFF;padding:24px 36px 4px;border-top:3px solid #E11D2C">
      <p style="margin:0;font-size:14px;color:#374151;line-height:1.7">
        Dear <strong style="color:#0A0A0A">${escHtml(customerName)}</strong>,
      </p>
      <p style="margin:8px 0 0;font-size:14px;color:#6B7280;line-height:1.7">
        Please find your invoice details below. Kindly arrange payment at your earliest convenience.
      </p>
    </div>

    <!-- ITEMS TABLE -->
    <div style="background:#FFFFFF">
      <div class="items-wrap">
        <table class="items-tbl" width="100%" cellpadding="0" cellspacing="0" role="presentation">
          <thead>
            <tr style="background:#0A0A0A">
              <th style="padding:10px 16px;text-align:left;font-size:9px;font-weight:700;color:rgba(255,255,255,0.7);letter-spacing:0.08em;text-transform:uppercase">Description</th>
              <th style="padding:10px 16px;text-align:right;font-size:9px;font-weight:700;color:rgba(255,255,255,0.7);letter-spacing:0.08em;text-transform:uppercase">Qty</th>
              <th style="padding:10px 16px;text-align:right;font-size:9px;font-weight:700;color:rgba(255,255,255,0.7);letter-spacing:0.08em;text-transform:uppercase">Rate</th>
              <th style="padding:10px 16px;text-align:right;font-size:9px;font-weight:700;color:rgba(255,255,255,0.7);letter-spacing:0.08em;text-transform:uppercase">Discount</th>
              <th style="padding:10px 16px;text-align:right;font-size:9px;font-weight:700;color:rgba(255,255,255,0.7);letter-spacing:0.08em;text-transform:uppercase">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${itemRowsHtml}
          </tbody>
        </table>
      </div>
    </div>

    <!-- FINANCIAL SUMMARY -->
    <div class="email-pad" style="background:#FFFFFF;padding:20px 36px 28px;border-top:1px solid #F3F4F6">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
        <tr>
          <td class="sum-left" style="width:50%;vertical-align:top;padding-top:4px;padding-right:20px">
            ${paymentLabel ? `
            <div style="padding:16px 20px;background:#F9FAFB;border:1px solid #E5E7EB;border-radius:10px;display:inline-block;min-width:160px">
              <div style="font-size:9px;font-weight:700;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px">Payment Method</div>
              <div style="font-size:13px;font-weight:600;color:#0A0A0A">${escHtml(paymentLabel)}</div>
            </div>` : ""}
            ${inv.notes ? `
            <div style="margin-top:12px;padding:14px 16px;background:#FFF9E6;border:1px solid #FDE68A;border-radius:10px;max-width:240px">
              <div style="font-size:9px;font-weight:700;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:5px">Notes</div>
              <div style="font-size:12px;color:#374151;line-height:1.5">${escHtml(inv.notes)}</div>
            </div>` : ""}
          </td>
          <td class="sum-right" style="width:50%;vertical-align:top">
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
              ${summaryRowsHtml}
              <tr><td colspan="2" style="padding:8px 0 2px"><div style="height:1px;background:#E5E7EB"></div></td></tr>
              <tr>
                <td style="padding:6px 0;font-size:16px;font-weight:800;color:#0A0A0A">Grand Total</td>
                <td style="padding:6px 0;font-size:16px;font-weight:800;color:#0A0A0A;text-align:right">${fmt(total)}</td>
              </tr>
              ${inv.amount_in_words ? `<tr><td colspan="2" style="padding:3px 0 0;font-size:10px;color:#9CA3AF;font-style:italic;text-align:right">${escHtml(inv.amount_in_words)}</td></tr>` : ""}
            </table>
          </td>
        </tr>
      </table>
    </div>

    <!-- FOOTER -->
    <div class="email-pad" style="background:#0A0A0A;padding:20px 36px;text-align:center;border-top:1px solid rgba(255,255,255,0.08)">
      <p style="margin:0 0 12px;font-size:12px;color:#6B7280">
        <a href="${SOCIALS.instagram}" target="_blank" style="color:#9CA3AF;text-decoration:none;font-weight:500">Instagram</a>
        <span style="color:#374151;margin:0 8px">·</span>
        <a href="${SOCIALS.linkedin}" target="_blank" style="color:#9CA3AF;text-decoration:none;font-weight:500">LinkedIn</a>
        <span style="color:#374151;margin:0 8px">·</span>
        <a href="${SOCIALS.x}" target="_blank" style="color:#9CA3AF;text-decoration:none;font-weight:500">X</a>
        <span style="color:#374151;margin:0 8px">·</span>
        <a href="${siteUrl}" target="_blank" style="color:#9CA3AF;text-decoration:none;font-weight:500">Website</a>
      </p>
      <p style="font-size:11px;color:#6B7280;margin:0">
        © ${new Date().getFullYear()} <strong style="color:#9CA3AF">${escHtml(companyName)}</strong>
        ${siteUrl ? ` · <a href="${siteUrl}" style="color:#9CA3AF;text-decoration:none">${siteDisplay}</a>` : ""}
      </p>
    </div>

  </div>

</body>
</html>`;
}

// Clean, professional, email-safe invoice email (tables + inline styles only — no flexbox/
// grid/SVG, so it renders correctly in Gmail/Outlook/Apple Mail). The exact invoice is the
// attached PDF.
function buildInvoiceEmailBody({ inv, invoiceNumber, customerName, invoiceDate, grandTotal }) {
  const buyerName = customerName || inv.customer_company_name || inv.customer_name || "there";
  const company = inv.company_registered_name || inv.company_legal_name || "MODUS";
  const website = (inv.company_website || "").replace(/^https?:\/\//, "").replace(/\/$/, "");
  const dueDate = inv.due_date ? fmtDate(inv.due_date) : "—";
  const terms = inv.payment_terms || "Net 30";
  const amount = `₹${grandTotal}`;
  const row = (label, val, strong) =>
    `<tr><td style="padding:8px 0;border-bottom:1px solid #EFEFEF;font-size:13px;color:#6B7280;">${label}</td>
        <td style="padding:8px 0;border-bottom:1px solid #EFEFEF;font-size:13px;font-weight:${strong ? 700 : 600};color:#1A1A1A;text-align:right;">${val}</td></tr>`;
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
<body style="margin:0;padding:0;background:#F2F2F4;font-family:Arial,Helvetica,sans-serif;color:#1A1A1A;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F2F2F4;"><tr><td align="center" style="padding:28px 16px 36px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border-radius:12px;overflow:hidden;border:1px solid #E7E7EA;">
      <tr><td style="background:#1A1A1A;padding:22px 28px;">
        <span style="font-size:20px;font-weight:800;letter-spacing:-.01em;color:#FFFFFF;">${escHtml(company)}</span>
        <span style="display:block;font-size:11px;font-weight:600;letter-spacing:.18em;color:#9A9AA0;margin-top:4px;text-transform:uppercase;">Tax Invoice</span>
      </td></tr>
      <tr><td style="height:4px;background:#E11D2C;font-size:0;line-height:0;">&nbsp;</td></tr>
      <tr><td style="padding:26px 28px 8px;">
        <p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:#374151;">Dear ${escHtml(buyerName)},</p>
        <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#374151;">Thank you for your business. Please find your invoice <strong>${escHtml(invoiceNumber)}</strong> attached as a PDF. A summary is below.</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${row("Invoice no.", escHtml(invoiceNumber))}
          ${row("Invoice date", escHtml(invoiceDate))}
          ${row("Due date", escHtml(dueDate))}
          ${row("Payment terms", escHtml(terms))}
        </table>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:18px;background:#1A1A1A;border-radius:8px;">
          <tr>
            <td style="padding:16px 18px;font-size:12px;font-weight:700;letter-spacing:.06em;color:#FFFFFF;text-transform:uppercase;">Amount Payable</td>
            <td style="padding:16px 18px;font-size:20px;font-weight:800;color:#E11D2C;text-align:right;">${amount}</td>
          </tr>
        </table>
        <p style="margin:22px 0 0;font-size:13px;line-height:1.6;color:#6B7280;">If you have any questions about this invoice, simply reply to this email. We appreciate your prompt payment.</p>
      </td></tr>
      <tr><td style="padding:20px 28px 26px;">
        <p style="margin:0;font-size:13px;color:#374151;">Warm regards,<br/><strong>${escHtml(company)}</strong></p>
      </td></tr>
      <tr><td style="background:#FAFAFA;border-top:1px solid #EFEFEF;padding:14px 28px;text-align:center;">
        <span style="font-size:11.5px;color:#9CA3AF;">${escHtml(website)} &nbsp;·&nbsp; This is an automated email regarding invoice ${escHtml(invoiceNumber)}.</span>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request, { params }) {
  try {
    const user = await requireAuth(request);
    const { id } = await params;

    const rows = await sql`
      SELECT
        i.*,
        c.name                   AS customer_name,
        c.company_name           AS customer_company_name,
        c.email                  AS customer_email,
        c.gstin                  AS customer_gstin,
        c.billing_address        AS customer_billing_address,
        c.city                   AS customer_city,
        c.state                  AS customer_state,
        c.phone                  AS customer_phone,
        c.pan                    AS customer_pan,
        cs.legal_name            AS company_legal_name,
        cs.email                 AS company_email,
        cs.gstin                 AS company_gstin,
        cs.logo_url              AS company_logo_url,
        cs.logo_dark_url         AS company_logo_dark_url,
        cs.website               AS company_website,
        cs.address_line1         AS company_address_line1,
        cs.address_line2         AS company_address_line2,
        cs.city                  AS company_city,
        cs.state                 AS company_state,
        cs.pincode               AS company_pincode,
        cs.phone                 AS company_phone,
        cs.pan                   AS company_pan,
        cs.bank_name             AS company_bank_name,
        cs.account_number        AS company_account_number,
        cs.account_holder_name   AS company_account_holder_name,
        cs.ifsc                  AS company_ifsc,
        cs.upi_id                AS company_upi_id,
        cs.registered_name       AS company_registered_name,
        cs.signature_url         AS company_signature_url
      FROM invoices i
      LEFT JOIN customers c  ON i.customer_id = c.id
      LEFT JOIN company_settings cs ON cs.id = 1
      WHERE i.id = ${id}
    `;

    if (!rows.length) return Response.json({ error: "Invoice not found" }, { status: 404 });

    const inv = rows[0];
    const toEmail = inv.customer_email;
    if (!toEmail) return Response.json({ error: "Customer has no email address" }, { status: 400 });

    const items = await sql`
      SELECT * FROM invoice_items WHERE invoice_id = ${id} ORDER BY position
    `;

    const companyName = inv.company_legal_name || "MODUS";
    const customerName = inv.customer_company_name || inv.customer_name || "Customer";
    const invoiceNumber = inv.invoice_number;
    const grandTotal = parseFloat(inv.grand_total).toFixed(2);
    const invoiceDate = fmtDate(inv.invoice_date);
    const websiteUrl = inv.company_website || "";

    // Clean, professional email body (the exact invoice is the attached PDF).
    const html = buildInvoiceEmailBody({ inv, invoiceNumber, customerName, invoiceDate, grandTotal });

    let attachments = [];
    try {
      const pdfBuffer = await generateInvoicePDF(inv, items);
      const clientSlug = customerName.trim().replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "Client";
      attachments = [{
        filename: `${clientSlug}-${invoiceNumber}.pdf`,
        content: pdfBuffer.toString("base64"),
        type: "application/pdf",
        disposition: "attachment",
      }];
    } catch (pdfErr) {
      console.error("PDF generation failed — email will send without attachment:", pdfErr.message);
    }

    // CC the internal accounts mailbox (skip if the CC duplicates the recipient).
    const ccList = (inv.company_email ? [inv.company_email] : [])
      .filter((e) => e.toLowerCase() !== String(toEmail).toLowerCase());

    const mailResult = await sendMail({
      to: toEmail,
      cc: ccList,
      subject: `Invoice ${invoiceNumber} from ${companyName} — ${fmt(inv.grand_total)}`,
      html,
      attachments,
    });
    if (mailResult?.error || mailResult?.skipped) {
      return Response.json(
        { error: mailResult.skipped ? "Email is not configured (SMTP). Add SMTP credentials." : `Email failed: ${mailResult.error}` },
        { status: 502 },
      );
    }

    await sql`UPDATE invoices SET status = 'sent', updated_at = NOW() WHERE id = ${id}`;

    await logAudit({
      userId: user.id,
      action: "send_email",
      entityType: "invoice",
      entityId: id,
      metadata: { invoiceNumber, toEmail, hasPDF: attachments.length > 0 },
      request,
    });

    return Response.json({ success: true, sentTo: toEmail, hasPDF: attachments.length > 0 });

  } catch (error) {
    if (error.message === "UNAUTHORIZED") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Send invoice email error:", error);
    return Response.json({ error: "Failed to send email" }, { status: 500 });
  }
}
