import nodemailer from "nodemailer";
import dns from "node:dns";

// Force IPv4-first for all lookups in this process. Railway disables outbound IPv6;
// both smtp.hostinger.com and api.mail.hostinger.com have AAAA records that would
// otherwise be tried first and fail (ECONNREFUSED).
try { dns.setDefaultResultOrder("ipv4first"); } catch {}

// ── Hostinger Agentic Mail — HTTP REST API (preferred) ────────────────────────
// Sends over HTTPS/443, so it works on hosts that block outbound SMTP (Railway).
// Configure in .env / Railway:
//   HOSTINGER_MAIL_TOKEN=<api token from hPanel → Emails → Agentic Mail → API access>
//   HOSTINGER_MAIL_MAILBOX_ID=<resourceId of the sending mailbox, e.g. accounts@…>
const MAIL_API = "https://api.mail.hostinger.com/api/v1";
const HMAIL_TOKEN = process.env.HOSTINGER_MAIL_TOKEN;
const HMAIL_MAILBOX = process.env.HOSTINGER_MAIL_MAILBOX_ID;

// Display name parsed from SMTP_FROM ("MODUS <notifications@…>") or a default.
const FROM_NAME = (() => {
  const m = (process.env.SMTP_FROM || "").match(/^\s*([^<]+?)\s*</);
  return m ? m[1].trim() : "MODUS ERP";
})();

async function sendViaHostingerApi({ to, cc, subject, html, attachments }) {
  const recipients = (Array.isArray(to) ? to : [to]).filter(Boolean);
  if (recipients.length === 0) return { skipped: true };
  const ccList = (Array.isArray(cc) ? cc : cc ? [cc] : []).filter(Boolean);

  const body = { to: recipients, subject, html, displayName: FROM_NAME };
  if (ccList.length) body.cc = ccList;
  if (attachments?.length) {
    body.attachments = attachments.map((a) => ({
      filename: a.filename,
      content: a.content,                      // base64 string
      contentType: a.contentType || a.type,
      encoding: a.encoding || "base64",
    }));
  }

  const res = await fetch(`${MAIL_API}/mailboxes/${HMAIL_MAILBOX}/send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${HMAIL_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Hostinger Mail API ${res.status}: ${detail.slice(0, 200)}`);
  }
  return { messageId: "hostinger-api" };
}

// ── SMTP fallback (local dev / hosts that allow SMTP) ─────────────────────────
let transporter = null;
function getTransporter() {
  if (transporter) return transporter;
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) return null;
  const port = parseInt(process.env.SMTP_PORT || "465", 10);
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    family: 4,
    connectionTimeout: 15000,
    greetingTimeout: 10000,
  });
  return transporter;
}

const FROM = process.env.SMTP_FROM || `MODUS ERP <${process.env.SMTP_USER || "notifications@example.com"}>`;

async function sendViaSmtp({ to, cc, subject, html, replyTo, attachments }) {
  const t = getTransporter();
  if (!t) return { skipped: true };
  const recipients = (Array.isArray(to) ? to : [to]).filter(Boolean);
  if (recipients.length === 0) return { skipped: true };
  const ccList = (Array.isArray(cc) ? cc : cc ? [cc] : []).filter(Boolean);
  const mailAttachments = (attachments || []).map((a) => ({
    filename: a.filename,
    content: a.content,
    encoding: a.encoding || (typeof a.content === "string" ? "base64" : undefined),
    contentType: a.contentType || a.type,
  }));
  const info = await t.sendMail({
    from: FROM,
    replyTo: replyTo || process.env.SMTP_USER,
    to: recipients,
    cc: ccList.length ? ccList : undefined,
    subject,
    html,
    attachments: mailAttachments,
  });
  return { messageId: info.messageId };
}

/**
 * Send an email. Prefers Hostinger Agentic Mail HTTP API (works everywhere),
 * falls back to SMTP. Never throws — returns { messageId | skipped | error }.
 */
export async function sendMail(opts) {
  const recipients = (Array.isArray(opts.to) ? opts.to : [opts.to]).filter(Boolean);
  if (recipients.length === 0) return { skipped: true };

  if (HMAIL_TOKEN && HMAIL_MAILBOX) {
    try {
      return await sendViaHostingerApi(opts);
    } catch (err) {
      console.error("Hostinger Mail API send failed:", err.message);
      return { error: err.message };
    }
  }

  try {
    const r = await sendViaSmtp(opts);
    if (r.skipped) console.warn("Email not configured (no Hostinger API token, no SMTP) — skipping:", opts.subject);
    return r;
  } catch (err) {
    console.error("SMTP send failed:", err.message);
    return { error: err.message };
  }
}
