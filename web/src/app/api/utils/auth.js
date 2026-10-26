import sql from "@/app/api/utils/sql";
import crypto from "crypto";

// Rate limiting store (in-memory)
const rateLimitStore = new Map();

// Rate limit helper
export function checkRateLimit(key, maxRequests = 10, windowMs = 60000) {
  const now = Date.now();

  // Evict expired entries so the store can't grow unbounded.
  if (rateLimitStore.size > 1000) {
    for (const [k, v] of rateLimitStore) {
      if (now > v.resetAt) rateLimitStore.delete(k);
    }
  }
  const record = rateLimitStore.get(key) || {
    count: 0,
    resetAt: now + windowMs,
  };

  if (now > record.resetAt) {
    record.count = 1;
    record.resetAt = now + windowMs;
  } else {
    record.count++;
  }

  rateLimitStore.set(key, record);

  return record.count <= maxRequests;
}

// DB-backed rate limit — survives restarts and works across instances.
// Falls back to the in-memory limiter if the DB is unreachable.
let rateLimitTableReady = false;
export async function checkRateLimitDb(key, maxRequests = 10, windowMs = 60000) {
  try {
    if (!rateLimitTableReady) {
      await sql`CREATE TABLE IF NOT EXISTS rate_limits (key TEXT PRIMARY KEY, count INT NOT NULL, reset_at TIMESTAMPTZ NOT NULL)`;
      rateLimitTableReady = true;
    }
    const rows = await sql`
      INSERT INTO rate_limits (key, count, reset_at)
      VALUES (${key}, 1, NOW() + make_interval(secs => ${windowMs / 1000}))
      ON CONFLICT (key) DO UPDATE SET
        count = CASE WHEN rate_limits.reset_at < NOW() THEN 1 ELSE rate_limits.count + 1 END,
        reset_at = CASE WHEN rate_limits.reset_at < NOW() THEN NOW() + make_interval(secs => ${windowMs / 1000}) ELSE rate_limits.reset_at END
      RETURNING count
    `;
    return rows[0].count <= maxRequests;
  } catch (error) {
    console.error("DB rate limit failed, falling back to in-memory:", error.message);
    return checkRateLimit(key, maxRequests, windowMs);
  }
}

// Extract IP from request
export function getClientIp(request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return request.headers.get("x-real-ip") || "unknown";
}

// Get user agent
export function getUserAgent(request) {
  return request.headers.get("user-agent") || "unknown";
}

// Extract session token — Bearer header (legacy/mobile) or httpOnly cookie.
// Header must look like a real token (64 hex) — clients that send "Bearer null"
// after the cookie migration must fall through to the cookie.
export function getTokenFromRequest(request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const t = authHeader.substring(7);
    if (/^[a-f0-9]{64}$/.test(t)) return t;
  }
  const cookie = request.headers.get("cookie") || "";
  const match = cookie.match(/(?:^|;\s*)modus_session=([a-f0-9]{64})/);
  return match ? match[1] : null;
}

// Cookie attributes for the session token. SameSite=Strict + HttpOnly:
// JS can't read it (XSS can't exfiltrate) and cross-site requests don't carry it (CSRF).
export function sessionCookie(token, maxAgeSeconds) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `modus_session=${token}; HttpOnly; Path=/; SameSite=Strict; Max-Age=${maxAgeSeconds}${secure}`;
}

export function clearSessionCookie() {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `modus_session=; HttpOnly; Path=/; SameSite=Strict; Max-Age=0${secure}`;
}

// Validate session token and return user
export async function getCurrentUser(request) {
  const token = getTokenFromRequest(request);
  if (!token) return null;

  try {
    const sessions = await sql`
      SELECT s.token, u.id as user_id, u.email, u.name, u.full_name, u.role,
             u.must_reset_password, u.is_active, u.avatar_url, u.phone, u.designation
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.token = ${token}
        AND s.expires_at > NOW()
        AND u.is_active = true
      LIMIT 1
    `;
    if (sessions.length === 0) return null;
    const s = sessions[0];
    return {
      id: s.user_id,
      email: s.email,
      name: s.name,
      fullName: s.full_name,
      role: s.role,
      must_reset_password: s.must_reset_password,
      avatarUrl: s.avatar_url,
      phone: s.phone,
      designation: s.designation,
    };
  } catch (error) {
    console.error("Error validating session:", error);
    return null;
  }
}

// Require authentication (throws if not authenticated)
const RESET_EXEMPT_PATHS = ['/api/auth/reset-password', '/api/auth/logout'];

export async function requireAuth(request) {
  const user = await getCurrentUser(request);
  if (!user) throw new Error("UNAUTHORIZED");

  const url = new URL(request.url);
  const isExempt = RESET_EXEMPT_PATHS.some(p => url.pathname.startsWith(p));

  if (user.must_reset_password && !isExempt) {
    throw new Error("MUST_RESET_PASSWORD");
  }

  return user;
}

// Generate session token
export function generateSessionToken() {
  return crypto.randomBytes(32).toString("hex");
}

// Create session
export async function createSession(userId, request) {
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  const ipAddress = getClientIp(request);
  const userAgent = getUserAgent(request);

  await sql`
    INSERT INTO sessions (user_id, token, expires_at, ip_address, user_agent)
    VALUES (${userId}, ${token}, ${expiresAt}, ${ipAddress}, ${userAgent})
  `;

  return { token, expiresAt };
}

// Delete session
export async function deleteSession(token) {
  await sql`DELETE FROM sessions WHERE token = ${token}`;
}

// Clean up expired sessions
export async function cleanupExpiredSessions() {
  await sql`DELETE FROM sessions WHERE expires_at < NOW()`;
}

// Log audit event
export async function logAudit({
  userId,
  action,
  entityType,
  entityId,
  metadata,
  request,
}) {
  const ipAddress = request ? getClientIp(request) : null;

  await sql`
    INSERT INTO audit_logs (user_id, action, entity_type, entity_id, metadata_json, ip_address)
    VALUES (${userId || null}, ${action}, ${entityType || null}, ${entityId || null}, ${JSON.stringify(metadata || {})}, ${ipAddress})
  `;
}

export async function requireSuperAdmin(request) {
  const user = await requireAuth(request);
  if (user.role !== 'superadmin') throw new Error('FORBIDDEN');
  return user;
}

export async function requireAdmin(request) {
  const user = await requireAuth(request);
  if (user.role !== 'superadmin' && user.role !== 'admin') throw new Error('FORBIDDEN');
  return user;
}

export async function requireOwnerOrAdmin(request, ownerId) {
  const user = await requireAuth(request);
  const isAdmin = user.role === 'superadmin' || user.role === 'admin';
  if (!isAdmin && Number(user.id) !== Number(ownerId)) throw new Error('FORBIDDEN');
  return user;
}

export function handleRouteError(error) {
  if (error.message === "UNAUTHORIZED") return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (error.message === "FORBIDDEN") return Response.json({ error: "Forbidden" }, { status: 403 });
  if (error.message === "MUST_RESET_PASSWORD") return Response.json({ error: "Password reset required", code: "MUST_RESET_PASSWORD" }, { status: 403 });
  return null;
}
