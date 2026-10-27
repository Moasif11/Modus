import { useAuth } from "@/utils/auth";
import { useEffect, useLayoutEffect, useState, useRef } from "react";
import CommandPalette from "@/components/CommandPalette";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
import { Logo } from "@/components/studio/Logo";
import { Icon } from "@/components/studio/icons";
import { DateRangePicker } from "@/components/ui/DateRangePicker";
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";

// ── Route metadata ────────────────────────────────────────────────────────────
const ROUTE_TITLES = {
  dashboard:  ["Dashboard",  "Welcome back — here's your business overview"],
  invoices:   ["Receivables","Invoices raised to your clients"],
  quotes:     ["Quotes",     "Estimates and proposals for your clients"],
  "credit-notes": ["Credit Notes", "GST credit notes issued against invoices"],
  "audit-log": ["Audit Log", "Immutable edit history (Rule 11(g))"],
  "gstr2b-recon": ["GSTR-2B Match", "Reconcile purchase ITC against GSTR-2B"],
  payables:   ["Expenses",   "Bills and expenses owed to vendors"],
  reports:    ["Reports",    "GST summaries and financial reports"],
  customers:  ["Customers",  "Clients you raise invoices for"],
  vendors:    ["Vendors",    "Suppliers and partners you pay"],
  employees:  ["Employees",  "Your team directory"],
  projects:   ["Projects",   "Client engagements in flight"],
  services:   ["Services",   "Your service catalogue"],
  templates:  ["Templates",  "Invoice templates"],
  settings:   ["Settings",   "Workspace, billing and GST configuration"],
  profile:    ["My profile", "Your account, activity and security"],
  admin:      ["Team",       "People with access to this workspace"],
};

// ── Nav groups ────────────────────────────────────────────────────────────────
const NAV_FINANCE = [
  { label: "Dashboard",   href: "/dashboard",  icon: "grid"      },
  { label: "Receivables", href: "/invoices",   icon: "file"      },
  { label: "Sales", icon: "send", children: [
    { label: "Quotes",   href: "/quotes"   },
    { label: "Proforma", href: "/proforma" },
  ] },
  { label: "Credit Notes", href: "/credit-notes", icon: "receiptText" },
  { label: "Expenses",    href: "/payables",   icon: "receiptText" },
  { label: "Reports",     href: "/reports",    icon: "trendUp"   },
  { label: "GSTR-2B Match", href: "/gstr2b-recon", icon: "shieldCheck" },
];
const NAV_WORK = [
  { label: "Customers",  href: "/customers",  icon: "users"     },
  { label: "Vendors",    href: "/vendors",    icon: "truck"     },
  { label: "Employees",  href: "/employees",  icon: "userCheck" },
  { label: "Services",   href: "/services",   icon: "briefcase" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function lbl() {
  return {
    fontSize: 9, fontWeight: 700, letterSpacing: ".09em",
    textTransform: "uppercase", color: "rgba(255,255,255,0.38)",
    padding: "0 8px 4px", margin: 0,
  };
}

function computeInitials(user) {
  const name = user?.fullName || user?.name || "";
  if (!name) return "AD";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

// ── NavItem ───────────────────────────────────────────────────────────────────
function NavItem({ label, href, icon, active }) {
  const [hov, setHov] = useState(false);
  const bg    = active ? "#E11D2C" : hov ? "rgba(255,255,255,0.08)" : "transparent";
  const color = active ? "#fff"    : hov ? "#FFFFFF" : "rgba(255,255,255,0.62)";
  return (
    <a
      href={href}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "10px 12px", borderRadius: 11, border: "none",
        textDecoration: "none", cursor: "pointer", width: "100%",
        background: bg, color,
        fontSize: 13, fontWeight: active ? 650 : 500,
        transition: "color .12s ease", marginBottom: 2,
        boxShadow: active ? "0 4px 12px #E11D2C38" : "none",
      }}
    >
      <Icon name={icon} size={17} strokeWidth={active ? 2.1 : 1.8} />
      <span style={{ flex: 1 }}>{label}</span>
      {active && <Icon name="chevronRight" size={12} style={{ opacity: 0.7 }} />}
    </a>
  );
}

// ── NavGroup (collapsible parent with children) ───────────────────────────────
function NavGroup({ label, icon, children, isActive }) {
  const childActive = children.some((c) => isActive(c.href));
  const [open, setOpen] = useState(childActive);
  const [hov, setHov] = useState(false);
  const color = childActive ? "#fff" : hov ? "#FFFFFF" : "rgba(255,255,255,0.62)";
  return (
    <div style={{ marginBottom: 2 }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "10px 12px", borderRadius: 11, border: "none",
          cursor: "pointer", width: "100%",
          background: hov ? "rgba(255,255,255,0.08)" : "transparent",
          color, fontSize: 13, fontWeight: childActive ? 650 : 500,
          fontFamily: "inherit", transition: "color .12s ease",
        }}
      >
        <Icon name={icon} size={17} strokeWidth={childActive ? 2.1 : 1.8} />
        <span style={{ flex: 1, textAlign: "left" }}>{label}</span>
        <Icon name="chevronRight" size={12} style={{ opacity: 0.7, transform: open ? "rotate(90deg)" : "none", transition: "transform .15s" }} />
      </button>
      {open && (
        <div style={{ marginTop: 2, paddingLeft: 12 }}>
          {children.map((c) => {
            const active = isActive(c.href);
            return (
              <a
                key={c.href}
                href={c.href}
                style={{
                  display: "flex", alignItems: "center", gap: 9,
                  padding: "8px 12px", borderRadius: 10, textDecoration: "none",
                  background: active ? "#E11D2C" : "transparent",
                  color: active ? "#fff" : "rgba(255,255,255,0.55)",
                  fontSize: 12.5, fontWeight: active ? 650 : 500,
                  marginBottom: 2, transition: "color .12s ease",
                  boxShadow: active ? "0 4px 12px #E11D2C38" : "none",
                }}
              >
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: active ? "#fff" : "rgba(255,255,255,0.35)", flexShrink: 0 }} />
                <span style={{ flex: 1 }}>{c.label}</span>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── IconBtn ───────────────────────────────────────────────────────────────────
function IconBtn({ name, badge, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        position: "relative", width: 28, height: 28, borderRadius: 8,
        border: "1px solid #ECECEE",
        background: hov ? "#F7F7F8" : "#fff",
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: "pointer", color: "#4B5563",
        transition: "background .15s",
        boxShadow: "0 1px 2px rgba(0,0,0,.03)",
      }}
    >
      <Icon name={name} size={14} />
      <AnimatePresence>
        {badge > 0 && (
          <motion.span
            initial={{ scale: 0, opacity: 0, y: 5 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            style={{
              position: "absolute", top: -4, right: -4,
              minWidth: 12, height: 12, padding: "0 3px", borderRadius: 6,
              background: "#E11D2C", color: "#fff",
              fontSize: 8, fontWeight: 700,
              display: "flex", alignItems: "center", justifyContent: "center",
              border: "2px solid #fff",
            }}
          >
            {badge}
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}

// ── TopBar ────────────────────────────────────────────────────────────────────
function TopBar({ currentPath, initials, user, onMenuToggle }) {
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState(null);
  const [toDate, setToDate] = useState(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [systemNotifs, setSystemNotifs] = useState([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const [badge, setBadge] = useState(0);
  const [panelPos, setPanelPos] = useState({ top: 0, right: 0 });
  const notifBtnRef = useRef(null);
  const notifPanelRef = useRef(null);
  const segment = currentPath.split("/")[1] || "dashboard";
  const showCalendar = ["dashboard", "invoices", "payables", "reports"].includes(segment);
  const [title, sub] = ROUTE_TITLES[segment] || [
    segment.charAt(0).toUpperCase() + segment.slice(1),
    "",
  ];

  // Fetch badge count on mount (lightweight)
  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("modus_auth_token") : "";
    const h = token ? { Authorization: `Bearer ${token}` } : {};
    Promise.all([
      fetch("/api/invoices?status=overdue&limit=1", { headers: h }).then(r => r.ok ? r.json() : {}).catch(() => ({})),
      fetch("/api/bills?status=overdue&limit=1", { headers: h }).then(r => r.ok ? r.json() : {}).catch(() => ({})),
      fetch("/api/notifications?limit=1", { headers: h }).then(r => r.ok ? r.json() : {}).catch(() => ({})),
    ]).then(([inv, bill, notif]) => {
      setBadge((inv.total || 0) + (bill.total || 0) + (notif.unreadCount || 0));
    });
  }, []);

  // Fetch full list when panel opens
  useEffect(() => {
    if (!notifOpen) return;
    setNotifLoading(true);
    const token = typeof window !== "undefined" ? localStorage.getItem("modus_auth_token") : "";
    const h = token ? { Authorization: `Bearer ${token}` } : {};
    Promise.all([
      fetch("/api/invoices?status=overdue&limit=20", { headers: h }).then(r => r.ok ? r.json() : { invoices: [] }).catch(() => ({ invoices: [] })),
      fetch("/api/bills?status=overdue&limit=20", { headers: h }).then(r => r.ok ? r.json() : { bills: [] }).catch(() => ({ bills: [] })),
      fetch("/api/notifications?limit=30", { headers: h }).then(r => r.ok ? r.json() : { notifications: [] }).catch(() => ({ notifications: [] })),
    ]).then(([invData, billData, notifData]) => {
      const invNotifs = (invData.invoices || []).map(inv => ({
        id: `inv-${inv.id}`, type: "invoice",
        title: `Invoice ${inv.invoiceNumber} overdue`,
        sub: inv.customerName || "Client",
        amount: inv.grandTotal, dueDate: inv.dueDate,
        href: `/invoices/${inv.id}`,
      }));
      const billNotifs = (billData.bills || []).map(bill => ({
        id: `bill-${bill.id}`, type: "bill",
        title: bill.title || `Bill ${bill.billNumber || ""}`,
        sub: "Bill overdue",
        amount: bill.amount, dueDate: bill.dueDate,
        href: `/payables/${bill.id}`,
      }));
      setNotifications([...invNotifs, ...billNotifs]);
      setSystemNotifs(notifData.notifications || []);
      setNotifLoading(false);

      // Mark in-app notifications read on open, then clear badge.
      if ((notifData.notifications || []).some(n => !n.isRead)) {
        fetch("/api/notifications", { method: "POST", headers: { ...h, "Content-Type": "application/json" }, body: "{}" }).catch(() => {});
      }
      setBadge(invNotifs.length + billNotifs.length);
    });
  }, [notifOpen]);

  // Close on outside click
  useEffect(() => {
    if (!notifOpen) return;
    function down(e) {
      if (notifBtnRef.current?.contains(e.target)) return;
      if (notifPanelRef.current?.contains(e.target)) return;
      setNotifOpen(false);
    }
    document.addEventListener("mousedown", down);
    return () => document.removeEventListener("mousedown", down);
  }, [notifOpen]);

  // Position panel under the bell button
  useLayoutEffect(() => {
    if (!notifOpen || !notifBtnRef.current) return;
    const rect = notifBtnRef.current.getBoundingClientRect();
    setPanelPos({ top: rect.bottom + 10, right: window.innerWidth - rect.right });
  }, [notifOpen]);

  const fmtMini = (v) => v >= 100000 ? `₹${(v / 100000).toFixed(1)}L` : v >= 1000 ? `₹${(v / 1000).toFixed(0)}K` : `₹${Math.round(v)}`;
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "";

  return (
    <header className="modus-topbar-header" style={{
      padding: "24px 30px 16px", flexShrink: 0,
    }}>
      <div style={{
        maxWidth: 1480, margin: "0 auto", width: "100%",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16
      }}>
      {/* Left: menu toggle + page header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, minWidth: 0 }}>
        <div className="modus-menu-btn" style={{ flexShrink: 0, marginTop: 4 }}>
          <IconBtn name="menu" onClick={onMenuToggle} />
        </div>
        <div className="t-stagger is-shown" style={{ minWidth: 0 }}>
          <h1 className="t-stagger-line t-stagger-line--1" style={{
            fontSize: 24, fontWeight: 750, color: "#0A0A0A",
            letterSpacing: "-0.02em", margin: "0 0 4px", lineHeight: 1.1,
          }}>{title}</h1>
          {sub && (
            <p className="t-stagger-line t-stagger-line--2" style={{ fontSize: 13, color: "#6B7280", margin: 0 }}>{sub}</p>
          )}
        </div>
      </div>

      {/* Right: search + actions */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
        {/* Search */}
        <div className="modus-search-box" style={{
          display: "flex",
          alignItems: "center", gap: 8,
          background: "#fff", border: "1px solid #ECECEE",
          borderRadius: 10, padding: "0 10px", width: 180, height: 32,
          boxShadow: "0 2px 4px rgba(0,0,0,.02)",
        }}>
          <Icon name="search" size={14} color="#A9ACB3" />
          <input
            readOnly
            value={search}
            onClick={() => window.dispatchEvent(new CustomEvent("modus-cmd-open"))}
            placeholder="Search or ⌘K…"
            style={{
              border: "none", background: "transparent", outline: "none",
              font: "inherit", fontSize: 12.5, color: "#0A0A0A", width: "100%",
              cursor: "pointer",
            }}
          />
        </div>

        {showCalendar && (
          <DateRangePicker
            asIconBtn
            listenGlobalToggle={false}
            value={{ from: fromDate, to: toDate }}
            onChange={({ from, to }) => {
              setFromDate(from || null);
              setToDate(to || null);
              window.dispatchEvent(new CustomEvent("modus-global-date", { detail: { from: from || null, to: to || null } }));
            }}
          />
        )}

        {/* Notification bell */}
        <div ref={notifBtnRef}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => setNotifOpen(!notifOpen)}
                style={{
                  position: "relative",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  width: 32, height: 32, borderRadius: 10,
                  background: "#fff", border: "1px solid #ECECEE",
                  color: "#4B5563", cursor: "pointer", transition: "background .15s",
                  boxShadow: "0 2px 4px rgba(0,0,0,.02)",
                }}
              >
                <Icon name="bell" size={14} />
                <span className="t-badge" data-open={badge > 0 ? "true" : "false"}>
                  <span className="t-badge-dot" style={{
                    position: "absolute", top: -3, right: -3,
                    minWidth: 14, height: 14, padding: "0 3px", borderRadius: 7,
                    background: "#E11D2C", color: "#fff",
                    fontSize: 8, fontWeight: 700,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    border: "2px solid #fff",
                  }}>{badge > 9 ? "9+" : badge}</span>
                </span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" style={{ fontSize: 12, fontFamily: "inherit" }}>Notifications</TooltipContent>
          </Tooltip>
        </div>

        {/* Avatar */}
        <Tooltip>
          <TooltipTrigger asChild>
            <a
              href="/profile"
              style={{
                width: 32, height: 32, borderRadius: 10,
                background: "#EF4444",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#fff", fontSize: 12.5, fontWeight: 700,
                position: "relative", textDecoration: "none", flexShrink: 0,
                boxShadow: "0 2px 4px rgba(0,0,0,.02)",
              }}
            >
              {user?.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt=""
                  onError={(e) => { e.currentTarget.style.display = "none"; }}
                  style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", borderRadius: 10, backgroundColor: "#fff" }}
                />
              ) : initials}
              <span style={{
                position: "absolute", bottom: -2, right: -2,
                width: 8, height: 8, borderRadius: "50%",
                background: "#22C55E", border: "1.5px solid #fff",
              }} />
            </a>
          </TooltipTrigger>
          <TooltipContent side="bottom" style={{ fontSize: 12, fontFamily: "inherit" }}>My profile</TooltipContent>
        </Tooltip>
      </div>
      </div>

      {/* ── Notification panel (portal) ──────────────────────────────────── */}
      {notifOpen && typeof window !== "undefined" && createPortal(
        <div
          ref={notifPanelRef}
          style={{
            position: "fixed", top: panelPos.top, right: panelPos.right,
            zIndex: 9999, width: 360,
            background: "#fff", border: "1px solid #ECECEE", borderRadius: 16,
            boxShadow: "0 16px 48px rgba(0,0,0,.14)", overflow: "hidden",
            animation: "notifSlide .15s ease",
          }}
        >
          <style>{`@keyframes notifSlide { from { opacity:0; transform:translateY(-8px); } to { opacity:1; transform:translateY(0); } } @keyframes spin { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }`}</style>

          {/* Header */}
          <div style={{ padding: "16px 18px 12px", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: "#0A0A0A", margin: 0 }}>Notifications</p>
              <p style={{ fontSize: 11.5, color: "#9CA3AF", margin: "2px 0 0", fontFamily: "inherit" }}>
                {notifLoading ? "Loading..." : (notifications.length === 0 && systemNotifs.length === 0) ? "All caught up!" : `${systemNotifs.length + notifications.length} item${(systemNotifs.length + notifications.length) !== 1 ? "s" : ""}`}
              </p>
            </div>
            {notifications.length > 0 && (
              <span style={{ fontSize: 11, fontWeight: 700, color: "#E11D2C", background: "#FEF2F2", padding: "3px 9px", borderRadius: 20 }}>
                {notifications.length} overdue
              </span>
            )}
          </div>

          {/* Body */}
          <div style={{ maxHeight: 360, overflowY: "auto" }}>
            {notifLoading ? (
              <div style={{ padding: "36px 0", textAlign: "center" }}>
                <div style={{ width: 22, height: 22, border: "2.5px solid #E11D2C", borderTopColor: "transparent", borderRadius: "50%", animation: "spin .7s linear infinite", margin: "0 auto" }} />
              </div>
            ) : (notifications.length === 0 && systemNotifs.length === 0) ? (
              <div style={{ padding: "40px 20px", textAlign: "center" }}>
                <div style={{ fontSize: 30, marginBottom: 10 }}>🎉</div>
                <p style={{ fontSize: 13.5, fontWeight: 700, color: "#0A0A0A", margin: "0 0 4px", fontFamily: "inherit" }}>All caught up!</p>
                <p style={{ fontSize: 12.5, color: "#9CA3AF", margin: 0, fontFamily: "inherit" }}>No new notifications</p>
              </div>
            ) : (
              <>
              {systemNotifs.map((n) => {
                const tint = n.type === "expense_approved" ? "#059669" : n.type === "expense_rejected" ? "#DC2626" : "#F97316";
                const bg = n.type === "expense_approved" ? "#F0FDF4" : n.type === "expense_rejected" ? "#FEF2F2" : "#FFF7ED";
                return (
                  <a key={`sys-${n.id}`} href={n.link || "#"} onClick={() => setNotifOpen(false)}
                    style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 18px", textDecoration: "none", borderBottom: "1px solid #F8F8F9", transition: "background .1s", background: n.isRead ? "transparent" : "#FCFCFD" }}
                    onMouseEnter={e => e.currentTarget.style.background = "#FAFAFB"}
                    onMouseLeave={e => e.currentTarget.style.background = n.isRead ? "transparent" : "#FCFCFD"}>
                    <div style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, background: bg, display: "flex", alignItems: "center", justifyContent: "center", color: tint, fontSize: 16, fontWeight: 800 }}>
                      {n.type === "expense_approved" ? "✓" : n.type === "expense_rejected" ? "✕" : "!"}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 12.5, fontWeight: 650, color: "#0A0A0A", margin: "0 0 2px", fontFamily: "inherit" }}>{n.title}</p>
                      <p style={{ fontSize: 11.5, color: "#9CA3AF", margin: 0, fontFamily: "inherit", lineHeight: 1.4 }}>{n.body}</p>
                    </div>
                  </a>
                );
              })}
              {notifications.map((n, i) => (
              <a
                key={n.id}
                href={n.href}
                onClick={() => setNotifOpen(false)}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "12px 18px", textDecoration: "none",
                  borderBottom: i < notifications.length - 1 ? "1px solid #F8F8F9" : "none",
                  transition: "background .1s",
                }}
                onMouseEnter={e => e.currentTarget.style.background = "#FAFAFB"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                <div style={{
                  width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                  background: n.type === "invoice" ? "#FEF2F2" : "#FFF7ED",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {n.type === "invoice"
                    ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#E11D2C" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
                  }
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 12.5, fontWeight: 650, color: "#0A0A0A", margin: "0 0 2px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontFamily: "inherit" }}>{n.title}</p>
                  <p style={{ fontSize: 11.5, color: "#9CA3AF", margin: 0, fontFamily: "inherit" }}>{n.sub}{n.dueDate ? ` · Due ${fmtDate(n.dueDate)}` : ""}</p>
                </div>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: "#E11D2C", flexShrink: 0, fontFamily: "inherit" }}>{fmtMini(n.amount)}</span>
              </a>
              ))}
              </>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div style={{ padding: "10px 14px", borderTop: "1px solid #F3F4F6", display: "flex", gap: 8 }}>
              <a href="/invoices?status=overdue" onClick={() => setNotifOpen(false)}
                style={{ flex: 1, textAlign: "center", padding: "8px", borderRadius: 9, fontSize: 12, fontWeight: 600, color: "#E11D2C", background: "#FEF2F2", textDecoration: "none", fontFamily: "inherit" }}>
                Overdue invoices
              </a>
              <a href="/payables?status=overdue" onClick={() => setNotifOpen(false)}
                style={{ flex: 1, textAlign: "center", padding: "8px", borderRadius: 9, fontSize: 12, fontWeight: 600, color: "#374151", background: "#F3F4F6", textDecoration: "none", fontFamily: "inherit" }}>
                Overdue bills
              </a>
            </div>
          )}
        </div>,
        document.body
      )}
    </header>
  );
}

// ── AppShell ──────────────────────────────────────────────────────────────────
export default function AppShell({ children }) {
  const { user, loading, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentPath, setCurrentPath] = useState("/");
  const [cmdOpen, setCmdOpen] = useState(false);
  const [branding, setBranding] = useState(null);

  useEffect(() => {
    fetch("/api/settings/branding")
      .then((res) => res.json())
      .then((data) => {
        if (data && !data.error) {
          setBranding(data);
          if (data.brandColor) {
            document.documentElement.style.setProperty("--modus-accent", data.brandColor);
          }
          if (data.appName) {
            document.title = `${data.appName} — Studio ERP & GST Invoicing`;
          }
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setCurrentPath(window.location.pathname);
    }
  }, []);

  // ⌘K / Ctrl+K keyboard shortcut
  useEffect(() => {
    function handleKeyDown(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCmdOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // TopBar search input click event
  useEffect(() => {
    function handleCmdOpen() { setCmdOpen(true); }
    window.addEventListener("modus-cmd-open", handleCmdOpen);
    return () => window.removeEventListener("modus-cmd-open", handleCmdOpen);
  }, []);

  useEffect(() => {
    if (!loading && !user) {
      if (typeof window !== "undefined") window.location.href = "/login";
    }
  }, [user, loading]);

  async function handleLogout() {
    await logout();
    if (typeof window !== "undefined") window.location.href = "/login";
  }

  function isActive(href) {
    if (href === "/dashboard") return currentPath === href;
    return currentPath.startsWith(href);
  }

  // Branded boot screen
  if (loading && !user)
    return (
      <div style={{
        minHeight: "100vh",
        background: "radial-gradient(120% 120% at 50% 0%, #2A2B2C 0%, #1E1F1F 55%, #141516 100%)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <style>{`
          @keyframes modusFade { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
          @keyframes modusDot { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.35); opacity: .65; } }
          @keyframes modusBar { 0% { left: -40%; } 100% { left: 100%; } }
        `}</style>
        <div style={{ textAlign: "center", animation: "modusFade .5s ease" }}>
          <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 22 }}>
            <Logo tone="dark" height={38} accent="#E11D2C" />
          </div>
          <div style={{ position: "relative", width: 160, height: 3, borderRadius: 3, background: "rgba(255,255,255,0.12)", overflow: "hidden", margin: "0 auto" }}>
            <div style={{ position: "absolute", top: 0, width: "40%", height: "100%", borderRadius: 3, background: "linear-gradient(90deg, transparent, #E11D2C, transparent)", animation: "modusBar 1.1s ease-in-out infinite" }} />
          </div>
          <p style={{ fontSize: 12.5, color: "rgba(255,255,255,0.5)", margin: "16px 0 0", fontWeight: 500, letterSpacing: ".01em" }}>Preparing your workspace…</p>
        </div>
      </div>
    );

  if (!user) return null;

  const initials = computeInitials(user);

  // Team lives inside Settings → not a sidebar item
  const NAV_FOOTER = [
    { label: "Audit Log", href: "/audit-log", icon: "shieldCheck" },
    { label: "Settings", href: "/settings", icon: "settings" },
  ];

  return (
    <TooltipProvider delayDuration={500}>
    <div className="modus-shell" style={{
      display: "flex", minHeight: "100vh",
      padding: 14, gap: 4, background: "#F4F4F6",
    }}>
      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          role="button"
          tabIndex={-1}
          aria-label="Close sidebar"
          onClick={() => setSidebarOpen(false)}
          onKeyDown={(e) => e.key === "Enter" && setSidebarOpen(false)}
          style={{
            position: "fixed", inset: 0,
            background: "rgba(0,0,0,0.5)", zIndex: 40,
          }}
        />
      )}

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside className={`modus-sidebar${sidebarOpen ? " modus-sidebar--open" : ""}`} style={{
        width: 246, flexShrink: 0,
        display: "flex", flexDirection: "column",
        padding: "6px 14px 14px",
        background: "#1E1F1F",
        borderRadius: 16,
      }}>
        {/* Logo */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "14px 8px 16px",
        }}>
          <Logo
            tone="dark"
            height={24}
            customLogoUrl={branding?.logoDarkUrl}
            alt={branding?.appName || "MODUS"}
          />
        </div>

        {/* New Invoice CTA */}
        <div style={{ padding: "0 4px 12px" }}>
          <a
            href="/invoices/new"
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              width: "100%",
              background: branding?.brandColor || "#E11D2C",
              color: "#fff",
              border: "none", cursor: "pointer",
              padding: "11px 14px", borderRadius: 12,
              fontSize: 13.5, fontWeight: 650, textDecoration: "none",
              boxShadow: `0 8px 20px ${(branding?.brandColor || "#E11D2C")}45`,
              transition: "transform .12s, background .15s",
            }}
            onMouseDown={(e) => (e.currentTarget.style.transform = "scale(.97)")}
            onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
            onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
          >
            <Icon name="plus" size={17} strokeWidth={2.4} />
            New Invoice
          </a>
        </div>

        {/* Nav */}
        <ScrollArea style={{ flex: 1, minHeight: 0 }}>
          <nav style={{ padding: "0 4px" }}>
            <p style={lbl()}>Finance</p>
            {NAV_FINANCE.map((item) => (
              item.children
                ? <NavGroup key={item.label} {...item} isActive={isActive} />
                : <NavItem key={item.href} {...item} active={isActive(item.href)} />
            ))}

            <p style={{ ...lbl(), marginTop: 16 }}>Workspace</p>
            {NAV_WORK.map((item) => (
              <NavItem key={item.href} {...item} active={isActive(item.href)} />
            ))}

            <div style={{ marginTop: 16 }}>
              {NAV_FOOTER.map((item) => (
                <NavItem key={item.href} {...item} active={isActive(item.href)} />
              ))}
            </div>
          </nav>
        </ScrollArea>

        {/* User block */}
        <div style={{
          padding: "10px 4px 4px",
          borderTop: "1px solid rgba(255,255,255,0.1)",
          marginTop: 8,
        }}>
          <a
            href="/profile"
            style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "6px 8px", cursor: "pointer", borderRadius: 10,
              textDecoration: "none",
            }}
          >
            <div style={{
              width: 34, height: 34, borderRadius: 11, flexShrink: 0,
              background: "linear-gradient(135deg, #E11D2C, #F87171)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontSize: 12, fontWeight: 700,
              position: "relative", overflow: "hidden",
            }}>
              {user?.avatarUrl ? null : initials}
              {user?.avatarUrl && (
                <img
                  src={user.avatarUrl}
                  alt=""
                  onError={(e) => { e.currentTarget.style.display = "none"; }}
                  style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", backgroundColor: "#fff" }}
                />
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{
                fontSize: 13, fontWeight: 650, color: "#FFFFFF", margin: 0,
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              }}>
                {user?.fullName || user?.name}
              </p>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", margin: 0 }}>
                {user?.role === "superadmin"
                  ? "Super Admin"
                  : user?.role === "admin"
                  ? "Admin"
                  : "Member"}
              </p>
            </div>
          </a>

          <button
            type="button"
            onClick={handleLogout}
            style={{
              width: "100%", display: "flex", alignItems: "center", gap: 10,
              padding: "8px 8px", borderRadius: 10, border: "none",
              background: "transparent", color: "#9CA3AF",
              fontSize: 13, fontWeight: 500, cursor: "pointer",
              transition: "all .12s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(225,29,44,.06)";
              e.currentTarget.style.color = "#E11D2C";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "#9CA3AF";
            }}
          >
            <Icon name="logout" size={16} />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      {/* ── Main panel ──────────────────────────────────────────────────── */}
      <div className="modus-main-panel" style={{
        flex: 1, display: "flex", flexDirection: "column",
        background: "#F7F7F8", borderRadius: 22,
        border: "1px solid #ECECEE",
        boxShadow: "0 1px 3px rgba(0,0,0,.03)",
        overflow: "hidden", minWidth: 0,
      }}>
        <TopBar
          currentPath={currentPath}
          initials={initials}
          user={user}
          onMenuToggle={() => setSidebarOpen((v) => !v)}
        />

        <div className="app-scroll modus-content-area" style={{ flex: 1, overflowY: "auto", padding: "4px 30px 30px" }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={currentPath}
              initial={{ opacity: 0, y: 8, filter: "blur(2px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -8, filter: "blur(2px)" }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              style={{ maxWidth: 1480, margin: "0 auto" }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
    </TooltipProvider>
  );
}
