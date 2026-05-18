"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import LoadingSpinner from "@/components/LoadingSpinner";
import { useCart } from "@/components/CartProvider";
import { clearCheckoutPaymentState } from "@/app/checkout/shared/paymentState";
import { canUseAnalytics, trackFirstPartyAnalyticsEvent } from "@/lib/analytics";

type OrderItem = {
  id: string;
  name: string;
  quantity: number;
  unitAmount: number;
  totalAmount: number;
  currency: string;
  imageUrl?: string | null;
  manufacturer?: string | null;
  productId?: string | null;
  variantId?: string | null;
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
  invoiceUrl?: string | null;
  receiptUrl?: string | null;
  items: OrderItem[];
  provisional?: boolean;
};

const PURCHASE_TRACK_STORAGE_PREFIX = "smokeify_purchase_tracked:";

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

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(value));

const buildAnalyticsItems = (order: OrderSummary) =>
  order.items.map((item) => ({
    product_id: item.productId ?? undefined,
    item_id: item.variantId ?? item.id,
    item_name: formatItemName(item),
    item_brand: item.manufacturer ?? undefined,
    item_variant: item.options ? formatOptions(item.options) : undefined,
    price: item.unitAmount / 100,
    quantity: item.quantity,
  }));

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
      items: buildAnalyticsItems(order),
    },
  });
};

export default function OrderSuccessPage() {
  const searchParams = useSearchParams();
  const { status } = useSession();
  const { refresh } = useCart();
  const purchaseTracked = useRef(false);
  const sessionId = searchParams.get("session_id") || "";
  const guestToken = searchParams.get("guest_token") || "";
  const guestExpires = searchParams.get("guest_expires") || "";
  const [order, setOrder] = useState<OrderSummary | null>(null);
  const [loadStatus, setLoadStatus] = useState<
    "idle" | "loading" | "pending" | "ok" | "error"
  >("idle");
  const [cartCleared, setCartCleared] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 60;
  const retryDelayMs = 8000;

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
          body: JSON.stringify({
            sessionId,
            guestToken: guestToken || undefined,
            guestExpires: guestExpires || undefined,
          }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          order?: OrderSummary;
          pending?: boolean;
        };
        if (res.status === 202 || data.pending) {
          if (data.order) setOrder(data.order);
          setLoadStatus("pending");
          return;
        }
        if (!res.ok || !data.order) {
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
  }, [guestExpires, guestToken, loadStatus, sessionId, status]);

  useEffect(() => {
    if (loadStatus !== "pending") return;
    if (retryCount >= maxRetries) {
      const timer = setTimeout(() => setLoadStatus("error"), 0);
      return () => clearTimeout(timer);
    }
    const timer = setTimeout(() => {
      setLoadStatus("idle");
      setRetryCount((prev) => prev + 1);
    }, retryDelayMs);
    return () => clearTimeout(timer);
  }, [loadStatus, maxRetries, retryCount, retryDelayMs]);

  useEffect(() => {
    clearCheckoutPaymentState();
  }, []);

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
    if (loadStatus !== "ok" || order.provisional) return;
    if (!canUseAnalytics()) return;
    if (typeof window !== "undefined") {
      const storageKey = `${PURCHASE_TRACK_STORAGE_PREFIX}${order.id}`;
      if (window.localStorage.getItem(storageKey) === "1") {
        purchaseTracked.current = true;
        return;
      }
      window.localStorage.setItem(storageKey, "1");
    }
    purchaseTracked.current = true;
    pushDataLayerPurchase(order);
    trackFirstPartyAnalyticsEvent("purchase", {
      transaction_id: order.id,
      order_id: order.id,
      currency: order.currency,
      value: order.amountTotal / 100,
      tax: order.amountTax / 100,
      shipping: order.amountShipping / 100,
      discount: order.amountDiscount > 0 ? order.amountDiscount / 100 : undefined,
      items: buildAnalyticsItems(order),
    });
  }, [loadStatus, order]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <section className="relative overflow-hidden rounded-[34px] border border-[var(--smk-border)] bg-[linear-gradient(180deg,rgba(23,20,18,0.98),rgba(14,12,11,0.98))] p-5 shadow-[var(--smk-shadow)] sm:p-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(233,188,116,0.14),transparent_30%),radial-gradient(circle_at_85%_10%,rgba(217,119,69,0.14),transparent_22%),linear-gradient(180deg,rgba(255,255,255,0.025),transparent_32%)]" />
        <div className="relative">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <span className="inline-flex rounded-full border border-[var(--smk-border-strong)] bg-[rgba(233,188,116,0.08)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--smk-accent-2)]">
                Order Confirmed
              </span>
              <h1 className="smk-heading mt-5 text-4xl sm:text-5xl">
                Bestellung erfolgreich.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--smk-text-muted)] sm:text-base">
                Deine Bestellung ist eingegangen. Versand, Rechnung und
                Zahlungsbeleg stehen jetzt sauber an einer Stelle bereit.
              </p>
            </div>

            <div className="min-w-[240px] rounded-[26px] border border-[var(--smk-border-strong)] bg-[rgba(255,245,232,0.04)] px-5 py-5 shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--smk-text-dim)]">
                {order?.provisional ? "Sitzung" : "Bestellung"}
              </p>
              <p className="mt-2 text-2xl font-semibold text-[var(--smk-text)]">
                {order
                  ? order.provisional
                    ? order.id.slice(0, 12)
                    : order.id.slice(0, 8).toUpperCase()
                  : sessionId
                    ? sessionId.slice(0, 12)
                    : "Wird geladen"}
              </p>
              {order ? (
                <>
                  <p className="mt-3 text-sm text-[var(--smk-text-muted)]">
                    {formatDate(order.createdAt)}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-[var(--smk-accent-2)]">
                    Gesamt {formatPrice(order.amountTotal, order.currency)}
                  </p>
                </>
              ) : null}
            </div>
          </div>

          {!sessionId ? (
            <div className="mt-6 rounded-[24px] border border-[var(--smk-error)]/30 bg-[rgba(120,30,30,0.18)] px-5 py-4 text-sm text-[var(--smk-error)]">
              Keine Checkout-Session gefunden. Öffne die Bestellbestätigung erneut
              über den Checkout oder dein Kundenkonto.
            </div>
          ) : null}

          {(status === "loading" || loadStatus === "loading") && !order ? (
            <div className="mt-6 flex items-center justify-center gap-3 rounded-[24px] border border-[var(--smk-border)] bg-[rgba(255,255,255,0.04)] px-5 py-5 text-[var(--smk-text-muted)]">
              <LoadingSpinner size="sm" className="border-white/15 border-t-[var(--smk-accent)]" />
              <span>Bestellung wird geladen...</span>
            </div>
          ) : null}

          {loadStatus === "pending" && !order ? (
            <div className="mt-6 flex items-center justify-center gap-3 rounded-[24px] border border-[rgba(233,188,116,0.22)] bg-[rgba(233,188,116,0.08)] px-5 py-5 text-[var(--smk-text)]">
              <LoadingSpinner size="sm" className="border-white/15 border-t-[var(--smk-accent-2)]" />
              <span>Zahlung wird bestätigt. Bitte warten...</span>
            </div>
          ) : null}

          {loadStatus === "error" ? (
            <div className="mt-6 rounded-[24px] border border-[var(--smk-error)]/30 bg-[rgba(120,30,30,0.18)] px-5 py-4 text-sm text-[var(--smk-error)]">
              Bestellung konnte nicht geladen werden. Bitte versuche es erneut.
            </div>
          ) : null}

          {order && (loadStatus === "ok" || loadStatus === "pending") ? (
            <div className="mt-6 space-y-6">
              <div className="rounded-[24px] border border-[rgba(127,207,150,0.22)] bg-[rgba(30,54,40,0.72)] px-5 py-4 text-sm text-[var(--smk-text)]">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span>
                    Status: {order.provisional ? "bezahlt (wird verarbeitet)" : order.status}
                  </span>
                  <span>Zahlung: {order.paymentStatus}</span>
                </div>
                {order.provisional ? (
                  <p className="mt-2 text-sm text-[var(--smk-text-muted)]">
                    Wir synchronisieren die Bestellung gerade mit dem Shop. Die
                    finale Bestellnummer wird gleich vergeben.
                  </p>
                ) : null}
              </div>

              <div className="grid gap-6 lg:grid-cols-[minmax(0,1.02fr)_minmax(320px,0.98fr)]">
                <div className="space-y-6">
                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="rounded-[26px] border border-[var(--smk-border)] bg-[rgba(255,255,255,0.04)] px-5 py-5">
                      <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--smk-text-dim)]">
                        Versandadresse
                      </h2>
                      <div className="mt-4 space-y-1 text-sm leading-6 text-[var(--smk-text)]">
                        {order.shippingName && <div>{order.shippingName}</div>}
                        {order.shippingLine1 && <div>{order.shippingLine1}</div>}
                        {order.shippingLine2 && <div>{order.shippingLine2}</div>}
                        {(order.shippingPostalCode || order.shippingCity) && (
                          <div>
                            {order.shippingPostalCode ?? ""} {order.shippingCity ?? ""}
                          </div>
                        )}
                        {order.shippingCountry && <div>{order.shippingCountry}</div>}
                      </div>
                    </div>

                    <div className="rounded-[26px] border border-[var(--smk-border)] bg-[rgba(255,255,255,0.04)] px-5 py-5">
                      <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--smk-text-dim)]">
                        Kontakt
                      </h2>
                      <div className="mt-4 text-sm leading-6 text-[var(--smk-text)]">
                        {order.customerEmail ?? "-"}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[28px] border border-[var(--smk-border)] bg-[rgba(255,255,255,0.04)] px-5 py-5">
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--smk-text-dim)]">
                        Artikel
                      </h2>
                      <span className="text-xs text-[var(--smk-text-dim)]">
                        {order.items.length} Positionen
                      </span>
                    </div>
                    <ul className="mt-4 space-y-3">
                      {order.items.map((item) => (
                        <li
                          key={item.id}
                          className="flex flex-col gap-3 rounded-[22px] border border-[var(--smk-border)] bg-[rgba(12,10,9,0.42)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="flex items-center gap-3">
                            {item.imageUrl ? (
                              <Image
                                src={item.imageUrl}
                                alt={item.name}
                                className="h-14 w-14 rounded-[18px] border border-[var(--smk-border)] bg-[rgba(255,255,255,0.04)] object-cover"
                                width={56}
                                height={56}
                                sizes="56px"
                              />
                            ) : (
                              <div className="flex h-14 w-14 items-center justify-center rounded-[18px] border border-[var(--smk-border)] bg-[rgba(255,255,255,0.04)] text-xs font-semibold text-[var(--smk-text-dim)]">
                                --
                              </div>
                            )}
                            <div>
                              <div className="font-semibold text-[var(--smk-text)]">
                                {formatItemName(item)}
                              </div>
                              {item.options?.length ? (
                                <div className="text-xs text-[var(--smk-text-muted)]">
                                  {formatOptions(item.options)}
                                </div>
                              ) : null}
                              <div className="text-xs text-[var(--smk-text-dim)]">
                                Menge: {item.quantity}
                              </div>
                            </div>
                          </div>
                          <div className="text-left text-sm font-semibold text-[var(--smk-text)] sm:text-right">
                            {formatPrice(item.totalAmount, item.currency)}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="rounded-[28px] border border-[var(--smk-border)] bg-[rgba(255,255,255,0.04)] px-5 py-5">
                    <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--smk-text-dim)]">
                      Dokumente & Zahlung
                    </h2>
                    <div className="mt-4 space-y-3 text-sm text-[var(--smk-text)]">
                      <div className="flex items-center justify-between">
                        <span>Zwischensumme</span>
                        <span>{formatPrice(order.amountSubtotal, order.currency)}</span>
                      </div>
                      {order.amountDiscount > 0 ? (
                        <div className="flex items-center justify-between">
                          <span>
                            Rabatt{order.discountCode ? ` (${order.discountCode})` : ""}
                          </span>
                          <span>-{formatPrice(order.amountDiscount, order.currency)}</span>
                        </div>
                      ) : null}
                      <div className="flex items-center justify-between">
                        <span>Versand</span>
                        <span>{formatPrice(order.amountShipping, order.currency)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Steuern</span>
                        <span>{formatPrice(order.amountTax, order.currency)}</span>
                      </div>
                      <div className="flex items-center justify-between border-t border-[var(--smk-border)] pt-3 text-base font-semibold">
                        <span>Gesamt</span>
                        <span className="text-[var(--smk-accent-2)]">
                          {formatPrice(order.amountTotal, order.currency)}
                        </span>
                      </div>
                    </div>

                    {!order.provisional ? (
                      <div className="mt-5 flex flex-col gap-3">
                        <a
                          href={order.invoiceUrl || `/api/orders/${order.id}/invoice`}
                          className="smk-button-primary inline-flex h-12 items-center justify-center rounded-full px-6 text-sm font-semibold"
                        >
                          Rechnung herunterladen
                        </a>
                        <a
                          href={order.receiptUrl || `/api/orders/${order.id}/receipt`}
                          className="smk-button-secondary inline-flex h-12 items-center justify-center rounded-full px-6 text-sm font-semibold"
                        >
                          Beleg öffnen
                        </a>
                      </div>
                    ) : null}
                  </div>

                  <div className="rounded-[28px] border border-[var(--smk-border-strong)] bg-[rgba(233,188,116,0.08)] px-5 py-5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--smk-accent-2)]">
                      Nach dem Kauf
                    </p>
                    <p className="mt-3 text-sm leading-6 text-[var(--smk-text)]">
                      In deiner Bestellübersicht findest du Status, Dokumente und
                      später auch die Produktbewertungen für diese Bestellung.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/account"
              className="smk-button-secondary inline-flex h-12 items-center justify-center rounded-full px-6 text-sm font-semibold"
            >
              Zur Bestellübersicht
            </Link>
            <Link
              href="/products"
              className="smk-button-primary inline-flex h-12 items-center justify-center rounded-full px-6 text-sm font-semibold"
            >
              Weiter einkaufen
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
