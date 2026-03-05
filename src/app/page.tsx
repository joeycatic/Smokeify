import { AnnouncementBar } from "@/components/AnnouncementBar";
import { HeroBanner } from "@/components/HeroBanner";
import { Navbar } from "@/components/Navbar";
import Footer from "@/components/Footer";
import DisplayProducts from "@/components/DisplayProducts";
import CommerceProviders from "@/components/CommerceProviders";
import { getProductsByIds } from "@/lib/catalog";
import { getNavbarCategories } from "@/lib/navbarCategories";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { Suspense } from "react";
import {
  ShieldCheckIcon,
  SparklesIcon,
  TruckIcon,
} from "@heroicons/react/24/outline";

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
  const [initialCategories, bestSellerRows, tentProductRows] = await Promise.all([
    getNavbarCategories(),
    prisma.product.findMany({
      where: { status: "ACTIVE" },
      orderBy: [
        { bestsellerScore: { sort: "desc", nulls: "last" } },
        { updatedAt: "desc" },
      ],
      select: { id: true },
      take: 16,
    }),
    prisma.product.findMany({
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
      take: 40,
    }),
  ]);

  const productIds = Array.from(
    new Set([
      ...bestSellerRows.map((row) => row.id),
      ...tentProductRows.map((row) => row.id),
    ]),
  );
  const hydratedProducts = productIds.length
    ? await getProductsByIds(productIds)
    : [];
  const productsById = new Map(hydratedProducts.map((product) => [product.id, product]));
  const bestSellersFilled = bestSellerRows
    .map((row) => productsById.get(row.id))
    .filter(
      (
        product,
      ): product is (typeof hydratedProducts)[number] => Boolean(product),
    )
    .filter((product) => product.availableForSale)
    .slice(0, 8);
  const tentProductsSource = tentProductRows
    .map((row) => productsById.get(row.id))
    .filter(
      (
        product,
      ): product is (typeof hydratedProducts)[number] => Boolean(product),
    );
  const tentProducts = tentProductsSource
    .filter((p) => p.availableForSale)
    .filter((p) => Number(p.priceRange?.minVariantPrice?.amount ?? 0) <= 120)
    .sort(
      (a, b) =>
        Number(
          a.priceRange?.minVariantPrice?.amount ?? Number.POSITIVE_INFINITY,
        ) -
        Number(
          b.priceRange?.minVariantPrice?.amount ?? Number.POSITIVE_INFINITY,
        ),
    )
    .slice(0, 4);

  const brandCards = [
    {
      href: "/products?manufacturer=AC%20Infinity",
      src: "/manufacturer-banner/acinifitybanner.png",
      alt: "AC Infinity",
      label: "AC Infinity",
      note: "Lüftung & Klima",
      cardClass: "border-black bg-black text-white shadow-black/20",
      imageClass: "object-[50%_46%] scale-150",
    },
    {
      href: "/products?manufacturer=diamondbox",
      src: "/manufacturer-banner/diamnondboxbanner.png",
      alt: "DiamondBox",
      label: "DiamondBox",
      note: "Growbox Klassiker",
      cardClass: "border-black bg-black text-white shadow-black/20",
      imageClass: "object-[50%_46%] scale-130",
    },
    {
      href: "/products?manufacturer=sanlight",
      src: "/manufacturer-banner/sanlightbanner.png",
      alt: "SANlight",
      label: "SANlight",
      note: "Premium LED",
      cardClass: "border-stone-200 bg-white text-stone-900 shadow-black/10",
      imageClass: "object-[58%_38%] scale-125",
    },
    {
      href: "/products?manufacturer=bloomstar",
      src: "/manufacturer-banner/bloomstarbanner.png",
      alt: "Bloomstar",
      label: "Bloomstar",
      note: "Leistung & Effizienz",
      cardClass: "border-stone-200 bg-white text-stone-900 shadow-black/10",
      imageClass: "object-[50%_40%] scale-125",
    },
  ];

  return (
    <CommerceProviders>
      <main className="bg-stone-50">
        <AnnouncementBar />
        <div className="mx-auto max-w-6xl">
          <div className="px-0 sm:px-6">
            <Suspense fallback={null}>
              <Navbar initialCategories={initialCategories} />
            </Suspense>
          </div>
          <div className="sm:px-6">
            <section className="reveal-up relative overflow-hidden sm:rounded-3xl">
              <HeroBanner />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-black/65 via-black/20 to-transparent sm:rounded-b-3xl" />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 p-2.5 text-white sm:p-8">
                <p className="mb-1.5 inline-flex items-center gap-1 rounded-full border border-white/30 bg-black/20 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] sm:mb-2 sm:gap-2 sm:px-3 sm:py-1 sm:text-[11px] sm:tracking-[0.18em]">
                  <SparklesIcon className="h-3.5 w-3.5" />
                  Smokeify Selection
                </p>
                <h1 className="max-w-[13rem] text-[1.05rem] font-extrabold leading-tight tracking-tight sm:max-w-2xl sm:text-4xl">
                  Mehr Ernte. Weniger Aufwand.
                </h1>
                <p className="mt-1 max-w-[16.5rem] text-[10px] leading-snug text-white/90 sm:mt-2 sm:max-w-xl sm:text-base sm:leading-normal">
                  Kuratierte Hardware für Indoor-Gärten. Von LED bis Lüftung, mit
                  schneller Lieferung aus Deutschland.
                </p>
              </div>
            </section>
          </div>
          <section className="px-0 pb-6 pt-6 sm:px-6">
          <div className="pb-2">
            <div className="space-y-10">
              <section className="space-y-4">
                <header className="reveal-up space-y-2 px-2 sm:px-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-900/75">
                    Deals
                  </p>
                  <h2 className="text-2xl font-extrabold tracking-tight text-stone-900 sm:text-3xl">
                    Top Growbox-Deals unter 120 €
                  </h2>
                  <p className="max-w-2xl text-sm text-stone-700 sm:text-base">
                    Preisstark starten und sofort die passende Basis für dein
                    Setup finden.
                  </p>
                </header>
                <DisplayProducts
                  products={tentProducts}
                  cols={4}
                  showManufacturer
                  showGrowboxSize
                  hideCartLabel
                />
              </section>

              <section className="space-y-4">
                <header className="reveal-up reveal-delay-1 space-y-2 px-2 sm:px-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-900/75">
                    Markenwelt
                  </p>
                  <h2 className="text-2xl font-extrabold tracking-tight text-stone-900 sm:text-3xl">
                    Starke Brands für jeden Grow-Anspruch
                  </h2>
                </header>
                <div className="grid gap-3 px-4 sm:gap-4 sm:px-0 sm:grid-cols-2 lg:grid-cols-4">
                  {brandCards.map((brand, index) => (
                    <Link
                      key={brand.href}
                      href={brand.href}
                      className={`group interactive-lift reveal-up relative flex h-24 items-end overflow-hidden rounded-xl border p-2.5 shadow-md transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white sm:h-36 sm:rounded-2xl sm:p-3 ${
                        brand.cardClass
                      } ${index > 1 ? "reveal-delay-2" : "reveal-delay-1"}`}
                      aria-label={`${brand.label} anzeigen`}
                    >
                      <Image
                        src={brand.src}
                        alt={brand.alt}
                        fill
                        sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                        className={`h-full w-full object-cover transition duration-500 group-hover:scale-[1.08] ${brand.imageClass}`}
                        loading={index === 0 ? "eager" : "lazy"}
                        priority={index === 0}
                        quality={70}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent" />
                      <div className="relative z-10">
                        <p className="text-xs font-bold tracking-wide text-white sm:text-sm">
                          {brand.label}
                        </p>
                        <p className="text-[11px] text-white/85 sm:text-xs">{brand.note}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>

              <section className="space-y-4">
                <header className="reveal-up reveal-delay-2 space-y-2 px-2 sm:px-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-900/75">
                    Meistgekauft
                  </p>
                  <h2 className="text-2xl font-extrabold tracking-tight text-stone-900 sm:text-3xl">
                    Bestseller aus dem Smokeify Shop
                  </h2>
                </header>
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

          <section className="reveal-up reveal-delay-2 px-4 pb-8 sm:px-6">
          <div className="grid gap-3 rounded-2xl border border-emerald-100/80 bg-white/85 p-4 shadow-lg shadow-emerald-900/5 backdrop-blur sm:grid-cols-3 sm:p-5">
            <div className="interactive-lift rounded-xl border border-emerald-100 bg-emerald-50/70 p-4">
              <TruckIcon className="h-5 w-5 text-emerald-800" />
              <p className="mt-2 text-sm font-semibold text-stone-900">
                Schneller Versand
              </p>
              <p className="mt-1 text-xs text-stone-700">
                Zügige Lieferung direkt aus Deutschland.
              </p>
            </div>
            <div className="interactive-lift rounded-xl border border-emerald-100 bg-emerald-50/70 p-4">
              <ShieldCheckIcon className="h-5 w-5 text-emerald-800" />
              <p className="mt-2 text-sm font-semibold text-stone-900">
                Verifizierte Marken
              </p>
              <p className="mt-1 text-xs text-stone-700">
                Ausgewählte Hersteller mit starkem Preis-Leistungs-Verhältnis.
              </p>
            </div>
            <div className="interactive-lift rounded-xl border border-emerald-100 bg-emerald-50/70 p-4">
              <SparklesIcon className="h-5 w-5 text-emerald-800" />
              <p className="mt-2 text-sm font-semibold text-stone-900">
                Kuratierte Auswahl
              </p>
              <p className="mt-1 text-xs text-stone-700">
                Handverlesene Produkte für Einsteiger und Profis.
              </p>
            </div>
          </div>
        </section>

          <div className="pb-16 text-center">
          <div className="reveal-up reveal-delay-2 inline-flex flex-col items-center gap-3 sm:flex-row">
            <Link
              href="/products"
              className="interactive-lift inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-[#14532d] via-[#2f3e36] to-[#0f766e] px-10 py-4 text-base font-bold text-white shadow-lg shadow-emerald-900/15 transition-all hover:shadow-emerald-900/25"
            >
              Alle Produkte ansehen
            </Link>
            <Link
              href="/bestseller"
              className="inline-flex items-center justify-center rounded-xl border border-black/10 bg-white/90 px-6 py-4 text-sm font-semibold text-stone-800 shadow-sm transition hover:border-black/20 hover:bg-white"
            >
              Zu den Bestsellern
            </Link>
          </div>
          </div>
        </div>
        <Footer />
      </main>
    </CommerceProviders>
  );
}
