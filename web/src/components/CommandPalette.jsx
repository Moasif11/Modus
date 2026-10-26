import { useEffect, useState } from "react";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";

// ── Nav data ──────────────────────────────────────────────────────────────────
const FINANCE_ITEMS = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
      </svg>
    ),
  },
  {
    label: "Receivables",
    href: "/invoices",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
      </svg>
    ),
  },
  {
    label: "Quotes",
    href: "/quotes",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
      </svg>
    ),
  },
  {
    label: "Expenses",
    href: "/payables",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1z"/>
      </svg>
    ),
  },
  {
    label: "Reports",
    href: "/reports",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
      </svg>
    ),
  },
];

const WORKSPACE_ITEMS = [
  {
    label: "Customers",
    href: "/customers",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
  {
    label: "Vendors",
    href: "/vendors",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
      </svg>
    ),
  },
  {
    label: "Employees",
    href: "/employees",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/><polyline points="16 11 18 13 22 9"/>
      </svg>
    ),
  },
  {
    label: "Services",
    href: "/services",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
      </svg>
    ),
  },
  {
    label: "Projects",
    href: "/projects",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
      </svg>
    ),
  },
];

const ACTION_ITEMS = [
  {
    label: "New Invoice",
    href: "/invoices/new",
    shortcut: "N",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
      </svg>
    ),
  },
  {
    label: "New Bill",
    href: "/payables?new=1",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
      </svg>
    ),
  },
  {
    label: "Settings",
    href: "/settings",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
      </svg>
    ),
  },
];

// ── CommandPalette ────────────────────────────────────────────────────────────
export default function CommandPalette({ open, onClose }) {
  function navigate(href) {
    onClose();
    // Small delay so the dialog closes cleanly before navigating
    setTimeout(() => { window.location.href = href; }, 80);
  }

  return (
    <>
      <style>{`
        /* Override shadcn DialogContent to match premium aesthetic */
        .modus-cmd-dialog {
          border-radius: 20px !important;
        }
        .modus-cmd-dialog > button {
          display: none !important;
        }
        [cmdk-item][aria-selected="true"] {
          background: #FEF2F2 !important;
          color: #E11D2C !important;
        }
        [cmdk-item][aria-selected="true"] svg {
          color: #E11D2C !important;
        }
        [cmdk-group-heading] {
          font-size: 9px !important;
          font-weight: 700 !important;
          letter-spacing: .09em !important;
          text-transform: uppercase !important;
          color: #B4B7BE !important;
          padding: 6px 8px 2px !important;
        }
        [cmdk-input] {
          font-family: "Plus Jakarta Sans", sans-serif !important;
          font-size: 14px !important;
        }
        [cmdk-item] {
          border-radius: 8px !important;
          font-family: "Plus Jakarta Sans", sans-serif !important;
          font-size: 13px !important;
          font-weight: 500 !important;
          color: #374151 !important;
          gap: 10px !important;
          padding: 8px 10px !important;
          cursor: pointer !important;
        }
      `}</style>

      <div>
        <CommandDialog
          open={open}
          onOpenChange={(v) => { if (!v) onClose(); }}
          className="modus-cmd-dialog"
        >
          {/* Wrap in a styled container via a className override on the inner Command */}
          <div style={{ borderRadius: 20, overflow: "hidden", background: "#fff", boxShadow: "0 24px 64px rgba(0,0,0,0.18)" }}>
            {/* Search row */}
            <div style={{ display: "flex", alignItems: "center", borderBottom: "1px solid #F3F4F6" }}>
              <div style={{ flex: 1 }}>
                <CommandInput placeholder="Search pages and actions…" />
              </div>
              <span style={{
                marginRight: 14, flexShrink: 0,
                fontSize: 10, fontWeight: 700, letterSpacing: "0.04em",
                color: "#9CA3AF", background: "#F3F4F6",
                border: "1px solid #E5E7EB", borderRadius: 6,
                padding: "2px 6px",
              }}>
                ⌘K
              </span>
            </div>

            <CommandList style={{ maxHeight: 380 }}>
              <CommandEmpty style={{ padding: "32px 0", textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>
                No results found.
              </CommandEmpty>

              <CommandGroup heading="Finance">
                {FINANCE_ITEMS.map((item) => (
                  <CommandItem
                    key={item.href}
                    value={item.label}
                    onSelect={() => navigate(item.href)}
                  >
                    <span style={{ color: "#9CA3AF", display: "flex", alignItems: "center" }}>{item.icon}</span>
                    <span>{item.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>

              <CommandSeparator />

              <CommandGroup heading="Workspace">
                {WORKSPACE_ITEMS.map((item) => (
                  <CommandItem
                    key={item.href}
                    value={item.label}
                    onSelect={() => navigate(item.href)}
                  >
                    <span style={{ color: "#9CA3AF", display: "flex", alignItems: "center" }}>{item.icon}</span>
                    <span>{item.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>

              <CommandSeparator />

              <CommandGroup heading="Actions">
                {ACTION_ITEMS.map((item) => (
                  <CommandItem
                    key={item.href}
                    value={item.label}
                    onSelect={() => navigate(item.href)}
                  >
                    <span style={{ color: "#E11D2C", display: "flex", alignItems: "center" }}>{item.icon}</span>
                    <span>{item.label}</span>
                    {item.shortcut && (
                      <CommandShortcut style={{ fontSize: 10, color: "#9CA3AF" }}>⌘{item.shortcut}</CommandShortcut>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>

            {/* Footer hint */}
            <div style={{
              borderTop: "1px solid #F3F4F6",
              padding: "8px 14px",
              display: "flex", alignItems: "center", gap: 16,
              background: "#FAFAFA",
            }}>
              {[
                { keys: ["↑", "↓"], label: "navigate" },
                { keys: ["↵"], label: "select" },
                { keys: ["esc"], label: "close" },
              ].map(({ keys, label }) => (
                <span key={label} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#9CA3AF" }}>
                  {keys.map((k) => (
                    <kbd key={k} style={{
                      background: "#F3F4F6", border: "1px solid #E5E7EB",
                      borderRadius: 4, padding: "1px 5px",
                      fontSize: 10, fontFamily: "inherit", color: "#6B7280",
                    }}>{k}</kbd>
                  ))}
                  <span>{label}</span>
                </span>
              ))}
            </div>
          </div>
        </CommandDialog>
      </div>
    </>
  );
}
