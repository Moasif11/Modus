import sql from "@/app/api/utils/sql";
import { requireAdmin, handleRouteError } from "@/app/api/utils/auth";

export async function POST(request, { params }) {
  try {
    const caller = await requireAdmin(request);
    const rows = await sql`SELECT id, role, is_active FROM users WHERE id = ${params.id}`;

    if (!rows.length) return Response.json({ error: "User not found" }, { status: 404 });
    const target = rows[0];

    if (target.role === 'superadmin') return Response.json({ error: "Cannot deactivate superadmin" }, { status: 403 });
    if (Number(caller.id) === Number(target.id)) return Response.json({ error: "Cannot deactivate your own account" }, { status: 403 });
    if (caller.role === 'admin' && target.role === 'admin') return Response.json({ error: "Admins cannot deactivate other admins" }, { status: 403 });

    const newState = !target.is_active;
    await sql`UPDATE users SET is_active = ${newState} WHERE id = ${params.id}`;
    if (!newState) await sql`DELETE FROM sessions WHERE user_id = ${params.id}`;

    return Response.json({ isActive: newState, message: newState ? "User activated" : "User deactivated" });
  } catch (error) {
    return handleRouteError(error) || Response.json({ error: "Failed to toggle user" }, { status: 500 });
  }
}
