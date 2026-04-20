import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminCatalog";
import { logAdminAction } from "@/lib/adminAuditLog";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { isSameOrigin } from "@/lib/requestSecurity";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const ip = getClientIp(request.headers);
  const limit = await checkRateLimit({
    key: `admin-analyzer-image-redact:ip:${ip}`,
    limit: 30,
    windowMs: 10 * 60 * 1000,
  });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many analyzer image redactions." },
      { status: 429 },
    );
  }

  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const existing = await prisma.plantAnalysisRun.findUnique({
    where: { id },
    select: {
      id: true,
      imageUri: true,
      imageDeletedAt: true,
      reviewStatus: true,
      safetyFlags: true,
    },
  });
  if (!existing) {
    return NextResponse.json({ error: "Analysis not found." }, { status: 404 });
  }

  if (existing.imageDeletedAt) {
    return NextResponse.json({ ok: true, alreadyDeleted: true });
  }

  const now = new Date();
  await prisma.$transaction([
    prisma.plantAnalysisRun.update({
      where: { id },
      data: {
        imageUri: null,
        imageDeletedAt: now,
        reviewStatus: "PRIVACY_REVIEW",
        safetyFlags: Array.from(
          new Set([...existing.safetyFlags, "PRIVACY_SENSITIVE_IMAGE"]),
        ),
      },
    }),
    prisma.plantAnalysisReviewEvent.create({
      data: {
        analysisId: id,
        actorId: session.user.id,
        actorEmail: session.user.email ?? null,
        fromStatus: existing.reviewStatus,
        toStatus: "PRIVACY_REVIEW",
        safetyFlags: Array.from(
          new Set([...existing.safetyFlags, "PRIVACY_SENSITIVE_IMAGE"]),
        ),
        notes: "Image URI redacted by admin.",
        metadata: {
          source: "admin.analyzer.image.delete",
          hadImageUri: Boolean(existing.imageUri),
        },
      },
    }),
  ]);

  await logAdminAction({
    actor: { id: session.user.id, email: session.user.email ?? null },
    action: "plant_analysis.image.redact",
    targetType: "plant_analysis_run",
    targetId: id,
    summary: "Redacted plant analysis image URI",
    metadata: { hadImageUri: Boolean(existing.imageUri) },
  });

  return NextResponse.json({ ok: true, imageDeletedAt: now.toISOString() });
}

