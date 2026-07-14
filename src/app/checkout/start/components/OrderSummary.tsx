"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronDown, ShoppingBag, Truck } from "lucide-react";
import type { CheckoutSummaryItem } from "@/app/checkout/shared/paymentState";
import { shouldBypassImageOptimization } from "@/lib/storefrontImages";

type Props = {
  currency: string;
  deliveryEstimateLabel?: string;
  discountCents?: number;
  items: CheckoutSummaryItem[];
  shippingCents: number;
  subtotalCents: number;
  totalCents: number;
  variant?: "responsive" | "panel";
};

const formatMoney = (cents: number, currency = "EUR") =>
  new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(cents / 100);

function SummaryBody({
  currency,
  deliveryEstimateLabel = "2–5 Werktage",
  discountCents = 0,
  items,
  shippingCents,
  subtotalCents,
  totalCents,
}: Omit<Props, "variant">) {
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <section
      aria-label="Bestellübersicht"
      className="gv-checkout-surface overflow-hidden rounded-[24px]"
    >
      <div className="flex items-center justify-between gap-4 border-b border-emerald-950/8 px-4 py-4 sm:px-5">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-[13px] bg-emerald-100 text-emerald-800">
            <ShoppingBag className="h-4 w-4" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-sm font-bold text-[color:var(--gv-text)]">
              Deine Bestellung
            </h2>
            <p className="text-xs text-[color:var(--gv-text-muted)]">
              {itemCount} {itemCount === 1 ? "Artikel" : "Artikel"}
            </p>
          </div>
        </div>
        <span className="font-[family:var(--font-syne)] text-lg font-bold text-[color:var(--gv-text)]">
          {formatMoney(totalCents, currency)}
        </span>
      </div>

      <div className="max-h-[18rem] space-y-2 overflow-y-auto px-4 py-3 sm:px-5">
        {items.length ? (
          items.map((item) => (
            <div
              key={`${item.variantId}-${item.name}`}
              className="flex items-center gap-3 py-1.5"
            >
              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-[14px] border border-emerald-950/8 bg-[#f3f7f3]">
                {item.imageUrl ? (
                  <Image
                    src={item.imageUrl}
                    alt={item.name}
                    fill
                    sizes="48px"
                    unoptimized={shouldBypassImageOptimization(item.imageUrl)}
                    className="object-cover"
                  />
                ) : (
                  <div className="grid h-full place-items-center text-[9px] font-bold uppercase tracking-wider text-[color:var(--gv-text-muted)]">
                    SM
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm font-semibold leading-5 text-[color:var(--gv-text)]">
                  {item.name}
                </p>
                <p className="text-xs text-[color:var(--gv-text-muted)]">
                  Menge {item.quantity}
                </p>
              </div>
              <p className="shrink-0 text-sm font-bold text-[color:var(--gv-text)]">
                {formatMoney(item.lineTotalCents, currency)}
              </p>
            </div>
          ))
        ) : (
          <p className="rounded-[16px] bg-emerald-50 px-3 py-3 text-sm text-[color:var(--gv-text-muted)]">
            Dein Warenkorb ist aktuell leer.
          </p>
        )}
      </div>

      <div className="border-t border-emerald-950/8 px-4 py-4 sm:px-5">
        <div className="mb-3 flex items-start gap-2 rounded-[16px] bg-emerald-50 px-3 py-2.5 text-xs leading-5 text-emerald-950">
          <Truck
            className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700"
            aria-hidden="true"
          />
          <span>
            <strong>
              {shippingCents <= 0
                ? "Kostenloser Versand"
                : `Versand ${formatMoney(shippingCents, currency)}`}
            </strong>
            {` · Lieferung in ${deliveryEstimateLabel}`}
          </span>
        </div>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between text-[color:var(--gv-text-muted)]">
            <dt>Zwischensumme</dt>
            <dd>{formatMoney(subtotalCents, currency)}</dd>
          </div>
          <div className="flex justify-between text-[color:var(--gv-text-muted)]">
            <dt>Versand</dt>
            <dd>
              {shippingCents <= 0
                ? "Kostenlos"
                : formatMoney(shippingCents, currency)}
            </dd>
          </div>
          {discountCents > 0 ? (
            <div className="flex justify-between font-semibold text-emerald-700">
              <dt>Rabatt</dt>
              <dd>-{formatMoney(discountCents, currency)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between border-t border-emerald-950/8 pt-3 text-base font-bold text-[color:var(--gv-text)]">
            <dt>Gesamt</dt>
            <dd>{formatMoney(totalCents, currency)}</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}

export default function OrderSummary({ variant = "responsive", ...props }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);

  if (variant === "panel") return <SummaryBody {...props} />;

  return (
    <>
      <div className="lg:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen((value) => !value)}
          className="gv-checkout-surface flex min-h-14 w-full items-center justify-between rounded-[18px] px-4 text-left"
          aria-expanded={mobileOpen}
          aria-controls="checkout-order-summary-mobile"
        >
          <span>
            <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-700">
              Bestellübersicht
            </span>
            <span className="mt-0.5 block text-sm font-bold text-[color:var(--gv-text)]">
              {formatMoney(props.totalCents, props.currency)}
            </span>
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800">
            {mobileOpen ? "Weniger" : "Anzeigen"}
            <ChevronDown
              className={`h-4 w-4 transition ${mobileOpen ? "rotate-180" : ""}`}
              aria-hidden="true"
            />
          </span>
        </button>
        {mobileOpen ? (
          <div id="checkout-order-summary-mobile" className="mt-2">
            <SummaryBody {...props} />
          </div>
        ) : null}
      </div>
      <div className="hidden lg:block">
        <SummaryBody {...props} />
      </div>
    </>
  );
}
