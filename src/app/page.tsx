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
  ShieldCheckIcon,
  SparklesIcon,
  TruckIcon,
  WrenchScrewdriverIcon,
} from "@heroicons/react/24/outline";
import { buildGrowvaultPublicUrl } from "@/lib/growvaultPublicStorefront";

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

  const supportCards = [
    {
      title: "Schnell startklar",
      copy: "Verfügbare Ausrüstung, kurze Wege und klare Produktauswahl für dein nächstes Setup.",
      icon: TruckIcon,
    },
    {
      title: "Bewährte Marken",
      copy: "Licht, Klima und Zubehör von Herstellern, die sich in echten Setups bewährt haben.",
      icon: ShieldCheckIcon,
    },
    {
      title: "Klar ausgewählt",
      copy: "Weniger Suchen, bessere Entscheidungen und passende Wege vom Einstieg bis zum Upgrade.",
      icon: SparklesIcon,
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
            <section className="relative overflow-hidden rounded-[36px] border border-[var(--smk-border)] bg-[linear-gradient(135deg,rgba(23,20,18,0.98)_0%,rgba(38,30,26,0.98)_38%,rgba(15,15,14,0.99)_100%)] px-5 pb-6 pt-6 shadow-[0_28px_90px_rgba(0,0,0,0.34)] sm:px-8 sm:pb-8 sm:pt-8 lg:px-10 lg:pb-10 lg:pt-10">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_14%_16%,rgba(218,176,106,0.24),transparent_26%),radial-gradient(circle_at_82%_18%,rgba(109,89,68,0.26),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.03),transparent_40%)]" />
              <div className="absolute -left-10 top-10 h-36 w-36 rounded-full bg-[rgba(207,167,96,0.16)] blur-3xl sm:h-52 sm:w-52" />
              <div className="absolute bottom-0 right-0 h-44 w-44 rounded-full bg-[rgba(94,75,57,0.24)] blur-3xl sm:h-60 sm:w-60" />

              <div className="relative grid gap-8 lg:grid-cols-[1.08fr_0.92fr] lg:items-end">
                <div className="max-w-3xl space-y-6">
                  <span className="smk-chip">
                    <SparklesIcon className="h-4 w-4" />
                    Smokeify Selection
                  </span>
                  <div className="space-y-4">
                    <h1 className="smk-heading max-w-4xl text-5xl leading-[0.9] tracking-[-0.06em] text-[var(--smk-text)] sm:text-6xl lg:text-7xl">
                      Indoor-Growing,
                      <br />
                      <span className="smk-text-gradient">
                        das direkt Sinn ergibt.
                      </span>
                    </h1>
                    <p className="max-w-2xl text-sm leading-7 text-[var(--smk-text-muted)] sm:text-base">
                      Entdecke Growboxen, LED-Licht, Abluft und Zubehör, die
                      wirklich zusammenpassen. Kuratiert für saubere Setups,
                      bessere Orientierung und einen Start ohne Rätselraten.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Link
                      href="/products"
                      className="smk-button-primary inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-semibold"
                    >
                      Sortiment entdecken
                    </Link>
                    <Link
                      href={buildGrowvaultPublicUrl("/customizer")}
                      className="smk-button-secondary inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-semibold"
                    >
                      Konfigurator öffnen
                    </Link>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    {supportCards.map((item) => (
                      <div
                        key={item.title}
                        className="smk-surface rounded-[24px] p-4"
                      >
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

                  <PaymentMethodLogos
                    className="flex-wrap gap-2.5"
                    pillClassName="border-[var(--smk-border)] bg-[rgba(255,255,255,0.06)]"
                    logoClassName="brightness-[1.02]"
                  />
                </div>

                <div className="grid gap-4 lg:grid-cols-1">
                  {heroProducts.map((product, index) => {
                    const formattedPrice = formatMoney(
                      product.priceRange?.minVariantPrice.amount,
                      product.priceRange?.minVariantPrice.currencyCode,
                    );

                    return (
                      <Link
                        key={product.id}
                        href={`/products/${product.handle}`}
                        className={`group relative overflow-hidden rounded-[30px] border border-[var(--smk-border)] bg-[rgba(255,255,255,0.05)] p-4 transition hover:-translate-y-1 hover:border-[var(--smk-border-strong)] hover:bg-[rgba(255,255,255,0.08)] sm:p-5 ${
                          index === 0 ? "lg:min-h-[220px]" : "lg:min-h-[170px]"
                        }`}
                      >
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(214,177,111,0.16),transparent_34%)] opacity-80" />
                        <div className="relative flex items-center gap-4">
                          <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-[22px] border border-[var(--smk-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.12),rgba(255,255,255,0.04))] sm:h-28 sm:w-28">
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
                            <p className="smk-kicker text-[var(--smk-accent)]">
                              Smokeify Pick
                            </p>
                            {product.manufacturer ? (
                              <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--smk-text-dim)]">
                                {product.manufacturer}
                              </p>
                            ) : null}
                            <h2 className="mt-2 text-xl font-semibold leading-tight text-[var(--smk-text)] lg:text-[1.7rem] lg:leading-[1.02]">
                              {product.title}
                            </h2>
                            <div className="mt-4 flex items-center justify-between gap-3">
                              <p className="text-sm font-semibold text-[var(--smk-text)]">
                                {formattedPrice ?? "Preis aufrufen"}
                              </p>
                              <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--smk-text-muted)] transition group-hover:text-[var(--smk-text)]">
                                Ansehen
                                <ArrowRightIcon className="h-3.5 w-3.5" />
                              </span>
                            </div>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </section>

            <section className="grid gap-4 md:grid-cols-[1.15fr_0.85fr]">
              <div className="smk-panel rounded-[32px] p-6 sm:p-7">
                <p className="smk-kicker">Growvault</p>
                <h2 className="smk-heading mt-4 text-3xl leading-[0.96] text-[var(--smk-text)] sm:text-4xl">
                  Grow-Themen laufen jetzt
                  <br />
                  in Growvault weiter.
                </h2>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--smk-text-muted)] sm:text-base">
                  Analyzer, Konfigurator und das kuratierte Grow-Sortiment leben
                  jetzt im dedizierten Growvault-Storefront. Smokeify bleibt der
                  gemeinsame Operations- und Admin-Backbone im Hintergrund.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link
                    href={buildGrowvaultPublicUrl("/")}
                    className="smk-button-primary inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-semibold"
                  >
                    Growvault öffnen
                  </Link>
                  <Link
                    href={buildGrowvaultPublicUrl("/pflanzen-analyse")}
                    className="smk-button-secondary inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-semibold"
                  >
                    Analyzer bei Growvault
                  </Link>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 md:grid-cols-1">
                {[
                  {
                    title: "Eigenes Grow-Storefront",
                    copy: "Growvault ist jetzt die einzige öffentliche Oberfläche für Analyzer, Konfigurator und Grow-Katalog.",
                    icon: PhotoIcon,
                  },
                  {
                    title: "Ein Runtime-Owner",
                    copy: "Neue Analyzer- und Konfigurator-Features landen nur noch in Growvault statt parallel in zwei Repos.",
                    icon: SparklesIcon,
                  },
                  {
                    title: "Smokeify im Hintergrund",
                    copy: "Review, QA, Empfehlungen und Admin-Workflows bleiben im gemeinsamen Control Plane erhalten.",
                    icon: WrenchScrewdriverIcon,
                  },
                ].map((item) => (
                  <div key={item.title} className="smk-surface rounded-[24px] p-4">
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
                  Preisstarke Einstiege, um schnell eine sinnvolle Basis für
                  das Setup zu bauen.
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
                    className="group relative flex min-h-[180px] overflow-hidden rounded-[30px] border border-[var(--smk-border)] bg-[rgba(255,255,255,0.04)] p-4 shadow-[0_18px_50px_rgba(0,0,0,0.18)] transition hover:-translate-y-1 hover:border-[var(--smk-border-strong)]"
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
                  Shoppen, Bestseller vergleichen oder direkt in die gesamte
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
