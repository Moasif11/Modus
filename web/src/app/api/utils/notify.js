import sql from "@/app/api/utils/sql";
import { sendMail } from "@/app/api/utils/mailer";

let tableReady = false;
export async function ensureNotificationsTable() {
  if (tableReady) return;
  await sql`
    CREATE TABLE IF NOT EXISTS notifications (
      id          SERIAL PRIMARY KEY,
      user_id     INTEGER NOT NULL,
      type        VARCHAR(50) NOT NULL DEFAULT 'info',
      title       VARCHAR(255) NOT NULL,
      body        TEXT,
      link        VARCHAR(255),
      related_id  INTEGER,
      is_read     BOOLEAN NOT NULL DEFAULT false,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read)`;
  tableReady = true;
}

export async function createNotification({ userId, type = "info", title, body, link, relatedId }) {
  await ensureNotificationsTable();
  await sql`
    INSERT INTO notifications (user_id, type, title, body, link, related_id)
    VALUES (${userId}, ${type}, ${title}, ${body || null}, ${link || null}, ${relatedId || null})
  `;
}

// Insert an in-app notification for every superadmin.
export async function notifySuperAdmins({ type, title, body, link, relatedId }) {
  await ensureNotificationsTable();
  const admins = await sql`SELECT id FROM users WHERE role = 'superadmin' AND is_active = true`;
  for (const a of admins) {
    await sql`
      INSERT INTO notifications (user_id, type, title, body, link, related_id)
      VALUES (${a.id}, ${type}, ${title}, ${body || null}, ${link || null}, ${relatedId || null})
    `;
  }
  return admins.map((a) => a.id);
}

// Fetch superadmin emails (for transactional email).
export async function getSuperAdminEmails() {
  const admins = await sql`SELECT email FROM users WHERE role = 'superadmin' AND is_active = true AND email IS NOT NULL`;
  return admins.map((a) => a.email).filter(Boolean);
}

// Send a transactional email via Hostinger SMTP; never throws (logged + swallowed).
export async function sendEmail({ to, subject, html }) {
  return sendMail({ to, subject, html });
}

// Company-level notification preferences (Settings → Notifications).
// Defaults mirror the Settings UI so unsaved prefs behave as displayed.
const PREF_DEFAULTS = {
  paymentReceived: true,
  invoiceOverdue: true,
  invoiceViewed: false,
  billDueSoon: true,
  gstReminders: true,
  weeklySummary: false,
};

export async function getNotificationPrefs() {
  try {
    const rows = await sql`SELECT notification_prefs FROM company_settings LIMIT 1`;
    return { ...PREF_DEFAULTS, ...(rows[0]?.notification_prefs || {}) };
  } catch (err) {
    console.error("getNotificationPrefs failed:", err.message);
    return { ...PREF_DEFAULTS };
  }
}
