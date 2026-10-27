<div align="center">

<br />

<img src="docs/assets/modus-primary-white.webp#gh-dark-mode-only" alt="MODUS ERP" width="360" />
<img src="docs/assets/modus-primary-black.webp#gh-light-mode-only" alt="MODUS ERP" width="360" />

<br />
<br />

### **The Modern Open-Source Studio ERP, GST Invoicing & Financial Operations Platform**

*Engineered for creative agencies, digital studios, IT consultancies, and modern service firms.*

<br />

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg?style=flat-square)](LICENSE)
[![Tests: 80 Passing](https://img.shields.io/badge/Tests-80%20Passing-success.svg?style=flat-square&logo=vitest&logoColor=white)](#-testing--quality-assurance)
[![React Router 7](https://img.shields.io/badge/React_Router-v7.6-E11D48.svg?style=flat-square&logo=react-router&logoColor=white)](https://reactrouter.com/)
[![Runtime: Node 20+ / Bun](https://img.shields.io/badge/Runtime-Node_20+_|_Bun-f472b6.svg?style=flat-square&logo=bun&logoColor=white)](https://bun.sh)
[![Database: PostgreSQL / Neon](https://img.shields.io/badge/Database-PostgreSQL_|_Neon-00E599.svg?style=flat-square&logo=postgresql&logoColor=white)](https://neon.tech)
[![Compliance: India GST & MCA 11(g)](https://img.shields.io/badge/Compliance-India_GST_|_MCA_11(g)-22c55e.svg?style=flat-square)](#-indian-gst--statutory-compliance-engine)
[![Docker: Ready](https://img.shields.io/badge/Docker-Compose_Ready-2496ED.svg?style=flat-square&logo=docker&logoColor=white)](#option-2-docker-compose-fastest)

<br />

[**Explore Features**](#-core-capabilities) • [**Quickstart Guide**](#-60-second-quickstart) • [**Architecture**](#-architecture--technology-stack) • [**White-Labeling**](#-white-label--customization) • [**Documentation**](#-documentation-index)

<br />

</div>

---

## ⚡ What is MODUS?

**MODUS** is a production-grade, open-source Enterprise Resource Planning (ERP) platform built from the ground up for modern service enterprises. It eliminates the clunky, disjointed spreadsheets and legacy accounting software by delivering a unified, keyboard-driven interface with sub-second page loads and airtight statutory compliance.

Whether you're running a boutique design studio, an international software consultancy, or an expanding digital marketing firm, MODUS handles the entire financial lifecycle—from prospective proposals to automated GST reconciliation, multi-currency payouts, and MCA Rule 11(g) audit compliance.

---

## 📸 Product Previews

<div align="center">

### Executive Dashboard & Cash Flow Command
*Real-time visibility into net receivables, overdue collections, expense run-rates, and financial health.*

<img src="docs/assets/screenshots/preview-dashboard.png" alt="MODUS ERP Dashboard" width="900" style="border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.1);" />

<br />
<br />

### Receivables & Statutory Tax Invoices
*GST-compliant tax invoices with dynamic CGST/SGST/IGST breakdown, payment status tracking, and PDF generation.*

<img src="docs/assets/screenshots/preview-invoices.png" alt="MODUS ERP Invoicing" width="900" style="border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.1);" />

<br />
<br />

### Modern High-Fidelity Authentication
*WebGL smokey background, glassmorphism cards, and enterprise security.*

<table>
  <tr>
    <td width="50%" align="center">
      <b>Secure Login & Role Session</b><br /><br />
      <img src="docs/assets/screenshots/preview-login.png" alt="MODUS Login" width="420" style="border-radius: 8px;" />
    </td>
    <td width="50%" align="center">
      <b>Password Recovery & Strength Validation</b><br /><br />
      <img src="docs/assets/screenshots/preview-forgot-password.png" alt="MODUS Password Recovery" width="420" style="border-radius: 8px;" />
    </td>
  </tr>
</table>

</div>

---

## ✨ Core Capabilities

| Module | Features & Capabilities |
| :--- | :--- |
| **📄 End-to-End Receivables** | • Quotations & Client Proposals with version revisions<br />• Proforma Invoices for advance milestone retainers<br />• Statutory Tax Invoices with FY sequential numbering (`MODUS/YYYY-YY/001`)<br />• Partial payments, TDS withholding tracking, bank reconciliations<br />• Section 34 compliant Credit Notes and client refunds |
| **🇮🇳 Indian GST & Tax Engine** | • Dynamic Place of Supply (POS) resolution (Intra-state CGST+SGST vs Inter-state IGST)<br />• Reverse Charge Mechanism (RCM) calculations for domestic & foreign supplies<br />• Income Tax TDS sections (194C, 194J) with automatic deduction math<br />• Instant GSTR-1 and GSTR-3B offline JSON export ready for GST portal upload |
| **🔍 GSTR-2B ITC Reconciliation** | • Upload official GSTR-2B JSON statements downloaded from the GST portal<br />• Instant cross-reconciliation with purchase books to prevent Input Tax Credit leakage<br />• Automated detection of missing supplier invoices, tax discrepancies, and Section 17(5) blocked credits |
| **💸 Payables & Expense Tracking** | • Vendor bills, contractor stipends, and recurring studio operational expenses<br />• Multi-currency payouts (USD, EUR, GBP, AED, INR) with exchange rate conversions<br />• Vendor MSME classification tracking and payment terms enforcement |
| **🎨 100% White-Label Engine** | • Customize company name, tagline, and portal display titles<br />• Upload primary horizontal logos, dark-mode logos, and browser favicons<br />• Built-in theme engine with curated color presets (Emerald, Indigo, Violet, Amber, Rose, Cyan, Slate) + custom hex picker<br />• Custom authorized digital signature and stamp on PDF documents |
| **🔒 MCA Rule 11(g) Audit Trail** | • Statutory, tamper-proof audit log capturing every record mutation, timestamp, and user IP<br />• Accounting Period Lock preventing historical modifications once tax returns are filed<br />• Role-based access control (Superadmin, Admin, User) |
| **📱 Mobile Client Companion** | • Companion React Native / Expo application located in `mobile/`<br />• Multi-platform support for iOS, Android, and mobile web |

---

## 🏛️ Architecture & Technology Stack

MODUS combines the speed and ergonomics of **React Router v7 Vite SSR** on the frontend with the lightweight performance of **Hono** for server API routes, backed by serverless **PostgreSQL (Neon)**.

```mermaid
graph LR
    subgraph Client ["Client Presentation"]
        Web["Desktop Web App<br/>(React Router v7 / Radix UI)"]
        Mobile["Mobile App<br/>(Expo / React Native)"]
    end

    subgraph Server ["Full-Stack Application Layer"]
        SSR["Vite SSR Runtime<br/>(Hono Engine / Node 20+)"]
        Auth["Session RBAC & Guards"]
        TaxEngine["India GST & TDS Engine"]
        Docs["Document Pipeline<br/>(PDF Generation / JSON)"]
    end

    subgraph Data ["Persistence & Assets"]
        Postgres[("Neon / PostgreSQL<br/>29 Relational Tables")]
        Storage["Cloudflare R2 / AWS S3<br/>Document Storage"]
    end

    Web -->|HTTPS / REST| SSR
    Mobile -->|JSON API| SSR
    SSR --> Auth
    Auth --> TaxEngine
    TaxEngine --> Docs
    Docs -->|SQL Queries| Postgres
    Docs -->|Presigned URLs| Storage
```

### Technology Highlights

- **Framework**: [React Router v7](https://reactrouter.com/) with Vite SSR & client hydration
- **Styling & UI**: [Tailwind CSS](https://tailwindcss.com/) + [Radix UI](https://www.radix-ui.com/) primitives + dynamic CSS theme variables
- **Backend API**: [Hono](https://hono.dev/) with Node HTTP server adapter
- **Database**: [PostgreSQL 14+](https://www.postgresql.org/) / [Neon Serverless Postgres](https://neon.tech) via `@neondatabase/serverless`
- **Testing**: [Vitest](https://vitest.dev/) & [Bun Test](https://bun.sh/) (80 passing test cases covering tax arithmetic)
- **Object Storage**: [Cloudflare R2](https://www.cloudflare.com/developer-platform/r2/) / [AWS S3](https://aws.amazon.com/s3/) via `@aws-sdk/client-s3`

---

## 🚀 60-Second Quickstart

### Option 1: Local Development with Node or Bun

#### 1. Clone the repository
```bash
git clone https://github.com/Moasif11/Modus.git
cd Modus
```

#### 2. Install workspace dependencies
```bash
npm install
# Or with Bun:
# bun install
```

#### 3. Configure environment variables
```bash
cp web/.env.example web/.env
```
Open `web/.env` and supply your PostgreSQL connection string:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/modus_db?sslmode=prefer"
APP_URL="http://localhost:4000"
SESSION_SECRET="your-development-session-secret"
SEED_SECRET="development-seed-secret"
```

#### 4. Initialize schema & seed demo data
```bash
# 1. Create all 29 relational tables and default admin account
npm run db:init

# 2. (Recommended) Seed realistic interconnected demo data across all modules
npm run db:seed
```

#### 5. Start the development server
```bash
npm run dev
```
Open **[http://localhost:4000](http://localhost:4000)** in your browser.

#### Default Access Credentials
- **Superadmin:** `admin@modus.local`
- **Admin Password:** `Modus@2026Admin`
- **Team Password:** `Modus@Team2026`

---

### Option 2: Docker Compose (Fastest)

Run the full stack (PostgreSQL + MODUS Web App) in isolated containers:

```bash
docker compose up -d
```
Access the application immediately at `http://localhost:4000`.

---

## 🎨 White-Label & Customization

MODUS includes a built-in **Branding & White-Label Suite** accessible directly from the frontend under **Settings → Company**:

1. **Company Profile**: Configure your legal entity name, operating address, GSTIN, PAN, and banking details.
2. **Branding Customization**:
   - **App Name & Tagline**: Updates browser title bars, navigation bars, and system notifications.
   - **Brand Color Palettes**: Choose from 7 curated design presets (Emerald, Indigo, Violet, Amber, Rose, Cyan, Slate) or input a custom hex code. MODUS dynamically injects `--modus-accent` across the entire application without rebuilding source code.
   - **Logos & Icons**: Upload light-mode logos, dark-theme white wordmarks, and custom browser favicons.
   - **Authorized Digital Signature**: Upload digital signatures and seal stamps for automated inclusion on PDF invoices.

---

## 🧪 Testing & Quality Assurance

MODUS maintains high test coverage across all tax validation algorithms, TDS deduction formulas, and refund arithmetic:

```bash
# Run all 80 unit & compliance tests
npm test

# Run tests in watch mode
npm --prefix web run test:watch
```

### Test Coverage Highlights:
- ✅ **GST Validation**: Checksum calculation for 15-character GSTINs using MOD-36 algorithm.
- ✅ **TDS Rules**: Deductions under Sections 194C, 194J, and custom rate rules.
- ✅ **Place of Supply**: Verification of Intra-state (CGST+SGST), Inter-state (IGST), and Export tax splits.
- ✅ **Section 34 Credit Notes**: Cutoff deadline enforcement (Nov 30 following invoice FY).
- ✅ **Period Locking**: Audit preservation and immutable ledger protection.

---

## 📚 Documentation Index

Comprehensive guides and architectural deep-dives are available in the repository:

- 📖 [**User Guide**](USER-GUIDE.md) — Step-by-step practical manual for day-to-day invoicing, bills, and GST filings.
- 📘 [**Comprehensive User Manual**](USER-MANUAL.md) — Exhaustive reference covering all 10 ERP modules and workflows.
- 🏛️ [**System Architecture**](docs/ARCHITECTURE.md) — Deep-dive into data models, security, and document lifecycles.
- ⚙️ [**Setup & Deployment Guide**](docs/SETUP.md) — Multi-environment setup for Docker, Neon, Supabase, and cloud VMs.
- ⚖️ [**Statutory GST & Tax Engine**](docs/TAX-ENGINE.md) — Complete specifications on Indian GST, RCM, TDS, and MCA Rule 11(g).
- 🤝 [**Contributing Guide**](CONTRIBUTING.md) — Guidelines for code style, git workflows, and pull requests.
- 🛡️ [**Security Policy**](.github/SECURITY.md) — Responsible disclosure process for security vulnerabilities.

---

## 📂 Project Structure

```
modus/
├── web/                       # Full-stack React Router v7 & API application
│   ├── public/                # Public assets & Modus Logo Suite
│   │   ├── Assets/logos/      # Official SVG & WebP brand marks
│   │   └── favicon.webp       # Standardized favicon
│   ├── scripts/               # Database management scripts
│   │   ├── init-db.mjs        # Schema initialization script
│   │   └── seed-demo-data.mjs # Repeatable, idempotent demo data seeder
│   ├── schema.sql             # Canonical 29-table PostgreSQL schema
│   ├── src/
│   │   ├── app/               # React Router pages & REST API routes
│   │   │   ├── api/           # Backend endpoints (auth, invoices, bills, gst)
│   │   │   │   └── utils/     # Tax engine, GSTR-1/3B JSON, audit logger
│   │   │   ├── invoices/      # Invoices & receivables management
│   │   │   ├── payables/      # Vendor bills, OCR scanning, expenses
│   │   │   ├── quotes/        # Client proposals & estimates
│   │   │   ├── reports/       # GST summary, TDS summary, P&L
│   │   │   ├── gstr2b-recon/  # GSTR-2B ITC matching engine
│   │   │   └── settings/      # Company details & white-label branding
│   │   └── components/        # Radix UI design system & layout components
│   └── vitest.config.ts       # Test configuration
├── mobile/                    # Companion React Native / Expo client
├── docs/                      # Architectural and technical documentation
│   ├── assets/                # Logos and high-resolution screenshots
│   ├── ARCHITECTURE.md        # Technical architecture specifications
│   ├── SETUP.md               # Multi-environment deployment manual
│   └── TAX-ENGINE.md          # Indian GST & statutory compliance engine
├── .github/                   # GitHub workflows, issue templates & PR forms
│   ├── workflows/ci.yml       # Continuous integration test runner
│   ├── ISSUE_TEMPLATE/        # Standardized issue templates
│   └── pull_request_template.md # PR submission checklist
├── package.json               # Root monorepo workspace configuration
├── docker-compose.yml         # Containerized orchestration
└── LICENSE                    # GNU Affero General Public License v3 (AGPLv3)
```

---

## 🤝 Contributing

We welcome contributions from developers, accountants, tax specialists, and designers! Please read [CONTRIBUTING.md](CONTRIBUTING.md) before submitting a pull request.

```bash
# Create your feature branch
git checkout -b feat/my-new-feature

# Run tests
npm test

# Commit your changes
git commit -m 'feat(invoicing): add support for multi-rate tax lines'
```

---

## 📄 License

MODUS ERP is free and open-source software licensed under the **[GNU Affero General Public License v3.0 (AGPLv3)](LICENSE)**.

This ensures MODUS remains open, auditable, and freely available for the community, while protecting users' statutory financial and accounting sovereignty.

---

<div align="center">

**Built with pride for modern studios and consultancies.**

[Report an Issue](https://github.com/Moasif11/Modus/issues) • [Request a Feature](https://github.com/Moasif11/Modus/issues/new?template=feature_request.yml) • [View Repository](https://github.com/Moasif11/Modus)

</div>
