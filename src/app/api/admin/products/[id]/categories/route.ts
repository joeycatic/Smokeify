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
    key: `admin-product-categories:ip:${ip}`,
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

  const body = (await request.json()) as { categoryIds?: string[] };
  const categoryIds = Array.isArray(body.categoryIds) ? body.categoryIds : [];
  const parentCategories = categoryIds.length
    ? await prisma.category.findMany({
        where: { id: { in: categoryIds }, parentId: null },
        select: { id: true },
      })
    : [];
  const parentCategoryIds = new Set(parentCategories.map((item) => item.id));
  const mainCategoryId =
    categoryIds.find((id) => parentCategoryIds.has(id)) ?? null;

  await prisma.$transaction([
    prisma.productCategory.deleteMany({ where: { productId: id } }),
    prisma.productCategory.createMany({
      data: categoryIds.map((categoryId, index) => ({
        productId: id,
        categoryId,
        position: index,
      })),
    }),
    prisma.product.update({
      where: { id },
      data: { mainCategoryId },
    }),
  ]);

  await logAdminAction({
    actor: { id: session.user.id, email: session.user.email ?? null },
    action: "product.categories.update",
    targetType: "product",
    targetId: id,
    summary: `Set ${categoryIds.length} categories`,
    metadata: { categoryIds, mainCategoryId },
  });

  return NextResponse.json({ ok: true });
}
