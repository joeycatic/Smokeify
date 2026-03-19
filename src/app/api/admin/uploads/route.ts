import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { randomUUID } from "crypto";
import { requireAdmin } from "@/lib/adminCatalog";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { isSameOrigin } from "@/lib/requestSecurity";
import { logAdminAction } from "@/lib/adminAuditLog";
import { detectImageFromBuffer } from "@/lib/uploadValidation";

const MAX_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_ADMIN_IMAGE_FORMATS = new Set(["jpeg", "png", "webp", "gif", "avif"]);

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const ip = getClientIp(request.headers);
  const ipLimit = await checkRateLimit({
    key: `admin-uploads:ip:${ip}`,
    limit: 30,
    windowMs: 10 * 60 * 1000,
  });
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { error: "Zu viele Anfragen. Bitte später erneut versuchen." },
      { status: 429 }
    );
  }
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "File is required" }, { status: 400 });
  }

  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json(
      { error: "Image must be 5MB or smaller" },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const detectedImage = detectImageFromBuffer(buffer);
  if (!detectedImage || !ALLOWED_ADMIN_IMAGE_FORMATS.has(detectedImage.format)) {
    return NextResponse.json(
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

  return NextResponse.json({ url: blob.url });
}
