"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import PageLayout from "@/components/PageLayout";
import LoadingSpinner from "@/components/LoadingSpinner";
import { useCart } from "@/components/CartProvider";

type OrderItem = {
  id: string;
  name: string;
  quantity: number;
  unitAmount: number;
  totalAmount: number;
  currency: string;
  imageUrl?: string | null;
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
};

const formatPrice = (amount: number, currency: string) =>
  new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount / 100);

export default function OrderSuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status } = useSession();
  const { refresh } = useCart();

  const sessionId = searchParams.get("session_id") || "";
  const returnTo = useMemo(() => {
    const base = "/order/success";
    return sessionId
      ? `${base}?session_id=${encodeURIComponent(sessionId)}`
      : base;
  }, [sessionId]);

  const [order, setOrder] = useState<OrderSummary | null>(null);
  const [loadStatus, setLoadStatus] = useState<
    "idle" | "loading" | "ok" | "error"
  >("idle");
  const [cartCleared, setCartCleared] = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    if (status === "loading") return;
    if (status !== "authenticated") {
      router.push(`/auth/checkout?returnTo=${encodeURIComponent(returnTo)}`);
      return;
    }
    if (loadStatus !== "idle") return;

    const loadOrder = async () => {
      setLoadStatus("loading");
      try {
        const res = await fetch("/api/orders/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });
        if (!res.ok) {
          setLoadStatus("error");
          return;
        }
        const data = (await res.json()) as { order?: OrderSummary };
        if (!data.order) {
          setLoadStatus("error");
          return;
        }
        setOrder(data.order);
        setLoadStatus("ok");
      } catch {
        setLoadStatus("error");
      }
    };

    void loadOrder();
  }, [loadStatus, returnTo, router, sessionId, status]);

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

  return (
    <PageLayout>
      <div className="mx-auto max-w-4xl px-6 py-10 text-stone-800">
        <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-[0_12px_30px_rgba(15,23,42,0.08)]">
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

          {loadStatus === "error" ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              Bestellung konnte nicht geladen werden. Bitte versuche es erneut.
            </div>
          ) : null}

          {order && loadStatus === "ok" ? (
            <div className="space-y-6">
              {order.items.some((item) => item.imageUrl) && (
                <div>
                  <h2 className="text-xs font-semibold tracking-widest text-black/60 mb-2">
                    Artikelbilder
                  </h2>
                  <div className="flex gap-3 overflow-x-auto pb-2">
                    {order.items
                      .filter((item) => item.imageUrl)
                      .map((item) => (
                        <img
                          key={item.id}
                          src={item.imageUrl as string}
                          alt={item.name}
                          className="h-20 w-20 flex-shrink-0 rounded-xl border border-black/10 bg-white object-cover"
                        />
                      ))}
                  </div>
                </div>
              )}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-stone-400">
                    Bestellnummer
                  </p>
                  <p className="text-sm font-semibold">
                    {order.id.slice(0, 8).toUpperCase()}
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

              <div className="rounded-lg border border-black/10 bg-stone-50 px-4 py-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span>Status: {order.status}</span>
                  <span>Zahlung: {order.paymentStatus}</span>
                </div>
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
                    {order.shippingCountry && <div>{order.shippingCountry}</div>}
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
                      className="flex items-center justify-between rounded-lg border border-black/10 bg-white px-3 py-2"
                    >
                      <div>
                        <div className="font-semibold">{item.name}</div>
                        <div className="text-xs text-stone-500">
                          Menge: {item.quantity}
                        </div>
                      </div>
                      <div className="text-right text-sm font-semibold">
                        {formatPrice(item.totalAmount, item.currency)}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-lg border border-black/10 bg-stone-50 px-4 py-3 text-sm">
                <div className="flex items-center justify-between">
                  <span>Zwischensumme</span>
                  <span>
                    {formatPrice(order.amountSubtotal, order.currency)}
                  </span>
                </div>
                {order.amountDiscount > 0 && (
                  <div className="mt-1 flex items-center justify-between">
                    <span>
                      Rabatt{order.discountCode ? ` (${order.discountCode})` : ""}
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

              <div className="flex flex-wrap gap-3">
                <a
                  href={`/api/orders/${order.id}/receipt`}
                  className="inline-flex items-center justify-center rounded-lg border border-black/10 bg-white px-4 py-2 text-xs font-semibold text-stone-700 hover:border-black/20"
                >
                  Beleg herunterladen
                </a>
                <a
                  href={`/api/orders/${order.id}/invoice`}
                  className="inline-flex items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-800 hover:border-emerald-300"
                >
                  Rechnung herunterladen
                </a>
              </div>
            </div>
          ) : null}

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/account"
              className="inline-flex items-center justify-center rounded-lg border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-stone-700 hover:border-black/20"
            >
              Zur Bestelluebersicht
            </Link>
            <Link
              href="/products"
              className="inline-flex items-center justify-center rounded-lg bg-[#2f3e36] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              Weiter einkaufen
            </Link>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
