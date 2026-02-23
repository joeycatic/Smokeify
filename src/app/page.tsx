import { AnnouncementBar } from "@/components/AnnouncementBar";
import { HeroBanner } from "@/components/HeroBanner";
import { Navbar } from "@/components/Navbar";
import Footer from "@/components/Footer";
import DisplayProducts from "@/components/DisplayProducts";
import { getProducts, getProductsByIds } from "@/lib/catalog";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: {
    canonical: "/",
    languages: {
      "de-DE": "/",
      "x-default": "/",
    },
  },
};

export default async function StorePage() {
  const [allProducts, tentCandidates, topItems] = await Promise.all([
    getProducts(40),
    prisma.product.findMany({
      where: {
        status: "ACTIVE",
        categories: {
          some: {
            category: {
              OR: [
                { handle: { in: ["growboxen", "zelte"], mode: "insensitive" } },
                {
                  parent: {
                    handle: { in: ["growboxen", "zelte"], mode: "insensitive" },
                  },
                },
              ],
            },
          },
        },
      },
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
    prisma.orderItem.groupBy({
      by: ["productId"],
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 8,
    }),
  ]);
  const inStockAllProducts = allProducts.filter((product) => product.availableForSale);

  const tentIds = tentCandidates
    .map((product) => {
      const bestAvailableVariantMarginPct = product.variants.reduce<number>(
        (bestMarginPct, variant) => {
          const quantityOnHand = variant.inventory?.quantityOnHand ?? 0;
          const reserved = variant.inventory?.reserved ?? 0;
          const available = quantityOnHand - reserved;
          if (available <= 0 || variant.priceCents <= 0) return bestMarginPct;
          const marginPct =
            ((variant.priceCents - variant.costCents) / variant.priceCents) * 100;
          return Math.max(bestMarginPct, marginPct);
        },
        Number.NEGATIVE_INFINITY
      );

      return { id: product.id, marginPct: bestAvailableVariantMarginPct };
    })
    .filter((product) => Number.isFinite(product.marginPct))
    .sort((a, b) => b.marginPct - a.marginPct)
    .slice(0, 4)
    .map((product) => product.id);

  const topIds = topItems
    .map((item) => item.productId)
    .filter((id): id is string => Boolean(id));
  const [tentProducts, bestSellers] = await Promise.all([
    tentIds.length ? getProductsByIds(tentIds) : Promise.resolve([]),
    topIds.length
      ? getProductsByIds(topIds)
      : Promise.resolve(inStockAllProducts.slice(0, 8)),
  ]);
  const inStockTentProducts = tentProducts.filter((product) => product.availableForSale);
  const inStockBestSellers = bestSellers.filter((product) => product.availableForSale);
  const bestSellerIds = new Set(inStockBestSellers.map((item) => item.id));
  const bestSellersFilled =
    inStockBestSellers.length >= 8
      ? inStockBestSellers
      : [
          ...inStockBestSellers,
          ...inStockAllProducts
            .filter((item) => !bestSellerIds.has(item.id))
            .slice(0, 8 - inStockBestSellers.length),
        ];

  return (
    <main className="bg-stone-50">
      <AnnouncementBar />
      <div className="mx-auto max-w-6xl px-0 sm:px-6">
        <Navbar />
        <HeroBanner />

        {/* Bestsellers Section */}
        <section className="relative z-10 -mt-6 pb-12 sm:-mt-10 md:-mt-12">
          <div className="overflow-hidden rounded-b-3xl bg-white/95 shadow-[0_20px_60px_rgba(0,0,0,0.18)]">
            <div className="px-6 pb-6 pt-10 text-center sm:px-8 sm:pt-12">
              <h2 className="text-3xl font-bold text-[#21483b] sm:text-4xl">
                Unsere Bestseller
              </h2>
              <div className="mx-auto mt-3 h-1 w-24 rounded-full bg-[#21483b]" />
              <p className="mt-4 text-base text-stone-600 sm:text-lg">
                Premium Equipment für premium Ergebnisse
              </p>
            </div>

            <div className="px-3 pb-12 pt-1 sm:px-4">
              <div className="space-y-10">
                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-[#21483b]">
                      Zelte
                    </h3>
                  </div>
                  <DisplayProducts
                    products={inStockTentProducts}
                    cols={4}
                    showManufacturer
                    showGrowboxSize
                    hideCartLabel
                  />
                </section>

                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-[#21483b]">
                      Hersteller
                    </h3>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <Link
                      href="/products?manufacturer=AC%20Infinity"
                      className="relative flex h-28 items-center justify-center overflow-hidden rounded-2xl border border-black bg-black shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                      aria-label="AC Infinity anzeigen"
                    >
                      <Image
                        src="/manufacturer-banner/acinifitybanner.png"
                        alt="AC Infinity"
                        fill
                        sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                        className="h-full w-full object-cover object-[50%_46%] scale-150"
                        priority
                        quality={70}
                      />
                    </Link>
                    <Link
                      href="/products?manufacturer=diamondbox"
                      className="relative flex h-28 items-center justify-center overflow-hidden rounded-2xl border border-black bg-black shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                      aria-label="DiamondBox anzeigen"
                    >
                      <Image
                        src="/manufacturer-banner/diamnondboxbanner.png"
                        alt="DiamondBox"
                        fill
                        sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                        className="h-full w-full object-cover object-[50%_46%] scale-130"
                        loading="lazy"
                        quality={70}
                      />
                    </Link>
                    <Link
                      href="/products?manufacturer=sanlight"
                      className="relative flex h-28 items-center justify-center overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                      aria-label="SANlight anzeigen"
                    >
                      <Image
                        src="/manufacturer-banner/sanlightbanner.png"
                        alt="SANlight"
                        fill
                        sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                        className="h-full w-full object-cover object-[58%_38%] scale-125"
                        loading="lazy"
                        quality={70}
                      />
                    </Link>
                    <Link
                      href="/products?manufacturer=bloomstar"
                      className="relative flex h-28 items-center justify-center overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                      aria-label="Bloomstar anzeigen"
                    >
                      <Image
                        src="/manufacturer-banner/bloomstarbanner.png"
                        alt="Bloomstar"
                        fill
                        sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                        className="h-full w-full object-cover object-[50%_40%] scale-125"
                        loading="lazy"
                        quality={70}
                      />
                    </Link>
                  </div>
                </section>

                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-[#21483b]">
                      Meistverkauft
                    </h3>
                  </div>
                  <DisplayProducts
                    products={bestSellersFilled}
                    cols={4}
                    showManufacturer
                    hideCartLabel
                  />
                </section>
              </div>
            </div>
          </div>
        </section>

        {/* Optional: View All Button */}
        <div className="text-center pb-16">
          <Link
            href="/products"
            className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-[#14532d] via-[#2f3e36] to-[#0f766e] px-10 py-4 text-base font-bold text-white shadow-lg shadow-emerald-900/15 transition-all hover:-translate-y-0.5 hover:shadow-emerald-900/25"
          >
            Alle Produkte ansehen
          </Link>
        </div>
      </div>
      <Footer />
    </main>
  );
}
