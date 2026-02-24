import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminCatalog";
import { isSameOrigin } from "@/lib/requestSecurity";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!prisma.productCrossSell) {
    return NextResponse.json([], { status: 200 });
  }
  const { id } = await context.params;

  const crossSells = await prisma.productCrossSell.findMany({
    where: { productId: id },
    orderBy: { sortOrder: "asc" },
    include: {
      crossSell: {
        select: {
          id: true,
          title: true,
          handle: true,
          images: { take: 1, orderBy: { position: "asc" } },
        },
      },
    },
  });

  return NextResponse.json(
    crossSells.map((row) => ({
      id: row.crossSell.id,
      title: row.crossSell.title,
      handle: row.crossSell.handle,
      imageUrl: row.crossSell.images[0]?.url ?? null,
    }))
  );
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!prisma.productCrossSell) {
    return NextResponse.json(
      { error: "Cross-sell client not initialized. Restart server and run prisma generate." },
      { status: 503 }
    );
  }
  const { id } = await context.params;

  const body = (await request.json()) as { crossSellIds?: string[] };
  const crossSellIds = Array.isArray(body.crossSellIds) ? body.crossSellIds : [];

  // Validate that the product exists
  const product = await prisma.product.findUnique({ where: { id }, select: { id: true } });
  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  const deduped = Array.from(
    new Set(
      crossSellIds
        .filter((csId): csId is string => typeof csId === "string")
        .map((csId) => csId.trim())
        .filter(Boolean)
    )
  );
  const filtered = deduped.filter((csId) => csId !== id).slice(0, 3);

  if (filtered.length > 0) {
    const validCount = await prisma.product.count({
      where: {
        id: { in: filtered },
        status: "ACTIVE",
      },
    });
    if (validCount !== filtered.length) {
      return NextResponse.json(
        { error: "One or more cross-sell products are invalid" },
        { status: 400 }
      );
    }
  }

  await prisma.$transaction([
    prisma.productCrossSell.deleteMany({ where: { productId: id } }),
    prisma.productCrossSell.createMany({
      data: filtered.map((crossSellId, index) => ({
        productId: id,
        crossSellId,
        sortOrder: index,
      })),
    }),
  ]);

  return NextResponse.json({ ok: true });
}
