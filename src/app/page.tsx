import { AnnouncementBar } from "@/components/AnnouncementBar";
import { Navbar } from "@/components/Navbar";
import Footer from "@/components/Footer";
import DisplayProducts from "@/components/DisplayProducts";
import CommerceProviders from "@/components/CommerceProviders";
import PaymentMethodLogos from "@/components/PaymentMethodLogos";
import { getProductsByIds, getProductsByIdsAllowInactive } from "@/lib/catalog";
import { getNavbarCategories } from "@/lib/navbarCategories";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { Suspense } from "react";
import {
  ShieldCheckIcon,
  ArrowRightIcon,
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

const HERO_PRODUCT_HANDLES = [
  "diamondbox-sl-60",
  "lux-helios-pro-300-watt-2-8",
  "ac-infinity-controller-69-pro",
] as const;

export default async function StorePage() {
  const nonHeadshopWhere = {
    status: "ACTIVE" as const,
    categories: {
      none: {
        OR: [
          { category: { handle: "headshop" } },
          { category: { parent: { is: { handle: "headshop" } } } },
        ],
      },
    },
  };

  const [initialCategories, bestSellerRows, tentProductRows, heroBannerRows] = await Promise.all([
    getNavbarCategories(),
    prisma.product.findMany({
      where: nonHeadshopWhere,
      orderBy: [
        { bestsellerScore: { sort: "desc", nulls: "last" } },
        { updatedAt: "desc" },
      ],
      select: { id: true },
      take: 16,
    }),
    prisma.product.findMany({
      where: {
        AND: [
          nonHeadshopWhere,
          {
            categories: {
              some: {
                OR: [
                  { category: { handle: "zelte" } },
                  { category: { parent: { is: { handle: "zelte" } } } },
                ],
              },
            },
          },
        ],
      },
      select: { id: true },
      take: 40,
    }),
    prisma.product.findMany({
      where: {
        ...nonHeadshopWhere,
        handle: { in: [...HERO_PRODUCT_HANDLES] },
      },
      select: {
        id: true,
      },
      take: HERO_PRODUCT_HANDLES.length,
    }),
  ]);

  const productIds = Array.from(
    new Set([
      ...bestSellerRows.map((row) => row.id),
      ...tentProductRows.map((row) => row.id),
      ...heroBannerRows.map((row) => row.id),
    ]),
  );
  const [hydratedProducts, hydratedHeroProducts] = await Promise.all([
    productIds.length ? getProductsByIds(productIds) : Promise.resolve([]),
    heroBannerRows.length
      ? getProductsByIdsAllowInactive(heroBannerRows.map((row) => row.id))
      : Promise.resolve([]),
  ]);
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
  const heroProducts = HERO_PRODUCT_HANDLES.map((handle) =>
    hydratedHeroProducts.find((product) => product.handle === handle) ?? null,
  )
    .filter(
      (
        product,
      ): product is (typeof hydratedProducts)[number] =>
        Boolean(product && product.availableForSale),
    );

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
          <div className="pt-3 sm:px-6 sm:pt-5">
            <section className="reveal-up relative overflow-hidden bg-[#16382d] px-4 pb-6 pt-6 text-white shadow-[0_28px_80px_rgba(11,28,21,0.18)] sm:rounded-3xl sm:px-8 sm:pb-8 sm:pt-8">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_18%,rgba(228,197,108,0.25),transparent_26%),radial-gradient(circle_at_82%_12%,rgba(120,164,143,0.24),transparent_30%),linear-gradient(135deg,#15372c_0%,#1f4336_35%,#355c4d_68%,#d3be8f_100%)]" />
              <div className="absolute -right-10 top-10 h-40 w-40 rounded-full bg-[#e4c56c]/20 blur-3xl sm:h-56 sm:w-56" />
              <div className="absolute bottom-0 left-0 h-32 w-32 rounded-full bg-[#84a794]/20 blur-3xl sm:h-44 sm:w-44" />

              <div className="relative grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-10">
                <div className="max-w-3xl py-2 sm:py-4">
                  <p className="inline-flex items-center gap-2 rounded-full border border-[#E4C56C]/35 bg-[#E4C56C]/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#f4e4b8] sm:text-xs">
                    <SparklesIcon className="h-4 w-4" />
                    Smokeify Auswahl
                  </p>
                  <h1 className="mt-5 max-w-3xl text-4xl font-extrabold leading-[0.96] tracking-tight sm:text-5xl lg:text-6xl">
                    Technik und Zubehör für Pflanzen, die nicht nach
                    Zufall aussehen.
                  </h1>
                  <p className="mt-5 max-w-2xl text-sm leading-6 text-white/84 sm:text-base sm:leading-7">
                    Entdecke kuratierte Zelte, starke LED-Systeme, saubere
                    Abluftlösungen und sinnvolles Zubehör. Direkt sortiert nach
                    Relevanz, Marken und echten Topsellern aus dem Shop.
                  </p>

                  <div className="mt-6 flex flex-wrap gap-3">
                    <Link
                      href="/products"
                      className="inline-flex items-center justify-center rounded-xl bg-[#E4C56C] px-5 py-3 text-sm font-bold text-[#20342b] shadow-lg shadow-black/15 transition hover:-translate-y-0.5 hover:bg-[#edd48f]"
                    >
                      Jetzt Sortiment entdecken
                    </Link>
                    <Link
                      href="/customizer"
                      className="inline-flex items-center justify-center rounded-xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-semibold text-white backdrop-blur transition hover:-translate-y-0.5 hover:bg-white/15"
                    >
                      Konfigurator öffnen
                    </Link>
                  </div>

                  <div className="mt-6 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                      <TruckIcon className="h-5 w-5 text-[#e4c56c]" />
                      <p className="mt-2 text-sm font-semibold text-white">
                        Schneller Versand
                      </p>
                      <p className="mt-1 text-xs leading-5 text-white/74">
                        Zügige Lieferung aus Deutschland für einen schnellen
                        Projektstart.
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                      <ShieldCheckIcon className="h-5 w-5 text-[#e4c56c]" />
                      <p className="mt-2 text-sm font-semibold text-white">
                        Verlässliche Marken
                      </p>
                      <p className="mt-1 text-xs leading-5 text-white/74">
                        Ausgewählte Hersteller mit sauberem Preis-Leistungs-Fokus.
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                      <SparklesIcon className="h-5 w-5 text-[#e4c56c]" />
                      <p className="mt-2 text-sm font-semibold text-white">
                        Kuratierte Auswahl
                      </p>
                      <p className="mt-1 text-xs leading-5 text-white/74">
                        Relevante Produkte statt überladener Massenlisten.
                      </p>
                    </div>
                  </div>

                  <div className="mt-6">
                    <PaymentMethodLogos
                      className="flex-wrap gap-2.5 sm:gap-3"
                      pillClassName="border-white/12 bg-white/10"
                      logoClassName="brightness-[1.02]"
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1 lg:gap-5">
                  {heroProducts.map((product, index) => (
                    <Link
                      key={product.id}
                      href={`/products/${product.handle}`}
                      className={`group relative overflow-hidden rounded-[26px] border border-white/10 bg-white/10 p-4 backdrop-blur transition hover:-translate-y-1 hover:bg-white/14 sm:p-5 ${
                        index === 0 ? "lg:min-h-[204px]" : "lg:min-h-[168px]"
                      }`}
                    >
                      <div className="flex items-center gap-4 lg:gap-5">
                        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-[linear-gradient(180deg,rgba(255,255,255,0.16),rgba(255,255,255,0.05))] sm:h-28 sm:w-28 lg:h-24 lg:w-24">
                          {product.featuredImage ? (
                            <Image
                              src={product.featuredImage.url}
                              alt={product.featuredImage.altText ?? product.title}
                              fill
                              sizes="112px"
                              className="object-contain p-3 transition duration-300 group-hover:scale-105"
                              priority={index === 0}
                            />
                          ) : null}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#e4c56c]">
                            Empfohlen
                          </p>
                          {product.manufacturer ? (
                            <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/58">
                              {product.manufacturer}
                            </p>
                          ) : null}
                          <h2 className="mt-2 max-w-[22rem] text-lg font-bold leading-tight text-white lg:text-[1.75rem] lg:leading-[1.05]">
                            {product.title}
                          </h2>
                          <div className="mt-3 flex items-center justify-between gap-3">
                            <p className="text-sm font-semibold text-white/92">
                              {product.priceRange?.minVariantPrice.amount}{" "}
                              {product.priceRange?.minVariantPrice.currencyCode}
                            </p>
                            <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.14em] text-white/72 transition group-hover:text-white">
                              Ansehen
                              <ArrowRightIcon className="h-3.5 w-3.5" />
                            </span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
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
