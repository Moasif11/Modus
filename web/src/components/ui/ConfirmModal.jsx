import { useState, useEffect } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";

/**
 * ConfirmModal — premium in-app replacement for window.confirm()
 *
 * Usage:
 *   const [confirm, setConfirm] = useState(null);
 *
 *   // To trigger:
 *   setConfirm({
 *     title: "Delete Invoice",
 *     message: "This action cannot be undone.",
 *     confirmLabel: "Delete",          // default: "Confirm"
 *     danger: true,                    // default: true (red button)
 *     onConfirm: () => doDelete(),
 *   });
 *
 *   // In JSX:
 *   <ConfirmModal state={confirm} onClose={() => setConfirm(null)} />
 */
export function ConfirmModal({ state, onClose }) {
  const {
    title = "Are you sure?",
    message = "This action cannot be undone.",
    confirmLabel = "Confirm",
    danger = true,
    withInput = false,
    inputPlaceholder = "",
    onConfirm,
  } = state ?? {};

  const [inputVal, setInputVal] = useState("");
  useEffect(() => { setInputVal(""); }, [state]);

  function handleConfirm() {
    onClose();
    onConfirm?.(withInput ? inputVal : undefined);
  }

  return (
    <AlertDialog open={!!state} onOpenChange={(open) => { if (!open) onClose(); }}>
      <AlertDialogContent
        style={{
          borderRadius: "20px 20px 0 0",
          boxShadow: "0 -8px 40px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.06)",
          maxWidth: "none",
          width: "100%",
          left: 0, right: 0, bottom: 0, top: "auto",
          transform: "none",
          margin: 0,
          padding: "20px 28px 26px",
          background: "#FFFFFF",
          gap: 0,
          animation: "sheetUp 0.28s cubic-bezier(0.32,0.72,0,1)",
        }}
      >
        {/* Grab handle */}
        <div style={{ width: 40, height: 4, borderRadius: 100, background: "#E5E7EB", margin: "0 auto 16px" }} />

        {/* Icon */}
        <div style={{
          width: 52, height: 52, borderRadius: 16,
          background: "#FEF2F2",
          display: "flex", alignItems: "center", justifyContent: "center",
          marginBottom: 18,
        }}>
          {danger
            ? <Trash2 size={22} color="#DC2626" />
            : <AlertTriangle size={22} color="#E11D2C" />
          }
        </div>

        <AlertDialogHeader style={{ marginBottom: 24 }}>
          <AlertDialogTitle style={{
            fontSize: 17, fontWeight: 700, color: "#0A0A0A",
            letterSpacing: "-0.02em", lineHeight: 1.3, marginBottom: 8,
          }}>
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription style={{
            fontSize: 13.5, color: "#6B7280", lineHeight: 1.6, margin: 0,
          }}>
            {message}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {withInput && (
          <input
            autoFocus
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            placeholder={inputPlaceholder}
            style={{
              width: "100%", padding: "10px 12px", border: "1.5px solid #E5E7EB",
              borderRadius: 10, fontSize: 13, color: "#0A0A0A", background: "#FAFAFA",
              boxSizing: "border-box", marginBottom: 20, fontFamily: "inherit",
            }}
          />
        )}

        <AlertDialogFooter style={{ display: "flex", flexDirection: "row", gap: 10, marginTop: 0 }}>
          <AlertDialogCancel
            onClick={onClose}
            style={{
              flex: 1,
              padding: "11px 16px",
              border: "1.5px solid #E5E7EB",
              borderRadius: 11,
              background: "#FFF",
              fontSize: 13,
              fontWeight: 600,
              color: "#374151",
              cursor: "pointer",
              transition: "all 0.12s",
              marginTop: 0,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "#F9FAFB"; e.currentTarget.style.borderColor = "#D1D5DB"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "#FFF"; e.currentTarget.style.borderColor = "#E5E7EB"; }}
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            style={{
              flex: 1,
              padding: "11px 16px",
              border: "none",
              borderRadius: 11,
              background: danger ? "#E11D2C" : "#0A0A0A",
              fontSize: 13,
              fontWeight: 700,
              color: "#FFF",
              cursor: "pointer",
              transition: "all 0.12s",
              boxShadow: danger ? "0 2px 8px rgba(225,29,44,0.3)" : "none",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = danger ? "#C41020" : "#333";
              e.currentTarget.style.transform = "translateY(-1px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = danger ? "#E11D2C" : "#0A0A0A";
              e.currentTarget.style.transform = "none";
            }}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default ConfirmModal;
