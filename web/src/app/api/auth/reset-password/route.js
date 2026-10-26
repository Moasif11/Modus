import sql from "@/app/api/utils/sql";
import argon2 from "argon2";
import { requireAuth, logAudit, handleRouteError, getTokenFromRequest } from "@/app/api/utils/auth";

export async function POST(request) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();
    const { currentPassword, newPassword, email } = body;

    if (!currentPassword || !newPassword) {
      return Response.json(
        { error: "Current password and new password are required" },
        { status: 400 },
      );
    }

    if (newPassword.length < 8) {
      return Response.json(
        { error: "New password must be at least 8 characters long" },
        { status: 400 },
      );
    }

    // Get user with password hash
    const users = await sql`
      SELECT id, password_hash
      FROM users
      WHERE id = ${user.id}
      LIMIT 1
    `;

    if (users.length === 0) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    // Verify current password
    const isValidPassword = await argon2.verify(
      users[0].password_hash,
      currentPassword,
    );

    if (!isValidPassword) {
      return Response.json(
        { error: "Current password is incorrect" },
        { status: 401 },
      );
    }

    // Hash new password
    const newPasswordHash = await argon2.hash(newPassword);

    // Update password and clear must_reset_password flag
    await sql`
      UPDATE users
      SET password_hash = ${newPasswordHash},
          must_reset_password = false,
          updated_at = NOW()
      WHERE id = ${user.id}
    `;

    // Delete other sessions (keep current)
    const currentToken = getTokenFromRequest(request);
    await sql`DELETE FROM sessions WHERE user_id = ${user.id} AND token != ${currentToken}`;

    // On first login, save email if provided and not yet set
    if (user.must_reset_password && email?.includes('@')) {
      await sql`UPDATE users SET email = ${email.trim().toLowerCase()} WHERE id = ${user.id} AND (email IS NULL OR email = '')`;
    }

    // Log audit
    await logAudit({
      userId: user.id,
      action: "reset_password",
      entityType: "user",
      entityId: user.id,
      metadata: { email: user.email },
      request,
    });

    return Response.json({ message: "Password reset successfully" });
  } catch (error) {
    return handleRouteError(error) || (console.error("Reset password error:", error), Response.json({ error: "Failed to reset password" }, { status: 500 }));
  }
}
