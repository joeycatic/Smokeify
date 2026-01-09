import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminCatalog";

export async function PUT(
  request: Request,
  context: { params: { id: string } }
) {
  const { id } = await Promise.resolve(context.params);
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { categoryIds?: string[] };
  const categoryIds = Array.isArray(body.categoryIds) ? body.categoryIds : [];

  await prisma.$transaction([
    prisma.productCategory.deleteMany({ where: { productId: id } }),
    prisma.productCategory.createMany({
      data: categoryIds.map((categoryId, index) => ({
        productId: id,
        categoryId,
        position: index,
      })),
    }),
  ]);

  return NextResponse.json({ ok: true });
}
