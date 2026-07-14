"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import {
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
import CartCrossSells from "@/components/CartCrossSells";
import CheckoutAuthModal from "@/components/CheckoutAuthModal";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { formatRedeemRateLabel } from "@/lib/loyalty";
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

type DiscountPreview = {
  valid: boolean;
  code: string;
  discountCents: number;
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  message: string;
};

export default function CartPageClient() {
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
  const [discountPreview, setDiscountPreview] = useState<DiscountPreview | null>(
    null,
  );
  const [discountStatus, setDiscountStatus] = useState<
    "idle" | "loading" | "valid" | "error"
  >("idle");
  const [discountMessage, setDiscountMessage] = useState("");
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
  const activeDiscountCode =
    discountPreview?.valid && appliedDiscountCode ? appliedDiscountCode : "";
  const cartDiscountContext = cart
    ? cart.lines
        .map(
          (line) =>
            `${line.id}:${line.quantity}:${line.merchandise.price.amount}`,
        )
        .sort()
        .join("|")
    : "";

  const clearDiscountPreview = (message = "") => {
    setAppliedDiscountCode("");
    setDiscountPreview(null);
    setDiscountStatus(message ? "error" : "idle");
    setDiscountMessage(message);
  };

  const applyDiscountCode = async () => {
    if (!normalizedDiscountCode) {
      clearDiscountPreview("");
      return;
    }
    setDiscountStatus("loading");
    setDiscountMessage("");
    setCheckoutError("");

    try {
      const response = await fetch("/api/checkout/discount-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          country,
          discountCode: normalizedDiscountCode,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as Partial<
        DiscountPreview
      > & {
        error?: string;
      };
      if (!response.ok || !data.valid || !data.code) {
        clearDiscountPreview(
          data.message ??
            data.error ??
            "Rabattcode konnte nicht angewendet werden.",
        );
        return;
      }

      const preview: DiscountPreview = {
        valid: true,
        code: data.code,
        discountCents: Math.max(0, Math.floor(Number(data.discountCents ?? 0))),
        subtotalCents: Math.max(0, Math.floor(Number(data.subtotalCents ?? 0))),
        shippingCents: Math.max(0, Math.floor(Number(data.shippingCents ?? 0))),
        totalCents: Math.max(0, Math.floor(Number(data.totalCents ?? 0))),
        message: data.message ?? "Rabattcode wurde geprüft und angewendet.",
      };
      setDiscountCode(preview.code);
      setAppliedDiscountCode(preview.code);
      setDiscountPreview(preview);
      setDiscountStatus("valid");
      setDiscountMessage(preview.message);
      setUseLoyaltyPoints(false);
    } catch {
      clearDiscountPreview("Rabattcode konnte gerade nicht geprüft werden.");
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
    if (!appliedDiscountCode) return;
    clearDiscountPreview(
      "Warenkorb oder Lieferland geändert. Bitte Rabattcode erneut prüfen.",
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartDiscountContext, country]);

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
        <div className="gv-glass flex items-center gap-3 rounded-[24px] px-5 py-4 text-[color:var(--gv-text-muted)]">
          <LoadingSpinner
            size="md"
            className="border-[color:var(--gv-border)] border-t-[color:var(--gv-lime)]"
          />
          <span>Warenkorb wird geladen...</span>
        </div>
      </div>
    );
  }

  if (!cart || cart.lines.length === 0) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-10 text-[color:var(--gv-text)]">
        {error && (
          <div className="mb-4 rounded-[20px] border border-[color:var(--gv-error)]/30 bg-[color:var(--gv-error)]/10 px-4 py-3 text-sm text-[color:var(--gv-error)]">
            <div>{error}</div>
          </div>
        )}
        <EmptyState
          eyebrow="Smokeify"
          title="Noch nichts im Setup."
          description="Starte mit einem kuratierten Setup oder entdecke passende Produkte für Zelt, Licht, Luft und Bewässerung."
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
    activeDiscountCode && !useLoyaltyPoints && discountPreview?.valid
      ? discountPreview.discountCents / 100
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
    <div className="mx-auto max-w-5xl px-3 py-6 sm:px-6 sm:py-10">
      {error && (
        <div className="mb-6 rounded-[20px] border border-[color:var(--gv-error)]/30 bg-[color:var(--gv-error)]/10 px-4 py-3 text-sm text-[color:var(--gv-error)]">
          <div>{error}</div>
        </div>
      )}

      <div className="mb-5 flex items-center justify-between sm:mb-8">
        <div>
          <p className="font-[family:var(--font-jetbrains-mono)] text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--gv-lime)]">
            Kasse
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="font-[family:var(--font-syne)] text-3xl font-bold tracking-[-0.05em] text-[color:var(--gv-text)] sm:text-4xl">
              Warenkorb
            </h1>
            {cart.lines.length >= 3 ? (
              <span className="inline-flex items-center gap-2 rounded-full border border-[color:var(--gv-lime)]/25 bg-[color:var(--gv-lime)]/10 px-3 py-1 text-xs font-semibold text-[color:var(--gv-lime)]">
                <span
                  aria-hidden="true"
                  className="h-2.5 w-2.5 rotate-[-20deg] rounded-[999px_999px_999px_0] bg-[color:var(--gv-lime)]"
                />
                Setup wächst.
              </span>
            ) : null}
          </div>
          {cartMilestoneCopy ? (
            <p className="mt-2 text-sm text-[color:var(--gv-text-muted)]">
              {cartMilestoneCopy}
            </p>
          ) : null}
        </div>
        <span className="rounded-full border border-[color:var(--gv-border)] bg-[color:var(--gv-surface)] px-3 py-1 text-xs font-semibold text-[color:var(--gv-text)] shadow-[var(--gv-shadow)] sm:px-3.5 sm:py-1.5 sm:text-sm">
          {cart.lines.length} Artikel
        </span>
      </div>

      <div
        className={`mb-5 rounded-[28px] px-3 py-4 shadow-[var(--gv-shadow)] sm:mb-6 sm:px-4 ${
          freeShippingActive
            ? "border border-[color:var(--gv-success)]/30 bg-[color:var(--gv-success)]/10"
            : "border border-[color:var(--gv-border)] bg-[color:var(--gv-dark)]"
        }`}
      >
        <div
          className={`flex items-center gap-2 text-xs font-semibold sm:text-sm ${
            freeShippingActive
              ? "text-[color:var(--gv-success)]"
              : "text-[color:var(--gv-text)]"
          }`}
        >
          <TruckIcon className="h-4 w-4 shrink-0" />
          {shippingProgress.reached
            ? getFreeShippingActiveMessage("de")
            : `Noch ${formatPrice(shippingProgress.remaining, currencyCode)} bis kostenloser Versand.`}
        </div>
        <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-[color:var(--gv-border)]">
          <div
            className="h-full rounded-full bg-[color:var(--gv-lime)] transition-all duration-500"
            style={{ width: `${shippingProgress.progress}%` }}
          />
        </div>
      </div>

      <div className="grid gap-4 text-[color:var(--gv-text)] sm:gap-6">
        {cart.lines.map((line) => {
          const productUrl = `/products/${line.merchandise.product.handle}`;
          const isRemovingLine = pendingRemovalLineIds.includes(line.id);
          return (
            <article
              key={line.id}
              aria-busy={isRemovingLine}
              className={`group relative grid grid-cols-[76px_minmax(0,1fr)] gap-3 overflow-hidden rounded-[22px] border border-emerald-950/10 bg-white p-3 shadow-[0_12px_32px_rgba(28,66,44,0.07)] transition sm:grid-cols-[88px_minmax(0,1fr)_auto_auto] sm:items-center sm:gap-4 sm:p-4 ${
                isRemovingLine
                  ? "pointer-events-none opacity-65"
                  : "hover:-translate-y-0.5 hover:border-emerald-800/20 hover:shadow-[0_18px_40px_rgba(28,66,44,0.11)]"
              }`}
            >
              <span
                aria-hidden="true"
                className="absolute inset-y-3 left-0 w-1 rounded-r-full bg-[linear-gradient(180deg,#91d4a8,#1f5f3f)]"
              />
              <Link
                href={productUrl}
                className="relative block h-[76px] w-[76px] overflow-hidden rounded-[17px] bg-[#f1f6f2] ring-1 ring-emerald-950/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 sm:h-[88px] sm:w-[88px]"
                aria-label={line.merchandise.product.title}
              >
                {line.merchandise.image?.url ? (
                  <Image
                    src={line.merchandise.image.url}
                    alt={
                      line.merchandise.image.altText ??
                      line.merchandise.product.title
                    }
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                    width={88}
                    height={88}
                    sizes="(max-width: 639px) 76px, 88px"
                  />
                ) : (
                  <span className="grid h-full place-items-center text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-800/55">
                    SMK
                  </span>
                )}
              </Link>

              <Link
                href={productUrl}
                className="min-w-0 self-start rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 sm:self-center"
              >
                {line.merchandise.product.manufacturer && (
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-700">
                    {line.merchandise.product.manufacturer}
                  </p>
                )}
                <h2 className="mt-0.5 line-clamp-2 text-sm font-bold leading-5 text-[color:var(--gv-text)] transition group-hover:text-emerald-800 sm:text-base">
                  {line.merchandise.product.title}
                </h2>
                {line.merchandise.options &&
                  line.merchandise.options.length > 0 && (
                    <p className="mt-1 line-clamp-1 text-xs text-[color:var(--gv-text-muted)]">
                      {formatCartOptions(line.merchandise.options)}
                    </p>
                  )}
                {line.merchandise.shortDescription && (
                  <p className="mt-1 hidden line-clamp-1 text-xs text-[color:var(--gv-text-muted)] xl:block">
                    {line.merchandise.shortDescription}
                  </p>
                )}
              </Link>

              <div className="col-span-2 flex items-center justify-between border-t border-emerald-950/8 pt-3 sm:col-span-1 sm:border-0 sm:pt-0">
                <div className="flex items-center rounded-full bg-emerald-50 p-1 ring-1 ring-emerald-900/10">
                  <button
                    type="button"
                    aria-label="Menge verringern"
                    disabled={isRemovingLine}
                    onClick={() => {
                      if (line.quantity <= 1) {
                        void handleRemoveLine(line.id);
                      } else {
                        void updateLine(line.id, line.quantity - 1);
                      }
                    }}
                    className="grid h-9 w-9 place-items-center rounded-full bg-white text-base font-bold text-emerald-900 shadow-sm hover:bg-emerald-700 hover:text-white disabled:cursor-wait disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
                  >
                    -
                  </button>
                  <span
                    data-testid="cart-line-quantity"
                    className="min-w-8 text-center text-sm font-bold text-emerald-950"
                  >
                    {line.quantity}
                  </span>
                  <button
                    type="button"
                    aria-label="Menge erhöhen"
                    disabled={isRemovingLine}
                    onClick={() => {
                      void updateLine(line.id, line.quantity + 1);
                    }}
                    className="grid h-9 w-9 place-items-center rounded-full bg-white text-base font-bold text-emerald-900 shadow-sm hover:bg-emerald-700 hover:text-white disabled:cursor-wait disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
                  >
                    +
                  </button>
                </div>
                <button
                  type="button"
                  disabled={isRemovingLine}
                  onClick={() => {
                    void handleRemoveLine(line.id);
                  }}
                  className="ml-3 inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full px-2 text-xs font-semibold text-[color:var(--gv-text-muted)] hover:bg-red-50 hover:text-[color:var(--gv-error)] disabled:cursor-wait disabled:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--gv-error)]/40 sm:hidden"
                  aria-label={isRemovingLine ? "Wird entfernt" : "Entfernen"}
                >
                  {isRemovingLine ? (
                    <LoadingSpinner
                      size="sm"
                      className="border-[color:var(--gv-error)]/25 border-t-[color:var(--gv-error)]"
                    />
                  ) : (
                    <>
                      <TrashIcon className="h-4 w-4" />
                      <span>Entfernen</span>
                    </>
                  )}
                </button>
              </div>

              <div className="col-span-2 flex items-center justify-between sm:col-span-1 sm:flex-col sm:items-end sm:gap-2">
                <p
                  data-testid="cart-line-price"
                  className="text-lg font-bold tracking-[-0.03em] text-[color:var(--gv-text)]"
                >
                  {formatPrice(
                    line.merchandise.price.amount,
                    line.merchandise.price.currencyCode,
                  )}
                </p>
                <button
                  type="button"
                  disabled={isRemovingLine}
                  onClick={() => void handleRemoveLine(line.id)}
                  className="hidden min-h-9 items-center gap-1.5 rounded-full px-2 text-xs font-semibold text-[color:var(--gv-text-muted)] hover:bg-red-50 hover:text-[color:var(--gv-error)] disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--gv-error)]/40 sm:inline-flex"
                  aria-label={isRemovingLine ? "Wird entfernt" : "Entfernen"}
                >
                  {isRemovingLine ? (
                    <LoadingSpinner
                      size="sm"
                      className="border-[color:var(--gv-error)]/25 border-t-[color:var(--gv-error)]"
                    />
                  ) : (
                    <TrashIcon className="h-3.5 w-3.5" />
                  )}
                  <span>{isRemovingLine ? "Wird entfernt" : "Entfernen"}</span>
                </button>
              </div>
            </article>
          );
        })}
      </div>

      <CartCrossSells handles={cartProductHandles} />

      <RecentlyViewedStrip
        title="Zuletzt angesehen"
        excludeHandles={cartProductHandles}
        className="mt-8"
      />

      <div className="my-5 h-px w-full bg-[color:var(--gv-border)] sm:my-8" />

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_1.2fr]">
        <div className="order-2 rounded-[28px] border border-[color:var(--gv-border)] bg-[color:var(--gv-dark)] p-4 shadow-[var(--gv-shadow)] sm:p-6 lg:order-1">
          <p className="text-xs font-semibold tracking-[0.22em] text-[color:var(--gv-lime)]">
            Versandkosten
          </p>
          <p className="mt-2 text-sm text-[color:var(--gv-text-muted)]">
            {CART_SHIPPING_EXPLANATION}
          </p>
          <div className="mt-4">
            <label className="block text-xs font-semibold text-[color:var(--gv-text-muted)]">
              Zielland
            </label>
            <select
              value={country}
              onChange={(event) => {
                setCountryTouched(true);
                setCountry(event.target.value as ShippingCountry);
              }}
              className="gv-input mt-2 w-full rounded-[18px] px-3 py-2 text-sm outline-none focus:border-[color:var(--gv-lime)]/60 focus:ring-2 focus:ring-[color:var(--gv-lime)]/15"
            >
              <option value="DE">Deutschland</option>
              <option value="AT">Österreich</option>
              <option value="CH">Schweiz</option>
              <option value="EU">EU (sonstige)</option>
              <option value="UK">Vereinigtes Königreich</option>
              <option value="US">USA</option>
              <option value="OTHER">Andere</option>
            </select>
            <p className="mt-2 text-xs text-[color:var(--gv-text-muted)]">
              Ausgewählt: {SHIPPING_COUNTRY_LABELS[country]}
            </p>
            <div className="mt-4 rounded-[20px] border border-[color:var(--gv-lime)]/18 bg-[color:var(--gv-lime)]/10 px-3 py-3">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-semibold text-[color:var(--gv-text)]">
                  Versand für {SHIPPING_COUNTRY_LABELS[country]}
                </span>
                <span className="font-[family:var(--font-jetbrains-mono)] font-semibold text-[color:var(--gv-lime)]">
                  {freeShippingActive
                    ? formatPrice(0, currencyCode)
                    : formatPrice(shippingEstimate, currencyCode)}
                </span>
              </div>
              <p className="mt-1 text-xs leading-5 text-[color:var(--gv-text-muted)]">
                Der Betrag bleibt vor der Zahlung sichtbar. Du kannst ohne Konto
                fortfahren.
              </p>
            </div>
          </div>
        </div>

        <div className="order-1 rounded-[28px] border border-[color:var(--gv-border)] bg-[linear-gradient(135deg,var(--gv-lime-glow),transparent_42%),var(--gv-dark)] p-4 shadow-[var(--gv-shadow-lg)] sm:p-6 lg:order-2">
          <div className="space-y-4 text-left sm:text-right">
            <div>
              <p className="font-[family:var(--font-jetbrains-mono)] text-[14px] uppercase tracking-[0.08em] text-[color:var(--gv-text-muted)]">
                Zwischensumme
              </p>
              <p className="text-xl font-semibold text-[color:var(--gv-text)]">
                {formatPrice(subtotal, currencyCode)}
              </p>
              {!meetsMinOrder && (
                <p className="mt-1 text-xs font-semibold text-[color:var(--gv-error)]">
                  Mindestbestellwert{" "}
                  {formatPrice(MIN_ORDER_TOTAL_EUR, currencyCode)}.
                </p>
              )}
            </div>
            <div>
              <p className="font-[family:var(--font-jetbrains-mono)] text-[14px] uppercase tracking-[0.08em] text-[color:var(--gv-text-muted)]">
                Versand
              </p>
              <p className="text-base font-semibold text-[color:var(--gv-text)]">
                {freeShippingActive
                  ? formatPrice(0, currencyCode)
                  : formatPrice(shippingEstimate, currencyCode)}
              </p>
              {freeShippingActive ? (
                <p className="mt-1 text-xs font-semibold text-[color:var(--gv-success)]">
                  {getFreeShippingActiveMessage("de")}
                </p>
              ) : (
                <p className="mt-1 text-xs text-[color:var(--gv-text-muted)]">
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
              <p className="font-[family:var(--font-jetbrains-mono)] text-[14px] uppercase tracking-[0.08em] text-[color:var(--gv-text-muted)]">
                Gesamt vor Checkout
              </p>
              <p
                data-testid="cart-summary-total"
                className="text-2xl font-semibold text-[color:var(--gv-lime)]"
              >
                {formatPrice(totalAfterDiscounts, currencyCode)}
              </p>
            </div>
            <p className="text-xs text-[color:var(--gv-text-muted)]">
              {CART_CHECKOUT_EXPLANATION}
            </p>
            <div className="text-left">
              <label className="block text-xs font-semibold text-[color:var(--gv-text-muted)]">
                Rabattcode
              </label>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  type="text"
                  value={discountCode}
                  disabled={discountStatus === "loading"}
                  onChange={(event) => {
                    if (useLoyaltyPoints) {
                      setUseLoyaltyPoints(false);
                    }
                    clearDiscountPreview("");
                    setDiscountCode(event.target.value);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void applyDiscountCode();
                    }
                  }}
                  placeholder="Code eingeben"
                  className="gv-input h-[3.25rem] min-h-[3.25rem] min-w-0 flex-1 appearance-none rounded-[20px] px-4 text-base [line-height:1.1] outline-none focus:border-[color:var(--gv-lime)]/60 focus:ring-2 focus:ring-[color:var(--gv-lime)]/15 sm:h-10 sm:min-h-10 sm:rounded-[18px] sm:px-3 sm:text-sm"
                />
                <button
                  type="button"
                  onClick={() => void applyDiscountCode()}
                  disabled={!normalizedDiscountCode || discountStatus === "loading"}
                  className="inline-flex w-full shrink-0 items-center justify-center rounded-full bg-[color:var(--gv-lime)] px-6 py-3 text-sm font-semibold text-white shadow-[var(--gv-shadow)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--gv-shadow-lg)] disabled:cursor-not-allowed disabled:bg-[color:var(--gv-muted)] disabled:text-[color:var(--gv-text-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--gv-lime)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--gv-forest)] sm:h-10 sm:w-auto sm:px-4 sm:py-0 sm:text-sm sm:shadow-none"
                >
                  {discountStatus === "loading" ? "Prüfen…" : "Anwenden"}
                </button>
              </div>
              <div className="mt-2 flex items-center gap-2" aria-live="polite">
                {discountStatus === "valid" && appliedDiscountCode ? (
                  <span className="text-xs font-semibold text-[color:var(--gv-success)]">
                    Code geprüft: {appliedDiscountCode}
                  </span>
                ) : discountMessage ? (
                  <span className="text-xs font-semibold text-[color:var(--gv-error)]">
                    {discountMessage}
                  </span>
                ) : (
                  <span className="text-xs text-[color:var(--gv-text-muted)]">
                    Rabatt wird erst nach Serverprüfung angezeigt.
                  </span>
                )}
              </div>
            </div>
            {isAuthenticated && loyaltyPointsBalance > 0 && (
              <label className="flex items-start gap-3 rounded-[20px] border border-[color:var(--gv-success)]/30 bg-[color:var(--gv-success)]/10 px-3 py-3 text-left text-sm text-[color:var(--gv-text)]">
                <input
                  type="checkbox"
                  checked={useLoyaltyPoints}
                  onChange={(event) => {
                    if (
                      event.target.checked &&
                      (discountCode.trim() || appliedDiscountCode)
                    ) {
                      setDiscountCode("");
                      clearDiscountPreview("");
                    }
                    setUseLoyaltyPoints(event.target.checked);
                  }}
                  className="mt-0.5 h-4 w-4 rounded border-[color:var(--gv-success)]/40 bg-[color:var(--gv-dark)] text-[color:var(--gv-lime)] focus:ring-[color:var(--gv-lime)]"
                />
                <span>
                  <span className="block font-semibold">
                    {redeemablePoints} {loyaltyProgramLabel} einlösen
                  </span>
                  <span className="block text-xs text-[color:var(--gv-text-muted)]">
                    {loyaltyProgramLabel} funktionieren wie Shop-Guthaben.{" "}
                    {redeemablePoints} Punkte entsprechen aktuell{" "}
                    {formatPrice(loyaltyDiscount, currencyCode)} Rabatt.{" "}
                    {formatRedeemRateLabel()}.
                  </span>
                </span>
              </label>
            )}
            {checkoutError && (
              <p className="text-xs font-semibold text-[color:var(--gv-error)]">
                {checkoutError}
              </p>
            )}
            {checkoutBlocked && (
              <p className="text-xs font-semibold text-[color:var(--gv-error)]">
                Mindestbestellwert{" "}
                {formatPrice(MIN_ORDER_TOTAL_EUR, currencyCode)}.
              </p>
            )}
            {appliedDiscountAmount > 0 && (
              <div className="flex items-center justify-between text-sm font-semibold text-[color:var(--gv-error)]">
                <span>Rabattcode</span>
                <span>-{formatPrice(appliedDiscountAmount, currencyCode)}</span>
              </div>
            )}
            {useLoyaltyPoints && loyaltyDiscount > 0 && (
              <div className="flex items-center justify-between text-sm text-[color:var(--gv-success)]">
                <span>{loyaltyProgramLabel}</span>
                <span>-{formatPrice(loyaltyDiscount, currencyCode)}</span>
              </div>
            )}
            {!isAuthenticated ? (
              <p className="text-xs leading-5 text-[color:var(--gv-text-muted)]">
                Gast-Checkout startet direkt. Ein Konto kannst du später für
                Bestellverlauf, Punkte und schnellere Reorders nutzen.
              </p>
            ) : null}
            <button
              type="button"
              onClick={startCheckout}
              disabled={!canCheckout || checkoutBlocked}
              className="inline-flex w-full items-center justify-center rounded-full bg-[color:var(--gv-lime)] px-6 py-3 text-sm font-semibold text-white shadow-[var(--gv-shadow)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--gv-shadow-lg)] disabled:cursor-not-allowed disabled:bg-[color:var(--gv-muted)] disabled:text-[color:var(--gv-text-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--gv-lime)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--gv-forest)]"
            >
              {checkoutStatus === "loading"
                ? "Weiterleitung..."
                : "Zur Kasse"}
            </button>
            <PaymentMethodLogos
              className="justify-center gap-[2px] sm:gap-2"
              pillClassName="h-7 border-[color:var(--gv-border)] bg-[color:var(--gv-dark)] px-2 sm:h-8 sm:px-3"
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
