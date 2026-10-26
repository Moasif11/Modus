import sql from "@/app/api/utils/sql";
import crypto from "crypto";
import { checkRateLimitDb, getClientIp, logAudit } from "@/app/api/utils/auth";
import { sendMail } from "@/app/api/utils/mailer";
import { emailShell } from "@/app/api/utils/emailTemplate";

export async function POST(request) {
  try {
    const { email } = await request.json();
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return Response.json({ error: "Valid email is required" }, { status: 400 });
    }

    const clientIp = getClientIp(request);
    const rateLimitKey = `forgot:${email.toLowerCase()}:${clientIp}`;
    if (!(await checkRateLimitDb(rateLimitKey, 3, 15 * 60 * 1000))) {
      return Response.json({ error: "Too many requests. Try again later." }, { status: 429 });
    }

    const SAFE_RESPONSE = Response.json({ message: "If that email is registered, a reset link has been sent." });

    const users = await sql`
      SELECT id FROM users WHERE email = ${email.toLowerCase()} AND is_active = true LIMIT 1
    `;

    if (users.length === 0) return SAFE_RESPONSE;

    const userId = users[0].id;
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    const resetUrl = `${process.env.APP_URL || 'http://localhost:4000'}/reset-password?token=${rawToken}`;

    // Send email first — only persist token if delivery succeeds
    const mailResult = await sendMail({
      to: email,
      subject: "Reset your MODUS password",
      html: emailShell({
        preheader: "Reset your MODUS password — link expires in 1 hour",
        heading: "Reset your password",
        intro: "We received a request to reset the password for your MODUS account. Click the button below to set a new one.",
        ctaText: "Reset Password",
        ctaUrl: resetUrl,
        note: `This link expires in <strong>1 hour</strong>. If you didn't request this, you can safely ignore this email.<br/><br/><span style="color:#B4B7BE;word-break:break-all;">${resetUrl}</span>`,
      }),
    });
    if (mailResult?.error || mailResult?.skipped) {
      // Delivery failed — don't persist a token the user can never receive.
      throw new Error(mailResult.error || "Email delivery unavailable");
    }

    await sql`
      INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
      VALUES (${userId}, ${tokenHash}, ${expiresAt})
    `;

    await logAudit({ userId, action: "forgot_password_request", entityType: "user", entityId: userId, metadata: { email }, request });

    return SAFE_RESPONSE;
  } catch (error) {
    console.error("Forgot password error:", error);
    return Response.json({ message: "If that email is registered, a reset link has been sent." });
  }
}
