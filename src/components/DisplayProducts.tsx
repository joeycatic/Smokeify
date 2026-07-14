"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import dynamic from "next/dynamic";
import { ArrowTopRightOnSquareIcon, EyeIcon } from "@heroicons/react/24/outline";
import ProductCardActions from "@/components/ProductCardActions";
import Badge from "@/components/ui/Badge";
import StarRating from "@/components/ui/StarRating";
import type { Product } from "@/data/types";
import { buildMerchantItemId } from "@/lib/merchantFeed";
import { getProductBadges, type ProductBadge } from "@/lib/product-badges";
import {
  getImageFallbackLabel,
  shouldBypassImageOptimization,
} from "@/lib/storefrontImages";

const QuickViewModal = dynamic(() => import("@/components/QuickViewModal"), {
  ssr: false,
});

type Props = {
  products?: Product[];
  cols?: number;
  mobileCols?: 1 | 2;
  showManufacturer?: boolean;
  titleLines?: 2 | 3;
  showGrowboxSize?: boolean;
  hideCartLabel?: boolean;
  prioritizeFirstImage?: boolean;
};

const getProductLowStockState = (product: Product) => {
  const available = product.defaultVariantAvailableQuantity ?? 0;
  const threshold = product.defaultVariantLowStockThreshold ?? null;
  const isLowStock =
    threshold !== null && available > 0 && available <= threshold;
  return Boolean(product.lowStock || isLowStock);
};
const NEW_BADGE_CUTOFF_MS = Date.now() - 30 * 24 * 60 * 60 * 1000;

function ProductBadgeRow({
  badges,
  singleLine = false,
  limitOnMobile = false,
}: {
  badges: ProductBadge[];
  singleLine?: boolean;
  limitOnMobile?: boolean;
}) {
  if (badges.length === 0) return null;

  return (
    <div
      className={`mt-2 flex items-center gap-2 ${
        singleLine
          ? "min-w-0 max-w-full overflow-hidden"
          : "flex-wrap"
      }`}
    >
      {badges.map((badge, index) => {
        const badgeElement = (
          <Badge
            tone={badge.tone}
            className="min-w-0 max-w-full truncate normal-case tracking-normal"
            title={badge.label}
          >
            {badge.label}
          </Badge>
        );

        return limitOnMobile && index > 0 ? (
          <span key={badge.label} className="hidden sm:block">
            {badgeElement}
          </span>
        ) : (
          <span key={badge.label}>{badgeElement}</span>
        );
      })}
    </div>
  );
}

export default function DisplayProducts({
  products,
  cols = 4,
  mobileCols = 1,
  showManufacturer = false,
  titleLines = 2,
  showGrowboxSize = false,
  hideCartLabel = false,
  prioritizeFirstImage = false,
}: Props) {
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);
  const desktopGridColsClass =
    cols === 2
      ? "sm:grid-cols-2 lg:grid-cols-2"
      : cols === 3
        ? "sm:grid-cols-2 lg:grid-cols-3"
        : "sm:grid-cols-2 lg:grid-cols-4";
  const mobileGridColsClass = mobileCols === 2 ? "grid-cols-2" : "grid-cols-1";
  const compactMobileGrid = mobileCols === 2;
  const titleClampClass = titleLines === 3 ? "line-clamp-3" : "line-clamp-2";
  const sorted = [...(products ?? [])].sort(
    (a, b) => Number(b.availableForSale) - Number(a.availableForSale)
  );
  return (
    <>
    <div
      className={`mt-6 grid ${
        compactMobileGrid ? "gap-2.5 sm:gap-5" : "gap-5"
      } ${mobileGridColsClass} ${desktopGridColsClass}`}
    >
      {sorted.map((p, index) => {
        const showLowStock = getProductLowStockState(p);
        const showSize =
          showGrowboxSize && isGrowboxProduct(p) && Boolean(p.growboxSize);
        const productBadges = getProductBadges(p, 2);
        return (
          <article
            key={p.id}
            className={`group gv-glass flex h-full w-full flex-col overflow-hidden transition-transform duration-200 hover:-translate-y-0.5 hover:border-[color:var(--gv-lime)]/45 hover:shadow-[var(--gv-shadow-lg)] ${
              compactMobileGrid ? "rounded-[20px] sm:rounded-[24px]" : "rounded-[24px]"
            }`}
          >
              {/* Image */}
              <Link
                href={`/products/${p.handle}`}
                data-gtag-item-id={buildMerchantItemId(p.defaultVariantId ?? p.id)}
                data-gtag-item-name={p.title}
                data-gtag-item-brand={p.manufacturer ?? undefined}
                data-gtag-item-category={p.categories?.[0]?.title}
                data-gtag-item-price={p.priceRange?.minVariantPrice?.amount}
                data-gtag-item-index={index}
                  className="relative block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--gv-lime)]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--gv-forest)]"
              >
                <ProductImageCarousel
                  images={getProductImages(p)}
                  alt={[p.manufacturer, p.title].filter(Boolean).join(" ")}
                  priority={prioritizeFirstImage && index < cols}
                  className={`aspect-[9/8] overflow-hidden bg-white sm:aspect-square ${
                    compactMobileGrid
                      ? "rounded-t-[20px] sm:rounded-t-[24px]"
                      : "rounded-t-[24px]"
                  }`}
                  imageClassName="h-full w-full object-contain transition duration-300 group-hover:scale-[1.04]"
                />
                <div className="absolute left-3 top-3 flex flex-col items-start gap-1.5">
                  {p.compareAtPrice && (
                    <span className="rounded-full bg-[color:var(--gv-lime)] px-2.5 py-1 font-[family:var(--font-jetbrains-mono)] text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--gv-forest)] shadow sm:px-3">
                      {formatDiscountPercentage(
                        p.compareAtPrice,
                        p.priceRange?.minVariantPrice,
                      )}
                    </span>
                  )}
                  {p.availableForSale && showLowStock && (
                    <span className="rounded-full bg-[color:var(--gv-warning)] px-2.5 py-1 font-[family:var(--font-jetbrains-mono)] text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--gv-forest)] shadow sm:px-3">
                      {p.defaultVariantLowStockThreshold != null &&
                      p.defaultVariantAvailableQuantity != null
                        ? `Noch ${p.defaultVariantAvailableQuantity} verfügbar`
                        : "Geringer Bestand"}
                    </span>
                  )}
                  {!p.compareAtPrice && p.bestsellerScore != null && p.bestsellerScore > 0 && (
                    <span className="rounded-full border border-[color:var(--gv-border)] bg-[color:var(--gv-dark)] px-2.5 py-1 font-[family:var(--font-jetbrains-mono)] text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--gv-text)] shadow sm:px-3">
                      Bestseller
                    </span>
                  )}
                  {p.createdAt && new Date(p.createdAt).getTime() > NEW_BADGE_CUTOFF_MS && (
                    <span className="rounded-full bg-[color:var(--gv-lime)] px-2.5 py-1 font-[family:var(--font-jetbrains-mono)] text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--gv-forest)] shadow sm:px-3">
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
                  className="absolute bottom-3 left-1/2 z-10 hidden -translate-x-1/2 translate-y-1 items-center gap-1.5 whitespace-nowrap rounded-full border border-[color:var(--gv-border)] bg-[color:var(--gv-dark)]/95 px-3.5 py-1.5 text-xs font-semibold text-[color:var(--gv-text)] opacity-0 shadow-md transition-all duration-150 hover:border-[color:var(--gv-lime)]/40 group-hover:translate-y-0 group-hover:opacity-100 sm:inline-flex"
                  aria-label={`Schnellansicht: ${p.title}`}
                >
                  <EyeIcon className="h-3.5 w-3.5" />
                  Schnellansicht
                </button>
              </Link>

              {/* Content */}
              <div
                className={`flex flex-1 flex-col ${
                  compactMobileGrid ? "p-3 sm:p-4" : "p-4"
                }`}
              >
                <div>
                  <div>
                    {showManufacturer && p.manufacturer && (
                      <p className="font-[family:var(--font-dm-sans)] text-[11px] font-medium uppercase tracking-[0.12em] text-[color:var(--gv-text-muted)]">
                        {p.manufacturer}
                      </p>
                    )}
                    {showSize && (
                      <p className="mt-1 text-xs text-[color:var(--gv-text-muted)]">
                        Größe: {p.growboxSize}
                      </p>
                    )}
                  </div>
                  <ProductBadgeRow
                    badges={productBadges}
                    singleLine
                    limitOnMobile={compactMobileGrid}
                  />
                </div>
                {/* Title */}
                <Link
                  href={`/products/${p.handle}`}
                  data-gtag-item-id={buildMerchantItemId(p.defaultVariantId ?? p.id)}
                  data-gtag-item-name={p.title}
                  data-gtag-item-brand={p.manufacturer ?? undefined}
                  data-gtag-item-category={p.categories?.[0]?.title}
                  data-gtag-item-price={p.priceRange?.minVariantPrice?.amount}
                  data-gtag-item-index={index}
                  className="mt-2 block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--gv-lime)]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--gv-forest)]"
                >
                  <h2
                    className={`${titleClampClass} font-[family:var(--font-dm-sans)] font-semibold leading-snug text-[color:var(--gv-text)] ${
                      compactMobileGrid ? "text-sm sm:text-base" : "text-base"
                    }`}
                  >
                    {p.title}
                  </h2>
                </Link>
                {typeof p.availableForSale === "boolean" &&
                  (!p.availableForSale || showLowStock) && (
                  <p
                    className={`mt-2 text-xs font-semibold ${
                      p.availableForSale && showLowStock
                        ? "text-[color:var(--gv-warning)]"
                        : "text-[color:var(--gv-error)]"
                    }`}
                  >
                    {p.availableForSale
                      ? p.defaultVariantLowStockThreshold != null &&
                        p.defaultVariantAvailableQuantity != null
                        ? `Nur noch ${p.defaultVariantAvailableQuantity} verfügbar`
                        : "Geringer Bestand"
                      : "Ausverkauft"}
                  </p>
                )}
                <div className="mt-auto pt-3">
                  <div className="min-h-[1.25rem]">
                    {p.reviewSummary && p.reviewSummary.count > 0 ? (
                      <StarRating
                        average={p.reviewSummary.average}
                        count={p.reviewSummary.count}
                        className="mt-0"
                      />
                    ) : null}
                  </div>

                  <div
                    className={`mt-2 flex min-h-[2rem] gap-2 ${
                      compactMobileGrid
                        ? "flex-col items-start gap-y-0.5 sm:flex-row sm:items-baseline"
                        : "items-baseline"
                    }`}
                  >
                    {p.compareAtPrice && (
                      <span className="text-sm font-semibold text-[color:var(--gv-clay)] line-through">
                        {formatPrice(p.compareAtPrice)}
                      </span>
                    )}
                    <span className="font-[family:var(--font-jetbrains-mono)] text-lg font-semibold text-[color:var(--gv-lime)]">
                      {formatPrice(p.priceRange?.minVariantPrice)}
                    </span>
                  </div>
                  <div
                    className={`mt-4 grid w-full items-center ${
                      compactMobileGrid
                        ? "grid-cols-2 gap-1 sm:grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] sm:gap-2"
                        : "grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] gap-2"
                    }`}
                  >
                    <div
                      className={`items-center justify-start ${
                        compactMobileGrid ? "hidden sm:flex" : "flex"
                      }`}
                    >
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
                    <div
                      className={`flex items-center ${
                        compactMobileGrid
                          ? "col-span-2 w-full justify-center sm:col-span-1 sm:w-auto"
                          : "justify-center"
                      }`}
                    >
                      <ProductCardActions
                        productId={p.id}
                        variantId={p.defaultVariantId ?? null}
                        available={p.availableForSale}
                        showWishlist={false}
                        hideCartLabel={compactMobileGrid ? false : hideCartLabel}
                        mobileFullWidthCart={compactMobileGrid}
                        itemTitle={p.title}
                        itemImageUrl={p.featuredImage?.url}
                        itemImageAlt={p.featuredImage?.altText ?? p.title}
                        itemPrice={p.priceRange?.minVariantPrice}
                        itemQuantity={1}
                        itemHandle={p.handle}
                      />
                    </div>
                    <div
                      className={`items-center justify-end ${
                        compactMobileGrid ? "hidden sm:flex" : "flex"
                      }`}
                    >
                      <Link
                        href={`/products/${p.handle}`}
                        data-gtag-item-id={buildMerchantItemId(p.defaultVariantId ?? p.id)}
                        data-gtag-item-name={p.title}
                        data-gtag-item-brand={p.manufacturer ?? undefined}
                        data-gtag-item-category={p.categories?.[0]?.title}
                        data-gtag-item-price={p.priceRange?.minVariantPrice?.amount}
                        data-gtag-item-index={index}
                        className="inline-flex items-center justify-center rounded-2xl border border-[color:var(--gv-border)] bg-[color:var(--gv-surface)] p-3 text-[color:var(--gv-text-muted)] shadow-sm transition hover:border-[color:var(--gv-lime)]/40 hover:text-[color:var(--gv-lime)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--gv-lime)]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--gv-forest)]"
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
    {quickViewProduct ? (
      <QuickViewModal
        product={quickViewProduct}
        open
        onClose={() => setQuickViewProduct(null)}
      />
    ) : null}
    </>
  );
}

export function DisplayProductsList({
  products,
  showManufacturer = false,
  showGrowboxSize = false,
  hideCartLabel = false,
  prioritizeFirstImage = false,
}: Props) {
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);
  const sorted = [...(products ?? [])].sort(
    (a, b) => Number(b.availableForSale) - Number(a.availableForSale)
  );
  return (
    <>
      <div className="mt-6 grid grid-cols-1 gap-4">
        {sorted.map((p, index) => {
          const showLowStock = getProductLowStockState(p);
          const productBadges = getProductBadges(p, 3);
          const showSize =
            showGrowboxSize && isGrowboxProduct(p) && Boolean(p.growboxSize);
          return (
            <article
              key={p.id}
              className="gv-glass flex flex-col gap-4 rounded-[24px] p-4 sm:flex-row"
            >
            <Link
              href={`/products/${p.handle}`}
              data-gtag-item-id={buildMerchantItemId(p.defaultVariantId ?? p.id)}
              data-gtag-item-name={p.title}
              data-gtag-item-brand={p.manufacturer ?? undefined}
              data-gtag-item-category={p.categories?.[0]?.title}
              data-gtag-item-price={p.priceRange?.minVariantPrice?.amount}
              data-gtag-item-index={index}
              className="group block rounded-[20px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--gv-lime)]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--gv-forest)] sm:w-56 md:w-64"
            >
              <div className="relative">
                <ProductImageCarousel
                  images={getProductImages(p)}
                  alt={[p.manufacturer, p.title].filter(Boolean).join(" ")}
                  priority={prioritizeFirstImage && index === 0}
                  className="aspect-square overflow-hidden rounded-[20px] bg-white"
                  imageClassName="h-full w-full object-contain transition duration-300 group-hover:scale-105"
                />
                {(p.compareAtPrice || (p.availableForSale && showLowStock)) && (
                  <div className="absolute left-3 top-3 flex flex-col gap-2">
                    {p.compareAtPrice && (
                      <Badge tone="clay" className="shadow">
                        {formatDiscountPercentage(p.compareAtPrice, p.priceRange?.minVariantPrice)}
                      </Badge>
                    )}
                    {p.availableForSale && showLowStock && (
                      <Badge tone="neutral" className="shadow">
                        Geringer Bestand
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            </Link>

            <div className="flex flex-1 flex-col gap-4">
              <div className="space-y-2">
                <div>
                  {showManufacturer && p.manufacturer && (
                    <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--gv-text-muted)]">
                      {p.manufacturer}
                    </p>
                  )}
                  {showSize && (
                    <p className="text-xs text-[color:var(--gv-text-muted)]">
                      Größe: {p.growboxSize}
                    </p>
                  )}
                </div>
                <ProductBadgeRow badges={productBadges} singleLine />
                <h2 className="text-lg font-semibold text-[color:var(--gv-text)]">
                  {p.title}
                </h2>
                {typeof p.availableForSale === "boolean" &&
                  (!p.availableForSale || showLowStock) && (
                  <p
                    className={`text-s font-semibold ${
                      p.availableForSale && showLowStock
                        ? "text-[color:var(--gv-warning)]"
                        : "text-[color:var(--gv-error)]"
                    }`}
                  >
                    {p.availableForSale
                      ? "Geringer Bestand"
                      : "Ausverkauft"}
                  </p>
                )}
                {p.reviewSummary && p.reviewSummary.count > 0 && (
                  <StarRating
                    average={p.reviewSummary.average}
                    count={p.reviewSummary.count}
                  />
                )}
              </div>

              <div className="mt-auto space-y-2">
                <div className="text-lg font-semibold text-[color:var(--gv-lime)]">
                  <div className="flex items-baseline gap-2">
                    {p.compareAtPrice && (
                      <span className="text-sm font-semibold text-[color:var(--gv-clay)] line-through">
                        {formatPrice(p.compareAtPrice)}
                      </span>
                    )}
                    <span>{formatPrice(p.priceRange?.minVariantPrice)}</span>
                  </div>
                </div>
                <div className="flex w-full flex-wrap items-center justify-start gap-3">
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
                    data-gtag-item-id={buildMerchantItemId(p.defaultVariantId ?? p.id)}
                    data-gtag-item-name={p.title}
                    data-gtag-item-brand={p.manufacturer ?? undefined}
                    data-gtag-item-category={p.categories?.[0]?.title}
                    data-gtag-item-price={p.priceRange?.minVariantPrice?.amount}
                    data-gtag-item-index={index}
                    className="inline-flex items-center justify-center rounded-2xl border border-[color:var(--gv-border)] bg-[color:var(--gv-surface)] p-3 text-[color:var(--gv-text-muted)] shadow-sm transition hover:border-[color:var(--gv-lime)]/40 hover:text-[color:var(--gv-lime)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--gv-lime)]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--gv-forest)]"
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
      {quickViewProduct ? (
        <QuickViewModal
          product={quickViewProduct}
          open
          onClose={() => setQuickViewProduct(null)}
        />
      ) : null}
    </>
  );
}

function ProductImageCarousel({
  images,
  alt,
  priority = false,
  className,
  imageClassName,
}: {
  images: Array<{ url: string; altText?: string | null }>;
  alt: string;
  priority?: boolean;
  className?: string;
  imageClassName?: string;
}) {
  const current = images[0];
  const [imageFailed, setImageFailed] = useState(false);
  if (!current) return null;
  const resolvedAlt = current.altText ?? alt;
  if (imageFailed) {
    return (
      <div
        className={`relative grid place-items-center overflow-hidden bg-[linear-gradient(135deg,#f7faf2_0%,#eef4e9_52%,#dfead8_100%)] ${className ?? ""}`}
        aria-label={resolvedAlt}
      >
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(12,14,11,0.04)_1px,transparent_1px),linear-gradient(180deg,rgba(12,14,11,0.035)_1px,transparent_1px)] bg-[size:28px_28px]" />
        <div className="relative grid h-20 w-20 place-items-center rounded-3xl border border-[#182414]/10 bg-white/80 font-[family:var(--font-jetbrains-mono)] text-lg font-bold text-[#2A3828] shadow-sm">
          {getImageFallbackLabel(resolvedAlt)}
        </div>
        <p className="sr-only">Produktbild konnte nicht geladen werden.</p>
      </div>
    );
  }
  return (
      <div className={`relative bg-white ${className ?? ""}`}>
        <Image
          src={current.url}
          alt={resolvedAlt}
          fill
          sizes="(min-width: 1280px) 18rem, (min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
          quality={70}
          unoptimized={shouldBypassImageOptimization(current.url)}
          priority={priority}
          fetchPriority={priority ? "high" : "auto"}
          className={`absolute inset-0 ${imageClassName ?? ""}`}
          onError={() => setImageFailed(true)}
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

function isGrowboxProduct(product: Product) {
  return (
    product.categories?.some(
      (category) =>
        category.handle === "zelte" ||
        category.parent?.handle === "zelte",
    ) ?? false
  );
}
