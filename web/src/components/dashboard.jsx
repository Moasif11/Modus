import { useNavigate } from "react-router";
import { DashboardStats } from "@/components/stats";
import { RevenueChart } from "@/components/revenue-chart";
import { CategoryRankChart } from "@/components/category-rank-chart";
import { RefundReturnRateChart } from "@/components/refund-return-rate-chart";
import { QuickActions } from "@/components/quick-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, StatusBadge, linkBtn, thStyle, tdStyle } from "@/components/studio/primitives";
import { Icon } from "@/components/studio/icons";
import { formatMoney } from "@/utils/format";

const ACCENT = "#E11D2C";

function RecentInvoicesCard({ recentInvoices, className }) {
  const navigate = useNavigate();
  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle>Recent invoices</CardTitle>
        <button type="button" onClick={() => navigate("/invoices")} style={linkBtn(ACCENT)}>
          View all <Icon name="arrowRight" size={14} />
        </button>
      </CardHeader>
      <CardContent className="p-0">
        {recentInvoices.length === 0 ? (
          <div style={{ padding: "40px 22px", textAlign: "center" }}>
            <Icon name="file" size={28} color="#D1D5DB" style={{ margin: "0 auto 12px" }} />
            <p style={{ fontSize: 14, fontWeight: 600, color: "#0A0A0A", marginBottom: 4 }}>No invoices yet</p>
            <button
              type="button"
              onClick={() => navigate("/invoices/new")}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                background: ACCENT, color: "#fff", padding: "9px 18px",
                borderRadius: 9, fontSize: 13, fontWeight: 600,
                border: "none", cursor: "pointer", marginTop: 8, font: "inherit",
              }}
            >
              <Icon name="plus" size={15} /> Create Invoice
            </button>
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Invoice", "Client", "Amount", "Status"].map((h, i) => (
                  <th key={h} style={{ ...thStyle, textAlign: i === 2 ? "right" : "left" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentInvoices.slice(0, 6).map((inv) => (
                <tr
                  key={inv.id}
                  style={{ borderTop: "1px solid #F2F2F4", cursor: "pointer", transition: "background .12s" }}
                  onClick={() => navigate(`/invoices/${inv.id}`)}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#FAFAFB")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <td style={{ ...tdStyle, fontWeight: 650, color: "#0A0A0A", whiteSpace: "nowrap" }}>{inv.invoiceNumber}</td>
                  <td style={tdStyle}>
                    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                      <Avatar name={inv.customerName || "?"} tone={ACCENT} size={28} />
                      <span style={{ fontWeight: 550, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 140, display: "block" }}>
                        {inv.customerName || "—"}
                      </span>
                    </div>
                  </td>
                  <td style={{ ...tdStyle, textAlign: "right", fontWeight: 700, color: "#0A0A0A", whiteSpace: "nowrap" }}>
                    {formatMoney(inv.grandTotal, inv.currency)}
                  </td>
                  <td style={tdStyle}><StatusBadge status={inv.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}

export function Dashboard({ stats, recentInvoices }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* Row 1: 4 KPI stat cards */}
      <DashboardStats stats={stats} />

      {/* Row 2: Revenue chart (half) | Invoice status pie | AP payables */}
      <RevenueChart
        data={stats?.monthlyRevenue || []}
        className="md:col-span-2 lg:col-span-2"
      />
      <CategoryRankChart
        statusBreakdown={stats?.statusBreakdown || []}
        totalInvoices={stats?.totalInvoices || 0}
      />
      <RefundReturnRateChart ap={stats?.ap || {}} />

      {/* Row 3: Recent invoices (3/4) | Quick actions (1/4) */}
      <RecentInvoicesCard
        recentInvoices={recentInvoices}
        className="md:col-span-2 lg:col-span-3"
      />
      <QuickActions />
    </div>
  );
}
