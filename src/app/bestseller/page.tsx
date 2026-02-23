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
  description: "Die beliebtesten Produkte unserer Kundinnen und Kunden.",
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
    description: "Die beliebtesten Produkte unserer Kundinnen und Kunden.",
  },
  twitter: {
    title: "Bestseller | Smokeify",
    description: "Die beliebtesten Produkte unserer Kundinnen und Kunden.",
  },
};

export default async function BestsellerPage() {
  const [priceCandidates, fallbackProducts] = await Promise.all([
    prisma.product.findMany({
      where: { status: "ACTIVE" },
      select: {
        id: true,
        variants: {
          select: {
            priceCents: true,
            inventory: {
              select: { quantityOnHand: true, reserved: true },
            },
          },
        },
      },
    }),
    getProducts(160),
  ]);

  const entryPriceMinCents = 2_000;
  const entryPriceMaxCents = 8_000;

  const bestsellerIds = priceCandidates
    .map((product) => {
      const cheapestAvailablePriceCents = product.variants.reduce<number>(
        (bestPriceCents, variant) => {
          const quantityOnHand = variant.inventory?.quantityOnHand ?? 0;
          const reserved = variant.inventory?.reserved ?? 0;
          const available = quantityOnHand - reserved;
          if (available <= 0 || variant.priceCents <= 0) return bestPriceCents;
          return Math.min(bestPriceCents, variant.priceCents);
        },
        Number.POSITIVE_INFINITY
      );

      return {
        id: product.id,
        priceCents: cheapestAvailablePriceCents,
        preferredEntryPrice:
          cheapestAvailablePriceCents >= entryPriceMinCents &&
          cheapestAvailablePriceCents <= entryPriceMaxCents,
      };
    })
    .filter((product) => Number.isFinite(product.priceCents))
    .sort((a, b) => {
      if (a.preferredEntryPrice !== b.preferredEntryPrice) {
        return a.preferredEntryPrice ? -1 : 1;
      }
      return a.priceCents - b.priceCents;
    })
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
        headerDescription="Starte mit unseren beliebtesten Produkten zwischen 20 und 80 Euro."
      />
    </PageLayout>
  );
}
