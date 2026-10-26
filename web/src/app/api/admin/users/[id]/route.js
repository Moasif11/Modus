import sql from "@/app/api/utils/sql";
import { requireAdmin, handleRouteError } from "@/app/api/utils/auth";

function guardTarget(caller, target) {
  if (!target) return Response.json({ error: "User not found" }, { status: 404 });
  if (target.role === 'superadmin') return Response.json({ error: "Cannot modify superadmin account" }, { status: 403 });
  if (Number(caller.id) === Number(target.id)) return Response.json({ error: "Cannot modify your own account" }, { status: 403 });
  if (caller.role === 'admin' && target.role === 'admin') return Response.json({ error: "Admins cannot modify other admins" }, { status: 403 });
  return null;
}

export async function GET(request, { params }) {
  try {
    const caller = await requireAdmin(request);
    const rows = await sql`SELECT id, username, name, full_name, email, phone, designation, role, is_active, avatar_url, created_at FROM users WHERE id = ${params.id}`;
    const guard = guardTarget(caller, rows[0]);
    if (guard) return guard;
    const u = rows[0];
    return Response.json({ user: { id: u.id, username: u.username, name: u.name, fullName: u.full_name, email: u.email, phone: u.phone, designation: u.designation, role: u.role, isActive: u.is_active, avatarUrl: u.avatar_url, createdAt: u.created_at } });
  } catch (error) {
    return handleRouteError(error) || Response.json({ error: "Failed to get user" }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const caller = await requireAdmin(request);
    const rows = await sql`SELECT id, role FROM users WHERE id = ${params.id}`;
    const guard = guardTarget(caller, rows[0]);
    if (guard) return guard;

    const { fullName, email, phone, designation, role, isActive } = await request.json();

    if (role !== undefined && caller.role !== 'superadmin') {
      return Response.json({ error: "Only superadmin can change roles" }, { status: 403 });
    }
    if (role === 'superadmin') {
      return Response.json({ error: "Cannot assign superadmin role" }, { status: 403 });
    }

    await sql`
      UPDATE users SET
        full_name   = COALESCE(${fullName ?? null}, full_name),
        name        = COALESCE(${fullName ?? null}, name),
        email       = COALESCE(${email !== undefined ? email?.toLowerCase() ?? null : null}, email),
        phone       = COALESCE(${phone ?? null}, phone),
        designation = COALESCE(${designation ?? null}, designation),
        role        = COALESCE(${(role !== undefined && caller.role === 'superadmin') ? role : null}, role),
        is_active   = COALESCE(${isActive ?? null}, is_active)
      WHERE id = ${params.id}
    `;

    return Response.json({ message: "User updated successfully" });
  } catch (error) {
    return handleRouteError(error) || Response.json({ error: "Failed to update user" }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const caller = await requireAdmin(request);
    const rows = await sql`SELECT id, role FROM users WHERE id = ${params.id}`;
    const guard = guardTarget(caller, rows[0]);
    if (guard) return guard;

    await sql`UPDATE users SET is_active = false WHERE id = ${params.id}`;
    await sql`DELETE FROM sessions WHERE user_id = ${params.id}`;

    return Response.json({ message: "User deactivated successfully" });
  } catch (error) {
    return handleRouteError(error) || Response.json({ error: "Failed to delete user" }, { status: 500 });
  }
}
