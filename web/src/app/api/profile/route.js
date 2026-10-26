import sql from "@/app/api/utils/sql";
import { requireAuth, handleRouteError } from "@/app/api/utils/auth";

async function ensureProfileColumns() {
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS country TEXT`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS department TEXT`;
}

export async function GET(request) {
  try {
    const user = await requireAuth(request);
    await ensureProfileColumns();
    const rows = await sql`
      SELECT id, username, name, full_name, email, phone, designation, country, department, role, avatar_url, is_active, created_at
      FROM users WHERE id = ${user.id}
    `;
    const u = rows[0];
    return Response.json({ user: {
      id: u.id, username: u.username, name: u.name, fullName: u.full_name,
      email: u.email, phone: u.phone, designation: u.designation,
      country: u.country, department: u.department, role: u.role,
      avatarUrl: u.avatar_url, isActive: u.is_active, createdAt: u.created_at,
    }});
  } catch (error) {
    return handleRouteError(error) || Response.json({ error: "Failed to get profile" }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const user = await requireAuth(request);
    await ensureProfileColumns();
    const { fullName, email, phone, designation, country, department, avatarUrl } = await request.json();

    const emailVal = email?.trim() || null;
    if (emailVal && !emailVal.includes('@')) {
      return Response.json({ error: "Invalid email format" }, { status: 400 });
    }

    await sql`
      UPDATE users SET
        full_name   = COALESCE(${fullName?.trim() || null}, full_name),
        name        = COALESCE(${fullName?.trim() || null}, name),
        email       = COALESCE(${emailVal?.toLowerCase() ?? null}, email),
        phone       = COALESCE(${phone ?? null}, phone),
        designation = COALESCE(${designation ?? null}, designation),
        country     = COALESCE(${country ?? null}, country),
        department  = COALESCE(${department ?? null}, department),
        avatar_url  = COALESCE(${avatarUrl ?? null}, avatar_url)
      WHERE id = ${user.id}
    `;

    return Response.json({ message: "Profile updated successfully" });
  } catch (error) {
    if (error.message?.includes('unique') || error.code === '23505') {
      return Response.json({ error: "Email already in use by another account" }, { status: 409 });
    }
    return handleRouteError(error) || Response.json({ error: "Failed to update profile" }, { status: 500 });
  }
}
