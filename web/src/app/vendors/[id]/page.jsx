import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import AppShell from "@/components/AppShell";
import { api } from "@/utils/api";
import { ArrowLeft, Edit, Mail, Phone, Globe, MapPin, Landmark, Building2 } from "lucide-react";

const CATEGORY_BADGE = {
  supplier:         { label: "Supplier",      color: "#2563EB", bg: "#EFF6FF" },
  freelancer:       { label: "Freelancer",    color: "#7C3AED", bg: "#EDE9FE" },
  service_provider: { label: "Service",       color: "#0891B2", bg: "#ECFEFF" },
  subscription:     { label: "Subscription",  color: "#D97706", bg: "#FFFBEB" },
};

export default function VendorDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [vendor, setVendor] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadVendor(); }, [id]);

  async function loadVendor() {
    setLoading(true);
    try {
      const data = await api.get(`/api/vendors/${id}`);
      setVendor(data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  if (loading) {
    return (
      <AppShell>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", padding: 40 }}>
          <div style={{ width: 34, height: 34, border: "3px solid #7C3AED", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
        </div>
      </AppShell>
    );
  }

  if (!vendor) {
    return (
      <AppShell>
        <div style={{ padding: 40, textAlign: "center" }}>
          <p style={{ color: "#9CA3AF", fontSize: 14 }}>Vendor not found</p>
          <button type="button" onClick={() => navigate("/vendors")} style={{ marginTop: 16, padding: "8px 16px", background: "#7C3AED", color: "#FFF", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Back to Vendors</button>
        </div>
      </AppShell>
    );
  }

  const badge = CATEGORY_BADGE[vendor.category] || CATEGORY_BADGE.supplier;

  return (
    <AppShell>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      <div style={{ background: "#FFF", borderBottom: "1px solid #EBEBEB", padding: "14px 28px", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
        <button type="button" onClick={() => navigate("/vendors")} style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "none", cursor: "pointer", color: "#6B7280", fontSize: 13 }}>
          <ArrowLeft size={15} /> Vendors
        </button>
        <span style={{ color: "#E5E7EB" }}>/</span>
        <span style={{ fontSize: 13, color: "#0A0A0A", fontWeight: 600 }}>{vendor.companyName || vendor.name}</span>
      </div>

      <div style={{ flex: 1, overflowY: "auto" }}>
        <div style={{ background: "#FFF", borderBottom: "1px solid #EBEBEB", padding: "28px 32px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
              <div style={{ width: 64, height: 64, borderRadius: 18, background: badge.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ fontSize: 26, fontWeight: 800, color: badge.color }}>{(vendor.companyName || vendor.name).charAt(0).toUpperCase()}</span>
              </div>
              <div>
                <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0A0A0A", margin: "0 0 4px", letterSpacing: "-0.02em" }}>{vendor.companyName || vendor.name}</h1>
                {vendor.companyName && <p style={{ fontSize: 14, color: "#6B7280", margin: "0 0 8px" }}>{vendor.name}</p>}
                <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 6, background: badge.bg, color: badge.color }}>{badge.label}</span>
              </div>
            </div>
            <button type="button" onClick={() => navigate(`/vendors?edit=${id}`)} style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 16px", border: "1.5px solid #E5E7EB", borderRadius: 10, background: "#FFF", fontSize: 13, fontWeight: 600, color: "#374151", cursor: "pointer" }}>
              <Edit size={14} /> Edit
            </button>
          </div>
          <div style={{ display: "flex", gap: 20, marginTop: 20, flexWrap: "wrap" }}>
            {vendor.email && <div style={{ display: "flex", alignItems: "center", gap: 7 }}><Mail size={13} color="#9CA3AF" /><a href={`mailto:${vendor.email}`} style={{ fontSize: 13, color: "#374151", textDecoration: "none" }}>{vendor.email}</a></div>}
            {vendor.phone && <div style={{ display: "flex", alignItems: "center", gap: 7 }}><Phone size={13} color="#9CA3AF" /><span style={{ fontSize: 13, color: "#374151" }}>{vendor.phone}</span></div>}
            {vendor.website && <div style={{ display: "flex", alignItems: "center", gap: 7 }}><Globe size={13} color="#9CA3AF" /><a href={vendor.website} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: "#7C3AED", textDecoration: "none" }}>{vendor.website}</a></div>}
          </div>
        </div>

        <div style={{ padding: "24px 32px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 20 }}>
          <div style={{ background: "#FFF", border: "1px solid #EBEBEB", borderRadius: "var(--rcard)", padding: "20px 24px" }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: "#374151", margin: "0 0 16px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Contact Details</h3>
            {[["Contact Person", vendor.contactPerson], ["Email", vendor.email], ["Phone", vendor.phone], ["Website", vendor.website]].filter(([, v]) => v).map(([label, val]) => (
              <div key={label} style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                <span style={{ fontSize: 12, color: "#9CA3AF", minWidth: 110, flexShrink: 0 }}>{label}</span>
                <span style={{ fontSize: 13, color: "#0A0A0A", fontWeight: 500 }}>{val}</span>
              </div>
            ))}
          </div>

          {(vendor.bankName || vendor.bankAccount || vendor.bankIfsc) && (
            <div style={{ background: "#FFF", border: "1px solid #EBEBEB", borderRadius: "var(--rcard)", padding: "20px 24px" }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: "#374151", margin: "0 0 16px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                <Landmark size={13} style={{ marginRight: 6, display: "inline", verticalAlign: "middle" }} />Banking Details
              </h3>
              {[["Bank", vendor.bankName], ["Account", vendor.bankAccount], ["IFSC", vendor.bankIfsc]].filter(([, v]) => v).map(([label, val]) => (
                <div key={label} style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                  <span style={{ fontSize: 12, color: "#9CA3AF", minWidth: 70, flexShrink: 0 }}>{label}</span>
                  <span style={{ fontSize: 13, color: "#0A0A0A", fontFamily: label !== "Bank" ? "monospace" : "inherit" }}>{val}</span>
                </div>
              ))}
            </div>
          )}

          {(vendor.gstin || vendor.pan) && (
            <div style={{ background: "#FFF", border: "1px solid #EBEBEB", borderRadius: "var(--rcard)", padding: "20px 24px" }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: "#374151", margin: "0 0 16px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Tax Details</h3>
              {[["GSTIN", vendor.gstin], ["PAN", vendor.pan]].filter(([, v]) => v).map(([label, val]) => (
                <div key={label} style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                  <span style={{ fontSize: 12, color: "#9CA3AF", minWidth: 70, flexShrink: 0 }}>{label}</span>
                  <span style={{ fontSize: 13, color: "#0A0A0A", fontFamily: "monospace" }}>{val}</span>
                </div>
              ))}
            </div>
          )}

          {vendor.notes && (
            <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: "var(--rcard)", padding: "20px 24px" }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: "#92400E", margin: "0 0 10px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Notes</h3>
              <p style={{ fontSize: 13, color: "#374151", lineHeight: 1.6, margin: 0 }}>{vendor.notes}</p>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
