"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import { TrashIcon, TruckIcon } from "@heroicons/react/24/outline";
import { Pixelify_Sans } from "next/font/google";
import { useCart } from "@/components/CartProvider";
import {
  FREE_SHIPPING_THRESHOLD_EUR,
  MIN_ORDER_TOTAL_EUR,
} from "@/lib/checkoutPolicy";
import {
  getShippingAmount,
  SHIPPING_BASE,
  SHIPPING_COUNTRY_LABELS,
  type ShippingCountry,
} from "@/lib/shippingPolicy";
import PageLayout from "@/components/PageLayout";
import LoadingSpinner from "@/components/LoadingSpinner";
import PaymentMethodLogos from "@/components/PaymentMethodLogos";
import RecentlyViewedStrip from "@/components/RecentlyViewedStrip";
import CheckoutAuthModal from "@/components/CheckoutAuthModal";
import { trackAnalyticsEvent } from "@/lib/analytics";

const pixelNavFont = Pixelify_Sans({
  weight: "400",
  subsets: ["latin"],
});

function formatPrice(amount: string | number, currencyCode: string) {
  const value = Number(amount);
  if (!Number.isFinite(value)) return "";
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: 2,
  }).format(value);
}

const toCartItems = (cart: NonNullable<ReturnType<typeof useCart>["cart"]>) =>
  cart.lines.map((line) => ({
    item_id: line.merchandise.id,
    item_name: line.merchandise.product.title,
    item_variant: line.merchandise.title,
    item_brand: line.merchandise.product.manufacturer ?? undefined,
    item_category: line.merchandise.product.categories?.[0]?.name,
    price: Number(line.merchandise.price.amount),
    quantity: line.quantity,
  }));

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

const formatCartOptions = (options?: Array<{ name: string; value: string }>) => {
  if (!options?.length) return "";
  return options
    .map((opt) => `${opt.name}: ${opt.value}`)
    .filter(Boolean)
    .join(" · ");
};

export default function CartPage() {
  const { cart, loading, updateLine, removeLines, error, refresh } = useCart();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status } = useSession();
  const isAuthenticated = status === "authenticated";
  const [country, setCountry] = useState<ShippingCountry>("DE");
  const [countryTouched, setCountryTouched] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [discountCode, setDiscountCode] = useState("");
  const [orderConfirmStatus, setOrderConfirmStatus] = useState<
    "idle" | "loading" | "ok" | "error"
  >("idle");
  const [checkoutStatus, setCheckoutStatus] = useState<
    "idle" | "loading" | "error"
  >("idle");
  const [checkoutError, setCheckoutError] = useState("");
  const viewCartTrackedRef = useRef<string | null>(null);
  const shippingTrackedRef = useRef<string | null>(null);

  const [showAuthModal, setShowAuthModal] = useState(false);
  const canCheckout = checkoutStatus !== "loading";

  const proceedToCheckout = async () => {
    if (!cart || cart.lines.length === 0) return;
    trackAnalyticsEvent("begin_checkout", {
      currency: cart.cost.subtotalAmount.currencyCode,
      value: Number(cart.cost.subtotalAmount.amount),
      items: toCartItems(cart),
    });
    setCheckoutStatus("loading");
    setCheckoutError("");
    try {
      const normalizedDiscountCode = discountCode.trim();
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          country,
          discountCode: normalizedDiscountCode || undefined,
        }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setCheckoutStatus("error");
        setCheckoutError(data.error ?? "Checkout fehlgeschlagen.");
        return;
      }
      trackAnalyticsEvent("add_payment_info", {
        currency: cart.cost.subtotalAmount.currencyCode,
        value: Number(cart.cost.subtotalAmount.amount),
        payment_type: "stripe_checkout",
        items: toCartItems(cart),
      });
      window.location.assign(data.url);
    } catch {
      setCheckoutStatus("error");
      setCheckoutError("Checkout fehlgeschlagen.");
    }
  };

  const startCheckout = async () => {
    if (!cart || cart.lines.length === 0) return;
    if (status === "loading") return;
    const subtotalValue = Number(cart.cost.subtotalAmount.amount);
    if (Number.isFinite(subtotalValue) && subtotalValue < MIN_ORDER_TOTAL_EUR) {
      setCheckoutStatus("error");
      setCheckoutError(
        `Mindestbestellwert ${MIN_ORDER_TOTAL_EUR.toFixed(2)} EUR.`,
      );
      return;
    }
    if (status === "unauthenticated") {
      setShowAuthModal(true);
      return;
    }
    await proceedToCheckout();
  };

  useEffect(() => {
    if (!cart || loading || cart.lines.length === 0) return;
    if (viewCartTrackedRef.current === cart.id) return;
    viewCartTrackedRef.current = cart.id;
    trackAnalyticsEvent("view_cart", {
      currency: cart.cost.subtotalAmount.currencyCode,
      value: Number(cart.cost.subtotalAmount.amount),
      items: toCartItems(cart),
    });
  }, [cart, loading]);

  useEffect(() => {
    if (!cart) return;
    const key = country;
    if (shippingTrackedRef.current === key) return;
    shippingTrackedRef.current = key;
    trackAnalyticsEvent("add_shipping_info", {
      currency: cart.cost.subtotalAmount.currencyCode,
      value: Number(cart.cost.subtotalAmount.amount),
      shipping_tier: country,
      items: toCartItems(cart),
    });
  }, [cart, country]);

  useEffect(() => {
    if (status !== "authenticated") return;
    if (loading) return;
    if (!cart || cart.lines.length === 0) return;
    if (checkoutStatus !== "idle") return;
    if (searchParams.get("startCheckout") !== "1") return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete("startCheckout");
    router.replace(params.toString() ? `/cart?${params.toString()}` : "/cart");
    void proceedToCheckout();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart, checkoutStatus, loading, router, searchParams, status]);

  useEffect(() => {
    if (status !== "authenticated") return;
    if (profileLoaded) return;
    let cancelled = false;

    const loadProfile = async () => {
      try {
        const res = await fetch("/api/account/profile", { method: "GET" });
        if (!res.ok) return;
        const data = (await res.json()) as {
          user?: { country?: string | null };
        };
        if (cancelled) return;
        const normalizedCountry = normalizeCountryInput(data.user?.country);
        if (!countryTouched && normalizedCountry) {
          setCountry(normalizedCountry);
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
  }, [countryTouched, profileLoaded, status]);

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
        router.replace(
          params.toString() ? `/cart?${params.toString()}` : "/cart",
        );
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
      <PageLayout commerce>
        <div className="mx-auto max-w-4xl px-6 py-10 text-black/80">
          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <div>{error}</div>
            </div>
          )}
          <h1 className="text-2xl font-semibold mb-2">
            Dein Warenkorb ist leer
          </h1>
          <p className="text-stone-600 mb-6">
            Füge Produkte hinzu und komm hierher zur Übersicht.
          </p>
          <Link
            href="/products"
            className="text-green-700 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          >
            Zu den Produkten
          </Link>
        </div>
      </PageLayout>
    );
  }

  const subtotal = Number(cart.cost.subtotalAmount.amount);
  const currencyCode = cart.cost.subtotalAmount.currencyCode;
  const itemCount =
    cart.totalQuantity ??
    cart.lines.reduce((sum, line) => sum + line.quantity, 0);
  const freeShippingActive = subtotal >= FREE_SHIPPING_THRESHOLD_EUR;
  const shippingEstimate = freeShippingActive ? 0 : getShippingAmount(country);
  const totalEstimate = subtotal + shippingEstimate;
  const meetsMinOrder = subtotal >= MIN_ORDER_TOTAL_EUR;
  const checkoutBlocked = !meetsMinOrder;
  const cartProductHandles = Array.from(
    new Set(
      cart.lines
        .map((line) => line.merchandise.product.handle)
        .filter((handle): handle is string => Boolean(handle)),
    ),
  );


  return (
    <PageLayout commerce>
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <div>{error}</div>
          </div>
        )}
        <div className="mb-5 flex items-center justify-between sm:mb-8">
          <h1 className="text-2xl font-semibold text-black/80 sm:text-3xl">
            Warenkorb
          </h1>
          <span className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-semibold text-stone-700 shadow-sm sm:px-3.5 sm:py-1.5 sm:text-sm">
            {cart.lines.length} Artikel
          </span>
        </div>

        {/* Free shipping progress bar */}
        <div className={`mb-5 rounded-2xl px-4 py-3.5 sm:mb-6 ${freeShippingActive ? "border border-emerald-200 bg-emerald-50" : "border border-stone-200 bg-white shadow-sm"}`}>
          <div className={`flex items-center gap-2 text-xs font-semibold sm:text-sm ${freeShippingActive ? "text-emerald-700" : "text-stone-700"}`}>
            <TruckIcon className="h-4 w-4 shrink-0" />
            {freeShippingActive
              ? "Kostenloser Versand aktiv!"
              : `Noch ${formatPrice(FREE_SHIPPING_THRESHOLD_EUR - subtotal, currencyCode)} bis zur versandkostenfreien Lieferung`}
          </div>
          <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-stone-200">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${Math.min(100, Math.round((subtotal / FREE_SHIPPING_THRESHOLD_EUR) * 100))}%` }}
            />
          </div>
        </div>

        <div className="grid gap-4 text-black/80 sm:gap-6">
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
                className="flex cursor-pointer flex-col gap-4 rounded-[32px] border border-[#2f3e36]/70 bg-white p-4 shadow-[0_12px_30px_rgba(15,23,42,0.08)] transition hover:border-[#2f3e36] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
              >
                <div className="flex items-center gap-4">
                  {line.merchandise.image?.url ? (
                    <Image
                      src={line.merchandise.image.url}
                      alt={
                        line.merchandise.image.altText ??
                        line.merchandise.product.title
                      }
                      className="h-20 w-20 rounded-3xl object-cover ring-1 ring-black/5"
                      width={80}
                      height={80}
                      sizes="80px"
                    />
                  ) : (
                    <div className="h-20 w-20 rounded-3xl bg-stone-100 ring-1 ring-black/5" />
                  )}
                  <div className="min-w-0 flex-1">
                    {line.merchandise.product.manufacturer && (
                      <p className="text-xs uppercase tracking-wide text-[#2f3e36]">
                        {line.merchandise.product.manufacturer}
                      </p>
                    )}
                    <p className="text-base font-semibold text-emerald-950">
                      {line.merchandise.product.title}
                    </p>
                    {line.merchandise.options &&
                      line.merchandise.options.length > 0 && (
                        <p className="mt-1 text-xs text-stone-500">
                          {formatCartOptions(line.merchandise.options)}
                        </p>
                      )}
                    {line.merchandise.shortDescription && (
                      <p className="mt-1 hidden text-sm text-stone-500 lg:block">
                        {line.merchandise.shortDescription}
                      </p>
                    )}
                  </div>
                </div>

                <div className="h-[1.5px] w-full bg-[#2f3e36]/70" />

                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
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
                        className="add-to-cart-sweep h-11 w-11 rounded-2xl border border-[#2f3e36]/60 bg-[#5f7066] text-sm font-semibold text-white shadow-sm hover:bg-[#4b5e54] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                      >
                        -
                      </button>
                      <span className="min-w-7 text-center text-sm font-semibold text-[#2f3e36]">
                        {line.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          updateLine(line.id, line.quantity + 1);
                        }}
                        className="add-to-cart-sweep h-11 w-11 rounded-2xl border border-[#2f3e36]/60 bg-[#5f7066] text-sm font-semibold text-white shadow-sm hover:bg-[#4b5e54] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                      >
                        +
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        removeLines([line.id]);
                      }}
                      className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-red-200 bg-red-50 text-red-600 shadow-sm hover:border-red-300 hover:bg-red-100 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                      aria-label="Entfernen"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="pl-1 text-left">
                    <p className="text-xs uppercase tracking-wide text-[#2f3e36]">
                      Preis
                    </p>
                    <p className="text-base font-semibold text-emerald-950">
                      {formatPrice(
                        line.merchandise.price.amount,
                        line.merchandise.price.currencyCode,
                      )}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <RecentlyViewedStrip
          title="Zuletzt angesehen"
          excludeHandles={cartProductHandles}
          className="mt-8"
        />

        <div className="my-8 h-px w-full bg-black/10" />

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_1.2fr]">
          <div className="order-2 rounded-2xl border-2 border-black/10 bg-white p-6 shadow-[0_12px_30px_rgba(15,23,42,0.08)] lg:order-1">
            <p className="text-xs font-semibold tracking-widest text-black/60">
              Versandkosten
            </p>
              <p className="mt-2 text-sm text-stone-600">
              Die Versandkosten richten sich nach dem Zielland und stimmen mit
              den Angaben auf unserer Versandseite überein.
            </p>
            <div className="mt-4">
              <label className="block text-xs font-semibold text-stone-600">
                Zielland
              </label>
              <select
                value={country}
                onChange={(event) => {
                  setCountryTouched(true);
                  setCountry(event.target.value as ShippingCountry);
                }}
                className="mt-2 w-full rounded-md border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-black/30 focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
              >
                <option value="DE">Deutschland</option>
                <option value="AT">Österreich</option>
                <option value="CH">Schweiz</option>
                <option value="EU">EU (sonstige)</option>
                <option value="UK">Vereinigtes Königreich</option>
                <option value="US">USA</option>
                <option value="OTHER">Andere</option>
              </select>
              <p className="mt-2 text-xs text-stone-500">
                Ausgewählt: {SHIPPING_COUNTRY_LABELS[country]}
              </p>
            </div>
          </div>

          <div className="order-1 rounded-2xl border-2 border-black/10 bg-white p-6 shadow-[0_12px_30px_rgba(15,23,42,0.08)] lg:order-2">
            <div className="space-y-4 text-right">
              <div>
                <p
                  className={`${pixelNavFont.className} text-[14px] uppercase tracking-[0.08em] text-[#2f3e36]/70`}
                >
                  Zwischensumme
                </p>
                  <p className="text-xl font-semibold text-[#2f3e36]">
                    {formatPrice(subtotal, currencyCode)}
                  </p>
                  {!meetsMinOrder && (
                    <p className="mt-1 text-xs font-semibold text-red-600">
                      Mindestbestellwert {formatPrice(MIN_ORDER_TOTAL_EUR, currencyCode)}.
                    </p>
                  )}
              </div>
              <div>
                <p
                  className={`${pixelNavFont.className} text-[14px] uppercase tracking-[0.08em] text-[#2f3e36]/70`}
                >
                  Versand (Schätzung)
                </p>
                <p className="text-base font-semibold text-[#2f3e36]">
                  {freeShippingActive
                    ? formatPrice(0, currencyCode)
                    : formatPrice(shippingEstimate, currencyCode)}
                </p>
                {freeShippingActive ? (
                  <p className="mt-1 text-xs font-semibold text-emerald-700">
                    Kostenloser Versand aktiv
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-stone-500">
                    Ab {formatPrice(FREE_SHIPPING_THRESHOLD_EUR, currencyCode)} versandkostenfrei
                    {" "}(noch {formatPrice(FREE_SHIPPING_THRESHOLD_EUR - subtotal, currencyCode)})
                  </p>
                )}
              </div>
              <div>
                <p
                  className={`${pixelNavFont.className} text-[14px] uppercase tracking-[0.08em] text-[#2f3e36]/70`}
                >
                  Gesamt (Schätzung)
                </p>
                <p className="text-2xl font-semibold text-[#2f3e36]">
                  {formatPrice(totalEstimate, currencyCode)}
                </p>
              </div>
              <p className="text-xs text-[#2f3e36]/60">
                Die endgültigen Versandkosten werden vor dem Kaufabschluss im
                Stripe-Checkout angezeigt.
              </p>
              <div className="text-left">
                <label className="block text-xs font-semibold text-stone-600">
                  Rabattcode
                </label>
                <input
                  type="text"
                  value={discountCode}
                  onChange={(event) => setDiscountCode(event.target.value)}
                  placeholder="Code eingeben"
                  className="mt-2 w-full rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30 focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                />
              </div>
              {checkoutError && (
                <p className="text-xs font-semibold text-red-600">
                  {checkoutError}
                </p>
              )}
              {checkoutBlocked && (
                <p className="text-xs font-semibold text-red-600">
                  Mindestbestellwert{" "}
                  {formatPrice(MIN_ORDER_TOTAL_EUR, currencyCode)}.
                </p>
              )}
              <button
                type="button"
                onClick={startCheckout}
                disabled={!canCheckout || checkoutBlocked}
                className="inline-flex w-full items-center justify-center rounded-lg bg-gradient-to-r from-[#14532d] via-[#2f3e36] to-[#0f766e] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-900/15 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-emerald-900/25 disabled:cursor-not-allowed disabled:from-stone-300 disabled:via-stone-200 disabled:to-stone-200 disabled:text-stone-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
              >
                {checkoutStatus === "loading"
                  ? "Weiterleitung..."
                  : "Zur Kasse"}
              </button>
              <PaymentMethodLogos
                className="justify-center gap-[2px] sm:gap-2"
                pillClassName="h-7 px-2 border-black/10 bg-white sm:h-8 sm:px-3"
                logoClassName="h-4 sm:h-5"
              />
            </div>
          </div>
        </div>
      </div>

      <CheckoutAuthModal
        open={showAuthModal}
        returnTo="/cart?startCheckout=1"
        onClose={() => setShowAuthModal(false)}
        onContinueAsGuest={() => {
          setShowAuthModal(false);
          return proceedToCheckout();
        }}
      />
    </PageLayout>
  );
}
