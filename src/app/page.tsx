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
  const allProducts = await getProducts(60);
  const inStock = allProducts.filter((p) => p.availableForSale);

  const tentProductRows = await prisma.product.findMany({
    where: {
      status: "ACTIVE",
      categories: {
        some: {
          OR: [
            { category: { handle: "zelte" } },
            { category: { parent: { is: { handle: "zelte" } } } },
          ],
        },
      },
    },
    select: { id: true },
    take: 120,
  });
  const tentProductsSource = tentProductRows.length
    ? await getProductsByIds(tentProductRows.map((row) => row.id))
    : [];
  const tentProducts = tentProductsSource
    .filter((p) => p.availableForSale)
    .filter((p) => Number(p.priceRange?.minVariantPrice?.amount ?? 0) <= 120)
    .sort(
      (a, b) =>
        Number(a.priceRange?.minVariantPrice?.amount ?? Number.POSITIVE_INFINITY) -
        Number(b.priceRange?.minVariantPrice?.amount ?? Number.POSITIVE_INFINITY)
    )
    .slice(0, 4);

  const bestSellersFilled = inStock.slice(0, 8);

  return (
    <main className="bg-stone-50">
      <AnnouncementBar />
      <div className="mx-auto max-w-6xl">
        <div className="px-0 sm:px-6">
          <Navbar />
        </div>
        <div className="px-0 sm:px-6">
          <HeroBanner />
        </div>
{/* Bestsellers Section */}
        <section className="px-0 pb-12 pt-2 sm:px-6">
            <div className="pb-12">
              <div className="space-y-10">
                <section className="space-y-4">
                  <DisplayProducts
                    products={tentProducts}
                    cols={4}
                    showManufacturer
                    showGrowboxSize
                    hideCartLabel
                  />
                </section>

                <section className="space-y-4">
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
                  <DisplayProducts
                    products={bestSellersFilled}
                    cols={4}
                    showManufacturer
                    hideCartLabel
                  />
                </section>
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
