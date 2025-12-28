"use client";

import Link from "next/link";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { MouseEvent } from "react";
import {
  ArrowTopRightOnSquareIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  HeartIcon as HeartIconOutline,
  ShoppingCartIcon,
} from "@heroicons/react/24/outline";
import { HeartIcon as HeartIconSolid } from "@heroicons/react/24/solid";
import { useCart } from "@/components/CartProvider";
import { useWishlist } from "@/hooks/useWishlist";

type Props = {
  products?: any[];
  cols?: number;
};

export default function DisplayProducts({products, cols = 4,}: Props) {
    const { isWishlisted, toggle } = useWishlist();
    return (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {products?.map((p) => (
            <Link key={p.id} href={`/products/${p.handle}`} className="block">
                <article
                    key={p.id}
                    className="
                        group rounded-xl border border-stone-200 bg-white
                        transition overflow-hidden hover:shadow-lg hover:-translate-y-0.5
                    "
                    >
                    {/* Image */}
                    <ProductImageCarousel
                      images={getProductImages(p)}
                      alt={p.title}
                      className="aspect-square overflow-hidden rounded-t-xl bg-stone-100"
                      imageClassName="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                    />

                    {/* Content */}
                    <div className="p-4">
                        {/* Vendor */}
                        <p className="text-xs uppercase tracking-wide text-stone-900">
                        {p.vendor}
                        </p>

                        {/* Title */}
                        <h2 className="mt-1 line-clamp-2 font-bold" style={{ color: '#000000ff' }}>
                            {p.title}
                        </h2>
                        {typeof p.availableForSale === "boolean" && (
                          <p
                            className={`mt-1 text-xs font-semibold ${
                              p.availableForSale ? "text-green-700" : "text-red-600"
                            }`}
                          >
                            {p.availableForSale ? "Verfügbar" : "Ausverkauft"}
                          </p>
                        )}

                        {/* Price */}
                        <p className="mt-2 text-base font-semibold text-stone-900">
                            {formatPrice(p.priceRange?.minVariantPrice)}
                        </p>
                        <div className="mt-3 flex items-center justify-center gap-2">
                          <WishlistButton
                            wishlisted={isWishlisted(p.id)}
                            onToggle={() => toggle(p.id)}
                          />
                <AddToCartButton
                  variantId={p.defaultVariantId ?? null}
                  available={p.availableForSale}
                  itemTitle={p.title}
                  itemImageUrl={p.featuredImage?.url}
                  itemImageAlt={p.featuredImage?.altText ?? p.title}
                  itemQuantity={1}
                />
                        </div>
                    </div>
                    </article>
                </Link>
            ))}
        </div>
    );
}

export function DisplayProductsList({ products }: Props) {
  const { isWishlisted, toggle } = useWishlist();
  return (
    <div className="mt-6 grid grid-cols-1 gap-4">
      {products?.map((p) => (
        <article
          key={p.id}
          className="flex flex-col gap-4 rounded-xl border border-stone-200 bg-white p-4 sm:flex-row"
        >
          <Link href={`/products/${p.handle}`} className="group block sm:w-56 md:w-64">
            <ProductImageCarousel
              images={getProductImages(p)}
              alt={p.title}
              className="aspect-square overflow-hidden rounded-lg bg-stone-100"
              imageClassName="h-full w-full object-cover transition duration-300 group-hover:scale-105"
            />
          </Link>

          <div className="flex flex-1 flex-col gap-4">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wide text-stone-900">{p.vendor}</p>
              <h2 className="text-lg font-bold" style={{ color: "#000000ff" }}>
                {p.title}
              </h2>
              {typeof p.availableForSale === "boolean" && (
                <p
                  className={`text-s font-semibold ${
                    p.availableForSale ? "text-green-700" : "text-red-600"
                  }`}
                >
                  {p.availableForSale ? "Verfügbar" : "Ausverkauft"}
                </p>
              )}
              {p.description && (
                <p className="text-sm text-stone-600 line-clamp-3">{p.description}</p>
              )}
            </div>

            <div className="mt-auto space-y-2">
              <p className="text-lg font-semibold text-stone-900">
                {formatPrice(p.priceRange?.minVariantPrice)}
              </p>
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <WishlistButton
                    wishlisted={isWishlisted(p.id)}
                    onToggle={() => toggle(p.id)}
                    size="lg"
                  />
                  <Link
                    href={`/products/${p.handle}`}
                    className="inline-flex items-center gap-2 rounded-lg border border-black/10 bg-white px-6 py-3 text-sm font-semibold text-stone-700 shadow-sm transition hover:border-black/20 hover:text-stone-900"
                  >
                    <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                    Zum Produkt
                  </Link>
                </div>
                <AddToCartButton
                  variantId={p.defaultVariantId ?? null}
                  available={p.availableForSale}
                  size="lg"
                  itemTitle={p.title}
                  itemImageUrl={p.featuredImage?.url}
                  itemImageAlt={p.featuredImage?.altText ?? p.title}
                  itemQuantity={1}
                />
              </div>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

function WishlistButton({
  wishlisted,
  onToggle,
  size = "sm",
}: {
  wishlisted: boolean;
  onToggle: () => void;
  size?: "sm" | "lg";
}) {
  const iconClass = size === "lg" ? "h-5 w-5" : "h-4 w-4";
  const buttonClass = size === "lg" ? "rounded-full border p-3 transition" : "rounded-full border p-2 transition";
  return (
    <button
      type="button"
      aria-label={wishlisted ? "Von Wunschliste entfernen" : "Zur Wunschliste"}
      aria-pressed={wishlisted}
      title="Zur Wunschliste"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle();
      }}
      className={`${buttonClass} cursor-pointer ${
        wishlisted
          ? "border-green-200 text-green-700"
          : "border-stone-200 text-stone-700 hover:border-green-200 hover:text-green-700"
      }`}
    >
      {wishlisted ? (
        <HeartIconSolid className={iconClass} />
      ) : (
        <HeartIconOutline className={iconClass} />
      )}
    </button>
  );
}

function AddToCartButton({
  variantId,
  available,
  size = "sm",
  itemTitle,
  itemImageUrl,
  itemImageAlt,
  itemQuantity = 1,
}: {
  variantId: string | null;
  available: boolean;
  size?: "sm" | "lg";
  itemTitle?: string;
  itemImageUrl?: string | null;
  itemImageAlt?: string | null;
  itemQuantity?: number;
}) {
  const { cart, addToCart, openAddedModal, openOutOfStockModal } = useCart();
  const [adding, setAdding] = useState(false);
  const canAdd = Boolean(variantId) && available && !adding;

  return (
    <button
      type="button"
      disabled={!canAdd}
      onClick={async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!variantId) return;
        setAdding(true);
        try {
          const beforeQty =
            cart?.lines.find((line) => line.merchandise.id === variantId)
              ?.quantity ?? 0;
          const updated = await addToCart(variantId, 1);
          const afterQty =
            updated.lines.find((line) => line.merchandise.id === variantId)
              ?.quantity ?? 0;
          if (afterQty <= beforeQty) {
            openOutOfStockModal();
            return;
          }
          if (itemTitle) {
            openAddedModal({
              title: itemTitle,
              imageUrl: itemImageUrl ?? undefined,
              imageAlt: itemImageAlt ?? undefined,
              quantity: itemQuantity,
            });
          }
        } catch {
          openOutOfStockModal();
        } finally {
          setAdding(false);
        }
      }}
      aria-label="In den Warenkorb"
      title="In den Warenkorb"
      className={`add-to-cart-sweep inline-flex items-center gap-1.5 rounded-full border font-semibold whitespace-nowrap transition cursor-pointer ${
        canAdd
          ? "border-green-900 bg-green-800 text-white shadow-sm hover:bg-green-900"
          : "border-stone-200 text-stone-400"
      } ${size === "lg" ? "px-6 py-3 text-sm" : "px-3 py-2 text-xs"}`}
    >
      <ShoppingCartIcon className={size === "lg" ? "h-5 w-5" : "h-4 w-4"} />
      In den Warenkorb
    </button>
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
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const count = images.length;
  const current = images[index];

  const handlePrev = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (count <= 1) return;
    setDirection(-1);
    setIndex((prev) => (prev - 1 + count) % count);
  };

  const handleNext = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (count <= 1) return;
    setDirection(1);
    setIndex((prev) => (prev + 1) % count);
  };

  return (
    <div className={`relative ${className ?? ""}`}>
      <AnimatePresence initial={false} mode="wait">
        {current && (
          <motion.img
            key={`${current.url}-${index}`}
            src={current.url}
            alt={current.altText ?? alt}
            className={`absolute inset-0 ${imageClassName ?? ""}`}
            initial="enter"
            animate="center"
            exit="exit"
            variants={{
              enter: { opacity: 0 },
              center: { opacity: 1 },
              exit: { opacity: 0 },
            }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          />
        )}
      </AnimatePresence>
      {count > 1 && (
        <>
          <button
            type="button"
            aria-label="Vorheriges Bild"
            onClick={handlePrev}
            className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-1 text-stone-700 shadow opacity-0 transition hover:bg-white group-hover:opacity-100"
          >
            <ChevronLeftIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Naechstes Bild"
            onClick={handleNext}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-1 text-stone-700 shadow opacity-0 transition hover:bg-white group-hover:opacity-100"
          >
            <ChevronRightIcon className="h-4 w-4" />
          </button>
        </>
      )}
    </div>
  );
}

function formatPrice(price?: {
  amount: string
  currencyCode: string
}) {
  if (!price) return null

  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: price.currencyCode,
    minimumFractionDigits: 2,
  }).format(Number(price.amount))
}

function getProductImages(product: any) {
  const fromArray = Array.isArray(product?.images) ? product.images : [];
  const fromEdges = Array.isArray(product?.images?.edges)
    ? product.images.edges.map((edge: any) => edge.node).filter(Boolean)
    : [];
  const images = fromArray.length ? fromArray : fromEdges;
  const featured = product?.featuredImage ?? null;

  if (featured && !images.some((img: any) => img?.url === featured.url)) {
    return [featured, ...images];
  }

  if (images.length) return images;
  return featured ? [featured] : [];
}
