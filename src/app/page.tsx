import { AnnouncementBar } from "@/components/AnnouncementBar";
import { HeroBanner } from "@/components/HeroBanner";
import { Navbar } from "@/components/Navbar";
import Footer from "@/components/Footer";
import DisplayProducts from "@/components/DisplayProducts";
import { getProducts, getProductsByIds } from "@/lib/catalog";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function StorePage() {
  const allProducts = await getProducts(40);
  const tentProductIds = await prisma.product.findMany({
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
    orderBy: { updatedAt: "desc" },
    take: 4,
    select: { id: true },
  });
  const tentProducts = tentProductIds.length
    ? await getProductsByIds(tentProductIds.map((item) => item.id))
    : [];

  const topItems = await prisma.orderItem.groupBy({
    by: ["productId"],
    _sum: { quantity: true },
    orderBy: { _sum: { quantity: "desc" } },
    take: 8,
  });
  const topIds = topItems
    .map((item) => item.productId)
    .filter((id): id is string => Boolean(id));
  const bestSellers = topIds.length
    ? await getProductsByIds(topIds)
    : allProducts.slice(0, 8);
  const bestSellerIds = new Set(bestSellers.map((item) => item.id));
  const bestSellersFilled =
    bestSellers.length >= 8
      ? bestSellers
      : [
          ...bestSellers,
          ...allProducts
            .filter((item) => !bestSellerIds.has(item.id))
            .slice(0, 8 - bestSellers.length),
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
                    products={tentProducts}
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
                      className="flex h-28 items-center justify-center overflow-hidden rounded-2xl border border-black bg-black shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                      aria-label="AC Infinity anzeigen"
                    >
                      <img
                        src="/manufacturer-banner/acinifitybanner.png"
                        alt="AC Infinity"
                        className="h-full w-full object-cover object-[50%_46%] scale-150"
                        loading="lazy"
                        decoding="async"
                      />
                    </Link>
                    <Link
                      href="/products?manufacturer=diamondbox"
                      className="flex h-28 items-center justify-center overflow-hidden rounded-2xl border border-black bg-black shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                      aria-label="DiamondBox anzeigen"
                    >
                      <img
                        src="/manufacturer-banner/diamnondboxbanner.png"
                        alt="DiamondBox"
                        className="h-full w-full object-cover object-[50%_46%] scale-130"
                        loading="lazy"
                        decoding="async"
                      />
                    </Link>
                    <Link
                      href="/products?manufacturer=sanlight"
                      className="flex h-28 items-center justify-center overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                      aria-label="SANlight anzeigen"
                    >
                      <img
                        src="/manufacturer-banner/sanlightbanner.png"
                        alt="SANlight"
                        className="h-full w-full object-cover object-[58%_38%] scale-125"
                        loading="lazy"
                        decoding="async"
                      />
                    </Link>
                    <Link
                      href="/products?manufacturer=bloomstar"
                      className="flex h-28 items-center justify-center overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                      aria-label="Bloomstar anzeigen"
                    >
                      <img
                        src="/manufacturer-banner/bloomstarbanner.png"
                        alt="Bloomstar"
                        className="h-full w-full object-cover object-[50%_40%] scale-125"
                        loading="lazy"
                        decoding="async"
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
                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-[#21483b]">
                      Hersteller
                    </h3>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <Link
                      href="/products?manufacturer=Kailar"
                      className="flex h-28 items-center justify-center overflow-hidden rounded-2xl border border-stone-200 bg-black shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                      aria-label="Kailar anzeigen"
                    >
                      <img
                        src="/manufacturer-banner/kailarbanner.avif"
                        alt="Kailar"
                        className="h-full w-full object-contain scale-100"
                        loading="lazy"
                        decoding="async"
                      />
                    </Link>
                    <Link
                      href="/products?manufacturer=OCB"
                      className="flex h-28 items-center justify-center overflow-hidden rounded-2xl border border-black bg-black shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                      aria-label="OCB anzeigen"
                    >
                      <img
                        src="/manufacturer-banner/ocbbanner.png"
                        alt="OCB"
                        className="h-full w-full object-contain object-[50%_45%] scale-100"
                        loading="lazy"
                        decoding="async"
                      />
                    </Link>
                    <Link
                      href="/products?manufacturer=Purize"
                      className="flex h-28 items-center justify-center overflow-hidden rounded-2xl border border-emerald-900/30 bg-[#1f4d3a] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                      aria-label="Purize anzeigen"
                    >
                      <img
                        src="/manufacturer-banner/purizebanner.png"
                        alt="Purize"
                        className="h-full w-full object-cover object-[50%_43%] scale-150"
                        loading="lazy"
                        decoding="async"
                      />
                    </Link>
                    <Link
                      href="/products?manufacturer=RAW"
                      className="flex h-28 items-center justify-center overflow-hidden rounded-2xl border border-amber-200 bg-[#f3e4c2] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                      aria-label="RAW anzeigen"
                    >
                      <img
                        src="/manufacturer-banner/rawbanner.png"
                        alt="RAW"
                        className="h-full w-full object-cover object-[50%_39%] scale-150"
                        loading="lazy"
                        decoding="async"
                      />
                    </Link>
                  </div>
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
