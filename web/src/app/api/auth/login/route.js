import sql from "@/app/api/utils/sql";
import argon2 from "argon2";
import {
  createSession,
  checkRateLimitDb,
  getClientIp,
  logAudit,
  sessionCookie,
} from "@/app/api/utils/auth";

export async function POST(request) {
  try {
    const body = await request.json();
    const { username, email, password } = body;
    const loginId = username || email;

    if (!loginId || !password) {
      return Response.json(
        { error: "Username and password are required" },
        { status: 400 },
      );
    }

    // Rate limiting
    const clientIp = getClientIp(request);
    const rateLimitKey = `login:${clientIp}`;

    if (!(await checkRateLimitDb(rateLimitKey, 10, 60000))) {
      return Response.json(
        { error: "Too many login attempts. Please try again later." },
        { status: 429 },
      );
    }

    // Find user by username or email
    const users = await sql`
      SELECT id, email, password_hash, name, role, must_reset_password, is_active
      FROM users
      WHERE username = ${loginId} OR email = ${loginId.toLowerCase()}
      LIMIT 1
    `;

    if (users.length === 0) {
      return Response.json(
        { error: "Invalid email or password" },
        { status: 401 },
      );
    }

    const user = users[0];

    // Deactivated accounts get the same generic error — don't confirm the
    // credentials still work for an account we've disabled.
    if (!user.is_active) {
      return Response.json(
        { error: "Invalid email or password" },
        { status: 401 },
      );
    }

    // Verify password
    const isValidPassword = await argon2.verify(user.password_hash, password);

    if (!isValidPassword) {
      return Response.json(
        { error: "Invalid email or password" },
        { status: 401 },
      );
    }

    // Create session
    const { token, expiresAt } = await createSession(user.id, request);

    // Update last login
    await sql`
      UPDATE users
      SET last_login_at = NOW()
      WHERE id = ${user.id}
    `;

    // Log audit
    await logAudit({
      userId: user.id,
      action: "login",
      entityType: "user",
      entityId: user.id,
      metadata: { email: user.email },
      request,
    });

    // Session travels in an httpOnly cookie; token also returned for legacy/mobile clients.
    return Response.json(
      {
        token,
        expiresAt,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          must_reset_password: user.must_reset_password,
        },
      },
      { headers: { "Set-Cookie": sessionCookie(token, 7 * 24 * 60 * 60) } },
    );
  } catch (error) {
    console.error("Login error:", error);
    return Response.json({ error: "Login failed" }, { status: 500 });
  }
}
