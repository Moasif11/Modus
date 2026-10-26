import sql from "@/app/api/utils/sql";
import argon2 from "argon2";
import { requireAdmin, handleRouteError } from "@/app/api/utils/auth";

export async function GET(request) {
  try {
    const caller = await requireAdmin(request);
    const url = new URL(request.url);
    const search = url.searchParams.get("search") || "";

    let users;
    if (search) {
      users = await sql`
        SELECT id, username, name, full_name, email, phone, designation, role, is_active, avatar_url, created_at
        FROM users
        WHERE LOWER(name) LIKE LOWER(${"%" + search + "%"})
           OR LOWER(username) LIKE LOWER(${"%" + search + "%"})
           OR LOWER(COALESCE(email, '')) LIKE LOWER(${"%" + search + "%"})
        ORDER BY created_at ASC
      `;
    } else {
      users = await sql`
        SELECT id, username, name, full_name, email, phone, designation, role, is_active, avatar_url, created_at
        FROM users
        ORDER BY created_at ASC
      `;
    }

    return Response.json({ users: users.map(u => ({
      id: u.id,
      username: u.username,
      name: u.name,
      fullName: u.full_name,
      email: u.email,
      phone: u.phone,
      designation: u.designation,
      role: u.role,
      isActive: u.is_active,
      avatarUrl: u.avatar_url,
      createdAt: u.created_at,
    }))});
  } catch (error) {
    return handleRouteError(error) || Response.json({ error: "Failed to get users" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const caller = await requireAdmin(request);
    const { username, fullName, email, phone, designation, role, password } = await request.json();

    if (!username || !fullName) {
      return Response.json({ error: "Username and full name are required" }, { status: 400 });
    }

    if (role === 'superadmin') {
      return Response.json({ error: "Cannot assign superadmin role" }, { status: 403 });
    }
    if (role === 'admin' && caller.role !== 'superadmin') {
      return Response.json({ error: "Only superadmin can create admin users" }, { status: 403 });
    }

    const assignRole = role || 'user';
    const plainPassword = password || 'Modus@123';
    const passwordHash = await argon2.hash(plainPassword);

    const result = await sql`
      INSERT INTO users (username, name, full_name, email, phone, designation, role, password_hash, must_reset_password, is_active, created_by)
      VALUES (
        ${username.toLowerCase()}, ${fullName}, ${fullName},
        ${email?.toLowerCase() || null}, ${phone || null}, ${designation || null},
        ${assignRole}, ${passwordHash}, true, true, ${caller.id}
      )
      RETURNING id, username, full_name, email, role, is_active, created_at
    `;

    return Response.json({ user: result[0], message: "User created successfully" });
  } catch (error) {
    if (error.message?.includes('unique') || error.code === '23505') {
      return Response.json({ error: "Username or email already exists" }, { status: 409 });
    }
    return handleRouteError(error) || Response.json({ error: "Failed to create user" }, { status: 500 });
  }
}
