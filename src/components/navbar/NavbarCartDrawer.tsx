"use client";

import Link from "next/link";
import Image from "next/image";
import type React from "react";
import { TruckIcon } from "@heroicons/react/24/outline";
import PaymentMethodLogos from "@/components/PaymentMethodLogos";
import { FREE_SHIPPING_THRESHOLD_EUR } from "@/lib/checkoutPolicy";
import type { Cart } from "@/lib/cart";
import LoadingSpinner from "@/components/LoadingSpinner";

type Props = {
  open: boolean;
  cart: Cart | null;
  loading: boolean;
  error: string | null;
  canCheckout: boolean;
  checkoutStatus: "idle" | "loading" | "error";
  onClose: () => void;
  onStartCheckout: () => void;
  panelRef?: React.MutableRefObject<HTMLElement | null>;
};

function formatPrice(amount: string, currencyCode: string) {
  const value = Number(amount);
  if (!Number.isFinite(value)) return "";
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: 2,
  }).format(value);
}

const formatCartOptions = (options?: Array<{ name: string; value: string }>) => {
  if (!options?.length) return "";
  return options
    .map((opt) => `${opt.name}: ${opt.value}`)
    .filter(Boolean)
    .join(" · ");
};

export default function NavbarCartDrawer({
  open,
  cart,
  loading,
  error,
  canCheckout,
  checkoutStatus,
  onClose,
  onStartCheckout,
  panelRef,
}: Props) {
  if (!open) return null;

  return (
    <>
      <button
        type="button"
        aria-label="Close cart"
        onClick={onClose}
        className="fixed inset-0 z-40 cursor-pointer bg-black/35 cart-overlay-fade focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
      />
      <aside
        ref={(node) => {
          if (panelRef) panelRef.current = node;
        }}
        className="fixed right-0 top-0 z-50 h-dvh w-full max-w-sm bg-white shadow-xl cart-slide-in"
      >
        <div className="h-14 px-5 border-b border-black/10 flex items-center justify-between">
          <div className="text-sm font-semibold tracking-widest">WARENKORB</div>
          <button
            type="button"
            onClick={onClose}
            className="text-xl cursor-pointer text-black/60 hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="flex h-full flex-col">
          <div className="no-scrollbar overflow-y-auto px-5 py-4 text-sm">
            {error ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                <p>{error}</p>
              </div>
            ) : loading ? (
              <div className="flex items-center gap-2 text-stone-500">
                <LoadingSpinner size="sm" />
                <span>Warenkorb wird geladen...</span>
              </div>
            ) : !cart || cart.lines.length === 0 ? (
              <p className="text-stone-500">Warenkorb ist leer.</p>
            ) : (
              <div className="space-y-3">
                {cart.lines.slice(0, 6).map((line) => {
                  const lineTotal = (
                    Number(line.merchandise.price.amount) * line.quantity
                  ).toFixed(2);
                  return (
                    <div key={line.id} className="flex items-center gap-3">
                      {line.merchandise.image?.url ? (
                        <Image
                          src={line.merchandise.image.url}
                          alt={
                            line.merchandise.image.altText ??
                            line.merchandise.product.title
                          }
                          className="h-12 w-12 rounded-md object-cover"
                          width={48}
                          height={48}
                          sizes="48px"
                        />
                      ) : (
                        <div className="h-12 w-12 rounded-md bg-stone-100" />
                      )}
                      <div className="min-w-0 flex-1">
                        {line.merchandise.product.manufacturer && (
                          <p className="truncate text-[11px] uppercase tracking-wide text-stone-400">
                            {line.merchandise.product.manufacturer}
                          </p>
                        )}
                        <p className="truncate text-sm font-semibold">
                          {line.merchandise.product.title}
                        </p>
                        {line.merchandise.options &&
                          line.merchandise.options.length > 0 && (
                            <p className="truncate text-[11px] text-stone-500">
                              {formatCartOptions(line.merchandise.options)}
                            </p>
                          )}
                        <p className="text-xs text-stone-500">
                          {line.quantity} ×{" "}
                          {formatPrice(
                            line.merchandise.price.amount,
                            line.merchandise.price.currencyCode,
                          )}
                        </p>
                      </div>
                      <div className="text-right text-xs font-semibold text-black/80">
                        {formatPrice(
                          lineTotal,
                          line.merchandise.price.currencyCode,
                        )}
                      </div>
                    </div>
                  );
                })}
                {cart.lines.length > 6 && (
                  <p className="text-xs text-stone-500">
                    + {cart.lines.length - 6} weitere Artikel
                  </p>
                )}
              </div>
            )}
          </div>
          <div className="border-t border-black/10 px-5 py-4 text-sm">
            {!loading && cart && cart.lines.length > 0 && (() => {
              const subtotal = Number(cart.cost.subtotalAmount.amount);
              const currencyCode = cart.cost.subtotalAmount.currencyCode;
              const reached = subtotal >= FREE_SHIPPING_THRESHOLD_EUR;
              const remaining = Math.max(0, FREE_SHIPPING_THRESHOLD_EUR - subtotal);
              const progress = Math.min(
                100,
                Math.round((subtotal / FREE_SHIPPING_THRESHOLD_EUR) * 100),
              );
              return (
                <>
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-xs text-stone-500">Gesamt</span>
                    <span className="text-sm font-semibold text-black/80">
                      {formatPrice(
                        cart.cost.totalAmount.amount,
                        cart.cost.totalAmount.currencyCode,
                      )}
                    </span>
                  </div>
                  <div
                    className={`mb-3 rounded-xl px-3 py-2.5 ${
                      reached
                        ? "border border-emerald-200 bg-emerald-50"
                        : "border border-stone-100 bg-stone-50"
                    }`}
                  >
                    <div
                      className={`flex items-center gap-1.5 text-xs font-semibold ${
                        reached ? "text-emerald-700" : "text-stone-600"
                      }`}
                    >
                      <TruckIcon className="h-3.5 w-3.5 shrink-0" />
                      {reached
                        ? "Kostenloser Versand aktiv!"
                        : `Noch ${formatPrice(remaining.toFixed(2), currencyCode)} bis zur versandkostenfreien Lieferung`}
                    </div>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-stone-200">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                </>
              );
            })()}
            <div className="grid gap-2">
              <Link
                href="/cart"
                className="block w-full rounded-lg border border-black/15 px-4 py-3 text-center text-sm font-semibold text-black/70 hover:border-black/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
              >
                Warenkorb editieren
              </Link>
              <button
                type="button"
                onClick={onStartCheckout}
                disabled={!canCheckout}
                className="block w-full rounded-lg bg-gradient-to-r from-[#14532d] via-[#2f3e36] to-[#0f766e] px-4 py-3 text-center text-sm font-semibold text-white shadow-lg shadow-emerald-900/15 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-emerald-900/25 disabled:cursor-not-allowed disabled:from-stone-300 disabled:via-stone-200 disabled:to-stone-200 disabled:text-stone-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
              >
                {checkoutStatus === "loading" ? "Weiterleitung..." : "Zur Kasse"}
              </button>
              <PaymentMethodLogos
                className="justify-center gap-[2px] sm:gap-2"
                pillClassName="h-7 px-2 border-black/10 bg-white sm:h-8 sm:px-3"
                logoClassName="h-4 sm:h-5"
              />
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
