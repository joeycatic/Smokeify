"use client";

import { type ReactNode, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { buildOrderFinanceBreakdown } from "@/lib/adminFinance";
import { buildOrderCustomerCopyText, getOrderCustomerEmail } from "@/lib/adminOrderCustomer";
import { getRefundPreviewAmount } from "@/lib/adminRefundCalculator";
import { formatOrderSourceLabel } from "@/lib/orderSource";
import type { AdminOrderDetail, AdminOrderItemRecord, AdminOrderRecord } from "@/lib/adminOrders";

type Props = { detail: AdminOrderDetail };

const ORDER_BADGE_BASE =
  "inline-flex items-center rounded-full border px-3 py-1.5 text-[11px] font-semibold leading-none whitespace-nowrap";
const LIGHT_PANEL =
  "rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(8,13,21,0.96),rgba(11,17,27,0.92))] p-5 shadow-[0_20px_56px_rgba(2,6,23,0.36)]";
const DARK_PANEL =
  "rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(4,8,20,0.98),rgba(6,10,24,0.96))] p-5 shadow-[0_24px_64px_rgba(2,6,23,0.42)]";
const INPUT_CLASS =
  "h-11 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-400/40 focus:ring-4 focus:ring-cyan-400/10";
const PRIMARY_BUTTON =
  "inline-flex h-10 items-center justify-center rounded-xl bg-cyan-300 px-4 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:bg-slate-600 disabled:text-slate-300";
const SECONDARY_BUTTON =
  "inline-flex h-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-slate-100 transition hover:border-white/20 hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:border-white/5 disabled:text-slate-500";
const EDITABLE_ORDER_STATUSES = [
  "processing",
  "shipped",
  "fulfilled",
  "canceled",
  "return_approved",
  "return_rejected",
] as const;

const PAID_PAYMENT_STATUSES = new Set(["paid", "succeeded", "refunded", "partially_refunded"]);

const formatPrice = (amount: number, currency: string) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency, minimumFractionDigits: 2 }).format(
    amount / 100,
  );
const formatDateTime = (value: string) =>
  new Date(value).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" });
const formatCompactDate = (value: string) =>
  new Date(value).toLocaleDateString("de-DE", { dateStyle: "medium" });
const normalizeStatus = (value: string) => value.trim().toLowerCase();
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const getOrderStatusBadgeClass = (status: string) => {
  const normalizedStatus = normalizeStatus(status);
  if (normalizedStatus === "fulfilled") {
    return `${ORDER_BADGE_BASE} border-emerald-400/25 bg-emerald-400/12 text-emerald-100`;
  }
  if (["canceled", "cancelled", "failed", "refunded"].includes(normalizedStatus)) {
    return `${ORDER_BADGE_BASE} border-slate-500/30 bg-slate-500/10 text-slate-200`;
  }
  return `${ORDER_BADGE_BASE} border-cyan-400/25 bg-cyan-400/12 text-cyan-100`;
};

const getPaymentBadgeClass = (paymentStatus: string) => {
  const normalizedStatus = normalizeStatus(paymentStatus);
  if (PAID_PAYMENT_STATUSES.has(normalizedStatus)) {
    return `${ORDER_BADGE_BASE} border-amber-300/30 bg-amber-300/12 text-amber-100`;
  }
  if (["failed", "canceled", "cancelled"].includes(normalizedStatus)) {
    return `${ORDER_BADGE_BASE} border-rose-400/25 bg-rose-400/12 text-rose-100`;
  }
  return `${ORDER_BADGE_BASE} border-slate-500/30 bg-slate-500/10 text-slate-200`;
};

const formatOrderItemName = (name: string, manufacturer?: string | null) => {
  const defaultSuffix = /\s*[-—]\s*Default( Title)?(?=\s*\(|$)/i;
  if (!defaultSuffix.test(name)) return name;
  return manufacturer?.trim()
    ? name.replace(defaultSuffix, ` - ${manufacturer.trim()}`)
    : name.replace(defaultSuffix, "").trim();
};

const formatItemOptions = (options?: Array<{ name: string; value: string }>) =>
  options?.length ? options.map((opt) => `${opt.name}: ${opt.value}`).join(" · ") : "";

const formatTaxRate = (taxRateBasisPoints?: number | null) => {
  if (typeof taxRateBasisPoints !== "number") return "VAT not stored";
  const percentage = taxRateBasisPoints / 100;
  return `${new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: Number.isInteger(percentage) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(percentage)}% VAT`;
};

const buildShippingLines = (order: AdminOrderRecord) =>
  [
    order.shippingName,
    order.shippingLine1,
    order.shippingLine2,
    [order.shippingPostalCode, order.shippingCity].filter(Boolean).join(" "),
    order.shippingCountry,
  ].filter((line): line is string => Boolean(line?.trim()));

const getOrderSourceLabel = (
  order: Pick<AdminOrderRecord, "sourceStorefront" | "sourceHost" | "sourceOrigin">,
) => formatOrderSourceLabel(order.sourceStorefront, order.sourceHost, order.sourceOrigin);

const getTrackingState = (order: AdminOrderRecord) => {
  const normalizedStatus = normalizeStatus(order.status);
  if (order.trackingNumber?.trim()) return "Tracking attached";
  if (normalizedStatus === "fulfilled" || normalizedStatus === "shipped") return "Tracking missing";
  return "Awaiting shipment";
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
        { label: "Confirmation email sent", at: order.confirmationEmailSentAt ?? undefined },
        { label: "Shipping email sent", at: order.shippingEmailSentAt ?? undefined },
        { label: "Refund email sent", at: order.refundEmailSentAt ?? undefined },
        { label: "Last updated", at: order.updatedAt },
      ].filter((entry) => Boolean(entry.at)) as Array<{ label: string; at: string }>,
    [order],
  );
  const selectedRefundItemCount = useMemo(
    () => Object.values(refundSelection).filter((value) => value > 0).length,
    [refundSelection],
  );
  const selectedRefundQuantity = useMemo(
    () => Object.values(refundSelection).reduce((sum, value) => sum + value, 0),
    [refundSelection],
  );
  const selectedItemsRefundPreview = useMemo(
    () => getRefundPreviewAmount(order, "items", refundSelection, refundIncludeShipping),
    [order, refundIncludeShipping, refundSelection],
  );
  const fullRefundPreview = useMemo(
    () => getRefundPreviewAmount(order, "full", refundSelection, refundIncludeShipping),
    [order, refundIncludeShipping, refundSelection],
  );
  const customerEmail = useMemo(() => getOrderCustomerEmail(order), [order]);
  const customerCopyText = useMemo(() => buildOrderCustomerCopyText(order), [order]);
  const customerName = order.user.name ?? order.shippingName ?? "Unknown customer";
  const sourceLabel = getOrderSourceLabel(order);
  const emailStatuses = [
    { label: "Confirmation", sentAt: order.confirmationEmailSentAt },
    { label: "Shipping", sentAt: order.shippingEmailSentAt },
    { label: "Refund", sentAt: order.refundEmailSentAt },
  ];

  const updateOrderState = (nextOrder: Partial<AdminOrderRecord>) => {
    setOrder((current) => ({ ...current, ...nextOrder }));
    if (typeof nextOrder.status === "string") setStatusDraft(nextOrder.status);
    setTrackingDraft((current) => ({
      carrier: nextOrder.trackingCarrier ?? current.carrier,
      number: nextOrder.trackingNumber ?? current.number,
      url: nextOrder.trackingUrl ?? current.url,
    }));
  };

  const copyCustomerValue = async (field: "email" | "customer", label: string, value: string) => {
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
        warning?: string;
        currentUpdatedAt?: string;
        order?: Partial<AdminOrderRecord>;
      };
      if (!response.ok) {
        if (data.currentUpdatedAt) setOrder((current) => ({ ...current, updatedAt: data.currentUpdatedAt! }));
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
      setNotice(data.warning ?? "Order workspace updated.");
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
        type === "confirmation" ? { confirmationEmailSentAt: now } : type === "shipping" ? { shippingEmailSentAt: now } : { refundEmailSentAt: now },
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
        ? order.items.map((item) => ({ id: item.id, quantity: refundSelection[item.id] ?? 0 })).filter((item) => item.quantity > 0)
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
        body: JSON.stringify({ adminPassword, includeShipping: refundIncludeShipping, ...(refundMode === "items" ? { items } : {}) }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string; order?: Partial<AdminOrderRecord> };
      if (!response.ok) {
        setRefundPasswordError(data.error ?? "Refund failed.");
        return;
      }
      if (data.order) updateOrderState(data.order);
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

  const getItemHref = (item: AdminOrderItemRecord) => (item.productId ? `/admin/catalog/${item.productId}` : null);

  return (
    <div className="space-y-6 text-slate-100">
      <section className="relative overflow-hidden rounded-[34px] border border-white/8 bg-[linear-gradient(135deg,#07111b_0%,#0d1723_48%,#0a1220_100%)] p-6 shadow-[0_28px_80px_rgba(2,6,23,0.4)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.12),transparent_28%),radial-gradient(circle_at_78%_16%,rgba(34,211,238,0.08),transparent_24%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent_55%)]" />
        <div className="relative grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_360px]">
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              <Link href="/admin/orders" className="inline-flex h-10 items-center rounded-full border border-white/10 bg-white/[0.05] px-4 text-sm font-semibold text-slate-100 transition hover:border-white/20 hover:bg-white/[0.09]">Back to orders</Link>
              <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-100">Order dossier</span>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-slate-400">Admin / Orders / Detail</p>
              <div className="mt-4 flex flex-wrap items-end gap-4">
                <h1 className="text-[clamp(2.3rem,4vw,4rem)] font-semibold leading-none tracking-tight text-white">#{order.orderNumber}</h1>
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-semibold text-slate-200">{sourceLabel}</span>
                  <span className={getOrderStatusBadgeClass(order.status)}>{order.status}</span>
                  <span className={getPaymentBadgeClass(order.paymentStatus)}>{order.paymentStatus}</span>
                </div>
              </div>
              <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-300"><span className="font-semibold text-white">{customerName}</span> · {customerEmail || "No email on file"} · {order.userId ? "Signed-in customer" : "Guest checkout"} · Created {formatDateTime(order.createdAt)}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
              {[
                ["Gross order", formatPrice(financeBreakdown.grossOrderCents, order.currency), `${order.items.length} line items`],
                ["Net revenue", formatPrice(financeBreakdown.netRevenueCents, order.currency), "after VAT and refunds"],
                ["Contribution", formatPrice(financeBreakdown.contributionMarginCents, order.currency), "after fees and COGS"],
                ["Refunded", formatPrice(order.amountRefunded, order.currency), order.amountRefunded > 0 ? "refund recorded" : "no refund recorded"],
              ].map(([label, value, detail]) => (
                <div key={label} className="rounded-[24px] border border-white/8 bg-white/[0.04] px-4 py-4 shadow-[0_12px_32px_rgba(2,6,23,0.18)]">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">{label}</p>
                  <p className="mt-3 text-2xl font-semibold tracking-tight text-white">{value}</p>
                  <p className="mt-2 text-sm text-slate-300">{detail}</p>
                </div>
              ))}
            </div>
          </div>
          <aside className={DARK_PANEL}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-slate-400">Snapshot</p>
            <div className="mt-4 rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Net collected</p>
              <p className="mt-3 text-3xl font-semibold tracking-tight text-white">{formatPrice(financeBreakdown.netCollectedGrossCents, order.currency)}</p>
              <p className="mt-2 text-sm text-slate-300">Updated {formatCompactDate(order.updatedAt)}</p>
            </div>
            <div className="mt-5 space-y-3">
              <DarkRow label="Payment method" value={order.paymentMethod ?? "No payment method stored"} />
              <DarkRow label="Tracking posture" value={getTrackingState(order)} />
              <DarkRow label="Discount code" value={order.discountCode ?? "No discount used"} />
              <DarkRow label="Payment intent" value={order.stripePaymentIntent ?? "Not linked"} mono={Boolean(order.stripePaymentIntent)} />
            </div>
          </aside>
        </div>
      </section>

      {error ? <Banner tone="error">{error}</Banner> : null}
      {notice ? <Banner tone="success">{notice}</Banner> : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_390px]">
        <div className="space-y-6">
          <Panel className={LIGHT_PANEL} eyebrow="Fulfillment posture" title="Status and tracking workspace">
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
              <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-5">
                <p className="text-sm leading-6 text-slate-300">Payment remains backend-authoritative. This workspace edits fulfillment state and shipment details only.</p>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <StateCard label="Order" value={order.status} badgeClass={getOrderStatusBadgeClass(order.status)} />
                  <StateCard label="Payment" value={order.paymentStatus} badgeClass={getPaymentBadgeClass(order.paymentStatus)} />
                  <StateCard label="Tracking" value={getTrackingState(order)} detail={order.trackingNumber ?? "Tracking number not saved"} />
                  <StateCard label="Shipping email" value={order.shippingEmailSentAt ? "Sent" : "Pending"} detail={order.shippingEmailSentAt ? formatDateTime(order.shippingEmailSentAt) : "No shipping email recorded"} />
                </div>
              </div>
              <div>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Order status</span>
                    <select value={statusDraft} onChange={(event) => setStatusDraft(event.target.value)} className={`${INPUT_CLASS} mt-2`}>
                      {!EDITABLE_ORDER_STATUSES.includes(statusDraft as (typeof EDITABLE_ORDER_STATUSES)[number]) ? (
                        <option value={statusDraft}>{statusDraft} (legacy)</option>
                      ) : null}
                      {EDITABLE_ORDER_STATUSES.map((status) => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                  </label>
                  {[
                    ["Tracking carrier", trackingDraft.carrier, (value: string) => setTrackingDraft((current) => ({ ...current, carrier: value }))],
                    ["Tracking number", trackingDraft.number, (value: string) => setTrackingDraft((current) => ({ ...current, number: value }))],
                    ["Tracking URL", trackingDraft.url, (value: string) => setTrackingDraft((current) => ({ ...current, url: value }))],
                  ].map(([label, value, onChange]) => (
                    <label key={label as string} className="block">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{label as string}</span>
                      <input value={value as string} onChange={(event) => (onChange as (value: string) => void)(event.target.value)} className={`${INPUT_CLASS} mt-2`} />
                    </label>
                  ))}
                </div>
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-white/8 bg-white/[0.03] px-4 py-4">
                  <p className="max-w-xl text-sm text-slate-300">Saving tracking on an open order now auto-marks it as shipped and sends the shipping email once. The server still enforces optimistic concurrency.</p>
                  <button type="button" onClick={saveOrder} disabled={saving} className={PRIMARY_BUTTON}>{saving ? "Saving..." : "Save order changes"}</button>
                </div>
              </div>
            </div>
          </Panel>

          <Panel className={LIGHT_PANEL} eyebrow="Items and refunds" title="Merchandise ledger">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <p className="max-w-2xl text-sm leading-6 text-slate-300">Review each line with tax, contribution, and refund quantity before opening the Stripe refund confirmation step.</p>
              <div className="grid min-w-[280px] gap-3 sm:grid-cols-2">
                <DataCard label="Selected refund" value={formatPrice(selectedItemsRefundPreview, order.currency)} detail={selectedRefundItemCount > 0 ? `${selectedRefundQuantity} units selected` : "Select items to preview"} />
                <DataCard label="Full refund" value={formatPrice(fullRefundPreview, order.currency)} detail={refundIncludeShipping ? "shipping included" : "excluding shipping"} />
              </div>
            </div>
            <div className="mt-5 space-y-3">
              {order.items.map((item) => {
                const itemHref = getItemHref(item);
                const selectedQty = refundSelection[item.id] ?? 0;
                const itemName = formatOrderItemName(item.name, item.manufacturer);
                const contributionAmount = item.totalAmount - item.adjustedCostAmount;
                return (
                  <div key={item.id} className="rounded-[24px] border border-white/8 bg-white/[0.03] px-4 py-4 shadow-[0_8px_28px_rgba(2,6,23,0.18)]">
                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.8fr)_100px_120px_120px_120px_92px] lg:items-center">
                      <div className="flex min-w-0 items-start gap-4">
                        <label className="mt-3 flex shrink-0 items-center"><input type="checkbox" checked={selectedQty > 0} onChange={(event) => setRefundSelection((current) => ({ ...current, [item.id]: event.target.checked ? 1 : 0 }))} aria-label={`Select ${itemName} for refund`} /></label>
                        {item.imageUrl ? <Image src={item.imageUrl} alt={itemName} width={56} height={56} className="h-14 w-14 rounded-2xl border border-white/10 object-cover" /> : <div className="h-14 w-14 rounded-2xl border border-white/10 bg-white/[0.05]" />}
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            {itemHref ? <Link href={itemHref} className="text-base font-semibold text-white underline-offset-2 transition hover:text-cyan-200 hover:underline">{itemName}</Link> : <p className="text-base font-semibold text-white">{itemName}</p>}
                            {item.manufacturer ? <span className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[11px] font-semibold text-slate-300">{item.manufacturer}</span> : null}
                          </div>
                          {item.options?.length ? <p className="mt-1 text-sm text-slate-300">{formatItemOptions(item.options)}</p> : null}
                          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                            <span>Unit {formatPrice(item.unitAmount, item.currency)}</span>
                            <span>Cost {formatPrice(item.baseCostAmount, item.currency)}</span>
                            <span>{formatTaxRate(item.taxRateBasisPoints)}</span>
                          </div>
                        </div>
                      </div>
                      <div><p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 lg:hidden">Qty</p><p className="text-sm font-semibold text-white">{item.quantity}</p></div>
                      <div className="text-right"><p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 lg:hidden">Tax</p><p className="text-sm font-semibold text-white">{formatPrice(item.taxAmount, item.currency)}</p></div>
                      <div className="text-right"><p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 lg:hidden">Contribution</p><p className={`text-sm font-semibold ${contributionAmount >= 0 ? "text-emerald-300" : "text-rose-300"}`}>{formatPrice(contributionAmount, item.currency)}</p></div>
                      <div className="text-right"><p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 lg:hidden">Total</p><p className="text-sm font-semibold text-white">{formatPrice(item.totalAmount, item.currency)}</p></div>
                      <div className="flex items-center justify-end gap-2 lg:block">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 lg:mb-2 lg:text-right">Refund</p>
                        <input type="number" min={0} max={item.quantity} value={selectedQty} onChange={(event) => setRefundSelection((current) => ({ ...current, [item.id]: clamp(Number(event.target.value), 0, item.quantity) }))} className="h-10 w-20 rounded-xl border border-white/10 bg-white/[0.04] px-2 text-center text-sm font-semibold text-white outline-none transition focus:border-cyan-400/40 focus:ring-4 focus:ring-cyan-400/10 lg:ml-auto" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-rose-400/20 bg-rose-400/10 px-4 py-4">
              <label className="inline-flex items-center gap-2 text-sm font-medium text-rose-100"><input type="checkbox" checked={refundIncludeShipping} onChange={(event) => setRefundIncludeShipping(event.target.checked)} />Include shipping in refund preview</label>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => { setRefundPassword(""); setRefundPasswordError(""); setRefundMode("items"); }} className="inline-flex h-10 items-center justify-center rounded-xl border border-rose-300/25 bg-white/[0.05] px-4 text-sm font-semibold text-rose-100 transition hover:bg-white/[0.08]">Refund selected items ({selectedRefundItemCount})</button>
                <button type="button" onClick={() => { setRefundPassword(""); setRefundPasswordError(""); setRefundMode("full"); }} className="inline-flex h-10 items-center justify-center rounded-xl bg-rose-700 px-4 text-sm font-semibold text-white transition hover:bg-rose-600">Full refund</button>
              </div>
            </div>
          </Panel>

          <div className="grid gap-6 lg:grid-cols-2">
            <Panel className={LIGHT_PANEL} eyebrow="Customer dossier" title="Customer and shipping">
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => void copyCustomerValue("email", "Email", customerEmail)} className={SECONDARY_BUTTON}>{copiedCustomerField === "email" ? "Copied email" : "Copy email"}</button>
                <button type="button" onClick={() => void copyCustomerValue("customer", "Customer details", customerCopyText)} className="inline-flex h-10 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-4 text-sm font-semibold text-cyan-100 transition hover:border-cyan-300/30 hover:bg-cyan-400/15">{copiedCustomerField === "customer" ? "Copied customer" : "Copy customer"}</button>
              </div>
              <div className="mt-5 grid gap-3">
                <Row label="Customer" value={customerName} />
                <Row label="Email" value={customerEmail || "—"} />
                <Row label="Website" value={sourceLabel} />
                <Row label="Source host" value={order.sourceHost ?? "—"} />
                <Row label="Source origin" value={order.sourceOrigin ?? "—"} />
                <Row label="Payment method" value={order.paymentMethod ?? "—"} />
              </div>
              <div className="mt-5 rounded-[24px] border border-white/8 bg-white/[0.03] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Delivery address</p>
                <div className="mt-3 space-y-1 text-sm leading-6 text-slate-200">{shippingLines.length ? shippingLines.map((line) => <div key={line}>{line}</div>) : <div className="text-slate-500">No shipping address stored.</div>}</div>
              </div>
            </Panel>

            <Panel className={LIGHT_PANEL} eyebrow="Timeline" title="Order events">
              <ol className="space-y-4">
                {timeline.map((entry, index) => (
                  <li key={`${entry.label}-${entry.at}`} className="relative pl-8">
                    {index < timeline.length - 1 ? <span className="absolute left-[11px] top-7 h-[calc(100%-0.25rem)] w-px bg-white/10" /> : null}
                    <span className="absolute left-0 top-1 inline-flex h-6 w-6 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-[11px] font-semibold text-slate-200">{index + 1}</span>
                    <div className="rounded-[22px] border border-white/8 bg-white/[0.03] px-4 py-3">
                      <p className="text-sm font-semibold text-white">{entry.label}</p>
                      <p className="mt-1 text-sm text-slate-300">{formatDateTime(entry.at)}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </Panel>
          </div>

          <Panel className={LIGHT_PANEL} eyebrow="Audit" title="Admin timeline and change trail">
            <div className="space-y-3">
              {detail.auditLogs.length ? detail.auditLogs.map((entry) => (
                <div key={entry.id} className="rounded-[22px] border border-white/8 bg-white/[0.03] px-4 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{entry.summary ?? entry.action}</p>
                      <p className="mt-1 text-xs font-medium uppercase tracking-[0.16em] text-slate-400">{entry.actorEmail ?? "System"} · {entry.action}</p>
                    </div>
                    <div className="text-sm text-slate-300">{formatDateTime(entry.createdAt)}</div>
                  </div>
                </div>
              )) : <Empty text="No order audit entries yet." />}
            </div>
          </Panel>
        </div>

        <div className="space-y-6 xl:sticky xl:top-6 xl:self-start">
          <Panel className={DARK_PANEL} eyebrow="Finance" title="Order ledger" dark>
            <div className="rounded-[24px] border border-emerald-400/20 bg-emerald-400/10 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-200/80">Contribution margin</p>
              <p className="mt-2 text-2xl font-semibold text-white">{formatPrice(financeBreakdown.contributionMarginCents, order.currency)}</p>
              <p className="mt-2 text-sm text-emerald-100/80">Includes item costs and payment fees.</p>
            </div>
            <div className="mt-5 space-y-3">
              <DarkRow label="Gross order" value={formatPrice(financeBreakdown.grossOrderCents, order.currency)} />
              <DarkRow label="Refunded gross" value={formatPrice(financeBreakdown.refundedGrossCents, order.currency)} />
              <DarkRow label="Output VAT" value={formatPrice(financeBreakdown.outputVatCents, order.currency)} />
              <DarkRow label="Net revenue" value={formatPrice(financeBreakdown.netRevenueCents, order.currency)} />
              <DarkRow label="COGS" value={formatPrice(financeBreakdown.cogsCents, order.currency)} />
              <DarkRow label="Payment fees" value={formatPrice(financeBreakdown.paymentFeesCents, order.currency)} />
              <DarkRow label="Collected after refunds" value={formatPrice(financeBreakdown.netCollectedGrossCents, order.currency)} />
            </div>
          </Panel>

          <Panel className={DARK_PANEL} eyebrow="Customer comms" title="Email actions" dark>
            <div className="space-y-2">
              {emailStatuses.map((entry) => (
                <div key={entry.label} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                  <span className="text-sm font-medium text-slate-200">{entry.label}</span>
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${entry.sentAt ? "bg-emerald-400/15 text-emerald-200" : "bg-white/10 text-slate-300"}`}>{entry.sentAt ? formatCompactDate(entry.sentAt) : "Not sent"}</span>
                </div>
              ))}
            </div>
            <div className="mt-5 grid gap-2">
              <button type="button" onClick={() => sendEmail("confirmation")} disabled={sendingEmail !== null} className="inline-flex h-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-white transition hover:border-white/20 hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-50">{sendingEmail === "confirmation" ? "Sending..." : "Send confirmation"}</button>
              <button type="button" onClick={() => sendEmail("shipping")} disabled={sendingEmail !== null} className="inline-flex h-10 items-center justify-center rounded-xl border border-sky-400/20 bg-sky-400/10 px-4 text-sm font-semibold text-sky-100 transition hover:border-sky-300/30 hover:bg-sky-400/15 disabled:cursor-not-allowed disabled:opacity-50">{sendingEmail === "shipping" ? "Sending..." : "Send shipping"}</button>
              <button type="button" onClick={() => sendEmail("refund")} disabled={sendingEmail !== null} className="inline-flex h-10 items-center justify-center rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 text-sm font-semibold text-rose-100 transition hover:border-rose-300/30 hover:bg-rose-400/15 disabled:cursor-not-allowed disabled:opacity-50">{sendingEmail === "refund" ? "Sending..." : "Send refund"}</button>
              <a href={`/api/admin/orders/${order.id}/lieferschein`} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center justify-center rounded-xl border border-emerald-300/25 bg-emerald-300/15 px-4 text-sm font-semibold text-emerald-50 transition hover:bg-emerald-300/25">Download Lieferschein</a>
              <a href={`/api/orders/${order.id}/invoice`} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center justify-center rounded-xl bg-amber-300 px-4 text-sm font-semibold text-slate-950 transition hover:bg-amber-200">Open invoice</a>
            </div>
          </Panel>

          <Panel className={DARK_PANEL} eyebrow="Returns" title="Linked return requests" dark>
            <div className="space-y-3">
              {detail.returnRequests.length ? detail.returnRequests.map((request) => (
                <div key={request.id} className="rounded-[22px] border border-white/10 bg-white/[0.04] px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{request.status}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-400">{request.requestedResolution} · {formatCompactDate(request.createdAt)}</p>
                    </div>
                    <Link href="/admin/returns" className="text-xs font-semibold text-cyan-200 underline-offset-2 hover:text-cyan-100 hover:underline">Open returns</Link>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-200">{request.reason}</p>
                  {request.items.length ? <p className="mt-3 text-xs leading-5 text-slate-400">{request.items.map((item) => `${item.orderItemName} x${item.quantity}`).join(" · ")}</p> : null}
                </div>
              )) : <Empty text="No return requests linked to this order." dark />}
            </div>
          </Panel>

          <Panel className={DARK_PANEL} eyebrow="Webhooks" title="Recent failed webhook context" dark>
            <div className="space-y-3">
              {detail.webhookFailures.length ? detail.webhookFailures.map((event) => (
                <div key={event.id} className="rounded-[22px] border border-rose-400/20 bg-rose-400/10 px-4 py-4">
                  <p className="text-sm font-semibold text-rose-100">{event.type}</p>
                  <p className="mt-1 break-all text-xs leading-5 text-rose-100/80">{event.eventId}</p>
                  <p className="mt-2 text-xs uppercase tracking-[0.16em] text-rose-100/70">{formatDateTime(event.createdAt)}</p>
                </div>
              )) : <Empty text="No failed webhook events in the recent queue." dark />}
            </div>
          </Panel>
        </div>
      </div>

      {refundMode ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <button type="button" className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={() => setRefundMode(null)} aria-label="Close refund dialog" />
          <div className="relative w-full max-w-md rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,13,21,0.98),rgba(10,16,26,0.96))] p-6 shadow-[0_30px_80px_rgba(2,6,23,0.5)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-slate-400">Refund confirmation</p>
            <h3 className="mt-2 text-2xl font-semibold text-white">Confirm refund</h3>
            <p className="mt-3 text-sm leading-6 text-slate-300">Refunds are irreversible and Stripe-authoritative. Review the preview, then confirm with your admin password.</p>
            <div className="mt-5 rounded-[24px] border border-rose-400/20 bg-rose-400/10 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-rose-200">Preview</p>
              <p className="mt-2 text-2xl font-semibold text-white">{formatPrice(refundMode === "full" ? fullRefundPreview : selectedItemsRefundPreview, order.currency)}</p>
              <p className="mt-2 text-sm text-slate-300">{refundMode === "items" ? `${selectedRefundQuantity} units selected` : "Full-order refund preview"}</p>
            </div>
            <label className="block mt-4">
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Admin password</span>
              <input type="password" value={refundPassword} onChange={(event) => { setRefundPassword(event.target.value); if (refundPasswordError) setRefundPasswordError(""); }} placeholder="Admin password" className={`${INPUT_CLASS} mt-2`} />
            </label>
            {refundPasswordError ? <p className="mt-3 text-sm font-medium text-rose-300">{refundPasswordError}</p> : null}
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setRefundMode(null)} className={SECONDARY_BUTTON}>Cancel</button>
              <button type="button" onClick={confirmRefund} disabled={refunding} className="inline-flex h-10 items-center justify-center rounded-xl bg-rose-700 px-4 text-sm font-semibold text-white transition hover:bg-rose-600 disabled:cursor-not-allowed disabled:bg-rose-300">{refunding ? "Refunding..." : "Process refund"}</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Panel({
  className,
  eyebrow,
  title,
  dark,
  children,
}: {
  className: string;
  eyebrow: string;
  title: string;
  dark?: boolean;
  children: ReactNode;
}) {
  return (
    <section className={className}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">{eyebrow}</p>
      <h2 className={`mt-2 text-xl font-semibold ${dark ? "text-white" : "text-slate-100"}`}>{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Banner({ tone, children }: { tone: "success" | "error"; children: ReactNode }) {
  return <div className={`rounded-2xl border px-4 py-3 text-sm font-medium ${tone === "success" ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-100" : "border-rose-400/20 bg-rose-400/10 text-rose-100"}`}>{children}</div>;
}

function StateCard({ label, value, detail, badgeClass }: { label: string; value: string; detail?: string; badgeClass?: string }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <div className="mt-3">{badgeClass ? <span className={badgeClass}>{value}</span> : <p className="text-sm font-semibold text-white">{value}</p>}</div>
      <p className="mt-3 text-sm text-slate-300">{detail ?? "Current recorded value"}</p>
    </div>
  );
}

function DataCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-[22px] border border-white/8 bg-white/[0.03] px-4 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-3 text-xl font-semibold text-white">{value}</p>
      <p className="mt-2 text-sm text-slate-300">{detail}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3"><span className="text-sm text-slate-300">{label}</span><span className="text-right text-sm font-semibold text-white">{value}</span></div>;
}

function DarkRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3"><p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p><p className={`mt-2 text-sm text-white ${mono ? "break-all font-mono text-[13px]" : "font-medium"}`}>{value}</p></div>;
}

function Empty({ text, dark }: { text: string; dark?: boolean }) {
  return <div className={`rounded-[22px] border px-4 py-8 text-sm ${dark ? "border-dashed border-white/10 bg-white/[0.03] text-slate-400" : "border-dashed border-white/8 bg-white/[0.03] text-slate-400"}`}>{text}</div>;
}
