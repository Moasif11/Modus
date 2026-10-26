import { requireAuth } from "@/app/api/utils/auth";
import { uploadToR2, deleteFromR2 } from "@/app/api/utils/r2";
import sql from "@/app/api/utils/sql";

export async function POST(request) {
  try {
    const user = await requireAuth(request);

    const formData = await request.formData();
    const file = formData.get("file");

    if (!file) {
      return Response.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate type
    if (!file.type.startsWith("image/")) {
      return Response.json({ error: "Only image files are allowed" }, { status: 400 });
    }

    // Validate size (2MB)
    const buffer = await file.arrayBuffer();
    if (buffer.byteLength > 2 * 1024 * 1024) {
      return Response.json({ error: "Image must be under 2MB" }, { status: 400 });
    }

    // Self-healing database guard: add avatar_object_key to users table if missing
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_object_key TEXT`;

    // Fetch previous avatar key to perform cleanup from R2
    const currentUser = await sql`SELECT avatar_object_key FROM users WHERE id = ${user.id}`;
    if (currentUser.length > 0 && currentUser[0].avatar_object_key) {
      try {
        await deleteFromR2(currentUser[0].avatar_object_key);
      } catch (cleanupErr) {
        console.warn("Could not clean up previous avatar from R2:", cleanupErr.message);
      }
    }

    // Determine extension and path key
    const extension = file.name ? file.name.substring(file.name.lastIndexOf(".")) : ".png";
    const cleanExtension = extension.startsWith(".") ? extension : `.${extension}`;
    const objectKey = `avatars/user-${user.id}-${Date.now()}${cleanExtension}`;
    const contentType = file.type || "image/png";

    // Upload to Cloudflare R2
    const url = await uploadToR2(buffer, objectKey, contentType);

    // Save URL and key in database
    await sql`
      UPDATE users 
      SET avatar_url = ${url}, 
          avatar_object_key = ${objectKey} 
      WHERE id = ${user.id}
    `;

    return Response.json({ url });
  } catch (error) {
    if (error.message === "UNAUTHORIZED") return Response.json({ error: "Unauthorized" }, { status: 401 });
    console.error("Avatar upload error:", error);
    return Response.json({ error: "Upload failed: " + error.message }, { status: 500 });
  }
}
