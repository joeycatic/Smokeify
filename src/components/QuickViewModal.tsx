"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  XMarkIcon,
  ArrowTopRightOnSquareIcon,
  EyeIcon,
} from "@heroicons/react/24/outline";
import { StarIcon as StarSolidIcon } from "@heroicons/react/24/solid";
import { StarIcon as StarOutlineIcon } from "@heroicons/react/24/outline";
import { useCart } from "@/components/CartProvider";
import type { Product } from "@/data/types";

type VariantOption = { name: string; value: string };
type VariantChoice = {
  id: string;
  title: string;
  available: boolean;
  options: VariantOption[];
};

const isMeaningfulVariantTitle = (title: string) =>
  !/^(default|default title)$/i.test(title.trim());

function buildOptionGroups(variants: VariantChoice[]) {
  const groups = new Map<string, Set<string>>();
  variants.forEach((v) => {
    v.options.forEach((opt) => {
      if (!opt.name || !opt.value) return;
      const set = groups.get(opt.name) ?? new Set<string>();
      set.add(opt.value);
      groups.set(opt.name, set);
    });
  });
  return Array.from(groups.entries()).map(([name, values]) => ({
    name,
    values: Array.from(values),
  }));
}

function formatPrice(price?: { amount: string; currencyCode: string } | null) {
  if (!price) return null;
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: price.currencyCode,
    minimumFractionDigits: 2,
  }).format(Number(price.amount));
}

function formatShortText(value: string, maxChars: number) {
  const withoutTags = value.replace(/<[^>]*>/g, " ");
  const cleaned = withoutTags.replace(/\s+/g, " ").trim();
  if (cleaned.length <= maxChars) return cleaned;
  return `${cleaned.slice(0, maxChars).trimEnd()}…`;
}

type Props = {
  product: Product | null;
  open: boolean;
  onClose: () => void;
};

export default function QuickViewModal({ product, open, onClose }: Props) {
  const { cart, addToCart, openAddedModal, openOutOfStockModal } = useCart();
  const [variants, setVariants] = useState<VariantChoice[] | null>(null);
  const [variantsLoading, setVariantsLoading] = useState(false);
  const [selectedOptions, setSelectedOptions] = useState<
    Record<string, string>
  >({});
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!open || !product) {
      setVariants(null);
      setSelectedOptions({});
      setAdding(false);
      return;
    }
    const controller = new AbortController();
    const load = async () => {
      setVariantsLoading(true);
      try {
        const res = await fetch(
          `/api/products/handle/${encodeURIComponent(product.handle)}/variants`,
          { signal: controller.signal },
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { variants?: VariantChoice[] };
        const next = data.variants ?? [];
        setVariants(next);
        const groups = buildOptionGroups(next);
        const defaults: Record<string, string> = {};
        groups.forEach((group) => {
          if (group.values.length > 0) defaults[group.name] = group.values[0];
        });
        setSelectedOptions(defaults);
      } catch {
        setVariants([]);
      } finally {
        setVariantsLoading(false);
      }
    };
    void load();
    return () => controller.abort();
  }, [open, product]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open || !product) return null;

  const optionGroups = buildOptionGroups(variants ?? []);
  const hasOptions =
    variants !== null &&
    variants.some(
      (v) => v.options.length > 0 || isMeaningfulVariantTitle(v.title),
    );

  const resolveVariant = (): VariantChoice | null => {
    if (!variants?.length) return null;
    if (!hasOptions) return variants[0] ?? null;
    return (
      variants.find((v) =>
        optionGroups.every((group) => {
          const selectedValue = selectedOptions[group.name];
          if (!selectedValue) return false;
          return v.options.some(
            (o) => o.name === group.name && o.value === selectedValue,
          );
        }),
      ) ?? null
    );
  };

  const handleAddToCart = async () => {
    const resolved = resolveVariant();
    const variantIdToUse = resolved?.id ?? product.defaultVariantId;
    if (!variantIdToUse) return;

    const options = hasOptions
      ? optionGroups
          .map((g) => ({ name: g.name, value: selectedOptions[g.name] ?? "" }))
          .filter((o) => o.name && o.value)
      : undefined;

    setAdding(true);
    try {
      const beforeTotal = cart?.totalQuantity ?? 0;
      const updated = await addToCart(variantIdToUse, 1, options);
      if (updated.totalQuantity <= beforeTotal) {
        openOutOfStockModal();
        return;
      }
      openAddedModal({
        title: product.title,
        imageUrl: product.featuredImage?.url,
        imageAlt: product.featuredImage?.altText ?? product.title,
        price: product.priceRange?.minVariantPrice,
        quantity: 1,
        productHandle: product.handle,
      });
      onClose();
    } catch {
      openOutOfStockModal();
    } finally {
      setAdding(false);
    }
  };

  const isAvailable = product.availableForSale;
  const imageUrl = product.featuredImage?.url ?? product.images?.[0]?.url;
  const imageAlt =
    product.featuredImage?.altText ??
    [product.manufacturer, product.title].filter(Boolean).join(" ");
  const descriptionText = product.shortDescription?.trim()
    ? formatShortText(product.shortDescription, 200)
    : "";
  const reviewRounded = Math.max(
    0,
    Math.min(5, Math.round(product.reviewSummary?.average ?? 0)),
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-xl sm:max-w-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 pb-0">
          <span className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
            Schnellansicht
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Schließen"
            className="rounded-full p-1.5 text-stone-500 hover:text-stone-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="grid gap-5 p-5 sm:grid-cols-2 sm:gap-8 sm:p-6">
          {/* Image */}
          <div className="relative aspect-square overflow-hidden rounded-xl bg-stone-50">
            {imageUrl ? (
              <Image
                src={imageUrl}
                alt={imageAlt}
                fill
                className="object-contain"
                sizes="(min-width: 640px) 320px, 90vw"
                quality={80}
              />
            ) : (
              <div className="h-full w-full bg-stone-100" />
            )}
          </div>

          {/* Details */}
          <div className="flex flex-col gap-3">
            {product.manufacturer && (
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
                {product.manufacturer}
              </p>
            )}

            <h2 className="text-xl font-bold leading-snug text-stone-900">
              {product.title}
            </h2>

            {product.reviewSummary && product.reviewSummary.count > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-stone-600">
                <div className="flex items-center gap-0.5" aria-hidden="true">
                  {Array.from({ length: 5 }).map((_, i) =>
                    i < reviewRounded ? (
                      <StarSolidIcon
                        key={i}
                        className="h-3.5 w-3.5 text-amber-500"
                      />
                    ) : (
                      <StarOutlineIcon
                        key={i}
                        className="h-3.5 w-3.5 text-amber-500"
                      />
                    ),
                  )}
                </div>
                <span>
                  {product.reviewSummary.average.toFixed(1)} (
                  {product.reviewSummary.count})
                </span>
              </div>
            )}

            <p
              className={`text-xs font-semibold ${isAvailable ? "text-green-700" : "text-red-600"}`}
            >
              {isAvailable ? "● Verfügbar" : "● Ausverkauft"}
            </p>

            <div className="flex items-baseline gap-2">
              {product.compareAtPrice && (
                <span className="text-sm font-semibold text-yellow-600 line-through">
                  {formatPrice(product.compareAtPrice)}
                </span>
              )}
              <span className="text-2xl font-bold text-stone-900">
                {formatPrice(product.priceRange?.minVariantPrice)}
              </span>
            </div>

            {descriptionText && (
              <p className="line-clamp-3 text-sm leading-relaxed text-stone-600">
                {descriptionText}
              </p>
            )}

            <hr className="border-stone-200" />

            {/* Variant selector */}
            {variantsLoading && (
              <div className="flex items-center gap-2 text-xs text-stone-500">
                <EyeIcon className="h-4 w-4 animate-pulse" />
                Optionen werden geladen…
              </div>
            )}

            {!variantsLoading && hasOptions && optionGroups.length > 0 && (
              <div className="space-y-3">
                {optionGroups.map((group) => (
                  <div key={group.name}>
                    <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-stone-500">
                      {group.name}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {group.values.map((value) => {
                        const selected = selectedOptions[group.name] === value;
                        return (
                          <button
                            key={`${group.name}-${value}`}
                            type="button"
                            onClick={() =>
                              setSelectedOptions((prev) => ({
                                ...prev,
                                [group.name]: value,
                              }))
                            }
                            className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold transition ${
                              selected
                                ? "border-emerald-600 bg-emerald-50 text-emerald-800"
                                : "border-stone-200 bg-white text-stone-600 hover:border-emerald-300"
                            }`}
                          >
                            {value}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Actions */}
            <div className="mt-auto flex flex-col gap-2.5 pt-1">
              <button
                type="button"
                disabled={!isAvailable || adding}
                onClick={handleAddToCart}
                className={`inline-flex w-full items-center justify-center rounded-full px-5 py-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 focus-visible:ring-offset-white ${
                  isAvailable && !adding
                    ? "bg-green-800 text-white shadow-sm hover:bg-green-900"
                    : "cursor-not-allowed bg-stone-200 text-stone-400"
                }`}
              >
                {adding ? "Wird hinzugefügt…" : "In den Warenkorb"}
              </button>

              <Link
                href={`/products/${product.handle}`}
                onClick={onClose}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-stone-200 px-5 py-2.5 text-sm font-semibold text-stone-700 transition hover:border-black/20 hover:text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
              >
                <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                Zum Produkt
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
