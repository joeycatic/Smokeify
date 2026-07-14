"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Home, Inbox } from "lucide-react";
import LoadingSpinner from "@/components/LoadingSpinner";
import PaymentMethodLogos from "@/components/PaymentMethodLogos";
import CheckoutProgress from "@/app/checkout/start/components/CheckoutProgress";
import OrderSummary from "@/app/checkout/start/components/OrderSummary";
import {
  buildCheckoutPaymentStateHash,
  clearCheckoutPaymentState,
  readCheckoutPaymentState,
  writeCheckoutPaymentState,
  type CheckoutSummaryItem,
  type CheckoutSummarySnapshot,
} from "@/app/checkout/shared/paymentState";
import {
  FREE_SHIPPING_THRESHOLD_EUR,
  MIN_ORDER_TOTAL_EUR,
} from "@/lib/checkoutPolicy";
import { trackAnalyticsEvent } from "@/lib/analytics";
import {
  getShippingAmount,
  SHIPPING_COUNTRY_LABELS,
  type ShippingCountry,
} from "@/lib/shippingPolicy";

type Props = {
  initialCountry: ShippingCountry;
  initialDiscountCode: string;
  initialRecoverySessionId: string;
  initialUseLoyaltyPoints: boolean;
};

type CheckoutResponse = {
  cart?: { currency: string; items: CheckoutSummaryItem[]; subtotalCents: number };
  user?: {
    email?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    street?: string | null;
    houseNumber?: string | null;
    postalCode?: string | null;
    city?: string | null;
    country?: string | null;
    shippingAddressType?: string | null;
    packstationNumber?: string | null;
    postNumber?: string | null;
    loyaltyPointsBalance?: number | null;
  } | null;
};

type CheckoutSessionResponse = {
  checkoutUrl?: string | null;
  discountCode?: string | null;
  editToken?: string | null;
  error?: string;
  failureUrl?: string | null;
  orderCode?: string | null;
  sessionId?: string;
  successUrl?: string;
  summary?: CheckoutSummarySnapshot | null;
};

const formatMoney = (cents: number, currency = "EUR") =>
  new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(cents / 100);

const checkoutInputClassName =
  "gv-input h-12 w-full rounded-[18px] px-4 text-sm outline-none focus:border-[color:var(--gv-lime)]/35 focus:bg-[color:var(--gv-lime)]/8 focus:ring-2 focus:ring-[color:var(--gv-lime)]/15";

const checkoutPrimaryButtonClassName =
  "inline-flex h-12 w-full items-center justify-center gap-2 rounded-[18px] bg-[color:var(--gv-lime)] px-4 text-sm font-semibold text-[color:var(--gv-forest)] transition-all duration-200 hover:-translate-y-0.5 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60";

const checkoutSecondaryButtonClassName =
  "inline-flex h-12 w-full items-center justify-center gap-2 rounded-[18px] border border-[color:var(--gv-border)] bg-[color:var(--gv-surface)] px-4 text-sm font-semibold text-[color:var(--gv-text)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[color:var(--gv-lime)]/24 hover:bg-[color:var(--gv-lime)]/10";

function CheckoutSectionHeading({
  number,
  title,
  detail,
}: {
  number: string;
  title: string;
  detail: string;
}) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[11px] bg-emerald-100 text-xs font-bold text-emerald-800">
        {number}
      </span>
      <div>
        <h2 className="text-sm font-bold text-[color:var(--gv-text)]">{title}</h2>
        <p className="text-xs leading-5 text-[color:var(--gv-text-muted)]">
          {detail}
        </p>
      </div>
    </div>
  );
}

const normalizeCountry = (value?: string | null): ShippingCountry | null => {
  const normalized = value?.trim().toUpperCase();
  switch (normalized) {
    case "AT":
    case "CH":
    case "DE":
    case "EU":
    case "OTHER":
    case "UK":
    case "US":
      return normalized;
    case "GB":
      return "UK";
    default:
      return null;
  }
};

const toAnalyticsItems = (items: CheckoutSummaryItem[]) =>
  items.map((item) => ({
    item_id: item.variantId,
    item_name: item.name,
    price:
      item.quantity > 0 ? item.lineTotalCents / item.quantity / 100 : undefined,
    quantity: item.quantity,
  }));

export default function CheckoutStartClient({
  initialCountry,
  initialDiscountCode,
  initialRecoverySessionId,
  initialUseLoyaltyPoints,
}: Props) {
  const router = useRouter();
  const savedState = useMemo(() => readCheckoutPaymentState(), []);
  const [loadStatus, setLoadStatus] = useState<"loading" | "ready" | "error">("loading");
  const [submitStatus, setSubmitStatus] = useState<"idle" | "loading">("idle");
  const [loadError, setLoadError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [currency, setCurrency] = useState(savedState?.summary.currency ?? "EUR");
  const [items, setItems] = useState<CheckoutSummaryItem[]>(savedState?.summary.items ?? []);
  const [subtotalCents, setSubtotalCents] = useState(savedState?.summary.subtotalCents ?? 0);
  const [discountCents, setDiscountCents] = useState(savedState?.summary.discountCents ?? 0);
  const [loyaltyPointsBalance, setLoyaltyPointsBalance] = useState(0);
  const [email, setEmail] = useState(savedState?.formValues.email ?? "");
  const [firstName, setFirstName] = useState(savedState?.formValues.firstName ?? "");
  const [lastName, setLastName] = useState(savedState?.formValues.lastName ?? "");
  const [street, setStreet] = useState(savedState?.formValues.street ?? "");
  const [houseNumber, setHouseNumber] = useState(savedState?.formValues.houseNumber ?? "");
  const [postalCode, setPostalCode] = useState(savedState?.formValues.postalCode ?? "");
  const [city, setCity] = useState(savedState?.formValues.city ?? "");
  const [country, setCountry] = useState<ShippingCountry>(
    normalizeCountry(savedState?.formValues.country) ?? initialCountry,
  );
  const [shippingAddressType, setShippingAddressType] = useState<"STREET" | "PACKSTATION">(
    savedState?.formValues.shippingAddressType ?? "STREET",
  );
  const [packstationNumber, setPackstationNumber] = useState(
    savedState?.formValues.packstationNumber ?? "",
  );
  const [postNumber, setPostNumber] = useState(savedState?.formValues.postNumber ?? "");
  const [checkoutRecoveryConsent, setCheckoutRecoveryConsent] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const checkoutAddressViewTrackedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoadStatus("loading");
      setLoadError("");
      try {
        const res = await fetch("/api/checkout", { method: "GET", cache: "no-store" });
        const data = (await res.json().catch(() => ({}))) as CheckoutResponse;
        if (!res.ok || !data.cart) throw new Error("load");
        if (cancelled) return;
        setCurrency(data.cart.currency || "EUR");
        setItems(data.cart.items ?? []);
        setSubtotalCents(data.cart.subtotalCents ?? 0);
        if (data.user) {
          setEmail((current) => current || data.user?.email || "");
          setFirstName((current) => current || data.user?.firstName || "");
          setLastName((current) => current || data.user?.lastName || "");
          setStreet((current) => current || data.user?.street || "");
          setHouseNumber((current) => current || data.user?.houseNumber || "");
          setPostalCode((current) => current || data.user?.postalCode || "");
          setCity((current) => current || data.user?.city || "");
          setPackstationNumber((current) => current || data.user?.packstationNumber || "");
          setPostNumber((current) => current || data.user?.postNumber || "");
          setLoyaltyPointsBalance(Math.max(0, Math.floor(Number(data.user.loyaltyPointsBalance ?? 0))));
          if (!savedState?.formValues.country) {
            const profileCountry = normalizeCountry(data.user.country);
            if (profileCountry) setCountry(profileCountry);
            if (data.user.shippingAddressType === "PACKSTATION") setCountry("DE");
          }
          setShippingAddressType((current) =>
            current === "PACKSTATION" || data.user?.shippingAddressType === "PACKSTATION"
              ? "PACKSTATION"
              : "STREET",
          );
        }
        setLoadStatus("ready");
      } catch {
        if (!cancelled) {
          setLoadStatus("error");
          setLoadError("Checkout-Daten konnten nicht geladen werden.");
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [savedState?.formValues.country]);

  const shippingCents =
    subtotalCents >= Math.round(FREE_SHIPPING_THRESHOLD_EUR * 100)
      ? 0
      : Math.round(getShippingAmount(country) * 100);
  const totalCents = Math.max(0, subtotalCents + shippingCents - Math.max(0, discountCents));
  const minOrderCents = Math.round(MIN_ORDER_TOTAL_EUR * 100);
  const meetsMinOrder = subtotalCents >= minOrderCents;
  const shippingLabel = shippingCents === 0 ? "Kostenloser Versand" : formatMoney(shippingCents, currency);

  useEffect(() => {
    if (loadStatus !== "ready" || checkoutAddressViewTrackedRef.current) return;
    checkoutAddressViewTrackedRef.current = true;
    trackAnalyticsEvent("checkout_address_view", {
      currency,
      items: toAnalyticsItems(items),
      shipping_tier: country,
      value: totalCents / 100,
    });
  }, [country, currency, items, loadStatus, totalCents]);

  const validate = () => {
    if (!email.trim()) return "E-Mail ist erforderlich.";
    if (!firstName.trim() || !lastName.trim()) return "Vorname und Nachname sind erforderlich.";
    if (!postalCode.trim() || !city.trim()) return "PLZ und Stadt sind erforderlich.";
    if (shippingAddressType === "PACKSTATION") {
      if (country !== "DE") return "Packstation ist derzeit nur für Deutschland verfügbar.";
      if (!packstationNumber.trim()) return "Packstation-Nummer ist erforderlich.";
      if (!postNumber.trim()) return "Postnummer ist erforderlich.";
    } else if (!street.trim() || !houseNumber.trim()) {
      return "Straße und Hausnummer sind erforderlich.";
    }
    if (!acceptTerms) return "Bitte akzeptiere die AGB.";
    if (!acceptPrivacy) return "Bitte bestätige die Datenschutzerklärung.";
    if (!meetsMinOrder) return `Mindestbestellwert ${formatMoney(minOrderCents, currency)}.`;
    return null;
  };

  const releaseExistingSession = async (sessionId: string, editToken: string) => {
    const res = await fetch("/api/checkout/session", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ editToken, sessionId }),
    });
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    if (!res.ok) {
      throw new Error(data?.error ?? "Vorherige Checkout-Session konnte nicht beendet werden.");
    }
  };

  const handleSubmit = async () => {
    trackAnalyticsEvent("checkout_submit_attempt", {
      currency,
      items: toAnalyticsItems(items),
      shipping_tier: country,
      value: totalCents / 100,
    });
    const validationError = validate();
    if (validationError) {
      trackAnalyticsEvent("checkout_submit_error", {
        error_message: validationError,
        error_type: "validation",
        shipping_address_type: shippingAddressType,
        shipping_tier: country,
      });
      setSubmitError(validationError);
      return;
    }
    setSubmitStatus("loading");
    setSubmitError("");
    try {
      const existingState = readCheckoutPaymentState();
      if (existingState?.sessionId && existingState?.editToken) {
        await releaseExistingSession(existingState.sessionId, existingState.editToken);
        clearCheckoutPaymentState();
      }
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          city,
          country,
          discountCode: initialDiscountCode || undefined,
          email,
          firstName,
          houseNumber,
          lastName,
          mode: "custom",
          packstationNumber,
          postalCode,
          postNumber,
          checkoutRecoveryConsent,
          recoverySessionId: initialRecoverySessionId || undefined,
          shippingAddressType,
          street,
          useLoyaltyPoints: initialUseLoyaltyPoints,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as CheckoutSessionResponse;
      if (
        !res.ok ||
        !data.checkoutUrl ||
        !data.orderCode ||
        !data.sessionId ||
        !data.editToken ||
        !data.successUrl ||
        !data.summary
      ) {
        throw new Error(data.error ?? "Checkout konnte nicht gestartet werden.");
      }
      const summary: CheckoutSummarySnapshot = {
        currency: data.summary.currency || currency,
        discountCents: data.summary.discountCents ?? 0,
        items: data.summary.items ?? items,
        shippingCents: data.summary.shippingCents ?? shippingCents,
        subtotalCents: data.summary.subtotalCents ?? subtotalCents,
        totalCents: data.summary.totalCents ?? totalCents,
      };
      setDiscountCents(summary.discountCents ?? 0);
      trackAnalyticsEvent("add_shipping_info", {
        currency: summary.currency,
        items: toAnalyticsItems(summary.items),
        shipping_tier: country,
        value: summary.totalCents / 100,
      });
      const paymentState = {
        checkoutUrl: data.checkoutUrl,
        discountCode: data.discountCode ?? undefined,
        editToken: data.editToken,
        failureUrl: data.failureUrl ?? undefined,
        formValues: {
          city,
          country,
          email,
          firstName,
          houseNumber,
          lastName,
          packstationNumber,
          postalCode,
          postNumber,
          shippingAddressType,
          street,
        },
        orderCode: data.orderCode,
        sessionId: data.sessionId,
        successUrl: data.successUrl,
        summary,
      };
      writeCheckoutPaymentState(paymentState);
      const paymentRoute = readCheckoutPaymentState()
        ? "/checkout/payment"
        : `/checkout/payment#${buildCheckoutPaymentStateHash(paymentState)}`;
      router.push(paymentRoute);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Checkout konnte nicht gestartet werden.";
      trackAnalyticsEvent("checkout_submit_error", {
        error_message: message,
        error_type: "api",
        shipping_address_type: shippingAddressType,
        shipping_tier: country,
      });
      setSubmitError(message);
      setSubmitStatus("idle");
    }
  };

  if (loadStatus === "loading") {
    return (
      <div className="mx-auto flex min-h-[55vh] w-full max-w-xl items-center px-4 py-12 text-center">
        <div className="gv-checkout-surface w-full rounded-[26px] px-6 py-8 sm:px-8">
          <LoadingSpinner
            size="md"
            className="mx-auto border-[color:var(--gv-lime)]/25 border-t-[color:var(--gv-lime)]"
          />
          <p className="mt-4 text-sm font-medium text-[color:var(--gv-text-muted)]">
            Checkout wird vorbereitet…
          </p>
        </div>
      </div>
    );
  }

  if (loadStatus === "error") {
    return (
      <div className="mx-auto flex min-h-[55vh] w-full max-w-xl items-center px-4 py-12 text-center">
        <div className="gv-checkout-surface w-full rounded-[26px] px-6 py-8 sm:px-8">
          <p className="font-[family:var(--font-syne)] text-2xl font-bold tracking-[-0.04em] text-[color:var(--gv-text)]">
            Checkout fehlgeschlagen
          </p>
          <p className="mt-2 text-sm text-[color:var(--gv-text-muted)]">{loadError}</p>
          <button
            type="button"
            onClick={() => router.push("/cart")}
            className={`${checkoutPrimaryButtonClassName} mt-5`}
          >
            Zum Warenkorb
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1200px] px-3 py-4 sm:px-6 sm:py-7 lg:px-8">
      <section className="gv-checkout-surface rounded-[22px] px-3 py-4 sm:px-5">
        <CheckoutProgress
          currentStep="address"
          onStepClick={(step) => {
            if (step === "cart") router.push("/cart");
          }}
        />

        <div className="mt-4 grid gap-3 sm:mt-5 lg:grid-cols-[minmax(0,1.18fr)_minmax(320px,0.82fr)] lg:items-start lg:gap-5">
          <form
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              void handleSubmit();
            }}
            className="gv-checkout-surface order-2 min-w-0 rounded-[26px] p-4 sm:p-6 lg:order-1"
          >
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-700">
                Schritt 2 · Lieferdaten
              </p>
              <h1 className="mt-1.5 font-[family:var(--font-syne)] text-2xl font-bold tracking-[-0.04em] text-[color:var(--gv-text)] sm:text-3xl">
                Wohin dürfen wir liefern?
              </h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-[color:var(--gv-text-muted)]">
                Ohne Konto bestellen. Deine Zahlungsdaten gibst du erst sicher bei Viva ein.
              </p>
            </div>

            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 border-y border-emerald-950/8 py-3 text-[11px] font-semibold text-[color:var(--gv-text-muted)]">
              <span>✓ Gast-Checkout</span>
              <span>✓ Sicher bezahlen mit Viva</span>
              <span>✓ SSL verschlüsselt</span>
            </div>

            <section className="py-5">
              <CheckoutSectionHeading
                number="01"
                title="Kontakt"
                detail="Für Beleg und Versandbenachrichtigung."
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-2 sm:col-span-2">
                  <span className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--gv-text-muted)]">
                    E-Mail <span className="text-[color:var(--gv-lime)]">*</span>
                  </span>
                  <input
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="name@beispiel.de"
                    className={checkoutInputClassName}
                  />
                </label>
                <label className="space-y-2">
                  <span className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--gv-text-muted)]">
                    Vorname <span className="text-[color:var(--gv-lime)]">*</span>
                  </span>
                  <input
                    type="text"
                    autoComplete="given-name"
                    value={firstName}
                    onChange={(event) => setFirstName(event.target.value)}
                    className={checkoutInputClassName}
                  />
                </label>
                <label className="space-y-2">
                  <span className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--gv-text-muted)]">
                    Nachname <span className="text-[color:var(--gv-lime)]">*</span>
                  </span>
                  <input
                    type="text"
                    autoComplete="family-name"
                    value={lastName}
                    onChange={(event) => setLastName(event.target.value)}
                    className={checkoutInputClassName}
                  />
                </label>
              </div>
            </section>

            <section className="border-t border-emerald-950/8 py-5">
              <CheckoutSectionHeading
                number="02"
                title="Lieferart"
                detail="Wähle Hausadresse oder DHL Packstation."
              />
              <div className="grid grid-cols-2 gap-2 rounded-[18px] bg-emerald-50 p-1.5">
                <button
                  type="button"
                  onClick={() => setShippingAddressType("STREET")}
                  aria-pressed={shippingAddressType === "STREET"}
                  className={`flex min-h-12 items-center justify-center gap-2 rounded-[14px] border px-2 text-center text-xs font-bold transition sm:text-sm ${
                    shippingAddressType === "STREET"
                      ? "border-emerald-700/25 bg-white text-emerald-900 shadow-sm"
                      : "border-transparent bg-transparent text-[color:var(--gv-text-muted)] hover:bg-white/70"
                  }`}
                >
                  <Home className="h-4 w-4" aria-hidden="true" />
                  <span>Hausadresse</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShippingAddressType("PACKSTATION");
                    setCountry("DE");
                  }}
                  aria-pressed={shippingAddressType === "PACKSTATION"}
                  className={`flex min-h-12 items-center justify-center gap-2 rounded-[14px] border px-2 text-center text-xs font-bold transition sm:text-sm ${
                    shippingAddressType === "PACKSTATION"
                      ? "border-emerald-700/25 bg-white text-emerald-900 shadow-sm"
                      : "border-transparent bg-transparent text-[color:var(--gv-text-muted)] hover:bg-white/70"
                  }`}
                >
                  <Inbox className="h-4 w-4" aria-hidden="true" />
                  <span>DHL Packstation</span>
                </button>
              </div>
            </section>

            <section className="border-t border-emerald-950/8 py-5">
              <CheckoutSectionHeading
                number="03"
                title="Zustelladresse"
                detail="Wir prüfen alle Pflichtfelder vor der Zahlung."
              />
              <div className="grid gap-3 sm:grid-cols-2">
                {shippingAddressType === "PACKSTATION" ? (
                  <>
                    <label className="space-y-2">
                      <span className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--gv-text-muted)]">
                        Packstation Nr. <span className="text-[color:var(--gv-lime)]">*</span>
                      </span>
                      <input
                        type="text"
                        value={packstationNumber}
                        onChange={(event) => setPackstationNumber(event.target.value)}
                        placeholder="123"
                        className={checkoutInputClassName}
                      />
                    </label>
                    <label className="space-y-2">
                      <span className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--gv-text-muted)]">
                        Postnummer <span className="text-[color:var(--gv-lime)]">*</span>
                      </span>
                      <input
                        type="text"
                        value={postNumber}
                        onChange={(event) => setPostNumber(event.target.value)}
                        className={checkoutInputClassName}
                      />
                    </label>
                  </>
                ) : (
                  <>
                    <label className="space-y-2">
                      <span className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--gv-text-muted)]">
                        Straße <span className="text-[color:var(--gv-lime)]">*</span>
                      </span>
                      <input
                        type="text"
                        autoComplete="address-line1"
                        value={street}
                        onChange={(event) => setStreet(event.target.value)}
                        className={checkoutInputClassName}
                      />
                    </label>
                    <label className="space-y-2">
                      <span className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--gv-text-muted)]">
                        Hausnummer <span className="text-[color:var(--gv-lime)]">*</span>
                      </span>
                      <input
                        type="text"
                        value={houseNumber}
                        onChange={(event) => setHouseNumber(event.target.value)}
                        className={checkoutInputClassName}
                      />
                    </label>
                  </>
                )}
                <label className="space-y-2">
                  <span className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--gv-text-muted)]">
                    Postleitzahl <span className="text-[color:var(--gv-lime)]">*</span>
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="postal-code"
                    value={postalCode}
                    onChange={(event) => setPostalCode(event.target.value)}
                    className={checkoutInputClassName}
                  />
                </label>
                <label className="space-y-2">
                  <span className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--gv-text-muted)]">
                    Stadt <span className="text-[color:var(--gv-lime)]">*</span>
                  </span>
                  <input
                    type="text"
                    autoComplete="address-level2"
                    value={city}
                    onChange={(event) => setCity(event.target.value)}
                    className={checkoutInputClassName}
                  />
                </label>
                <label className="space-y-2 sm:col-span-2">
                  <span className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--gv-text-muted)]">
                    Land <span className="text-[color:var(--gv-lime)]">*</span>
                  </span>
                  <select
                    value={country}
                    onChange={(event) => setCountry(event.target.value as ShippingCountry)}
                    disabled={shippingAddressType === "PACKSTATION"}
                    className={`${checkoutInputClassName} appearance-none disabled:opacity-70`}
                  >
                    {Object.entries(SHIPPING_COUNTRY_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </section>

            <div className="gv-checkout-inset rounded-[18px] px-3 py-3 sm:flex sm:items-center sm:justify-between sm:gap-4">
              <p className="text-xs leading-5 text-[color:var(--gv-text-muted)]">
                <strong className="text-[color:var(--gv-text)]">{shippingLabel}</strong>
                {" · Lieferung in 2–5 Werktage"}
              </p>
              <PaymentMethodLogos
                className="mt-2 justify-start gap-1.5 sm:mt-0 sm:justify-end"
                pillClassName="h-7 border-emerald-950/8 bg-white px-2"
                logoClassName="h-3.5"
              />
            </div>

            {initialDiscountCode ||
            (initialUseLoyaltyPoints && loyaltyPointsBalance > 0) ? (
              <div className="mt-4 rounded-[22px] border border-[color:var(--gv-border)] bg-[color:var(--gv-surface)]/72 px-4 py-3 text-sm text-[color:var(--gv-text-muted)]">
                {initialDiscountCode ? (
                  <p>
                    Rabattcode wird übernommen:{" "}
                    <span className="font-semibold text-[color:var(--gv-text)]">
                      {initialDiscountCode}
                    </span>
                  </p>
                ) : null}
                {initialUseLoyaltyPoints && loyaltyPointsBalance > 0 ? (
                  <p className={initialDiscountCode ? "mt-1.5" : undefined}>
                    Smokeify Punkte werden im Gesamtbetrag berücksichtigt.
                  </p>
                ) : null}
              </div>
            ) : null}

            <fieldset className="mt-5 space-y-2.5 border-t border-emerald-950/8 pt-5">
              <legend className="text-xs font-bold text-[color:var(--gv-text)]">
                Rechtliches
              </legend>
              <label className="mt-3 flex items-start gap-3 rounded-[16px] bg-[#f5f8f5] px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={acceptTerms}
                  onChange={(event) => setAcceptTerms(event.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-[color:var(--gv-border)] text-[color:var(--gv-lime)] focus:ring-[color:var(--gv-lime)]/30"
                />
                <span className="text-sm leading-6 text-[color:var(--gv-text)]">
                  Ich akzeptiere die{" "}
                  <a
                    href="/pages/agb"
                    target="_blank"
                    rel="noreferrer"
                    className="underline underline-offset-2"
                  >
                    AGB
                  </a>
                  .
                </span>
              </label>
              <label className="flex items-start gap-3 rounded-[16px] bg-[#f5f8f5] px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={acceptPrivacy}
                  onChange={(event) => setAcceptPrivacy(event.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-[color:var(--gv-border)] text-[color:var(--gv-lime)] focus:ring-[color:var(--gv-lime)]/30"
                />
                <span className="text-sm leading-6 text-[color:var(--gv-text)]">
                  Ich habe die{" "}
                  <a
                    href="/pages/privacy"
                    target="_blank"
                    rel="noreferrer"
                    className="underline underline-offset-2"
                  >
                    Datenschutzerklärung
                  </a>{" "}
                  gelesen.
                </span>
              </label>
            </fieldset>

            <label className="mt-3 flex items-start gap-3 rounded-[16px] border border-emerald-950/8 bg-[#f8faf8] px-3 py-3">
              <input
                type="checkbox"
                checked={checkoutRecoveryConsent}
                onChange={(event) => setCheckoutRecoveryConsent(event.target.checked)}
                aria-label="Newsletter und Checkout-Erinnerungen"
                className="mt-1 h-4 w-4 rounded border-[color:var(--gv-border)] text-[color:var(--gv-lime)] focus:ring-[color:var(--gv-lime)]/30"
              />
              <span className="text-sm leading-6 text-[color:var(--gv-text)]">
                <span className="block font-semibold">
                  Newsletter &amp; Checkout-Erinnerungen
                </span>
                <span className="block text-[color:var(--gv-text-muted)]">
                  Ja, ich möchte Smokeify-Updates, Angebote und eine Erinnerung an meinen
                  offenen Checkout per E-Mail erhalten. Abmeldung jederzeit.
                </span>
              </span>
            </label>

            {submitError ? (
              <div
                className="mt-4 rounded-[18px] border border-[color:var(--gv-error)]/28 bg-[color:var(--gv-error)]/10 px-4 py-3 text-sm leading-6 text-[color:var(--gv-error)]"
                aria-live="assertive"
              >
                {submitError}
              </div>
            ) : null}

            <div className="gv-checkout-sticky-action sticky bottom-0 z-20 -mx-4 mt-4 flex flex-col gap-2 border-t border-emerald-950/8 bg-white/94 px-4 pt-3 backdrop-blur sm:static sm:mx-0 sm:mt-5 sm:flex-row sm:border-0 sm:bg-transparent sm:px-0 sm:pt-0">
              <button
                type="submit"
                disabled={submitStatus === "loading" || items.length === 0}
                className={`${checkoutPrimaryButtonClassName} min-w-[220px] justify-center shadow-[0_10px_24px_rgba(31,95,63,0.18)]`}
              >
                {submitStatus === "loading" ? (
                  <>
                    <LoadingSpinner
                      size="sm"
                      className="border-white/30 border-t-white"
                    />
                    Zahlungsseite wird vorbereitet…
                  </>
                ) : (
                  <>
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    Weiter zur Zahlung <span aria-hidden="true">· {formatMoney(totalCents, currency)}</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => router.push("/cart")}
                className={`${checkoutSecondaryButtonClassName} hidden justify-center sm:inline-flex sm:max-w-[210px]`}
              >
                Zurück zum Warenkorb
              </button>
            </div>
          </form>

          <aside className="order-1 lg:order-2 lg:sticky lg:top-5">
            <OrderSummary
              currency={currency}
              discountCents={discountCents}
              items={items}
              shippingCents={shippingCents}
              subtotalCents={subtotalCents}
              totalCents={totalCents}
            />
          </aside>
        </div>
      </section>
    </div>
  );
}
