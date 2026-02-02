"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import PageLayout from "@/components/PageLayout";
import LoadingSpinner from "@/components/LoadingSpinner";
import { useCart } from "@/components/CartProvider";
import { trackAdsConversion } from "@/lib/gtag";
import { canUseAnalytics } from "@/lib/gtag";

type OrderItem = {
  id: string;
  name: string;
  quantity: number;
  unitAmount: number;
  totalAmount: number;
  currency: string;
  imageUrl?: string | null;
  manufacturer?: string | null;
  options?: Array<{ name: string; value: string }>;
};

type OrderSummary = {
  id: string;
  createdAt: string;
  amountSubtotal: number;
  amountTax: number;
  amountShipping: number;
  amountDiscount: number;
  amountTotal: number;
  currency: string;
  paymentStatus: string;
  status: string;
  discountCode: string | null;
  customerEmail: string | null;
  shippingName: string | null;
  shippingLine1: string | null;
  shippingLine2: string | null;
  shippingPostalCode: string | null;
  shippingCity: string | null;
  shippingCountry: string | null;
  items: OrderItem[];
  provisional?: boolean;
};

const formatPrice = (amount: number, currency: string) =>
  new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount / 100);

const formatItemName = (item: OrderItem) => {
  const defaultSuffix = / - Default( Title)?(?=\s*\(|$)/i;
  if (!defaultSuffix.test(item.name)) return item.name;
  const manufacturer = item.manufacturer?.trim();
  if (manufacturer) {
    return item.name.replace(defaultSuffix, ` - ${manufacturer}`);
  }
  return item.name.replace(defaultSuffix, "");
};

const formatOptions = (options?: Array<{ name: string; value: string }>) => {
  if (!options?.length) return "";
  return options
    .map((opt) => `${opt.name}: ${opt.value}`)
    .filter(Boolean)
    .join(" · ");
};

const pushDataLayerPurchase = (order: OrderSummary) => {
  if (typeof window === "undefined") return;
  if (!canUseAnalytics()) return;
  const dataLayer = (window as { dataLayer?: Array<Record<string, unknown>> })
    .dataLayer;
  if (!Array.isArray(dataLayer)) return;

  dataLayer.push({ ecommerce: null });
  dataLayer.push({
    event: "purchase",
    ecommerce: {
      transaction_id: order.id,
      currency: order.currency,
      value: order.amountTotal / 100,
      tax: order.amountTax / 100,
      shipping: order.amountShipping / 100,
      discount: order.amountDiscount > 0 ? order.amountDiscount / 100 : undefined,
      items: order.items.map((item) => ({
        item_id: item.id,
        item_name: formatItemName(item),
        item_brand: item.manufacturer ?? undefined,
        item_variant: item.options ? formatOptions(item.options) : undefined,
        price: item.unitAmount / 100,
        quantity: item.quantity,
      })),
    },
  });
};

export default function OrderSuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status } = useSession();
  const { refresh } = useCart();
  const purchaseTracked = useRef(false);

  const sessionId = searchParams.get("session_id") || "";
  const returnTo = useMemo(() => {
    const base = "/order/success";
    return sessionId
      ? `${base}?session_id=${encodeURIComponent(sessionId)}`
      : base;
  }, [sessionId]);

  const [order, setOrder] = useState<OrderSummary | null>(null);
  const [loadStatus, setLoadStatus] = useState<
    "idle" | "loading" | "pending" | "ok" | "error"
  >("idle");
  const [cartCleared, setCartCleared] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 60;
  const retryDelayMs = 8000;
  const adsPurchaseLabel = process.env.NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_LABEL;

  useEffect(() => {
    if (!sessionId) return;
    if (status === "loading") return;
    if (loadStatus !== "idle") return;

    const loadOrder = async () => {
      setLoadStatus("loading");
      try {
        const res = await fetch("/api/orders/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          order?: OrderSummary;
          pending?: boolean;
        };
        if (res.status === 202 || data.pending) {
          if (data.order) {
            setOrder(data.order);
          }
          setLoadStatus("pending");
          return;
        }
        if (!res.ok) {
          setLoadStatus("error");
          return;
        }
        if (!data.order) {
          setLoadStatus("error");
          return;
        }
        setOrder(data.order);
        setLoadStatus("ok");
        setRetryCount(0);
      } catch {
        setLoadStatus("error");
      }
    };

    void loadOrder();
  }, [loadStatus, returnTo, router, sessionId, status]);

  useEffect(() => {
    if (loadStatus !== "pending") return;
    if (retryCount >= maxRetries) {
      setLoadStatus("error");
      return;
    }
    const timer = setTimeout(() => {
      setLoadStatus("idle");
      setRetryCount((prev) => prev + 1);
    }, retryDelayMs);
    return () => clearTimeout(timer);
  }, [loadStatus, maxRetries, retryCount, retryDelayMs]);

  useEffect(() => {
    if (!order || cartCleared) return;
    const clearCart = async () => {
      try {
        await fetch("/api/cart", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "clear" }),
        });
        await refresh();
      } finally {
        setCartCleared(true);
      }
    };
    void clearCart();
  }, [cartCleared, order, refresh]);

  useEffect(() => {
    if (!order || purchaseTracked.current) return;
    if (loadStatus !== "ok") return;
    if (order.provisional) return;
    purchaseTracked.current = true;
    pushDataLayerPurchase(order);
    trackAdsConversion(adsPurchaseLabel, {
      value: order.amountTotal / 100,
      currency: order.currency,
      transaction_id: order.id,
    });
  }, [loadStatus, order]);

  return (
    <PageLayout>
      <div className="mx-auto max-w-4xl px-6 py-10 text-stone-800">
        <div className="rounded-2xl border border-black/10 bg-gradient-to-br from-[#fef7e7] via-white to-[#e7f5ff] p-6 shadow-[0_16px_40px_rgba(15,23,42,0.12)]">
          <div className="mb-6 text-center">
            <h1 className="text-3xl font-bold" style={{ color: "#2f3e36" }}>
              Bestellung erfolgreich
            </h1>
            <p className="mt-2 text-sm text-stone-600">
              Vielen Dank! Deine Bestellung wurde erfolgreich abgeschlossen.
            </p>
          </div>

          {status === "loading" || loadStatus === "loading" ? (
            <div className="flex items-center justify-center gap-3 py-8 text-stone-600">
              <LoadingSpinner size="sm" />
              <span>Bestellung wird geladen...</span>
            </div>
          ) : null}

          {loadStatus === "pending" && !order ? (
            <div className="flex items-center justify-center gap-3 py-6 text-stone-600">
              <LoadingSpinner size="sm" />
              <span>Zahlung wird bestaetigt. Bitte warten...</span>
            </div>
          ) : null}

          {loadStatus === "error" ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              Bestellung konnte nicht geladen werden. Bitte versuche es erneut.
            </div>
          ) : null}

          {order && (loadStatus === "ok" || loadStatus === "pending") ? (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-stone-400">
                    {order.provisional ? "Sitzungs-ID" : "Bestellnummer"}
                  </p>
                  <p className="text-sm font-semibold">
                    {order.provisional
                      ? order.id.slice(0, 12)
                      : order.id.slice(0, 8).toUpperCase()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs uppercase tracking-wide text-stone-400">
                    Gesamt
                  </p>
                  <p className="text-lg font-semibold">
                    {formatPrice(order.amountTotal, order.currency)}
                  </p>
                </div>
              </div>

              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span>
                    Status:{" "}
                    {order.provisional ? "bezahlt (wird verarbeitet)" : order.status}
                  </span>
                  <span>Zahlung: {order.paymentStatus}</span>
                </div>
                {order.provisional && (
                  <p className="mt-2 text-xs text-amber-800">
                    Wir synchronisieren deine Bestellung gerade mit dem Shop.
                    Die Bestellnummer wird gleich vergeben.
                  </p>
                )}
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <h2 className="text-xs font-semibold tracking-widest text-black/60 mb-2">
                    Versandadresse
                  </h2>
                  <div className="text-sm text-stone-700">
                    {order.shippingName && <div>{order.shippingName}</div>}
                    {order.shippingLine1 && <div>{order.shippingLine1}</div>}
                    {order.shippingLine2 && <div>{order.shippingLine2}</div>}
                    {(order.shippingPostalCode || order.shippingCity) && (
                      <div>
                        {order.shippingPostalCode ?? ""}{" "}
                        {order.shippingCity ?? ""}
                      </div>
                    )}
                    {order.shippingCountry && (
                      <div>{order.shippingCountry}</div>
                    )}
                  </div>
                </div>
                <div>
                  <h2 className="text-xs font-semibold tracking-widest text-black/60 mb-2">
                    Kontakt
                  </h2>
                  <div className="text-sm text-stone-700">
                    {order.customerEmail ?? "-"}
                  </div>
                </div>
              </div>

              <div>
                <h2 className="text-xs font-semibold tracking-widest text-black/60 mb-2">
                  Artikel
                </h2>
                <ul className="space-y-2 text-sm">
                  {order.items.map((item) => (
                    <li
                      key={item.id}
                      className="flex flex-col gap-3 rounded-lg border border-black/10 bg-white/80 px-3 py-2 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex items-center gap-3">
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt={item.name}
                            className="h-12 w-12 rounded-lg border border-black/10 bg-white object-cover"
                            loading="lazy"
                            decoding="async"
                            width={48}
                            height={48}
                          />
                        ) : (
                          <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-black/10 bg-stone-100 text-xs font-semibold text-stone-500">
                            --
                          </div>
                        )}
                        <div>
                          <div className="font-semibold">
                            {formatItemName(item)}
                          </div>
                          {item.options && item.options.length > 0 && (
                            <div className="text-xs text-stone-500">
                              {formatOptions(item.options)}
                            </div>
                          )}
                          <div className="text-xs text-stone-500">
                            Menge: {item.quantity}
                          </div>
                        </div>
                      </div>
                      <div className="text-left text-sm font-semibold sm:text-right">
                        {formatPrice(item.totalAmount, item.currency)}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                <div className="flex items-center justify-between">
                  <span>Zwischensumme</span>
                  <span>
                    {formatPrice(order.amountSubtotal, order.currency)}
                  </span>
                </div>
                {order.amountDiscount > 0 && (
                  <div className="mt-1 flex items-center justify-between">
                    <span>
                      Rabatt
                      {order.discountCode ? ` (${order.discountCode})` : ""}
                    </span>
                    <span>
                      -{formatPrice(order.amountDiscount, order.currency)}
                    </span>
                  </div>
                )}
                <div className="mt-1 flex items-center justify-between">
                  <span>Versand</span>
                  <span>
                    {formatPrice(order.amountShipping, order.currency)}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <span>Steuern</span>
                  <span>{formatPrice(order.amountTax, order.currency)}</span>
                </div>
                <div className="mt-2 flex items-center justify-between text-base font-semibold">
                  <span>Gesamt</span>
                  <span>{formatPrice(order.amountTotal, order.currency)}</span>
                </div>
              </div>

              {!order.provisional && (
                <div className="flex flex-wrap gap-3">
                  <a
                    href={`/api/orders/${order.id}/receipt`}
                    className="inline-flex items-center justify-center rounded-lg border border-black/10 bg-white px-4 py-2 text-xs font-semibold text-stone-700 hover:border-black/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                  >
                    Beleg herunterladen
                  </a>
                  <a
                    href={`/api/orders/${order.id}/invoice`}
                    className="inline-flex items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-800 hover:border-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                  >
                    Rechnung herunterladen
                  </a>
                </div>
              )}
            </div>
          ) : null}

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/account"
              className="inline-flex items-center justify-center rounded-lg border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-stone-700 hover:border-black/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
            >
              Zur Bestellübersicht
            </Link>
            <Link
              href="/products"
              className="inline-flex items-center justify-center rounded-lg bg-[#2f3e36] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
            >
              Weiter einkaufen
            </Link>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
