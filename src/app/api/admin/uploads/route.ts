import { put } from "@vercel/blob";
import { randomUUID } from "crypto";
import { adminJson } from "@/lib/adminApi";
import { withAdminRoute } from "@/lib/adminRoute";
import { logAdminAction } from "@/lib/adminAuditLog";
import { detectImageFromBuffer } from "@/lib/uploadValidation";

const MAX_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_ADMIN_IMAGE_FORMATS = new Set(["jpeg", "png", "webp", "gif", "avif"]);

export const POST = withAdminRoute(
  async ({ request, session }) => {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return adminJson({ error: "File is required" }, { status: 400 });
    }

    if (file.size > MAX_SIZE_BYTES) {
      return adminJson(
        { error: "Image must be 5MB or smaller" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const detectedImage = detectImageFromBuffer(buffer);
    if (!detectedImage || !ALLOWED_ADMIN_IMAGE_FORMATS.has(detectedImage.format)) {
      return adminJson(
        { error: "Only JPEG, PNG, WebP, GIF, and AVIF images are allowed" },
        { status: 400 }
      );
    }

    const filename = `${randomUUID()}${detectedImage.extension}`;

    const blob = await put(`uploads/${filename}`, buffer, {
      access: "public",
      addRandomSuffix: false,
      contentType: detectedImage.mime,
    });

    await logAdminAction({
      actor: { id: session.user.id, email: session.user.email ?? null },
      action: "upload.create",
      targetType: "upload",
      targetId: blob.url,
      summary: `Uploaded ${filename}`,
      metadata: { url: blob.url, size: file.size, type: detectedImage.mime },
    });

    return adminJson({ url: blob.url });
  },
  {
    action: "catalog.product.write",
    rateLimit: {
      keyPrefix: "admin-uploads",
      limit: 30,
      windowMs: 10 * 60 * 1000,
      message: "Zu viele Anfragen. Bitte spater erneut versuchen.",
    },
  },
);
