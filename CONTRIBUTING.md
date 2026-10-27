# Contributing to MODUS ERP

Thank you for your interest in contributing to **MODUS ERP**! MODUS is an open-source, high-fidelity studio ERP, invoicing, and tax compliance suite built for agencies, consultancies, and modern service businesses.

We welcome all contributions: bug fixes, documentation, feature proposals, tax engine enhancements, and localization.

---

## 📋 Code of Conduct

We are committed to providing a welcoming, inclusive, and harassment-free experience for everyone. Please be respectful, constructive, and collaborative in all discussions and pull requests.

---

## 🛠️ Development Setup

MODUS is structured as a clean monorepo:
- `web/`: Full-stack React Router v7 + Vite web application with embedded Hono Node API.
- `mobile/`: Companion React Native / Expo mobile application.

### 1. Prerequisites
- **Node.js**: `v20.0.0` or higher (or **Bun** `v1.1+`)
- **PostgreSQL**: PostgreSQL 14+ (Local, Docker, or serverless like [Neon](https://neon.tech))
- **Git**

### 2. Fork and Clone
```bash
git clone https://github.com/<your-username>/Modus.git
cd Modus
```

### 3. Install Dependencies
```bash
# Install root workspace and package dependencies
npm install
# Or with Bun:
# bun install
```

### 4. Configure Environment
Copy the example environment configuration into `web/.env`:
```bash
cp web/.env.example web/.env
```
Edit `web/.env` with your PostgreSQL database URL:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/modus_db?sslmode=prefer"
APP_URL="http://localhost:4000"
SEED_SECRET="development-seed-secret-2026"
SESSION_SECRET="your-development-session-secret"
```

### 5. Initialize & Seed Database
```bash
# Create database schema and default superadmin account
npm run db:init

# (Optional) Seed realistic interconnected demo data across all modules
npm run db:seed
```

### 6. Start Development Server
```bash
npm run dev
```
Visit [http://localhost:4000](http://localhost:4000) in your browser.

Default credentials:
- **Email:** `admin@modus.local`
- **Password:** `Modus@2026Admin`

---

## 🧪 Testing Guidelines

Tax accuracy, GST validation, and mathematical precision are critical to MODUS ERP. We enforce rigorous unit testing on all business rules:

```bash
# Run the complete test suite (80+ unit and compliance tests)
npm test

# Run tests in watch mode during development
npm --prefix web run test:watch
```

### Core Areas Requiring Tests:
- **GST Treatment Logic**: Intra-state vs Inter-state determination, SEZ with/without payment, Overseas Export treatments.
- **TDS Deduction**: Section 194C, 194J, rate overrides, threshold calculations.
- **Refund & Credit Mathematics**: Balance adjustments, partial refunds, Section 34 cutoff validations.
- **Period Locks & Audit**: Immutability of locked periods and Rule 11(g) audit entries.

---

## 🌿 Git & Branch Workflow

1. Create a feature branch from `main`:
   ```bash
   git checkout -b feat/your-feature-name
   # or fix/your-bug-fix
   ```
2. Make atomic, well-tested commits following [Conventional Commits](https://www.conventionalcommits.org/):
   - `feat(invoices): support export to UBL XML`
   - `fix(tds): handle zero-rate threshold exemption`
   - `docs(readme): add docker deployment troubleshooting`
   - `style(branding): improve light mode logo contrast`
3. Push your branch to your fork:
   ```bash
   git push origin feat/your-feature-name
   ```
4. Open a Pull Request against `main`. Fill out the PR template completely.

---

## 🎨 Design & Code Standards

- **React Router v7**: Use route modules and standard server actions/loaders where appropriate.
- **UI Components**: Use Radix UI primitives and consistent CSS design tokens.
- **White-Label Compatibility**: Never hardcode colors where `--modus-accent` should be used. Ensure all views support dynamic branding.
- **No Console Logs or Secrets**: Remove debugging logs before submitting PRs. Never commit `.env` or sensitive API keys.

---

## 📄 License

By contributing to MODUS ERP, you agree that your contributions will be licensed under the **GNU Affero General Public License v3.0 (AGPLv3)**.
