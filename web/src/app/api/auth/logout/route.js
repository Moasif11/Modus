import { requireAuth, deleteSession, logAudit, handleRouteError, getTokenFromRequest, clearSessionCookie } from "@/app/api/utils/auth";

export async function POST(request) {
  try {
    const user = await requireAuth(request);
    const token = getTokenFromRequest(request);

    if (token) await deleteSession(token);

    await logAudit({
      userId: user.id,
      action: "logout",
      entityType: "user",
      entityId: user.id,
      metadata: { email: user.email },
      request,
    });

    return Response.json(
      { message: "Logged out successfully" },
      { headers: { "Set-Cookie": clearSessionCookie() } },
    );
  } catch (error) {
    return handleRouteError(error) || (console.error("Logout error:", error), Response.json({ error: "Logout failed" }, { status: 500 }));
  }
}
