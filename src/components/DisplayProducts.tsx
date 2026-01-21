import Link from "next/link";
import Image from "next/image";
import { ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";
import ProductCardActions from "@/components/ProductCardActions";
import type { Product } from "@/data/types";

type Props = {
  products?: Product[];
  cols?: number;
};

const getProductLowStockState = (product: Product) => {
  const available = product.defaultVariantAvailableQuantity ?? 0;
  const threshold = product.defaultVariantLowStockThreshold ?? null;
  const isLowStock =
    threshold !== null && available > 0 && available <= threshold;
  return Boolean(product.lowStock || isLowStock);
};

export default function DisplayProducts({ products, cols = 4 }: Props) {
  return (
    <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {products?.map((p) => {
        const showLowStock = getProductLowStockState(p);
        const descriptionText = formatShortText(
          p.shortDescription ?? p.description ?? ""
        );
        return (
          <Link
            key={p.id}
            href={`/products/${p.handle}`}
            className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          >
            <article
              key={p.id}
              className="
                        group rounded-xl border border-stone-200 bg-white
                        transition overflow-hidden hover:shadow-lg hover:-translate-y-0.5
                    "
            >
              {/* Image */}
              <div className="relative">
                <ProductImageCarousel
                  images={getProductImages(p)}
                  alt={p.title}
                  className="aspect-square overflow-hidden rounded-t-xl bg-stone-100"
                  imageClassName="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                />
                {p.compareAtPrice && (
                  <span className="absolute left-3 top-3 rounded-full bg-yellow-500 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-black shadow">
                    Sale
                  </span>
                )}
                {p.availableForSale && showLowStock && (
                  <span className="absolute left-3 top-3 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-800 shadow">
                    Low stock
                  </span>
                )}
              </div>

              {/* Content */}
              <div className="p-4">
                {/* Title */}
                <h2
                  className="mt-1 line-clamp-2 font-bold"
                  style={{ color: "#000000ff" }}
                >
                  {p.title}
                </h2>
                {typeof p.availableForSale === "boolean" && (
                  <p
                    className={`mt-1 text-xs font-semibold ${
                      p.availableForSale
                        ? showLowStock
                          ? "text-amber-700"
                          : "text-green-700"
                        : "text-red-600"
                    }`}
                  >
                    {p.availableForSale
                      ? showLowStock
                        ? "Verfügbar · Geringer Bestand"
                        : "Verfügbar"
                      : "Ausverkauft"}
                  </p>
                )}
                {descriptionText && (
                  <p className="mt-2 text-sm text-stone-600 line-clamp-2">
                    {descriptionText}
                  </p>
                )}

                {/* Price */}
                <div className="mt-2 flex items-baseline gap-2">
                  {p.compareAtPrice && (
                    <span className="text-sm font-semibold text-yellow-600 line-through">
                      {formatPrice(p.compareAtPrice)}
                    </span>
                  )}
                  <span className="text-base font-semibold text-stone-900">
                    {formatPrice(p.priceRange?.minVariantPrice)}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-center gap-2">
                  <ProductCardActions
                    productId={p.id}
                    variantId={p.defaultVariantId ?? null}
                    available={p.availableForSale}
                    itemTitle={p.title}
                    itemImageUrl={p.featuredImage?.url}
                    itemImageAlt={p.featuredImage?.altText ?? p.title}
                    itemPrice={p.priceRange?.minVariantPrice}
                    itemQuantity={1}
                  />
                </div>
              </div>
            </article>
          </Link>
        );
      })}
    </div>
  );
}

export function DisplayProductsList({ products }: Props) {
  return (
    <div className="mt-6 grid grid-cols-1 gap-4">
      {products?.map((p) => {
        const showLowStock = getProductLowStockState(p);
        const descriptionText = formatShortText(
          p.shortDescription ?? p.description ?? ""
        );
        return (
          <article
            key={p.id}
            className="flex flex-col gap-4 rounded-xl border border-stone-200 bg-white p-4 sm:flex-row"
          >
            <Link
              href={`/products/${p.handle}`}
              className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white sm:w-56 md:w-64"
            >
              <div className="relative">
                <ProductImageCarousel
                  images={getProductImages(p)}
                  alt={p.title}
                  className="aspect-square overflow-hidden rounded-lg bg-stone-100"
                  imageClassName="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                />
                {p.compareAtPrice && (
                  <span className="absolute left-3 top-3 rounded-full bg-yellow-500 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-black shadow">
                    Sale
                  </span>
                )}
                {p.availableForSale && showLowStock && (
                  <span className="absolute left-3 top-12 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-800 shadow">
                    Low stock
                  </span>
                )}
              </div>
            </Link>

            <div className="flex flex-1 flex-col gap-4">
              <div className="space-y-2">
                <h2
                  className="text-lg font-bold"
                  style={{ color: "#000000ff" }}
                >
                  {p.title}
                </h2>
                {typeof p.availableForSale === "boolean" && (
                  <p
                    className={`text-s font-semibold ${
                      p.availableForSale
                        ? showLowStock
                          ? "text-amber-700"
                          : "text-green-700"
                        : "text-red-600"
                    }`}
                  >
                    {p.availableForSale
                      ? showLowStock
                        ? "Verfügbar · Geringer Bestand"
                        : "Verfügbar"
                      : "Ausverkauft"}
                  </p>
                )}
                {descriptionText && (
                  <p className="text-sm text-stone-600 line-clamp-3">
                    {descriptionText}
                  </p>
                )}
              </div>

              <div className="mt-auto space-y-2">
                <div className="text-lg font-semibold text-stone-900">
                  <div className="flex items-baseline gap-2">
                    {p.compareAtPrice && (
                      <span className="text-sm font-semibold text-yellow-600 line-through">
                        {formatPrice(p.compareAtPrice)}
                      </span>
                    )}
                    <span>{formatPrice(p.priceRange?.minVariantPrice)}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <ProductCardActions
                      productId={p.id}
                      variantId={p.defaultVariantId ?? null}
                      available={p.availableForSale}
                      size="lg"
                      itemTitle={p.title}
                      itemImageUrl={p.featuredImage?.url}
                      itemImageAlt={p.featuredImage?.altText ?? p.title}
                      itemPrice={p.priceRange?.minVariantPrice}
                      itemQuantity={1}
                    />
                    <Link
                      href={`/products/${p.handle}`}
                      className="inline-flex items-center justify-center rounded-full border border-stone-200 p-3 text-stone-700 shadow-sm transition hover:border-black/20 hover:text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                      aria-label="Zum Produkt"
                      title="Zum Produkt"
                    >
                      <ArrowTopRightOnSquareIcon className="h-5 w-5" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function ProductImageCarousel({
  images,
  alt,
  className,
  imageClassName,
}: {
  images: Array<{ url: string; altText?: string | null }>;
  alt: string;
  className?: string;
  imageClassName?: string;
}) {
  const current = images[0];
  if (!current) return null;

  return (
    <div className={`relative ${className ?? ""}`}>
      <Image
        src={current.url}
        alt={current.altText ?? alt}
        fill
        sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
        className={`absolute inset-0 ${imageClassName ?? ""}`}
      />
    </div>
  );
}

function formatPrice(price?: { amount: string; currencyCode: string }) {
  if (!price) return null;

  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: price.currencyCode,
    minimumFractionDigits: 2,
  }).format(Number(price.amount));
}

function getProductImages(product: Product) {
  const images = product.images ?? [];
  if (images.length) return images;
  return product.featuredImage ? [product.featuredImage] : [];
}

function formatShortText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}
