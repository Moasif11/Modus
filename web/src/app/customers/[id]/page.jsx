import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import AppShell from "@/components/AppShell";
import { api } from "@/utils/api";
import { Card, Avatar, MiniStat, StatusBadge, Chip, ghostBtn } from "@/components/studio/primitives.jsx";
import { Icon } from "@/components/studio/icons.jsx";
import { formatMoney, formatDate } from "@/utils/format.js";

const TONES = ["#E11D2C","#2563EB","#16A34A","#F59E0B","#7C3AED","#0891B2","#EA580C","#DB2777"];
function avatarTone(name) {
  if (!name) return TONES[0];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = ((h << 5) - h + name.charCodeAt(i)) >>> 0;
  return TONES[h % TONES.length];
}

const INV_STATUS = {
  draft:          { bg: "#F3F4F6", color: "#6B7280", dot: "#9CA3AF", label: "Draft" },
  saved:          { bg: "#F3F4F6", color: "#6B7280", dot: "#9CA3AF", label: "Saved" },
  sent:           { bg: "#FEF3C7", color: "#B45309", dot: "#F59E0B", label: "Sent" },
  paid:           { bg: "#DCFCE7", color: "#15803D", dot: "#22C55E", label: "Paid" },
  overdue:        { bg: "#FEE2E2", color: "#DC2626", dot: "#EF4444", label: "Overdue" },
  cancelled:      { bg: "#F3F4F6", color: "#6B7280", dot: "#9CA3AF", label: "Cancelled" },
  partially_paid: { bg: "#EEF2FF", color: "#4F46E5", dot: "#6366F1", label: "Partial" },
};

function InvStatusBadge({ status }) {
  const s = INV_STATUS[status] || INV_STATUS.draft;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "3px 9px 3px 7px", background: s.bg, borderRadius: 100,
      fontSize: 11, fontWeight: 650, color: s.color, whiteSpace: "nowrap",
    }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: s.dot }} />
      {s.label}
    </span>
  );
}

const TABS = [
  { key: "invoices",  label: "Invoices"  },
  { key: "payments",  label: "Payments"  },
  { key: "details",   label: "Details"   },
];

export default function CustomerDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("invoices");

  useEffect(() => { loadCustomer(); }, [id]);

  async function loadCustomer() {
    setLoading(true);
    try {
      const data = await api.get(`/api/customers/${id}`);
      setCustomer(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <AppShell>
        <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", padding: 40 }}>
          <div style={{ width: 34, height: 34, border: "3px solid #E11D2C", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
        </div>
      </AppShell>
    );
  }

  if (!customer) {
    return (
      <AppShell>
        <div style={{ padding: 40, textAlign: "center" }}>
          <p style={{ color: "#9CA3AF", fontSize: 14 }}>Customer not found</p>
          <button type="button" onClick={() => navigate("/customers")} style={{ marginTop: 16, padding: "8px 16px", background: "#E11D2C", color: "#FFF", border: "none", borderRadius: 10, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
            Back to Customers
          </button>
        </div>
      </AppShell>
    );
  }

  const displayName = customer.companyName || customer.name || "?";
  const tone = avatarTone(displayName);

  return (
    <AppShell>
      <style>{`
        @keyframes spin   { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        .inv-row:hover { background: #FAFAFA !important; }
      `}</style>

      {/* Breadcrumb bar — no duplicate title, just back-link */}
      <div style={{ background: "#FFF", borderBottom: "1px solid #EEEEF0", padding: "13px 28px", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        <button type="button" onClick={() => navigate("/customers")} style={{ ...ghostBtn, gap: 5, color: "#9CA3AF" }}>
          <Icon name="arrowLeft" size={14} /> Customers
        </button>
        <span style={{ color: "#E5E7EB" }}>/</span>
        <span style={{ fontSize: 13, color: "#0A0A0A", fontWeight: 600 }}>{displayName}</span>
      </div>

      <div style={{ flex: 1, overflowY: "auto" }}>
        {/* Hero card */}
        <div style={{ background: "#FFF", borderBottom: "1px solid #EEEEF0", padding: "24px 28px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <Avatar name={displayName} tone={tone} size={58} radius={16} />
              <div>
                <h1 style={{ fontSize: 21, fontWeight: 750, color: "#0A0A0A", margin: "0 0 2px", letterSpacing: "-0.02em" }}>{displayName}</h1>
                {customer.companyName && customer.name && (
                  <p style={{ fontSize: 13, color: "#6B7280", margin: "0 0 8px" }}>{customer.name}</p>
                )}
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {customer.gstin && <Chip>{`GSTIN: ${customer.gstin}`}</Chip>}
                  {customer.pan  && <Chip>{`PAN: ${customer.pan}`}</Chip>}
                  <Chip tone="#2563EB" bg="#EFF6FF">{customer.customerType || "Business"}</Chip>
                </div>
              </div>
            </div>
            <button type="button" onClick={() => navigate(`/customers?edit=${id}`)} style={{ ...ghostBtn }}>
              <Icon name="edit" size={13} /> Edit
            </button>
          </div>

          {/* Contact row */}
          <div style={{ display: "flex", gap: 20, marginTop: 18, flexWrap: "wrap" }}>
            {customer.email && (
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <Icon name="mail" size={13} color="#A9ACB3" />
                <a href={`mailto:${customer.email}`} style={{ fontSize: 13, color: "#374151", textDecoration: "none" }}>{customer.email}</a>
              </div>
            )}
            {customer.phone && (
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <Icon name="phone" size={13} color="#A9ACB3" />
                <span style={{ fontSize: 13, color: "#374151" }}>{customer.phone}</span>
              </div>
            )}
            {(customer.city || customer.state) && (
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <Icon name="mapPin" size={13} color="#A9ACB3" />
                <span style={{ fontSize: 13, color: "#374151" }}>{[customer.city, customer.state].filter(Boolean).join(", ")}</span>
              </div>
            )}
          </div>
        </div>

        {/* MiniStat row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 14, padding: "20px 28px", background: "#F7F7F7" }}>
          <MiniStat label="Total Billed"  value={formatMoney(customer.totalBilled || 0)}       icon="banknote"  tint="#2563EB" />
          <MiniStat label="Total Paid"    value={formatMoney(customer.totalPaid || 0)}          icon="handCoins" tint="#15803D" />
          <MiniStat label="Outstanding"   value={formatMoney(customer.outstandingBalance || 0)} icon="coins"     tint={customer.outstandingBalance > 0 ? "#E11D2C" : "#15803D"} />
          <MiniStat label="Invoices"      value={customer.invoiceCount || 0}                    icon="file"      tint="#7C3AED" />
        </div>

        {/* Tab bar */}
        <div style={{ background: "#FFF", borderBottom: "1px solid #EEEEF0", padding: "0 28px", display: "flex", gap: 2 }}>
          {TABS.map((t) => (
            <button key={t.key} type="button" onClick={() => setActiveTab(t.key)} style={{
              padding: "10px 16px", border: "none", background: "transparent", cursor: "pointer",
              fontSize: 13, fontWeight: activeTab === t.key ? 650 : 400,
              color: activeTab === t.key ? "#E11D2C" : "#6B7280",
              borderBottom: activeTab === t.key ? "2px solid #E11D2C" : "2px solid transparent",
              transition: "all 0.15s", font: "inherit",
            }}>
              {t.key === "invoices" ? `Invoices (${customer.invoices?.length || 0})` :
               t.key === "payments" ? `Payments (${customer.payments?.length || 0})` :
               t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div style={{ padding: "20px 28px", animation: "fadeUp 0.2s ease" }}>

          {/* Invoices tab */}
          {activeTab === "invoices" && (
            (customer.invoices?.length || 0) === 0 ? (
              <Card pad={48} style={{ textAlign: "center" }}>
                <Icon name="file" size={32} color="#E5E7EB" />
                <p style={{ fontSize: 14, color: "#9CA3AF", margin: "12px 0 0" }}>No invoices yet</p>
              </Card>
            ) : (
              <Card pad={0} style={{ overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#FAFAFA", borderBottom: "1px solid #F2F2F4" }}>
                      {[["Invoice #", "left"], ["Date", "left"], ["Amount", "right"], ["Balance", "right"], ["Status", "right"]].map(([h, a]) => (
                        <th key={h} style={{ padding: "10px 20px", fontSize: 10.5, fontWeight: 700, color: "#A9ACB3", letterSpacing: "0.05em", textTransform: "uppercase", textAlign: a }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {customer.invoices.map((inv, i) => (
                      <tr key={inv.id} className="inv-row"
                        onClick={() => navigate(`/invoices/${inv.id}`)}
                        style={{ borderBottom: i < customer.invoices.length - 1 ? "1px solid #F2F2F4" : "none", cursor: "pointer", transition: "background 0.1s" }}>
                        <td style={{ padding: "13px 20px" }}>
                          <p style={{ fontSize: 13, fontWeight: 700, color: "#0A0A0A", margin: 0 }}>{inv.invoiceNumber}</p>
                          <p style={{ fontSize: 11, color: "#9CA3AF", margin: "2px 0 0" }}>Due {formatDate(inv.dueDate)}</p>
                        </td>
                        <td style={{ padding: "13px 20px" }}>
                          <span style={{ fontSize: 12.5, color: "#6B7280" }}>{formatDate(inv.invoiceDate)}</span>
                        </td>
                        <td style={{ padding: "13px 20px", textAlign: "right" }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: "#0A0A0A" }}>{formatMoney(inv.grandTotal)}</span>
                        </td>
                        <td style={{ padding: "13px 20px", textAlign: "right" }}>
                          {inv.balanceDue > 0
                            ? <span style={{ fontSize: 12.5, color: "#E11D2C", fontWeight: 600 }}>{formatMoney(inv.balanceDue)}</span>
                            : <span style={{ fontSize: 12.5, color: "#9CA3AF" }}>—</span>}
                        </td>
                        <td style={{ padding: "13px 20px", textAlign: "right" }}>
                          <InvStatusBadge status={inv.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            )
          )}

          {/* Payments tab */}
          {activeTab === "payments" && (
            (customer.payments?.length || 0) === 0 ? (
              <Card pad={48} style={{ textAlign: "center" }}>
                <Icon name="wallet" size={32} color="#E5E7EB" />
                <p style={{ fontSize: 14, color: "#9CA3AF", margin: "12px 0 0" }}>No payments recorded</p>
              </Card>
            ) : (
              <Card pad={0} style={{ overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#FAFAFA", borderBottom: "1px solid #F2F2F4" }}>
                      {[["Invoice", "left"], ["Date", "left"], ["Method", "left"], ["Reference", "left"], ["Amount", "right"]].map(([h, a]) => (
                        <th key={h} style={{ padding: "10px 20px", fontSize: 10.5, fontWeight: 700, color: "#A9ACB3", letterSpacing: "0.05em", textTransform: "uppercase", textAlign: a }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {customer.payments.map((p, i) => (
                      <tr key={p.id} style={{ borderBottom: i < customer.payments.length - 1 ? "1px solid #F2F2F4" : "none" }}>
                        <td style={{ padding: "13px 20px" }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: "#0A0A0A" }}>{p.invoiceNumber || "—"}</span>
                        </td>
                        <td style={{ padding: "13px 20px" }}>
                          <span style={{ fontSize: 12.5, color: "#6B7280" }}>{formatDate(p.paymentDate)}</span>
                        </td>
                        <td style={{ padding: "13px 20px" }}>
                          <span style={{ fontSize: 12.5, color: "#6B7280", textTransform: "capitalize" }}>{(p.paymentMethod || "—").replace("_", " ")}</span>
                        </td>
                        <td style={{ padding: "13px 20px" }}>
                          <span style={{ fontSize: 12, color: "#9CA3AF", fontFamily: "monospace" }}>{p.referenceNumber || "—"}</span>
                        </td>
                        <td style={{ padding: "13px 20px", textAlign: "right" }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: "#15803D" }}>{formatMoney(p.amount)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            )
          )}

          {/* Details tab */}
          {activeTab === "details" && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
              <Card pad={20}>
                <p style={{ fontSize: 11, fontWeight: 700, color: "#A9ACB3", textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 16px" }}>Contact Details</p>
                {[
                  ["Contact Person", customer.contactPerson],
                  ["Email", customer.email],
                  ["Phone", customer.phone],
                  ["Website", customer.website],
                ].filter(([, v]) => v).map(([label, val]) => (
                  <div key={label} style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                    <span style={{ fontSize: 12, color: "#9CA3AF", minWidth: 110, flexShrink: 0 }}>{label}</span>
                    <span style={{ fontSize: 13, color: "#0A0A0A", fontWeight: 500 }}>{val}</span>
                  </div>
                ))}
              </Card>

              <Card pad={20}>
                <p style={{ fontSize: 11, fontWeight: 700, color: "#A9ACB3", textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 16px" }}>Billing Address</p>
                {customer.billingAddress && <p style={{ fontSize: 13, color: "#374151", lineHeight: 1.6, margin: "0 0 12px" }}>{customer.billingAddress}</p>}
                {[
                  ["City",    customer.city],
                  ["State",   customer.state],
                  ["Pincode", customer.pincode],
                  ["Country", customer.country],
                ].filter(([, v]) => v).map(([label, val]) => (
                  <div key={label} style={{ display: "flex", gap: 12, marginBottom: 8 }}>
                    <span style={{ fontSize: 12, color: "#9CA3AF", minWidth: 80, flexShrink: 0 }}>{label}</span>
                    <span style={{ fontSize: 13, color: "#0A0A0A" }}>{val}</span>
                  </div>
                ))}
              </Card>

              {(customer.gstin || customer.pan || customer.creditLimit) && (
                <Card pad={20}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: "#A9ACB3", textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 16px" }}>Tax & Financial</p>
                  {[
                    ["GSTIN",        customer.gstin],
                    ["PAN",          customer.pan],
                    ["Credit Limit", customer.creditLimit ? formatMoney(customer.creditLimit) : null],
                  ].filter(([, v]) => v).map(([label, val]) => (
                    <div key={label} style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                      <span style={{ fontSize: 12, color: "#9CA3AF", minWidth: 90, flexShrink: 0 }}>{label}</span>
                      <span style={{ fontSize: 13, color: "#0A0A0A", fontFamily: label !== "Credit Limit" ? "monospace" : "inherit" }}>{val}</span>
                    </div>
                  ))}
                </Card>
              )}

              {customer.notes && (
                <Card pad={20} style={{ background: "#FFFBEB", border: "1px solid #FDE68A" }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: "#92400E", textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 10px" }}>Notes</p>
                  <p style={{ fontSize: 13, color: "#374151", lineHeight: 1.6, margin: 0 }}>{customer.notes}</p>
                </Card>
              )}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
