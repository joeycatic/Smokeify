import { NextResponse } from "next/server";
import { getProductByHandle } from "@/lib/catalog";
import { prisma } from "@/lib/prisma";
import { getProductRecommendations } from "@/lib/recommendations";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

export async function GET(request: Request) {
  const ip = getClientIp(request.headers);
  const ipLimit = await checkRateLimit({
    key: `recommendations:ip:${ip}`,
    limit: 120,
    windowMs: 60 * 1000,
  });
  if (!ipLimit.allowed) {
    return NextResponse.json({ results: [] }, { status: 429 });
  }

  const { searchParams } = new URL(request.url);
  const handle = (searchParams.get("handle") ?? "").trim();
  const variantId = (searchParams.get("variantId") ?? "").trim();
  if (!handle && !variantId) {
    return NextResponse.json({ results: [] });
  }

  const resolvedHandle =
    handle ||
    (
      await prisma.variant.findUnique({
        where: { id: variantId },
        select: { product: { select: { handle: true } } },
      })
    )?.product.handle ||
    "";
  const product = resolvedHandle
    ? await getProductByHandle(resolvedHandle)
    : null;
  if (!product) {
    return NextResponse.json({ results: [] });
  }

  const recommendationResult = await getProductRecommendations({
    productId: product.id,
    storefront: "MAIN",
    limit: 4,
  });

  const results =
    recommendationResult?.recommendations.slice(0, 4).map((entry) => ({
      id: entry.id,
      title: entry.title,
      handle: entry.handle,
      variantId: entry.variantId,
      availableForSale: entry.availableForSale,
      imageUrl: entry.imageUrl,
      imageAlt: entry.imageAlt ?? entry.title,
      price: entry.price,
    })) ?? [];

  return NextResponse.json({ results });
}
