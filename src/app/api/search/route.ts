import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

const CURRENCY_CODE = "EUR";

const toAmount = (cents: number) => (cents / 100).toFixed(2);

export async function GET(request: Request) {
  const ip = getClientIp(request.headers);
  const ipLimit = await checkRateLimit({
    key: `search:ip:${ip}`,
    limit: 120,
    windowMs: 60 * 1000,
  });
  if (!ipLimit.allowed) {
    return NextResponse.json({ results: [] }, { status: 429 });
  }
  const { searchParams } = new URL(request.url);
  const rawQuery = searchParams.get("q") ?? "";
  const query = rawQuery.trim();
  if (!query) {
    return NextResponse.json({ results: [] });
  }

  const products = await prisma.product.findMany({
    where: {
      status: "ACTIVE",
      OR: [
        { title: { contains: query, mode: "insensitive" } },
        { handle: { contains: query, mode: "insensitive" } },
        { manufacturer: { contains: query, mode: "insensitive" } },
      ],
    },
    orderBy: { updatedAt: "desc" },
    take: 8,
    include: {
      images: { orderBy: { position: "asc" }, take: 1 },
      variants: { orderBy: { position: "asc" }, select: { priceCents: true } },
    },
  });

  const results = products.map((product) => {
    const prices = product.variants.map((variant) => variant.priceCents);
    const minPrice =
      prices.length > 0 ? Math.min(...prices) : null;
    const image = product.images[0] ?? null;
    return {
      id: product.id,
      title: product.title,
      handle: product.handle,
      imageUrl: image?.url ?? null,
      imageAlt: image?.altText ?? product.title,
      price: minPrice !== null
        ? { amount: toAmount(minPrice), currencyCode: CURRENCY_CODE }
        : null,
    };
  });

  return NextResponse.json({ results });
}
