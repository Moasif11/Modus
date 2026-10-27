import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import ConfirmModal from "@/components/ui/ConfirmModal";
import AppShell from "@/components/AppShell";
import CustomSelect from "@/components/ui/CustomSelect";
import { api } from "@/utils/api";
import { INDIAN_STATES } from "@/utils/invoiceCalc";
import { Card, Chip, Avatar, ghostBtn } from "@/components/studio/primitives";
import { Icon } from "@/components/studio/icons";
import { Logo } from "@/components/studio/Logo";
import useUpload from "@/utils/useUpload";
import { useAuth } from "@/utils/auth";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Spinner } from "@/components/ui/spinner";
import DatePickerInput from "@/components/ui/DatePickerInput";

const ACCENT = "#E11D2C";

const SET_SECTIONS = [
  { id: "company", label: "Company profile", icon: "building" },
  { id: "branding", label: "Branding & White-Label", icon: "palette" },
  { id: "invoicing", label: "Invoicing & GST", icon: "receipt" },
  { id: "team", label: "Team & roles", icon: "users" },
  { id: "notifications", label: "Notifications", icon: "bell" },
  { id: "documents", label: "Documents", icon: "folder" },
  { id: "clientdocs", label: "Client documents", icon: "users" },
];

const DOC_CATEGORIES = [
  { value: "registration", label: "Registration & incorporation" },
  { value: "tax", label: "Tax & GST" },
  { value: "banking", label: "Banking" },
  { value: "legal", label: "Legal & compliance" },
  { value: "agreement", label: "Agreements & contracts" },
  { value: "insurance", label: "Insurance" },
  { value: "other", label: "Other" },
];
const DOC_CAT_LABEL = Object.fromEntries(DOC_CATEGORIES.map(c => [c.value, c.label]));

const setSectLbl = {
  fontSize: 11, fontWeight: 700, letterSpacing: ".07em",
  textTransform: "uppercase", color: "#B4B7BE", margin: "0 0 12px",
};

const fieldGrid = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 };

const inp = {
  width: "100%", padding: "10px 13px",
  border: "1px solid #ECECEE", borderRadius: 10,
  fontSize: 13.5, color: "#0A0A0A", fontWeight: 550,
  background: "#fff", boxSizing: "border-box", outline: "none",
  transition: "border-color .15s, box-shadow .15s",
};

function Field({ label, children, full, hint }) {
  return (
    <div style={{ gridColumn: full ? "1 / -1" : "auto" }}>
      <label style={{
        display: "block", fontSize: 11.5, fontWeight: 600,
        color: "#9CA3AF", margin: "0 0 6px", letterSpacing: ".01em",
      }}>
        {label}
      </label>
      {children}
      {hint && <p style={{ fontSize: 11, color: "#B4B7BE", margin: "5px 2px 0" }}>{hint}</p>}
    </div>
  );
}

function ReadField({ label, value, mono, full }) {
  return (
    <div style={{ gridColumn: full ? "1 / -1" : "auto" }}>
      <label style={{
        display: "block", fontSize: 11.5, fontWeight: 600,
        color: "#9CA3AF", margin: "0 0 6px", letterSpacing: ".01em",
      }}>
        {label}
      </label>
      <div style={{
        display: "flex", alignItems: "center",
        background: "#fff", border: "1px solid #ECECEE",
        borderRadius: 10, padding: "10px 13px",
        fontSize: 13.5, color: "#0A0A0A", fontWeight: 550,
        fontFamily: mono ? "ui-monospace, monospace" : "inherit",
      }}>
        {value || <span style={{ color: "#C9CCD4" }}>—</span>}
      </div>
    </div>
  );
}

function Toggle({ on, onChange }) {
  const [internal, setInternal] = useState(on);
  const controlled = typeof onChange === "function";
  const v = controlled ? on : internal;
  return (
    <button
      type="button"
      onClick={() => (controlled ? onChange(!on) : setInternal(x => !x))}
      style={{
        width: 40, height: 23, borderRadius: 12, border: "none",
        cursor: "pointer", padding: 2,
        background: v ? ACCENT : "#DADCE0", transition: "background .18s",
        flexShrink: 0, display: "flex",
        justifyContent: v ? "flex-end" : "flex-start", alignItems: "center",
      }}
    >
      <span style={{
        width: 19, height: 19, borderRadius: "50%", background: "#fff",
        boxShadow: "0 1px 3px rgba(0,0,0,.2)", transition: "all .18s",
      }} />
    </button>
  );
}

function SettingRow({ icon, title, sub, children, last }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 14,
      padding: "16px 0", borderBottom: last ? "none" : "1px solid #F2F2F4",
    }}>
      {icon && (
        <div style={{
          width: 38, height: 38, borderRadius: 11, background: "#F3F4F6",
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          <Icon name={icon} size={17} color="#6B7280" />
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13.5, fontWeight: 650, color: "#0A0A0A", margin: "0 0 2px" }}>{title}</p>
        {sub && <p style={{ fontSize: 12, color: "#9CA3AF", margin: 0 }}>{sub}</p>}
      </div>
      {children}
    </div>
  );
}

function PanelHeader({ title, sub, onSave, saving, saved, readOnly }) {
  return (
    <div style={{
      display: "flex", alignItems: "flex-start",
      justifyContent: "space-between", marginBottom: 18, gap: 14,
    }}>
      <div>
        <h3 style={{
          fontSize: 16, fontWeight: 750, color: "#0A0A0A",
          margin: "0 0 3px", letterSpacing: "-0.02em",
        }}>{title}</h3>
        <p style={{ fontSize: 13, color: "#9CA3AF", margin: 0 }}>{sub}</p>
      </div>
      {readOnly ? (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 13px", borderRadius: 10, background: "#F3F4F6", color: "#6B7280", fontSize: 12, fontWeight: 650, whiteSpace: "nowrap" }}>
          <Icon name="lock" size={13} /> Superadmin only
        </span>
      ) : onSave && (
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "9px 15px", borderRadius: 10, border: "none",
            background: saved ? "#10B981" : ACCENT,
            color: "#fff", fontSize: 12.5, fontWeight: 650,
            font: "inherit", cursor: saving ? "not-allowed" : "pointer",
            whiteSpace: "nowrap", opacity: saving ? 0.8 : 1,
            transition: "background .2s",
          }}
        >
          {saving ? <Spinner style={{ width: 15, height: 15 }} /> : <Icon name="check" size={15} strokeWidth={2.4} />}
          {saved ? "Saved!" : saving ? "Saving…" : "Save changes"}
        </button>
      )}
    </div>
  );
}

function fileKind(doc) {
  const src = String(doc.objectKey || doc.documentUrl || "").toLowerCase();
  if (src.endsWith(".pdf")) return "pdf";
  if (/\.(jpg|jpeg|png|webp|gif)$/.test(src)) return "image";
  if (src.endsWith(".docx")) return "docx";
  if (src.endsWith(".xlsx")) return "xlsx";
  return "file";
}

function DocumentsSection() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "superadmin";
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [category, setCategory] = useState("registration");
  const [customDocName, setCustomDocName] = useState("");
  const [confirmState, setConfirmState] = useState(null);
  const [viewer, setViewer] = useState(null);
  const [upload] = useUpload();
  const fileRef = useRef(null);
  const replaceRef = useRef(null);
  const replaceDocRef = useRef(null);

  useEffect(() => { loadDocs(); }, []);

  async function loadDocs() {
    try {
      const data = await api.get("/api/documents?entityType=company&entityId=1");
      setDocs(data.documents || []);
    } catch (err) {
      toast.error("Failed to load documents: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpload(e, replacing) {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const result = await upload({ file });
      if (result.error) throw new Error(result.error);
      await api.post("/api/documents", {
        entityType: "company",
        entityId: 1,
        documentType: replacing ? replacing.documentType : (category === "other" ? customDocName.trim() : category),
        documentName: file.name,
        documentUrl: result.url,
        objectKey: result.objectKey,
      });
      if (replacing) {
        await api.delete(`/api/documents/${replacing.id}`);
        toast.success("Document replaced");
      } else {
        toast.success("Document uploaded");
        if (category === "other") setCustomDocName("");
      }
      loadDocs();
    } catch (err) {
      toast.error("Upload failed: " + err.message);
    } finally {
      setUploading(false);
    }
  }

  function handleDelete(doc) {
    setConfirmState({
      title: "Delete Document",
      message: `Delete "${doc.documentName}"? The file is removed permanently.`,
      confirmLabel: "Delete",
      danger: true,
      onConfirm: async () => {
        try {
          await api.delete(`/api/documents/${doc.id}`);
          toast.success("Document deleted");
          loadDocs();
        } catch (err) {
          toast.error("Delete failed: " + err.message);
        }
      },
    });
  }

  async function handleDownload(doc) {
    try {
      const res = await fetch(doc.documentUrl);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = doc.documentName || "document";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);
    } catch {
      window.open(doc.documentUrl, "_blank", "noopener");
    }
  }

  const kind = viewer ? fileKind(viewer) : null;

  const actBtn = {
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    width: 30, height: 30, borderRadius: 8, border: "1px solid #ECECEE",
    background: "#fff", cursor: "pointer", padding: 0,
  };

  return (
    <Card pad={24}>
      <PanelHeader
        title="Documents"
        sub="Company registration, tax, banking and legal documents — visible to the whole team"
      />

      {isAdmin && (
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end", marginBottom: 18, flexWrap: "wrap" }}>
          <div style={{ minWidth: 230 }}>
            <Field label="Category">
              <CustomSelect
                value={category}
                onChange={setCategory}
                options={DOC_CATEGORIES}
              />
            </Field>
          </div>
          {category === "other" && (
            <div style={{ minWidth: 230 }}>
              <Field label="Document Name">
                <input
                  type="text"
                  className="set-inp"
                  style={{ ...inp, padding: "9px 12px", height: 38, boxSizing: "border-box", margin: 0 }}
                  placeholder="e.g. Founders Agreement"
                  value={customDocName}
                  onChange={e => setCustomDocName(e.target.value)}
                />
              </Field>
            </div>
          )}
          <button
            type="button"
            disabled={uploading || (category === "other" && !customDocName.trim())}
            onClick={() => fileRef.current?.click()}
            style={{
              display: "inline-flex", alignItems: "center", gap: 7,
              padding: "10px 15px", borderRadius: 10, border: "none",
              height: 38, boxSizing: "border-box",
              background: ACCENT, color: "#fff", fontSize: 12.5, fontWeight: 650,
              cursor: (uploading || (category === "other" && !customDocName.trim())) ? "not-allowed" : "pointer", 
              opacity: (uploading || (category === "other" && !customDocName.trim())) ? 0.7 : 1,
            }}
          >
            <Icon name="plus" size={14} color="#fff" />
            {uploading ? "Uploading…" : "Upload document"}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp,.docx,.xlsx"
            style={{ display: "none" }}
            onChange={(e) => handleUpload(e, null)}
          />
          <input
            ref={replaceRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp,.docx,.xlsx"
            style={{ display: "none" }}
            onChange={(e) => handleUpload(e, replaceDocRef.current)}
          />
          <p style={{ fontSize: 11, color: "#B4B7BE", margin: "0 0 10px", width: "100%" }}>
            PDF, JPG, PNG, WebP, DOCX or XLSX — max 5MB
          </p>
        </div>
      )}

      {loading ? (
        <p style={{ fontSize: 13, color: "#9CA3AF", padding: "24px 0", textAlign: "center" }}>Loading…</p>
      ) : docs.length === 0 ? (
        <div style={{ textAlign: "center", padding: "36px 0", color: "#9CA3AF" }}>
          <Icon name="folder" size={28} color="#D6D8DE" />
          <p style={{ fontSize: 13.5, fontWeight: 600, margin: "10px 0 3px", color: "#6B7280" }}>No documents yet</p>
          <p style={{ fontSize: 12.5, margin: 0 }}>
            {isAdmin ? "Upload GST certificates, incorporation papers, bank proofs and agreements." : "Admins can upload company documents here."}
          </p>
        </div>
      ) : (
        <div>
          {docs.map((doc, i) => (
            <SettingRow
              key={doc.id}
              icon="file"
              title={DOC_CAT_LABEL[doc.documentType] || doc.documentType}
              sub={`${doc.documentName} · ${new Date(doc.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`}
              last={i === docs.length - 1}
            >
              <div style={{ display: "flex", gap: 6 }}>
                <button type="button" title="View" style={actBtn} onClick={() => setViewer(doc)}>
                  <Icon name="eye" size={14} color="#6B7280" />
                </button>
                <button type="button" title="Download" style={actBtn} onClick={() => handleDownload(doc)}>
                  <Icon name="download" size={14} color="#6B7280" />
                </button>
                {isAdmin && (
                  <>
                    <button
                      type="button"
                      title="Replace file"
                      style={actBtn}
                      onClick={() => { replaceDocRef.current = doc; replaceRef.current?.click(); }}
                    >
                      <Icon name="edit" size={14} color="#6B7280" />
                    </button>
                    <button type="button" title="Delete" style={{ ...actBtn, borderColor: "#FCDADA" }} onClick={() => handleDelete(doc)}>
                      <Icon name="x" size={14} color={ACCENT} />
                    </button>
                  </>
                )}
              </div>
            </SettingRow>
          ))}
        </div>
      )}

      <ConfirmModal state={confirmState} onClose={() => setConfirmState(null)} />

      {viewer && typeof document !== "undefined" && createPortal(
        <div
          onClick={() => setViewer(null)}
          style={{
            position: "fixed", inset: 0, zIndex: 300,
            background: "rgba(10,10,10,.55)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff", borderRadius: 20, overflow: "hidden",
              boxShadow: "0 24px 64px rgba(0,0,0,0.18)",
              width: "min(920px, 96vw)", height: "min(86vh, 900px)",
              display: "flex", flexDirection: "column",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", borderBottom: "1px solid #EFEFF1" }}>
              <Icon name="file" size={16} color="#6B7280" />
              <p style={{ fontSize: 13.5, fontWeight: 650, color: "#0A0A0A", margin: 0, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {viewer.documentName}
              </p>
              <button type="button" title="Download" style={actBtn} onClick={() => handleDownload(viewer)}>
                <Icon name="download" size={14} color="#6B7280" />
              </button>
              <button type="button" title="Close" style={actBtn} onClick={() => setViewer(null)}>
                <Icon name="x" size={14} color="#6B7280" />
              </button>
            </div>
            <div style={{ flex: 1, background: "#F5F5F6", display: "flex", alignItems: "center", justifyContent: "center", overflow: "auto" }}>
              {kind === "pdf" ? (
                <iframe title={viewer.documentName} src={viewer.documentUrl} style={{ width: "100%", height: "100%", border: "none" }} />
              ) : kind === "image" ? (
                <img src={viewer.documentUrl} alt={viewer.documentName} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
              ) : (
                <div style={{ textAlign: "center", color: "#6B7280", padding: 30 }}>
                  <Icon name="file" size={30} color="#C9CCD4" />
                  <p style={{ fontSize: 13.5, fontWeight: 600, margin: "12px 0 4px" }}>No in-app preview for this file type</p>
                  <p style={{ fontSize: 12.5, margin: "0 0 14px" }}>Download it to view in the right application.</p>
                  <button
                    type="button"
                    onClick={() => handleDownload(viewer)}
                    style={{ padding: "9px 16px", borderRadius: 10, border: "none", background: ACCENT, color: "#fff", fontSize: 12.5, fontWeight: 650, cursor: "pointer" }}
                  >
                    Download
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </Card>
  );
}

// Full-screen preview shared by the client-document browser.
function DocViewer({ doc, onClose, onDownload }) {
  if (!doc || typeof document === "undefined") return null;
  const kind = fileKind(doc);
  const actBtn = {
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    width: 30, height: 30, borderRadius: 8, border: "1px solid #ECECEE",
    background: "#fff", cursor: "pointer", padding: 0,
  };
  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 300,
        background: "rgba(10,10,10,.55)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff", borderRadius: 20, overflow: "hidden",
          boxShadow: "0 24px 64px rgba(0,0,0,0.18)",
          width: "min(920px, 96vw)", height: "min(86vh, 900px)",
          display: "flex", flexDirection: "column",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", borderBottom: "1px solid #EFEFF1" }}>
          <Icon name="file" size={16} color="#6B7280" />
          <p style={{ fontSize: 13.5, fontWeight: 650, color: "#0A0A0A", margin: 0, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {doc.documentName}
          </p>
          <button type="button" title="Download" style={actBtn} onClick={() => onDownload(doc)}>
            <Icon name="download" size={14} color="#6B7280" />
          </button>
          <button type="button" title="Close" style={actBtn} onClick={onClose}>
            <Icon name="x" size={14} color="#6B7280" />
          </button>
        </div>
        <div style={{ flex: 1, background: "#F5F5F6", display: "flex", alignItems: "center", justifyContent: "center", overflow: "auto" }}>
          {kind === "pdf" ? (
            <iframe title={doc.documentName} src={doc.documentUrl} style={{ width: "100%", height: "100%", border: "none" }} />
          ) : kind === "image" ? (
            <img src={doc.documentUrl} alt={doc.documentName} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
          ) : (
            <div style={{ textAlign: "center", color: "#6B7280", padding: 30 }}>
              <Icon name="file" size={30} color="#C9CCD4" />
              <p style={{ fontSize: 13.5, fontWeight: 600, margin: "12px 0 4px" }}>No in-app preview for this file type</p>
              <p style={{ fontSize: 12.5, margin: "0 0 14px" }}>Download it to view in the right application.</p>
              <button
                type="button"
                onClick={() => onDownload(doc)}
                style={{ padding: "9px 16px", borderRadius: 10, border: "none", background: ACCENT, color: "#fff", fontSize: 12.5, fontWeight: 650, cursor: "pointer" }}
              >
                Download
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

function ClientDocumentsSection() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "superadmin";
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(null);      // folder currently being browsed
  const [files, setFiles] = useState([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [confirmState, setConfirmState] = useState(null);
  const [viewer, setViewer] = useState(null);
  const [upload] = useUpload();
  const fileRef = useRef(null);

  useEffect(() => { loadFolders(); }, []);

  async function loadFolders() {
    try {
      const data = await api.get("/api/document-folders");
      setFolders(data.folders || []);
    } catch (err) {
      toast.error("Failed to load folders: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function openFolder(folder) {
    setOpen(folder);
    setFilesLoading(true);
    try {
      const data = await api.get(`/api/documents?entityType=folder&entityId=${folder.id}`);
      setFiles(data.documents || []);
    } catch (err) {
      toast.error("Failed to load documents: " + err.message);
      setFiles([]);
    } finally {
      setFilesLoading(false);
    }
  }

  async function createFolder() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await api.post("/api/document-folders", { name: newName.trim() });
      toast.success("Folder created");
      setNewName("");
      loadFolders();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleUpload(e) {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file || !open) return;
    setUploading(true);
    try {
      const result = await upload({ file });
      if (result.error) throw new Error(result.error);
      await api.post("/api/documents", {
        entityType: "folder",
        entityId: open.id,
        documentType: "attachment",
        documentName: file.name,
        documentUrl: result.url,
        objectKey: result.objectKey,
      });
      toast.success("Document uploaded");
      openFolder(open);
      loadFolders();
    } catch (err) {
      toast.error("Upload failed: " + err.message);
    } finally {
      setUploading(false);
    }
  }

  function handleDeleteFile(doc) {
    setConfirmState({
      title: "Delete Document",
      message: `Delete "${doc.documentName}"? The file is removed permanently.`,
      confirmLabel: "Delete",
      danger: true,
      onConfirm: async () => {
        try {
          await api.delete(`/api/documents/${doc.id}`);
          toast.success("Document deleted");
          openFolder(open);
          loadFolders();
        } catch (err) {
          toast.error("Delete failed: " + err.message);
        }
      },
    });
  }

  function handleDeleteFolder(folder) {
    setConfirmState({
      title: "Delete Folder",
      message: `Delete the folder "${folder.name}"?`,
      confirmLabel: "Delete",
      danger: true,
      onConfirm: async () => {
        try {
          await api.delete(`/api/document-folders/${folder.id}`);
          toast.success("Folder deleted");
          loadFolders();
        } catch (err) {
          toast.error(err.message);
        }
      },
    });
  }

  async function handleDownload(doc) {
    try {
      const res = await fetch(doc.documentUrl);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = doc.documentName || "document";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);
    } catch {
      window.open(doc.documentUrl, "_blank", "noopener");
    }
  }

  const actBtn = {
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    width: 30, height: 30, borderRadius: 8, border: "1px solid #ECECEE",
    background: "#fff", cursor: "pointer", padding: 0,
  };

  const shown = folders.filter(f =>
    !search.trim() || f.name.toLowerCase().includes(search.trim().toLowerCase())
  );

  // ── Inside a folder ───────────────────────────────────────────────────────
  if (open) {
    return (
      <Card pad={24}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
          <button
            type="button"
            onClick={() => { setOpen(null); setFiles([]); }}
            style={{ ...actBtn, width: 32, height: 32 }}
            title="Back to folders"
          >
            <Icon name="arrowLeft" size={15} color="#6B7280" />
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ fontSize: 16, fontWeight: 750, color: "#0A0A0A", margin: 0 }}>{open.name}</h3>
            <p style={{ fontSize: 12.5, color: "#9CA3AF", margin: "2px 0 0" }}>
              {open.isClient ? "Client folder" : "Custom folder"} · {files.length} file{files.length === 1 ? "" : "s"}
            </p>
          </div>
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            style={{
              display: "inline-flex", alignItems: "center", gap: 7,
              padding: "10px 15px", borderRadius: 10, border: "none", height: 38,
              background: ACCENT, color: "#fff", fontSize: 12.5, fontWeight: 650,
              cursor: uploading ? "not-allowed" : "pointer", opacity: uploading ? 0.7 : 1,
            }}
          >
            <Icon name="plus" size={14} color="#fff" />
            {uploading ? "Uploading…" : "Upload document"}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp,.docx,.xlsx"
            style={{ display: "none" }}
            onChange={handleUpload}
          />
        </div>

        {filesLoading ? (
          <p style={{ fontSize: 13, color: "#9CA3AF", padding: "24px 0", textAlign: "center" }}>Loading…</p>
        ) : files.length === 0 ? (
          <div style={{ textAlign: "center", padding: "36px 0", color: "#9CA3AF" }}>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <Icon name="file" size={28} color="#D6D8DE" />
            </div>
            <p style={{ fontSize: 13.5, fontWeight: 600, margin: "10px 0 3px", color: "#6B7280" }}>No documents yet</p>
            <p style={{ fontSize: 12.5, margin: 0 }}>Agreements, POs, NDAs, brand assets — anything for this client.</p>
          </div>
        ) : (
          <div>
            {files.map((doc, i) => (
              <SettingRow
                key={doc.id}
                icon="file"
                title={doc.documentName}
                sub={new Date(doc.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                last={i === files.length - 1}
              >
                <div style={{ display: "flex", gap: 6 }}>
                  <button type="button" title="View" style={actBtn} onClick={() => setViewer(doc)}>
                    <Icon name="eye" size={14} color="#6B7280" />
                  </button>
                  <button type="button" title="Download" style={actBtn} onClick={() => handleDownload(doc)}>
                    <Icon name="download" size={14} color="#6B7280" />
                  </button>
                  {isAdmin && (
                    <button type="button" title="Delete" style={{ ...actBtn, borderColor: "#FCDADA" }} onClick={() => handleDeleteFile(doc)}>
                      <Icon name="x" size={14} color={ACCENT} />
                    </button>
                  )}
                </div>
              </SettingRow>
            ))}
          </div>
        )}

        <ConfirmModal state={confirmState} onClose={() => setConfirmState(null)} />
        <DocViewer doc={viewer} onClose={() => setViewer(null)} onDownload={handleDownload} />
      </Card>
    );
  }

  // ── Folder list ───────────────────────────────────────────────────────────
  return (
    <Card pad={24}>
      <PanelHeader
        title="Client documents"
        sub="Every client gets a folder automatically — add your own folders for anything else"
      />

      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 18, flexWrap: "wrap" }}>
        <input
          type="text"
          className="set-inp"
          style={{ ...inp, padding: "9px 12px", height: 38, margin: 0, flex: 1, minWidth: 200 }}
          placeholder="Search folders…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <input
          type="text"
          className="set-inp"
          style={{ ...inp, padding: "9px 12px", height: 38, margin: 0, width: 210 }}
          placeholder="New folder name"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") createFolder(); }}
        />
        <button
          type="button"
          disabled={creating || !newName.trim()}
          onClick={createFolder}
          style={{
            display: "inline-flex", alignItems: "center", gap: 7,
            padding: "10px 15px", borderRadius: 10, border: "none", height: 38,
            background: ACCENT, color: "#fff", fontSize: 12.5, fontWeight: 650,
            cursor: (creating || !newName.trim()) ? "not-allowed" : "pointer",
            opacity: (creating || !newName.trim()) ? 0.7 : 1,
          }}
        >
          <Icon name="plus" size={14} color="#fff" />
          {creating ? "Creating…" : "New folder"}
        </button>
      </div>

      {loading ? (
        <p style={{ fontSize: 13, color: "#9CA3AF", padding: "24px 0", textAlign: "center" }}>Loading…</p>
      ) : shown.length === 0 ? (
        <div style={{ textAlign: "center", padding: "36px 0", color: "#9CA3AF" }}>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <Icon name="folder" size={28} color="#D6D8DE" />
          </div>
          <p style={{ fontSize: 13.5, fontWeight: 600, margin: "10px 0 3px", color: "#6B7280" }}>
            {search.trim() ? "No folders match that search" : "No folders yet"}
          </p>
          <p style={{ fontSize: 12.5, margin: 0 }}>
            {search.trim() ? "Try a different name." : "Add a client and its folder appears here automatically."}
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: 12 }}>
          {shown.map(f => (
            <div
              key={f.id}
              role="button"
              tabIndex={0}
              onClick={() => openFolder(f)}
              onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openFolder(f); } }}
              style={{
                position: "relative", textAlign: "left", cursor: "pointer",
                border: "1px solid #EEEEF0", borderRadius: 14, padding: 14,
                background: "#fff", display: "flex", alignItems: "center", gap: 12,
              }}
            >
              <div style={{
                width: 40, height: 40, borderRadius: 11, flexShrink: 0,
                background: f.isClient ? "#FEF2F2" : "#F4F5F7",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Icon name="folder" size={18} color={f.isClient ? ACCENT : "#6B7280"} />
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{
                  fontSize: 13.5, fontWeight: 650, color: "#0A0A0A", margin: 0,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {f.name}
                </p>
                <p style={{ fontSize: 11.5, color: "#9CA3AF", margin: "2px 0 0" }}>
                  {f.isClient ? "Client" : "Custom"} · {f.fileCount} file{f.fileCount === 1 ? "" : "s"}
                </p>
              </div>
              {isAdmin && !f.isClient && (
                <button
                  type="button"
                  title="Delete folder"
                  onClick={(e) => { e.stopPropagation(); handleDeleteFolder(f); }}
                  style={{ ...actBtn, width: 26, height: 26, borderColor: "#FCDADA" }}
                >
                  <Icon name="x" size={12} color={ACCENT} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <ConfirmModal state={confirmState} onClose={() => setConfirmState(null)} />
    </Card>
  );
}

export default function SettingsPage() {
  const { user } = useAuth();
  const canEditCompany = user?.role === "superadmin";
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [settings, setSettings] = useState(null);
  const [section, setSection] = useState("company");
  const [upload] = useUpload();
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoDarkUploading, setLogoDarkUploading] = useState(false);
  const [signatureUploading, setSignatureUploading] = useState(false);
  const [stampUploading, setStampUploading] = useState(false);
  const [faviconUploading, setFaviconUploading] = useState(false);
  const [users, setUsers] = useState([]);
  // Local state for new API key inputs (never pre-filled with real values)
  const [newApiKeys, setNewApiKeys] = useState({ openrouterApiKey: "", nvidiaApiKey: "", unstructuredApiKey: "" });
  const [apiKeyError, setApiKeyError] = useState(null);

  useEffect(() => { loadSettings(); }, []);

  async function loadSettings() {
    try {
      const data = await api.get("/api/settings/company");
      setSettings(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (section === "team") {
      api.get("/api/admin/users").then(d => setUsers(d.users || d || [])).catch(() => { });
    }
  }, [section]);

  async function handleSave() {
    if (!canEditCompany) return;
    setSaving(true);
    setApiKeyError(null);
    try {
      // Build the payload; only include API keys that were actually typed in
      const payload = { ...settings };
      if (!newApiKeys.openrouterApiKey) delete payload.openrouterApiKey;
      else payload.openrouterApiKey = newApiKeys.openrouterApiKey;
      if (!newApiKeys.nvidiaApiKey) delete payload.nvidiaApiKey;
      else payload.nvidiaApiKey = newApiKeys.nvidiaApiKey;
      if (!newApiKeys.unstructuredApiKey) delete payload.unstructuredApiKey;
      else payload.unstructuredApiKey = newApiKeys.unstructuredApiKey;
      // Remove masked display fields — they are read-only
      delete payload.openrouterApiKeyMasked;
      delete payload.openrouterApiKeySet;
      delete payload.nvidiaApiKeyMasked;
      delete payload.nvidiaApiKeySet;
      delete payload.unstructuredApiKeyMasked;
      delete payload.unstructuredApiKeySet;

      await api.put("/api/settings/company", payload);
      // Clear the key inputs and refresh masked display
      setNewApiKeys({ openrouterApiKey: "", nvidiaApiKey: "", unstructuredApiKey: "" });
      const fresh = await api.get("/api/settings/company");
      setSettings(fresh);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      // Show API key errors prominently
      const msg = err.message || "Failed to save";
      if (msg.includes("API key") || msg.includes("model")) {
        setApiKeyError(msg);
      } else {
        toast.error("Failed to save: " + msg);
      }
    } finally {
      setSaving(false);
    }
  }

  function update(field, val) {
    setSettings(s => ({ ...s, [field]: val }));
  }

  async function saveNotifPref(key, val) {
    const next = { ...(settings.notificationPrefs || {}), [key]: val };
    setSettings(s => ({ ...s, notificationPrefs: next }));
    try { await api.put("/api/settings/company", { notificationPrefs: next }); }
    catch (err) { toast.error("Failed to save: " + err.message); }
  }

  async function handleLogoUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setLogoUploading(true);
    const result = await upload({ file });
    setLogoUploading(false);
    if (result.error) { toast.error("Upload failed: " + result.error); return; }
    update("logoUrl", result.url);
  }

  async function handleLogoDarkUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setLogoDarkUploading(true);
    const result = await upload({ file });
    setLogoDarkUploading(false);
    if (result.error) { toast.error("Upload failed: " + result.error); return; }
    update("logoDarkUrl", result.url);
  }

  async function handleSignatureUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setSignatureUploading(true);
    const result = await upload({ file });
    setSignatureUploading(false);
    if (result.error) { toast.error("Upload failed: " + result.error); return; }
    update("signatureUrl", result.url);
  }

  async function handleStampUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setStampUploading(true);
    const result = await upload({ file });
    setStampUploading(false);
    if (result.error) { toast.error("Upload failed: " + result.error); return; }
    update("stampUrl", result.url);
  }

  async function handleFaviconUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setFaviconUploading(true);
    const result = await upload({ file });
    setFaviconUploading(false);
    if (result.error) { toast.error("Upload failed: " + result.error); return; }
    update("faviconUrl", result.url);
  }

  function panel() {
    if (!settings) return null;

    switch (section) {
      case "company":
        return (
          <Card pad={24}>
            <fieldset disabled={!canEditCompany} style={{ border: 0, margin: 0, padding: 0, minInlineSize: 0 }}>
              <PanelHeader
                title="Company profile"
                sub="Legal details that appear on every invoice"
                onSave={handleSave}
                saving={saving}
                saved={saved}
                readOnly={!canEditCompany}
              />

              {/* Logo row */}
              <div style={{
                display: "flex", alignItems: "center", gap: 16,
                padding: "16px 0", marginBottom: 8, borderBottom: "1px solid #F2F2F4",
              }}>
                <div style={{
                  width: 64, height: 64, borderRadius: 16,
                  background: ACCENT + "12",
                  display: "flex", alignItems: "center",
                  justifyContent: "center", flexShrink: 0, overflow: "hidden",
                }}>
                  {settings.logoUrl
                    ? <img src={settings.logoUrl} alt="Logo" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
                    : <Logo tone="light" height={20} accent={ACCENT} />
                  }
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 14.5, fontWeight: 700, color: "#0A0A0A", margin: "0 0 2px" }}>
                    {settings.legalName || "Company logo"}
                  </p>
                  <p style={{ fontSize: 12.5, color: "#9CA3AF", margin: 0 }}>
                    Logo shown on invoices and the client portal
                  </p>
                </div>
                <label style={{ ...ghostBtn, cursor: "pointer" }}>
                  <Icon name="edit" size={14} />
                  {logoUploading ? "Uploading…" : "Replace"}
                  <input type="file" accept="image/*,image/svg+xml" style={{ display: "none" }} onChange={handleLogoUpload} />
                </label>
              </div>

              <p style={{ ...setSectLbl, marginTop: 20 }}>Business details</p>
              <div style={{ ...fieldGrid, marginBottom: 20 }}>
                <Field label="Brand / display name" full>
                  <input
                    value={settings.legalName || ""}
                    onChange={e => update("legalName", e.target.value)}
                    style={inp}
                    className="set-inp"
                    placeholder="Your Company Name"
                  />
                </Field>
                <Field label="Registered legal entity (invoice footer)" full>
                  <input
                    value={settings.registeredName || ""}
                    onChange={e => update("registeredName", e.target.value)}
                    style={inp}
                    className="set-inp"
                    placeholder="Acuity Studios Pvt Ltd"
                  />
                </Field>
                <Field label="GSTIN">
                  <input
                    value={settings.gstin || ""}
                    onChange={e => update("gstin", e.target.value)}
                    style={{ ...inp, fontFamily: "ui-monospace, monospace", textTransform: "uppercase" }}
                    className="set-inp"
                    placeholder="22AAAAA0000A1Z5"
                    maxLength={15}
                  />
                </Field>
                <Field label="PAN">
                  <input
                    value={settings.pan || ""}
                    onChange={e => update("pan", e.target.value)}
                    style={{ ...inp, fontFamily: "ui-monospace, monospace", textTransform: "uppercase" }}
                    className="set-inp"
                    placeholder="AAAAA0000A"
                    maxLength={10}
                  />
                </Field>
                <Field label="Email">
                  <input
                    type="email"
                    value={settings.email || ""}
                    onChange={e => update("email", e.target.value)}
                    style={inp}
                    className="set-inp"
                    placeholder="billing@company.in"
                  />
                </Field>
                <Field label="Phone">
                  <input
                    value={settings.phone || ""}
                    onChange={e => update("phone", e.target.value)}
                    style={inp}
                    className="set-inp"
                    placeholder="+91 98765 43210"
                  />
                </Field>
                <Field label="Website">
                  <input
                    value={settings.website || ""}
                    onChange={e => update("website", e.target.value)}
                    style={inp}
                    className="set-inp"
                    placeholder="https://company.in"
                  />
                </Field>
              </div>

              <p style={setSectLbl}>Registered address</p>
              <div style={fieldGrid}>
                <Field label="Address line 1" full>
                  <input
                    value={settings.addressLine1 || ""}
                    onChange={e => update("addressLine1", e.target.value)}
                    style={inp}
                    className="set-inp"
                  />
                </Field>
                <Field label="Address line 2" full>
                  <input
                    value={settings.addressLine2 || ""}
                    onChange={e => update("addressLine2", e.target.value)}
                    style={inp}
                    className="set-inp"
                  />
                </Field>
                <Field label="City">
                  <input
                    value={settings.city || ""}
                    onChange={e => update("city", e.target.value)}
                    style={inp}
                    className="set-inp"
                  />
                </Field>
                <Field label="State">
                  <CustomSelect
                    value={settings.stateCode || ""}
                    searchable
                    placeholder="Select state"
                    onChange={code => {
                      const st = INDIAN_STATES.find(s => s.code === code);
                      update("stateCode", code);
                      update("state", st?.name || "");
                    }}
                    options={[{ value: "", label: "Select state" }, ...INDIAN_STATES.map(s => ({ value: s.code, label: `${s.name} — ${s.code}` }))]}
                  />
                </Field>
                <Field label="Pincode">
                  <input
                    value={settings.pincode || ""}
                    onChange={e => update("pincode", e.target.value)}
                    style={{ ...inp, fontFamily: "ui-monospace, monospace" }}
                    className="set-inp"
                    maxLength={6}
                  />
                </Field>
                <Field label="Country">
                  <input
                    value={settings.country || "India"}
                    onChange={e => update("country", e.target.value)}
                    style={inp}
                    className="set-inp"
                  />
                </Field>
              </div>
            </fieldset>
          </Card>
        );

      case "branding": {
        const brandColor = settings.brandColor || ACCENT;
        const brandColorDark = settings.brandColorDark || "#991B1B";
        const appName = settings.appName || "MODUS ERP";
        const tagline = settings.tagline || "Open Source Studio Management & GST Invoicing";

        const PRESET_COLORS = [
          { name: "Modus Crimson", hex: "#E11D2C" },
          { name: "Royal Indigo", hex: "#4F46E5" },
          { name: "Cyber Sapphire", hex: "#0284C7" },
          { name: "Emerald Growth", hex: "#059669" },
          { name: "Imperial Violet", hex: "#7C3AED" },
          { name: "Sunset Amber", hex: "#D97706" },
          { name: "Obsidian Slate", hex: "#0F172A" },
        ];

        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Live Branding Preview */}
            <Card pad={24}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 750, color: "#0A0A0A", margin: "0 0 4px" }}>
                    Live White-Label Preview
                  </h3>
                  <p style={{ fontSize: 13, color: "#6B7280", margin: 0 }}>
                    Real-time preview of your brand identity across Light and Dark themes
                  </p>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving || !canEditCompany}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 7,
                      padding: "8px 18px",
                      borderRadius: 10,
                      border: "none",
                      background: brandColor,
                      color: "#fff",
                      fontSize: 13,
                      fontWeight: 650,
                      cursor: saving ? "not-allowed" : "pointer",
                      boxShadow: `0 4px 14px ${brandColor}40`,
                      opacity: saving ? 0.7 : 1,
                    }}
                  >
                    <Icon name={saved ? "check" : "save"} size={14} color="#fff" />
                    {saving ? "Saving…" : saved ? "Branding Saved!" : "Save Changes"}
                  </button>
                </div>
              </div>

              {/* Side-by-side Light / Dark Preview Panels */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
                {/* Light Mode Preview */}
                <div style={{
                  border: "1px solid #E5E7EB", borderRadius: 16, padding: 20,
                  background: "#FFFFFF", boxShadow: "0 2px 8px rgba(0,0,0,0.04)"
                }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, paddingBottom: 12, borderBottom: "1px solid #F3F4F6" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {settings.logoUrl ? (
                        <img src={settings.logoUrl} alt="Logo Light" style={{ height: 26, maxWidth: 140, objectFit: "contain" }} />
                      ) : (
                        <Logo tone="light" height={24} />
                      )}
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 6, background: "#F3F4F6", color: "#4B5563" }}>
                      Light Theme
                    </span>
                  </div>
                  <h4 style={{ fontSize: 14, fontWeight: 700, color: "#111827", margin: "0 0 4px" }}>{appName}</h4>
                  <p style={{ fontSize: 12, color: "#6B7280", margin: "0 0 16px" }}>{tagline}</p>
                  <div style={{ display: "flex", gap: 8 }}>
                    <div style={{ padding: "7px 14px", borderRadius: 8, background: brandColor, color: "#fff", fontSize: 12, fontWeight: 650 }}>
                      Primary Button
                    </div>
                    <div style={{ padding: "7px 14px", borderRadius: 8, background: `${brandColor}18`, color: brandColor, fontSize: 12, fontWeight: 650 }}>
                      Badge / Chip
                    </div>
                  </div>
                </div>

                {/* Dark Mode Preview */}
                <div style={{
                  border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 20,
                  background: "#18181B", color: "#fff", boxShadow: "0 8px 24px rgba(0,0,0,0.3)"
                }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, paddingBottom: 12, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {settings.logoDarkUrl ? (
                        <img src={settings.logoDarkUrl} alt="Logo Dark" style={{ height: 26, maxWidth: 140, objectFit: "contain" }} />
                      ) : (
                        <Logo tone="dark" height={24} />
                      )}
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 6, background: "rgba(255,255,255,0.1)", color: "#E5E7EB" }}>
                      Dark Sidebar
                    </span>
                  </div>
                  <h4 style={{ fontSize: 14, fontWeight: 700, color: "#F9FAFB", margin: "0 0 4px" }}>{appName}</h4>
                  <p style={{ fontSize: 12, color: "#9CA3AF", margin: "0 0 16px" }}>{tagline}</p>
                  <div style={{ display: "flex", gap: 8 }}>
                    <div style={{ padding: "7px 14px", borderRadius: 8, background: brandColor, color: "#fff", fontSize: 12, fontWeight: 650, boxShadow: `0 4px 14px ${brandColor}40` }}>
                      Action Button
                    </div>
                    <div style={{ padding: "7px 14px", borderRadius: 8, background: "rgba(255,255,255,0.08)", color: "#D1D5DB", fontSize: 12, fontWeight: 550 }}>
                      Secondary
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Platform Identity */}
            <Card pad={24}>
              <PanelHeader
                title="Workspace & Platform Identity"
                sub="Configure custom company naming displayed on web, documents, and notifications"
                readOnly={!canEditCompany}
              />
              <div style={fieldGrid}>
                <div>
                  <label style={{ display: "block", fontSize: 12.5, fontWeight: 650, color: "#374151", marginBottom: 6 }}>
                    Application / Workspace Name
                  </label>
                  <input
                    type="text"
                    className="set-inp"
                    style={inp}
                    placeholder="e.g. MODUS ERP or Acme Creative Studio"
                    value={settings.appName || ""}
                    onChange={e => update("appName", e.target.value)}
                  />
                  <p style={{ fontSize: 11, color: "#9CA3AF", margin: "5px 0 0" }}>
                    Shown in header, sidebar title, and browser window tab
                  </p>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12.5, fontWeight: 650, color: "#374151", marginBottom: 6 }}>
                    Workspace Tagline
                  </label>
                  <input
                    type="text"
                    className="set-inp"
                    style={inp}
                    placeholder="e.g. Finance, Invoicing & GST Workspace"
                    value={settings.tagline || ""}
                    onChange={e => update("tagline", e.target.value)}
                  />
                  <p style={{ fontSize: 11, color: "#9CA3AF", margin: "5px 0 0" }}>
                    Shown on authentication screens and outgoing communications
                  </p>
                </div>
              </div>
            </Card>

            {/* Brand Colors */}
            <Card pad={24}>
              <PanelHeader
                title="Theme & Brand Colors"
                sub="Select a curated enterprise palette or customize exact hex values to match your brand guide"
                readOnly={!canEditCompany}
              />

              {/* Preset Palettes */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontSize: 12.5, fontWeight: 650, color: "#374151", marginBottom: 10 }}>
                  Curated Color Presets
                </label>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {PRESET_COLORS.map(p => {
                    const isSelected = (settings.brandColor || ACCENT).toLowerCase() === p.hex.toLowerCase();
                    return (
                      <button
                        key={p.hex}
                        type="button"
                        onClick={() => {
                          update("brandColor", p.hex);
                          document.documentElement.style.setProperty("--modus-accent", p.hex);
                        }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          padding: "8px 14px",
                          borderRadius: 10,
                          border: isSelected ? `2px solid ${p.hex}` : "1px solid #E5E7EB",
                          background: isSelected ? `${p.hex}14` : "#fff",
                          cursor: "pointer",
                          font: "inherit",
                          fontSize: 12.5,
                          fontWeight: isSelected ? 700 : 550,
                          color: isSelected ? p.hex : "#374151",
                          transition: "all .15s",
                        }}
                      >
                        <span style={{ width: 14, height: 14, borderRadius: "50%", background: p.hex, display: "inline-block" }} />
                        <span>{p.name}</span>
                        {isSelected && <Icon name="check" size={13} color={p.hex} />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Color Pickers */}
              <div style={fieldGrid}>
                <div>
                  <label style={{ display: "block", fontSize: 12.5, fontWeight: 650, color: "#374151", marginBottom: 6 }}>
                    Primary Accent Color (Hex)
                  </label>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <input
                      type="color"
                      value={settings.brandColor || ACCENT}
                      onChange={e => {
                        update("brandColor", e.target.value);
                        document.documentElement.style.setProperty("--modus-accent", e.target.value);
                      }}
                      style={{
                        width: 44,
                        height: 38,
                        borderRadius: 8,
                        border: "1px solid #D1D5DB",
                        cursor: "pointer",
                        padding: 2,
                      }}
                    />
                    <input
                      type="text"
                      className="set-inp"
                      style={{ ...inp, flex: 1, fontFamily: "ui-monospace, monospace" }}
                      placeholder="#E11D2C"
                      value={settings.brandColor || ""}
                      onChange={e => {
                        update("brandColor", e.target.value);
                        if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) {
                          document.documentElement.style.setProperty("--modus-accent", e.target.value);
                        }
                      }}
                    />
                  </div>
                  <p style={{ fontSize: 11, color: "#9CA3AF", margin: "5px 0 0" }}>
                    Used for primary action buttons, active navigation indicators, and highlights
                  </p>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12.5, fontWeight: 650, color: "#374151", marginBottom: 6 }}>
                    Dark / Hover Accent Color (Hex)
                  </label>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <input
                      type="color"
                      value={settings.brandColorDark || "#991B1B"}
                      onChange={e => update("brandColorDark", e.target.value)}
                      style={{
                        width: 44,
                        height: 38,
                        borderRadius: 8,
                        border: "1px solid #D1D5DB",
                        cursor: "pointer",
                        padding: 2,
                      }}
                    />
                    <input
                      type="text"
                      className="set-inp"
                      style={{ ...inp, flex: 1, fontFamily: "ui-monospace, monospace" }}
                      placeholder="#991B1B"
                      value={settings.brandColorDark || ""}
                      onChange={e => update("brandColorDark", e.target.value)}
                    />
                  </div>
                  <p style={{ fontSize: 11, color: "#9CA3AF", margin: "5px 0 0" }}>
                    Used for button active/hover states and gradients
                  </p>
                </div>
              </div>
            </Card>

            {/* Logo Suite & Asset Upload */}
            <Card pad={24}>
              <PanelHeader
                title="Brand Asset Uploads"
                sub="Upload custom company logos for invoices, light document templates, and dark navigation bars"
                readOnly={!canEditCompany}
              />

              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                {/* 1. Primary Light Logo */}
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: 16, borderRadius: 14, border: "1px solid #E5E7EB", background: "#F9FAFB",
                  flexWrap: "wrap", gap: 14,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <div style={{
                      width: 90, height: 50, borderRadius: 10, background: "#FFFFFF",
                      border: "1px solid #E5E7EB", display: "flex", alignItems: "center",
                      justifyContent: "center", overflow: "hidden", padding: 6,
                    }}>
                      {settings.logoUrl ? (
                        <img src={settings.logoUrl} alt="Primary Logo" style={{ maxHeight: "100%", maxWidth: "100%", objectFit: "contain" }} />
                      ) : (
                        <Logo tone="light" height={20} />
                      )}
                    </div>
                    <div>
                      <p style={{ fontSize: 13.5, fontWeight: 700, color: "#111827", margin: "0 0 2px" }}>
                        Primary Light Logo
                      </p>
                      <p style={{ fontSize: 12, color: "#6B7280", margin: 0 }}>
                        {settings.logoUrl ? "Custom logo active" : "Using official MODUS logo suite (black on light)"} · Invoices &amp; Light headers
                      </p>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <label style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      padding: "8px 14px", borderRadius: 9, border: "1px solid #D1D5DB",
                      background: "#fff", color: "#374151", fontSize: 12.5, fontWeight: 600,
                      cursor: logoUploading ? "not-allowed" : "pointer",
                    }}>
                      <Icon name="upload" size={13} color="#4B5563" />
                      {logoUploading ? "Uploading…" : "Upload New"}
                      <input type="file" accept="image/*,image/svg+xml" style={{ display: "none" }} onChange={handleLogoUpload} disabled={logoUploading || !canEditCompany} />
                    </label>
                    {settings.logoUrl && (
                      <button
                        type="button"
                        onClick={() => update("logoUrl", null)}
                        disabled={!canEditCompany}
                        style={{
                          padding: "8px 12px", borderRadius: 9, border: "1px solid #FCA5A5",
                          background: "#FEF2F2", color: "#DC2626", fontSize: 12.5, fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        Reset to Default
                      </button>
                    )}
                  </div>
                </div>

                {/* 2. Dark Mode Logo */}
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: 16, borderRadius: 14, border: "1px solid #27272A", background: "#18181B",
                  flexWrap: "wrap", gap: 14, color: "#fff",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <div style={{
                      width: 90, height: 50, borderRadius: 10, background: "#09090B",
                      border: "1px solid rgba(255,255,255,0.12)", display: "flex", alignItems: "center",
                      justifyContent: "center", overflow: "hidden", padding: 6,
                    }}>
                      {settings.logoDarkUrl ? (
                        <img src={settings.logoDarkUrl} alt="Dark Logo" style={{ maxHeight: "100%", maxWidth: "100%", objectFit: "contain" }} />
                      ) : (
                        <Logo tone="dark" height={20} />
                      )}
                    </div>
                    <div>
                      <p style={{ fontSize: 13.5, fontWeight: 700, color: "#F9FAFB", margin: "0 0 2px" }}>
                        Dark Theme Logo
                      </p>
                      <p style={{ fontSize: 12, color: "#9CA3AF", margin: 0 }}>
                        {settings.logoDarkUrl ? "Custom dark logo active" : "Using official MODUS logo suite (white on dark)"} · App Sidebar &amp; Dark overlays
                      </p>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <label style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      padding: "8px 14px", borderRadius: 9, border: "1px solid rgba(255,255,255,0.2)",
                      background: "rgba(255,255,255,0.1)", color: "#fff", fontSize: 12.5, fontWeight: 600,
                      cursor: logoDarkUploading ? "not-allowed" : "pointer",
                    }}>
                      <Icon name="upload" size={13} color="#fff" />
                      {logoDarkUploading ? "Uploading…" : "Upload Dark"}
                      <input type="file" accept="image/*,image/svg+xml" style={{ display: "none" }} onChange={handleLogoDarkUpload} disabled={logoDarkUploading || !canEditCompany} />
                    </label>
                    {settings.logoDarkUrl && (
                      <button
                        type="button"
                        onClick={() => update("logoDarkUrl", null)}
                        disabled={!canEditCompany}
                        style={{
                          padding: "8px 12px", borderRadius: 9, border: "1px solid rgba(239,68,68,0.4)",
                          background: "rgba(239,68,68,0.15)", color: "#FCA5A5", fontSize: 12.5, fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        Reset to Default
                      </button>
                    )}
                  </div>
                </div>

                {/* 3. Favicon */}
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: 16, borderRadius: 14, border: "1px solid #E5E7EB", background: "#F9FAFB",
                  flexWrap: "wrap", gap: 14,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <div style={{
                      width: 50, height: 50, borderRadius: 10, background: "#FFFFFF",
                      border: "1px solid #E5E7EB", display: "flex", alignItems: "center",
                      justifyContent: "center", overflow: "hidden", padding: 6,
                    }}>
                      {settings.faviconUrl ? (
                        <img src={settings.faviconUrl} alt="Favicon" style={{ maxHeight: "100%", maxWidth: "100%", objectFit: "contain" }} />
                      ) : (
                        <img src="/Assets/logos/favicon.webp" alt="Favicon" style={{ height: 26, width: 26, objectFit: "contain" }} />
                      )}
                    </div>
                    <div>
                      <p style={{ fontSize: 13.5, fontWeight: 700, color: "#111827", margin: "0 0 2px" }}>
                        Browser Favicon
                      </p>
                      <p style={{ fontSize: 12, color: "#6B7280", margin: 0 }}>
                        {settings.faviconUrl ? "Custom favicon active" : "Using MODUS brand icon"} · Displayed on browser tabs and bookmark shortcuts
                      </p>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <label style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      padding: "8px 14px", borderRadius: 9, border: "1px solid #D1D5DB",
                      background: "#fff", color: "#374151", fontSize: 12.5, fontWeight: 600,
                      cursor: faviconUploading ? "not-allowed" : "pointer",
                    }}>
                      <Icon name="upload" size={13} color="#4B5563" />
                      {faviconUploading ? "Uploading…" : "Upload Favicon"}
                      <input type="file" accept="image/x-icon,image/png,image/webp,image/svg+xml" style={{ display: "none" }} onChange={handleFaviconUpload} disabled={faviconUploading || !canEditCompany} />
                    </label>
                    {settings.faviconUrl && (
                      <button
                        type="button"
                        onClick={() => update("faviconUrl", null)}
                        disabled={!canEditCompany}
                        style={{
                          padding: "8px 12px", borderRadius: 9, border: "1px solid #FCA5A5",
                          background: "#FEF2F2", color: "#DC2626", fontSize: 12.5, fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        Reset to Default
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          </div>
        );
      }

      case "invoicing":
        return (
          <Card pad={24}>
            <fieldset disabled={!canEditCompany} style={{ border: 0, margin: 0, padding: 0, minInlineSize: 0 }}>
              <PanelHeader
                title="Invoicing & GST"
                sub="Numbering, tax defaults and payment terms"
                onSave={handleSave}
                saving={saving}
                saved={saved}
                readOnly={!canEditCompany}
              />

              <p style={setSectLbl}>Invoice numbering</p>
              {(() => {
                const fmt = settings.invoiceFormat || "fy";
                const px = settings.invoicePrefix || "HI";
                const now = new Date();
                const fyStart = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
                const fyStr = `${fyStart}-${String((fyStart + 1) % 100).padStart(2, "0")}`;
                const ymStr = `${String(now.getFullYear() % 100).padStart(2, "0")}${String(now.getMonth() + 1).padStart(2, "0")}`;
                const preview = fmt === "calendar" ? `${px}-${now.getFullYear()}-0001`
                  : fmt === "plain" ? `${px}-00001`
                    : fmt === "ym" ? `${px}-${ymStr}-001`
                      : `${px}/${fyStr}/001`;
                return (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ ...fieldGrid, marginBottom: 12 }}>
                      <Field label="Prefix">
                        <input
                          value={settings.invoicePrefix || ""}
                          onChange={e => update("invoicePrefix", e.target.value)}
                          style={{ ...inp, fontFamily: "ui-monospace, monospace" }}
                          className="set-inp"
                          placeholder="HI"
                          maxLength={6}
                        />
                      </Field>
                      <Field label="Numbering format">
                        <CustomSelect
                          value={fmt}
                          onChange={v => update("invoiceFormat", v)}
                          options={[
                            { value: "fy", label: "Financial year — HI/2025-26/001" },
                            { value: "calendar", label: "Calendar year — HI-2025-0001" },
                            { value: "ym", label: "Year-Month — HI-2507-001" },
                            { value: "plain", label: "Continuous — HI-00001" },
                          ]}
                        />
                      </Field>
                    </div>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 10, background: "#FAFAFA", border: "1px solid #EEE", borderRadius: 8, padding: "8px 14px" }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: ".06em" }}>Next invoice</span>
                      <span style={{ fontSize: 14, fontWeight: 700, color: "#0A0A0A", fontFamily: "ui-monospace, monospace" }}>{preview}</span>
                      {fmt !== "plain" && <span style={{ fontSize: 11, color: "#9CA3AF" }}>· resets each {fmt === "fy" ? "April" : fmt === "ym" ? "month" : "January"}</span>}
                    </div>
                  </div>
                );
              })()}

              <p style={setSectLbl}>Defaults</p>
              <div style={{ marginBottom: 8 }}>
                <SettingRow icon="clock" title="Default payment terms" sub="Due date offset on new invoices">
                  <Chip tone="#6B7280" bg="#F3F4F6">Net 30</Chip>
                </SettingRow>
                <SettingRow icon="sparkle" title="Auto-reminders" sub="Email clients 3 days before due date" last>
                  <Toggle on={true} />
                </SettingRow>
              </div>

              <p style={{ ...setSectLbl, marginTop: 20 }}>Terms & notes</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <Field label="Default terms & conditions" full>
                  <textarea
                    value={settings.defaultTerms || ""}
                    onChange={e => update("defaultTerms", e.target.value)}
                    rows={4}
                    style={{ ...inp, resize: "vertical", lineHeight: 1.6 }}
                    className="set-inp"
                    placeholder="Payment is due within 30 days from date of invoice…"
                  />
                </Field>
                <Field label="Default notes" full>
                  <textarea
                    value={settings.defaultNotes || ""}
                    onChange={e => update("defaultNotes", e.target.value)}
                    rows={3}
                    style={{ ...inp, resize: "vertical", lineHeight: 1.6 }}
                    className="set-inp"
                    placeholder="Thank you for your business…"
                  />
                </Field>
                <Field label="Default declaration" full>
                  <textarea
                    value={settings.defaultDeclaration || ""}
                    onChange={e => update("defaultDeclaration", e.target.value)}
                    rows={3}
                    style={{ ...inp, resize: "vertical", lineHeight: 1.6 }}
                    className="set-inp"
                    placeholder="We declare that this invoice shows the actual price…"
                  />
                </Field>
              </div>

              <p style={{ ...setSectLbl, marginTop: 20 }}>GST compliance</p>
              <div style={{ ...fieldGrid, marginBottom: 8 }}>
                <Field label="LUT Number" hint="Letter of Undertaking for zero-rated exports without IGST">
                  <input
                    value={settings.lutNumber || ""}
                    onChange={e => update("lutNumber", e.target.value)}
                    style={{ ...inp, fontFamily: "ui-monospace, monospace" }}
                    className="set-inp"
                    placeholder="AD290424001234T"
                  />
                </Field>
                <Field label="E-invoice applicable from">
                  <DatePickerInput
                    value={settings.einvoiceApplicableFrom || ""}
                    onChange={v => update("einvoiceApplicableFrom", v)}
                  />
                </Field>
                <Field label="Books locked up to (filed period)">
                  <DatePickerInput
                    value={settings.booksLockedUntil || ""}
                    onChange={v => update("booksLockedUntil", v)}
                  />
                </Field>
              </div>
              <p style={{ fontSize: 11.5, color: "#9CA3AF", margin: "-4px 0 10px" }}>
                Invoices &amp; bills dated on/before this date can't be edited or deleted (correct via credit/debit note). Set it after filing each GST period.
              </p>
              <div style={{ marginBottom: 8 }}>
                <SettingRow icon="receipt" title="Turnover above ₹5 crore" sub="Enables e-invoicing and related compliance features" last>
                  <Toggle on={!!settings.turnoverAbove5cr} onChange={v => update("turnoverAbove5cr", v)} />
                </SettingRow>
              </div>

              <Accordion type="multiple" defaultValue={["bank", "branding"]} style={{ marginTop: 20 }}>
                <AccordionItem value="bank" className="border-0" style={{ borderTop: "1px solid #F2F2F4" }}>
                  <AccordionTrigger className="hover:no-underline py-3">
                    <span style={{ ...setSectLbl, margin: 0 }}>Bank & payment</span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div style={{ ...fieldGrid, paddingBottom: 8 }}>
                      <Field label="Bank name" full>
                        <input
                          value={settings.bankName || ""}
                          onChange={e => update("bankName", e.target.value)}
                          style={inp}
                          className="set-inp"
                          placeholder="HDFC Bank"
                        />
                      </Field>
                      <Field label="Account holder name">
                        <input
                          value={settings.accountHolderName || ""}
                          onChange={e => update("accountHolderName", e.target.value)}
                          style={inp}
                          className="set-inp"
                        />
                      </Field>
                      <Field label="Account number">
                        <input
                          value={settings.accountNumber || ""}
                          onChange={e => update("accountNumber", e.target.value)}
                          style={{ ...inp, fontFamily: "ui-monospace, monospace" }}
                          className="set-inp"
                        />
                      </Field>
                      <Field label="IFSC code">
                        <input
                          value={settings.ifsc || ""}
                          onChange={e => update("ifsc", e.target.value)}
                          style={{ ...inp, fontFamily: "ui-monospace, monospace", textTransform: "uppercase" }}
                          className="set-inp"
                          placeholder="HDFC0000001"
                        />
                      </Field>
                      <Field label="UPI ID" full>
                        <input
                          value={settings.upiId || ""}
                          onChange={e => update("upiId", e.target.value)}
                          style={{ ...inp, fontFamily: "ui-monospace, monospace" }}
                          className="set-inp"
                          placeholder="payments@company"
                        />
                      </Field>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="branding" className="border-0" style={{ borderTop: "1px solid #F2F2F4", borderBottom: "none" }}>
                  <AccordionTrigger className="hover:no-underline py-3">
                    <span style={{ ...setSectLbl, margin: 0 }}>Branding assets</span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingBottom: 8 }}>
                      <Field label="Dark background logo URL (for dark-header templates)" full>
                        <div style={{ display: "flex", gap: 8 }}>
                          <input
                            value={settings.logoDarkUrl || ""}
                            onChange={e => update("logoDarkUrl", e.target.value)}
                            style={{ ...inp, flex: 1 }}
                            className="set-inp"
                            placeholder="https://…"
                          />
                          <label style={{ ...ghostBtn, cursor: "pointer", flexShrink: 0 }}>
                            {logoDarkUploading ? "Uploading…" : "Upload"}
                            <input type="file" accept="image/*,image/svg+xml" style={{ display: "none" }} onChange={handleLogoDarkUpload} />
                          </label>
                        </div>
                      </Field>
                      <Field label="Signature image" full>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <input
                            value={settings.signatureUrl || ""}
                            onChange={e => update("signatureUrl", e.target.value)}
                            style={{ ...inp, flex: 1 }}
                            className="set-inp"
                            placeholder="https://… or upload"
                          />
                          <label style={{ ...ghostBtn, cursor: "pointer", flexShrink: 0 }}>
                            {signatureUploading ? "Uploading…" : "Upload"}
                            <input type="file" accept="image/png,image/jpeg,image/svg+xml,image/*" style={{ display: "none" }} onChange={handleSignatureUpload} />
                          </label>
                        </div>
                        {settings.signatureUrl && (
                          <img src={settings.signatureUrl} alt="Signature preview" style={{ height: 46, marginTop: 8, display: "block", objectFit: "contain" }} />
                        )}
                      </Field>
                      <Field label="Company stamp" full>
                        <div style={{ display: "flex", gap: 8 }}>
                          <input
                            value={settings.stampUrl || ""}
                            onChange={e => update("stampUrl", e.target.value)}
                            style={{ ...inp, flex: 1 }}
                            className="set-inp"
                            placeholder="https://…"
                          />
                          <label style={{ ...ghostBtn, cursor: "pointer", flexShrink: 0 }}>
                            {stampUploading ? "Uploading…" : "Upload"}
                            <input type="file" accept="image/png,image/jpeg,image/svg+xml,image/*" style={{ display: "none" }} onChange={handleStampUpload} />
                          </label>
                        </div>
                        {settings.stampUrl && (
                          <img src={settings.stampUrl} alt="Stamp preview" style={{ height: 60, marginTop: 8, display: "block", objectFit: "contain" }} />
                        )}
                      </Field>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </fieldset>
          </Card>
        );

      case "team":
        return (
          <Card pad={24}>
            <PanelHeader title="Team & roles" sub="People with access to this workspace" />
            <div style={{ marginBottom: 18 }}>
              <a
                href="/admin/users"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 7,
                  padding: "9px 15px", borderRadius: 10, border: `1px solid ${ACCENT}`,
                  background: ACCENT, color: "#fff", fontSize: 12.5, fontWeight: 650,
                  textDecoration: "none",
                }}
              >
                <Icon name="users" size={15} />
                Open team management
              </a>
            </div>
            {users.length === 0 ? (
              <p style={{ fontSize: 13, color: "#9CA3AF", textAlign: "center", padding: "32px 0" }}>
                Loading members…
              </p>
            ) : (
              <div>
                {users.map((u, i) => {
                  const roleLabel = u.role === "superadmin" ? "Owner"
                    : u.role === "admin" ? "Finance admin"
                      : "Member";
                  const tone = u.role === "superadmin" ? ACCENT
                    : u.role === "admin" ? "#2563EB"
                      : "#6B7280";
                  const bg = u.role === "superadmin" ? ACCENT + "14"
                    : u.role === "admin" ? "#EEF2FF"
                      : "#F3F4F6";
                  const isLast = i === users.length - 1;
                  return (
                    <div
                      key={u.id}
                      style={{
                        display: "flex", alignItems: "center", gap: 13,
                        padding: "13px 0",
                        borderBottom: isLast ? "none" : "1px solid #F2F2F4",
                      }}
                    >
                      <Avatar name={u.fullName || u.name} size={38} radius={12} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13.5, fontWeight: 650, color: "#0A0A0A", margin: "0 0 1px" }}>
                          {u.fullName || u.name}
                        </p>
                        <p style={{ fontSize: 12, color: "#9CA3AF", margin: 0 }}>{u.email}</p>
                      </div>
                      <Chip tone={tone} bg={bg}>{roleLabel}</Chip>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        );

      case "notifications": {
        const np = { paymentReceived: true, invoiceOverdue: true, invoiceViewed: false, billDueSoon: true, gstReminders: true, weeklySummary: false, ...(settings.notificationPrefs || {}) };
        return (
          <Card pad={24}>
            <PanelHeader title="Notifications" sub="Choose what MODUS emails you about" />
            <p style={setSectLbl}>Receivables</p>
            <div style={{ marginBottom: 12 }}>
              <SettingRow icon="check" title="Payment received" sub="When a client settles an invoice">
                <Toggle on={np.paymentReceived} onChange={(v) => saveNotifPref("paymentReceived", v)} />
              </SettingRow>
              <SettingRow icon="alert" title="Invoice overdue" sub="When an invoice passes its due date">
                <Toggle on={np.invoiceOverdue} onChange={(v) => saveNotifPref("invoiceOverdue", v)} />
              </SettingRow>
              <SettingRow icon="eye" title="Invoice viewed" sub="When a client opens an invoice — coming soon (needs open-tracking)" last>
                <Toggle on={np.invoiceViewed} onChange={(v) => saveNotifPref("invoiceViewed", v)} />
              </SettingRow>
            </div>
            <p style={setSectLbl}>Payables & reports</p>
            <div>
              <SettingRow icon="clock" title="Bill due soon" sub="3 days before a vendor bill is due">
                <Toggle on={np.billDueSoon} onChange={(v) => saveNotifPref("billDueSoon", v)} />
              </SettingRow>
              <SettingRow icon="receipt" title="GST filing reminders" sub="Monthly GSTR-1 and GSTR-3B deadlines">
                <Toggle on={np.gstReminders} onChange={(v) => saveNotifPref("gstReminders", v)} />
              </SettingRow>
              <SettingRow icon="chart" title="Weekly summary" sub="Every Monday at 9:00 AM" last>
                <Toggle on={np.weeklySummary} onChange={(v) => saveNotifPref("weeklySummary", v)} />
              </SettingRow>
            </div>
          </Card>
        );
      }

      case "documents":
        return <DocumentsSection />;
      case "clientdocs":
        return <ClientDocumentsSection />;

      case "api":
        if (user?.role !== "superadmin") return null;
        return (
          <Card pad={24}>
            <PanelHeader
              title="API Integrations"
              sub="Manage third-party API keys and models. Keys are masked for security."
              onSave={handleSave}
              saving={saving}
              saved={saved}
            />

            {apiKeyError && (
              <div style={{
                padding: "10px 14px", borderRadius: 10, marginBottom: 18,
                background: "#FEF2F2", border: "1px solid #FECACA",
                color: "#991B1B", fontSize: 13, fontWeight: 550,
                display: "flex", alignItems: "flex-start", gap: 8,
              }}>
                <Icon name="alert" size={15} color="#DC2626" style={{ flexShrink: 0, marginTop: 1 }} />
                {apiKeyError}
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

              {/* ── OpenRouter ── */}
              <div style={{ border: "1px solid #F2F2F4", borderRadius: 12, padding: 18 }}>
                <p style={{ fontSize: 13.5, fontWeight: 700, color: "#0A0A0A", margin: "0 0 14px" }}>OpenRouter</p>
                <div style={fieldGrid}>
                  <div>
                    <label style={{ display: "block", fontSize: 12.5, fontWeight: 650, color: "#374151", marginBottom: 6 }}>API Key</label>
                    {settings.openrouterApiKeySet && (
                      <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 6, fontFamily: "ui-monospace, monospace" }}>
                        Active: {settings.openrouterApiKeyMasked}
                      </div>
                    )}
                    <input
                      type="password"
                      className="set-inp"
                      style={inp}
                      placeholder={settings.openrouterApiKeySet ? "Paste to replace current key" : "sk-or-v1-..."}
                      value={newApiKeys.openrouterApiKey}
                      onChange={e => { setApiKeyError(null); setNewApiKeys(k => ({ ...k, openrouterApiKey: e.target.value })); }}
                      autoComplete="new-password"
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12.5, fontWeight: 650, color: "#374151", marginBottom: 6 }}>Model</label>
                    <input
                      type="text"
                      className="set-inp"
                      style={inp}
                      placeholder="google/gemini-2.5-flash"
                      value={settings.openrouterModel || ""}
                      onChange={e => update("openrouterModel", e.target.value)}
                    />
                    <p style={{ fontSize: 11, color: "#9CA3AF", margin: "5px 0 0" }}>Paste the exact model ID from openrouter.ai/models</p>
                  </div>
                </div>
              </div>

              {/* ── NVIDIA ── */}
              <div style={{ border: "1px solid #F2F2F4", borderRadius: 12, padding: 18 }}>
                <p style={{ fontSize: 13.5, fontWeight: 700, color: "#0A0A0A", margin: "0 0 14px" }}>NVIDIA NIM</p>
                <div style={fieldGrid}>
                  <div>
                    <label style={{ display: "block", fontSize: 12.5, fontWeight: 650, color: "#374151", marginBottom: 6 }}>API Key</label>
                    {settings.nvidiaApiKeySet && (
                      <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 6, fontFamily: "ui-monospace, monospace" }}>
                        Active: {settings.nvidiaApiKeyMasked}
                      </div>
                    )}
                    <input
                      type="password"
                      className="set-inp"
                      style={inp}
                      placeholder={settings.nvidiaApiKeySet ? "Paste to replace current key" : "nvapi-..."}
                      value={newApiKeys.nvidiaApiKey}
                      onChange={e => { setApiKeyError(null); setNewApiKeys(k => ({ ...k, nvidiaApiKey: e.target.value })); }}
                      autoComplete="new-password"
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12.5, fontWeight: 650, color: "#374151", marginBottom: 6 }}>Model</label>
                    <input
                      type="text"
                      className="set-inp"
                      style={inp}
                      placeholder="meta/llama-3.1-405b-instruct"
                      value={settings.nvidiaModel || ""}
                      onChange={e => update("nvidiaModel", e.target.value)}
                    />
                    <p style={{ fontSize: 11, color: "#9CA3AF", margin: "5px 0 0" }}>Paste the exact model ID from build.nvidia.com</p>
                  </div>
                </div>
              </div>

              {/* ── Unstructured ── */}
              <div style={{ border: "1px solid #F2F2F4", borderRadius: 12, padding: 18 }}>
                <p style={{ fontSize: 13.5, fontWeight: 700, color: "#0A0A0A", margin: "0 0 14px" }}>Unstructured</p>
                <div>
                  <label style={{ display: "block", fontSize: 12.5, fontWeight: 650, color: "#374151", marginBottom: 6 }}>API Key</label>
                  {settings.unstructuredApiKeySet && (
                    <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 6, fontFamily: "ui-monospace, monospace" }}>
                      Active: {settings.unstructuredApiKeyMasked}
                    </div>
                  )}
                  <input
                    type="password"
                    className="set-inp"
                    style={{ ...inp, maxWidth: 460 }}
                    placeholder={settings.unstructuredApiKeySet ? "Paste to replace current key" : "API Key"}
                    value={newApiKeys.unstructuredApiKey}
                    onChange={e => { setApiKeyError(null); setNewApiKeys(k => ({ ...k, unstructuredApiKey: e.target.value })); }}
                    autoComplete="new-password"
                  />
                </div>
              </div>

            </div>
          </Card>
        );

      default:
        return null;
    }
  }

  if (loading) {
    return (
      <AppShell>
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 300 }}>
          <div style={{
            width: 36, height: 36, border: "3px solid " + ACCENT,
            borderTopColor: "transparent", borderRadius: "50%",
            animation: "spin 0.7s linear infinite",
          }} />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .set-inp:focus { border-color: ${ACCENT} !important; box-shadow: 0 0 0 3px ${ACCENT}18 !important; outline: none !important; }
      `}</style>

      <div style={{
        display: "flex",
        flexDirection: "column",
        gap: 20,
      }}>
        {/* Section nav */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          borderBottom: "1px solid #ECECEE",
          paddingBottom: 12,
          overflowX: "auto",
          scrollbarWidth: "none",
        }}>
          {(user?.role === "superadmin" ? [...SET_SECTIONS, { id: "api", label: "API Integrations", icon: "code" }] : SET_SECTIONS).map(sec => {
            const active = section === sec.id;
            return (
              <button
                key={sec.id}
                type="button"
                onClick={() => setSection(sec.id)}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = "#F7F7F8"; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "9px 14px",
                  borderRadius: 10, border: "none", cursor: "pointer",
                  font: "inherit",
                  background: active ? ACCENT + "12" : "transparent",
                  color: active ? ACCENT : "#6B7280",
                  fontSize: 13.5, fontWeight: active ? 650 : 550,
                  transition: "background .12s, color .12s",
                  whiteSpace: "nowrap",
                }}
              >
                <Icon
                  name={sec.icon}
                  size={16}
                  color={active ? ACCENT : "#9CA3AF"}
                  strokeWidth={active ? 2.1 : 1.8}
                />
                <span>{sec.label}</span>
              </button>
            );
          })}
        </div>

        {/* Panel */}
        <div key={section}>{panel()}</div>
      </div>
    </AppShell>
  );
}
