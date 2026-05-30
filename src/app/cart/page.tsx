"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import {
  CheckCircleIcon,
  LockClosedIcon,
  SparklesIcon,
  TrashIcon,
  TruckIcon,
} from "@heroicons/react/24/outline";
import { useCart } from "@/components/CartProvider";
import EmptyState from "@/components/common/EmptyState";
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
import LoadingSpinner from "@/components/LoadingSpinner";
import PaymentMethodLogos from "@/components/PaymentMethodLogos";
import RecentlyViewedStrip from "@/components/RecentlyViewedStrip";
import CheckoutAuthModal from "@/components/CheckoutAuthModal";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { formatRedeemRateLabel } from "@/lib/loyalty";
import { NEWSLETTER_OFFER_DISCOUNT_CENTS } from "@/lib/newsletterOffer";
import { buildCheckoutStartUrl } from "@/lib/checkoutStart";
import { SITE_NAME } from "@/lib/siteConfig";
import {
  CART_CHECKOUT_EXPLANATION,
  CART_SHIPPING_EXPLANATION,
  getFreeShippingActiveMessage,
} from "@/lib/storefrontTrust";
import {
  getCartMilestoneCopy,
  getFreeShippingProgress,
} from "@/lib/shipping";

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

const formatCartOptions = (
  options?: Array<{ name: string; value: string }>,
) => {
  if (!options?.length) return "";
  return options
    .map((opt) => `${opt.name}: ${opt.value}`)
    .filter(Boolean)
    .join(" · ");
};

export default function CartPage() {
  const { cart, loading, updateLine, removeLines, error } = useCart();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status } = useSession();
  const isAuthenticated = status === "authenticated";
  const [country, setCountry] = useState<ShippingCountry>("DE");
  const [countryTouched, setCountryTouched] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [discountCode, setDiscountCode] = useState("");
  const [appliedDiscountCode, setAppliedDiscountCode] = useState("");
  const [loyaltyPointsBalance, setLoyaltyPointsBalance] = useState(0);
  const [useLoyaltyPoints, setUseLoyaltyPoints] = useState(false);
  const [orderConfirmStatus, setOrderConfirmStatus] = useState<
    "idle" | "loading" | "ok" | "error"
  >("idle");
  const [checkoutStatus, setCheckoutStatus] = useState<
    "idle" | "loading" | "error"
  >("idle");
  const [checkoutError, setCheckoutError] = useState("");
  const [pendingRemovalLineIds, setPendingRemovalLineIds] = useState<string[]>(
    [],
  );
  const viewCartTrackedRef = useRef<string | null>(null);
  const shippingTrackedRef = useRef<string | null>(null);

  const [showAuthModal, setShowAuthModal] = useState(false);
  const canCheckout = checkoutStatus !== "loading";
  const normalizedDiscountCode = discountCode.trim();
  const activeDiscountCode = appliedDiscountCode || normalizedDiscountCode;

  const applyDiscountCode = () => {
    setAppliedDiscountCode(normalizedDiscountCode);
    setCheckoutError("");
    if (normalizedDiscountCode) {
      setUseLoyaltyPoints(false);
    }
  };

  const handleRemoveLine = async (lineId: string) => {
    setPendingRemovalLineIds((current) =>
      current.includes(lineId) ? current : [...current, lineId],
    );
    try {
      await removeLines([lineId]);
    } finally {
      setPendingRemovalLineIds((current) =>
        current.filter((pendingId) => pendingId !== lineId),
      );
    }
  };

  const proceedToCheckout = async () => {
    if (!cart || cart.lines.length === 0) return;
    trackAnalyticsEvent("begin_checkout", {
      currency: cart.cost.subtotalAmount.currencyCode,
      value: Number(cart.cost.subtotalAmount.amount),
      items: toCartItems(cart),
    });
    setCheckoutStatus("loading");
    setCheckoutError("");
    router.push(
      buildCheckoutStartUrl({
        country,
        discountCode: activeDiscountCode || undefined,
        useLoyaltyPoints,
      }),
    );
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
    trackAnalyticsEvent("begin_checkout", {
      currency: cart.cost.subtotalAmount.currencyCode,
      value: Number(cart.cost.subtotalAmount.amount),
      items: toCartItems(cart),
    });
    router.push(
      buildCheckoutStartUrl({
        country,
        discountCode: activeDiscountCode || undefined,
        useLoyaltyPoints,
      }),
    );
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
          user?: {
            country?: string | null;
            loyaltyPointsBalance?: number | null;
          };
        };
        if (cancelled) return;
        const normalizedCountry = normalizeCountryInput(data.user?.country);
        if (!countryTouched && normalizedCountry) {
          setCountry(normalizedCountry);
        }
        setLoyaltyPointsBalance(
          Math.max(0, Math.floor(Number(data.user?.loyaltyPointsBalance ?? 0))),
        );
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
    const checkout = searchParams.get("checkout");
    const sessionId = searchParams.get("session_id");
    if (checkout !== "success" || !sessionId) return;

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
        <div className="smk-surface flex items-center gap-3 rounded-[24px] px-5 py-4 text-[var(--smk-text-muted)]">
          <LoadingSpinner size="md" />
          <span>Warenkorb wird geladen...</span>
        </div>
      </div>
    );
  }

  if (!cart || cart.lines.length === 0) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-10 text-[var(--smk-text)]">
        {error && (
          <div className="mb-4 rounded-[24px] border border-[var(--smk-error)]/30 bg-[rgba(120,30,30,0.18)] px-4 py-3 text-sm text-[var(--smk-error)]">
            <div>{error}</div>
          </div>
        )}
        <EmptyState
          eyebrow="Smokeify"
          title="Noch nichts im Setup."
          description="Starte mit einem kuratierten Setup oder entdecke passende Produkte für Zelt, Licht, Luft und Bewässerung."
          icon={<SparklesIcon className="h-6 w-6" />}
          actions={[
            {
              label: "Setup konfigurieren",
              href: "/customizer",
              tone: "primary",
            },
            {
              label: "Produkte entdecken",
              href: "/products",
            },
          ]}
        />
      </div>
    );
  }

  const subtotal = Number(cart.cost.subtotalAmount.amount);
  const currencyCode = cart.cost.subtotalAmount.currencyCode;
  const shippingProgress = getFreeShippingProgress(subtotal);
  const cartMilestoneCopy = getCartMilestoneCopy(cart.lines.length);
  const freeShippingActive = subtotal >= FREE_SHIPPING_THRESHOLD_EUR;
  const shippingEstimate = freeShippingActive ? 0 : getShippingAmount(country);
  const appliedDiscountAmount =
    activeDiscountCode && !useLoyaltyPoints
      ? Math.min(
          subtotal + shippingEstimate,
          NEWSLETTER_OFFER_DISCOUNT_CENTS / 100,
        )
      : 0;
  const redeemablePoints = Math.min(
    loyaltyPointsBalance,
    Math.max(0, Math.floor(subtotal * 100)),
  );
  const loyaltyDiscount = useLoyaltyPoints ? redeemablePoints / 100 : 0;
  const totalEstimate = subtotal + shippingEstimate;
  const totalAfterDiscounts = Math.max(
    0,
    totalEstimate - appliedDiscountAmount - loyaltyDiscount,
  );
  const meetsMinOrder = subtotal >= MIN_ORDER_TOTAL_EUR;
  const checkoutBlocked = !meetsMinOrder;
  const loyaltyProgramLabel = `${SITE_NAME} Punkte`;
  const cartProductHandles = Array.from(
    new Set(
      cart.lines
        .map((line) => line.merchandise.product.handle)
        .filter((handle): handle is string => Boolean(handle)),
    ),
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      {error && (
        <div className="mb-6 rounded-[24px] border border-[var(--smk-error)]/30 bg-[rgba(120,30,30,0.18)] px-4 py-3 text-sm text-[var(--smk-error)]">
          <div>{error}</div>
        </div>
      )}

      <div className="mb-5 flex items-center justify-between sm:mb-8">
        <div>
          <p className="font-[family:var(--font-manrope)] text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--smk-accent-2)]">
            Kasse
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="smk-heading text-3xl text-[var(--smk-text)] sm:text-4xl">
              Warenkorb
            </h1>
            {cart.lines.length >= 3 ? (
              <span className="inline-flex items-center gap-2 rounded-full border border-[var(--smk-accent)]/20 bg-[var(--smk-accent)]/10 px-3 py-1 text-xs font-semibold text-[var(--smk-accent)]">
                <span className="h-2 w-2 rounded-full bg-[var(--smk-accent-2)]" />
                Setup wächst.
              </span>
            ) : null}
          </div>
          {cartMilestoneCopy ? (
            <p className="mt-2 text-sm text-[var(--smk-text-muted)]">
              {cartMilestoneCopy}
            </p>
          ) : null}
        </div>
        <span className="rounded-full border border-[var(--smk-border)] bg-[rgba(255,255,255,0.05)] px-3 py-1 text-xs font-semibold text-[var(--smk-text)] shadow-sm sm:px-3.5 sm:py-1.5 sm:text-sm">
          {cart.lines.length} Artikel
        </span>
      </div>

      <div
        className={`mb-5 rounded-[28px] px-4 py-4 shadow-[0_20px_60px_rgba(0,0,0,0.2)] sm:mb-6 ${
          freeShippingActive
            ? "border border-[var(--smk-success)]/25 bg-[rgba(61,133,89,0.14)]"
            : "border border-[var(--smk-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.03),transparent_22%),var(--smk-panel)]"
        }`}
      >
        <div
          className={`flex items-center gap-2 text-xs font-semibold sm:text-sm ${
            freeShippingActive
              ? "text-[var(--smk-success)]"
              : "text-[var(--smk-text)]"
          }`}
        >
          <TruckIcon className="h-4 w-4 shrink-0" />
          {shippingProgress.reached
            ? getFreeShippingActiveMessage("de")
            : `Noch ${formatPrice(shippingProgress.remaining, currencyCode)} bis kostenloser Versand.`}
        </div>
        <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-[rgba(255,255,255,0.1)]">
          <div
            className="h-full rounded-full bg-[linear-gradient(90deg,var(--smk-accent),var(--smk-accent-2))] transition-all duration-500"
            style={{ width: `${shippingProgress.progress}%` }}
          />
        </div>
      </div>

      <div className="grid gap-4 text-[var(--smk-text)] sm:gap-6">
        {cart.lines.map((line) => {
          const productUrl = `/products/${line.merchandise.product.handle}`;
          const isRemovingLine = pendingRemovalLineIds.includes(line.id);
          return (
            <div
              key={line.id}
              role="link"
              tabIndex={0}
              aria-busy={isRemovingLine}
              onClick={() => router.push(productUrl)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  router.push(productUrl);
                }
              }}
              className={`flex cursor-pointer flex-col gap-4 rounded-[32px] border border-[var(--smk-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.03),transparent_24%),var(--smk-panel)] p-4 shadow-[0_20px_60px_rgba(0,0,0,0.22)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--smk-accent)]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-black ${
                isRemovingLine
                  ? "pointer-events-none opacity-65"
                  : "hover:border-[var(--smk-border-strong)] hover:bg-[linear-gradient(180deg,rgba(233,188,116,0.05),transparent_24%),var(--smk-panel)]"
              }`}
            >
              <div className="flex items-center gap-4">
                {line.merchandise.image?.url ? (
                  <div className="smk-white-well flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-3xl">
                    <Image
                      src={line.merchandise.image.url}
                      alt={
                        line.merchandise.image.altText ??
                        line.merchandise.product.title
                      }
                      className="h-full w-full object-contain p-2"
                      width={80}
                      height={80}
                      sizes="80px"
                    />
                  </div>
                ) : (
                  <div className="smk-white-well h-20 w-20 rounded-3xl" />
                )}
                <div className="min-w-0 flex-1">
                  {line.merchandise.product.manufacturer && (
                    <p className="text-xs uppercase tracking-[0.18em] text-[var(--smk-text-dim)]">
                      {line.merchandise.product.manufacturer}
                    </p>
                  )}
                  <p className="text-base font-semibold text-[var(--smk-text)]">
                    {line.merchandise.product.title}
                  </p>
                  {line.merchandise.options &&
                    line.merchandise.options.length > 0 && (
                      <p className="mt-1 text-xs text-[var(--smk-text-muted)]">
                        {formatCartOptions(line.merchandise.options)}
                      </p>
                    )}
                  {line.merchandise.shortDescription && (
                    <p className="mt-1 hidden text-sm text-[var(--smk-text-muted)] lg:block">
                      {line.merchandise.shortDescription}
                    </p>
                  )}
                </div>
              </div>

              <div className="h-px w-full bg-[var(--smk-border)]" />

              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      aria-label="Menge verringern"
                      disabled={isRemovingLine}
                      onClick={(event) => {
                        event.stopPropagation();
                        if (line.quantity <= 1) {
                          void handleRemoveLine(line.id);
                        } else {
                          void updateLine(line.id, line.quantity - 1);
                        }
                      }}
                      className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--smk-border)] bg-[rgba(255,255,255,0.05)] text-sm font-semibold text-[var(--smk-text)] shadow-sm transition hover:border-[var(--smk-border-strong)] hover:text-[var(--smk-accent)] disabled:cursor-wait disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--smk-accent)]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                    >
                      -
                    </button>
                    <span className="min-w-7 text-center text-sm font-semibold text-[var(--smk-text)]">
                      {line.quantity}
                    </span>
                    <button
                      type="button"
                      aria-label="Menge erhöhen"
                      disabled={isRemovingLine}
                      onClick={(event) => {
                        event.stopPropagation();
                        void updateLine(line.id, line.quantity + 1);
                      }}
                      className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--smk-border)] bg-[rgba(255,255,255,0.05)] text-sm font-semibold text-[var(--smk-text)] shadow-sm transition hover:border-[var(--smk-border-strong)] hover:text-[var(--smk-accent)] disabled:cursor-wait disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--smk-accent)]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                    >
                      +
                    </button>
                  </div>
                  <button
                    type="button"
                    disabled={isRemovingLine}
                    onClick={(event) => {
                      event.stopPropagation();
                      void handleRemoveLine(line.id);
                    }}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--smk-error)]/30 bg-[var(--smk-error)]/10 text-[var(--smk-error)] shadow-sm transition hover:border-[var(--smk-error)]/45 hover:bg-[var(--smk-error)]/15 disabled:cursor-wait disabled:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--smk-error)]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                    aria-label={isRemovingLine ? "Wird entfernt" : "Entfernen"}
                  >
                    {isRemovingLine ? (
                      <LoadingSpinner
                        size="sm"
                        className="border-[var(--smk-error)]/25 border-t-[var(--smk-error)]"
                      />
                    ) : (
                      <TrashIcon className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <div className="pl-1 text-left">
                  <p className="text-xs uppercase tracking-[0.18em] text-[var(--smk-text-dim)]">
                    Preis
                  </p>
                  <p className="text-base font-semibold text-[var(--smk-accent-2)]">
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

      <div className="my-8 h-px w-full bg-[var(--smk-border)]" />

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_1.2fr]">
        <div className="order-2 rounded-[30px] border border-[var(--smk-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.03),transparent_22%),var(--smk-panel)] p-6 shadow-[0_18px_40px_rgba(0,0,0,0.18)] lg:order-1">
          <p className="text-xs font-semibold tracking-[0.22em] text-[var(--smk-accent-2)]">
            Versandkosten
          </p>
          <p className="mt-2 text-sm text-[var(--smk-text-muted)]">
            {CART_SHIPPING_EXPLANATION}
          </p>
          <div className="mt-4">
            <label className="block text-xs font-semibold text-[var(--smk-text-dim)]">
              Zielland
            </label>
            <select
              value={country}
              onChange={(event) => {
                setCountryTouched(true);
                setCountry(event.target.value as ShippingCountry);
              }}
              className="smk-input mt-2 w-full rounded-2xl px-3 py-2 text-sm focus-visible:ring-offset-black"
            >
              <option value="DE">Deutschland</option>
              <option value="AT">Österreich</option>
              <option value="CH">Schweiz</option>
              <option value="EU">EU (sonstige)</option>
              <option value="UK">Vereinigtes Königreich</option>
              <option value="US">USA</option>
              <option value="OTHER">Andere</option>
            </select>
            <p className="mt-2 text-xs text-[var(--smk-text-muted)]">
              Ausgewählt: {SHIPPING_COUNTRY_LABELS[country]}
            </p>
          </div>
        </div>

        <div className="order-1 rounded-[30px] border border-[var(--smk-border)] bg-[linear-gradient(135deg,rgba(233,188,116,0.08),transparent_42%),var(--smk-panel)] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.26)] lg:order-2">
          <div className="space-y-4 text-left sm:text-right">
            <div>
              <p className="font-mono text-[14px] uppercase tracking-[0.08em] text-[var(--smk-text-dim)]">
                Zwischensumme
              </p>
              <p className="text-xl font-semibold text-[var(--smk-text)]">
                {formatPrice(subtotal, currencyCode)}
              </p>
              {!meetsMinOrder && (
                <p className="mt-1 text-xs font-semibold text-[var(--smk-error)]">
                  Mindestbestellwert{" "}
                  {formatPrice(MIN_ORDER_TOTAL_EUR, currencyCode)}.
                </p>
              )}
            </div>
            <div>
              <p className="font-mono text-[14px] uppercase tracking-[0.08em] text-[var(--smk-text-dim)]">
                Versand
              </p>
              <p className="text-base font-semibold text-[var(--smk-text)]">
                {freeShippingActive
                  ? formatPrice(0, currencyCode)
                  : formatPrice(shippingEstimate, currencyCode)}
              </p>
              {freeShippingActive ? (
                <p className="mt-1 text-xs font-semibold text-[var(--smk-success)]">
                  {getFreeShippingActiveMessage("de")}
                </p>
              ) : (
                <p className="mt-1 text-xs text-[var(--smk-text-muted)]">
                  Ab {formatPrice(FREE_SHIPPING_THRESHOLD_EUR, currencyCode)}{" "}
                  versandkostenfrei (noch{" "}
                  {formatPrice(
                    FREE_SHIPPING_THRESHOLD_EUR - subtotal,
                    currencyCode,
                  )}
                  )
                </p>
              )}
            </div>
            <div>
              <p className="font-mono text-[14px] uppercase tracking-[0.08em] text-[var(--smk-text-dim)]">
                Gesamt vor Checkout
              </p>
              <p className="text-2xl font-semibold text-[var(--smk-accent-2)]">
                {formatPrice(totalAfterDiscounts, currencyCode)}
              </p>
            </div>
            <p className="text-xs text-[var(--smk-text-muted)]">
              {CART_CHECKOUT_EXPLANATION}
            </p>
            <div className="text-left">
              <label className="block text-xs font-semibold text-[var(--smk-text-dim)]">
                Rabattcode
              </label>
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="text"
                  value={discountCode}
                  onChange={(event) => {
                    if (useLoyaltyPoints) {
                      setUseLoyaltyPoints(false);
                    }
                    setAppliedDiscountCode("");
                    setDiscountCode(event.target.value);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      applyDiscountCode();
                    }
                  }}
                  placeholder="Code eingeben"
                  className="smk-input h-10 min-w-0 flex-1 rounded-full px-3 text-sm focus-visible:ring-offset-black"
                />
                <button
                  type="button"
                  onClick={applyDiscountCode}
                  disabled={!normalizedDiscountCode}
                  className="smk-button-primary inline-flex h-10 shrink-0 items-center justify-center rounded-full px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-offset-black"
                >
                  Anwenden
                </button>
              </div>
              <div className="mt-2 flex items-center gap-2">
                {appliedDiscountCode && (
                  <span className="text-xs font-semibold text-[var(--smk-success)]">
                    Code angewendet: {appliedDiscountCode}
                  </span>
                )}
              </div>
            </div>
            {isAuthenticated && loyaltyPointsBalance > 0 && (
              <label className="flex items-start gap-3 rounded-[20px] border border-[var(--smk-accent)]/16 bg-[rgba(233,188,116,0.08)] px-3 py-3 text-left text-sm text-[var(--smk-text)]">
                <input
                  type="checkbox"
                  checked={useLoyaltyPoints}
                  onChange={(event) => {
                    if (event.target.checked && discountCode.trim()) {
                      setDiscountCode("");
                    }
                    setUseLoyaltyPoints(event.target.checked);
                  }}
                  className="mt-0.5 h-4 w-4 rounded border-[var(--smk-accent)]/30 bg-[var(--smk-panel)] text-[var(--smk-accent)] focus:ring-[var(--smk-accent)]"
                />
                <span>
                  <span className="block font-semibold">
                    {redeemablePoints} {loyaltyProgramLabel} einlösen
                  </span>
                  <span className="block text-xs text-[var(--smk-text-muted)]">
                    {loyaltyProgramLabel} funktionieren wie Shop-Guthaben.{" "}
                    {redeemablePoints} Punkte entsprechen aktuell{" "}
                    {formatPrice(loyaltyDiscount, currencyCode)} Rabatt.{" "}
                    {formatRedeemRateLabel()}.
                  </span>
                </span>
              </label>
            )}
            {checkoutError && (
              <p className="text-xs font-semibold text-[var(--smk-error)]">
                {checkoutError}
              </p>
            )}
            {checkoutBlocked && (
              <p className="text-xs font-semibold text-[var(--smk-error)]">
                Mindestbestellwert{" "}
                {formatPrice(MIN_ORDER_TOTAL_EUR, currencyCode)}.
              </p>
            )}
            {appliedDiscountAmount > 0 && (
              <div className="flex items-center justify-between text-sm font-semibold text-[var(--smk-error)]">
                <span>Rabattcode</span>
                <span>-{formatPrice(appliedDiscountAmount, currencyCode)}</span>
              </div>
            )}
            {useLoyaltyPoints && loyaltyDiscount > 0 && (
              <div className="flex items-center justify-between text-sm text-[var(--smk-success)]">
                <span>{loyaltyProgramLabel}</span>
                <span>-{formatPrice(loyaltyDiscount, currencyCode)}</span>
              </div>
            )}
            {!isAuthenticated ? (
              <p className="text-xs leading-5 text-[var(--smk-text-muted)]">
                Du kannst als Gast fortfahren. Anmelden lohnt sich für
                Bestellverlauf, Punkte und schnellere Reorders.
              </p>
            ) : null}
            <div className="smk-checkout-focus grid gap-2 rounded-[22px] border border-[rgba(233,188,116,0.16)] bg-[rgba(233,188,116,0.07)] px-3 py-3 text-xs text-[var(--smk-text-muted)]">
              <div className="flex items-center gap-2">
                <LockClosedIcon className="h-4 w-4 text-[var(--smk-accent-2)]" />
                <span>Checkout prüft Preis, Bestand und Rabatte serverseitig.</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircleIcon className="h-4 w-4 text-[var(--smk-success)]" />
                <span>Warenkorb wird beim Weitergehen erneut synchronisiert.</span>
              </div>
            </div>
            <button
              type="button"
              onClick={startCheckout}
              disabled={!canCheckout || checkoutBlocked}
              className="smk-button-primary inline-flex w-full items-center justify-center rounded-full px-6 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-offset-black"
            >
              {checkoutStatus === "loading"
                ? "Weiterleitung..."
                : "Zur Kasse"}
            </button>
            <PaymentMethodLogos
              className="justify-center gap-[2px] sm:gap-2"
              pillClassName="h-7 border-[var(--smk-border)] bg-[rgba(255,255,255,0.05)] px-2 sm:h-8 sm:px-3"
              logoClassName="h-4 sm:h-5"
            />
          </div>
        </div>
      </div>

      <CheckoutAuthModal
        open={showAuthModal}
        returnTo={buildCheckoutStartUrl({
          country,
          discountCode: activeDiscountCode || undefined,
          useLoyaltyPoints,
        })}
        onClose={() => setShowAuthModal(false)}
        onContinueAsGuest={() => {
          setShowAuthModal(false);
          return proceedToCheckout();
        }}
      />
    </div>
  );
}
