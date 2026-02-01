import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminCatalog";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { isSameOrigin } from "@/lib/requestSecurity";
import { logAdminAction } from "@/lib/adminAuditLog";

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const ip = getClientIp(request.headers);
  const ipLimit = await checkRateLimit({
    key: `admin-product-collections:ip:${ip}`,
    limit: 60,
    windowMs: 10 * 60 * 1000,
  });
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { error: "Zu viele Anfragen. Bitte später erneut versuchen." },
      { status: 429 }
    );
  }
  const { id } = await context.params;
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { collectionIds?: string[] };
  const collectionIds = Array.isArray(body.collectionIds)
    ? body.collectionIds
    : [];

  await prisma.$transaction([
    prisma.productCollection.deleteMany({
      where: { productId: id },
    }),
    prisma.productCollection.createMany({
      data: collectionIds.map((collectionId, index) => ({
        productId: id,
        collectionId,
        position: index,
      })),
    }),
  ]);

  await logAdminAction({
    actor: { id: session.user.id, email: session.user.email ?? null },
    action: "product.collections.update",
    targetType: "product",
    targetId: id,
    summary: `Set ${collectionIds.length} collections`,
    metadata: { collectionIds },
  });

  return NextResponse.json({ ok: true });
}
