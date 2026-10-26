<div align="center">

# MODUS ERP

**A modern, high-fidelity ERP, invoicing, and tax compliance suite designed for studios, agencies, and service businesses.**

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](LICENSE)
[![React Router 7](https://img.shields.io/badge/React_Router-v7-red.svg)](https://reactrouter.com/)
[![Runtime: Bun](https://img.shields.io/badge/Runtime-Bun-f472b6.svg)](https://bun.sh)
[![Database: PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL-336791.svg)](https://www.postgresql.org/)
[![Compliance: India GST](https://img.shields.io/badge/Compliance-India_GST-22c55e.svg)](#indian-tax--gst-engine)

</div>

---

## ⚡ Highlights

- **📄 Full Document Lifecycle**: Quotations & Proposals ➔ Proforma Invoices ➔ Tax Invoices ➔ Credit Notes & Refunds.
- **🇮🇳 Indian GST & Tax Engine**:
  - Automatic place-of-supply resolution (Intra-state CGST+SGST vs Inter-state IGST).
  - Reverse Charge Mechanism (RCM) calculations for domestic & overseas imports.
  - TDS section rules (194C, 194J, etc.) with automatic net deduction math.
  - GSTR-1 and GSTR-3B compliant portal JSON export.
- **🔍 GSTR-2B ITC Reconciliation**: Match purchase books against government GSTR-2B JSON to instantly catch missing invoices and tax mismatches.
- **💸 Payables & Expense Tracking**: Manage vendor bills, contractor payments, and multi-currency payouts with AI receipt scanning.
- **👥 Multi-User Role Based Access**: Superadmin, Admin, and User roles with session tokens, audit logs (Rule 11(g)), and password reset workflows.
- **🎨 High-Fidelity UI**: Dark-mode aesthetic, keyboard-driven Command Palette (`⌘K`), date range filters, and PDF invoice generation.
- **📱 Mobile Ready**: Companion React Native / Expo client included under `mobile/`.

---

## 🚀 Quick Start

### Option 1: Docker Compose (Fastest)

```bash
docker compose up -d
```
The application will be live at `http://localhost:4000`.

---

### Option 2: Local Development with Bun or Node

#### 1. Prerequisites
- **Bun** (recommended) or **Node.js 20+**
- **PostgreSQL** instance (local, Docker, Neon, or Supabase)

#### 2. Install Dependencies
```bash
cd web
bun install # or npm install
```

#### 3. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Open `web/.env` and update:
- `DATABASE_URL`: Your PostgreSQL connection string.
- `APP_URL`: Defaults to `http://localhost:4000`.
- `SEED_SECRET`: A secret string used to protect database initialization.

#### 4. Run Development Server
```bash
bun run dev # or npm run dev
```
Open [http://localhost:4000](http://localhost:4000) in your browser.

---

## 🔐 First-Time Initialization & Login

When launching on a fresh database:

1. Send a POST request to initialize the database:
   ```bash
   curl -X POST http://localhost:4000/api/auth/seed \
     -H "Content-Type: application/json" \
     -d '{"secret": "your-seed-secret"}'
   ```
2. Navigate to `/login`:
   - **Default Email:** `admin@modus.local`
   - **Default Password:** `Modus@2026Admin`
3. You will be prompted to set your personal password upon first login.
4. Go to **Settings** (`/settings`) to customize your company legal name, logo, address, GSTIN, PAN, and bank accounts.

---

## 🏗️ Project Architecture

```
.
├── web/                   # Full-stack React Router 7 application
│   ├── src/app/           # Page routes and REST API endpoints
│   │   ├── api/           # Backend server routes (auth, invoices, bills, gst)
│   │   │   └── utils/     # Tax engine, PDF rendering, audit logging, mailer
│   │   ├── invoices/      # Receivables & invoice creation
│   │   ├── quotes/        # Quotations & proposals
│   │   ├── proforma/      # Proforma invoices
│   │   ├── credit-notes/  # Credit notes & refunds
│   │   ├── payables/      # Expenses, vendor bills, receipt parsing
│   │   ├── gstr2b-recon/  # GSTR-2B reconciliation module
│   │   ├── reports/       # GST summary, tax reports, exports
│   │   └── settings/      # Workspace, company profile & tax settings
│   └── src/components/    # UI design system and reusable components
├── mobile/                # React Native / Expo companion client
├── docker-compose.yml     # Local orchestration for PostgreSQL & web app
└── LICENSE                # GNU Affero General Public License v3 (AGPLv3)
```

---

## 🧪 Testing

MODUS features an extensive test suite covering GST validation, tax treatment rules, TDS calculation, ITC eligibility, and refund mathematics:

```bash
cd web
bun test
```

All 80+ compliance and arithmetic tests run in milliseconds.

---

## 📄 License

This project is licensed under the **GNU Affero General Public License v3.0 (AGPLv3)**. See [LICENSE](LICENSE) for full details.
