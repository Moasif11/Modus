# MODUS ERP — Statutory Compliance & Indian GST Engine

MODUS includes an automated tax calculation and compliance engine tailored for Indian service businesses, consultancies, IT software providers, and creative studios.

---

## Supported Statutory Standards

| Regulation / Standard | Authority | MODUS Implementation |
| --------------------- | --------- | -------------------- |
| **CGST / SGST / IGST Act 2017** | CBIC, Govt of India | Dynamic Place of Supply (POS) resolution, state code validation (01–38, 96, 97). |
| **MCA Rule 11(g) Audit Trail** | Ministry of Corporate Affairs | Immutable, tamper-proof edit log tracking every document change, timestamp, and user. |
| **GSTR-1 & GSTR-3B JSON** | GSTN Portal | Native schema export matching official offline utility JSON formats. |
| **GSTR-2B ITC Matching** | GSTN Portal | Parser and reconciliation engine comparing ERP purchase bills with 2B statements. |
| **Section 34 Credit Notes** | CGST Act | FY Nov 30 statutory deadline verification for issuing adjustment credit notes. |
| **Section 194C / 194J TDS** | Income Tax Dept | Net payment deductions and withholding tax tracking for vendor payouts. |

---

## Place of Supply (POS) Resolution Rules

```
Origin (Company GSTIN State) vs Destination (Client GSTIN / State of Supply)
│
├── Origin == Destination  ───► Intra-State: CGST (50%) + SGST (50%)
├── Origin != Destination  ───► Inter-State: IGST (100%)
├── Overseas Client (POS 96) ─► Zero-Rated Export (LUT / WPAY)
└── SEZ Developer/Unit (97) ──► Zero-Rated Inter-State (LUT / WPAY)
```

### Supported GST Treatments:
- `registered_business`: Validated 15-character GSTIN with MOD-36 checksum.
- `unregistered_buyer`: Domestic retail or unregistered buyer (B2C / B2CL if > ₹2.5 Lakhs inter-state).
- `overseas_export`: International clients billed in foreign currency (USD, EUR, GBP, AED, etc.) or INR under LUT.
- `sez_developer`: Supplies to Special Economic Zone developers.
- `sez_unit`: Supplies to Special Economic Zone operating units.
- `deemed_export`: Supplies qualifying under Section 147 of the CGST Act.

---

## GSTR-2B Reconciliation Engine

Input Tax Credit (ITC) leakage is one of the highest financial risks for Indian enterprises. MODUS features an automated GSTR-2B reconciliation module:

1. **Upload GSTR-2B**: Upload the JSON statement downloaded from the GST portal for the tax period.
2. **Automated Matching**:
   - Compares supplier GSTIN, invoice number, and invoice date.
   - Flags invoices present in books but missing in 2B (**ITC at Risk**).
   - Flags tax amount mismatches between books and government records.
   - Flags ineligible ITC claims under Section 17(5) (e.g., motor vehicles, food & beverages, personal consumption).
3. **Actionable Resolution**: Mark invoices as matched, send dispute requests to suppliers, or defer credit claims.

---

## MCA Rule 11(g) Audit Trail

Under Section 143(3) of the Companies Act and Rule 11(g) of the Companies (Audit and Auditors) Rules:
- MODUS records an append-only audit record in `audit_logs` whenever any financial record (invoice, payment, quote, bill, customer) is created, edited, locked, or deleted.
- Each log contains:
  - Timestamp (UTC)
  - User ID and IP address
  - Entity type and entity ID
  - Action performed (`create`, `update`, `delete`, `status_change`, `lock`)
  - Full before-and-after JSON delta of affected attributes
