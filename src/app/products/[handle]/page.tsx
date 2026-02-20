// src/app/products/[handle]/page.tsx
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getProductByHandle } from "@/lib/catalog";
import { prisma } from "@/lib/prisma";
import ProductDetailClient from "./ProductDetailClient";
import ProductImageCarousel from "./ProductImageCarousel";
import RecommendedProductsCarousel from "./RecommendedProductsCarousel";
import ProductReviews from "./ProductReviews";
import PageLayout from "@/components/PageLayout";
import RecentlyViewedStrip from "@/components/RecentlyViewedStrip";
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

const toAmount = (cents: number) => (cents / 100).toFixed(2);

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

const getRecommendedProducts = async (
  currentProductId: string,
  categoryIds: string[]
): Promise<RecommendedProduct[]> => {
  const primaryProducts = categoryIds.length
    ? await prisma.product.findMany({
        where: {
          status: "ACTIVE",
          id: { not: currentProductId },
          categories: { some: { categoryId: { in: categoryIds } } },
        },
        orderBy: { updatedAt: "desc" },
        take: 12,
        include: {
          images: { orderBy: { position: "asc" }, take: 1 },
          variants: { orderBy: { position: "asc" }, select: { priceCents: true } },
        },
      })
    : [];

  const selectedIds = new Set(primaryProducts.map((entry) => entry.id));
  const needed = Math.max(0, 12 - primaryProducts.length);
  const fallbackProducts =
    needed > 0
      ? await prisma.product.findMany({
          where: {
            status: "ACTIVE",
            id: { notIn: [currentProductId, ...Array.from(selectedIds)] },
          },
          orderBy: { updatedAt: "desc" },
          take: needed,
          include: {
            images: { orderBy: { position: "asc" }, take: 1 },
            variants: { orderBy: { position: "asc" }, select: { priceCents: true } },
          },
        })
      : [];

  return [...primaryProducts, ...fallbackProducts].slice(0, 12).map((entry) => {
    const prices = entry.variants.map((variant) => variant.priceCents);
    const minPrice = prices.length > 0 ? Math.min(...prices) : null;
    const image = entry.images[0] ?? null;
    return {
      id: entry.id,
      title: entry.title,
      handle: entry.handle,
      imageUrl: image?.url ?? null,
      imageAlt: image?.altText ?? entry.title,
      price:
        minPrice !== null
          ? { amount: toAmount(minPrice), currencyCode: "EUR" }
          : null,
    };
  });
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

  const title = `${product.title} | Smokeify`;
  const description =
    (product.shortDescription?.trim() ||
      stripHtml(product.description || "").slice(0, 160) ||
      "Produktdetails bei Smokeify")?.trim();
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
  const product = await getProductByHandle(handle);
  if (!product) return notFound();
  const recommendedProducts = await getRecommendedProducts(
    product.id,
    product.categories.map((category) => category.id)
  );
  const groupProducts = product.productGroup
    ? await prisma.product.findMany({
        where: { productGroup: product.productGroup, status: "ACTIVE" },
        select: { id: true, title: true, handle: true, growboxSize: true },
        orderBy: { title: "asc" },
      })
    : [];

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
  }));
  const productSchema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    image: images.map((image) => image.url).slice(0, 10),
    description: stripHtml(product.shortDescription ?? product.description ?? ""),
    sku: product.id,
    brand: product.manufacturer
      ? {
          "@type": "Brand",
          name: product.manufacturer,
        }
      : undefined,
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
  const showAgeNotice = Boolean(
    product.categories?.some((category) => {
      const handle = category.handle?.toLowerCase().trim() ?? "";
      const title = category.title?.toLowerCase().trim() ?? "";
      return handle === "vaporizer" || title === "vaporizer";
    })
  );

  return (
    <PageLayout>
      <main className="mx-auto w-full max-w-7xl px-0 sm:px-2 py-6">
        <div className="rounded-[32px] border border-black/5 bg-[radial-gradient(120%_120%_at_50%_40%,rgba(38,62,52,0.6)_0%,rgba(32,52,45,0.45)_35%,rgba(120,150,130,0.25)_70%,rgba(255,255,255,0)_100%)] p-2 shadow-[0_20px_60px_rgba(15,23,42,0.12)] sm:p-4">
          <div className="grid grid-cols-1 gap-6 lg:items-start lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-6">
              <div className="relative rounded-[18px] bg-white/80 p-2 shadow-sm">
                <ProductImageCarousel images={images} alt={product.title} />
                {hasDiscount && (
                  <span className="absolute left-6 top-6 rounded-full bg-yellow-500 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-black shadow">
                    Sale
                  </span>
                )}
              </div>
              {product.description && (
                <div className="hidden rounded-2xl border border-black/10 bg-white/85 shadow-sm sm:block">
                  <details className="group">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white [&::-webkit-details-marker]:hidden">
                      <span className="flex items-center gap-2 text-sm font-semibold text-black/80">
                        <InformationCircleIcon className="h-5 w-5 text-black/60" />
                        Produktbeschreibung
                      </span>
                      <PlusIcon className="h-5 w-5 text-black/60 transition-transform duration-300 group-open:rotate-45" />
                    </summary>
                    <div className="grid grid-rows-[0fr] transition-all duration-500 ease-out group-open:grid-rows-[1fr]">
                      <div className="overflow-hidden px-5 pb-5">
                        <div
                          className="product-description product-description-compact text-xxs leading-6 text-black/60"
                          dangerouslySetInnerHTML={{
                            __html: product.description,
                          }}
                        />
                      </div>
                    </div>
                  </details>
                </div>
              )}
              {showAgeNotice && (
                <div className="hidden rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 sm:block">
                  Hinweis zum Jugendschutz: Dieses Produkt ist ausschließlich
                  für Personen ab 18 Jahren bestimmt. Eine Abgabe an
                  Minderjährige ist ausgeschlossen.
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

        {recommendedProducts.length > 0 && (
          <RecommendedProductsCarousel items={recommendedProducts} />
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
