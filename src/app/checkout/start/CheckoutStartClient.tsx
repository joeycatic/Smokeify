"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { StripeCheckoutContact } from "@stripe/stripe-js";
import LoadingSpinner from "@/components/LoadingSpinner";
import {
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
  normalizeShippingAddress,
  type ShippingAddressRecord,
} from "@/lib/shippingAddress";
import {
  getShippingAmount,
  SHIPPING_COUNTRY_LABELS,
  type ShippingCountry,
} from "@/lib/shippingPolicy";

type Props = {
  initialCountry: ShippingCountry;
  initialDiscountCode: string;
  initialUseLoyaltyPoints: boolean;
  publishableKey: string;
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
  clientSecret?: string | null;
  editToken?: string | null;
  error?: string;
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

const buildContact = (input: {
  city: string;
  country: ShippingCountry;
  firstName: string;
  houseNumber: string;
  lastName: string;
  packstationNumber: string;
  postalCode: string;
  postNumber: string;
  shippingAddressType: "STREET" | "PACKSTATION";
  street: string;
}): StripeCheckoutContact => {
  const address: ShippingAddressRecord = normalizeShippingAddress(input);
  const line1 =
    address.shippingAddressType === "PACKSTATION"
      ? `Packstation ${address.packstationNumber ?? ""}`.trim()
      : [address.street, address.houseNumber].filter(Boolean).join(" ").trim();
  const line2 =
    address.shippingAddressType === "PACKSTATION"
      ? `Postnummer ${address.postNumber ?? ""}`.trim()
      : null;
  return {
    name: [input.firstName, input.lastName].filter(Boolean).join(" ").trim(),
    address: {
      city: address.city ?? null,
      country: address.country ?? input.country,
      line1: line1 || null,
      line2,
      postal_code: address.postalCode ?? null,
    },
  };
};

export default function CheckoutStartClient({
  initialCountry,
  initialDiscountCode,
  initialUseLoyaltyPoints,
  publishableKey,
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
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);

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

  const validate = () => {
    if (!publishableKey.trim()) return "Stripe Publishable Key fehlt.";
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
    const validationError = validate();
    if (validationError) {
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
          shippingAddressType,
          street,
          useLoyaltyPoints: initialUseLoyaltyPoints,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as CheckoutSessionResponse;
      if (!res.ok || !data.clientSecret || !data.sessionId || !data.editToken || !data.successUrl || !data.summary) {
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
      writeCheckoutPaymentState({
        clientSecret: data.clientSecret,
        contact: buildContact({
          city,
          country,
          firstName,
          houseNumber,
          lastName,
          packstationNumber,
          postalCode,
          postNumber,
          shippingAddressType,
          street,
        }),
        editToken: data.editToken,
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
        sessionId: data.sessionId,
        successUrl: data.successUrl,
        summary,
      });
      router.push("/checkout/payment");
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Checkout konnte nicht gestartet werden.");
      setSubmitStatus("idle");
    }
  };

  if (loadStatus === "loading") {
    return (
      <div className="mx-auto flex min-h-[50vh] w-full max-w-xl flex-col items-center justify-center px-6 py-16 text-center">
        <div className="w-full rounded-[30px] border border-[var(--smk-border)] bg-[linear-gradient(180deg,rgba(27,23,20,0.98),rgba(14,14,13,0.99))] p-8 shadow-[0_24px_60px_rgba(0,0,0,0.24)]">
          <LoadingSpinner size="md" className="border-[rgba(255,255,255,0.18)] border-t-[var(--smk-accent)]" />
          <p className="mt-4 text-sm font-medium text-[var(--smk-text-muted)]">Checkout wird vorbereitet...</p>
        </div>
      </div>
    );
  }

  if (loadStatus === "error") {
    return (
      <div className="mx-auto flex min-h-[50vh] w-full max-w-xl flex-col items-center justify-center px-6 py-16 text-center">
        <div className="w-full rounded-[30px] border border-[var(--smk-border)] bg-[linear-gradient(180deg,rgba(27,23,20,0.98),rgba(14,14,13,0.99))] p-8 shadow-[0_24px_60px_rgba(0,0,0,0.24)]">
          <p className="smk-heading text-2xl text-[var(--smk-text)]">Checkout fehlgeschlagen</p>
          <p className="mt-2 text-sm text-[var(--smk-text-muted)]">{loadError}</p>
          <button type="button" onClick={() => router.push("/cart")} className="smk-button-primary mt-5 rounded-full px-5 py-2.5 text-sm font-semibold">
            Zum Warenkorb
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--smk-text-dim)]">Checkout</p>
        <h1 className="smk-heading mt-2 text-3xl text-[var(--smk-text)] sm:text-4xl">Lieferdaten bestätigen</h1>
        <p className="mt-2 max-w-2xl text-sm text-[var(--smk-text-muted)]">
          Nach der Adressprüfung geht es auf eine interne Zahlungsseite statt in den gehosteten Stripe Checkout.
        </p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-[30px] border border-[var(--smk-border)] bg-[linear-gradient(180deg,rgba(27,23,20,0.98),rgba(14,14,13,0.99))] p-6 shadow-[0_24px_60px_rgba(0,0,0,0.24)]">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2"><label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--smk-text-dim)]">E-Mail</label><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="smk-input h-11 w-full rounded-2xl px-4 text-sm focus-visible:ring-offset-black" /></div>
            <div><label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--smk-text-dim)]">Vorname</label><input type="text" value={firstName} onChange={(event) => setFirstName(event.target.value)} className="smk-input h-11 w-full rounded-2xl px-4 text-sm focus-visible:ring-offset-black" /></div>
            <div><label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--smk-text-dim)]">Nachname</label><input type="text" value={lastName} onChange={(event) => setLastName(event.target.value)} className="smk-input h-11 w-full rounded-2xl px-4 text-sm focus-visible:ring-offset-black" /></div>
          </div>
          <div className="mt-6">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--smk-text-dim)]">Lieferart</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <button type="button" onClick={() => setShippingAddressType("STREET")} className={`rounded-[24px] border px-4 py-4 text-left transition ${shippingAddressType === "STREET" ? "border-[var(--smk-border-strong)] bg-[rgba(233,188,116,0.12)] text-[var(--smk-text)]" : "border-[var(--smk-border)] bg-[rgba(255,255,255,0.04)] text-[var(--smk-text-muted)]"}`}><p className="font-semibold">Straßenadresse</p><p className="mt-1 text-sm">Klassische Lieferung mit Straße und Hausnummer.</p></button>
              <button type="button" onClick={() => { setShippingAddressType("PACKSTATION"); setCountry("DE"); }} className={`rounded-[24px] border px-4 py-4 text-left transition ${shippingAddressType === "PACKSTATION" ? "border-[var(--smk-border-strong)] bg-[rgba(233,188,116,0.12)] text-[var(--smk-text)]" : "border-[var(--smk-border)] bg-[rgba(255,255,255,0.04)] text-[var(--smk-text-muted)]"}`}><p className="font-semibold">DHL Packstation</p><p className="mt-1 text-sm">Packstation + Postnummer innerhalb Deutschlands.</p></button>
            </div>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {shippingAddressType === "PACKSTATION" ? (
              <>
                <div><label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--smk-text-dim)]">Packstation</label><input type="text" value={packstationNumber} onChange={(event) => setPackstationNumber(event.target.value)} className="smk-input h-11 w-full rounded-2xl px-4 text-sm focus-visible:ring-offset-black" /></div>
                <div><label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--smk-text-dim)]">Postnummer</label><input type="text" value={postNumber} onChange={(event) => setPostNumber(event.target.value)} className="smk-input h-11 w-full rounded-2xl px-4 text-sm focus-visible:ring-offset-black" /></div>
              </>
            ) : (
              <>
                <div><label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--smk-text-dim)]">Straße</label><input type="text" value={street} onChange={(event) => setStreet(event.target.value)} className="smk-input h-11 w-full rounded-2xl px-4 text-sm focus-visible:ring-offset-black" /></div>
                <div><label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--smk-text-dim)]">Hausnummer</label><input type="text" value={houseNumber} onChange={(event) => setHouseNumber(event.target.value)} className="smk-input h-11 w-full rounded-2xl px-4 text-sm focus-visible:ring-offset-black" /></div>
              </>
            )}
            <div><label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--smk-text-dim)]">Postleitzahl</label><input type="text" value={postalCode} onChange={(event) => setPostalCode(event.target.value)} className="smk-input h-11 w-full rounded-2xl px-4 text-sm focus-visible:ring-offset-black" /></div>
            <div><label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--smk-text-dim)]">Stadt</label><input type="text" value={city} onChange={(event) => setCity(event.target.value)} className="smk-input h-11 w-full rounded-2xl px-4 text-sm focus-visible:ring-offset-black" /></div>
            <div className="sm:col-span-2">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--smk-text-dim)]">Land</label>
              <select value={country} onChange={(event) => setCountry(event.target.value as ShippingCountry)} disabled={shippingAddressType === "PACKSTATION"} className="smk-input h-11 w-full rounded-2xl px-4 text-sm focus-visible:ring-offset-black disabled:opacity-70">
                {Object.entries(SHIPPING_COUNTRY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
          </div>
          <div className="mt-6 space-y-3">
            <label className="flex items-start gap-3 rounded-[22px] border border-[var(--smk-border)] bg-[rgba(255,255,255,0.04)] px-4 py-3 text-sm text-[var(--smk-text)]"><input type="checkbox" checked={acceptTerms} onChange={(event) => setAcceptTerms(event.target.checked)} className="mt-1 h-4 w-4" /><span>Ich akzeptiere die <a href="/pages/agb" target="_blank" rel="noreferrer" className="underline">AGB</a>.</span></label>
            <label className="flex items-start gap-3 rounded-[22px] border border-[var(--smk-border)] bg-[rgba(255,255,255,0.04)] px-4 py-3 text-sm text-[var(--smk-text)]"><input type="checkbox" checked={acceptPrivacy} onChange={(event) => setAcceptPrivacy(event.target.checked)} className="mt-1 h-4 w-4" /><span>Ich habe die <a href="/pages/privacy" target="_blank" rel="noreferrer" className="underline">Datenschutzerklärung</a> gelesen.</span></label>
          </div>
          {submitError ? <div className="mt-5 rounded-[22px] border border-[var(--smk-error)]/30 bg-[rgba(120,30,30,0.18)] px-4 py-3 text-sm text-[var(--smk-error)]">{submitError}</div> : null}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button type="button" onClick={() => void handleSubmit()} disabled={submitStatus === "loading" || items.length === 0} className="smk-button-primary inline-flex h-12 items-center justify-center rounded-full px-6 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60">{submitStatus === "loading" ? "Zahlungsseite wird vorbereitet..." : "Weiter zur Zahlung"}</button>
            <button type="button" onClick={() => router.push("/cart")} className="smk-button-secondary inline-flex h-12 items-center justify-center rounded-full px-6 text-sm font-semibold">Zurück zum Warenkorb</button>
          </div>
        </section>
        <aside className="rounded-[30px] border border-[var(--smk-border)] bg-[linear-gradient(180deg,rgba(27,23,20,0.98),rgba(14,14,13,0.99))] p-6 shadow-[0_24px_60px_rgba(0,0,0,0.24)]">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--smk-text-dim)]">Bestellübersicht</p>
          <div className="mt-4 space-y-3">
            {items.length === 0 ? <p className="text-sm text-[var(--smk-text-muted)]">Dein Warenkorb ist leer.</p> : items.map((item) => (
              <div key={`${item.variantId}-${item.name}`} className="flex items-center gap-3 rounded-[22px] border border-[var(--smk-border)] bg-[rgba(255,255,255,0.04)] p-3">
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-[rgba(255,255,255,0.05)]">{item.imageUrl ? <Image src={item.imageUrl} alt={item.name} fill sizes="64px" className="object-cover" /> : null}</div>
                <div className="min-w-0 flex-1"><p className="line-clamp-2 text-sm font-semibold text-[var(--smk-text)]">{item.name}</p><p className="mt-1 text-xs text-[var(--smk-text-muted)]">Menge {item.quantity}</p></div>
                <p className="text-sm font-semibold text-[var(--smk-text)]">{formatMoney(item.lineTotalCents, currency)}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 space-y-3 rounded-[24px] border border-[var(--smk-border)] bg-[rgba(255,255,255,0.04)] p-4">
            <div className="flex items-center justify-between text-sm text-[var(--smk-text-muted)]"><span>Zwischensumme</span><span>{formatMoney(subtotalCents, currency)}</span></div>
            {discountCents > 0 ? <div className="flex items-center justify-between text-sm text-[var(--smk-text-muted)]"><span>Rabatt</span><span>-{formatMoney(discountCents, currency)}</span></div> : null}
            <div className="flex items-center justify-between text-sm text-[var(--smk-text-muted)]"><span>Versand</span><span>{shippingLabel}</span></div>
            <div className="flex items-center justify-between text-base font-semibold text-[var(--smk-text)]"><span>Gesamt</span><span>{formatMoney(totalCents, currency)}</span></div>
          </div>
          {initialDiscountCode ? <div className="mt-4 rounded-[22px] border border-[var(--smk-border)] bg-[rgba(255,255,255,0.04)] px-4 py-3 text-sm text-[var(--smk-text-muted)]">Rabattcode aktiv: <span className="font-semibold text-[var(--smk-text)]">{initialDiscountCode}</span></div> : null}
          {initialUseLoyaltyPoints && loyaltyPointsBalance > 0 ? <div className="mt-4 rounded-[22px] border border-[rgba(127,207,150,0.28)] bg-[rgba(22,52,39,0.82)] px-4 py-3 text-sm text-[#9fe3b2]">Smokeify Punkte werden im Checkout eingelöst.</div> : null}
        </aside>
      </div>
    </div>
  );
}
