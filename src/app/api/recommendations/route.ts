import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

const CURRENCY_CODE = "EUR";

const toAmount = (cents: number) => (cents / 100).toFixed(2);

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
  if (!handle) {
    return NextResponse.json({ results: [] });
  }

  const product = await prisma.product.findFirst({
    where: { handle },
    select: {
      id: true,
      categories: { select: { categoryId: true } },
    },
  });

  if (!product) {
    return NextResponse.json({ results: [] });
  }

  const categoryIds = product.categories.map((entry) => entry.categoryId);
  const baseWhere: Prisma.ProductWhereInput = {
    status: "ACTIVE",
    id: { not: product.id },
  };

  const primaryProducts = categoryIds.length
    ? await prisma.product.findMany({
        where: {
          ...baseWhere,
          categories: { some: { categoryId: { in: categoryIds } } },
        },
        orderBy: { updatedAt: "desc" },
        take: 6,
        include: {
          images: { orderBy: { position: "asc" }, take: 1 },
          variants: { orderBy: { position: "asc" }, select: { priceCents: true } },
        },
      })
    : [];

  const primaryIds = new Set(primaryProducts.map((entry) => entry.id));
  const needed = Math.max(0, 4 - primaryProducts.length);
  const fallbackProducts =
    needed > 0
      ? await prisma.product.findMany({
          where: {
            ...baseWhere,
            id: { notIn: [product.id, ...Array.from(primaryIds)] },
          },
          orderBy: { updatedAt: "desc" },
          take: needed,
          include: {
            images: { orderBy: { position: "asc" }, take: 1 },
            variants: { orderBy: { position: "asc" }, select: { priceCents: true } },
          },
        })
      : [];

  const combined = [...primaryProducts, ...fallbackProducts].slice(0, 4);
  const results = combined.map((entry) => {
    const prices = entry.variants.map((variant) => variant.priceCents);
    const minPrice = prices.length > 0 ? Math.min(...prices) : null;
    const image = entry.images[0] ?? null;
    return {
      id: entry.id,
      title: entry.title,
      handle: entry.handle,
      imageUrl: image?.url ?? null,
      imageAlt: image?.altText ?? entry.title,
      price:
        minPrice !== null
          ? { amount: toAmount(minPrice), currencyCode: CURRENCY_CODE }
          : null,
    };
  });

  return NextResponse.json({ results });
}
