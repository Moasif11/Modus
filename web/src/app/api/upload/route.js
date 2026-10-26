import { requireAuth, requireAdmin } from "@/app/api/utils/auth";
import { uploadToR2, deleteFromR2 } from "@/app/api/utils/r2";

// Allowed upload types — receipts/documents (PDF, Office) and images.
const ALLOWED = {
  "application/pdf": ".pdf",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
};

// Verify content actually matches the claimed type (magic bytes).
// DOCX/XLSX are ZIP containers (PK..) — for those the extension picks the exact type.
function sniffType(bytes, fileName = "") {
  if (bytes.length >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return "application/pdf"; // %PDF
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png"; // \x89PNG
  if (bytes.length >= 12 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return "image/webp"; // RIFF....WEBP
  if (bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) {
    const lower = String(fileName).toLowerCase();
    if (lower.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    if (lower.endsWith(".xlsx")) return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    return null; // arbitrary ZIPs not allowed
  }
  return null;
}

export async function POST(request) {
  try {
    // 1. Authenticate user
    await requireAuth(request);

    // 2. Parse FormData
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file) {
      return Response.json({ error: "No file provided" }, { status: 400 });
    }

    // 3. Convert file to buffer and validate size (5MB limit)
    const buffer = await file.arrayBuffer();
    if (buffer.byteLength > 5 * 1024 * 1024) {
      return Response.json({ error: "File must be under 5MB" }, { status: 400 });
    }

    // 4. Validate type by content, not by filename/claimed MIME
    const contentType = sniffType(new Uint8Array(buffer.slice(0, 16)), file.name);
    if (!contentType || !ALLOWED[contentType]) {
      return Response.json(
        { error: "Unsupported file type. Allowed: PDF, JPG, PNG, WebP, DOCX, XLSX" },
        { status: 400 },
      );
    }
    const isPdf = contentType === "application/pdf";
    const isImage = contentType.startsWith("image/");

    // Generate unique ID
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const filename = `file-${timestamp}-${random}${ALLOWED[contentType]}`;

    // Categorize prefix folder on R2 bucket
    const prefix = isPdf ? "receipts" : isImage ? "images" : "docs";
    const objectKey = `${prefix}/${filename}`;

    // 5. Upload to Cloudflare R2
    const url = await uploadToR2(buffer, objectKey, contentType);

    return Response.json({ url, objectKey });
  } catch (error) {
    if (error.message === "UNAUTHORIZED") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Upload error:", error);
    return Response.json({ error: "Upload failed" }, { status: 500 });
  }
}

// Only keys created by this endpoint can be deleted — never arbitrary bucket paths.
const DELETABLE_KEY = /^(receipts|images|docs)\/file-\d+-[a-z0-9]+\.(pdf|jpg|jpeg|png|webp|gif|heic|docx|xlsx)$/i;

export async function DELETE(request) {
  try {
    // 1. Authenticate: destructive, so admin+ only
    await requireAdmin(request);

    // 2. Parse request body
    const body = await request.json();
    const { objectKey } = body;

    if (!objectKey || !DELETABLE_KEY.test(objectKey)) {
      return Response.json({ error: "Invalid objectKey" }, { status: 400 });
    }

    // 3. Delete from Cloudflare R2
    await deleteFromR2(objectKey);

    return Response.json({ success: true });
  } catch (error) {
    if (error.message === "UNAUTHORIZED") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error.message === "FORBIDDEN") {
      return Response.json({ error: "Only admins can delete uploaded files" }, { status: 403 });
    }
    console.error("Delete from R2 error:", error);
    return Response.json({ error: "Delete failed" }, { status: 500 });
  }
}
