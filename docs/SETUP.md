# MODUS ERP — Setup & Deployment Guide

This guide covers setup and deployment for **MODUS ERP** across multiple environments.

---

## 💻 1. Local Development Setup

### System Prerequisites
- **Node.js** `20.0.0+` or **Bun** `1.1+`
- **PostgreSQL** `14+` (Local Postgres, Docker, or [Neon](https://neon.tech))
- **Git**

### Installation Steps

```bash
# 1. Clone repository
git clone https://github.com/Moasif11/Modus.git
cd Modus

# 2. Install workspace dependencies
npm install
# Or: bun install

# 3. Create your environment configuration
cp web/.env.example web/.env
```

### Environment Configuration (`web/.env`)
Configure the following required keys:

```env
# Database Connection (Neon / Postgres)
DATABASE_URL="postgresql://user:password@host:5432/neondb?sslmode=require"

# Application URL
APP_URL="http://localhost:4000"

# Secrets for Auth and Seeding
SESSION_SECRET="generate-a-strong-random-secret-key-32-chars-minimum"
SEED_SECRET="development-seed-secret"

# (Optional) Cloudflare R2 / AWS S3 for document storage
S3_BUCKET=""
S3_REGION="auto"
S3_ACCESS_KEY_ID=""
S3_SECRET_ACCESS_KEY=""
S3_ENDPOINT=""
```

### Database Initialization & Demo Seeding
```bash
# 1. Initialize schema & create admin user
npm run db:init

# 2. Populate realistic demo records across all ERP modules
npm run db:seed
```

### Run the App
```bash
npm run dev
```
Open **[http://localhost:4000](http://localhost:4000)** in your browser.

- **Superadmin:** `admin@modus.local`
- **Password:** `Modus@2026Admin`
- **Team Password:** `Modus@Team2026`

---

## 🐳 2. Docker Compose Deployment

Run the complete stack with zero host prerequisites except Docker:

```bash
docker compose up -d
```

This starts:
- **`modus-postgres`**: PostgreSQL database on port `5432` with persisted volume `modus_pgdata`.
- **`modus-web`**: Production web application and API on port `4000`.

---

## ☁️ 3. Neon Serverless PostgreSQL Setup

MODUS is preconfigured for [Neon](https://neon.tech) Serverless PostgreSQL:

1. Create a free PostgreSQL project on [Neon Console](https://console.neon.tech).
2. Copy your connection string (`postgresql://neondb_owner:***@ep-***.neon.tech/neondb?sslmode=require`).
3. Paste into `web/.env`:
   ```env
   DATABASE_URL="postgresql://neondb_owner:***@ep-***.neon.tech/neondb?sslmode=require"
   ```
4. Run `npm run db:init` followed by `npm run db:seed`.

---

## 📱 4. Mobile Client Development (Expo)

MODUS includes an Expo companion application in `mobile/`:

```bash
# From repository root:
npm run dev:mobile

# Or inside mobile directory:
cd mobile
npx expo start
```
Scan the QR code with **Expo Go** (iOS / Android) or press `w` to preview in the web browser.
