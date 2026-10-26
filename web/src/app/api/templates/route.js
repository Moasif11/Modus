import sql from "@/app/api/utils/sql";
import { requireAuth } from "@/app/api/utils/auth";

export async function GET(request) {
  try {
    await requireAuth(request);

    const templates = await sql`
      SELECT id, name, slug, description, preview_url, is_default, is_active, config_json
      FROM templates
      WHERE is_active = true
      ORDER BY is_default DESC, name ASC
    `;

    return Response.json({
      templates: templates.map((t) => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        description: t.description,
        previewUrl: t.preview_url,
        isDefault: t.is_default,
        isActive: t.is_active,
        config: t.config_json,
      })),
    });
  } catch (error) {
    if (error.message === "UNAUTHORIZED") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Get templates error:", error);
    return Response.json(
      { error: "Failed to get templates" },
      { status: 500 },
    );
  }
}
