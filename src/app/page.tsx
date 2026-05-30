import { AnnouncementBar } from "@/components/AnnouncementBar";
import { Navbar } from "@/components/Navbar";
import CommerceShell from "@/components/CommerceShell";
import Footer from "@/components/Footer";
import DisplayProducts from "@/components/DisplayProducts";
import PaymentMethodLogos from "@/components/PaymentMethodLogos";
import { resolveLandingPageProductSections } from "@/lib/landingPageConfig";
import { measureServerExecution } from "@/lib/perf";
import { requireAdmin } from "@/lib/adminCatalog";
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { Suspense } from "react";
import {
  ArrowRightIcon,
  PhotoIcon,
  SparklesIcon,
  WrenchScrewdriverIcon,
} from "@heroicons/react/24/outline";
import { SMOKEIFY_ROUTES } from "@/config/smokeify-routes";

export const metadata: Metadata = {
  alternates: {
    canonical: "/",
    languages: {
      "de-DE": "/",
      "x-default": "/",
    },
  },
};

function formatMoney(amount?: string, currencyCode?: string) {
  const value = Number(amount);
  if (!Number.isFinite(value) || !currencyCode) return null;
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: 2,
  }).format(value);
}

function extractSetupSize(productTitle?: string | null, growboxSize?: string | null) {
  if (growboxSize?.trim()) return growboxSize.trim();
  const match = productTitle?.match(/\b\d{2,3}x\d{2,3}(?:x\d{2,3})?\b/i);
  return match?.[0] ?? null;
}

export default async function StorePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const previewRequested =
    (Array.isArray(resolvedSearchParams?.landingPreview)
      ? resolvedSearchParams?.landingPreview[0]
      : resolvedSearchParams?.landingPreview) === "draft";
  const canPreviewDraft = previewRequested && Boolean(await requireAdmin());
  const { result: homepageData } = await measureServerExecution(
    "page.home",
    async () =>
      resolveLandingPageProductSections("MAIN", {
        previewDraft: canPreviewDraft,
      }),
  );
  const {
    bestSellerProducts: bestSellersFilled,
    tentProducts,
    heroProducts,
  } = homepageData;
  const spotlightProducts = [
    ...new Map(
      [...heroProducts, ...tentProducts, ...bestSellersFilled]
        .filter((product) => product?.id)
        .map((product) => [product.id, product]),
    ).values(),
  ].slice(0, 3);
  const setupPreviewProduct = tentProducts[0] ?? heroProducts[0] ?? null;
  const featuredHeroProduct = heroProducts[0] ?? tentProducts[0] ?? null;
  const setupSize = extractSetupSize(
    setupPreviewProduct?.title,
    setupPreviewProduct?.growboxSize,
  );
  const setupLabel = setupSize
    ? `${setupSize} Smokeify-Setup`
    : "Einfacher Einstieg";
  const setupFacts = [
    {
      label: "Fläche",
      value: setupSize ?? "Kompakt",
    },
    {
      label: "System",
      value: "Starter-Setup",
    },
    {
      label: "Marke",
      value: setupPreviewProduct?.manufacturer ?? "Smokeify Auswahl",
    },
    {
      label: "Fokus",
      value: "Direkt passend",
    },
  ] as const;

  const brandCards = [
    {
      href: "/products?manufacturer=AC%20Infinity",
      src: "/manufacturer-banner/acinifitybanner.png",
      alt: "AC Infinity",
      label: "AC Infinity",
      note: "Lüftung & Klima",
      glow: "from-[#d6b16f]/36 via-[#3d4a34]/24 to-transparent",
      imageClass: "object-[50%_46%] scale-150",
    },
    {
      href: "/products?manufacturer=diamondbox",
      src: "/manufacturer-banner/diamnondboxbanner.png",
      alt: "DiamondBox",
      label: "DiamondBox",
      note: "Growbox Klassiker",
      glow: "from-[#71563b]/40 via-[#2c2521]/18 to-transparent",
      imageClass: "object-[50%_46%] scale-130",
    },
    {
      href: "/products?manufacturer=sanlight",
      src: "/manufacturer-banner/sanlightbanner.png",
      alt: "SANlight",
      label: "SANlight",
      note: "Premium LED",
      glow: "from-[#a6b2a2]/30 via-[#2f342f]/18 to-transparent",
      imageClass: "object-[58%_38%] scale-125",
    },
    {
      href: "/products?manufacturer=bloomstar",
      src: "/manufacturer-banner/bloomstarbanner.png",
      alt: "Bloomstar",
      label: "Bloomstar",
      note: "Leistung & Effizienz",
      glow: "from-[#d58c4f]/28 via-[#33261d]/20 to-transparent",
      imageClass: "object-[50%_40%] scale-125",
    },
  ] as const;

  return (
    <CommerceShell>
      <main className="pb-16">
        <AnnouncementBar />
        <div className="mx-auto w-full px-4 sm:px-6 lg:max-w-[1280px] lg:px-8">
          {canPreviewDraft ? (
            <div className="pt-4">
              <div className="rounded-[24px] border border-cyan-400/30 bg-cyan-400/12 px-4 py-3 text-sm text-cyan-100">
                Homepage draft preview is active. Only admins can see this
                draft merchandising state.
              </div>
            </div>
          ) : null}

          <Suspense fallback={null}>
            <Navbar />
          </Suspense>

          <div className="space-y-8 sm:space-y-10">
            <section className="smk-entrance relative overflow-hidden rounded-[36px] border border-[var(--smk-border)] bg-[linear-gradient(135deg,rgba(23,20,18,0.98)_0%,rgba(38,30,26,0.98)_38%,rgba(15,15,14,0.99)_100%)] px-5 pb-6 pt-6 shadow-[0_18px_56px_rgba(0,0,0,0.28)] sm:px-8 sm:pb-8 sm:pt-8 lg:px-10 lg:pb-10 lg:pt-10">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_14%_16%,rgba(218,176,106,0.24),transparent_26%),radial-gradient(circle_at_82%_18%,rgba(109,89,68,0.26),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.03),transparent_40%)]" />
              <div className="absolute -left-10 top-10 h-32 w-32 rounded-full bg-[rgba(207,167,96,0.14)] blur-2xl sm:h-44 sm:w-44" />
              <div className="absolute bottom-0 right-0 h-40 w-40 rounded-full bg-[rgba(94,75,57,0.2)] blur-2xl sm:h-52 sm:w-52" />

              <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1.02fr)_minmax(420px,0.84fr)] lg:items-center lg:gap-10">
                <div className="max-w-[43rem] space-y-5">
                  <span className="smk-chip">
                    <SparklesIcon className="h-4 w-4" />
                    Für Indoor-Setups mit Plan
                  </span>
                  <div className="smk-entrance smk-entrance-delay-1 space-y-3">
                    <h1 className="smk-heading max-w-[12ch] text-[3.2rem] leading-[0.88] tracking-[-0.065em] text-[var(--smk-text)] sm:text-[4.4rem] lg:text-[5.4rem]">
                      Dein Smokeify-Setup.
                      <br />
                      <span className="smk-text-gradient">
                        Klar gewählt. Direkt passend gekauft.
                      </span>
                    </h1>
                    <p className="max-w-[32rem] text-sm leading-7 text-[var(--smk-text-muted)] sm:text-base">
                      Kuratierte Produkte, klare Wege und Tools, die schneller
                      ins passende Setup führen.
                    </p>
                  </div>

                  <div className="smk-entrance smk-entrance-delay-2 flex flex-wrap items-center gap-3 pt-1">
                    <Link
                      href={SMOKEIFY_ROUTES.customizer}
                      className="smk-button-primary inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-semibold"
                    >
                      Setup konfigurieren
                    </Link>
                    <Link
                      href={SMOKEIFY_ROUTES.analyzer}
                      className="smk-button-secondary inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-semibold"
                    >
                      Pflanzenfoto analysieren
                    </Link>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5 pt-1">
                    {[
                      "Versandfrei ab 69 EUR",
                      "Smokeify Auswahl",
                      "Direkt verfügbar",
                    ].map((item) => (
                      <div
                        key={item}
                        className="inline-flex items-center gap-2 rounded-full border border-[var(--smk-border)] bg-[rgba(255,255,255,0.04)] px-3.5 py-2 text-sm font-semibold text-[var(--smk-text)]"
                      >
                        <span className="h-2.5 w-2.5 rounded-full bg-[var(--smk-accent)]" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>

                  <PaymentMethodLogos
                    className="border-t border-[var(--smk-border)]/70 pt-4 flex-wrap gap-2"
                    pillClassName="border-[var(--smk-border)] bg-[rgba(255,255,255,0.06)]"
                    logoClassName="brightness-[1.02]"
                  />
                </div>

                <div className="hero-swipe self-center rounded-[34px] border border-[rgba(233,188,116,0.16)] bg-[linear-gradient(180deg,rgba(34,27,22,0.98),rgba(18,16,14,0.98))] p-5 shadow-[0_18px_52px_rgba(0,0,0,0.24)] sm:p-6">
                  <div className="flex flex-col gap-4 border-b border-[var(--smk-border)]/80 pb-5 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="smk-kicker text-[var(--smk-accent)]">
                        Setup-Vorschau
                      </p>
                      <h2 className="mt-2 text-[2.2rem] font-semibold tracking-[-0.05em] text-[var(--smk-text)] sm:text-[2.7rem]">
                        Einfacher Start
                      </h2>
                    </div>
                    <div className="self-start rounded-full border border-[rgba(233,188,116,0.18)] bg-[rgba(233,188,116,0.08)] px-3 py-1 text-xs font-semibold text-[var(--smk-accent)]">
                      {setupLabel}
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    {setupFacts.map((fact) => (
                      <div
                        key={fact.label}
                        className="rounded-[24px] border border-[var(--smk-border)] bg-[rgba(255,255,255,0.04)] px-4 py-4"
                      >
                        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--smk-text-dim)]">
                          {fact.label}
                        </p>
                        <p className="mt-3 text-xl font-semibold text-[var(--smk-text)]">
                          {fact.value}
                        </p>
                      </div>
                    ))}
                  </div>

                  {featuredHeroProduct ? (
                    (() => {
                      const formattedPrice = formatMoney(
                        featuredHeroProduct.priceRange?.minVariantPrice.amount,
                        featuredHeroProduct.priceRange?.minVariantPrice.currencyCode,
                      );

                      return (
                      <Link
                        key={featuredHeroProduct.id}
                        href={`/products/${featuredHeroProduct.handle}`}
                      className="smk-motion-card smk-highlight-ring group relative mt-5 block overflow-hidden rounded-[28px] border border-[rgba(250,244,232,0.8)] bg-[linear-gradient(135deg,rgba(250,247,240,0.98),rgba(239,233,223,0.96))] p-4 text-[#1e1915] shadow-[0_22px_60px_rgba(0,0,0,0.18)] hover:border-[rgba(255,255,255,0.96)] sm:p-5"
                      >
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_16%_18%,rgba(219,179,111,0.22),transparent_32%),linear-gradient(110deg,rgba(255,255,255,0.56),rgba(255,255,255,0)_48%)] opacity-90" />
                        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
                          <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-[22px] border border-[rgba(66,50,34,0.12)] bg-[radial-gradient(circle_at_50%_30%,rgba(255,255,255,0.94),rgba(245,239,229,0.78))] shadow-[0_18px_30px_rgba(72,55,35,0.12)] sm:h-28 sm:w-28">
                            {featuredHeroProduct.featuredImage ? (
                              <Image
                                src={featuredHeroProduct.featuredImage.url}
                                alt={
                                  featuredHeroProduct.featuredImage.altText ??
                                  featuredHeroProduct.title
                                }
                                fill
                                sizes="112px"
                                className="object-contain p-3 transition duration-300 group-hover:scale-105"
                                priority
                              />
                            ) : null}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="smk-kicker text-[rgba(143,96,43,0.92)]">
                              Sinnvoll für den Einstieg
                            </p>
                            {featuredHeroProduct.manufacturer ? (
                              <p className="mt-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[rgba(78,61,43,0.68)]">
                                {featuredHeroProduct.manufacturer}
                              </p>
                            ) : null}
                            <h2 className="mt-2 max-w-[14ch] text-xl font-semibold leading-tight text-[#1e1915] lg:text-[1.7rem] lg:leading-[1.02]">
                              {featuredHeroProduct.title}
                            </h2>
                            <div className="mt-4 flex flex-wrap items-center justify-between gap-x-5 gap-y-2">
                              <p className="text-base font-semibold text-[#2c2219]">
                                {formattedPrice ?? "Preis aufrufen"}
                              </p>
                              <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.16em] text-[rgba(78,61,43,0.72)] transition group-hover:text-[#1e1915]">
                                Details zum Setup
                                <ArrowRightIcon className="h-3.5 w-3.5" />
                              </span>
                            </div>
                          </div>
                        </div>
                      </Link>
                      );
                    })()
                  ) : (
                    <div className="mt-5 rounded-[28px] border border-[var(--smk-border)] bg-[rgba(255,255,255,0.03)] p-5 text-sm text-[var(--smk-text-muted)]">
                      Smokeify baut die Setup-Vorschau aus, sobald passende
                      Produkte geladen sind.
                    </div>
                  )}
                </div>
              </div>
            </section>

            {spotlightProducts.length > 0 ? (
              <section className="space-y-4">
                <header className="space-y-2">
                  <p className="smk-kicker">Smokeify Picks</p>
                  <h2 className="smk-heading text-3xl text-[var(--smk-text)] sm:text-4xl">
                    Produkte früh im Blick
                  </h2>
                </header>
                <div className="grid gap-3 lg:grid-cols-3">
                  {spotlightProducts.map((product) => {
                    const formattedPrice = formatMoney(
                      product.priceRange?.minVariantPrice.amount,
                      product.priceRange?.minVariantPrice.currencyCode,
                    );

                    return (
                      <Link
                        key={product.id}
                        href={`/products/${product.handle}`}
                        className="smk-motion-card smk-highlight-ring group flex min-h-[164px] items-center gap-4 overflow-hidden rounded-[28px] border border-[var(--smk-border)] bg-[linear-gradient(180deg,rgba(27,23,20,0.98),rgba(14,14,13,0.99))] p-4 hover:border-[var(--smk-border-strong)]"
                      >
                        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-[22px] border border-[var(--smk-border)] bg-white">
                          {product.featuredImage ? (
                            <Image
                              src={product.featuredImage.url}
                              alt={product.featuredImage.altText ?? product.title}
                              fill
                              sizes="96px"
                              className="object-contain p-3 transition duration-300 group-hover:scale-105"
                            />
                          ) : null}
                        </div>
                        <div className="min-w-0 flex-1">
                          {product.manufacturer ? (
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--smk-text-dim)]">
                              {product.manufacturer}
                            </p>
                          ) : null}
                          <h3 className="mt-2 line-clamp-2 text-lg font-semibold leading-tight text-[var(--smk-text)]">
                            {product.title}
                          </h3>
                          <div className="mt-3 flex items-center justify-between gap-3">
                            <p className="text-base font-semibold text-[var(--smk-accent-2)]">
                              {formattedPrice ?? "Produkt ansehen"}
                            </p>
                            <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--smk-text-muted)] transition group-hover:text-[var(--smk-text)]">
                              Ansehen
                              <ArrowRightIcon className="h-3.5 w-3.5" />
                            </span>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </section>
            ) : null}

            <section className="grid gap-4 md:grid-cols-[1.15fr_0.85fr]">
              <div className="smk-panel rounded-[32px] p-6 sm:p-7">
                <p className="smk-kicker">Smokeify Tools</p>
                <h2 className="smk-heading mt-4 text-3xl leading-[0.96] text-[var(--smk-text)] sm:text-4xl">
                  Tools und Katalog greifen direkt zusammen.
                </h2>
                <p className="mt-4 max-w-xl text-sm leading-7 text-[var(--smk-text-muted)] sm:text-base">
                  Weniger springen, schneller entscheiden und direkt mit den
                  passenden Produkten weitergehen.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link
                    href={SMOKEIFY_ROUTES.customizer}
                    className="smk-button-primary inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-semibold"
                  >
                    Setup konfigurieren
                  </Link>
                  <Link
                    href={SMOKEIFY_ROUTES.analyzer}
                    className="smk-button-secondary inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-semibold"
                  >
                    Pflanzenanalyse starten
                  </Link>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 md:grid-cols-1">
                {[
                  {
                    title: "Lokale Smokeify Tools",
                    copy: "Analyzer, Konfigurator und Shop nutzen dieselbe Produktauswahl.",
                    icon: PhotoIcon,
                  },
                  {
                    title: "Ein Layout-System",
                    copy: "Kurze Wege statt doppelter Oberflächen.",
                    icon: SparklesIcon,
                  },
                  {
                    title: "Checkout bleibt stabil",
                    copy: "Warenkorb, Preise und Bestand bleiben serverseitig autoritativ.",
                    icon: WrenchScrewdriverIcon,
                  },
                ].map((item) => (
                  <div key={item.title} className="smk-motion-card smk-highlight-ring smk-surface rounded-[24px] p-4">
                    <item.icon className="h-5 w-5 text-[var(--smk-accent)]" />
                    <p className="mt-3 text-sm font-semibold text-[var(--smk-text)]">
                      {item.title}
                    </p>
                    <p className="mt-1 text-xs leading-6 text-[var(--smk-text-muted)]">
                      {item.copy}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-5">
              <header className="space-y-3">
                <p className="smk-kicker">Curated Merch</p>
                <h2 className="smk-heading text-3xl text-[var(--smk-text)] sm:text-4xl">
                  Top Growbox-Deals unter 120 €
                </h2>
                <p className="max-w-2xl text-sm leading-7 text-[var(--smk-text-muted)] sm:text-base">
                  Preisstarke Einstiege für ein klares Setup.
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

            <section className="space-y-5">
              <header className="space-y-3">
                <p className="smk-kicker">Brand Discovery</p>
                <h2 className="smk-heading text-3xl text-[var(--smk-text)] sm:text-4xl">
                  Marken mit klarer Rolle im Setup
                </h2>
              </header>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {brandCards.map((brand, index) => (
                  <Link
                    key={brand.href}
                    href={brand.href}
                    className="smk-motion-card smk-highlight-ring group relative flex min-h-[180px] overflow-hidden rounded-[30px] border border-[var(--smk-border)] bg-[rgba(255,255,255,0.04)] p-4 shadow-[0_18px_50px_rgba(0,0,0,0.18)] hover:border-[var(--smk-border-strong)]"
                  >
                    <div
                      className={`absolute inset-0 bg-gradient-to-br ${brand.glow}`}
                    />
                    <Image
                      src={brand.src}
                      alt={brand.alt}
                      fill
                      sizes="(min-width: 1280px) 23vw, (min-width: 640px) 48vw, 100vw"
                      className={`h-full w-full object-cover opacity-95 transition duration-500 group-hover:scale-[1.08] ${brand.imageClass}`}
                      loading={index === 0 ? "eager" : "lazy"}
                      priority={index === 0}
                      quality={72}
                    />
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.06),rgba(0,0,0,0.62))]" />
                    <div className="relative z-10 mt-auto">
                      <p className="text-lg font-semibold text-white">
                        {brand.label}
                      </p>
                      <p className="mt-1 text-sm text-white/78">{brand.note}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>

            <section className="space-y-5">
              <header className="space-y-3">
                <p className="smk-kicker">Bestsellers</p>
                <h2 className="smk-heading text-3xl text-[var(--smk-text)] sm:text-4xl">
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

            <section className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center rounded-[34px] border border-[var(--smk-border)] bg-[linear-gradient(135deg,rgba(216,177,111,0.12),rgba(28,23,20,0.96)_26%,rgba(12,12,11,0.99)_100%)] px-6 py-7 shadow-[0_24px_70px_rgba(0,0,0,0.28)] sm:px-8 sm:py-9">
              <div>
                <p className="smk-kicker text-[var(--smk-accent)]">
                  Final Conversion
                </p>
                <h2 className="smk-heading mt-3 text-3xl text-[var(--smk-text)] sm:text-4xl">
                  Kompletten Katalog durchsuchen
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--smk-text-muted)] sm:text-base">
                  Shoppen, Bestseller entdecken oder direkt in die gesamte
                  Auswahl springen, wenn das Setup schon klar ist.
                </p>
              </div>
              <div className="flex flex-wrap gap-3 lg:justify-end">
                <Link
                  href="/products"
                  className="smk-button-primary inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold"
                >
                  Alle Produkte ansehen
                </Link>
                <Link
                  href="/bestseller"
                  className="smk-button-secondary inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold"
                >
                  Zu den Bestsellern
                </Link>
              </div>
            </section>
          </div>
        </div>

        <Footer />
      </main>
    </CommerceShell>
  );
}
