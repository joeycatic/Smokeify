"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { buildOrderFinanceBreakdown } from "@/lib/adminFinance";
import { buildOrderCustomerCopyText, getOrderCustomerEmail } from "@/lib/adminOrderCustomer";
import { getRefundPreviewAmount } from "@/lib/adminRefundCalculator";
import { formatOrderSourceLabel } from "@/lib/orderSource";
import type { AdminOrderDetail, AdminOrderItemRecord, AdminOrderRecord } from "@/lib/adminOrders";

type Props = {
  detail: AdminOrderDetail;
};

const ORDER_BADGE_BASE =
  "inline-flex items-center rounded-full border px-3 py-1.5 text-[11px] font-medium leading-none whitespace-nowrap";
const PANEL_CLASS =
  "rounded-[28px] border border-white/10 bg-[#0b1118] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.24)]";
const SUBPANEL_CLASS = "rounded-2xl border border-white/10 bg-white/[0.03]";
const INPUT_CLASS =
  "h-11 w-full rounded-xl border border-white/10 bg-[#08111d] px-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-400/30";
const PRIMARY_BUTTON_CLASS =
  "inline-flex h-10 items-center rounded-xl bg-cyan-500 px-4 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:bg-cyan-900 disabled:text-cyan-100";
const SECONDARY_BUTTON_CLASS =
  "inline-flex h-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-slate-100 transition hover:border-white/20 hover:bg-white/[0.08]";
const STAT_CARD_CLASS = "rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4";

const PAID_PAYMENT_STATUSES = new Set([
  "paid",
  "succeeded",
  "refunded",
  "partially_refunded",
]);
const formatPrice = (amount: number, currency: string) =>
  new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount / 100);

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
  });

const normalizeStatus = (value: string) => value.trim().toLowerCase();

const getOrderStatusBadgeClass = (status: string) => {
  const normalizedStatus = normalizeStatus(status);
  if (normalizedStatus === "fulfilled") {
    return `${ORDER_BADGE_BASE} border-emerald-400/25 bg-emerald-400/12 text-emerald-200`;
  }
  if (["canceled", "cancelled", "failed", "refunded"].includes(normalizedStatus)) {
    return `${ORDER_BADGE_BASE} border-slate-400/20 bg-slate-400/10 text-slate-200`;
  }
  return `${ORDER_BADGE_BASE} border-sky-400/25 bg-sky-400/12 text-sky-200`;
};

const getPaymentBadgeClass = (paymentStatus: string) => {
  const normalizedStatus = normalizeStatus(paymentStatus);
  if (PAID_PAYMENT_STATUSES.has(normalizedStatus)) {
    return `${ORDER_BADGE_BASE} border-amber-400/25 bg-amber-400/12 text-amber-200`;
  }
  if (["failed", "canceled", "cancelled"].includes(normalizedStatus)) {
    return `${ORDER_BADGE_BASE} border-rose-400/25 bg-rose-400/12 text-rose-200`;
  }
  return `${ORDER_BADGE_BASE} border-slate-400/20 bg-slate-400/10 text-slate-200`;
};

const formatOrderItemName = (name: string, manufacturer?: string | null) => {
  const defaultSuffix = /\s*[-—]\s*Default( Title)?(?=\s*\(|$)/i;
  if (!defaultSuffix.test(name)) return name;
  const trimmedManufacturer = manufacturer?.trim();
  if (trimmedManufacturer) {
    return name.replace(defaultSuffix, ` - ${trimmedManufacturer}`);
  }
  return name.replace(defaultSuffix, "").trim();
};

const formatItemOptions = (options?: Array<{ name: string; value: string }>) => {
  if (!options?.length) return "";
  return options
    .map((opt) => `${opt.name}: ${opt.value}`)
    .filter(Boolean)
    .join(" · ");
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const buildShippingLines = (order: AdminOrderRecord) => {
  const lines = [
    order.shippingName,
    order.shippingLine1,
    order.shippingLine2,
    [order.shippingPostalCode, order.shippingCity].filter(Boolean).join(" "),
    order.shippingCountry,
  ];
  return lines.filter((line) => Boolean(line?.trim())) as string[];
};

const getOrderSourceLabel = (
  order: Pick<AdminOrderRecord, "sourceStorefront" | "sourceHost" | "sourceOrigin">,
) => formatOrderSourceLabel(order.sourceStorefront, order.sourceHost, order.sourceOrigin);

export default function AdminOrderDetailClient({ detail }: Props) {
  const [order, setOrder] = useState(detail.order);
  const [statusDraft, setStatusDraft] = useState(detail.order.status);
  const [trackingDraft, setTrackingDraft] = useState({
    carrier: detail.order.trackingCarrier ?? "",
    number: detail.order.trackingNumber ?? "",
    url: detail.order.trackingUrl ?? "",
  });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [sendingEmail, setSendingEmail] = useState<"confirmation" | "shipping" | "refund" | null>(
    null,
  );
  const [refundSelection, setRefundSelection] = useState<Record<string, number>>({});
  const [refundIncludeShipping, setRefundIncludeShipping] = useState(false);
  const [refundPassword, setRefundPassword] = useState("");
  const [refundPasswordError, setRefundPasswordError] = useState("");
  const [refundMode, setRefundMode] = useState<"full" | "items" | null>(null);
  const [refunding, setRefunding] = useState(false);
  const [copiedCustomerField, setCopiedCustomerField] = useState<"email" | "customer" | null>(
    null,
  );

  const financeBreakdown = useMemo(
    () => buildOrderFinanceBreakdown({ ...order, createdAt: new Date(order.createdAt) }),
    [order],
  );
  const shippingLines = useMemo(() => buildShippingLines(order), [order]);
  const timeline = useMemo(
    () =>
      [
        { label: "Order created", at: order.createdAt },
        {
          label: "Confirmation email sent",
          at: order.confirmationEmailSentAt ?? undefined,
        },
        {
          label: "Shipping email sent",
          at: order.shippingEmailSentAt ?? undefined,
        },
        {
          label: "Refund email sent",
          at: order.refundEmailSentAt ?? undefined,
        },
        { label: "Last updated", at: order.updatedAt },
      ].filter((entry) => Boolean(entry.at)) as Array<{ label: string; at: string }>,
    [order],
  );

  const refundPreviewAmount = useMemo(() => {
    if (!refundMode) return 0;
    return getRefundPreviewAmount(order, refundMode, refundSelection, refundIncludeShipping);
  }, [order, refundIncludeShipping, refundMode, refundSelection]);

  const selectedRefundItemCount = useMemo(
    () => Object.values(refundSelection).filter((value) => value > 0).length,
    [refundSelection],
  );
  const customerEmail = useMemo(() => getOrderCustomerEmail(order), [order]);
  const customerCopyText = useMemo(() => buildOrderCustomerCopyText(order), [order]);

  const copyCustomerValue = async (
    field: "email" | "customer",
    label: string,
    value: string,
  ) => {
    const normalizedValue = value.trim();
    if (!normalizedValue) {
      setError(`No ${label.toLowerCase()} available to copy.`);
      return;
    }
    try {
      await navigator.clipboard.writeText(normalizedValue);
      setCopiedCustomerField(field);
      window.setTimeout(() => {
        setCopiedCustomerField((current) => (current === field ? null : current));
      }, 1800);
    } catch {
      setError(`Failed to copy ${label.toLowerCase()}.`);
    }
  };

  const updateOrderState = (nextOrder: Partial<AdminOrderRecord>) => {
    setOrder((current) => ({ ...current, ...nextOrder }));
    if (typeof nextOrder.status === "string") {
      setStatusDraft(nextOrder.status);
    }
    setTrackingDraft((current) => ({
      carrier: nextOrder.trackingCarrier ?? current.carrier,
      number: nextOrder.trackingNumber ?? current.number,
      url: nextOrder.trackingUrl ?? current.url,
    }));
  };

  const saveOrder = async () => {
    setError("");
    setNotice("");
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: statusDraft,
          trackingCarrier: trackingDraft.carrier || undefined,
          trackingNumber: trackingDraft.number || undefined,
          trackingUrl: trackingDraft.url || undefined,
          expectedUpdatedAt: order.updatedAt,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        currentUpdatedAt?: string;
        order?: Partial<AdminOrderRecord>;
      };
      if (!response.ok) {
        if (data.currentUpdatedAt) {
          setOrder((current) => ({ ...current, updatedAt: data.currentUpdatedAt! }));
        }
        setError(data.error ?? "Failed to save order.");
        return;
      }
      updateOrderState(
        data.order ?? {
          status: statusDraft,
          trackingCarrier: trackingDraft.carrier || null,
          trackingNumber: trackingDraft.number || null,
          trackingUrl: trackingDraft.url || null,
          updatedAt: new Date().toISOString(),
        },
      );
      setNotice("Order workspace updated.");
    } catch {
      setError("Failed to save order.");
    } finally {
      setSaving(false);
    }
  };

  const sendEmail = async (type: "confirmation" | "shipping" | "refund") => {
    setError("");
    setNotice("");
    setSendingEmail(type);
    try {
      const response = await fetch(`/api/admin/orders/${order.id}/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? `Failed to send ${type} email.`);
        return;
      }
      const now = new Date().toISOString();
      updateOrderState(
        type === "confirmation"
          ? { confirmationEmailSentAt: now }
          : type === "shipping"
            ? { shippingEmailSentAt: now }
            : { refundEmailSentAt: now },
      );
      setNotice(`${type[0]?.toUpperCase() ?? ""}${type.slice(1)} email sent.`);
    } catch {
      setError(`Failed to send ${type} email.`);
    } finally {
      setSendingEmail(null);
    }
  };

  const confirmRefund = async () => {
    if (!refundMode) return;
    const adminPassword = refundPassword.trim();
    if (!adminPassword) {
      setRefundPasswordError("Admin password is required.");
      return;
    }

    const items =
      refundMode === "items"
        ? order.items
            .map((item) => ({
              id: item.id,
              quantity: refundSelection[item.id] ?? 0,
            }))
            .filter((item) => item.quantity > 0)
        : [];

    if (refundMode === "items" && items.length === 0) {
      setRefundPasswordError("Select at least one item to refund.");
      return;
    }

    setError("");
    setNotice("");
    setRefunding(true);
    try {
      const response = await fetch(`/api/admin/orders/${order.id}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminPassword,
          includeShipping: refundIncludeShipping,
          ...(refundMode === "items" ? { items } : {}),
        }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        order?: Partial<AdminOrderRecord>;
      };
      if (!response.ok) {
        setRefundPasswordError(data.error ?? "Refund failed.");
        return;
      }
      if (data.order) {
        updateOrderState(data.order);
      }
      setRefundSelection({});
      setRefundPassword("");
      setRefundPasswordError("");
      setRefundIncludeShipping(false);
      setRefundMode(null);
      setNotice("Refund processed.");
    } catch {
      setRefundPasswordError("Refund failed.");
    } finally {
      setRefunding(false);
    }
  };

  const getItemHref = (item: AdminOrderItemRecord) =>
    item.productId ? `/admin/catalog/${item.productId}` : null;

  return (
    <div className="space-y-6 text-slate-100">
      <section className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[#07101a] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.32)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.16),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(129,140,248,0.18),_transparent_28%),linear-gradient(135deg,_rgba(7,16,26,0.98),_rgba(10,20,34,0.94))]" />
        <div className="relative">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-cyan-200/70">
              Admin / Orders / Detail
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Link
                href="/admin/orders"
                className="inline-flex h-9 items-center rounded-full border border-white/10 bg-white/[0.05] px-4 text-xs font-semibold text-slate-200 transition hover:border-white/20 hover:bg-white/[0.08]"
              >
                Back to orders
              </Link>
              <h1 className="text-3xl font-semibold text-white">
                Order #{order.orderNumber}
              </h1>
              <span className={`${ORDER_BADGE_BASE} border-cyan-400/25 bg-cyan-400/12 text-cyan-200`}>
                {getOrderSourceLabel(order)}
              </span>
              <span className={getOrderStatusBadgeClass(order.status)}>{order.status}</span>
              <span className={getPaymentBadgeClass(order.paymentStatus)}>
                {order.paymentStatus}
              </span>
            </div>
            <p className="mt-3 text-sm text-slate-300">
              {order.user.name ?? order.shippingName ?? "Unknown customer"} ·{" "}
              {order.user.email ?? order.customerEmail ?? "No email"} ·{" "}
              {getOrderSourceLabel(order)} · created {formatDateTime(order.createdAt)}
            </p>
          </div>
          <div className="rounded-[24px] border border-white/10 bg-[#08111d] px-5 py-5 text-right">
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
              Net collected
            </div>
            <div className="mt-2 text-2xl font-semibold text-white">
              {formatPrice(financeBreakdown.netCollectedGrossCents, order.currency)}
            </div>
            <div className="mt-1 text-sm text-slate-400">
              Refunded {formatPrice(order.amountRefunded, order.currency)}
            </div>
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className={STAT_CARD_CLASS}>
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
              Gross order
            </div>
            <div className="mt-2 text-xl font-semibold text-white">
              {formatPrice(financeBreakdown.grossOrderCents, order.currency)}
            </div>
            <div className="mt-1 text-xs text-slate-400">{order.items.length} line items</div>
          </div>
          <div className={STAT_CARD_CLASS}>
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
              Net revenue
            </div>
            <div className="mt-2 text-xl font-semibold text-white">
              {formatPrice(financeBreakdown.netRevenueCents, order.currency)}
            </div>
            <div className="mt-1 text-xs text-slate-400">after VAT and refunds</div>
          </div>
          <div className={STAT_CARD_CLASS}>
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
              Contribution
            </div>
            <div className="mt-2 text-xl font-semibold text-white">
              {formatPrice(financeBreakdown.contributionMarginCents, order.currency)}
            </div>
            <div className="mt-1 text-xs text-slate-400">after fees and COGS</div>
          </div>
          <div className={STAT_CARD_CLASS}>
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
              Updated
            </div>
            <div className="mt-2 text-base font-semibold text-white">
              {formatDateTime(order.updatedAt)}
            </div>
            <div className="mt-1 text-xs text-slate-400">{order.paymentMethod ?? "No payment method stored"}</div>
          </div>
        </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
          {notice}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_380px]">
        <div className="space-y-6">
          <section className={PANEL_CLASS}>
            <div className="mb-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                Fulfillment controls
              </p>
              <h2 className="mt-2 text-lg font-semibold text-white">
                Status and tracking
              </h2>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-2 text-sm text-slate-400">
                <span className="font-medium text-slate-100">Order status</span>
                <input
                  type="text"
                  value={statusDraft}
                  onChange={(event) => setStatusDraft(event.target.value)}
                  className={INPUT_CLASS}
                />
              </label>
              <label className="space-y-2 text-sm text-slate-400">
                <span className="font-medium text-slate-100">Tracking carrier</span>
                <input
                  type="text"
                  value={trackingDraft.carrier}
                  onChange={(event) =>
                    setTrackingDraft((current) => ({ ...current, carrier: event.target.value }))
                  }
                  className={INPUT_CLASS}
                />
              </label>
              <label className="space-y-2 text-sm text-slate-400">
                <span className="font-medium text-slate-100">Tracking number</span>
                <input
                  type="text"
                  value={trackingDraft.number}
                  onChange={(event) =>
                    setTrackingDraft((current) => ({ ...current, number: event.target.value }))
                  }
                  className={INPUT_CLASS}
                />
              </label>
              <label className="space-y-2 text-sm text-slate-400">
                <span className="font-medium text-slate-100">Tracking URL</span>
                <input
                  type="url"
                  value={trackingDraft.url}
                  onChange={(event) =>
                    setTrackingDraft((current) => ({ ...current, url: event.target.value }))
                  }
                  className={INPUT_CLASS}
                />
              </label>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-slate-400">
                Payment state stays backend-authoritative. This workspace only edits fulfillment
                and tracking fields.
              </p>
              <button
                type="button"
                onClick={saveOrder}
                disabled={saving}
                className={PRIMARY_BUTTON_CLASS}
              >
                {saving ? "Saving..." : "Save order changes"}
              </button>
            </div>
          </section>

          <section className={PANEL_CLASS}>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                  Items and refunds
                </p>
                <h2 className="mt-2 text-lg font-semibold text-white">
                  Refund preview workspace
                </h2>
              </div>
              <div className="text-right">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Preview</div>
                <div className="mt-1 text-lg font-semibold text-white">
                  {formatPrice(refundPreviewAmount, order.currency)}
                </div>
              </div>
            </div>
            <div className="space-y-3">
              {order.items.map((item) => {
                const itemHref = getItemHref(item);
                const selectedQty = refundSelection[item.id] ?? 0;
                const itemName = formatOrderItemName(item.name, item.manufacturer);
                return (
                  <div
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <input
                        type="checkbox"
                        checked={selectedQty > 0}
                        onChange={(event) =>
                          setRefundSelection((current) => ({
                            ...current,
                            [item.id]: event.target.checked ? 1 : 0,
                          }))
                        }
                      />
                      {item.imageUrl ? (
                        <Image
                          src={item.imageUrl}
                          alt={itemName}
                          width={44}
                          height={44}
                          className="rounded-xl border border-white/10 object-cover"
                        />
                      ) : (
                        <div className="h-11 w-11 rounded-xl border border-white/10 bg-[#08111d]" />
                      )}
                      <div className="min-w-0">
                        {itemHref ? (
                          <Link
                            href={itemHref}
                            className="font-semibold text-white underline-offset-2 hover:text-cyan-200 hover:underline"
                          >
                            {itemName}
                          </Link>
                        ) : (
                          <p className="font-semibold text-white">{itemName}</p>
                        )}
                        {item.options?.length ? (
                          <p className="text-xs text-slate-400">{formatItemOptions(item.options)}</p>
                        ) : null}
                        <p className="text-xs text-slate-400">
                          Qty {item.quantity} · Line total {formatPrice(item.totalAmount, item.currency)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        min={0}
                        max={item.quantity}
                        value={selectedQty}
                        onChange={(event) =>
                          setRefundSelection((current) => ({
                            ...current,
                            [item.id]: clamp(Number(event.target.value), 0, item.quantity),
                          }))
                        }
                        className="h-10 w-16 rounded-xl border border-white/10 bg-[#08111d] px-2 text-center text-sm text-white outline-none focus:border-cyan-400/30"
                      />
                      <div className="w-24 text-right text-sm font-semibold text-white">
                        {formatPrice(item.totalAmount, item.currency)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3">
              <label className="inline-flex items-center gap-2 text-sm text-rose-100">
                <input
                  type="checkbox"
                  checked={refundIncludeShipping}
                  onChange={(event) => setRefundIncludeShipping(event.target.checked)}
                />
                Include shipping in refund
              </label>
              <button
                type="button"
                onClick={() => {
                  setRefundPassword("");
                  setRefundPasswordError("");
                  setRefundMode("items");
                }}
                className="inline-flex h-10 items-center rounded-xl border border-rose-300/30 bg-white/[0.08] px-4 text-sm font-semibold text-rose-100 transition hover:border-rose-200/40 hover:bg-white/[0.12]"
              >
                Refund selected items ({selectedRefundItemCount})
              </button>
              <button
                type="button"
                onClick={() => {
                  setRefundPassword("");
                  setRefundPasswordError("");
                  setRefundMode("full");
                }}
                className="inline-flex h-10 items-center rounded-xl border border-red-300/30 bg-red-500/20 px-4 text-sm font-semibold text-red-100 transition hover:border-red-200/40 hover:bg-red-500/25"
              >
                Full refund
              </button>
            </div>
          </section>
          <section className="grid gap-6 lg:grid-cols-2">
            <section className={PANEL_CLASS}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                Shipping
              </p>
              <h2 className="mt-2 text-lg font-semibold text-white">Customer and address</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void copyCustomerValue("email", "Email", customerEmail)}
                  className={SECONDARY_BUTTON_CLASS}
                >
                  {copiedCustomerField === "email" ? "Copied email" : "Copy email"}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    void copyCustomerValue("customer", "Customer details", customerCopyText)
                  }
                  className="inline-flex h-10 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-4 text-sm font-semibold text-cyan-100 transition hover:border-cyan-300/30 hover:bg-cyan-400/15"
                >
                  {copiedCustomerField === "customer" ? "Copied customer" : "Copy customer"}
                </button>
              </div>
              <div className="mt-4 space-y-3 text-sm">
                <InfoRow label="Customer email" value={customerEmail || "—"} />
                <InfoRow label="Website" value={getOrderSourceLabel(order)} />
                <InfoRow label="Source host" value={order.sourceHost ?? "—"} />
                <InfoRow label="Payment method" value={order.paymentMethod ?? "—"} />
                <InfoRow label="Discount code" value={order.discountCode ?? "—"} />
              </div>
              <div className={`${SUBPANEL_CLASS} mt-4 px-4 py-4 text-sm text-slate-200`}>
                {shippingLines.length ? (
                  shippingLines.map((line) => <div key={line}>{line}</div>)
                ) : (
                  <div className="text-slate-400">No shipping address stored.</div>
                )}
              </div>
            </section>

            <section className={PANEL_CLASS}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                Timeline
              </p>
              <h2 className="mt-2 text-lg font-semibold text-white">Order events</h2>
              <ol className="mt-4 space-y-3">
                {timeline.map((entry) => (
                  <li
                    key={`${entry.label}-${entry.at}`}
                    className={`${SUBPANEL_CLASS} px-4 py-3`}
                  >
                    <div className="text-sm font-semibold text-white">{entry.label}</div>
                    <div className="mt-1 text-xs text-slate-400">{formatDateTime(entry.at)}</div>
                  </li>
                ))}
              </ol>
            </section>
          </section>

          <section className={PANEL_CLASS}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
              Audit
            </p>
            <h2 className="mt-2 text-lg font-semibold text-white">Admin and timeline audit</h2>
            <div className="mt-4 space-y-3">
              {detail.auditLogs.length ? (
                detail.auditLogs.map((entry) => (
                  <div
                    key={entry.id}
                    className={`${SUBPANEL_CLASS} px-4 py-3`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm font-semibold text-white">
                        {entry.summary ?? entry.action}
                      </div>
                      <div className="text-xs text-slate-400">{formatDateTime(entry.createdAt)}</div>
                    </div>
                    <div className="mt-1 text-xs text-slate-400">
                      {entry.actorEmail ?? "System"} · {entry.action}
                    </div>
                  </div>
                ))
              ) : (
                <div className={`${SUBPANEL_CLASS} px-4 py-6 text-sm text-slate-400`}>
                  No order audit entries yet.
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="space-y-6 xl:sticky xl:top-6 xl:self-start">
          <section className={PANEL_CLASS}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
              Finance
            </p>
            <h2 className="mt-2 text-lg font-semibold text-white">Payment breakdown</h2>
            <div className="mt-4 space-y-3 text-sm">
              <InfoRow label="Gross order" value={formatPrice(financeBreakdown.grossOrderCents, order.currency)} />
              <InfoRow label="Refunded gross" value={formatPrice(financeBreakdown.refundedGrossCents, order.currency)} />
              <InfoRow label="Output VAT" value={formatPrice(financeBreakdown.outputVatCents, order.currency)} />
              <InfoRow label="Net revenue" value={formatPrice(financeBreakdown.netRevenueCents, order.currency)} />
              <InfoRow label="COGS" value={formatPrice(financeBreakdown.cogsCents, order.currency)} />
              <InfoRow label="Payment fees" value={formatPrice(financeBreakdown.paymentFeesCents, order.currency)} />
              <InfoRow
                label="Contribution margin"
                value={formatPrice(financeBreakdown.contributionMarginCents, order.currency)}
              />
            </div>
          </section>

          <section className={PANEL_CLASS}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
              Customer comms
            </p>
            <h2 className="mt-2 text-lg font-semibold text-white">Email actions</h2>
            <div className="mt-4 grid gap-2">
              <button
                type="button"
                onClick={() => sendEmail("confirmation")}
                disabled={sendingEmail !== null}
                className={SECONDARY_BUTTON_CLASS}
              >
                {sendingEmail === "confirmation" ? "Sending..." : "Send confirmation"}
              </button>
              <button
                type="button"
                onClick={() => sendEmail("shipping")}
                disabled={sendingEmail !== null}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-sky-400/20 bg-sky-400/10 px-4 text-sm font-semibold text-sky-100 transition hover:border-sky-300/30 hover:bg-sky-400/15 disabled:cursor-not-allowed disabled:border-sky-400/10 disabled:text-sky-200/50"
              >
                {sendingEmail === "shipping" ? "Sending..." : "Send shipping"}
              </button>
              <button
                type="button"
                onClick={() => sendEmail("refund")}
                disabled={sendingEmail !== null}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 text-sm font-semibold text-rose-100 transition hover:border-rose-300/30 hover:bg-rose-400/15 disabled:cursor-not-allowed disabled:border-rose-400/10 disabled:text-rose-200/50"
              >
                {sendingEmail === "refund" ? "Sending..." : "Send refund"}
              </button>
              <a
                href={`/api/orders/${order.id}/invoice`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-10 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 text-sm font-semibold text-emerald-100 transition hover:border-emerald-300/30 hover:bg-emerald-400/15"
              >
                Open invoice
              </a>
            </div>
          </section>
          <section className={PANEL_CLASS}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
              Returns
            </p>
            <h2 className="mt-2 text-lg font-semibold text-white">Linked return requests</h2>
            <div className="mt-4 space-y-3">
              {detail.returnRequests.length ? (
                detail.returnRequests.map((request) => (
                  <div
                    key={request.id}
                    className={`${SUBPANEL_CLASS} px-4 py-3`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-white">{request.status}</div>
                      <Link
                        href="/admin/returns"
                        className="text-xs font-semibold text-cyan-200 underline-offset-2 hover:text-cyan-100 hover:underline"
                      >
                        Open returns
                      </Link>
                    </div>
                    <div className="mt-1 text-xs text-slate-400">
                      {request.requestedResolution} · {formatDateTime(request.createdAt)}
                    </div>
                    <p className="mt-2 text-sm text-slate-200">{request.reason}</p>
                    {request.items.length ? (
                      <div className="mt-2 text-xs text-slate-400">
                        {request.items.map((item) => `${item.orderItemName} x${item.quantity}`).join(" · ")}
                      </div>
                    ) : null}
                  </div>
                ))
              ) : (
                <div className={`${SUBPANEL_CLASS} px-4 py-6 text-sm text-slate-400`}>
                  No return requests linked to this order.
                </div>
              )}
            </div>
          </section>

          <section className={PANEL_CLASS}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
              Webhooks
            </p>
            <h2 className="mt-2 text-lg font-semibold text-white">Recent failed webhook context</h2>
            <div className="mt-4 space-y-3">
              {detail.webhookFailures.length ? (
                detail.webhookFailures.map((event) => (
                  <div
                    key={event.id}
                    className={`${SUBPANEL_CLASS} px-4 py-3`}
                  >
                    <div className="text-sm font-semibold text-white">{event.type}</div>
                    <div className="mt-1 text-xs text-slate-400">
                      {event.eventId} · {formatDateTime(event.createdAt)}
                    </div>
                  </div>
                ))
              ) : (
                <div className={`${SUBPANEL_CLASS} px-4 py-6 text-sm text-slate-400`}>
                  No failed webhook events in the recent queue.
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

      {refundMode ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setRefundMode(null)}
            aria-label="Close refund dialog"
          />
          <div className="relative w-full max-w-md rounded-[28px] border border-white/10 bg-[#08111d] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.42)]">
            <h3 className="text-lg font-semibold text-white">Confirm refund</h3>
            <p className="mt-2 text-sm text-slate-300">
              Refunds are irreversible and remain Stripe-authoritative. Review the preview before
              proceeding.
            </p>
            <div className={`${SUBPANEL_CLASS} mt-4 px-4 py-3`}>
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                Preview
              </div>
              <div className="mt-2 text-xl font-semibold text-white">
                {formatPrice(refundPreviewAmount, order.currency)}
              </div>
              <div className="mt-1 text-xs text-slate-400">
                {refundMode === "items"
                  ? `${selectedRefundItemCount} item line(s) selected`
                  : "Full-order refund preview"}
              </div>
            </div>
            <input
              type="password"
              value={refundPassword}
              onChange={(event) => {
                setRefundPassword(event.target.value);
                if (refundPasswordError) setRefundPasswordError("");
              }}
              placeholder="Admin password"
              className={`${INPUT_CLASS} mt-4`}
            />
            {refundPasswordError ? (
              <p className="mt-2 text-xs text-rose-300">{refundPasswordError}</p>
            ) : null}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRefundMode(null)}
                className={SECONDARY_BUTTON_CLASS}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmRefund}
                disabled={refunding}
                className="inline-flex h-10 items-center rounded-xl bg-red-500 px-4 text-sm font-semibold text-white transition hover:bg-red-400 disabled:cursor-not-allowed disabled:bg-red-900 disabled:text-red-100"
              >
                {refunding ? "Refunding..." : "Process refund"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className={`${SUBPANEL_CLASS} flex items-center justify-between gap-4 px-4 py-3`}>
      <span className="text-sm text-slate-400">{label}</span>
      <span className="text-right text-sm font-medium text-slate-100">{value}</span>
    </div>
  );
}
