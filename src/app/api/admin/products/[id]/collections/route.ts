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

  return NextResponse.json({ ok: true });
}
