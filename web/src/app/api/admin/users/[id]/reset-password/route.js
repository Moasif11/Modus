import sql from "@/app/api/utils/sql";
import argon2 from "argon2";
import crypto from "crypto";
import { requireAdmin, handleRouteError } from "@/app/api/utils/auth";

export async function POST(request, { params }) {
  try {
    const caller = await requireAdmin(request);
    const rows = await sql`SELECT id, role FROM users WHERE id = ${params.id}`;

    if (!rows.length) return Response.json({ error: "User not found" }, { status: 404 });
    const target = rows[0];

    if (target.role === 'superadmin') return Response.json({ error: "Cannot reset superadmin password" }, { status: 403 });
    if (Number(caller.id) === Number(target.id)) return Response.json({ error: "Cannot reset your own password this way" }, { status: 403 });
    if (caller.role === 'admin' && target.role === 'admin') return Response.json({ error: "Admins cannot reset other admin passwords" }, { status: 403 });

    // Random one-time password — a fixed default is guessable by
    // anyone who knows the app, leaving a takeover window before first login.
    const tempPassword = crypto.randomBytes(6).toString("base64url");
    const passwordHash = await argon2.hash(tempPassword);
    await sql`UPDATE users SET password_hash = ${passwordHash}, must_reset_password = true WHERE id = ${params.id}`;
    await sql`DELETE FROM sessions WHERE user_id = ${params.id}`;

    return Response.json({
      message: `Password reset. Share the temporary password with the user — they must change it on next login.`,
      tempPassword,
    });
  } catch (error) {
    return handleRouteError(error) || Response.json({ error: "Failed to reset password" }, { status: 500 });
  }
}
