import { useState, useEffect } from "react";
import AppShell from "@/components/AppShell";
import { Dashboard } from "@/components/dashboard";
import { api } from "@/utils/api";

export default function Dashboard2Page() {
  const [stats, setStats] = useState(null);
  const [recentInvoices, setRecentInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [statsData, recentData] = await Promise.all([
          api.get("/api/dashboard/stats"),
          api.get("/api/dashboard/recent"),
        ]);
        setStats(statsData);
        setRecentInvoices(recentData.invoices || []);
      } catch (err) {
        console.error("Dashboard error:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  return (
    <AppShell>
      {loading ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{
            width: 36, height: 36, border: `3px solid #E11D2C`, borderTopColor: "transparent",
            borderRadius: "50%", animation: "spin 0.7s linear infinite",
          }} />
        </div>
      ) : (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: 24 }}>
          <Dashboard stats={stats} recentInvoices={recentInvoices} />
        </div>
      )}
    </AppShell>
  );
}
