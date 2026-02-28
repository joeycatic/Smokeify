import { NextResponse } from "next/server";
import { getProducts } from "@/lib/catalog";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const ip = getClientIp(request.headers);
  const ipLimit = await checkRateLimit({
    key: `mobile-products:ip:${ip}`,
    limit: 120,
    windowMs: 60 * 1000,
  });

  if (!ipLimit.allowed) {
    return NextResponse.json({ products: [] }, { status: 429 });
  }

  const { searchParams } = new URL(request.url);
  const requestedLimit = Number(searchParams.get("limit") ?? "200");
  const limit = Number.isFinite(requestedLimit)
    ? Math.max(1, Math.min(500, Math.floor(requestedLimit)))
    : 200;

  const products = await getProducts(limit);
  const productMeta = await prisma.product.findMany({
    where: { id: { in: products.map((product) => product.id) } },
    select: { id: true, technicalDetails: true },
  });
  const technicalDetailsById = new Map(
    productMeta.map((item) => [item.id, item.technicalDetails ?? ""]),
  );
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3900").replace(/\/+$/, "");
  const toAbsoluteUrl = (value?: string | null) => {
    if (!value) return null;
    if (value.startsWith("http://") || value.startsWith("https://")) return value;
    return `${appUrl}${value.startsWith("/") ? "" : "/"}${value}`;
  };
  const toPlainText = (value?: string | null) =>
    (value ?? "")
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  const toShortText = (value: string, max = 170) =>
    value.length <= max ? value : `${value.slice(0, max).trimEnd()}...`;

  const result = products.map((product) => {
    const shortSource = toPlainText(product.shortDescription);
    const shortDescription = shortSource ? toShortText(shortSource) : "";

    return {
      id: product.id,
      handle: product.handle,
      title: product.title,
      subtitle: product.shortDescription ?? product.description ?? "",
      shortDescription,
      description: product.description ?? "",
      technicalDetails: technicalDetailsById.get(product.id) ?? "",
      price: product.priceRange.minVariantPrice,
      inventoryStatus: product.availableForSale
        ? product.lowStock
          ? "low-stock"
          : "in-stock"
        : "sold-out",
      rating: Number((product.reviewSummary?.average ?? 0).toFixed(1)),
      tags: product.tags ?? [],
      checkoutUrl: `https://www.smokeify.de/products/${product.handle}`,
      imageUrl: toAbsoluteUrl(product.featuredImage?.url),
    };
  });

  return NextResponse.json({ products: result });
}
