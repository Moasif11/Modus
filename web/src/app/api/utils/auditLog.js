import sql from "@/app/api/utils/sql";
import { diffFields } from "@/app/api/utils/periodLock";

let ensured = false;

// Immutable edit log (Companies Act Rule 11(g)): append-only field-level change history
// on financial documents. There is intentionally NO update/delete path for these rows.
export async function ensureChangeLog() {
  if (ensured) return;
  await sql`
    CREATE TABLE IF NOT EXISTS change_log (
      id SERIAL PRIMARY KEY,
      entity_type VARCHAR(40) NOT NULL,
      entity_id INTEGER NOT NULL,
      action VARCHAR(20) NOT NULL,
      changes JSONB,
      changed_by INTEGER,
      changed_by_name VARCHAR(255),
      ip VARCHAR(64),
      changed_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_change_log_entity ON change_log (entity_type, entity_id)`;
  ensured = true;
}

// Record a change. For 'update' pass before+after (only changed fields are stored);
// for create/delete/cancel pass an action and optional snapshot in `after`.
export async function logChange({ entityType, entityId, action, before, after, keys, user, request }) {
  try {
    await ensureChangeLog();
    const changes = action === "update" ? diffFields(before, after, keys) : (after || before || null);
    if (action === "update" && Object.keys(changes).length === 0) return; // nothing changed
    const ip = request?.headers?.get?.("x-forwarded-for") || null;
    const name = user?.fullName || user?.name || user?.email || null;
    await sql`
      INSERT INTO change_log (entity_type, entity_id, action, changes, changed_by, changed_by_name, ip)
      VALUES (${entityType}, ${entityId}, ${action}, ${JSON.stringify(changes)}, ${user?.id || null}, ${name}, ${ip})
    `;
  } catch (e) {
    console.error("logChange failed:", e.message);
  }
}

// Current books-lock date (YYYY-MM-DD) or null. Documents dated on/before it are immutable.
export async function getBooksLockDate() {
  try {
    const s = (await sql`SELECT books_locked_until FROM company_settings ORDER BY id ASC LIMIT 1`)[0];
    return s?.books_locked_until || null;
  } catch {
    return null;
  }
}
