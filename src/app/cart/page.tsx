"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useCart } from "@/components/CartProvider";
import PageLayout from "@/components/PageLayout";
import LoadingSpinner from "@/components/LoadingSpinner";

const SHIPPING_BASE = {
  DE: 4.9,
  AT: 7.9,
  CH: 9.9,
  EU: 8.9,
  UK: 9.9,
  US: 12.9,
  OTHER: 12.9,
} as const;

type ShippingCountry = keyof typeof SHIPPING_BASE;

function formatPrice(amount: string | number, currencyCode: string) {
  const value = Number(amount);
  if (!Number.isFinite(value)) return "";
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: 2,
  }).format(value);
}

function getShippingEstimate(country: ShippingCountry, itemCount: number) {
  const base = SHIPPING_BASE[country] ?? SHIPPING_BASE.OTHER;
  const perItem = 0.5;
  return base + Math.max(itemCount, 0) * perItem;
}

function normalizeCountryInput(value?: string | null): ShippingCountry | null {
  if (!value) return null;
  const raw = value.trim().toUpperCase();
  if (raw in SHIPPING_BASE) return raw as ShippingCountry;

  const aliases: Record<string, ShippingCountry> = {
    DE: "DE",
    DEU: "DE",
    GERMANY: "DE",
    DEUTSCHLAND: "DE",
    AT: "AT",
    AUT: "AT",
    AUSTRIA: "AT",
    OESTERREICH: "AT",
    CH: "CH",
    CHE: "CH",
    SWITZERLAND: "CH",
    SCHWEIZ: "CH",
    UK: "UK",
    GB: "UK",
    GBR: "UK",
    "UNITED KINGDOM": "UK",
    "GREAT BRITAIN": "UK",
    "VEREINIGTES KOENIGREICH": "UK",
    US: "US",
    USA: "US",
    "UNITED STATES": "US",
  };

  return aliases[raw] ?? null;
}

export default function CartPage() {
  const { cart, loading, updateLine, removeLines } = useCart();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status } = useSession();
  const isAuthenticated = status === "authenticated";
  const [country, setCountry] = useState<ShippingCountry>("DE");
  const [postalCode, setPostalCode] = useState("");
  const [countryTouched, setCountryTouched] = useState(false);
  const [postalTouched, setPostalTouched] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [orderConfirmStatus, setOrderConfirmStatus] = useState<
    "idle" | "loading" | "ok" | "error"
  >("idle");
  const [checkoutStatus, setCheckoutStatus] = useState<
    "idle" | "loading" | "error"
  >("idle");
  const [checkoutError, setCheckoutError] = useState("");

  const canCheckout = checkoutStatus !== "loading";

  const startCheckout = async () => {
    if (!cart || cart.lines.length === 0) return;
    if (status === "loading") return;
    if (!isAuthenticated) {
      router.push(
        `/auth/checkout?returnTo=${encodeURIComponent("/cart?startCheckout=1")}`
      );
      return;
    }
    setCheckoutStatus("loading");
    setCheckoutError("");
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ country, postalCode }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setCheckoutStatus("error");
        setCheckoutError(data.error ?? "Checkout fehlgeschlagen.");
        return;
      }
      window.location.assign(data.url);
    } catch {
      setCheckoutStatus("error");
      setCheckoutError("Checkout fehlgeschlagen.");
    }
  };

  useEffect(() => {
    if (status !== "authenticated") return;
    if (checkoutStatus !== "idle") return;
    if (searchParams.get("startCheckout") !== "1") return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete("startCheckout");
    router.replace(params.toString() ? `/cart?${params.toString()}` : "/cart");
    void startCheckout();
  }, [checkoutStatus, router, searchParams, startCheckout, status]);

  useEffect(() => {
    if (status !== "authenticated") return;
    if (profileLoaded) return;
    let cancelled = false;

    const loadProfile = async () => {
      try {
        const res = await fetch("/api/account/profile", { method: "GET" });
        if (!res.ok) return;
        const data = (await res.json()) as {
          user?: { postalCode?: string | null; country?: string | null };
        };
        if (cancelled) return;
        const normalizedCountry = normalizeCountryInput(data.user?.country);
        if (!countryTouched && normalizedCountry) {
          setCountry(normalizedCountry);
        }
        if (!postalTouched && data.user?.postalCode) {
          setPostalCode(data.user.postalCode);
        }
      } finally {
        if (!cancelled) {
          setProfileLoaded(true);
        }
      }
    };

    void loadProfile();
    return () => {
      cancelled = true;
    };
  }, [countryTouched, postalTouched, profileLoaded, status]);

  useEffect(() => {
    if (status !== "authenticated") return;
    if (orderConfirmStatus !== "idle") return;
    const checkoutStatus = searchParams.get("checkout");
    const sessionId = searchParams.get("session_id");
    if (checkoutStatus !== "success" || !sessionId) return;

    const confirmOrder = async () => {
      setOrderConfirmStatus("loading");
      try {
        const res = await fetch("/api/orders/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });
        if (!res.ok) {
          setOrderConfirmStatus("error");
          return;
        }
        setOrderConfirmStatus("ok");
        const params = new URLSearchParams(searchParams.toString());
        params.delete("checkout");
        params.delete("session_id");
        router.replace(params.toString() ? `/cart?${params.toString()}` : "/cart");
      } catch {
        setOrderConfirmStatus("error");
      }
    };

    void confirmOrder();
  }, [orderConfirmStatus, router, searchParams, status]);

  if (loading) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-4xl items-center justify-center px-6 py-10 text-center">
        <div className="flex items-center gap-3 text-stone-600">
          <LoadingSpinner size="md" />
          <span>Warenkorb wird geladen...</span>
        </div>
      </div>
    );
  }

  if (!cart || cart.lines.length === 0) {
    return (
      <PageLayout>
        <div className="mx-auto max-w-4xl px-6 py-10 text-black/80">
          <h1 className="text-2xl font-semibold mb-2">
            Dein Warenkorb ist leer
          </h1>
          <p className="text-stone-600 mb-6">
            Füge Produkte hinzu und komm hierher zur Übersicht.
          </p>
          <Link href="/products" className="text-green-700 font-semibold">
            Zu den Produkten
          </Link>
        </div>
      </PageLayout>
    );
  }

  const subtotal = Number(cart.cost.subtotalAmount.amount);
  const currencyCode = cart.cost.subtotalAmount.currencyCode;
  const hasLocation = postalCode.trim().length > 0;
  const itemCount =
    cart.totalQuantity ??
    cart.lines.reduce((sum, line) => sum + line.quantity, 0);
  const shippingEstimate = hasLocation
    ? getShippingEstimate(country, itemCount)
    : 0;
  const totalEstimate = subtotal + shippingEstimate;

  return (
    <PageLayout>
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-3xl font-semibold text-black/80">Warenkorb</h1>
          <span className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-semibold text-stone-600 shadow-sm">
            {cart.lines.length} Artikel
          </span>
        </div>

        <div className="grid gap-6 text-black/80">
          {cart.lines.map((line) => {
            const productUrl = `/products/${line.merchandise.product.handle}`;
            return (
              <div
                key={line.id}
                role="link"
                tabIndex={0}
                onClick={() => router.push(productUrl)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    router.push(productUrl);
                  }
                }}
                className="flex cursor-pointer gap-5 rounded-2xl border-2 border-black/10 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.08)] transition hover:border-black/20"
              >
                {line.merchandise.image?.url ? (
                  <img
                    src={line.merchandise.image.url}
                    alt={
                      line.merchandise.image.altText ??
                      line.merchandise.product.title
                    }
                    className="h-24 w-24 rounded-xl object-cover ring-1 ring-black/5"
                  />
                ) : (
                  <div className="h-24 w-24 rounded-xl bg-stone-100 ring-1 ring-black/5" />
                )}

                <div className="flex-1">
                  {line.merchandise.product.manufacturer && (
                    <p className="text-xs uppercase tracking-wide text-stone-400">
                      {line.merchandise.product.manufacturer}
                    </p>
                  )}
                  <p className="text-base font-semibold text-stone-900">
                    {line.merchandise.product.title}
                  </p>

                  <div className="mt-4 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        if (line.quantity <= 1) {
                          removeLines([line.id]);
                        } else {
                          updateLine(line.id, line.quantity - 1);
                        }
                      }}
                      className="h-10 w-10 rounded-lg border border-black/15 bg-white text-base font-semibold text-stone-700 shadow-sm hover:border-black/30"
                    >
                      -
                    </button>
                    <span className="min-w-8 text-center text-sm font-semibold text-stone-700">
                      {line.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        updateLine(line.id, line.quantity + 1);
                      }}
                      className="h-10 w-10 rounded-lg border border-black/15 bg-white text-base font-semibold text-stone-700 shadow-sm hover:border-black/30"
                    >
                      +
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        removeLines([line.id]);
                      }}
                      className="ml-2 text-sm font-semibold text-red-600 hover:text-red-700"
                    >
                      Entfernen
                    </button>
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-xs uppercase tracking-wide text-stone-400">
                    Preis
                  </p>
                  <p className="text-base font-semibold text-stone-900">
                    {formatPrice(
                      line.merchandise.price.amount,
                      line.merchandise.price.currencyCode
                    )}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="my-8 h-px w-full bg-black/10" />

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_1.2fr]">
          <div className="rounded-2xl border-2 border-black/10 bg-white p-6 shadow-[0_12px_30px_rgba(15,23,42,0.08)]">
            <p className="text-xs font-semibold tracking-widest text-black/60">
              Versandkostenkalkulator
            </p>
            <p className="mt-2 text-sm text-stone-600">
              Trage Land und Postleitzahl ein, um eine Schätzung zu erhalten.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-stone-600">
                  Land
                </label>
                <select
                  value={country}
                  onChange={(event) => {
                    setCountryTouched(true);
                    setCountry(event.target.value as ShippingCountry);
                  }}
                  className="w-full rounded-md border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-black/30"
                >
                  <option value="DE">Deutschland</option>
                  <option value="AT">Österreich</option>
                  <option value="CH">Schweiz</option>
                  <option value="EU">EU (sonstige)</option>
                  <option value="UK">Vereinigtes Königreich</option>
                  <option value="US">USA</option>
                  <option value="OTHER">Andere</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-600">
                  Postleitzahl
                </label>
                <input
                  type="text"
                  value={postalCode}
                  onChange={(event) => {
                    setPostalTouched(true);
                    setPostalCode(event.target.value);
                  }}
                  placeholder="z.B. 10115"
                  className="w-full rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30"
                />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border-2 border-black/10 bg-white p-6 shadow-[0_12px_30px_rgba(15,23,42,0.08)]">
            <div className="space-y-3 text-right">
              <div>
                <p className="text-xs uppercase tracking-wide text-stone-400">
                  Zwischensumme
                </p>
                <p className="text-lg font-semibold text-stone-900">
                  {formatPrice(subtotal, currencyCode)}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-stone-400">
                  Versand (Schätzung)
                </p>
                <p className="text-sm font-semibold text-stone-900">
                  {hasLocation ? formatPrice(shippingEstimate, currencyCode) : "--"}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-stone-400">
                  Gesamt (Schätzung)
                </p>
                <p className="text-xl font-semibold text-stone-900">
                  {hasLocation ? formatPrice(totalEstimate, currencyCode) : "--"}
                </p>
              </div>
              <p className="text-xs text-stone-500">
                Schätzungen können je nach Versanddienst abweichen.
              </p>
              {checkoutError && (
                <p className="text-xs font-semibold text-red-600">
                  {checkoutError}
                </p>
              )}
              <button
                type="button"
                onClick={startCheckout}
                disabled={!canCheckout}
                className="inline-flex w-full items-center justify-center rounded-lg border border-green-900 bg-green-800 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-green-900 disabled:cursor-not-allowed disabled:border-black/10 disabled:bg-stone-200 disabled:text-stone-500"
              >
                {checkoutStatus === "loading" ? "Weiterleitung..." : "Zur Kasse"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
