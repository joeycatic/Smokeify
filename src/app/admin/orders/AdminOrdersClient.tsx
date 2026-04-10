"use client";

import { useDeferredValue, useMemo, useState } from "react";
import Link from "next/link";
import AdminThemeToggle from "@/components/admin/AdminThemeToggle";
import {
  AdminButton,
  AdminEmptyState,
  AdminInput,
  AdminMetricCard,
  AdminNotice,
  AdminPageIntro,
  AdminPanel,
} from "@/components/admin/AdminWorkspace";
import type { AdminOrderRecord, AdminOrderWebhookFailure } from "@/lib/adminOrders";
import {
  getOrderCustomerLabel,
  getOrderCustomerSecondary,
  getOrderItemSummary,
  getOrderQueuePriority,
  getOrderQueueTone,
  getOrderSourceDetail,
  getOrderTrackingSummary,
  hasPaymentFailure,
  isArchivedOrder,
  isAwaitingPaymentOrder,
  isPaidOrder,
  isReadyToFulfillOrder,
  matchesOrderSearch,
  normalizeOrderStatus,
  type OrderQueueTone,
} from "@/lib/adminOrderQueue";

type Props = {
  activeStorefrontLabel: string;
  initialSearchQuery?: string;
  orders: AdminOrderRecord[];
  webhookFailures: AdminOrderWebhookFailure[];
};

const formatPrice = (amount: number, currency: string) =>
  new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount / 100);

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

const formatStatusLabel = (value: string) =>
  value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

const toneClassNames: Record<
  OrderQueueTone,
  {
    card: string;
    accent: string;
    label: string;
  }
> = {
  attention: {
    card: "border-amber-400/30 bg-[linear-gradient(135deg,rgba(120,53,15,0.26),rgba(12,16,22,0.96))]",
    accent: "border-amber-300/30 bg-amber-300/15 text-amber-100",
    label: "Needs action",
  },
  progress: {
    card: "border-cyan-400/25 bg-[linear-gradient(135deg,rgba(8,64,86,0.25),rgba(12,16,22,0.96))]",
    accent: "border-cyan-300/25 bg-cyan-300/15 text-cyan-100",
    label: "In progress",
  },
  settled: {
    card: "border-emerald-400/25 bg-[linear-gradient(135deg,rgba(6,78,59,0.24),rgba(12,16,22,0.96))]",
    accent: "border-emerald-300/25 bg-emerald-300/15 text-emerald-100",
    label: "Completed",
  },
  muted: {
    card: "border-white/10 bg-[#0d1218]",
    accent: "border-white/10 bg-white/[0.05] text-slate-200",
    label: "Monitoring",
  },
};

function StatusChip({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
}) {
  const className =
    tone === "success"
      ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
      : tone === "warning"
        ? "border-amber-400/20 bg-amber-400/10 text-amber-200"
        : tone === "danger"
          ? "border-red-400/20 bg-red-400/10 text-red-200"
          : tone === "info"
            ? "border-cyan-400/20 bg-cyan-400/10 text-cyan-200"
            : "border-white/10 bg-white/[0.04] text-slate-300";

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${className}`}
    >
      {label}
    </span>
  );
}

function InlineMeta({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </div>
      <div className="mt-2 text-sm text-slate-200">{value}</div>
    </div>
  );
}

function OrderRow({ order }: { order: AdminOrderRecord }) {
  const tone = getOrderQueueTone(order);
  const toneClasses = toneClassNames[tone];
  const customerLabel = getOrderCustomerLabel(order);
  const customerSecondary = getOrderCustomerSecondary(order);
  const isPaid = isPaidOrder(order);
  const readyToFulfill = isReadyToFulfillOrder(order);
  const paymentFailed = hasPaymentFailure(order);
  const destination = [order.shippingCity, order.shippingCountry]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join(" · ");

  return (
    <article className={`rounded-[26px] border p-4 shadow-[0_18px_50px_rgba(0,0,0,0.22)] ${toneClasses.card}`}>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${toneClasses.accent}`}
            >
              {toneClasses.label}
            </span>
            <StatusChip label={formatStatusLabel(order.status)} tone={tone === "settled" ? "success" : "neutral"} />
            <StatusChip
              label={formatStatusLabel(order.paymentStatus)}
              tone={
                paymentFailed ? "danger" : isPaid ? "success" : isAwaitingPaymentOrder(order) ? "warning" : "neutral"
              }
            />
            <StatusChip
              label={order.trackingNumber ? "Tracking attached" : "No tracking"}
              tone={order.trackingNumber ? "info" : readyToFulfill ? "warning" : "neutral"}
            />
          </div>

          <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-2">
            <h2 className="text-xl font-semibold tracking-tight text-white">
              #{order.orderNumber}
            </h2>
            <div className="text-sm font-medium text-slate-200">{customerLabel}</div>
            {customerSecondary ? (
              <div className="text-sm text-slate-500">{customerSecondary}</div>
            ) : null}
          </div>

          <div className="mt-2 text-sm text-slate-400">{getOrderItemSummary(order)}</div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <InlineMeta label="Created" value={formatDateTime(order.createdAt)} />
            <InlineMeta label="Source" value={getOrderSourceDetail(order)} />
            <InlineMeta label="Tracking" value={getOrderTrackingSummary(order)} />
          </div>

          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-500">
            {destination ? <span>{destination}</span> : null}
            {order.discountCode ? <span>Discount {order.discountCode}</span> : null}
            {order.amountRefunded > 0 ? (
              <span>
                Refunded {formatPrice(order.amountRefunded, order.currency)}
              </span>
            ) : null}
            <span>Updated {formatDateTime(order.updatedAt)}</span>
          </div>
        </div>

        <div className="flex w-full shrink-0 flex-col gap-3 xl:w-[220px] xl:items-end">
          <div className="w-full rounded-[22px] border border-white/10 bg-black/20 px-4 py-4 text-left xl:text-right">
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
              Total
            </div>
            <div className="mt-2 text-2xl font-semibold tracking-tight text-white">
              {formatPrice(order.amountTotal, order.currency)}
            </div>
            <div className="mt-2 text-xs text-slate-500">
              {readyToFulfill
                ? "Paid and available for fulfillment."
                : paymentFailed
                  ? "Payment issue requires review."
                  : tone === "progress"
                    ? "Tracking already attached."
                    : normalizeOrderStatus(order.status) === "fulfilled"
                      ? "Completed order."
                      : "Open order in detailed view for next steps."}
            </div>
          </div>

          <a
            href={`/api/admin/orders/${order.id}/lieferschein`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-10 items-center justify-center rounded-xl border border-emerald-300/25 bg-emerald-300/15 px-4 text-sm font-semibold text-emerald-50 transition hover:bg-emerald-300/25"
          >
            Lieferschein
          </a>
          <Link
            href={`/admin/orders/${order.id}`}
            className="inline-flex h-10 items-center justify-center rounded-xl bg-cyan-400 px-4 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
          >
            Open detail
          </Link>
        </div>
      </div>
    </article>
  );
}

function WebhookFailureRow({ failure }: { failure: AdminOrderWebhookFailure }) {
  return (
    <div className="grid gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 md:grid-cols-[1fr_auto] md:items-center">
      <div>
        <div className="text-sm font-semibold text-white">{failure.type}</div>
        <div className="mt-1 text-xs text-slate-500">
          Event {failure.eventId} · {failure.status}
        </div>
      </div>
      <div className="text-xs text-slate-500">{formatDateTime(failure.createdAt)}</div>
    </div>
  );
}

export default function AdminOrdersClient({
  activeStorefrontLabel,
  initialSearchQuery = "",
  orders,
  webhookFailures,
}: Props) {
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const deferredQuery = useDeferredValue(searchQuery);

  const filteredOrders = useMemo(
    () => orders.filter((order) => matchesOrderSearch(order, deferredQuery)),
    [deferredQuery, orders],
  );

  const activeOrders = useMemo(
    () =>
      filteredOrders
        .filter((order) => !isArchivedOrder(order))
        .toSorted((left, right) => {
          const priorityDelta =
            getOrderQueuePriority(left) - getOrderQueuePriority(right);
          if (priorityDelta !== 0) return priorityDelta;
          return right.createdAt.localeCompare(left.createdAt);
        }),
    [filteredOrders],
  );

  const archivedOrders = useMemo(
    () =>
      filteredOrders
        .filter((order) => isArchivedOrder(order))
        .toSorted((left, right) => right.createdAt.localeCompare(left.createdAt)),
    [filteredOrders],
  );

  const readyToFulfillCount = useMemo(
    () => activeOrders.filter((order) => isReadyToFulfillOrder(order)).length,
    [activeOrders],
  );

  const awaitingPaymentCount = useMemo(
    () => activeOrders.filter((order) => isAwaitingPaymentOrder(order)).length,
    [activeOrders],
  );

  const attentionCount = useMemo(
    () => activeOrders.filter((order) => getOrderQueueTone(order) === "attention").length,
    [activeOrders],
  );

  const paidRevenue = useMemo(
    () =>
      filteredOrders.reduce((sum, order) => {
        if (!isPaidOrder(order)) return sum;
        return sum + order.amountTotal;
      }, 0),
    [filteredOrders],
  );

  const dashboardCurrency = filteredOrders[0]?.currency ?? orders[0]?.currency ?? "EUR";

  return (
    <div className="space-y-6 text-slate-100">
      <AdminPageIntro
        eyebrow="Admin Orders"
        title="Order queue"
        description={`Compact operator view for ${activeStorefrontLabel}. The main queue now focuses on fulfillment and payment triage; refunds, customer actions, and line-item detail stay in the dedicated order view.`}
        actions={<AdminThemeToggle />}
        metrics={
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <AdminMetricCard
              label="Active queue"
              value={String(activeOrders.length)}
              detail="Orders still requiring payment or fulfillment handling."
            />
            <AdminMetricCard
              label="Needs action"
              value={String(attentionCount)}
              detail="Paid orders missing tracking or payment issues requiring review."
            />
            <AdminMetricCard
              label="Awaiting payment"
              value={String(awaitingPaymentCount)}
              detail="Open orders without a paid payment state yet."
            />
            <AdminMetricCard
              label="Paid revenue"
              value={formatPrice(paidRevenue, dashboardCurrency)}
              detail={`${filteredOrders.length} orders shown${deferredQuery.trim() ? " after search filtering" : ""}.`}
            />
          </div>
        }
      />

      <AdminPanel
        title="Search and scope"
        description="Search by order number, customer, email, tracking, source, city, discount code, or item name."
        actions={
          searchQuery.trim() ? (
            <AdminButton tone="secondary" onClick={() => setSearchQuery("")}>
              Clear search
            </AdminButton>
          ) : null
        }
      >
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_220px]">
          <AdminInput
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search orders"
          />
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Storefront
            </div>
            <div className="mt-2 text-sm text-slate-200">{activeStorefrontLabel}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Ready to ship
            </div>
            <div className="mt-2 text-sm text-slate-200">{readyToFulfillCount} orders</div>
          </div>
        </div>
      </AdminPanel>

      {webhookFailures.length > 0 ? (
        <AdminPanel
          eyebrow="Ops"
          title="Webhook failures"
          description="Keep failures visible without mixing them into every row in the order queue."
        >
          <AdminNotice tone="error">
            {webhookFailures.length} recent failed webhook event
            {webhookFailures.length === 1 ? "" : "s"} detected.
          </AdminNotice>
          <div className="mt-4 grid gap-3">
            {webhookFailures.slice(0, 5).map((failure) => (
              <WebhookFailureRow key={failure.id} failure={failure} />
            ))}
          </div>
        </AdminPanel>
      ) : null}

      <AdminPanel
        title={`Active queue (${activeOrders.length})`}
        description="Prioritized for quick scanning. The loudest rows are the ones that most likely need operator action now."
      >
        {activeOrders.length === 0 ? (
          <AdminEmptyState
            title="No active orders"
            description={
              deferredQuery.trim()
                ? "No active orders match the current search."
                : "No active orders require attention right now."
            }
          />
        ) : (
          <div className="grid gap-4">
            {activeOrders.map((order) => (
              <OrderRow key={order.id} order={order} />
            ))}
          </div>
        )}
      </AdminPanel>

      <AdminPanel
        title={`Archived and completed (${archivedOrders.length})`}
        description="Closed orders stay available for lookup, but visually quieter than the working queue."
      >
        {archivedOrders.length === 0 ? (
          <AdminEmptyState
            title="No archived orders"
            description={
              deferredQuery.trim()
                ? "No archived orders match the current search."
                : "Archived orders will appear here once they are fulfilled or refunded."
            }
          />
        ) : (
          <div className="grid gap-4">
            {archivedOrders.map((order) => (
              <OrderRow key={order.id} order={order} />
            ))}
          </div>
        )}
      </AdminPanel>
    </div>
  );
}
