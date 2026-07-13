"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ShoppingBag } from "lucide-react";
import { useCart } from "@/components/CartProvider";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { buildCheckoutStartUrl } from "@/lib/checkoutStart";
import { pushRecentlyViewed } from "@/lib/recentlyViewed";
import {
  STANDARD_DELIVERY_WINDOW_DE,
} from "@/lib/storefrontTrust";
import LoadingSpinner from "@/components/LoadingSpinner";
import StarRating from "@/components/ui/StarRating";
import ProductDetailTrustBlock from "./ProductDetailTrustBlock";
import { isTentCategory } from "@/lib/tentDimensions";
import { useStickyAddToCartBar } from "./useStickyAddToCartBar";
import {
  buildLineOptionsKey,
  buildItemPayload,
  buildProductOptionGroups,
  buildSelectedCartOptions,
  formatDetailPrice as formatPrice,
  formatSelectedOptions,
  type ProductVariant,
} from "./productDetailShared";

function RunningManIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
    >
      <path d="M13.5 5.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm-3.6 13.9 1-4.4 2.1 2v6h2v-7.5l-2.1-2 .6-3A7.2 7.2 0 0 0 19 13v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1L6 8.3V13h2V9.6l1.8-.7L8.2 17l-4.9-1-.4 2 7 1.4Z" />
    </svg>
  );
}
export default function ProductDetailClient({
  product,
  productGroupItems,
  currentHandle,
  variants,
  imageUrl,
  imageAlt,
  options,
  reviewSummary,
}: {
  product: {
    id: string;
    title: string;
    descriptionHtml: string;
    technicalDetailsHtml?: string;
    shortDescription?: string | null;
    manufacturer?: string | null;
    growboxSize?: string | null;
    categories?: Array<{
      handle: string;
      title: string;
      parentId?: string | null;
      parent?: { handle: string; title: string } | null;
    }>;
  };
  productGroupItems?: Array<{
    id: string;
    title: string;
    handle: string;
    growboxSize?: string | null;
  }>;
  currentHandle: string;
  variants: ProductVariant[];
  imageUrl?: string | null;
  imageAlt?: string | null;
  options: Array<{ name: string; values: string[] }>;
  reviewSummary: { average: number; count: number };
}) {
  const router = useRouter();
  const [quantity, setQuantity] = useState(1);
  const [qtyPulse, setQtyPulse] = useState<"inc" | "dec" | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<string>(
    variants?.[0]?.id ?? "",
  );
  const [selectedOptions, setSelectedOptions] = useState<
    Record<string, string>
  >({});
  const [notifyEmail, setNotifyEmail] = useState("");
  const [notifyStatus, setNotifyStatus] = useState<
    "idle" | "loading" | "ok" | "error"
  >("idle");
  const [notifyMessage, setNotifyMessage] = useState<string | null>(null);
  const [selectedGroupHandle, setSelectedGroupHandle] = useState(currentHandle);
  const sendImagePosition = (position?: number | null) => {
    if (typeof window === "undefined") return;
    if (typeof position !== "number") return;
    // Defer to avoid setState during render warnings
    setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent("product-image-position", { detail: { position } }),
      );
    }, 0);
  };

  useEffect(() => {
    setSelectedGroupHandle(currentHandle);
  }, [currentHandle]);

  const groupOptions = useMemo(() => {
    const items = productGroupItems ?? [];
    const hasCurrent = items.some((item) => item.handle === currentHandle);
    return hasCurrent
      ? items
      : [
          {
            id: product.id,
            title: product.title,
            handle: currentHandle,
            growboxSize: product.growboxSize ?? null,
          },
          ...items,
        ];
  }, [
    currentHandle,
    product.growboxSize,
    product.id,
    product.title,
    productGroupItems,
  ]);

  const selectedVariant = useMemo(
    () => variants.find((v) => v.id === selectedVariantId),
    [variants, selectedVariantId],
  );

  const optionGroups = useMemo(() => {
    return buildProductOptionGroups(variants, options);
  }, [options, variants]);

  const selectedCartOptions = useMemo(() => {
    return buildSelectedCartOptions({
      optionGroups,
      selectedOptions,
      selectedVariant,
    });
  }, [optionGroups, selectedOptions, selectedVariant]);
  const selectedOptionsKey = useMemo(() => {
    return buildLineOptionsKey(selectedCartOptions);
  }, [selectedCartOptions]);

  const getLineOptionsKey = (
    options?: Array<{ name: string; value: string }>,
  ) => buildLineOptionsKey(options);

  useEffect(() => {
    if (!optionGroups.length) return;
    if (selectedVariant?.options?.length) {
      const next: Record<string, string> = {};
      selectedVariant.options.forEach((option) => {
        next[option.name] = option.value;
      });
      setSelectedOptions(next);
      return;
    }
    const defaults: Record<string, string> = {};
    optionGroups.forEach((option) => {
      defaults[option.name] = option.values[0] ?? "";
    });
    setSelectedOptions(defaults);
  }, [optionGroups, selectedVariant]);

  useEffect(() => {
    const position = selectedVariant?.options?.find(
      (option) => typeof option.imagePosition === "number",
    )?.imagePosition;
    sendImagePosition(position ?? null);
  }, [selectedVariantId, selectedVariant]);

  const priceLabel = selectedVariant ? formatPrice(selectedVariant.price) : "";
  const compareAtLabel =
    selectedVariant?.compareAt &&
    selectedVariant.compareAt.amount !== selectedVariant.price.amount
      ? formatPrice(selectedVariant.compareAt)
      : null;

  const { cart, addToCart, openAddedModal } = useCart();
  const viewTrackedRef = useRef<string | null>(null);
  const primaryAddToCartButtonRef = useRef<HTMLButtonElement>(null);
  const [toast, setToast] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [addedPulse, setAddedPulse] = useState(false);
  const [addToCartStatus, setAddToCartStatus] = useState<"idle" | "loading">(
    "idle",
  );
  const [checkoutStatus, setCheckoutStatus] = useState<
    "idle" | "loading" | "error"
  >("idle");

  const isAvailable = Boolean(selectedVariant?.availableForSale);
  const cartQuantity =
    cart?.lines
      .filter((line) => line.merchandise.id === selectedVariantId)
      .reduce((sum, line) => sum + line.quantity, 0) ?? 0;
  const effectiveAvailable =
    (selectedVariant?.availableQuantity ?? 0) - cartQuantity;
  const isLowStock =
    Boolean(selectedVariant?.availableForSale) &&
    selectedVariant?.lowStockThreshold !== undefined &&
    effectiveAvailable > 0 &&
    effectiveAvailable <= (selectedVariant?.lowStockThreshold ?? 0);
  const isGrowboxProduct = Boolean(isTentCategory(product.categories));
  const { showStickyBar, navBottom } = useStickyAddToCartBar(
    primaryAddToCartButtonRef,
    Boolean(selectedVariant?.availableForSale),
  );
  const runCheckout = async () => {
    setCheckoutStatus("loading");
    try {
      const itemPayload = buildItemPayload(
        product,
        selectedVariant,
        quantity,
        formatSelectedOptions(selectedCartOptions),
      );
      if (itemPayload) {
        trackAnalyticsEvent("begin_checkout", {
          currency: selectedVariant?.price.currencyCode,
          value: Number(selectedVariant?.price.amount) * quantity,
          items: [itemPayload],
        });
      }
      await addToCart(selectedVariantId, quantity, selectedCartOptions);
      router.push(buildCheckoutStartUrl({ country: "DE" }));
    } catch {
      setCheckoutStatus("error");
      setToast({
        type: "error",
        text: "Checkout fehlgeschlagen.",
      });
      setTimeout(() => setToast(null), 1500);
    }
  };

  const startCheckout = () => {
    if (!selectedVariantId) {
      setToast({ type: "error", text: "Keine Variante gewählt." });
      setTimeout(() => setToast(null), 1500);
      return;
    }
    void runCheckout();
  };

  useEffect(() => {
    setNotifyStatus("idle");
    setNotifyMessage(null);
  }, [selectedVariantId, isAvailable]);

  useEffect(() => {
    if (!selectedVariant) return;
    const key = `${product.id}:${selectedVariant.id}:${selectedOptionsKey}`;
    if (viewTrackedRef.current === key) return;
    viewTrackedRef.current = key;
    const itemPayload = buildItemPayload(
      product,
      selectedVariant,
      1,
      formatSelectedOptions(selectedCartOptions),
    );
    if (!itemPayload) return;
    trackAnalyticsEvent("view_item", {
      currency: selectedVariant.price.currencyCode,
      value: Number(selectedVariant.price.amount),
      items: [itemPayload],
    });
  }, [product, selectedCartOptions, selectedOptionsKey, selectedVariant]);

  const handleAddToCart = async () => {
    if (addToCartStatus === "loading") return;
    if (!selectedVariantId) {
      setToast({ type: "error", text: "Keine Variante gewählt." });
      setTimeout(() => setToast(null), 1500);
      return;
    }
    const beforeQty =
      cart?.lines.find(
        (line) =>
          line.merchandise.id === selectedVariantId &&
          getLineOptionsKey(line.merchandise.options) === selectedOptionsKey,
      )?.quantity ?? 0;
    setAddToCartStatus("loading");
    try {
      const updated = await addToCart(
        selectedVariantId,
        quantity,
        selectedCartOptions,
      );
      const afterQty =
        updated?.lines.find(
          (line) =>
            line.merchandise.id === selectedVariantId &&
            getLineOptionsKey(line.merchandise.options) === selectedOptionsKey,
        )?.quantity ?? 0;
      if (afterQty > beforeQty) {
        setToast({ type: "success", text: "Zum Warenkorb hinzugefügt." });
        setAddedPulse(true);
        setTimeout(() => setAddedPulse(false), 250);
        if (selectedVariant) {
          openAddedModal({
            title: product.title,
            imageUrl: imageUrl ?? undefined,
            imageAlt: imageAlt ?? product.title,
            price: selectedVariant.price,
            quantity,
            productHandle: currentHandle,
          });
        }
      } else {
        setToast({ type: "error", text: "Nicht genug Bestand." });
      }
    } catch {
      setToast({ type: "error", text: "Hinzufügen fehlgeschlagen." });
    } finally {
      setAddToCartStatus("idle");
      setTimeout(() => setToast(null), 1500);
    }
  };

  useEffect(() => {
    const fallbackVariant = variants[0];
    const price = selectedVariant?.price ?? fallbackVariant?.price;
    pushRecentlyViewed({
      handle: currentHandle,
      title: product.title,
      imageUrl: imageUrl ?? null,
      imageAlt: imageAlt ?? product.title,
      manufacturer: product.manufacturer ?? null,
      price: price
        ? { amount: price.amount, currencyCode: price.currencyCode }
        : null,
    });
  }, [
    currentHandle,
    imageAlt,
    imageUrl,
    product.manufacturer,
    product.title,
    selectedVariant?.id,
    selectedVariant?.price,
    variants,
  ]);

  return (
    <>
      <div className="border-t border-[color:var(--gv-border)]/70 bg-[color:var(--gv-dark)]/96 p-4 shadow-[0_-18px_48px_rgba(0,0,0,0.22)] sm:rounded-[32px] sm:border sm:border-[color:var(--gv-border)] sm:bg-[color:var(--gv-dark)]/92 sm:p-6 sm:shadow-[0_24px_60px_rgba(0,0,0,0.3)] lg:min-h-full">
        {/* Sticky ATC bar */}
        <div
          className={`fixed inset-x-0 z-[45] transition-[opacity,transform] duration-200 ${
            showStickyBar
              ? "opacity-100 translate-y-0 pointer-events-auto"
              : "opacity-0 -translate-y-1 pointer-events-none"
          }`}
          style={{ top: navBottom }}
          aria-hidden={!showStickyBar}
          inert={showStickyBar ? undefined : true}
        >
          <div className="border-b border-[color:var(--gv-border)] bg-[color:var(--gv-dark)]/97 shadow-md">
            <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-3 py-2.5 sm:flex-nowrap sm:gap-3 sm:px-6">
              {imageUrl && (
                <Image
                  src={imageUrl}
                  alt={imageAlt ?? product.title}
                  width={40}
                  height={40}
                  className="h-10 w-10 shrink-0 rounded-lg object-contain"
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-[color:var(--gv-text)]">
                  {product.title}
                </p>
                {selectedVariant && (
                  <p className="text-sm text-[color:var(--gv-lime)]">
                    {priceLabel}
                  </p>
                )}
              </div>
              {isAvailable && (
                <button
                  type="button"
                  onClick={handleAddToCart}
                  disabled={addToCartStatus === "loading"}
                  className="inline-flex w-full shrink-0 items-center justify-center gap-1.5 rounded-full bg-[color:var(--gv-lime)] px-4 py-2 text-sm font-semibold text-[color:var(--gv-forest)] shadow-[0_12px_30px_var(--gv-lime-glow)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--gv-lime)]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--gv-forest)] sm:w-auto"
                >
                  {addToCartStatus === "loading" ? (
                    <>
                      <LoadingSpinner
                        size="sm"
                        className="border-[color:var(--gv-forest)]/20 border-t-[color:var(--gv-forest)]"
                      />
                      <span className="hidden sm:inline">
                        Wird hinzugefügt...
                      </span>
                      <span className="sm:hidden">Lädt...</span>
                    </>
                  ) : (
                    <>
                      <ShoppingBag className="h-4 w-4" />
                      <span className="hidden sm:inline">In den Warenkorb</span>
                      <span className="sm:hidden">Kaufen</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="space-y-5">
          <div>
            {product.manufacturer && (
              <p className="font-[family:var(--font-jetbrains-mono)] text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--gv-text-muted)]">
                {product.manufacturer}
              </p>
            )}
            <h1 className="mt-2 font-[family:var(--font-syne)] text-[1.8rem] font-bold leading-[1.02] tracking-[-0.04em] text-[color:var(--gv-text)] sm:text-4xl">
              {product.title}
            </h1>
            {reviewSummary.count > 0 ? (
              <StarRating
                average={reviewSummary.average}
                count={reviewSummary.count}
                className="mt-3"
              />
            ) : null}
            {selectedVariant && (
              <div className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                {compareAtLabel && (
                  <span className="text-base font-semibold text-amber-500 line-through">
                    {compareAtLabel}
                  </span>
                )}
                <span className="font-[family:var(--font-jetbrains-mono)] text-[1.9rem] font-semibold leading-none text-[color:var(--gv-lime)] sm:text-[2rem]">
                  {priceLabel}
                </span>
              </div>
            )}
            {product.shortDescription ? (
              <p className="mt-3 text-sm leading-6 text-[color:var(--gv-text-muted)]">
                {product.shortDescription}
              </p>
            ) : null}
          </div>

          {groupOptions.length > 1 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-[color:var(--gv-text)]">
                Auswahl
              </p>
              <select
                value={selectedGroupHandle}
                onChange={(e) => {
                  const nextHandle = e.target.value;
                  setSelectedGroupHandle(nextHandle);
                  if (nextHandle !== currentHandle) {
                    router.push(`/products/${nextHandle}`);
                  }
                }}
                className="gv-input h-12 w-full rounded-2xl px-3 text-sm outline-none focus:border-[color:var(--gv-lime)]/50 focus-visible:ring-2 focus-visible:ring-[color:var(--gv-lime)]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--gv-forest)]"
              >
                {groupOptions.map((item) => (
                  <option key={item.id} value={item.handle}>
                    {item.growboxSize || item.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          {optionGroups.length > 0 && (
            <div className="space-y-3">
              <div className="space-y-4">
                {optionGroups.map((option) => (
                  <div key={option.name} className="space-y-2">
                    <span className="font-[family:var(--font-jetbrains-mono)] text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--gv-text-muted)]">
                      {option.name}
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {option.values.map((value) => {
                        const isSelected =
                          (selectedOptions[option.name] ?? "") === value;
                        return (
                          <button
                            key={value}
                            type="button"
                            onClick={() => {
                              setSelectedOptions((prev) => {
                                const next = { ...prev, [option.name]: value };
                                const match = variants.find((variant) =>
                                  optionGroups.every((opt) => {
                                    const selected = next[opt.name];
                                    if (!selected) return true;
                                    const hasValue = variant.options?.some(
                                      (entry) =>
                                        entry.name === opt.name &&
                                        entry.value === selected,
                                    );
                                    return Boolean(hasValue);
                                  }),
                                );
                                if (match) {
                                  setSelectedVariantId(match.id);
                                  const selectedEntry = match.options?.find(
                                    (entry) =>
                                      entry.name === option.name &&
                                      entry.value === value,
                                  );
                                  sendImagePosition(
                                    selectedEntry?.imagePosition ?? null,
                                  );
                                }
                                return next;
                              });
                            }}
                            className={`min-h-11 rounded-full border px-5 py-2 text-xs font-semibold transition ${
                              isSelected
                                ? "border-[color:var(--gv-lime)] bg-[color:var(--gv-lime)] text-[color:var(--gv-forest)] shadow-sm"
                                : "border-[color:var(--gv-border)] bg-[color:var(--gv-surface)] text-[color:var(--gv-text)] hover:border-[color:var(--gv-lime)]/40"
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
            </div>
          )}

          {variants.length > 1 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-[color:var(--gv-text)]">
                Variante
              </p>
              <select
                value={selectedVariantId}
                onChange={(e) => setSelectedVariantId(e.target.value)}
                className="gv-input h-12 w-full rounded-2xl px-3 text-sm outline-none focus:border-[color:var(--gv-lime)]/50 focus-visible:ring-2 focus-visible:ring-[color:var(--gv-lime)]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--gv-forest)]"
              >
                {variants.map((v) => (
                  <option
                    key={v.id}
                    value={v.id}
                    disabled={!v.availableForSale}
                  >
                    {v.title} {!v.availableForSale ? "(Ausverkauft)" : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-sm font-semibold text-[color:var(--gv-text)]">
              Menge
            </p>
            <div className="flex items-center gap-3">
              <div className="inline-flex shrink-0 items-center rounded-2xl border border-[color:var(--gv-border)] bg-[color:var(--gv-surface)]">
                <button
                  type="button"
                  aria-label="Menge verringern"
                  onClick={() => {
                    setQuantity((q) => Math.max(1, q - 1));
                    setQtyPulse("dec");
                    setTimeout(() => setQtyPulse(null), 160);
                  }}
                  className={`h-12 w-11 text-base font-semibold text-[color:var(--gv-text)] transition-transform duration-150 ${
                    qtyPulse === "dec" ? "scale-95" : "scale-100"
                  } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--gv-lime)]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--gv-forest)]`}
                >
                  <span className="inline-block scale-x-125">-</span>
                </button>
                <div className="grid h-12 w-11 place-items-center text-sm font-semibold text-[color:var(--gv-text)]">
                  {quantity}
                </div>
                <button
                  type="button"
                  aria-label="Menge erhöhen"
                  onClick={() => {
                    setQuantity((q) => q + 1);
                    setQtyPulse("inc");
                    setTimeout(() => setQtyPulse(null), 160);
                  }}
                  className={`h-12 w-11 text-base font-semibold text-[color:var(--gv-text)] transition-transform duration-150 ${
                    qtyPulse === "inc" ? "scale-105" : "scale-100"
                  } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--gv-lime)]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--gv-forest)]`}
                >
                  +
                </button>
              </div>

              {isAvailable ? (
                <div className="min-w-0 flex-1">
                  <button
                    ref={primaryAddToCartButtonRef}
                    type="button"
                    onClick={handleAddToCart}
                    disabled={addToCartStatus === "loading"}
                    className={`flex h-12 w-full min-w-0 items-center justify-center gap-1.5 rounded-2xl bg-[color:var(--gv-lime)] px-4 text-sm font-semibold text-[color:var(--gv-forest)] shadow-lg shadow-[color:var(--gv-lime)]/10 transition-all duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--gv-lime)]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--gv-forest)] ${
                      addedPulse ? "scale-[1.02]" : "scale-100"
                    } disabled:cursor-not-allowed disabled:opacity-70`}
                  >
                    {addToCartStatus === "loading" ? (
                      <>
                        <LoadingSpinner
                          size="sm"
                          className="border-[color:var(--gv-forest)]/20 border-t-[color:var(--gv-forest)]"
                        />
                        <span>Wird hinzugefügt...</span>
                      </>
                    ) : (
                      <>
                        <ShoppingBag className="h-5 w-5" />
                        <span>In den Warenkorb</span>
                      </>
                    )}
                  </button>
                </div>
              ) : null}
            </div>
            {isAvailable ? (
              <button
                type="button"
                onClick={startCheckout}
                disabled={checkoutStatus === "loading"}
                className="group relative inline-flex h-12 w-full items-center justify-center gap-2.5 overflow-hidden rounded-2xl border border-[#23476f] bg-[linear-gradient(135deg,#0b1f3a_0%,#163a63_100%)] px-6 text-base font-bold text-white shadow-[0_12px_28px_rgba(11,31,58,0.22)] transition-all duration-300 ease-out hover:-translate-y-0.5 hover:border-[#315f91] hover:brightness-110 hover:shadow-[0_18px_36px_rgba(11,31,58,0.32)] active:translate-y-0 active:scale-[0.99] motion-reduce:transform-none motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#163a63] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--gv-forest)]"
              >
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/4 -skew-x-12 bg-white/15 blur-sm transition-transform duration-500 ease-out group-hover:translate-x-[600%] motion-reduce:hidden"
                />
                {checkoutStatus === "loading" ? (
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    <LoadingSpinner
                      size="sm"
                      className="border-white/25 border-t-white"
                    />
                    Weiterleitung...
                  </span>
                ) : (
                  <>
                    <RunningManIcon className="relative z-10 h-5 w-5 shrink-0 transition-transform duration-300 ease-out group-hover:-rotate-6 group-hover:translate-x-1 motion-reduce:transform-none motion-reduce:transition-none" />
                    <span className="relative z-10">Direkt zur Kasse</span>
                  </>
                )}
              </button>
            ) : null}
            {isGrowboxProduct ? (
              <button
                type="button"
                onClick={() => {
                  const params = new URLSearchParams({
                    sizeId: product.id,
                    source: "pdp",
                  });
                  router.push(`/customizer?${params.toString()}`);
                }}
                className="mt-1.5 inline-flex w-full items-center justify-center rounded-2xl border border-[color:var(--gv-lime)]/35 bg-[color:var(--gv-lime)]/10 px-6 py-3 text-sm font-semibold text-[color:var(--gv-lime)] shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-[color:var(--gv-lime)]/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--gv-lime)]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--gv-forest)]"
              >
                Selber konfigurieren
              </button>
            ) : null}

            <div className="mt-2">
              {selectedVariant?.availableForSale ? (
                <div className="space-y-1">
                  {isLowStock ? (
                    <p className="flex items-center gap-2 text-xs font-semibold text-amber-700">
                      <span
                        aria-hidden="true"
                        className="h-2 w-2 rounded-full bg-amber-600"
                      />
                      Nur noch {effectiveAvailable} verfügbar
                    </p>
                  ) : null}
                  <p className="flex items-center gap-2 text-xs font-semibold text-[color:var(--gv-success)]">
                    <span
                      aria-hidden="true"
                      className="h-2 w-2 rounded-full bg-[color:var(--gv-success)]"
                    />
                    Sofort versandfertig, Lieferzeit ca.{" "}
                    {STANDARD_DELIVERY_WINDOW_DE}
                  </p>
                </div>
              ) : (
                <p className="flex items-center gap-2 text-xs font-semibold text-red-700">
                  <span
                    aria-hidden="true"
                    className="h-2 w-2 rounded-full bg-[color:var(--gv-error)]"
                  />
                  Zur Zeit nicht lieferbar
                </p>
              )}
            </div>
          </div>

          {!isAvailable ? (
            <form
              className="space-y-2 rounded-[24px] border border-transparent bg-[color:var(--gv-surface)] p-4 sm:border-[color:var(--gv-border)]"
              onSubmit={async (event) => {
                event.preventDefault();
                if (!selectedVariantId) {
                  setNotifyStatus("error");
                  setNotifyMessage("Bitte Variante auswählen.");
                  return;
                }
                const email = notifyEmail.trim();
                if (!email) {
                  setNotifyStatus("error");
                  setNotifyMessage("Bitte eine E-Mail angeben.");
                  return;
                }
                setNotifyStatus("loading");
                setNotifyMessage(null);
                try {
                  const res = await fetch("/api/back-in-stock", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      email,
                      productId: product.id,
                      productTitle: product.title,
                      variantId: selectedVariantId,
                      variantTitle: selectedVariant?.title ?? null,
                    }),
                  });
                  if (!res.ok) {
                    const data = await res.json().catch(() => null);
                    throw new Error(data?.error || "Request failed");
                  }
                  setNotifyStatus("ok");
                  setNotifyMessage(
                    "Wir benachrichtigen dich, sobald der Artikel verfügbar ist.",
                  );
                  setNotifyEmail("");
                } catch {
                  setNotifyStatus("error");
                  setNotifyMessage(
                    "Speichern fehlgeschlagen. Bitte erneut versuchen.",
                  );
                }
              }}
            >
              <label
                htmlFor="notify-email"
                className="block text-xs font-semibold text-[color:var(--gv-text-muted)]"
              >
                E-Mail für Benachrichtigung
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  id="notify-email"
                  type="email"
                  value={notifyEmail}
                  onChange={(event) => setNotifyEmail(event.target.value)}
                  placeholder="deine@email.de"
                  className="gv-input h-10 w-full rounded-2xl px-3 text-sm outline-none focus:border-[color:var(--gv-lime)]/50 focus-visible:ring-2 focus-visible:ring-[color:var(--gv-lime)]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--gv-forest)]"
                  required
                />
                <button
                  type="submit"
                  disabled={notifyStatus === "loading"}
                  className="h-10 rounded-2xl border border-[color:var(--gv-border)] px-4 text-sm font-semibold text-[color:var(--gv-text)] hover:border-[color:var(--gv-lime)]/40 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--gv-lime)]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--gv-forest)]"
                >
                  {notifyStatus === "loading" ? (
                    <span className="inline-flex items-center gap-2">
                      <LoadingSpinner size="sm" />
                      Bitte warten...
                    </span>
                  ) : (
                    "Benachrichtigen"
                  )}
                </button>
              </div>
              {notifyMessage && (
                <p
                  className={`text-xs font-semibold ${
                    notifyStatus === "ok" ? "text-green-700" : "text-red-600"
                  }`}
                >
                  {notifyMessage}
                </p>
              )}
            </form>
          ) : null}
          {toast && (
            <div
              className={`rounded-2xl px-3 py-2 text-sm ${
                toast.type === "success"
                  ? "bg-[color:var(--gv-success)]/10 text-[color:var(--gv-success)]"
                  : "bg-[color:var(--gv-error)]/10 text-[color:var(--gv-error)]"
              }`}
            >
              {toast.text}
            </div>
          )}

          <ProductDetailTrustBlock />

        </div>
      </div>
    </>
  );
}
