// Premium, email-client-safe HTML shell (table-based, inline styles).
// Used by all transactional emails for a consistent branded look.

const ACCENT = "#E11D2C";

/**
 * @param {object} o
 * @param {string} o.preheader  hidden inbox-preview text
 * @param {string} o.heading    big title
 * @param {string} o.intro      paragraph under the title
 * @param {Array<[string,string]>} [o.rows]  label/value detail rows
 * @param {string} [o.ctaText]
 * @param {string} [o.ctaUrl]
 * @param {string} [o.note]     small muted footer note (html allowed)
 * @param {string} [o.accent]   accent color (default red; e.g. green for approved)
 */
export function emailShell({ preheader = "", heading, intro, rows = [], ctaText, ctaUrl, note, accent = ACCENT }) {
  const rowsHtml = rows.map(([label, value]) => `
    <tr>
      <td style="padding:9px 0;color:#9CA3AF;font-size:13px;width:38%;vertical-align:top;">${label}</td>
      <td style="padding:9px 0;color:#0A0A0A;font-size:13px;font-weight:600;vertical-align:top;">${value}</td>
    </tr>`).join("");

  const ctaHtml = (ctaText && ctaUrl) ? `
    <tr><td style="padding:24px 0 4px;">
      <a href="${ctaUrl}" style="display:inline-block;background:${accent};color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:13px 26px;border-radius:10px;">${ctaText}</a>
    </td></tr>` : "";

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only"></head>
<body style="margin:0;padding:0;background:#F4F4F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <span style="display:none;visibility:hidden;opacity:0;height:0;width:0;overflow:hidden;">${preheader}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F4F6;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,0.06);">
        <!-- header -->
        <tr><td style="background:#0A0A0A;padding:22px 32px;">
          <span style="font-size:22px;font-weight:800;letter-spacing:-0.04em;color:#ffffff;">MODUS<span style="color:${accent};">.</span></span>
        </td></tr>
        <!-- accent line -->
        <tr><td style="height:3px;background:${accent};line-height:3px;font-size:0;">&nbsp;</td></tr>
        <!-- body -->
        <tr><td style="padding:30px 32px 34px;">
          <h1 style="margin:0 0 12px;font-size:20px;font-weight:800;color:#0A0A0A;letter-spacing:-0.01em;">${heading}</h1>
          <p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:#4B5563;">${intro}</p>
          ${rows.length ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #F0F0F2;border-bottom:1px solid #F0F0F2;margin:4px 0;">${rowsHtml}</table>` : ""}
          <table role="presentation" cellpadding="0" cellspacing="0">${ctaHtml}</table>
          ${note ? `<p style="margin:22px 0 0;font-size:12px;line-height:1.6;color:#9CA3AF;">${note}</p>` : ""}
        </td></tr>
        <!-- footer -->
        <tr><td style="background:#FAFAFB;padding:18px 32px;border-top:1px solid #F0F0F2;">
          <p style="margin:0;font-size:11.5px;color:#9CA3AF;">MODUS ERP · Open-source invoicing, accounting &amp; GST workspace.</p>
        </td></tr>
      </table>
      <p style="margin:16px 0 0;font-size:11px;color:#B4B7BE;">This is an automated message from MODUS.</p>
    </td></tr>
  </table>
</body></html>`;
}
