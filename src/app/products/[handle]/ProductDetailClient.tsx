"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BeakerIcon,
  PlusIcon,
  InformationCircleIcon,
  ShieldCheckIcon,
  TruckIcon,
  WrenchScrewdriverIcon,
  ArrowUturnLeftIcon,
  ChevronRightIcon,
  ShoppingBagIcon,
} from "@heroicons/react/24/outline";
import { CheckCircleIcon } from "@heroicons/react/24/solid";
import { useCart } from "@/components/CartProvider";
import PaymentMethodLogos from "@/components/PaymentMethodLogos";
import { trackAnalyticsEvent } from "@/lib/analytics";

type ProductVariant = {
  id: string;
  title: string;
  options?: Array<{ name: string; value: string; imagePosition?: number | null }>;
  availableForSale: boolean;
  lowStock?: boolean;
  availableQuantity?: number;
  lowStockThreshold?: number;
  price: { amount: string; currencyCode: string };
  compareAt?: { amount: string; currencyCode: string } | null;
};
import LoadingSpinner from "@/components/LoadingSpinner";

const formatSelectedOptions = (options?: Array<{ name: string; value: string }>) => {
  if (!options?.length) return "";
  return options
    .map((opt) => `${opt.name}: ${opt.value}`)
    .filter(Boolean)
    .join(" · ");
};

const buildItemPayload = (
  product: {
    id: string;
    title: string;
    manufacturer?: string | null;
    categories?: Array<{ handle: string; title: string; parentId?: string | null }>;
  },
  variant: ProductVariant | null | undefined,
  quantity: number,
  optionsText?: string,
) => {
  if (!variant) return null;
  return {
    item_id: variant.id,
    item_name: product.title,
    item_brand: product.manufacturer ?? undefined,
    item_category: product.categories?.[0]?.title,
    item_variant: optionsText || variant.title,
    price: Number(variant.price.amount),
    quantity,
  };
};

export default function ProductDetailClient({
  product,
  productGroupItems,
  currentHandle,
  variants,
  imageUrl,
  imageAlt,
  options,
}: {
    product: {
      id: string;
      title: string;
      descriptionHtml: string;
      technicalDetailsHtml?: string;
      shortDescription?: string | null;
      manufacturer?: string | null;
      growboxSize?: string | null;
      categories?: Array<{ handle: string; title: string; parentId?: string | null }>;
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
  }, [currentHandle, product.id, product.title, productGroupItems]);

  const selectedVariant = useMemo(
    () => variants.find((v) => v.id === selectedVariantId),
    [variants, selectedVariantId],
  );

  const optionGroups = useMemo(() => {
    const map = new Map<string, Set<string>>();
    variants.forEach((variant) => {
      variant.options?.forEach((option) => {
        const set = map.get(option.name) ?? new Set<string>();
        set.add(option.value);
        map.set(option.name, set);
      });
    });
    if (map.size === 0 && options.length > 0) {
      options.forEach((option) => {
        map.set(option.name, new Set(option.values));
      });
    }
    return Array.from(map.entries()).map(([name, values]) => ({
      name,
      values: Array.from(values),
    }));
  }, [options, variants]);

  const selectedCartOptions = useMemo(() => {
    const fromGroups = optionGroups
      .map((opt) => ({
        name: opt.name,
        value: selectedOptions[opt.name] ?? "",
      }))
      .filter((entry) => entry.name && entry.value);
    if (fromGroups.length > 0) return fromGroups;
    return (
      selectedVariant?.options
        ?.map((opt) => ({ name: opt.name, value: opt.value }))
        .filter((entry) => entry.name && entry.value) ?? []
    );
  }, [optionGroups, selectedOptions, selectedVariant?.options]);
  const selectedOptionsKey = useMemo(() => {
    if (!selectedCartOptions.length) return "";
    return selectedCartOptions
      .map(
        (opt) =>
          `${encodeURIComponent(opt.name)}=${encodeURIComponent(opt.value)}`
      )
      .sort()
      .join("&");
  }, [selectedCartOptions]);

  const getLineOptionsKey = (
    options?: Array<{ name: string; value: string }>
  ) => {
    if (!options?.length) return "";
    return options
      .map(
        (opt) =>
          `${encodeURIComponent(opt.name)}=${encodeURIComponent(opt.value)}`
      )
      .sort()
      .join("&");
  };

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
  const [toast, setToast] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [addedPulse, setAddedPulse] = useState(false);
  const [checkoutStatus, setCheckoutStatus] = useState<"idle" | "loading" | "error">(
    "idle",
  );
  const [isMobile, setIsMobile] = useState(false);

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
  const featureItems = [
    "Schnelle Lieferung",
    "100% geprüft",
    "Diskret verpackt",
  ];
  const showAgeNotice = Boolean(
    product.categories?.some((category) => {
      const handle = category.handle.toLowerCase();
      const title = category.title.toLowerCase();
      return handle === "vaporizer" || title === "vaporizer";
    })
  );

  const startCheckout = async () => {
    if (!selectedVariantId) {
      setToast({ type: "error", text: "Keine Variante gewählt." });
      setTimeout(() => setToast(null), 1500);
      return;
    }
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
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ country: "DE" }),
      });
      const data = (await res.json().catch(() => null)) as { url?: string } | null;
      if (!res.ok || !data?.url) {
        setCheckoutStatus("error");
        setToast({
          type: "error",
          text: "Checkout fehlgeschlagen.",
        });
        setTimeout(() => setToast(null), 1500);
        return;
      }
      if (itemPayload) {
        trackAnalyticsEvent("add_payment_info", {
          currency: selectedVariant?.price.currencyCode,
          value: Number(selectedVariant?.price.amount) * quantity,
          payment_type: "stripe_checkout",
          items: [itemPayload],
        });
      }
      window.location.assign(data.url);
    } catch {
      setCheckoutStatus("error");
      setToast({
        type: "error",
        text: "Checkout fehlgeschlagen.",
      });
      setTimeout(() => setToast(null), 1500);
    }
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

  useEffect(() => {
    const media = window.matchMedia("(max-width: 640px)");
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return (
    <div className="rounded-[28px] border border-black/10 bg-white/85 p-6 shadow-sm">
      <div className="space-y-4">
        <div>
          {product.manufacturer && (
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-black/50">
              {product.manufacturer}
            </p>
          )}
          <h1 className="mt-2 text-2xl font-semibold text-black sm:text-3xl">
            {product.title}
          </h1>
          {selectedVariant && (
            <div className="mt-2 flex items-baseline gap-2">
              {compareAtLabel && (
                <span className="text-base font-semibold text-amber-600 line-through">
                  {compareAtLabel}
                </span>
              )}
              <span className="text-lg font-semibold text-black sm:text-xl">
                {priceLabel}
              </span>
            </div>
          )}
          </div>

        {groupOptions.length > 1 && (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-black/80">Auswahl</p>
            <select
              value={selectedGroupHandle}
              onChange={(e) => {
                const nextHandle = e.target.value;
                setSelectedGroupHandle(nextHandle);
                if (nextHandle !== currentHandle) {
                  router.push(`/products/${nextHandle}`);
                }
              }}
              className="h-11 w-full rounded-lg border border-black/10 bg-white px-3 text-sm outline-none focus:border-black/30 focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
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
                  <span className="text-xs font-semibold uppercase tracking-wide text-black/50">
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
                                sendImagePosition(selectedEntry?.imagePosition ?? null);
                              }
                              return next;
                            });
                          }}
                          className={`rounded-full border px-5 py-2 text-xs font-semibold transition ${
                            isSelected
                              ? "border-emerald-800 bg-gradient-to-r from-emerald-800 via-emerald-700 to-emerald-600 text-white shadow-sm"
                              : "border-emerald-900/30 bg-white text-black/80 hover:border-emerald-900/50"
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
            <p className="text-sm font-semibold text-black/80">Variante</p>
            <select
              value={selectedVariantId}
              onChange={(e) => setSelectedVariantId(e.target.value)}
              className="h-11 w-full rounded-lg border border-black/10 bg-white px-3 text-sm outline-none focus:border-black/30 focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
            >
              {variants.map((v) => (
                <option key={v.id} value={v.id} disabled={!v.availableForSale}>
                  {v.title} {!v.availableForSale ? "(Ausverkauft)" : ""}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="space-y-2">
          <p className="text-sm font-semibold text-black/80">Menge</p>
          <div className="flex flex-nowrap items-center gap-3">
            <div className="inline-flex items-center rounded-lg border border-black/10 bg-white">
              <button
                type="button"
                aria-label="Menge verringern"
                onClick={() => {
                  setQuantity((q) => Math.max(1, q - 1));
                  setQtyPulse("dec");
                  setTimeout(() => setQtyPulse(null), 160);
                }}
                className={`h-10 w-9 text-base font-semibold text-black/80 transition-transform duration-150 ${
                  qtyPulse === "dec" ? "scale-95" : "scale-100"
                } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white`}
              >
                <span className="inline-block scale-x-125">-</span>
              </button>
              <div className="grid h-10 w-10 place-items-center text-sm font-semibold text-black/80">
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
                className={`h-10 w-9 text-base font-semibold text-black/80 transition-transform duration-150 ${
                  qtyPulse === "inc" ? "scale-105" : "scale-100"
                } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white`}
              >
                +
              </button>
            </div>

            {isAvailable ? (
              <button
                type="button"
                onClick={async () => {
                  if (!selectedVariantId) {
                    setToast({
                      type: "error",
                      text: "Keine Variante gewählt.",
                    });
                    setTimeout(() => setToast(null), 1500);
                    return;
                  }

                  const beforeQty =
                    cart?.lines.find(
                      (line) =>
                        line.merchandise.id === selectedVariantId &&
                        getLineOptionsKey(line.merchandise.options) ===
                          selectedOptionsKey,
                    )?.quantity ?? 0;

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
                          getLineOptionsKey(line.merchandise.options) ===
                            selectedOptionsKey,
                      )?.quantity ?? 0;

                    if (afterQty > beforeQty) {
                      setToast({
                        type: "success",
                        text: "Zum Warenkorb hinzugefügt.",
                      });
                      setAddedPulse(true);
                      setTimeout(() => setAddedPulse(false), 250);
                      if (isMobile && selectedVariant) {
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
                  } catch (e) {
                    setToast({
                      type: "error",
                      text: "Hinzufügen fehlgeschlagen.",
                    });
                  } finally {
                    setTimeout(() => setToast(null), 1500);
                  }
                }}
                className={`flex h-10 min-w-0 flex-1 items-center justify-center gap-1 rounded-lg bg-gradient-to-r from-[#0f2f44] via-[#0b4f6c] to-[#1282a2] px-4 text-sm font-semibold text-white shadow-lg shadow-sky-900/15 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sky-900/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white ${
                  addedPulse ? "scale-[1.02]" : "scale-100"
                }`}
              >
                <>
                  <ShoppingBagIcon className="h-5 w-5" />
                  <span>In den Warenkorb</span>
                </>
              </button>
            ) : null}
          </div>
          {isAvailable ? (
            <button
              type="button"
              onClick={startCheckout}
              disabled={checkoutStatus === "loading"}
              className="mt-1.5 inline-flex w-full items-center justify-center rounded-lg bg-gradient-to-r from-[#14532d] via-[#2f3e36] to-[#0f766e] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-900/15 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-emerald-900/25 disabled:cursor-not-allowed disabled:from-stone-300 disabled:via-stone-200 disabled:to-stone-200 disabled:text-stone-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
            >
              {checkoutStatus === "loading" ? (
                <span className="flex items-center gap-2">
                  <LoadingSpinner size="sm" className="border-white/40 border-t-white" />
                  Weiterleitung...
                </span>
              ) : (
                "Zur Kasse"
              )}
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
                    Geringer Bestand
                  </p>
                ) : null}
                <p className="flex items-center gap-2 text-xs font-semibold text-emerald-700">
                  <span
                    aria-hidden="true"
                    className="h-2 w-2 rounded-full bg-emerald-600"
                  />
                  Sofort versandfertig, Lieferzeit ca. 2-5 Werktage
                </p>
              </div>
            ) : (
              <p className="flex items-center gap-2 text-xs font-semibold text-red-700">
                <span
                  aria-hidden="true"
                  className="h-2 w-2 rounded-full bg-red-600"
                />
                Zur Zeit nicht lieferbar
              </p>
            )}
          </div>
        </div>

        {!isAvailable ? (
          <form
            className="space-y-2 rounded-md border border-black/10 bg-white/70 p-3"
            onSubmit={async (event) => {
              event.preventDefault();
              if (!selectedVariantId) {
                setNotifyStatus("error");
                setNotifyMessage("Bitte Variante auswahlen.");
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
                  "Wir benachrichtigen dich, sobald der Artikel verfugbar ist.",
                );
                setNotifyEmail("");
              } catch (error) {
                setNotifyStatus("error");
                setNotifyMessage(
                  "Speichern fehlgeschlagen. Bitte erneut versuchen.",
                );
              }
            }}
          >
            <label
              htmlFor="notify-email"
              className="block text-xs font-semibold text-black/70"
            >
              Email fur Benachrichtigung
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                id="notify-email"
                type="email"
                value={notifyEmail}
                onChange={(event) => setNotifyEmail(event.target.value)}
                placeholder="deine@email.de"
                className="h-10 w-full rounded-md border border-black/15 px-3 text-sm outline-none focus:border-black/30 focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                required
              />
              <button
                type="submit"
                disabled={notifyStatus === "loading"}
                className="h-10 rounded-md border border-black/20 px-4 text-sm font-semibold text-black/70 hover:border-black/40 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
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
            className={`rounded-md px-3 py-2 text-sm ${
              toast.type === "success"
                ? "bg-green-50 text-green-800"
                : "bg-red-50 text-red-700"
            }`}
          >
            {toast.text}
          </div>
        )}

        {product.shortDescription ? (
          <div className="rounded-xl border border-black/10 bg-white px-4 py-4 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
                  <BeakerIcon className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-emerald-900">
                    Produkt-Info
                  </p>
                  <p className="mt-1 text-sm text-black/60">
                    {product.shortDescription}
                  </p>
                </div>
              </div>
              <ChevronRightIcon className="ml-4 h-5 w-5 text-black/40" />
            </div>
          </div>
        ) : null}

        <div className="space-y-3">
          {product.technicalDetailsHtml ? (
            <div className="rounded-xl border border-black/10 bg-white">
              <details className="group">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white [&::-webkit-details-marker]:hidden">
                  <span className="flex items-center gap-2 text-sm font-semibold text-black/80">
                    <WrenchScrewdriverIcon className="h-5 w-5 text-black/60" />
                    Technische Details
                  </span>
                  <PlusIcon className="h-5 w-5 text-black/60 transition-transform duration-300 group-open:rotate-45" />
                </summary>
                <div className="grid grid-rows-[0fr] transition-all duration-500 ease-out group-open:grid-rows-[1fr]">
                  <div className="overflow-hidden px-5 pb-5">
                    <div
                      className="product-description"
                      dangerouslySetInnerHTML={{
                        __html: product.technicalDetailsHtml,
                      }}
                    />
                  </div>
                </div>
              </details>
            </div>
          ) : null}
          <div className="rounded-xl border border-black/10 bg-white">
            <details className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white [&::-webkit-details-marker]:hidden">
                <span className="flex items-center gap-2 text-sm font-semibold text-black/80">
                  <TruckIcon className="h-5 w-5 text-black/60" />
                  Versand & Rücksendungen
                </span>
                <PlusIcon className="h-5 w-5 text-black/60 transition-transform duration-300 group-open:rotate-45" />
              </summary>
              <div className="grid grid-rows-[0fr] transition-all duration-500 ease-out group-open:grid-rows-[1fr]">
                <div className="overflow-hidden px-5 pb-5 text-sm text-black/70">
                  <p>
                    Lieferzeit in der Regel 2-5 Werktage nach Bestätigung der
                    Verfügbarkeit. Rücksendungen innerhalb von 14 Tagen möglich.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-3 text-xs font-semibold text-black/70">
                    <a
                      className="underline decoration-black/30 underline-offset-4 hover:decoration-black/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                      href="/pages/shipping"
                    >
                      Versanddetails
                    </a>
                    <a
                      className="underline decoration-black/30 underline-offset-4 hover:decoration-black/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                      href="/pages/return"
                    >
                      Rücksendungen
                    </a>
                  </div>
                </div>
              </div>
            </details>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-black/10 bg-white px-4 py-3 text-center">
            <div className="flex items-center justify-center gap-2 text-sm font-semibold text-black/80">
              <TruckIcon className="h-4 w-4 text-emerald-700" />
              Schnelle Lieferung
            </div>
            <p className="mt-1 text-xs text-black/60">2-5 Werktage</p>
          </div>
          <div className="rounded-xl border border-black/10 bg-white px-4 py-3 text-center">
            <div className="flex items-center justify-center gap-2 text-sm font-semibold text-black/80">
              <ShieldCheckIcon className="h-4 w-4 text-emerald-700" />
              Sichere Zahlung
            </div>
            <p className="mt-1 text-xs text-black/60">Sicherheitsprüfungen</p>
          </div>
        </div>
        <div className="rounded-xl border border-black/10 bg-white px-4 py-3 text-center">
          <div className="flex items-center justify-center gap-2 text-sm font-semibold text-black/80">
            <ArrowUturnLeftIcon className="h-4 w-4 text-emerald-700" />
            14 Tage Rückgabe
          </div>
          <p className="mt-1 text-xs text-black/60">Einfach & unkompliziert</p>
        </div>
        <div className="no-scrollbar flex items-center justify-center gap-2 overflow-x-auto">
          <PaymentMethodLogos
            className="flex-nowrap justify-center gap-2"
            pillClassName="h-8 px-3 border-black/10 bg-white"
            logoClassName="h-5"
          />
          <span className="inline-flex h-8 items-center rounded-full bg-white px-3">
            <img
              src="/shipping-provider-logos/dhl-logo.png"
              alt="DHL"
              className="h-5 w-auto object-contain"
              loading="lazy"
              decoding="async"
            />
          </span>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-4 pt-1 text-sm text-black/70">
          {featureItems.map((item) => (
            <div key={item} className="flex items-center gap-2">
              <CheckCircleIcon className="h-5 w-5 text-emerald-800" />
              <span className="font-medium">{item}</span>
            </div>
          ))}
        </div>
        {product.descriptionHtml ? (
          <div className="rounded-2xl border border-black/10 bg-white shadow-sm sm:hidden">
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
                      __html: product.descriptionHtml,
                    }}
                  />
                </div>
                </div>
              </details>
            </div>
          ) : null}
          {showAgeNotice && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 sm:hidden">
              Hinweis zum Jugendschutz: Dieses Produkt ist ausschließlich für
              Personen ab 18 Jahren bestimmt. Eine Abgabe an Minderjährige ist
              ausgeschlossen.
            </div>
          )}
        </div>
      </div>
  );
}

function formatPrice(price?: { amount: string; currencyCode: string }) {
  if (!price) return "";
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: price.currencyCode,
    minimumFractionDigits: 2,
  }).format(Number(price.amount));
}
