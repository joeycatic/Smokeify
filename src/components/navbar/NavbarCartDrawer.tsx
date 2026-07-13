"use client";

import Link from "next/link";
import Image from "next/image";
import type React from "react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  MinusIcon,
  PlusIcon,
  TrashIcon,
  TruckIcon,
} from "@heroicons/react/24/outline";
import PaymentMethodLogos from "@/components/PaymentMethodLogos";
import { FREE_SHIPPING_THRESHOLD_EUR } from "@/lib/checkoutPolicy";
import type { Cart } from "@/lib/cart";
import LoadingSpinner from "@/components/LoadingSpinner";
import { CartDrawerSkeleton } from "@/components/storefront/StorefrontSkeletons";
import { useCart } from "@/components/CartProvider";
import {
  getNumberFormatLocale,
  type Language,
} from "@/lib/language";
import {
  getFreeShippingActiveMessage,
  getFreeShippingRemainingMessage,
} from "@/lib/storefrontTrust";
import { reportClientPerfMetric } from "@/lib/clientPerf";

type Props = {
  open: boolean;
  cart: Cart | null;
  loading: boolean;
  error: string | null;
  canCheckout: boolean;
  checkoutStatus: "idle" | "loading" | "error";
  onClose: () => void;
  onStartCheckout: () => void;
  onViewCart?: () => void;
  panelRef?: React.MutableRefObject<HTMLElement | null>;
  language: Language;
};

function formatPrice(
  amount: string,
  currencyCode: string,
  language: Language,
) {
  const value = Number(amount);
  if (!Number.isFinite(value)) return "";
  return new Intl.NumberFormat(getNumberFormatLocale(language), {
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
  onViewCart,
  panelRef,
  language,
}: Props) {
  const { updateLine, removeLines } = useCart();
  const [pendingLineIds, setPendingLineIds] = useState<string[]>([]);
  const copy =
    language === "en"
      ? {
          closeCart: "Close cart",
          checkout: "Checkout",
          cart: "CART",
          close: "Close",
          loading: "Loading cart...",
          empty: "Your cart is empty.",
          moreItems: "more items",
          total: "Total",
          freeShippingActive: getFreeShippingActiveMessage("en"),
          viewCart: "View cart",
          toCheckout: "Checkout",
          redirecting: "Redirecting...",
          guestCheckout: "Guest checkout starts directly. Account is optional.",
        }
      : {
          closeCart: "Warenkorb schließen",
          checkout: "Kasse",
          cart: "WARENKORB",
          close: "Schließen",
          loading: "Warenkorb wird geladen...",
          empty: "Warenkorb ist leer.",
          moreItems: "weitere Artikel",
          total: "Gesamt",
          freeShippingActive: getFreeShippingActiveMessage("de"),
          viewCart: "Zum Warenkorb",
          toCheckout: "Zur Kasse",
          redirecting: "Weiterleitung...",
          guestCheckout: "Gast-Checkout startet direkt. Konto ist optional.",
        };

  const setLinePending = (lineId: string, pending: boolean) => {
    setPendingLineIds((current) =>
      pending
        ? current.includes(lineId)
          ? current
          : [...current, lineId]
        : current.filter((id) => id !== lineId),
    );
  };

  const handleUpdateQuantity = async (lineId: string, quantity: number) => {
    setLinePending(lineId, true);
    try {
      if (quantity <= 0) {
        await removeLines([lineId]);
      } else {
        await updateLine(lineId, quantity);
      }
    } finally {
      setLinePending(lineId, false);
    }
  };

  const handleRemoveLine = async (lineId: string) => {
    setLinePending(lineId, true);
    try {
      await removeLines([lineId]);
    } finally {
      setLinePending(lineId, false);
    }
  };

  useEffect(() => {
    if (!open || typeof document === "undefined") return;
    const startedAt = performance.now();
    document.body.setAttribute("data-cart-open", "true");

    const rafId = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        reportClientPerfMetric(
          "cart_drawer_open",
          performance.now() - startedAt,
          "drawer-open",
        );
      });
    });

    return () => {
      window.cancelAnimationFrame(rafId);
      document.body.removeAttribute("data-cart-open");
    };
  }, [open]);

  if (!open) return null;
  if (typeof document === "undefined") return null;

  return createPortal(
    <div data-cart-overlay-root="true">
      <button
        type="button"
        aria-label={copy.closeCart}
        onClick={onClose}
        className="fixed inset-0 cursor-pointer bg-[color:var(--gv-text)]/45 cart-overlay-fade focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--gv-lime)]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--gv-forest)]"
        style={{ zIndex: "var(--gv-z-cart-overlay)" }}
      />
      <aside
        ref={(node) => {
          if (panelRef) panelRef.current = node;
        }}
        className="cart-slide-in fixed right-0 top-0 flex h-dvh w-full max-w-sm flex-col overflow-hidden border-l border-[color:var(--gv-border)] bg-[color:var(--gv-forest)] text-[color:var(--gv-text)] shadow-[var(--gv-shadow-lg)]"
        style={{
          zIndex: "var(--gv-z-cart-drawer)",
        }}
      >
        <div
          className="flex h-16 items-center justify-between border-b border-[color:var(--gv-border)] bg-[color:var(--gv-dark)] px-5"
        >
          <div>
            <p className="font-[family:var(--font-jetbrains-mono)] text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--gv-lime)]">
              {copy.checkout}
            </p>
            <div className="mt-1 text-sm font-semibold tracking-[0.08em] text-[color:var(--gv-text)]">
              {copy.cart}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-[color:var(--gv-border)] bg-[color:var(--gv-surface)] text-lg text-[color:var(--gv-text-muted)] hover:border-[color:var(--gv-lime)]/40 hover:text-[color:var(--gv-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--gv-lime)]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--gv-forest)]"
            aria-label={copy.close}
          >
            ×
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col bg-[color:var(--gv-forest)]">
          <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-5 py-4 text-sm">
            {error ? (
              <div className="rounded-[18px] border border-[color:var(--gv-error)]/30 bg-[color:var(--gv-error)]/10 px-3 py-2 text-xs text-[color:var(--gv-error)]">
                <p>{error}</p>
              </div>
            ) : loading ? (
              <div>
                <div className="mb-3 flex items-center gap-2 text-[color:var(--gv-text-muted)]">
                  <LoadingSpinner
                    size="sm"
                    className="border-[color:var(--gv-border)] border-t-[color:var(--gv-lime)]"
                  />
                  <span>{copy.loading}</span>
                </div>
                <CartDrawerSkeleton />
              </div>
            ) : !cart || cart.lines.length === 0 ? (
              <div className="rounded-[22px] border border-[color:var(--gv-border)] bg-[color:var(--gv-surface)] px-4 py-4 text-[color:var(--gv-text-muted)]">
                {copy.empty}
              </div>
            ) : (
              <div className="space-y-3">
                {cart.lines.map((line) => {
                  const isPending = pendingLineIds.includes(line.id);
                  const lineTotal = (
                    Number(line.merchandise.price.amount) * line.quantity
                  ).toFixed(2);
                  return (
                    <div
                      key={line.id}
                      aria-busy={isPending}
                      className={`rounded-[22px] border border-[color:var(--gv-border)] bg-[color:var(--gv-dark)] px-3 py-3 transition-opacity ${
                        isPending
                          ? "pointer-events-none opacity-70"
                          : "opacity-100"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {line.merchandise.image?.url ? (
                          <Image
                            src={line.merchandise.image.url}
                            alt={
                              line.merchandise.image.altText ??
                              line.merchandise.product.title
                            }
                            className="h-12 w-12 rounded-2xl object-cover"
                            width={48}
                            height={48}
                            sizes="48px"
                          />
                        ) : (
                          <div className="h-12 w-12 rounded-2xl bg-[color:var(--gv-surface)]" />
                        )}
                        <div className="min-w-0 flex-1">
                          {line.merchandise.product.manufacturer && (
                            <p className="truncate text-[11px] uppercase tracking-[0.18em] text-[color:var(--gv-text-muted)]">
                              {line.merchandise.product.manufacturer}
                            </p>
                          )}
                          <p className="truncate text-sm font-semibold text-[color:var(--gv-text)]">
                            {line.merchandise.product.title}
                          </p>
                          {line.merchandise.options &&
                            line.merchandise.options.length > 0 && (
                              <p className="truncate text-[11px] text-[color:var(--gv-text-muted)]">
                                {formatCartOptions(line.merchandise.options)}
                              </p>
                            )}
                          <p className="text-xs text-[color:var(--gv-text-muted)]">
                            {formatPrice(
                              line.merchandise.price.amount,
                              line.merchandise.price.currencyCode,
                              language,
                            )}{" "}
                            je Stück
                          </p>
                        </div>
                        <div className="text-right text-xs font-semibold text-[color:var(--gv-text)]">
                          {formatPrice(
                            lineTotal,
                            line.merchandise.price.currencyCode,
                            language,
                          )}
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-3 border-t border-[color:var(--gv-border)] pt-3">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              void handleUpdateQuantity(line.id, line.quantity - 1)
                            }
                            disabled={isPending}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-[color:var(--gv-border)] bg-[color:var(--gv-surface)] text-[color:var(--gv-text)] transition hover:border-[color:var(--gv-lime)]/35 hover:text-[color:var(--gv-lime)] disabled:cursor-wait disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--gv-lime)]/35 focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--gv-forest)]"
                            aria-label="Menge verringern"
                          >
                            <MinusIcon className="h-4 w-4" />
                          </button>
                          <span className="min-w-6 text-center text-sm font-semibold text-[color:var(--gv-text)]">
                            {line.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              void handleUpdateQuantity(line.id, line.quantity + 1)
                            }
                            disabled={isPending}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-[color:var(--gv-border)] bg-[color:var(--gv-surface)] text-[color:var(--gv-text)] transition hover:border-[color:var(--gv-lime)]/35 hover:text-[color:var(--gv-lime)] disabled:cursor-wait disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--gv-lime)]/35 focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--gv-forest)]"
                            aria-label="Menge erhöhen"
                          >
                            <PlusIcon className="h-4 w-4" />
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleRemoveLine(line.id)}
                          disabled={isPending}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-[color:var(--gv-error)]/35 bg-[color:var(--gv-error)]/10 text-[color:var(--gv-error)] transition hover:border-[color:var(--gv-error)]/55 hover:bg-[color:var(--gv-error)]/15 disabled:cursor-wait disabled:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--gv-error)]/35 focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--gv-forest)]"
                          aria-label={isPending ? "Artikel wird entfernt" : "Artikel entfernen"}
                        >
                          {isPending ? (
                            <LoadingSpinner
                              size="sm"
                              className="border-[color:var(--gv-error)]/25 border-t-[color:var(--gv-error)]"
                            />
                          ) : (
                            <TrashIcon className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div className="border-t border-[color:var(--gv-border)] bg-[color:var(--gv-dark)] px-5 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4 text-sm">
            {!loading && cart && cart.lines.length > 0
              ? (() => {
                  const subtotal = Number(cart.cost.subtotalAmount.amount);
                  const total = Number(cart.cost.totalAmount.amount);
                  const currencyCode = cart.cost.subtotalAmount.currencyCode;
                  const reached = subtotal >= FREE_SHIPPING_THRESHOLD_EUR;
                  const remaining = Math.max(
                    0,
                    FREE_SHIPPING_THRESHOLD_EUR - subtotal,
                  );
                  const progress = Math.min(
                    100,
                    Math.round((subtotal / FREE_SHIPPING_THRESHOLD_EUR) * 100),
                  );

                  return (
                    <>
                      <div className="mb-3 rounded-[24px] border border-[color:var(--gv-border)] bg-[color:var(--gv-surface)] px-3 py-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-[color:var(--gv-text-muted)]">
                            {copy.total}
                          </span>
                          <span
                            className="text-sm font-semibold text-[color:var(--gv-text)]"
                          >
                            {formatPrice(total.toFixed(2), currencyCode, language)}
                          </span>
                        </div>
                      </div>
                      <div
                        className={`mb-3 rounded-[24px] px-3 py-2.5 ${
                          reached
                            ? "border border-[color:var(--gv-success)]/30 bg-[color:var(--gv-success)]/10"
                            : "border border-[color:var(--gv-border)] bg-[color:var(--gv-surface)]"
                        }`}
                      >
                        <div
                          className={`flex items-center gap-1.5 text-xs font-semibold ${
                            reached
                              ? "text-[color:var(--gv-success)]"
                              : "text-[color:var(--gv-text-muted)]"
                          }`}
                        >
                          <TruckIcon className="h-3.5 w-3.5 shrink-0" />
                          {reached
                            ? copy.freeShippingActive
                            : getFreeShippingRemainingMessage(
                                formatPrice(
                                  remaining.toFixed(2),
                                  currencyCode,
                                  language,
                                ),
                                language,
                              )}
                        </div>
                        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[color:var(--gv-border)]">
                          <div
                            className="h-full rounded-full bg-[color:var(--gv-lime)] transition-all duration-500"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    </>
                  );
                })()
              : null}
            <div className="grid gap-2">
              <Link
                href="/cart"
                onClick={onViewCart}
                className="block w-full rounded-full border border-[color:var(--gv-lime)]/50 bg-[color:var(--gv-lime)]/6 px-4 py-3 text-center text-sm font-semibold text-[color:var(--gv-text)] shadow-[inset_0_0_0_1px_rgba(31,95,63,0.08)] transition hover:border-[color:var(--gv-lime)]/75 hover:bg-[color:var(--gv-lime)]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--gv-lime)]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--gv-forest)]"
              >
                {copy.viewCart}
              </Link>
              <button
                type="button"
                onClick={onStartCheckout}
                disabled={!canCheckout}
                className="block w-full rounded-full bg-[color:var(--gv-lime)] px-4 py-3 text-center text-sm font-semibold text-[color:var(--gv-forest)] shadow-lg shadow-[color:var(--gv-lime)]/10 transition-all duration-200 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:bg-[color:var(--gv-muted)] disabled:text-[color:var(--gv-text-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--gv-lime)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--gv-forest)]"
              >
                {checkoutStatus === "loading"
                  ? copy.redirecting
                  : copy.toCheckout}
              </button>
              <p className="text-center text-xs leading-5 text-[color:var(--gv-text-muted)]">
                {copy.guestCheckout}
              </p>
              <PaymentMethodLogos
                className="mt-2 justify-center gap-[2px] sm:gap-2"
                pillClassName="h-7 border-[color:var(--gv-border)] bg-[color:var(--gv-dark)] px-2 sm:h-8 sm:px-3"
                logoClassName="h-4 sm:h-5"
              />
            </div>
          </div>
        </div>
      </aside>
    </div>,
    document.body,
  );
}
