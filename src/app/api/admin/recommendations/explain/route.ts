import { prisma } from "@/lib/prisma";
import { adminJson } from "@/lib/adminApi";
import { withAdminRoute } from "@/lib/adminRoute";
import { getProductRecommendations } from "@/lib/recommendations";

export const GET = withAdminRoute(async ({ request }) => {
  const { searchParams } = new URL(request.url);
  const productId = searchParams.get("productId")?.trim();
  if (!productId) {
    return adminJson({ error: "Missing product id." }, { status: 400 });
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
    return adminJson({ error: "Product not found." }, { status: 404 });
  }

  const result = await getProductRecommendations({
    productId,
    storefront: "MAIN",
    limit: 12,
  });
  if (!result) {
    return adminJson(
      { error: "Recommendation context unavailable." },
      { status: 404 },
    );
  }

  return adminJson({
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
});
