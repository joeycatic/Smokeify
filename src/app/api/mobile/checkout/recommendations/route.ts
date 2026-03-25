import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getProductRecommendations } from "@/lib/recommendations";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

const CURRENCY_CODE = "EUR";
const MAX_RESULTS = 6;

const toAmount = (cents: number) => (cents / 100).toFixed(2);

const isProductAvailable = (product: {
  variants: Array<{ inventory: { quantityOnHand: number; reserved: number } | null }>;
}) =>
  product.variants.some((variant) => {
    const onHand = variant.inventory?.quantityOnHand ?? 0;
    const reserved = variant.inventory?.reserved ?? 0;
    return onHand - reserved > 0;
  });

const toResponseProduct = (product: {
  id: string;
  handle: string;
  title: string;
  images: Array<{ url: string }>;
  variants: Array<{ priceCents: number }>;
}) => {
  const minPriceCents =
    product.variants.length > 0
      ? product.variants.reduce(
          (min, variant) => (variant.priceCents < min ? variant.priceCents : min),
          product.variants[0].priceCents,
        )
      : null;
  return {
    id: product.id,
    handle: product.handle,
    title: product.title,
    imageUrl: product.images[0]?.url ?? null,
    price:
      minPriceCents !== null
        ? { amount: toAmount(minPriceCents), currencyCode: CURRENCY_CODE }
        : null,
  };
};

export async function POST(request: Request) {
  const ip = getClientIp(request.headers);
  const ipLimit = await checkRateLimit({
    key: `mobile-checkout-recommendations:ip:${ip}`,
    limit: 120,
    windowMs: 60 * 1000,
  });
  if (!ipLimit.allowed) {
    return NextResponse.json({ productIds: [], products: [] }, { status: 429 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    productIds?: string[];
    country?: string;
    subtotal?: number;
    missingForFreeShipping?: number;
  };
  const productIds = Array.isArray(body.productIds)
    ? Array.from(new Set(body.productIds.filter((id): id is string => typeof id === "string" && id.length > 0)))
    : [];
  if (productIds.length === 0) {
    return NextResponse.json({ productIds: [], products: [] });
  }

  const cartProductIds = new Set(productIds);

  const selected = new Map<
    string,
    {
      id: string;
      handle: string;
      title: string;
      images: Array<{ url: string }>;
      variants: Array<{ priceCents: number }>;
    }
  >();
  const tryAdd = (product: {
    id: string;
    handle: string;
    title: string;
    status?: string;
    images: Array<{ url: string }>;
    variants: Array<{ priceCents: number; inventory: { quantityOnHand: number; reserved: number } | null }>;
  }) => {
    if (selected.size >= MAX_RESULTS) return;
    if (cartProductIds.has(product.id)) return;
    if (selected.has(product.id)) return;
    if (product.status && product.status !== "ACTIVE") return;
    if (!isProductAvailable(product)) return;
    selected.set(product.id, {
      id: product.id,
      handle: product.handle,
      title: product.title,
      images: product.images,
      variants: product.variants.map((variant) => ({ priceCents: variant.priceCents })),
    });
  };

  const recommendationResults = await Promise.all(
    productIds.map((productId) =>
      getProductRecommendations({
        productId,
        storefront: "MAIN",
        limit: MAX_RESULTS,
      }),
    ),
  );

  recommendationResults.forEach((result) => {
    result?.recommendations.forEach((item) => {
      tryAdd({
        id: item.id,
        handle: item.handle,
        title: item.title,
        status: "ACTIVE",
        images: item.imageUrl ? [{ url: item.imageUrl }] : [],
        variants: item.price
          ? [
              {
                priceCents: Math.round(Number(item.price.amount) * 100),
                inventory: item.availableForSale
                  ? { quantityOnHand: 1, reserved: 0 }
                  : { quantityOnHand: 0, reserved: 0 },
              },
            ]
          : [],
      });
    });
  });

  if (selected.size < MAX_RESULTS) {
    const fallback = await prisma.product.findMany({
      where: {
        status: "ACTIVE",
        id: { notIn: [...cartProductIds, ...selected.keys()] },
      },
      orderBy: [{ bestsellerScore: "desc" }, { updatedAt: "desc" }],
      take: 30,
      select: {
        id: true,
        handle: true,
        title: true,
        images: { select: { url: true }, orderBy: { position: "asc" }, take: 1 },
        variants: {
          select: {
            priceCents: true,
            inventory: { select: { quantityOnHand: true, reserved: true } },
          },
          orderBy: { position: "asc" },
        },
      },
    });
    fallback.forEach((product) => tryAdd(product));
  }

  const products = Array.from(selected.values()).slice(0, MAX_RESULTS).map(toResponseProduct);
  return NextResponse.json({
    productIds: products.map((product) => product.id),
    products,
  });
}
