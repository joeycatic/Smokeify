import type { Metadata } from "next";
import PageLayout from "@/components/PageLayout";
import ProductsClient from "@/app/products/ProductsClient";
import { getProducts, getProductsByIds } from "@/lib/catalog";
import { prisma } from "@/lib/prisma";

export const revalidate = 300;

const siteUrl =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") ??
  "https://www.smokeify.de";

export const metadata: Metadata = {
  title: "Bestseller",
  description: "Produkte mit der hoechsten Marge bei Smokeify.",
  alternates: {
    canonical: "/bestseller",
    languages: {
      "de-DE": "/bestseller",
      "x-default": "/bestseller",
    },
  },
  openGraph: {
    url: `${siteUrl}/bestseller`,
    title: "Bestseller | Smokeify",
    description: "Produkte mit der hoechsten Marge bei Smokeify.",
  },
  twitter: {
    title: "Bestseller | Smokeify",
    description: "Produkte mit der hoechsten Marge bei Smokeify.",
  },
};

export default async function BestsellerPage() {
  const [marginCandidates, fallbackProducts] = await Promise.all([
    prisma.product.findMany({
      where: { status: "ACTIVE" },
      select: {
        id: true,
        variants: {
          select: {
            priceCents: true,
            costCents: true,
            inventory: {
              select: { quantityOnHand: true, reserved: true },
            },
          },
        },
      },
    }),
    getProducts(160),
  ]);

  const bestsellerIds = marginCandidates
    .map((product) => {
      const bestAvailableVariantMarginCents = product.variants.reduce<number>(
        (bestMarginCents, variant) => {
          const quantityOnHand = variant.inventory?.quantityOnHand ?? 0;
          const reserved = variant.inventory?.reserved ?? 0;
          const available = quantityOnHand - reserved;
          if (available <= 0 || variant.priceCents <= 0) return bestMarginCents;
          const marginCents = variant.priceCents - variant.costCents;
          return Math.max(bestMarginCents, marginCents);
        },
        Number.NEGATIVE_INFINITY
      );

      return { id: product.id, marginCents: bestAvailableVariantMarginCents };
    })
    .filter((product) => Number.isFinite(product.marginCents))
    .sort((a, b) => b.marginCents - a.marginCents)
    .slice(0, 120)
    .map((product) => product.id);

  const rankedProducts = bestsellerIds.length
    ? await getProductsByIds(bestsellerIds)
    : [];

  const inStockRanked = rankedProducts.filter((product) => product.availableForSale);
  const inStockFallback = fallbackProducts.filter((product) => product.availableForSale);
  const rankedIds = new Set(inStockRanked.map((product) => product.id));

  const products =
    inStockRanked.length > 0
      ? [
          ...inStockRanked,
          ...inStockFallback.filter((product) => !rankedIds.has(product.id)),
        ].slice(0, 120)
      : inStockFallback.slice(0, 120);

  return (
    <PageLayout>
      <ProductsClient
        initialProducts={products}
        headerTitle="Unsere Bestseller"
        headerDescription="Diese Auswahl ist nach der hoechsten Marge sortiert."
      />
    </PageLayout>
  );
}
