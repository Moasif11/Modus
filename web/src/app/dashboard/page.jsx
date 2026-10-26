import { useState, useEffect, useCallback, useRef } from "react";
import AppShell from "@/components/AppShell";
import { DashboardSkeleton } from "@/components/dashboard-skeleton";
import { Dashboard } from "@/components/dashboard";
import { api } from "@/utils/api";

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [recentInvoices, setRecentInvoices] = useState([]);
  const skelRef = useRef(null);

  const reveal = () => {
    requestAnimationFrame(() =>
      requestAnimationFrame(() => skelRef.current?.classList.add("is-revealed"))
    );
  };

  const reset = () => {
    const el = skelRef.current;
    if (!el) return;
    el.classList.add("is-resetting");
    el.classList.remove("is-revealed");
    void el.offsetHeight; // force reflow
    el.classList.remove("is-resetting");
  };

  const loadData = useCallback(async ({ from, to } = {}) => {
    try {
      const qs = from && to ? `?from=${from}&to=${to}` : "";
      const [statsData, recentData] = await Promise.all([
        api.get(`/api/dashboard/stats${qs}`),
        api.get(`/api/dashboard/recent${qs}`),
      ]);
      setStats(statsData);
      setRecentInvoices(recentData.invoices || []);
      reveal();
    } catch (err) {
      console.error("Dashboard error:", err);
      reveal();
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    function onDateChange(e) {
      const { from, to } = e.detail || {};
      reset();
      loadData({ from: from || null, to: to || null });
    }
    window.addEventListener("modus-global-date", onDateChange);
    return () => window.removeEventListener("modus-global-date", onDateChange);
  }, [loadData]);

  return (
    <AppShell>
      <div ref={skelRef} className="t-skel t-skel--grid">
        <div className="t-skel-skeleton is-pulsing">
          <DashboardSkeleton />
        </div>
        <div className="t-skel-content">
          {stats && (
            <Dashboard stats={stats} recentInvoices={recentInvoices} />
          )}
        </div>
      </div>
    </AppShell>
  );
}
