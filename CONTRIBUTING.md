# Contributing to MODUS ERP

Thank you for your interest in contributing to **MODUS ERP**! We welcome bug fixes, documentation improvements, feature additions, and compliance enhancements.

## Code of Conduct

Please be respectful, collaborative, and considerate when interacting with contributors and maintainers.

## Development Workflow

### 1. Prerequisites
- [Bun](https://bun.sh/) (v1.1+) or Node.js (v20+)
- PostgreSQL 14+ (Local or managed like NeonDB / Supabase)

### 2. Setup
```bash
# Clone your fork
git clone https://github.com/<your-username>/modus.git
cd modus/web

# Install dependencies
bun install

# Configure environment
cp .env.example .env
# Edit .env with your DATABASE_URL

# Start development server
bun run dev
```

### 3. Running Tests
We maintain high test coverage for tax calculations, GST validation, TDS rules, and credit note mathematics. Before submitting a PR, ensure all tests pass:
```bash
cd web
bun test
```

### 4. Git Commit Guidelines
Follow conventional commits:
- `feat(invoices): add export to JSON format`
- `fix(gst): correct inter-state threshold check`
- `docs(readme): add docker compose guide`

## Licensing

MODUS is licensed under the **GNU Affero General Public License v3.0 (AGPLv3)**. By contributing, you agree that your contributions will be licensed under the AGPLv3.
