import { createPortal } from "react-dom";
import { Icon } from "./icons.jsx";
import { Avatar, ghostBtn } from "./primitives.jsx";
import { formatMoney, formatDate, formatINRk } from "@/utils/format.js";

const TONES = ["#E11D2C","#2563EB","#16A34A","#F59E0B","#7C3AED","#0891B2","#EA580C","#DB2777"];
function avatarTone(name) {
  if (!name) return TONES[0];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = ((h << 5) - h + name.charCodeAt(i)) >>> 0;
  return TONES[h % TONES.length];
}

const ACCENT = "#E11D2C";

const sectLbl = {
  fontSize: 11, fontWeight: 700, letterSpacing: ".07em",
  textTransform: "uppercase", color: "#B4B7BE", margin: "0 0 8px",
};

function MiniBox({ label, value, tint }) {
  return (
    <div style={{ background: tint + "0F", borderRadius: 13, padding: "14px 16px" }}>
      <p style={{ fontSize: 11.5, color: "#9CA3AF", margin: "0 0 4px", fontWeight: 500 }}>{label}</p>
      <p style={{ fontSize: 19, fontWeight: 750, color: tint, margin: 0, letterSpacing: "-0.02em" }}>{value}</p>
    </div>
  );
}

function DetailRow({ icon, label, value, mono }) {
  if (!value && value !== 0) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid #F7F7F8" }}>
      <div style={{ width: 32, height: 32, borderRadius: 9, background: "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon name={icon} size={15} color="#8A8D94" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 11, color: "#A9ACB3", margin: "0 0 1px" }}>{label}</p>
        <p style={{ fontSize: 13, color: "#0A0A0A", fontWeight: 550, margin: 0, fontFamily: mono ? "ui-monospace, monospace" : "inherit", wordBreak: "break-all" }}>
          {value}
        </p>
      </div>
    </div>
  );
}

const STATUS_CHIP = {
  active:   { label: "Active",   color: "#15803D", bg: "#DCFCE7" },
  inactive: { label: "Inactive", color: "#6B7280", bg: "#F3F4F6" },
  on_leave: { label: "On Leave", color: "#B45309", bg: "#FEF3C7" },
};

/**
 * DetailDrawer — slide-in panel for customer / vendor / employee.
 *
 * Props:
 *   open       boolean
 *   onClose    () => void
 *   kind       "customers" | "vendors" | "employees"
 *   item       the entity object from the API
 *   onEdit     (item) => void   — opens the CRUD modal
 *   onNewInvoice (item) => void — navigate to new invoice (customers only)
 */
export default function DetailDrawer({ open, onClose, kind, item, onEdit, onNewInvoice }) {
  if (!open || !item) return null;

  const isEmp = kind === "employees";
  const isCust = kind === "customers";
  const displayName = item.companyName || item.name;
  const tone = avatarTone(displayName);
  const accent = isCust ? ACCENT : (kind === "vendors" ? "#2563EB" : "#7C3AED");

  // Sub-heading under name
  const subLine = isEmp
    ? (item.designation || "Employee")
    : (item.contactPerson || item.email || "");

  // Money boxes (customers + vendors only)
  const moneyVal = isCust ? (item.outstandingBalance || 0) : (item.totalPayable || 0);
  const moneyLabel = isCust ? "Outstanding" : "Payable";
  const countLabel = isCust ? "Invoices" : "Bills";
  const countVal = isCust ? (item.invoiceCount || 0) : (item.billCount || 0);

  const empStatus = STATUS_CHIP[item.status] || STATUS_CHIP.active;

  if (typeof document === "undefined") return null;
  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 1300 }}>
      {/* Backdrop */}
      <div
        role="button"
        tabIndex={-1}
        aria-label="Close drawer"
        onClick={onClose}
        onKeyDown={(e) => e.key === "Enter" && onClose()}
        style={{ position: "absolute", inset: 0, background: "rgba(10,10,12,.32)", backdropFilter: "blur(2px)", animation: "fade .2s ease" }}
      />
      {/* Panel */}
      <div style={{
        position: "absolute", top: 0, right: 0, bottom: 0, width: 420, maxWidth: "92vw",
        background: "#fff", boxShadow: "-20px 0 60px rgba(0,0,0,.18)",
        display: "flex", flexDirection: "column", animation: "slideIn .28s cubic-bezier(.22,1,.36,1)",
      }}>
        {/* Header */}
        <div style={{ padding: "22px 24px", borderBottom: "1px solid #F2F2F4", display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <Avatar name={displayName} tone={tone} size={54} radius={16} src={item.imageUrl} />
            <div>
              <p style={{ fontSize: 18, fontWeight: 750, color: "#0A0A0A", margin: "0 0 3px", letterSpacing: "-0.02em" }}>{displayName}</p>
              <p style={{ fontSize: 13, color: "#9CA3AF", margin: 0 }}>{subLine}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ width: 34, height: 34, borderRadius: 10, border: "1px solid #ECECEE", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#6B7280" }}
          >
            <Icon name="x" size={17} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
          {/* Money boxes — customers + vendors */}
          {!isEmp && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 22 }}>
              <MiniBox
                label={moneyLabel}
                value={moneyVal > 0 ? formatMoney(moneyVal) : "Settled"}
                tint={moneyVal > 0 ? accent : "#22C55E"}
              />
              <MiniBox
                label={countLabel}
                value={countVal}
                tint="#2563EB"
              />
            </div>
          )}

          {/* Employee status box */}
          {isEmp && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 22 }}>
              <div style={{ background: empStatus.bg, borderRadius: 13, padding: "14px 16px" }}>
                <p style={{ fontSize: 11.5, color: "#9CA3AF", margin: "0 0 4px", fontWeight: 500 }}>Status</p>
                <p style={{ fontSize: 16, fontWeight: 750, color: empStatus.color, margin: 0 }}>{empStatus.label}</p>
              </div>
              {item.salaryAmount && (
                <div style={{ background: "#7C3AED0F", borderRadius: 13, padding: "14px 16px" }}>
                  <p style={{ fontSize: 11.5, color: "#9CA3AF", margin: "0 0 4px", fontWeight: 500 }}>Salary</p>
                  <p style={{ fontSize: 14, fontWeight: 750, color: "#7C3AED", margin: 0 }}>
                    {"₹" + Number(item.salaryAmount).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Section: Employment (employees) / Business details (others) */}
          <p style={sectLbl}>{isEmp ? "Employment" : "Business details"}</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: 22 }}>
            {isEmp ? (
              <>
                <DetailRow icon="briefcase" label="Department" value={item.department} />
                <DetailRow icon="calendar" label="Joined" value={formatDate(item.joinDate)} />
                <DetailRow icon="check"    label="Status"   value={empStatus.label} />
                {item.employeeId && <DetailRow icon="file"  label="Employee ID" value={item.employeeId} mono />}
              </>
            ) : (
              <>
                {item.gstin && <DetailRow icon="receipt" label="GSTIN"    value={item.gstin} mono />}
                {item.pan   && <DetailRow icon="file"    label="PAN"      value={item.pan}   mono />}
                {(item.city || item.state) && (
                  <DetailRow icon="mapPin" label="Location" value={[item.city, item.state].filter(Boolean).join(", ")} />
                )}
                {item.country && <DetailRow icon="building" label="Country" value={item.country} />}
              </>
            )}
          </div>

          {/* Section: Contact */}
          <p style={sectLbl}>Contact</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {item.email && <DetailRow icon="mail"  label="Email" value={item.email} />}
            {item.phone && <DetailRow icon="phone" label="Phone" value={item.phone} />}
            {!isEmp && item.contactPerson && (
              <DetailRow icon="users" label="Primary contact" value={item.contactPerson} />
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: "16px 24px", borderTop: "1px solid #F2F2F4", display: "flex", gap: 10 }}>
          <button
            type="button"
            onClick={() => { onClose(); onEdit(item); }}
            style={{ ...ghostBtn, flex: 1, justifyContent: "center", padding: "11px" }}
          >
            <Icon name="edit" size={15} /> Edit
          </button>
          {isCust && onNewInvoice && (
            <button
              type="button"
              onClick={() => { onClose(); onNewInvoice(item); }}
              style={{ flex: 1, justifyContent: "center", padding: "11px", display: "inline-flex", alignItems: "center", gap: 6, background: ACCENT, color: "#fff", border: "none", borderRadius: 10, fontSize: 12.5, fontWeight: 650, font: "inherit", cursor: "pointer" }}
            >
              <Icon name="plus" size={15} strokeWidth={2.3} /> New Invoice
            </button>
          )}
          {!isCust && (
            <a
              href={kind === "vendors" ? `/payables?vendor_id=${item.id}` : "/payables"}
              style={{ flex: 1, justifyContent: "center", padding: "11px", display: "inline-flex", alignItems: "center", gap: 6, background: accent, color: "#fff", border: "none", borderRadius: 10, fontSize: 12.5, fontWeight: 650, textDecoration: "none" }}
            >
              <Icon name="file" size={15} /> View Bills
            </a>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
