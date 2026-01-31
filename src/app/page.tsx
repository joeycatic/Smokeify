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
  const tentProducts = allProducts
    .filter(
      (product) =>
        product.categories?.some(
          (category) =>
            category.handle === "growboxen" ||
            category.parent?.handle === "growboxen",
        ) ?? false,
    )
    .slice(0, 4);

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
                    {[
                      "Hersteller 1",
                      "Hersteller 2",
                      "Hersteller 3",
                      "Hersteller 4",
                    ].map((label) => (
                      <div
                        key={label}
                        className="flex h-28 items-center justify-center rounded-2xl border border-dashed border-stone-300 bg-stone-50 text-sm font-semibold text-stone-500"
                      >
                        {label}
                      </div>
                    ))}
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
