import sql from "@/app/api/utils/sql";
import argon2 from "argon2";
import { requireSuperAdmin, handleRouteError } from "@/app/api/utils/auth";

export async function POST(request) {
  if (process.env.NODE_ENV === 'production') {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  try {
    await requireSuperAdmin(request);

    const existing = await sql`SELECT id FROM users WHERE role = 'user' LIMIT 1`;
    if (existing.length > 0) {
      return Response.json({ error: "Users already seeded" }, { status: 409 });
    }

    const passwordHash = await argon2.hash("Modus@Demo2026");

    const users = [
      { username: "alex",   fullName: "Alex Miller" },
      { username: "sam",    fullName: "Sam Chen" },
      { username: "jordan", fullName: "Jordan Lee" },
      { username: "taylor", fullName: "Taylor Swift" },
      { username: "morgan", fullName: "Morgan Davis" },
      { username: "casey",  fullName: "Casey Wilson" },
    ];

    for (const u of users) {
      await sql`
        INSERT INTO users (username, name, full_name, password_hash, role, must_reset_password, is_active)
        VALUES (${u.username}, ${u.fullName}, ${u.fullName}, ${passwordHash}, 'user', true, true)
      `;
    }

    return Response.json({ message: "Seeded 6 users successfully", users: users.map(u => u.username) });
  } catch (error) {
    return handleRouteError(error) || (console.error("Seed users error:", error), Response.json({ error: "Failed to seed users" }, { status: 500 }));
  }
}
