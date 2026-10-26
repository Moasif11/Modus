import { formatMoney, formatDate } from "@/utils/format";
import { Logo } from "@/components/studio/Logo";

const PAYMENT_METHOD_LABELS = {
  bank_transfer: "Bank Transfer (NEFT/RTGS/IMPS)",
  upi: "UPI",
  cheque: "Cheque",
  cash: "Cash",
  card: "Card",
  wire: "International Wire Transfer",
  other: "Other",
};

const DOC_LABELS = {
  invoice: {
    title: "Invoice",
    titleUpper: "INVOICE",
    taxTitle: "TAX INVOICE",
    numberLabel: "Invoice no.",
    dateLabel: "Invoice date",
    dueDateLabel: "Due date",
    due: "Due",
    dueUpper: "DUE",
  },
  quote: {
    title: "Quote",
    titleUpper: "QUOTE",
    taxTitle: "QUOTATION",
    numberLabel: "Quote no.",
    dateLabel: "Quote date",
    dueDateLabel: "Valid until",
    due: "Valid until",
    dueUpper: "VALID UNTIL",
  },
  proforma: {
    title: "Proforma",
    titleUpper: "PROFORMA",
    taxTitle: "PROFORMA INVOICE",
    numberLabel: "Proforma no.",
    dateLabel: "Proforma date",
    dueDateLabel: "Valid until",
    due: "Valid until",
    dueUpper: "VALID UNTIL",
  },
};

// ── Shared helpers ────────────────────────────────────────────────────────────

function cleanBillingAddress(address, companyName) {
  if (!address || !companyName) return address;
  const lines = address.split("\n");
  if (lines[0].trim().toLowerCase() === companyName.toLowerCase()) {
    lines.shift();
    while (lines.length > 0 && !lines[0].trim()) lines.shift();
  }
  return lines.join("\n");
}

const docLbl = {
  fontSize: 9,
  fontWeight: 700,
  letterSpacing: ".08em",
  textTransform: "uppercase",
  color: "#A9ACB3",
  margin: "0 0 6px",
};

function currencyInWords(n, currency = "INR") {
  const cleanCurrency = String(currency || "INR").toUpperCase();
  const a = ["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"];
  const b = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
  const two = (x) => x < 20 ? a[x] : b[Math.floor(x / 10)] + (x % 10 ? " " + a[x % 10] : "");
  const three = (x) => (x >= 100 ? a[Math.floor(x / 100)] + " Hundred " : "") + two(x % 100);
  
  let num = Math.floor(n || 0), out = "";
  
  if (cleanCurrency === "INR") {
    const cr = Math.floor(num / 10000000); num %= 10000000;
    const lk = Math.floor(num / 100000); num %= 100000;
    const th = Math.floor(num / 1000); num %= 1000;
    if (cr) out += three(cr) + " Crore ";
    if (lk) out += two(lk) + " Lakh ";
    if (th) out += two(th) + " Thousand ";
    if (num) out += three(num);
    return (out.trim() || "Zero") + " Rupees Only";
  } else {
    // International standard: billions, millions, thousands
    const bn = Math.floor(num / 1000000000); num %= 1000000000;
    const mn = Math.floor(num / 1000000); num %= 1000000;
    const th = Math.floor(num / 1000); num %= 1000;
    if (bn) out += three(bn) + " Billion ";
    if (mn) out += three(mn) + " Million ";
    if (th) out += three(th) + " Thousand ";
    if (num) out += three(num);
    
    const unitName = cleanCurrency === "USD" ? "Dollars" : (cleanCurrency === "AED" ? "Dirhams" : cleanCurrency);
    return (out.trim() || "Zero") + " " + unitName + " Only";
  }
}

const itTh = {
  padding: "8px 6px",
  fontSize: 9,
  fontWeight: 700,
  letterSpacing: ".04em",
  textTransform: "uppercase",
};
const itTd = {
  padding: "8px 6px",
  fontSize: 10.5,
  color: "#4B5563",
  verticalAlign: "top",
};

function AddrBlock({ title, s, b, isSellerBlock, accentColor }) {
  // s = seller object, b = buyer object — only one is non-empty per call
  const entity = isSellerBlock ? s : b;
  const primaryName = isSellerBlock
    ? (s.legalName || "MODUS")
    : (b.companyName || b.name || "");
  return (
    <div style={{ flex: 1 }}>
      <p style={{ ...docLbl, color: accentColor || "#A9ACB3" }}>{title}</p>
      {primaryName && (
        <p style={{ fontSize: 12.5, fontWeight: 700, color: "#0A0A0A", margin: "0 0 3px", lineHeight: 1.4 }}>
          {primaryName}
        </p>
      )}
      {isSellerBlock ? (
        <>
          {s.addressLine1 && <p style={{ fontSize: 10.5, color: "#4B5563", margin: "0 0 1px", lineHeight: 1.5 }}>{s.addressLine1}</p>}
          {s.addressLine2 && <p style={{ fontSize: 10.5, color: "#4B5563", margin: "0 0 1px", lineHeight: 1.5 }}>{s.addressLine2}</p>}
          {(s.city || s.state || s.country) && (
            <p style={{ fontSize: 10.5, color: "#4B5563", margin: "0 0 1px", lineHeight: 1.5 }}>
              {[s.city, s.state, s.pincode, s.country].filter(Boolean).join(", ")}
            </p>
          )}
          {s.gstin && <p style={{ fontSize: 10, color: "#6B7280", margin: "2px 0 0" }}>GSTIN: {s.gstin}</p>}
          {s.email && <p style={{ fontSize: 10, color: "#6B7280", margin: "1px 0 0" }}>{s.email}</p>}
        </>
      ) : (
        <>
          {b.contactPerson && <p style={{ fontSize: 10.5, color: "#4B5563", margin: "0 0 1px" }}>Attn: {b.contactPerson}</p>}
          {b.billingAddress && <p style={{ fontSize: 10.5, color: "#4B5563", margin: "0 0 1px", lineHeight: 1.5, whiteSpace: "pre-line" }}>{cleanBillingAddress(b.billingAddress, b.companyName || b.name)}</p>}
          {(b.city || b.state || b.country) && (
            <p style={{ fontSize: 10.5, color: "#4B5563", margin: "0 0 1px", lineHeight: 1.5 }}>
              {[b.city, b.state, b.pincode, b.country].filter(Boolean).join(", ")}
            </p>
          )}
          {b.gstin && <p style={{ fontSize: 10, color: "#6B7280", margin: "2px 0 0" }}>GSTIN: {b.gstin}</p>}
          {!b.gstin && b.pan && <p style={{ fontSize: 10, color: "#6B7280", margin: "1px 0 0" }}>PAN: {b.pan}</p>}
          {b.email && <p style={{ fontSize: 10, color: "#6B7280", margin: "1px 0 0" }}>{b.email}</p>}
          {b.phone && <p style={{ fontSize: 10, color: "#6B7280", margin: "1px 0 0" }}>{b.phone}</p>}
        </>
      )}
    </div>
  );
}

function ItemTable({ inv, items, headerBg, headerColor, accentColor }) {
  const isInterstate = !!inv.isInterstate;
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10.5, tableLayout: "fixed" }}>
      <thead>
        <tr style={{ background: headerBg, color: headerColor }}>
          <th style={{ ...itTh, width: 22, textAlign: "center", color: headerColor }}>#</th>
          <th style={{ ...itTh, textAlign: "left", color: headerColor }}>Description</th>
          <th style={{ ...itTh, width: 50, textAlign: "center", color: headerColor }}>SAC</th>
          <th style={{ ...itTh, width: 34, textAlign: "center", color: headerColor }}>Qty</th>
          <th style={{ ...itTh, width: 72, textAlign: "right", color: headerColor }}>Rate</th>
          <th style={{ ...itTh, width: 76, textAlign: "right", color: headerColor }}>Taxable</th>
          {isInterstate ? (
            <th style={{ ...itTh, width: 62, textAlign: "right", color: headerColor }}>IGST</th>
          ) : (
            <>
              <th style={{ ...itTh, width: 58, textAlign: "right", color: headerColor }}>CGST</th>
              <th style={{ ...itTh, width: 58, textAlign: "right", color: headerColor }}>SGST</th>
            </>
          )}
          <th style={{ ...itTh, width: 78, textAlign: "right", color: headerColor }}>Amount</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item, i) => (
          <tr key={item.id || i} style={{ borderBottom: "1px solid #EEEEF0" }}>
            <td style={{ ...itTd, textAlign: "center", color: "#9CA3AF" }}>{i + 1}</td>
            <td style={{ ...itTd }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: "#0A0A0A", margin: 0, lineHeight: 1.4 }}>{item.itemName}</p>
              {item.description && (
                <p style={{ fontSize: 10, color: "#6B7280", margin: "2px 0 0", lineHeight: 1.4 }}>{item.description}</p>
              )}
            </td>
            <td style={{ ...itTd, textAlign: "center", color: "#6B7280", fontFamily: "monospace" }}>{item.hsnSacCode || "—"}</td>
            <td style={{ ...itTd, textAlign: "center" }}>
              {Number(item.quantity).toFixed(2)}{" "}
              <span style={{ color: "#9CA3AF" }}>{item.unit}</span>
            </td>
            <td style={{ ...itTd, textAlign: "right" }}>{formatMoney(item.unitPrice, inv.currency)}</td>
            <td style={{ ...itTd, textAlign: "right" }}>{formatMoney(item.taxableValue, inv.currency)}</td>
            {isInterstate ? (
              <td style={{ ...itTd, textAlign: "right" }}>
                <div style={{ fontSize: 9, color: "#9CA3AF" }}>{Number(item.igstRate || 0).toFixed(0)}%</div>
                {formatMoney(item.igstAmount || 0, inv.currency)}
              </td>
            ) : (
              <>
                <td style={{ ...itTd, textAlign: "right" }}>
                  <div style={{ fontSize: 9, color: "#9CA3AF" }}>{Number(item.cgstRate || 0).toFixed(1)}%</div>
                  {formatMoney(item.cgstAmount || 0, inv.currency)}
                </td>
                <td style={{ ...itTd, textAlign: "right" }}>
                  <div style={{ fontSize: 9, color: "#9CA3AF" }}>{Number(item.sgstRate || 0).toFixed(1)}%</div>
                  {formatMoney(item.sgstAmount || 0, inv.currency)}
                </td>
              </>
            )}
            <td style={{ ...itTd, textAlign: "right", fontWeight: 650, color: "#0A0A0A" }}>
              {formatMoney(item.lineTotal, inv.currency)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Totals({ inv, accentColor }) {
  const row = (label, val, opts = {}) => (
    <div style={{
      display: "flex",
      justifyContent: "space-between",
      padding: opts.big ? "11px 14px" : "7px 14px",
      background: opts.big ? accentColor : "transparent",
      color: opts.big ? "#fff" : "#4B5563",
      borderRadius: opts.big ? 8 : 0,
    }}>
      <span style={{ fontSize: opts.big ? 13 : 11.5, fontWeight: opts.big ? 700 : 500 }}>{label}</span>
      <span style={{ fontSize: opts.big ? 15 : 11.5, fontWeight: opts.big ? 750 : 650, color: opts.big ? "#fff" : "#0A0A0A" }}>{val}</span>
    </div>
  );

  const isInterstate = !!inv.isInterstate;
  return (
    <div style={{ width: 260 }}>
      {Number(inv.subtotal) > 0 && row("Subtotal", formatMoney(inv.subtotal, inv.currency))}
      {Number(inv.totalDiscount) > 0 && (
        <div style={{ display: "flex", justifyContent: "space-between", padding: "7px 14px" }}>
          <span style={{ fontSize: 11.5, fontWeight: 500, color: "#4B5563" }}>Discount</span>
          <span style={{ fontSize: 11.5, fontWeight: 650, color: "#059669" }}>-{formatMoney(inv.totalDiscount, inv.currency)}</span>
        </div>
      )}
      {row("Taxable value", formatMoney(inv.taxableAmount || 0, inv.currency))}
      {isInterstate ? (
        Number(inv.igstAmount) > 0 ? row("IGST", formatMoney(inv.igstAmount, inv.currency)) : null
      ) : (
        <>
          {Number(inv.cgstAmount) > 0 && row("CGST", formatMoney(inv.cgstAmount, inv.currency))}
          {Number(inv.sgstAmount) > 0 && row("SGST", formatMoney(inv.sgstAmount, inv.currency))}
        </>
      )}
      {Number(inv.roundOff) !== 0 && row("Round Off", formatMoney(inv.roundOff, inv.currency))}
      <div style={{ height: 1, background: "#EEEEF0", margin: "4px 14px" }} />
      {row("Total payable", formatMoney(inv.grandTotal, inv.currency), { big: true })}
    </div>
  );
}

function BankBlock({ s, paymentMethodList }) {
  const showBank = paymentMethodList.length === 0 || paymentMethodList.includes("bank_transfer");
  const showUpi = paymentMethodList.length === 0 || paymentMethodList.includes("upi");
  return (
    <div>
      {showBank && (s.bankName || s.accountNumber) && (
        <>
          <p style={docLbl}>Payment details</p>
          <div style={{ fontSize: 10.5, color: "#4B5563", lineHeight: 1.7 }}>
            {s.bankName && <div><span style={{ color: "#9CA3AF" }}>Bank:</span> {s.bankName}</div>}
            {s.accountHolderName && <div><span style={{ color: "#9CA3AF" }}>A/C Holder:</span> {s.accountHolderName}</div>}
            {s.accountNumber && <div><span style={{ color: "#9CA3AF" }}>A/C:</span> {s.accountNumber}</div>}
            {s.ifsc && <div><span style={{ color: "#9CA3AF" }}>IFSC:</span> {s.ifsc}</div>}
            {showUpi && s.upiId && <div><span style={{ color: "#9CA3AF" }}>UPI:</span> {s.upiId}</div>}
          </div>
        </>
      )}
      {!showBank && showUpi && s.upiId && (
        <>
          <p style={docLbl}>UPI payment</p>
          <div style={{ fontSize: 10.5, color: "#4B5563" }}>UPI ID: {s.upiId}</div>
        </>
      )}
    </div>
  );
}

// ── Shared meta row (supply type, place of supply, etc.) ─────────────────────
function MetaRow({ inv, b }) {
  const hasAny = inv.poNumber || inv.reverseCharge || (b.pan && !b.gstin) || inv.servicePeriodFrom || inv.servicePeriodTo || inv.placeOfSupply;
  if (!hasAny) return null;
  const cell = (label, val, highlight) => (
    <div>
      <p style={{ fontSize: 9, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: ".08em", margin: "0 0 2px" }}>{label}</p>
      <p style={{ fontSize: 11, fontWeight: 600, color: highlight || "#0A0A0A", margin: 0 }}>{val}</p>
    </div>
  );
  return (
    <div style={{ padding: "10px 36px", background: "#FAFAFA", borderBottom: "1px solid #E5E7EB", display: "flex", flexWrap: "wrap", gap: 24, alignItems: "center" }}>
      {inv.placeOfSupply && cell("Place of Supply", `${inv.placeOfSupply}${inv.placeOfSupplyCode ? ` (${inv.placeOfSupplyCode})` : ""}`)}
      {b.pan && !b.gstin && cell("PAN", b.pan)}
      {inv.poNumber && cell("PO Number", inv.poNumber)}
      {(inv.servicePeriodFrom || inv.servicePeriodTo) && cell("Service Period",
        [inv.servicePeriodFrom ? formatDate(inv.servicePeriodFrom) : "", inv.servicePeriodTo ? formatDate(inv.servicePeriodTo) : ""].filter(Boolean).join(" → "))}
      {inv.reverseCharge && cell("Reverse Charge", "Yes (Recipient pays GST)", "#E11D2C")}
    </div>
  );
}

// ── Shared footer/signatory ───────────────────────────────────────────────────
function Signatory({ s }) {
  return (
    <div style={{ textAlign: "right", alignSelf: "flex-end" }}>
      {s.signatureUrl && (
        <img src={s.signatureUrl} alt="Signature" style={{ height: 40, marginBottom: 4, display: "block", marginLeft: "auto" }} />
      )}
      <div style={{ borderTop: "1px solid #0A0A0A", paddingTop: 4, minWidth: 160 }}>
        <p style={{ fontSize: 10, fontWeight: 600, color: "#0A0A0A", margin: 0 }}>For {s.legalName || "MODUS"}</p>
        <p style={{ fontSize: 9, color: "#6B7280", margin: "1px 0 0" }}>Authorised Signatory</p>
      </div>
    </div>
  );
}

// ── MODERN template — Reference design (Manrope) ───────────
function TemplateModern({ inv, s, b, items, paymentMethodList, docLabels }) {
  const accent = "#E11D2C";
  const ink = "#1A1A1A";
  const money = (n) => formatMoney(n || 0, inv.currency);
  const isInterstate = !!inv.isInterstate;
  const taxable = Number(inv.taxableAmount || inv.subtotal || 0);
  const cgstPct = taxable > 0 ? Math.round((Number(inv.cgstAmount || 0) / taxable) * 100) : 9;
  const sgstPct = taxable > 0 ? Math.round((Number(inv.sgstAmount || 0) / taxable) * 100) : 9;
  const igstPct = taxable > 0 ? Math.round((Number(inv.igstAmount || 0) / taxable) * 100) : 18;
  const totalTax = Number(inv.cgstAmount || 0) + Number(inv.sgstAmount || 0) + Number(inv.igstAmount || 0);

  const sellerName = s.legalName || "MODUS";
  const sellerLines = [
    s.addressLine1, s.addressLine2,
    [s.city, s.state, s.pincode, s.country].filter(Boolean).join(", "),
    s.gstin ? `GSTIN: ${s.gstin}` : null,
  ].filter(Boolean);
  const buyerName = b.companyName || b.name || "—";
  const buyerLines = [
    cleanBillingAddress(b.billingAddress, buyerName !== "—" ? buyerName : null),
    [b.city, b.state, b.pincode, b.country].filter(Boolean).join(", "),
    b.gstin ? `GSTIN: ${b.gstin}` : (b.pan ? `PAN: ${b.pan}` : null),
  ].filter(Boolean);
  // Registered legal entity for the footer (e.g. "Acuity Studios Pvt Ltd"), falls back to brand name.
  const registeredName = s.registeredName || sellerName;

  // Export / SEZ endorsement (Rule 46 — mandatory on zero-rated export invoices).
  const EXPORT_T = ["overseas", "sez_with_payment", "sez_without_payment", "deemed_export"];
  const isExport = EXPORT_T.includes(inv.gstCategory);
  const withPayment = inv.gstCategory === "sez_with_payment";
  const isSez = inv.gstCategory === "sez_with_payment" || inv.gstCategory === "sez_without_payment";
  const exportEndorsement = isExport
    ? `SUPPLY MEANT FOR ${isSez ? "SEZ" : "EXPORT"} ${withPayment
        ? "ON PAYMENT OF INTEGRATED TAX"
        : `UNDER LUT / BOND WITHOUT PAYMENT OF INTEGRATED TAX${s.lutNumber ? ` (LUT: ${s.lutNumber})` : ""}`}`
    : null;

  // Terms — split user terms into bullets, else the 4 standard terms.
  // Order matters: a 2-column grid fills col1=[0,2], col2=[1,3].
  const termsList = (inv.terms && inv.terms.trim())
    ? inv.terms.split("\n").map((t) => t.trim()).filter(Boolean)
    : [
        "Payment is due within the specified due date on this invoice.",
        "All services are non-refundable once delivered and approved.",
        "Please quote the invoice number in all payment communications.",
        "Any disputes are subject to the jurisdiction of Ernakulam courts.",
      ];

  const RED_LABEL = { fontSize: 11, fontWeight: 800, letterSpacing: ".14em", textTransform: "uppercase", color: accent, margin: "0 0 10px" };

  const showBank = paymentMethodList.length === 0 || paymentMethodList.includes("bank_transfer");
  const showUpi = paymentMethodList.length === 0 || paymentMethodList.includes("upi");
  const upiQr = showUpi && s.upiId
    ? `https://api.qrserver.com/v1/create-qr-code/?size=160x160&margin=0&data=${encodeURIComponent(`upi://pay?pa=${s.upiId}&pn=${sellerName}`)}`
    : null;

  // Tax-summary row
  const TaxRow = ({ label, value, bold, muted, last }) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "9px 0", borderBottom: last ? "none" : "1px solid #ECECEC" }}>
      <span style={{ fontSize: 12, fontWeight: bold ? 700 : 500, color: muted ? "#B7B7BC" : "#1A1A1A", fontStyle: muted ? "italic" : "normal" }}>{label}</span>
      <span style={{ fontSize: 12.5, fontWeight: bold ? 800 : 600, color: muted ? "#B7B7BC" : "#1A1A1A", fontStyle: muted ? "italic" : "normal" }}>{value}</span>
    </div>
  );

  return (
    <div style={{ fontFamily: "'Manrope', sans-serif", display: "flex", flexDirection: "column", flex: 1, color: ink }}>
      {/* ── HEADER BAND ── */}
      <div style={{ background: ink, padding: "22px 44px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <Logo tone="dark" height={34} accent={accent} />
          <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".34em", color: "#8A8A8F", margin: "8px 0 0" }}>CREATIVE STUDIO</p>
        </div>
        <div style={{ width: 1, alignSelf: "stretch", background: "rgba(255,255,255,.16)", margin: "4px 30px" }} />
        <div style={{ textAlign: "right", flex: 1 }}>
          <p style={{ fontSize: 38, fontWeight: 800, letterSpacing: "-0.01em", margin: 0, lineHeight: 1 }}>
            {(() => {
              const parts = docLabels.taxTitle.split(" ");
              const first = parts.shift();
              const rest = parts.join(" ");
              return (
                <>
                  <span style={{ color: accent }}>{first}</span>
                  {rest && <span style={{ color: "#FFFFFF", marginLeft: 6 }}>{rest}</span>}
                </>
              );
            })()}
          </p>
          <p style={{ fontSize: 13, fontWeight: 700, letterSpacing: ".22em", color: accent, margin: "12px 0 0" }}>
            {(s.website || "MODUS.LOCAL").replace(/^https?:\/\//, "").replace(/\/$/, "").toUpperCase()}
          </p>
        </div>
      </div>
      {/* Red rule */}
      <div style={{ height: 6, background: accent }} />

      {/* ── BODY ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "20px 44px 0" }}>
        {/* Info row: From / To / Details */}
        <div style={{ display: "flex", gap: 36, paddingBottom: 18, borderBottom: "1px solid #ECECEC" }}>
          <div style={{ flex: 1 }}>
            <p style={RED_LABEL}>Invoice From</p>
            <p style={{ fontSize: 15, fontWeight: 700, margin: "0 0 8px" }}>{sellerName}</p>
            {sellerLines.map((l, i) => (
              <p key={i} style={{ fontSize: 12, color: "#3A3A40", margin: "0 0 3px", lineHeight: 1.45 }}>{l}</p>
            ))}
          </div>
          <div style={{ flex: 1 }}>
            <p style={RED_LABEL}>Invoice To</p>
            <p style={{ fontSize: 15, fontWeight: 700, margin: "0 0 8px" }}>{buyerName}</p>
            {buyerLines.map((l, i) => (
              <p key={i} style={{ fontSize: 12, color: "#3A3A40", margin: "0 0 3px", lineHeight: 1.45, whiteSpace: "pre-line" }}>{l}</p>
            ))}
          </div>
          <div style={{ flex: 1 }}>
            <p style={RED_LABEL}>Invoice Details</p>
            {[
              [docLabels.numberLabel, inv.invoiceNumber],
              [docLabels.dateLabel, formatDate(inv.invoiceDate)],
              [docLabels.dueDateLabel, inv.dueDate ? formatDate(inv.dueDate) : "—"],
              ["Payment Terms", inv.paymentTerms || "Net 30 days"],
              ...(inv.placeOfSupply ? [["Place of Supply", `${inv.placeOfSupply}${inv.placeOfSupplyCode ? ` (${inv.placeOfSupplyCode})` : ""}`]] : []),
            ].map(([k, v], i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "6px 0", borderBottom: "1px solid #F0F0F0" }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#1A1A1A" }}>{k}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#3A3A40", textAlign: "right" }}>{v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Export / SEZ endorsement (Rule 46) */}
        {exportEndorsement && (
          <div style={{ margin: "14px 0 0", padding: "8px 12px", border: `1px solid ${accent}`, borderRadius: 8, background: "#FEF2F2" }}>
            <span style={{ fontSize: 10.5, fontWeight: 700, color: accent, letterSpacing: ".02em" }}>{exportEndorsement}</span>
          </div>
        )}

        {/* Services rendered */}
        <p style={{ ...RED_LABEL, margin: "16px 0 9px" }}>Services Rendered</p>
        <div style={{ borderRadius: 8, overflow: "hidden", background: "#F7F7F8" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
            <thead>
              <tr style={{ background: ink, color: "#FFFFFF" }}>
                <th style={{ textAlign: "left", padding: "11px 18px", fontSize: 11.5, fontWeight: 800, letterSpacing: ".06em" }}>DESCRIPTION</th>
                <th style={{ textAlign: "center", padding: "11px 8px", fontSize: 11.5, fontWeight: 800, letterSpacing: ".06em", width: 90 }}>HSN / SAC</th>
                <th style={{ textAlign: "center", padding: "11px 8px", fontSize: 11.5, fontWeight: 800, letterSpacing: ".06em", width: 64 }}>QTY</th>
                <th style={{ textAlign: "right", padding: "11px 14px", fontSize: 11.5, fontWeight: 800, letterSpacing: ".06em", width: 110 }}>RATE</th>
                <th style={{ textAlign: "right", padding: "11px 14px", fontSize: 11.5, fontWeight: 800, letterSpacing: ".06em", width: 110 }}>TAX</th>
                <th style={{ textAlign: "right", padding: "11px 18px", fontSize: 11.5, fontWeight: 800, letterSpacing: ".06em", width: 120 }}>AMOUNT</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={item.id || i} style={{ background: i % 2 === 0 ? "#FFFFFF" : "#F1F1F2" }}>
                  <td style={{ padding: "9px 18px", verticalAlign: "middle" }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: "#1A1A1A", margin: 0, lineHeight: 1.25 }}>{item.itemName}</p>
                    {item.description && <p style={{ fontSize: 10, color: "#7A7A80", margin: "2px 0 0", lineHeight: 1.3 }}>{item.description}</p>}
                  </td>
                  <td style={{ padding: "9px 8px", textAlign: "center", fontSize: 12.5, fontWeight: 600, color: "#1A1A1A", verticalAlign: "middle" }}>{item.hsnSacCode || "—"}</td>
                  <td style={{ padding: "9px 8px", textAlign: "center", fontSize: 12.5, fontWeight: 600, color: "#1A1A1A", verticalAlign: "middle" }}>{Number(item.quantity || 0) % 1 === 0 ? Number(item.quantity || 0) : Number(item.quantity).toFixed(2)}</td>
                  <td style={{ padding: "9px 14px", textAlign: "right", fontSize: 13, fontWeight: 700, color: "#1A1A1A", verticalAlign: "middle" }}>{money(item.unitPrice)}</td>
                  <td style={{ padding: "9px 14px", textAlign: "right", verticalAlign: "middle" }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: "#1A1A1A", margin: 0 }}>{money(item.totalTax || 0)}</p>
                    {item.gstRate > 0 && <p style={{ fontSize: 10, color: "#7A7A80", margin: "2px 0 0" }}>GST {item.gstRate}%</p>}
                  </td>
                  <td style={{ padding: "9px 18px", textAlign: "right", fontSize: 13, fontWeight: 700, color: "#1A1A1A", verticalAlign: "middle" }}>{money(item.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Payment details + Tax summary */}
        <div style={{ display: "flex", gap: 48, padding: "20px 0 0" }}>
          {/* Left: payment details */}
          <div style={{ flex: 1 }}>
            <p style={RED_LABEL}>Payment Details</p>
            {showBank && (s.bankName || s.accountNumber) && (
              <div style={{ marginBottom: 18 }}>
                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".06em", color: "#A0A0A6", margin: "0 0 6px" }}>BANK TRANSFER</p>
                <p style={{ fontSize: 14, fontWeight: 700, color: "#1A1A1A", margin: "0 0 5px" }}>{s.accountHolderName || sellerName}</p>
                {s.accountNumber && <p style={{ fontSize: 12.5, color: "#3A3A40", margin: "0 0 3px" }}>A/C NO: {s.accountNumber}</p>}
                {s.ifsc && <p style={{ fontSize: 12.5, color: "#3A3A40", margin: "0 0 3px" }}>IFSC : {s.ifsc}</p>}
                {s.bankName && <p style={{ fontSize: 12.5, color: "#3A3A40", margin: 0 }}>{s.bankName}</p>}
              </div>
            )}
            {showUpi && s.upiId && (
              <div style={{ marginBottom: 16 }}>
                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".06em", color: "#A0A0A6", margin: "0 0 6px" }}>UPI PAYMENT</p>
                <p style={{ fontSize: 13.5, fontWeight: 600, color: "#1A1A1A", margin: 0 }}>{s.upiId}</p>
              </div>
            )}
            {upiQr && (
              <img src={upiQr} alt="UPI QR" style={{ width: 66, height: 66, padding: 4, background: "#fff", boxSizing: "border-box", border: "1px solid #E5E5E8", borderRadius: 6, display: "block" }} />
            )}

            {/* Signatory */}
            <div style={{ marginTop: 14, display: "flex", alignItems: "flex-end", gap: 14 }}>
              <div>
                <p style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: ".06em", color: "#A0A0A6", margin: "0 0 4px" }}>FOR {sellerName.toUpperCase()}</p>
                {s.signatureUrl && <img src={s.signatureUrl} alt="Signature" style={{ height: 44, margin: "2px 0", display: "block" }} />}
                <p style={{ fontSize: 13, fontWeight: 700, color: "#1A1A1A", margin: "4px 0 1px" }}>Authorized Signatory</p>
                {s.signatoryTitle && <p style={{ fontSize: 10, color: "#9A9AA0", margin: 0, letterSpacing: ".04em" }}>{String(s.signatoryTitle).toUpperCase()}</p>}
              </div>
              {s.stampUrl && (
                <img src={s.stampUrl} alt="Company stamp" style={{ height: 66, width: 66, objectFit: "contain", opacity: 0.88, marginBottom: 2 }} />
              )}
            </div>
          </div>

          {/* Right: tax summary */}
          <div style={{ width: 300 }}>
            <p style={RED_LABEL}>Tax Summary</p>
            {Number(inv.subtotal) > 0 && <TaxRow label="Subtotal" value={money(inv.subtotal)} bold />}
            <TaxRow label="Taxable Value" value={money(taxable)} bold />
            {Number(inv.totalDiscount) > 0 && <TaxRow label="Discount" value={`-${money(inv.totalDiscount)}`} />}
            {isInterstate ? (
              <>
                <TaxRow label={`IGST @ ${igstPct}%`} value={money(inv.igstAmount)} />
                <TaxRow label="CGST / SGST (Intrastate – if applicable)" value="—" muted />
              </>
            ) : (
              <>
                <TaxRow label={`CGST @ ${cgstPct}%`} value={money(inv.cgstAmount)} />
                <TaxRow label={`SGST @ ${sgstPct}%`} value={money(inv.sgstAmount)} />
                <TaxRow label={`IGST @ ${igstPct}% (Interstate – if applicable)`} value={money(inv.igstAmount || 0)} muted />
              </>
            )}
            <TaxRow label="Total Tax" value={money(totalTax)} bold last />

            {/* Amount payable */}
            <div style={{ display: "flex", alignItems: "stretch", marginTop: 12, borderRadius: 6, overflow: "hidden", background: ink }}>
              <div style={{ width: 6, background: accent }} />
              <div style={{ flex: 1, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 18px" }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: ".08em", color: "#FFFFFF", textTransform: "uppercase" }}>Amount Payable</span>
                <span style={{ fontSize: 22, fontWeight: 800, color: accent, letterSpacing: "-0.01em" }}>{money(inv.grandTotal)}</span>
              </div>
            </div>

            {/* Amount in words */}
            <div style={{ background: "#FCE9EC", borderRadius: 6, padding: "9px 16px", marginTop: 8 }}>
              <p style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: ".1em", color: "#C28A92", margin: "0 0 3px", textTransform: "uppercase" }}>Amount in Words</p>
              <p style={{ fontSize: 12.5, fontWeight: 700, color: "#1A1A1A", margin: 0, lineHeight: 1.4 }}>
                {inv.amountInWords || currencyInWords(inv.grandTotal, inv.currency)}
              </p>
            </div>
          </div>
        </div>

        {/* Terms & conditions — bordered box */}
        <div style={{ marginTop: 16, border: "1px solid #E6E6E9", borderTop: "2px solid #1A1A1A", borderRadius: 4, background: "#FCFCFD", padding: "12px 22px" }}>
          <p style={{ ...RED_LABEL, margin: "0 0 9px" }}>Terms &amp; Conditions</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 48, rowGap: 7 }}>
            {termsList.map((t, i) => (
              <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: accent, marginTop: 6, flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: "#3A3A40", lineHeight: 1.45 }}>{t}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, minHeight: 10 }} />
      </div>

      {/* ── FOOTER BAND ── */}
      <div style={{ height: 4, background: accent }} />
      <div style={{ background: ink, padding: "13px 44px", display: "flex", alignItems: "center", justifyContent: "center", gap: 14 }}>
        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".1em", color: accent, textTransform: "uppercase" }}>{registeredName}</span>
        <span style={{ color: "rgba(255,255,255,.5)" }}>•</span>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".1em", color: "#FFFFFF", textTransform: "uppercase" }}>
          Creative Studio{(s.city || s.state) ? `, ${[s.city, s.state].filter(Boolean).join(", ")}` : ""}
        </span>
      </div>
    </div>
  );
}

// ── MINIMAL template (swiss — thin INVOICE wordmark, 2px black rule) ──────────
function TemplateMinimal({ inv, s, b, items, paymentMethodList, docLabels }) {
  return (
    <>
      <div style={{ padding: "40px 44px 0" }}>
        {/* Logo + INVOICE wordmark */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 36 }}>
          <div>
            <Logo tone="light" height={26} accent="#E11D2C" />
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={{ fontSize: 26, fontWeight: 300, letterSpacing: "0.12em", color: "#0A0A0A", margin: 0 }}>{docLabels.titleUpper}</p>
            <p style={{ fontSize: 12, color: "#9CA3AF", margin: "4px 0 0", fontFamily: "monospace" }}>{inv.invoiceNumber}</p>
          </div>
        </div>

        {/* From / To / Dates row */}
        <div style={{ display: "flex", gap: 40, marginBottom: 30 }}>
          <AddrBlock title="From" s={s} b={b} isSellerBlock={true} accentColor="#0A0A0A" />
          <AddrBlock title="Billed to" s={s} b={b} isSellerBlock={false} accentColor="#0A0A0A" />
          <div style={{ flex: 1 }}>
            <p style={docLbl}>{docLabels.dateLabel}</p>
            <p style={{ fontSize: 12.5, fontWeight: 600, margin: "0 0 12px" }}>{formatDate(inv.invoiceDate)}</p>
            {inv.dueDate && (
              <>
                <p style={docLbl}>{docLabels.dueDateLabel}</p>
                <p style={{ fontSize: 12.5, fontWeight: 600, margin: 0, color: "#E11D2C" }}>{formatDate(inv.dueDate)}</p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Meta strip — only if has relevant data */}
      <div style={{ padding: "0 44px" }}>
        <MetaRow inv={inv} b={b} />
      </div>

      {/* Items — no border, transparent header */}
      <div style={{ padding: "0 44px" }}>
        <ItemTable inv={inv} items={items} headerBg="transparent" headerColor="#0A0A0A" accentColor="#E11D2C" />
      </div>

      {/* 2px black rule */}
      <div style={{ borderTop: "2px solid #0A0A0A", margin: "0 44px" }} />

      {/* Amount in words + totals */}
      <div style={{ display: "flex", justifyContent: "space-between", padding: "20px 44px 0", alignItems: "flex-start" }}>
        <div style={{ maxWidth: 280 }}>
          <p style={{ fontSize: 10.5, color: "#9CA3AF", margin: "0 0 4px" }}>Amount in words</p>
          <p style={{ fontSize: 11.5, fontWeight: 600, color: "#1A1A1A", margin: 0, fontStyle: "italic" }}>
            {inv.amountInWords || currencyInWords(inv.grandTotal, inv.currency)}
          </p>
        </div>
        <Totals inv={inv} accentColor="#E11D2C" />
      </div>

      {/* Bank + signatory */}
      <div style={{ display: "flex", justifyContent: "space-between", padding: "28px 44px 40px", borderTop: "1px solid #EEEEF0", marginTop: "auto" }}>
        <div>
          <BankBlock s={s} paymentMethodList={paymentMethodList} />
          {inv.notes && (
            <div style={{ marginTop: 14 }}>
              <p style={docLbl}>Notes</p>
              <p style={{ fontSize: 11, color: "#4B5563", margin: 0, lineHeight: 1.6, whiteSpace: "pre-line", maxWidth: 260 }}>{inv.notes}</p>
            </div>
          )}
          {inv.terms && (
            <div style={{ marginTop: 10 }}>
              <p style={docLbl}>Terms &amp; Conditions</p>
              <p style={{ fontSize: 10, color: "#6B7280", margin: 0, lineHeight: 1.6, whiteSpace: "pre-line", maxWidth: 260 }}>{inv.terms}</p>
            </div>
          )}
        </div>
        <Signatory s={s} />
      </div>
    </>
  );
}

// ── CLASSIC template (bordered TAX INVOICE grid) ──────────────────────────────
function TemplateClassic({ inv, s, b, items, paymentMethodList, docLabels }) {
  const accent = "#E11D2C";
  return (
    <div style={{ border: "2px solid #0A0A0A", margin: 14, padding: 0, flex: 1, display: "flex", flexDirection: "column" }}>
      {/* Header row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 22px", borderBottom: "2px solid #0A0A0A" }}>
        <div>
          <Logo tone="light" height={24} accent="#E11D2C" />
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ fontSize: 15, fontWeight: 800, letterSpacing: ".1em", margin: 0 }}>{docLabels.taxTitle}</p>
          <p style={{ fontSize: 10, color: "#6B7280", margin: "2px 0 0" }}>Original for Recipient</p>
        </div>
      </div>

      {/* Seller / Buyer / Invoice meta — 3 columns */}
      <div style={{ display: "flex", borderBottom: "1px solid #D6D6D9" }}>
        <div style={{ flex: 1, padding: "14px 22px", borderRight: "1px solid #D6D6D9" }}>
          <AddrBlock title="Seller" s={s} b={b} isSellerBlock={true} accentColor={accent} />
        </div>
        <div style={{ flex: 1, padding: "14px 22px", borderRight: "1px solid #D6D6D9" }}>
          <AddrBlock title="Buyer" s={s} b={b} isSellerBlock={false} accentColor={accent} />
        </div>
        <div style={{ width: 180, padding: "14px 22px" }}>
          <div style={{ marginBottom: 10 }}>
            <p style={docLbl}>{docLabels.numberLabel}</p>
            <p style={{ fontSize: 12, fontWeight: 700, margin: 0, fontFamily: "monospace" }}>{inv.invoiceNumber}</p>
          </div>
          <div style={{ marginBottom: 10 }}>
            <p style={docLbl}>Date</p>
            <p style={{ fontSize: 12, fontWeight: 600, margin: 0 }}>{formatDate(inv.invoiceDate)}</p>
          </div>
          {inv.dueDate && (
            <div style={{ marginBottom: 10 }}>
              <p style={docLbl}>{docLabels.due}</p>
              <p style={{ fontSize: 12, fontWeight: 600, margin: 0, color: accent }}>{formatDate(inv.dueDate)}</p>
            </div>
          )}
          {inv.placeOfSupply && (
            <div>
              <p style={docLbl}>Place of Supply</p>
              <p style={{ fontSize: 12, fontWeight: 600, margin: 0 }}>{inv.placeOfSupply}{inv.placeOfSupplyCode ? ` (${inv.placeOfSupplyCode})` : ""}</p>
            </div>
          )}
        </div>
      </div>

      {/* Items */}
      <ItemTable inv={inv} items={items} headerBg="#0A0A0A" headerColor="#fff" accentColor={accent} />

      {/* Totals + bank row */}
      <div style={{ display: "flex", borderTop: "1px solid #D6D6D9" }}>
        <div style={{ flex: 1, padding: "14px 22px", borderRight: "1px solid #D6D6D9" }}>
          <p style={{ fontSize: 10.5, color: "#9CA3AF", margin: "0 0 4px" }}>Amount in words</p>
          <p style={{ fontSize: 11.5, fontWeight: 600, margin: "0 0 16px", fontStyle: "italic" }}>
            {inv.amountInWords || currencyInWords(inv.grandTotal, inv.currency)}
          </p>
          <BankBlock s={s} paymentMethodList={paymentMethodList} />
          {inv.notes && (
            <div style={{ marginTop: 12 }}>
              <p style={docLbl}>Notes</p>
              <p style={{ fontSize: 11, color: "#4B5563", margin: 0, lineHeight: 1.6, whiteSpace: "pre-line" }}>{inv.notes}</p>
            </div>
          )}
          {inv.terms && (
            <div style={{ marginTop: 10 }}>
              <p style={docLbl}>Terms &amp; Conditions</p>
              <p style={{ fontSize: 10, color: "#6B7280", margin: 0, lineHeight: 1.6, whiteSpace: "pre-line" }}>{inv.terms}</p>
            </div>
          )}
        </div>
        <div style={{ width: 290, padding: "14px 8px 14px 0" }}>
          <Totals inv={inv} accentColor={accent} />
        </div>
      </div>

      {/* Footer row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", padding: "14px 22px", borderTop: "1px solid #D6D6D9", marginTop: "auto" }}>
        <p style={{ fontSize: 9.5, color: "#9CA3AF", margin: 0, maxWidth: 320, lineHeight: 1.5 }}>
          Subject to {[s.city, "jurisdiction"].filter(Boolean).join(" ")}. This is a computer-generated invoice and does not require a physical signature.
          {inv.reverseCharge && " Reverse charge applicable."}
        </p>
        <div style={{ textAlign: "right" }}>
          {s.signatureUrl && (
            <img src={s.signatureUrl} alt="Signature" style={{ height: 36, marginBottom: 4, display: "block", marginLeft: "auto" }} />
          )}
          <div style={{ width: 140, height: 32, borderBottom: "1px solid #0A0A0A", marginBottom: 5 }} />
          <p style={{ fontSize: 10, color: "#4B5563", margin: 0 }}>For {s.legalName || "MODUS"}</p>
        </div>
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * InvoiceDocument — single source of truth for all invoice rendering.
 *
 * Props:
 *   invoice      — invoice record (camelCase fields from API)
 *   customer     — customer / buyer object (or snapshot)
 *   items        — array of invoice_items (camelCase)
 *   seller       — company / seller object (or snapshot)
 *   template     — "modern" | "minimal" | "classic"  (default "modern")
 *   mode         — "screen" | "print"
 *
 * Legacy compat: templateId + templates props still accepted but ignored;
 * callers should pass `template` string directly.
 */
export default function InvoiceDocument({
  invoice,
  customer,
  items,
  seller,
  template = "modern",
  mode = "screen",
  docType = "invoice",
  // legacy — kept so existing callers don't crash
  templateId: _templateId,
  templates: _templates,
}) {
  if (!invoice) return null;

  const inv = invoice;
  const s = seller || {};
  const b = customer || {};
  const itemList = items || [];

  const paymentMethodList = (() => {
    if (!inv.paymentMethod) return [];
    try {
      const p = JSON.parse(inv.paymentMethod);
      return Array.isArray(p) ? p : [p];
    } catch { return [inv.paymentMethod]; }
  })();

  // Normalize template name — guard against unknown slugs
  const tpl = ["modern", "minimal", "classic"].includes(template) ? template : "modern";

  const isPrint = mode === "print";
  const pageStyle = isPrint
    ? { width: "210mm", minHeight: "297mm", padding: 0, margin: 0, background: "#FFFFFF", boxShadow: "none", borderRadius: 0, border: "none" }
    : { width: "210mm", minHeight: "297mm", padding: 0, margin: "0 auto", background: "#FFFFFF", boxShadow: "0 8px 32px rgba(0,0,0,0.1)", borderRadius: 4, border: "1px solid #EBEBEB" };

  const sharedProps = { inv, s, b, items: itemList, paymentMethodList, docLabels: DOC_LABELS[docType] || DOC_LABELS.invoice };

  return (
    <div
      className="modus-invoice-doc"
      style={{ ...pageStyle, fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#0A0A0A", overflow: "hidden", display: "flex", flexDirection: "column" }}
    >
      {tpl === "modern" && <TemplateModern {...sharedProps} />}
      {tpl === "minimal" && <TemplateMinimal {...sharedProps} />}
      {tpl === "classic" && <TemplateClassic {...sharedProps} />}
    </div>
  );
}
