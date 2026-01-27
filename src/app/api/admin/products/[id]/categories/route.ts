import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminCatalog";

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
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

  return NextResponse.json({ ok: true });
}
