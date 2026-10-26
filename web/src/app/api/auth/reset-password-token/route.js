import sql from "@/app/api/utils/sql";
import argon2 from "argon2";
import crypto from "crypto";

export async function POST(request) {
  try {
    const { token, newPassword } = await request.json();

    if (!token || !newPassword) {
      return Response.json({ error: "Token and new password are required" }, { status: 400 });
    }
    if (newPassword.length < 8) {
      return Response.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const rows = await sql`
      SELECT id, user_id, expires_at, used_at
      FROM password_reset_tokens
      WHERE token_hash = ${tokenHash}
      LIMIT 1
    `;

    if (rows.length === 0) {
      return Response.json({ error: "Invalid or expired reset link" }, { status: 400 });
    }

    const row = rows[0];
    if (row.used_at) return Response.json({ error: "Reset link already used" }, { status: 400 });
    if (new Date(row.expires_at) < new Date()) return Response.json({ error: "Reset link expired" }, { status: 400 });

    // Mark token used first — conditional UPDATE prevents concurrent reuse (TOCTOU)
    const marked = await sql`
      UPDATE password_reset_tokens SET used_at = NOW()
      WHERE id = ${row.id} AND used_at IS NULL
      RETURNING id
    `;
    if (marked.length === 0) return Response.json({ error: "Reset link already used" }, { status: 400 });

    const newPasswordHash = await argon2.hash(newPassword);
    await sql`UPDATE users SET password_hash = ${newPasswordHash}, must_reset_password = false, updated_at = NOW() WHERE id = ${row.user_id}`;
    await sql`DELETE FROM sessions WHERE user_id = ${row.user_id}`;

    return Response.json({ message: "Password reset successfully. Please log in." });
  } catch (error) {
    console.error("Reset password token error:", error);
    return Response.json({ error: "Failed to reset password" }, { status: 500 });
  }
}
