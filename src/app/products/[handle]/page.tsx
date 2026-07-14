// src/app/products/[handle]/page.tsx
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getProductByHandle } from "@/lib/catalog";
import { prisma } from "@/lib/prisma";
import { getProductRecommendations } from "@/lib/recommendations";
import ProductDetailClient from "./ProductDetailClient";
import ProductContentSections from "./ProductContentSections";
import ProductImageCarousel from "./ProductImageCarousel";
import RecommendedProductsCarousel from "./RecommendedProductsCarousel";
import ProductReviews from "./ProductReviews";
import PageLayout from "@/components/PageLayout";
import RecentlyViewedStrip from "@/components/RecentlyViewedStrip";
import { measureServerExecution } from "@/lib/perf";
import {
  buildProductSeoDescription,
  buildProductSeoTitle,
} from "@/lib/productSeo";

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

  const title = { absolute: buildProductSeoTitle(product) };
  const description = buildProductSeoDescription(product);
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
  const recommendedCarouselItems = recommendedProducts;

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
  const breadcrumbItems = [
    { name: "Startseite", path: "/" },
    { name: "Produkte", path: "/products" },
    { name: product.title, path: canonicalPath },
  ];
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: breadcrumbItems.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: `${siteUrl}${item.path === "/" ? "" : item.path}`,
    })),
  };
  const hasDiscount = product.variants.some((variant) => variant.compareAt);
  return (
    <PageLayout commerce>
      <main className="-mx-4 -mt-10 w-[calc(100%+2rem)] pb-6 pt-0 sm:mx-auto sm:mt-0 sm:w-full sm:max-w-7xl sm:px-2 sm:py-6">
        <nav
          aria-label="Breadcrumb"
          className="mb-3 flex flex-wrap items-center gap-2 px-4 text-xs text-[color:var(--gv-text-muted)] sm:px-4"
        >
          {breadcrumbItems.map((item, index) => (
            <span key={item.path} className="flex items-center gap-2">
              {index < breadcrumbItems.length - 1 ? (
                <a href={item.path} className="hover:text-[color:var(--gv-text)]">
                  {item.name}
                </a>
              ) : (
                <span className="text-[color:var(--gv-text)]">{item.name}</span>
              )}
              {index < breadcrumbItems.length - 1 ? <span>/</span> : null}
            </span>
          ))}
        </nav>
        <div className="overflow-hidden border-y border-[color:var(--gv-border)] bg-[radial-gradient(120%_120%_at_50%_0%,var(--gv-lime-glow)_0%,var(--gv-surface)_34%,var(--gv-dark)_100%)] shadow-[var(--gv-shadow-lg)] sm:overflow-visible sm:rounded-[32px] sm:border sm:p-4">
          <div className="grid grid-cols-1 gap-0 lg:grid-cols-[minmax(0,1.08fr)_minmax(390px,0.92fr)] lg:items-start lg:gap-5">
            <div className="lg:sticky lg:top-24">
              <div className="relative bg-[color:var(--gv-dark)]/92 shadow-[var(--gv-shadow)] sm:rounded-[24px] sm:border sm:border-[color:var(--gv-border)] sm:p-2">
                <ProductImageCarousel images={images} alt={product.title} />
                {hasDiscount ? (
                  <span className="absolute left-4 top-4 rounded-full bg-[color:var(--gv-lime)] px-3 py-1 font-[family:var(--font-jetbrains-mono)] text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--gv-forest)] shadow sm:left-6 sm:top-6">
                    Sale
                  </span>
                ) : null}
              </div>
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
              reviewSummary={{
                average: reviewSummary._avg.rating ?? 0,
                count: reviewSummary._count.rating,
              }}
            />
          </div>
        </div>

        <ProductContentSections
          product={{
            title: product.title,
            descriptionHtml: product.description ?? "",
            technicalDetailsHtml: product.technicalDetails ?? "",
            shortDescription: product.shortDescription ?? null,
            manufacturer: product.manufacturer ?? null,
            growboxSize: product.growboxSize ?? null,
            categories: product.categories ?? [],
          }}
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
