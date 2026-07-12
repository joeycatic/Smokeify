"use client";

import { useDeferredValue, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  AdminButton,
  AdminEmptyState,
  AdminInput,
  AdminMetricCard,
  AdminNotice,
  AdminPageIntro,
  AdminPanel,
} from "@/components/admin/AdminWorkspace";
import { AdminKpiStrip, AdminPage, AdminToolbar } from "@/components/admin/ui";
import type { AdminOrderListPage, AdminOrderRecord, AdminOrderWebhookFailure } from "@/lib/adminOrders";
import {
  ADMIN_STOREFRONT_SCOPE_LABELS,
  type AdminStorefrontScope,
} from "@/lib/storefronts";
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
  type OrderQueueTone,
} from "@/lib/adminOrderQueue";

type Props = {
  activeStorefrontScope: AdminStorefrontScope;
  initialSearchQuery?: string;
  orderPage: AdminOrderListPage;
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
    card: "border-[#e2a136] bg-[var(--adm-surface)]",
    accent: "border-[#e2a136] bg-amber-300/15 text-[#81560e]",
    label: "Needs action",
  },
  progress: {
    card: "border-[var(--adm-primary)] bg-[var(--adm-surface)]",
    accent: "border-[var(--adm-primary)] bg-cyan-300/15 text-[var(--adm-primary)]",
    label: "In progress",
  },
  settled: {
    card: "border-[var(--adm-success)] bg-[var(--adm-surface)]",
    accent: "border-[var(--adm-success)] bg-emerald-300/15 text-[var(--adm-success)]",
    label: "Completed",
  },
  muted: {
    card: "border-[var(--adm-border)] bg-[var(--adm-surface)]",
    accent: "border-[var(--adm-border)] bg-[var(--adm-surface-2)] text-[var(--adm-text)]",
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
      ? "border-[var(--adm-success)] bg-[var(--adm-primary-soft)] text-[var(--adm-success)]"
      : tone === "warning"
        ? "border-[#e2a136] bg-[#fff4dd] text-[#81560e]"
        : tone === "danger"
          ? "border-[var(--adm-error)] bg-[#fae7e3] text-[var(--adm-error)]"
          : tone === "info"
            ? "border-[var(--adm-primary)] bg-[var(--adm-primary-soft)] text-[var(--adm-primary)]"
            : "border-[var(--adm-border)] bg-[var(--adm-surface-2)] text-[var(--adm-text-muted)]";

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
    <div className="min-w-0">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--adm-text-faint)]">
        {label}
      </div>
      <div className="mt-1 truncate text-[13px] text-[var(--adm-text)]">{value}</div>
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
    <article className={`grid min-w-0 gap-3 rounded-xl border p-3 lg:grid-cols-[minmax(17rem,1.35fr)_minmax(8rem,0.7fr)_minmax(8rem,0.7fr)_minmax(8rem,0.7fr)_minmax(9rem,auto)] lg:items-center ${toneClasses.card}`}>
        <div className="min-w-0">
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

          <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <h2 className="font-mono text-base font-semibold tabular-nums text-[var(--adm-text)]">
              #{order.orderNumber}
            </h2>
            <div className="text-sm font-medium text-[var(--adm-text)]">{customerLabel}</div>
            {customerSecondary ? (
              <div className="text-sm text-[var(--adm-text-faint)]">{customerSecondary}</div>
            ) : null}
          </div>

          <div className="mt-1 truncate text-[13px] text-[var(--adm-text-muted)]">{getOrderItemSummary(order)}</div>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[var(--adm-text-faint)]">
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
        <InlineMeta label="Created" value={formatDateTime(order.createdAt)} />
        <InlineMeta label="Source" value={getOrderSourceDetail(order)} />
        <InlineMeta label="Tracking" value={getOrderTrackingSummary(order)} />
        <div className="flex min-w-0 flex-col gap-2 lg:items-end">
          <div className="text-left lg:text-right">
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--adm-text-faint)]">
              Total
            </div>
            <div className="mt-1 font-mono text-base font-semibold tabular-nums text-[var(--adm-text)]">
              {formatPrice(order.amountTotal, order.currency)}
            </div>
          </div>
          <div className="flex gap-1.5">
            <a href={`/api/admin/orders/${order.id}/lieferschein`} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center justify-center rounded-[10px] border border-[var(--adm-border-strong)] px-2.5 text-xs font-semibold text-[var(--adm-text-muted)]">Slip</a>
            <Link href={`/admin/orders/${order.id}`} className="inline-flex h-8 items-center justify-center rounded-[10px] bg-[var(--adm-primary)] px-2.5 text-xs font-semibold text-white">Open</Link>
          </div>
        </div>
    </article>
  );
}

function WebhookFailureRow({ failure }: { failure: AdminOrderWebhookFailure }) {
  return (
    <div className="grid gap-2 rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] px-4 py-4 md:grid-cols-[1fr_auto] md:items-center">
      <div>
        <div className="text-sm font-semibold text-[var(--adm-text)]">{failure.type}</div>
        <div className="mt-1 text-xs text-[var(--adm-text-faint)]">
          Event {failure.eventId} · {failure.status}
        </div>
        {failure.errorMessage ? (
          <div className="mt-2 text-xs text-[var(--adm-error)]">{failure.errorMessage}</div>
        ) : null}
      </div>
      <div className="text-xs text-[var(--adm-text-faint)]">{formatDateTime(failure.createdAt)}</div>
    </div>
  );
}

export default function AdminOrdersClient({
  activeStorefrontScope,
  initialSearchQuery = "",
  orderPage,
  webhookFailures,
}: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const deferredQuery = useDeferredValue(searchQuery);
  const activeStorefrontLabel =
    ADMIN_STOREFRONT_SCOPE_LABELS[activeStorefrontScope];
  const orders = orderPage.orders;

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

  const applyQueryState = (nextSearchQuery: string) => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    const trimmed = nextSearchQuery.trim();
    if (trimmed) {
      params.set("customer", trimmed);
    } else {
      params.delete("customer");
    }
    params.delete("page");
    const queryString = params.toString();
    router.replace(queryString ? `${pathname}?${queryString}` : pathname, {
      scroll: false,
    });
  };

  const changePage = (nextPage: number) => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    if (nextPage <= 1) {
      params.delete("page");
    } else {
      params.set("page", String(nextPage));
    }
    const queryString = params.toString();
    router.replace(queryString ? `${pathname}?${queryString}` : pathname, {
      scroll: false,
    });
  };

  return (
    <AdminPage layout="queue">
      <AdminPageIntro
        eyebrow="Admin Orders"
        title="Order queue"
        description={`Compact operator view for ${activeStorefrontLabel}. The main queue now focuses on fulfillment and payment triage; refunds, customer actions, and line-item detail stay in the dedicated order view.`}
        metrics={
          <AdminKpiStrip>
            <AdminMetricCard
              label="Result set"
              value={String(orderPage.totalCount)}
              detail={`Page ${orderPage.currentPage} of ${orderPage.totalPages}.`}
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
              detail={`${filteredOrders.length} orders shown on this page${orderPage.totalCount > filteredOrders.length ? ` out of ${orderPage.totalCount}` : ""}.`}
            />
          </AdminKpiStrip>
        }
      />

      <AdminToolbar>
        <div className="grid min-w-0 flex-1 gap-2 lg:grid-cols-[minmax(0,1fr)_180px_180px]">
          <AdminInput
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            onBlur={() => applyQueryState(searchQuery)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              applyQueryState(searchQuery);
            }}
            placeholder="Search orders"
          />
          <InlineMeta label="Scope" value={activeStorefrontLabel} />
          <InlineMeta label="Ready to ship" value={`${readyToFulfillCount} orders`} />
        </div>
        {
          searchQuery.trim() ? (
            <AdminButton
              tone="secondary"
              onClick={() => {
                setSearchQuery("");
                applyQueryState("");
              }}
            >
              Clear search
            </AdminButton>
          ) : null
        }
      </AdminToolbar>

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

      {orderPage.totalPages > 1 ? (
        <AdminPanel
          title="Pagination"
          description="Server-framed order pages keep the first load small while preserving storefront and search scope."
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-[var(--adm-text-muted)]">
              Showing page {orderPage.currentPage} of {orderPage.totalPages} for {orderPage.totalCount} matching orders.
            </div>
            <div className="flex gap-2">
              <AdminButton
                tone="secondary"
                disabled={orderPage.currentPage <= 1}
                onClick={() => changePage(orderPage.currentPage - 1)}
              >
                Previous
              </AdminButton>
              <AdminButton
                tone="secondary"
                disabled={orderPage.currentPage >= orderPage.totalPages}
                onClick={() => changePage(orderPage.currentPage + 1)}
              >
                Next
              </AdminButton>
            </div>
          </div>
        </AdminPanel>
      ) : null}
    </AdminPage>
  );
}
