"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { buildOrderFinanceBreakdown } from "@/lib/adminFinance";
import { getRefundPreviewAmount } from "@/lib/adminRefundCalculator";
import type { AdminOrderDetail, AdminOrderItemRecord, AdminOrderRecord } from "@/lib/adminOrders";

type Props = {
  detail: AdminOrderDetail;
};

const ORDER_BADGE_BASE =
  "inline-flex items-center rounded-full border px-3 py-1.5 text-[11px] font-medium leading-none whitespace-nowrap";

const PAID_PAYMENT_STATUSES = new Set([
  "paid",
  "succeeded",
  "refunded",
  "partially_refunded",
]);
const ORDER_SOURCE_LABELS: Record<string, string> = {
  MAIN: "Smokeify",
  GROW: "GrowVault",
};

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
    return `${ORDER_BADGE_BASE} border-emerald-200 bg-emerald-50 text-emerald-800`;
  }
  if (["canceled", "cancelled", "failed", "refunded"].includes(normalizedStatus)) {
    return `${ORDER_BADGE_BASE} border-stone-200 bg-stone-100 text-stone-700`;
  }
  return `${ORDER_BADGE_BASE} border-sky-200 bg-sky-50 text-sky-800`;
};

const getPaymentBadgeClass = (paymentStatus: string) => {
  const normalizedStatus = normalizeStatus(paymentStatus);
  if (PAID_PAYMENT_STATUSES.has(normalizedStatus)) {
    return `${ORDER_BADGE_BASE} border-amber-200 bg-amber-50 text-amber-800`;
  }
  if (["failed", "canceled", "cancelled"].includes(normalizedStatus)) {
    return `${ORDER_BADGE_BASE} border-rose-200 bg-rose-50 text-rose-700`;
  }
  return `${ORDER_BADGE_BASE} border-stone-200 bg-stone-100 text-stone-700`;
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
  order: Pick<AdminOrderRecord, "sourceStorefront" | "sourceHost">,
) => {
  if (order.sourceStorefront && ORDER_SOURCE_LABELS[order.sourceStorefront]) {
    return ORDER_SOURCE_LABELS[order.sourceStorefront];
  }
  return order.sourceHost?.trim() || "Unknown website";
};

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
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[32px] border border-black/10 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-stone-500">
              Admin / Orders / Detail
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Link
                href="/admin/orders"
                className="inline-flex h-9 items-center rounded-full border border-black/10 px-4 text-xs font-semibold text-stone-600 transition hover:border-black/20 hover:text-stone-900"
              >
                Back to orders
              </Link>
              <h1 className="text-3xl font-semibold text-stone-900">
                Order #{order.orderNumber}
              </h1>
              <span className={`${ORDER_BADGE_BASE} border-emerald-200 bg-emerald-50 text-emerald-800`}>
                {getOrderSourceLabel(order)}
              </span>
              <span className={getOrderStatusBadgeClass(order.status)}>{order.status}</span>
              <span className={getPaymentBadgeClass(order.paymentStatus)}>
                {order.paymentStatus}
              </span>
            </div>
            <p className="mt-3 text-sm text-stone-600">
              {order.user.name ?? order.shippingName ?? "Unknown customer"} ·{" "}
              {order.user.email ?? order.customerEmail ?? "No email"} ·{" "}
              {getOrderSourceLabel(order)} · created {formatDateTime(order.createdAt)}
            </p>
          </div>
          <div className="text-right">
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-500">
              Net collected
            </div>
            <div className="mt-2 text-2xl font-semibold text-stone-900">
              {formatPrice(financeBreakdown.netCollectedGrossCents, order.currency)}
            </div>
            <div className="mt-1 text-sm text-stone-500">
              Refunded {formatPrice(order.amountRefunded, order.currency)}
            </div>
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {notice}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_380px]">
        <div className="space-y-6">
          <section className="rounded-[28px] border border-black/10 bg-white p-5 shadow-sm">
            <div className="mb-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-500">
                Fulfillment controls
              </p>
              <h2 className="mt-2 text-lg font-semibold text-stone-900">
                Status and tracking
              </h2>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-2 text-sm text-stone-600">
                <span className="font-medium text-stone-900">Order status</span>
                <input
                  type="text"
                  value={statusDraft}
                  onChange={(event) => setStatusDraft(event.target.value)}
                  className="h-11 w-full rounded-xl border border-black/10 px-3 outline-none focus:border-black/30"
                />
              </label>
              <label className="space-y-2 text-sm text-stone-600">
                <span className="font-medium text-stone-900">Tracking carrier</span>
                <input
                  type="text"
                  value={trackingDraft.carrier}
                  onChange={(event) =>
                    setTrackingDraft((current) => ({ ...current, carrier: event.target.value }))
                  }
                  className="h-11 w-full rounded-xl border border-black/10 px-3 outline-none focus:border-black/30"
                />
              </label>
              <label className="space-y-2 text-sm text-stone-600">
                <span className="font-medium text-stone-900">Tracking number</span>
                <input
                  type="text"
                  value={trackingDraft.number}
                  onChange={(event) =>
                    setTrackingDraft((current) => ({ ...current, number: event.target.value }))
                  }
                  className="h-11 w-full rounded-xl border border-black/10 px-3 outline-none focus:border-black/30"
                />
              </label>
              <label className="space-y-2 text-sm text-stone-600">
                <span className="font-medium text-stone-900">Tracking URL</span>
                <input
                  type="url"
                  value={trackingDraft.url}
                  onChange={(event) =>
                    setTrackingDraft((current) => ({ ...current, url: event.target.value }))
                  }
                  className="h-11 w-full rounded-xl border border-black/10 px-3 outline-none focus:border-black/30"
                />
              </label>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-stone-500">
                Payment state stays backend-authoritative. This workspace only edits fulfillment
                and tracking fields.
              </p>
              <button
                type="button"
                onClick={saveOrder}
                disabled={saving}
                className="inline-flex h-10 items-center rounded-xl bg-stone-900 px-4 text-sm font-semibold text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-400"
              >
                {saving ? "Saving..." : "Save order changes"}
              </button>
            </div>
          </section>

          <section className="rounded-[28px] border border-black/10 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-500">
                  Items and refunds
                </p>
                <h2 className="mt-2 text-lg font-semibold text-stone-900">
                  Refund preview workspace
                </h2>
              </div>
              <div className="text-right">
                <div className="text-xs uppercase tracking-[0.2em] text-stone-500">Preview</div>
                <div className="mt-1 text-lg font-semibold text-stone-900">
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
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-black/10 bg-stone-50 px-3 py-3"
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
                          className="rounded-xl border border-black/10 object-cover"
                        />
                      ) : (
                        <div className="h-11 w-11 rounded-xl border border-black/10 bg-white" />
                      )}
                      <div className="min-w-0">
                        {itemHref ? (
                          <Link
                            href={itemHref}
                            className="font-semibold text-stone-900 underline-offset-2 hover:text-emerald-700 hover:underline"
                          >
                            {itemName}
                          </Link>
                        ) : (
                          <p className="font-semibold text-stone-900">{itemName}</p>
                        )}
                        {item.options?.length ? (
                          <p className="text-xs text-stone-500">{formatItemOptions(item.options)}</p>
                        ) : null}
                        <p className="text-xs text-stone-500">
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
                        className="h-10 w-16 rounded-xl border border-black/10 px-2 text-center text-sm outline-none focus:border-black/30"
                      />
                      <div className="w-24 text-right text-sm font-semibold text-stone-900">
                        {formatPrice(item.totalAmount, item.currency)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3">
              <label className="inline-flex items-center gap-2 text-sm text-stone-700">
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
                className="inline-flex h-10 items-center rounded-xl border border-rose-200 bg-white px-4 text-sm font-semibold text-rose-700 transition hover:border-rose-300"
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
                className="inline-flex h-10 items-center rounded-xl border border-red-200 bg-red-50 px-4 text-sm font-semibold text-red-700 transition hover:border-red-300"
              >
                Full refund
              </button>
            </div>
          </section>
          <section className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-[28px] border border-black/10 bg-white p-5 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-500">
                Shipping
              </p>
              <h2 className="mt-2 text-lg font-semibold text-stone-900">Customer and address</h2>
                <div className="mt-4 space-y-2 text-sm text-stone-600">
                  <InfoRow label="Customer email" value={order.user.email ?? order.customerEmail ?? "—"} />
                  <InfoRow label="Website" value={getOrderSourceLabel(order)} />
                  <InfoRow label="Source host" value={order.sourceHost ?? "—"} />
                  <InfoRow label="Payment method" value={order.paymentMethod ?? "—"} />
                  <InfoRow label="Discount code" value={order.discountCode ?? "—"} />
                </div>
              <div className="mt-4 rounded-2xl border border-black/10 bg-stone-50 px-4 py-4 text-sm text-stone-700">
                {shippingLines.length ? (
                  shippingLines.map((line) => <div key={line}>{line}</div>)
                ) : (
                  <div>No shipping address stored.</div>
                )}
              </div>
            </section>

            <section className="rounded-[28px] border border-black/10 bg-white p-5 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-500">
                Timeline
              </p>
              <h2 className="mt-2 text-lg font-semibold text-stone-900">Order events</h2>
              <ol className="mt-4 space-y-3">
                {timeline.map((entry) => (
                  <li
                    key={`${entry.label}-${entry.at}`}
                    className="rounded-2xl border border-black/10 bg-stone-50 px-4 py-3"
                  >
                    <div className="text-sm font-semibold text-stone-900">{entry.label}</div>
                    <div className="mt-1 text-xs text-stone-500">{formatDateTime(entry.at)}</div>
                  </li>
                ))}
              </ol>
            </section>
          </section>

          <section className="rounded-[28px] border border-black/10 bg-white p-5 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-500">
              Audit
            </p>
            <h2 className="mt-2 text-lg font-semibold text-stone-900">Admin and timeline audit</h2>
            <div className="mt-4 space-y-3">
              {detail.auditLogs.length ? (
                detail.auditLogs.map((entry) => (
                  <div
                    key={entry.id}
                    className="rounded-2xl border border-black/10 bg-stone-50 px-4 py-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm font-semibold text-stone-900">
                        {entry.summary ?? entry.action}
                      </div>
                      <div className="text-xs text-stone-500">{formatDateTime(entry.createdAt)}</div>
                    </div>
                    <div className="mt-1 text-xs text-stone-500">
                      {entry.actorEmail ?? "System"} · {entry.action}
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-black/10 bg-stone-50 px-4 py-6 text-sm text-stone-500">
                  No order audit entries yet.
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-[28px] border border-black/10 bg-white p-5 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-500">
              Finance
            </p>
            <h2 className="mt-2 text-lg font-semibold text-stone-900">Payment breakdown</h2>
            <div className="mt-4 space-y-2 text-sm text-stone-600">
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

          <section className="rounded-[28px] border border-black/10 bg-white p-5 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-500">
              Customer comms
            </p>
            <h2 className="mt-2 text-lg font-semibold text-stone-900">Email actions</h2>
            <div className="mt-4 grid gap-2">
              <button
                type="button"
                onClick={() => sendEmail("confirmation")}
                disabled={sendingEmail !== null}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-black/10 px-4 text-sm font-semibold text-stone-700 transition hover:border-black/20 disabled:cursor-not-allowed disabled:text-stone-400"
              >
                {sendingEmail === "confirmation" ? "Sending..." : "Send confirmation"}
              </button>
              <button
                type="button"
                onClick={() => sendEmail("shipping")}
                disabled={sendingEmail !== null}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-sky-200 bg-sky-50 px-4 text-sm font-semibold text-sky-800 transition hover:border-sky-300 disabled:cursor-not-allowed disabled:text-sky-400"
              >
                {sendingEmail === "shipping" ? "Sending..." : "Send shipping"}
              </button>
              <button
                type="button"
                onClick={() => sendEmail("refund")}
                disabled={sendingEmail !== null}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 px-4 text-sm font-semibold text-rose-700 transition hover:border-rose-300 disabled:cursor-not-allowed disabled:text-rose-400"
              >
                {sendingEmail === "refund" ? "Sending..." : "Send refund"}
              </button>
              <a
                href={`/api/orders/${order.id}/invoice`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-10 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 px-4 text-sm font-semibold text-emerald-700 transition hover:border-emerald-300"
              >
                Open invoice
              </a>
            </div>
          </section>
          <section className="rounded-[28px] border border-black/10 bg-white p-5 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-500">
              Returns
            </p>
            <h2 className="mt-2 text-lg font-semibold text-stone-900">Linked return requests</h2>
            <div className="mt-4 space-y-3">
              {detail.returnRequests.length ? (
                detail.returnRequests.map((request) => (
                  <div
                    key={request.id}
                    className="rounded-2xl border border-black/10 bg-stone-50 px-4 py-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-stone-900">{request.status}</div>
                      <Link
                        href="/admin/returns"
                        className="text-xs font-semibold text-stone-600 underline-offset-2 hover:text-stone-900 hover:underline"
                      >
                        Open returns
                      </Link>
                    </div>
                    <div className="mt-1 text-xs text-stone-500">
                      {request.requestedResolution} · {formatDateTime(request.createdAt)}
                    </div>
                    <p className="mt-2 text-sm text-stone-600">{request.reason}</p>
                    {request.items.length ? (
                      <div className="mt-2 text-xs text-stone-500">
                        {request.items.map((item) => `${item.orderItemName} x${item.quantity}`).join(" · ")}
                      </div>
                    ) : null}
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-black/10 bg-stone-50 px-4 py-6 text-sm text-stone-500">
                  No return requests linked to this order.
                </div>
              )}
            </div>
          </section>

          <section className="rounded-[28px] border border-black/10 bg-white p-5 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-500">
              Webhooks
            </p>
            <h2 className="mt-2 text-lg font-semibold text-stone-900">Recent failed webhook context</h2>
            <div className="mt-4 space-y-3">
              {detail.webhookFailures.length ? (
                detail.webhookFailures.map((event) => (
                  <div
                    key={event.id}
                    className="rounded-2xl border border-black/10 bg-stone-50 px-4 py-3"
                  >
                    <div className="text-sm font-semibold text-stone-900">{event.type}</div>
                    <div className="mt-1 text-xs text-stone-500">
                      {event.eventId} · {formatDateTime(event.createdAt)}
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-black/10 bg-stone-50 px-4 py-6 text-sm text-stone-500">
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
            className="absolute inset-0 bg-black/40"
            onClick={() => setRefundMode(null)}
            aria-label="Close refund dialog"
          />
          <div className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-stone-900">Confirm refund</h3>
            <p className="mt-2 text-sm text-stone-600">
              Refunds are irreversible and remain Stripe-authoritative. Review the preview before
              proceeding.
            </p>
            <div className="mt-4 rounded-2xl border border-black/10 bg-stone-50 px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-500">
                Preview
              </div>
              <div className="mt-2 text-xl font-semibold text-stone-900">
                {formatPrice(refundPreviewAmount, order.currency)}
              </div>
              <div className="mt-1 text-xs text-stone-500">
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
              className="mt-4 h-11 w-full rounded-xl border border-black/10 px-3 outline-none focus:border-black/30"
            />
            {refundPasswordError ? (
              <p className="mt-2 text-xs text-rose-600">{refundPasswordError}</p>
            ) : null}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRefundMode(null)}
                className="inline-flex h-10 items-center rounded-xl border border-black/10 px-4 text-sm font-semibold text-stone-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmRefund}
                disabled={refunding}
                className="inline-flex h-10 items-center rounded-xl bg-red-600 px-4 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:bg-red-300"
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
    <div className="flex items-center justify-between gap-4">
      <span className="text-stone-500">{label}</span>
      <span className="text-right text-stone-900">{value}</span>
    </div>
  );
}
