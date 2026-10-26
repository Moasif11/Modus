# MODUS ERP — Development Guidelines

MODUS is an open-source, full-featured Indian GST-compliant ERP & invoicing suite built with React Router 7, Node/Bun, PostgreSQL, and Tailwind CSS.

## Architecture

- **`web/`**: Full-stack application powered by React Router v7 (SSR/client) with server routes under `src/app/api/`.
- **`mobile/`**: Companion mobile client built with Expo and React Native.

## Common Commands

From `web/`:
- `bun run dev` or `npm run dev`: Start local development server (port 4000).
- `bun run build`: Build production assets.
- `bun run test`: Run the test suite (Vitest / Bun test).
- `bun run typecheck`: Run TypeScript type checking.

## Design Philosophy

- **High-Fidelity UI**: Clean, technical SaaS aesthetic with sharp typography and subtle border layering.
- **Strict Compliance**: Comprehensive support for Indian GST, TDS, RCM, Credit Notes, and GSTR-2B reconciliation.
- **Decoupled Architecture**: Easily configurable for any business via Company Settings or environment variables.
