import { useState, useEffect } from "react";
import AppShell from "@/components/AppShell";
import { api } from "@/utils/api";
import { Card, Chip, ghostBtn } from "@/components/studio/primitives.jsx";
import { Icon } from "@/components/studio/icons.jsx";
import { Check, Star, Sparkles } from "lucide-react";

const ACCENT = "#E11D2C";

// Preview thumbnails keyed by the 3 approved template slugs.
// Also mapped from legacy DB slugs so old records render a sensible preview.
const TEMPLATE_PREVIEWS = {
  modern: {
    gradient: "linear-gradient(135deg, #FEF2F2 0%, #FFF7ED 100%)",
    accent: "#E11D2C",
    preview: (
      <div style={{ padding: "0", fontFamily: "inherit", overflow: "hidden" }}>
        {/* Red header band */}
        <div style={{ background: "#E11D2C", padding: "18px 18px 20px", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: -30, right: -10, width: 90, height: 90, borderRadius: "50%", background: "rgba(255,255,255,.08)" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", position: "relative" }}>
            <div style={{ background: "#fff", borderRadius: 5, padding: "5px 8px", display: "inline-block" }}>
              <div style={{ width: 44, height: 10, background: "#0A0A0A", borderRadius: 2 }} />
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#fff", letterSpacing: "-0.02em" }}>Invoice</div>
              <div style={{ width: 40, height: 6, background: "rgba(255,255,255,.4)", borderRadius: 2, marginTop: 4, marginLeft: "auto" }} />
            </div>
          </div>
        </div>
        <div style={{ padding: "12px 18px" }}>
          <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
            {[0, 1].map(i => (
              <div key={i} style={{ flex: 1 }}>
                {[0, 1, 2].map(j => (
                  <div key={j} style={{ width: j === 0 ? "55%" : "90%", height: 5, background: j === 0 ? "#9CA3AF" : "#E5E7EB", borderRadius: 2, marginBottom: 3 }} />
                ))}
              </div>
            ))}
          </div>
          <div style={{ border: "1px solid #EEEEF0", borderRadius: 6, overflow: "hidden" }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "5px 8px", borderBottom: "1px solid #F3F4F6" }}>
                <div style={{ width: "45%", height: 5, background: "#E5E7EB", borderRadius: 2 }} />
                <div style={{ width: "18%", height: 5, background: "#E11D2C", borderRadius: 2, opacity: 0.7 }} />
              </div>
            ))}
          </div>
          <div style={{ marginTop: 8, textAlign: "right" }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: "#0A0A0A" }}>₹1,18,000</div>
          </div>
        </div>
      </div>
    ),
  },
  minimal: {
    gradient: "linear-gradient(135deg, #FFFFFF 0%, #F8FAFC 100%)",
    accent: "#0A0A0A",
    preview: (
      <div style={{ padding: "18px 18px", fontFamily: "inherit" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
          <div style={{ width: 52, height: 12, background: "#0A0A0A", borderRadius: 2 }} />
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 13, fontWeight: 300, color: "#0A0A0A", letterSpacing: "0.12em" }}>INVOICE</div>
            <div style={{ width: 44, height: 6, background: "#E5E7EB", borderRadius: 2, marginTop: 4, marginLeft: "auto" }} />
          </div>
        </div>
        <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{ flex: 1 }}>
              <div style={{ width: "50%", height: 5, background: "#9CA3AF", borderRadius: 2, marginBottom: 5 }} />
              <div style={{ width: "100%", height: 4, background: "#E5E7EB", borderRadius: 2, marginBottom: 3 }} />
              <div style={{ width: "70%", height: 4, background: "#E5E7EB", borderRadius: 2 }} />
            </div>
          ))}
        </div>
        <div style={{ borderTop: "2px solid #0A0A0A", paddingTop: 8 }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid #F3F4F6" }}>
              <div style={{ width: "40%", height: 5, background: "#E5E7EB", borderRadius: 2 }} />
              <div style={{ width: "15%", height: 5, background: "#0A0A0A", borderRadius: 2 }} />
            </div>
          ))}
        </div>
        <div style={{ marginTop: 10, textAlign: "right" }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#0A0A0A" }}>₹1,18,000</div>
        </div>
      </div>
    ),
  },
  classic: {
    gradient: "linear-gradient(135deg, #F9FAFB 0%, #F3F4F6 100%)",
    accent: "#0A0A0A",
    preview: (
      <div style={{ padding: "10px", fontFamily: "inherit" }}>
        <div style={{ border: "2px solid #0A0A0A", borderRadius: 2, overflow: "hidden" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", borderBottom: "2px solid #0A0A0A" }}>
            <div style={{ width: 44, height: 10, background: "#0A0A0A", borderRadius: 2 }} />
            <div style={{ fontSize: 9, fontWeight: 800, color: "#0A0A0A", letterSpacing: ".08em" }}>TAX INVOICE</div>
          </div>
          <div style={{ display: "flex", borderBottom: "1px solid #D6D6D9" }}>
            {[0, 1].map(i => (
              <div key={i} style={{ flex: 1, padding: "7px 8px", borderRight: i === 0 ? "1px solid #D6D6D9" : "none" }}>
                {[0, 1, 2].map(j => (
                  <div key={j} style={{ width: j === 0 ? "55%" : "80%", height: 4, background: j === 0 ? "#9CA3AF" : "#E5E7EB", borderRadius: 2, marginBottom: 3 }} />
                ))}
              </div>
            ))}
          </div>
          <div style={{ background: "#0A0A0A", padding: "4px 8px", display: "flex", justifyContent: "space-between" }}>
            {["#", "DESC", "QTY", "RATE", "TOTAL"].map(h => (
              <span key={h} style={{ fontSize: 6, fontWeight: 700, color: "white" }}>{h}</span>
            ))}
          </div>
          {[1, 2].map(i => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "5px 8px", borderBottom: "1px solid #F3F4F6" }}>
              {[6, 40, 10, 15, 18].map((w, j) => (
                <div key={j} style={{ width: `${w}%`, height: 4, background: j === 4 ? "#0A0A0A" : "#E5E7EB", borderRadius: 2 }} />
              ))}
            </div>
          ))}
          <div style={{ padding: "6px 8px", textAlign: "right" }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: "#0A0A0A" }}>₹1,18,000</div>
          </div>
        </div>
      </div>
    ),
  },
  // Legacy slug aliases → map to the closest approved template preview
  "minimal-corporate":     null,  // resolved below
  "premium-executive":     null,
  "modern-gradient":       null,
  "clean-professional":    null,
  "tax-compliant-india-gst": null,
};
// Resolve legacy slugs to approved previews
TEMPLATE_PREVIEWS["minimal-corporate"]      = TEMPLATE_PREVIEWS.classic;
TEMPLATE_PREVIEWS["premium-executive"]      = TEMPLATE_PREVIEWS.modern;
TEMPLATE_PREVIEWS["modern-gradient"]        = TEMPLATE_PREVIEWS.modern;
TEMPLATE_PREVIEWS["clean-professional"]     = TEMPLATE_PREVIEWS.minimal;
TEMPLATE_PREVIEWS["tax-compliant-india-gst"] = TEMPLATE_PREVIEWS.classic;

export default function TemplatesPage() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  useEffect(() => { loadTemplates(); }, []);

  async function loadTemplates() {
    try {
      const data = await api.get("/api/templates");
      setTemplates(data.templates);
      const def = data.templates.find(t => t.isDefault);
      if (def) setSelected(def.id);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell>
      <div style={{ flex: 1, overflowY: "auto", padding: "4px 30px 30px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingTop: 4 }}>

          {/* ── Toolbar ─────────────────────────────────────────────────────── */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Chip tone={ACCENT} bg={ACCENT + "14"}>{templates.length} template{templates.length !== 1 ? "s" : ""}</Chip>
              {selected && <Chip tone="#059669" bg="#DCFCE7">1 selected</Chip>}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button type="button" style={ghostBtn} onClick={() => window.location.href = "/invoices/new"}>
                <Icon name="plus" size={15} /> New Invoice
              </button>
            </div>
          </div>

          {/* ── Content ─────────────────────────────────────────────────────── */}
          {loading ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "80px 0" }}>
              <div style={{ width: 36, height: 36, border: `3px solid ${ACCENT}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 20 }}>
              {templates.map(t => {
                const preview = TEMPLATE_PREVIEWS[t.slug] || TEMPLATE_PREVIEWS["minimal-corporate"];
                const isSelected = selected === t.id;
                return (
                  <div
                    key={t.id}
                    role="button"
                    tabIndex={0}
                    aria-pressed={isSelected}
                    aria-label={`Select ${t.name || t.slug} template`}
                    onClick={() => setSelected(t.id)}
                    onKeyDown={(e) => e.key === "Enter" && setSelected(t.id)}
                    style={{
                      background: "#fff",
                      border: `2px solid ${isSelected ? ACCENT : "#EEEEF0"}`,
                      borderRadius: "var(--rcard)",
                      overflow: "hidden",
                      cursor: "pointer",
                      transition: "box-shadow .18s, border-color .18s, transform .18s",
                      boxShadow: isSelected ? `0 4px 20px ${ACCENT}26` : "0 1px 2px rgba(0,0,0,.035)",
                    }}
                    onMouseEnter={e => { if (!isSelected) { e.currentTarget.style.borderColor = ACCENT; e.currentTarget.style.boxShadow = `0 8px 32px ${ACCENT}1F`; e.currentTarget.style.transform = "translateY(-2px)"; } }}
                    onMouseLeave={e => { if (!isSelected) { e.currentTarget.style.borderColor = "#EEEEF0"; e.currentTarget.style.boxShadow = "0 1px 2px rgba(0,0,0,.035)"; e.currentTarget.style.transform = "none"; } }}
                  >
                    {/* Preview area */}
                    <div style={{ background: preview.gradient, height: 200, borderBottom: `1px solid ${isSelected ? "#FECACA" : "#F3F4F6"}`, position: "relative", overflow: "hidden" }}>
                      {preview.preview}
                      {isSelected && (
                        <div style={{ position: "absolute", top: 10, right: 10, background: ACCENT, borderRadius: "50%", width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 2px 8px ${ACCENT}66` }}>
                          <Check size={13} color="white" strokeWidth={3} />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div style={{ padding: "16px 18px" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                        <h3 style={{ fontSize: 14, fontWeight: 700, color: "#0A0A0A", margin: 0 }}>{t.name}</h3>
                        {t.isDefault && (
                          <Chip tone={ACCENT} bg={ACCENT + "14"}>
                            <Star size={9} strokeWidth={2.5} style={{ marginRight: 3 }} />DEFAULT
                          </Chip>
                        )}
                      </div>
                      <p style={{ fontSize: 12, color: "#6B7280", margin: "0 0 14px", lineHeight: 1.6 }}>{t.description}</p>
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); setSelected(t.id); }}
                        style={{ width: "100%", padding: "9px", border: "none", borderRadius: 9, background: isSelected ? ACCENT : "#F3F4F6", color: isSelected ? "#fff" : "#374151", fontSize: 12, fontWeight: 700, cursor: "pointer", transition: "all .15s", font: "inherit" }}
                      >
                        {isSelected ? "✓ Selected" : "Select Template"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Selected banner ─────────────────────────────────────────────── */}
          {selected && (
            <Card pad={18}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 36, height: 36, borderRadius: 9, background: ACCENT + "14", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Sparkles size={18} color={ACCENT} />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: "#0A0A0A", margin: 0 }}>Template selected!</p>
                  <p style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>This template will be used as default when creating new invoices. You can change it per-invoice in the editor.</p>
                </div>
                <a
                  href="/invoices/new"
                  style={{ ...ghostBtn, background: ACCENT, color: "#fff", border: `1px solid ${ACCENT}`, textDecoration: "none", flexShrink: 0 }}
                >
                  Create Invoice →
                </a>
              </div>
            </Card>
          )}
        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </AppShell>
  );
}
