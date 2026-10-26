import { getCurrentUser } from "@/app/api/utils/auth";

export async function GET(request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    return Response.json({ user });
  } catch (error) {
    console.error("Get user error:", error);
    return Response.json({ error: "Failed to get user" }, { status: 500 });
  }
}
