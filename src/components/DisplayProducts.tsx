"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowTopRightOnSquareIcon,
  EyeIcon,
  StarIcon as StarOutlineIcon,
} from "@heroicons/react/24/outline";
import { StarIcon as StarSolidIcon } from "@heroicons/react/24/solid";
import ProductCardActions from "@/components/ProductCardActions";
import QuickViewModal from "@/components/QuickViewModal";
import type { Product } from "@/data/types";

type Props = {
  products?: Product[];
  cols?: number;
  showManufacturer?: boolean;
  titleLines?: 2 | 3;
  showGrowboxSize?: boolean;
  hideCartLabel?: boolean;
};

const getProductLowStockState = (product: Product) => {
  const available = product.defaultVariantAvailableQuantity ?? 0;
  const threshold = product.defaultVariantLowStockThreshold ?? null;
  const isLowStock =
    threshold !== null && available > 0 && available <= threshold;
  return Boolean(product.lowStock || isLowStock);
};
const NEW_BADGE_CUTOFF_MS = Date.now() - 30 * 24 * 60 * 60 * 1000;

function ProductRating({ average, count }: { average: number; count: number }) {
  if (count <= 0) return null;
  const rounded = Math.max(0, Math.min(5, Math.round(average)));

  return (
    <div className="mt-1 flex items-center gap-1.5 text-xs text-stone-600">
      <div className="flex items-center gap-0.5" aria-hidden="true">
        {Array.from({ length: 5 }).map((_, i) =>
          i < rounded ? (
            <StarSolidIcon key={i} className="h-3.5 w-3.5 text-amber-500" />
          ) : (
            <StarOutlineIcon key={i} className="h-3.5 w-3.5 text-amber-500" />
          )
        )}
      </div>
      <span>
        {average.toFixed(1)} ({count})
      </span>
    </div>
  );
}

export default function DisplayProducts({
  products,
  cols = 4,
  showManufacturer = false,
  titleLines = 2,
  showGrowboxSize = false,
  hideCartLabel = false,
}: Props) {
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);
  const gridColsClass =
    cols === 2
      ? "grid-cols-2 sm:grid-cols-2 lg:grid-cols-2"
      : cols === 3
        ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
        : "grid-cols-2 sm:grid-cols-2 lg:grid-cols-4";
  const titleClampClass = titleLines === 3 ? "line-clamp-3" : "line-clamp-2";
  const sorted = [...(products ?? [])].sort(
    (a, b) => Number(b.availableForSale) - Number(a.availableForSale)
  );
  return (
    <>
    <div className={`mt-6 grid gap-3 ${gridColsClass}`}>
      {sorted.map((p, index) => {
        const showLowStock = getProductLowStockState(p);
        const showSize =
          showGrowboxSize && isGrowboxProduct(p) && Boolean(p.growboxSize);
        return (
          <article
            key={p.id}
            className="
                      group flex h-full w-full flex-col rounded-xl border border-stone-200 bg-white
                      [content-visibility:auto] [contain-intrinsic-size:420px]
                      transition overflow-hidden hover:shadow-lg hover:-translate-y-0.5
                  "
          >
              {/* Image */}
              <Link
                href={`/products/${p.handle}`}
                data-gtag-item-id={p.defaultVariantId ?? p.id}
                data-gtag-item-name={p.title}
                data-gtag-item-brand={p.manufacturer ?? undefined}
                data-gtag-item-category={p.categories?.[0]?.title}
                data-gtag-item-price={p.priceRange?.minVariantPrice?.amount}
                data-gtag-item-index={index}
                className="relative block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
              >
                <ProductImageCarousel
                  images={getProductImages(p)}
                  alt={[p.manufacturer, p.title].filter(Boolean).join(" ")}
                  className="aspect-[9/8] overflow-hidden rounded-t-xl bg-white sm:aspect-square"
                  imageClassName="h-full w-full object-contain transition duration-300 group-hover:scale-105"
                />
                <div className="absolute left-3 top-3 flex flex-col items-start gap-1.5">
                  {p.compareAtPrice && (
                    <span className="rounded-full bg-yellow-500 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-black shadow sm:px-3 sm:text-xs">
                      {formatDiscountPercentage(
                        p.compareAtPrice,
                        p.priceRange?.minVariantPrice,
                      )}
                    </span>
                  )}
                  {p.availableForSale && showLowStock && (
                    <span className="rounded-full bg-amber-500/90 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white shadow sm:px-3 sm:text-xs">
                      {p.defaultVariantLowStockThreshold != null &&
                      p.defaultVariantAvailableQuantity != null
                        ? `Noch ${p.defaultVariantAvailableQuantity} verfügbar`
                        : "Geringer Bestand"}
                    </span>
                  )}
                  {!p.compareAtPrice && p.bestsellerScore != null && p.bestsellerScore > 0 && (
                    <span className="rounded-full bg-[#2f3e36] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white shadow sm:px-3 sm:text-xs">
                      Bestseller
                    </span>
                  )}
                  {p.createdAt && new Date(p.createdAt).getTime() > NEW_BADGE_CUTOFF_MS && (
                    <span className="rounded-full bg-[#E4C56C] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-[#2f3e36] shadow sm:px-3 sm:text-xs">
                      Neu
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setQuickViewProduct(p);
                  }}
                  className="absolute bottom-3 left-1/2 z-10 -translate-x-1/2 translate-y-1 inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white/95 px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap text-stone-800 opacity-0 shadow-md transition-all duration-150 hover:bg-white group-hover:translate-y-0 group-hover:opacity-100"
                  aria-label={`Schnellansicht: ${p.title}`}
                >
                  <EyeIcon className="h-3.5 w-3.5" />
                  Schnellansicht
                </button>
              </Link>

              {/* Content */}
              <div className="flex flex-1 flex-col p-4">
                {showManufacturer && p.manufacturer && (
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
                    {p.manufacturer}
                  </p>
                )}
                {showSize && (
                  <p className="mt-1 text-xs text-stone-600">
                    Größe: {p.growboxSize}
                  </p>
                )}
                {/* Title */}
                <Link
                  href={`/products/${p.handle}`}
                  data-gtag-item-id={p.defaultVariantId ?? p.id}
                  data-gtag-item-name={p.title}
                  data-gtag-item-brand={p.manufacturer ?? undefined}
                  data-gtag-item-category={p.categories?.[0]?.title}
                  data-gtag-item-price={p.priceRange?.minVariantPrice?.amount}
                  data-gtag-item-index={index}
                  className="mt-1 block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                >
                  <h2
                    className={`${titleClampClass} font-bold leading-snug`}
                    style={{ color: "#000000ff" }}
                  >
                    {p.title}
                  </h2>
                </Link>
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
                        ? p.defaultVariantLowStockThreshold != null &&
                          p.defaultVariantAvailableQuantity != null
                          ? `Nur noch ${p.defaultVariantAvailableQuantity} verfügbar`
                          : "Geringer Bestand"
                        : "Verfügbar"
                      : "Ausverkauft"}
                  </p>
                )}
                {p.reviewSummary && p.reviewSummary.count > 0 && (
                  <ProductRating
                    average={p.reviewSummary.average}
                    count={p.reviewSummary.count}
                  />
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
                <div className="mt-auto flex w-full items-center pt-3">
                  <div className="grid w-full grid-cols-[2.5rem_1fr_2.5rem] items-center gap-2">
                    <div className="flex items-center justify-start">
                      <ProductCardActions
                        productId={p.id}
                        variantId={p.defaultVariantId ?? null}
                        available={p.availableForSale}
                        showCart={false}
                        itemTitle={p.title}
                        itemImageUrl={p.featuredImage?.url}
                        itemImageAlt={p.featuredImage?.altText ?? p.title}
                        itemPrice={p.priceRange?.minVariantPrice}
                        itemQuantity={1}
                        itemHandle={p.handle}
                      />
                    </div>
                    <div className="flex items-center justify-center">
                      <ProductCardActions
                        productId={p.id}
                        variantId={p.defaultVariantId ?? null}
                        available={p.availableForSale}
                        showWishlist={false}
                        hideCartLabel={hideCartLabel}
                        itemTitle={p.title}
                        itemImageUrl={p.featuredImage?.url}
                        itemImageAlt={p.featuredImage?.altText ?? p.title}
                        itemPrice={p.priceRange?.minVariantPrice}
                        itemQuantity={1}
                        itemHandle={p.handle}
                      />
                    </div>
                    <span aria-hidden="true" />
                  </div>
                </div>
              </div>
          </article>
        );
      })}
    </div>
    <QuickViewModal
      product={quickViewProduct}
      open={quickViewProduct !== null}
      onClose={() => setQuickViewProduct(null)}
    />
    </>
  );
}

export function DisplayProductsList({
  products,
  showManufacturer = false,
  showGrowboxSize = false,
  hideCartLabel = false,
}: Props) {
  const sorted = [...(products ?? [])].sort(
    (a, b) => Number(b.availableForSale) - Number(a.availableForSale)
  );
  return (
    <div className="mt-6 grid grid-cols-1 gap-4">
      {sorted.map((p, index) => {
        const showLowStock = getProductLowStockState(p);
        const descriptionSource = p.shortDescription?.trim() ?? "";
        const descriptionText = descriptionSource
          ? formatShortText(descriptionSource, 160)
          : "";
        const showSize =
          showGrowboxSize && isGrowboxProduct(p) && Boolean(p.growboxSize);
        return (
          <article
            key={p.id}
            className="flex flex-col gap-4 rounded-xl border border-stone-200 bg-white p-4 sm:flex-row [content-visibility:auto] [contain-intrinsic-size:320px]"
          >
            <Link
              href={`/products/${p.handle}`}
              data-gtag-item-id={p.defaultVariantId ?? p.id}
              data-gtag-item-name={p.title}
              data-gtag-item-brand={p.manufacturer ?? undefined}
              data-gtag-item-category={p.categories?.[0]?.title}
              data-gtag-item-price={p.priceRange?.minVariantPrice?.amount}
              data-gtag-item-index={index}
              className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white sm:w-56 md:w-64"
            >
              <div className="relative">
                <ProductImageCarousel
                  images={getProductImages(p)}
                  alt={[p.manufacturer, p.title].filter(Boolean).join(" ")}
                  className="aspect-square overflow-hidden rounded-lg bg-white"
                  imageClassName="h-full w-full object-contain transition duration-300 group-hover:scale-105"
                />
                {(p.compareAtPrice || (p.availableForSale && showLowStock)) && (
                  <div className="absolute left-3 top-3 flex flex-col gap-2">
                    {p.compareAtPrice && (
                      <span className="rounded-full bg-yellow-500 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-black shadow">
                        Sale
                      </span>
                    )}
                    {p.availableForSale && showLowStock && (
                      <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-800 shadow">
                        Low stock
                      </span>
                    )}
                  </div>
                )}
              </div>
            </Link>

            <div className="flex flex-1 flex-col gap-4">
              <div className="space-y-2">
                {showManufacturer && p.manufacturer && (
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
                    {p.manufacturer}
                  </p>
                )}
                {showSize && (
                  <p className="text-xs text-stone-600">
                    Größe: {p.growboxSize}
                  </p>
                )}
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
                {p.reviewSummary && p.reviewSummary.count > 0 && (
                  <ProductRating
                    average={p.reviewSummary.average}
                    count={p.reviewSummary.count}
                  />
                )}
                {descriptionText && (
                  <p className="hidden text-sm leading-6 text-stone-600/90 line-clamp-3 sm:block">
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
                <div className="flex w-full items-center justify-start gap-3">
                  <ProductCardActions
                    productId={p.id}
                    variantId={p.defaultVariantId ?? null}
                    available={p.availableForSale}
                    size="lg"
                    showCart={false}
                    itemTitle={p.title}
                    itemImageUrl={p.featuredImage?.url}
                    itemImageAlt={p.featuredImage?.altText ?? p.title}
                    itemPrice={p.priceRange?.minVariantPrice}
                    itemQuantity={1}
                  />
                  <ProductCardActions
                    productId={p.id}
                    variantId={p.defaultVariantId ?? null}
                    available={p.availableForSale}
                    size="lg"
                    showWishlist={false}
                    hideCartLabel={hideCartLabel}
                    itemTitle={p.title}
                    itemImageUrl={p.featuredImage?.url}
                    itemImageAlt={p.featuredImage?.altText ?? p.title}
                    itemPrice={p.priceRange?.minVariantPrice}
                    itemQuantity={1}
                    itemHandle={p.handle}
                  />
                  <Link
                    href={`/products/${p.handle}`}
                    data-gtag-item-id={p.defaultVariantId ?? p.id}
                    data-gtag-item-name={p.title}
                    data-gtag-item-brand={p.manufacturer ?? undefined}
                    data-gtag-item-category={p.categories?.[0]?.title}
                    data-gtag-item-price={p.priceRange?.minVariantPrice?.amount}
                    data-gtag-item-index={index}
                    className="inline-flex items-center justify-center rounded-full border border-stone-200 p-3 text-stone-700 shadow-sm transition hover:border-black/20 hover:text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                    aria-label="Zum Produkt"
                    title="Zum Produkt"
                  >
                    <ArrowTopRightOnSquareIcon className="h-5 w-5" />
                  </Link>
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
      <div className={`relative bg-white ${className ?? ""}`}>
        <Image
          src={current.url}
          alt={current.altText ?? alt}
          fill
          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
          quality={70}
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

function formatDiscountPercentage(
  compareAt?: { amount: string; currencyCode: string } | null,
  price?: { amount: string; currencyCode: string } | null,
) {
  if (!compareAt || !price) return "Sale";
  const compare = Number(compareAt.amount);
  const current = Number(price.amount);
  if (!Number.isFinite(compare) || !Number.isFinite(current) || compare <= 0) {
    return "Sale";
  }
  const percent = Math.round(((compare - current) / compare) * 100);
  if (!Number.isFinite(percent) || percent <= 0) return "Sale";
  return `-${percent}%`;
}

function getProductImages(product: Product) {
  const images = product.images ?? [];
  if (images.length) return images;
  return product.featuredImage ? [product.featuredImage] : [];
}

function formatShortText(value: string, maxChars?: number) {
  const withoutTags = value.replace(/<[^>]*>/g, " ");
  const cleaned = withoutTags.replace(/\s+/g, " ").trim();
  if (!maxChars || cleaned.length <= maxChars) return cleaned;
  return `${cleaned.slice(0, maxChars).trimEnd()}…`;
}

function isGrowboxProduct(product: Product) {
  return (
    product.categories?.some(
      (category) =>
        category.handle === "zelte" ||
        category.parent?.handle === "zelte",
    ) ?? false
  );
}
