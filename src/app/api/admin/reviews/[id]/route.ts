import { type ReviewStatus } from "@prisma/client";
import { requireAdmin } from "@/lib/adminCatalog";
import { logAdminAction } from "@/lib/adminAuditLog";
import { adminJson } from "@/lib/adminApi";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { isSameOrigin } from "@/lib/requestSecurity";

const REVIEW_STATUSES = new Set<ReviewStatus>(["APPROVED", "PENDING", "REJECTED"]);

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!isSameOrigin(request)) {
    return adminJson({ error: "Forbidden" }, { status: 403 });
  }

  const ip = getClientIp(request.headers);
  const limit = await checkRateLimit({
    key: `admin-review-patch:${ip}`,
    limit: 60,
    windowMs: 10 * 60 * 1000,
  });
  if (!limit.allowed) {
    return adminJson({ error: "Too many requests" }, { status: 429 });
  }

  const session = await requireAdmin();
  if (!session) {
    return adminJson({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    status?: ReviewStatus;
  };
  if (!body.status || !REVIEW_STATUSES.has(body.status)) {
    return adminJson({ error: "Invalid review status." }, { status: 400 });
  }

  const { id } = await context.params;
  const existing = await prisma.review.findUnique({
    where: { id },
    include: {
      product: {
        select: {
          id: true,
          title: true,
          handle: true,
        },
      },
      user: {
        select: {
          id: true,
          email: true,
        },
      },
    },
  });

  if (!existing) {
    return adminJson({ error: "Review not found." }, { status: 404 });
  }

  const updated =
    existing.status === body.status
      ? existing
      : await prisma.review.update({
          where: { id },
          data: { status: body.status },
          include: {
            product: {
              select: {
                id: true,
                title: true,
                handle: true,
              },
            },
            user: {
              select: {
                id: true,
                email: true,
              },
            },
          },
        });

  await logAdminAction({
    actor: { id: session.user.id, email: session.user.email ?? null },
    action: "review.update",
    targetType: "review",
    targetId: updated.id,
    summary: `Set review status to ${updated.status}`,
    metadata: {
      productId: updated.productId,
      productTitle: updated.product.title,
      reviewerUserId: updated.userId,
      reviewerEmail: updated.user?.email ?? null,
      previousStatus: existing.status,
      nextStatus: updated.status,
    },
  });

  return adminJson({
    review: {
      id: updated.id,
      status: updated.status,
      updatedAt: updated.updatedAt.toISOString(),
    },
  });
}
