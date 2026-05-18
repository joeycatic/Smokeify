// src/app/products/[handle]/page.tsx
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getProductByHandle } from "@/lib/catalog";
import { prisma } from "@/lib/prisma";
import { getProductRecommendations } from "@/lib/recommendations";
import ProductDetailClient from "./ProductDetailClient";
import ProductImageCarousel from "./ProductImageCarousel";
import RecommendedProductsCarousel from "./RecommendedProductsCarousel";
import ProductReviews from "./ProductReviews";
import FrequentlyBoughtTogether, {
  type FBTProduct,
} from "./FrequentlyBoughtTogether";
import PageLayout from "@/components/PageLayout";
import RecentlyViewedStrip from "@/components/RecentlyViewedStrip";
import { measureServerExecution } from "@/lib/perf";
import { InformationCircleIcon, PlusIcon } from "@heroicons/react/24/outline";

const siteUrl =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") ??
  "https://www.smokeify.de";

const GOOGLE_FEED_EXCLUDED_CATEGORY_HANDLES = new Set([
  "headshop",
  "aschenbecher",
  "aufbewahrung",
  "bongs",
  "feuerzeuge",
  "filter",
  "grinder",
  "kraeuterschale",
  "hash-bowl",
  "papers",
  "pipes",
  "rolling-tray",
  "tubes",
  "vaporizer",
  "waagen",
]);

const GOOGLE_FEED_FORCE_INCLUDE_HANDLES = new Set([
  "homebox-ambient-q-80-plus",
  "secret-jardin-hydro-shoot-100-grow-set-100-100-200-cm",
  "secret-jardin-hydro-shoot-100-grow-set-120-120-200-cm",
  "secret-jardin-hydro-shoot-60-grow-set-60-60-158-cm",
  "secret-jardin-hydro-shoot-80-grow-set-80-80-188-cm",
]);

const stripHtml = (value: string) =>
  value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

const isNoindexProduct = (product: {
  handle: string;
  categories: Array<{ handle: string; parent?: { handle: string } | null }>;
}) => {
  const normalizedHandle = product.handle.toLowerCase();
  if (GOOGLE_FEED_FORCE_INCLUDE_HANDLES.has(normalizedHandle)) return false;

  const categoryHandles = product.categories.flatMap((category) => [
    category.handle?.toLowerCase() ?? "",
    category.parent?.handle?.toLowerCase() ?? "",
  ]);
  return categoryHandles.some((handle) =>
    GOOGLE_FEED_EXCLUDED_CATEGORY_HANDLES.has(handle)
  );
};

type RecommendedProduct = {
  id: string;
  title: string;
  handle: string;
  imageUrl: string | null;
  imageAlt: string | null;
  price: { amount: string; currencyCode: string } | null;
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const { handle } = await params;
  const product = await getProductByHandle(handle);
  if (!product) {
    return {};
  }

  const title = product.seoTitle?.trim()
    ? { absolute: product.seoTitle.trim() }
    : `${product.title} | Smokeify`;
  const description = (
    product.seoDescription?.trim() ||
    product.shortDescription?.trim() ||
    stripHtml(product.description || "").slice(0, 160) ||
    "Produktdetails bei Smokeify"
  ).trim();
  const canonical = `/products/${product.handle}`;
  const image = product.images?.[0]?.url ?? null;
  const noindex = isNoindexProduct(product);

  return {
    title,
    description,
    robots: noindex
      ? {
          index: false,
          follow: false,
          nocache: true,
          googleBot: {
            index: false,
            follow: false,
            noimageindex: true,
          },
        }
      : undefined,
    alternates: {
      canonical,
      languages: {
        "de-DE": canonical,
        "x-default": canonical,
      },
    },
    openGraph: {
      type: "website",
      url: `${siteUrl}${canonical}`,
      title,
      description,
      images: image ? [{ url: image, alt: product.title }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const { result: productPageData } = await measureServerExecution(
    "page.product-detail",
    async () => {
      const product = await getProductByHandle(handle);
      if (!product) return null;
      const recommendationResult = await getProductRecommendations({
        productId: product.id,
        storefront: "MAIN",
        limit: 15,
      });
      const recommendedProducts: RecommendedProduct[] =
        recommendationResult?.recommendations
          .slice(0, 15)
          .map((item) => ({
            id: item.id,
            title: item.title,
            handle: item.handle,
            imageUrl: item.imageUrl,
            imageAlt: item.imageAlt,
            price: item.price,
          })) ?? [];
      const groupProducts = product.productGroup
        ? await prisma.product.findMany({
            where: {
              productGroup: product.productGroup,
              status: "ACTIVE",
              storefronts: { has: "MAIN" },
            },
            select: { id: true, title: true, handle: true, growboxSize: true },
            orderBy: { title: "asc" },
          })
        : [];

      const reviewSummary = await prisma.review.aggregate({
        where: { productId: product.id, status: "APPROVED" },
        _avg: { rating: true },
        _count: { rating: true },
      });

      return {
        groupProducts,
        product,
        recommendedProducts,
        recommendationResult,
        reviewSummary,
      };
    },
  );
  const product = productPageData?.product ?? null;
  if (!product || !productPageData) return notFound();
  const recommendedProducts = productPageData.recommendedProducts;
  const groupProducts = productPageData.groupProducts;
  const reviewSummary = productPageData.reviewSummary;
  const recommendationResults = productPageData.recommendationResult?.recommendations ?? [];
  const fbtProducts: FBTProduct[] = recommendationResults
    .filter((item) => item.availableForSale && item.variantId)
    .slice(0, 3)
    .map((item) => {
    return {
      id: item.id,
      title: item.title,
      handle: item.handle,
      variantId: item.variantId,
      imageUrl: item.imageUrl,
      price: item.price,
      availableForSale: item.availableForSale,
    };
  });
  const recommendedCarouselItems = recommendedProducts.filter(
    (item) => !fbtProducts.some((fbtItem) => fbtItem.id === item.id),
  );

  const images = product.images ?? [];
  const primaryImage = images[0] ?? null;
  const canonicalPath = `/products/${product.handle}`;
  const canonicalUrl = `${siteUrl}${canonicalPath}`;
  const offers = product.variants.slice(0, 25).map((variant) => ({
    "@type": "Offer",
    priceCurrency: variant.price.currencyCode,
    price: Number(variant.price.amount),
    availability: variant.availableForSale
      ? "https://schema.org/InStock"
      : "https://schema.org/OutOfStock",
    itemCondition: "https://schema.org/NewCondition",
    url: canonicalUrl,
    sku: variant.id,
    seller: {
      "@type": "Organization",
      name: "Smokeify",
    },
  }));
  const reviewCount = reviewSummary._count.rating;
  const productSchema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    url: canonicalUrl,
    image: images.map((image) => image.url).slice(0, 10),
    description: stripHtml(product.shortDescription ?? product.description ?? ""),
    sku: product.id,
    brand: product.manufacturer
      ? {
          "@type": "Brand",
          name: product.manufacturer,
        }
      : undefined,
    ...(reviewCount > 0 && {
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: (reviewSummary._avg.rating ?? 0).toFixed(1),
        reviewCount,
        bestRating: 5,
        worstRating: 1,
      },
    }),
    offers,
  };
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Startseite",
        item: siteUrl,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Produkte",
        item: `${siteUrl}/products`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: product.title,
        item: canonicalUrl,
      },
    ],
  };
  const hasDiscount = product.variants.some((variant) => variant.compareAt);
  const currentVariant =
    product.variants.find((variant) => variant.availableForSale) ?? product.variants[0] ?? null;
  return (
    <PageLayout commerce>
      <main className="smk-storefront-legacy smk-pdp-scope mx-auto w-full max-w-7xl px-0 py-6 sm:px-2">
        <div className="rounded-[32px] border border-[var(--smk-border)] bg-[radial-gradient(120%_120%_at_50%_20%,rgba(233,188,116,0.10)_0%,rgba(217,119,69,0.08)_30%,rgba(18,16,14,0.98)_72%,rgba(10,10,9,1)_100%)] p-2 shadow-[0_24px_70px_rgba(0,0,0,0.28)] sm:p-4">
          <div className="grid grid-cols-1 gap-6 lg:items-start lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-6">
              <div className="relative rounded-[24px] border border-[var(--smk-border)] bg-[rgba(255,255,255,0.04)] p-2 shadow-sm">
                <ProductImageCarousel images={images} alt={product.title} />
                {hasDiscount && (
                  <span className="absolute left-6 top-6 rounded-full bg-[var(--smk-accent)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#1a140f] shadow">
                    Sale
                  </span>
                )}
              </div>
              {product.description && (
                <div className="hidden rounded-[24px] border border-[var(--smk-border)] bg-[rgba(255,255,255,0.04)] shadow-sm sm:block">
                  <details className="group">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--smk-accent)]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-black [&::-webkit-details-marker]:hidden">
                      <span className="flex items-center gap-2 text-sm font-semibold text-[var(--smk-text)]">
                        <InformationCircleIcon className="h-5 w-5 text-[var(--smk-text-muted)]" />
                        Produktbeschreibung
                      </span>
                      <PlusIcon className="h-5 w-5 text-[var(--smk-text-muted)] transition-transform duration-300 group-open:rotate-45" />
                    </summary>
                    <div className="grid grid-rows-[0fr] transition-all duration-500 ease-out group-open:grid-rows-[1fr]">
                      <div className="overflow-hidden px-5 pb-5">
                        <div
                          className="product-description product-description-compact text-xxs leading-6 text-[var(--smk-text-muted)]"
                          dangerouslySetInnerHTML={{
                            __html: product.description,
                          }}
                        />
                      </div>
                    </div>
                  </details>
                </div>
              )}
            </div>

            <ProductDetailClient
              product={{
                id: product.id,
                title: product.title,
                descriptionHtml: product.description ?? "",
                technicalDetailsHtml: product.technicalDetails ?? "",
                shortDescription: product.shortDescription ?? null,
                manufacturer: product.manufacturer ?? null,
                growboxSize: product.growboxSize ?? null,
                categories: product.categories ?? [],
              }}
              options={product.options ?? []}
              productGroupItems={groupProducts}
              currentHandle={product.handle}
              variants={product.variants}
              imageUrl={primaryImage?.url ?? null}
              imageAlt={primaryImage?.altText ?? product.title}
            />
          </div>
        </div>

        <FrequentlyBoughtTogether
          currentProduct={{
            title: product.title,
            imageUrl: primaryImage?.url ?? null,
            variantId: currentVariant?.id ?? null,
            price: currentVariant?.price ?? null,
            availableForSale: currentVariant?.availableForSale ?? false,
          }}
          items={fbtProducts}
        />

        {recommendedCarouselItems.length > 0 && (
          <RecommendedProductsCarousel items={recommendedCarouselItems} />
        )}

        <RecentlyViewedStrip
          title="Zuletzt angesehen"
          excludeHandles={[product.handle]}
          className="mt-8"
        />

        <div className="mt-12">
          <ProductReviews productId={product.id} />
        </div>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
        />
      </main>
    </PageLayout>
  );
}
