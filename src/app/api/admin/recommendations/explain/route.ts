import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminCatalog";
import { getProductRecommendations } from "@/lib/recommendations";

export async function GET(request: Request) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const productId = searchParams.get("productId")?.trim();
  if (!productId) {
    return NextResponse.json({ error: "Missing product id." }, { status: 400 });
  }

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      title: true,
      handle: true,
      crossSells: {
        orderBy: { sortOrder: "asc" },
        include: {
          crossSell: {
            select: { id: true, title: true, handle: true },
          },
        },
      },
    },
  });
  if (!product) {
    return NextResponse.json({ error: "Product not found." }, { status: 404 });
  }

  const result = await getProductRecommendations({
    productId,
    storefront: "MAIN",
    limit: 12,
  });
  if (!result) {
    return NextResponse.json({ error: "Recommendation context unavailable." }, { status: 404 });
  }

  return NextResponse.json({
    product: result.product,
    matchedRules: result.matchedRules,
    legacyManualOverrides: product.crossSells.map((row) => ({
      id: row.crossSell.id,
      title: row.crossSell.title,
      handle: row.crossSell.handle,
      sortOrder: row.sortOrder,
    })),
    recommendations: result.recommendations,
  });
}
