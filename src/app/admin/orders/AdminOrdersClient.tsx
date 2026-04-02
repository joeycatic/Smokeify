"use client";

import { type ReactNode, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import AdminThemeToggle from "@/components/admin/AdminThemeToggle";
import { buildFinanceRollup, buildOrderFinanceBreakdown, buildVatSummary } from "@/lib/adminFinance";
import { getRefundPreviewAmount } from "@/lib/adminRefundCalculator";
import { formatOrderSourceLabel } from "@/lib/orderSource";
import {
  type AdminChartPoint,
  DonutChart,
  HorizontalBarsChart,
  MultiSeriesTrendChart,
  SparklineChart,
} from "@/components/admin/AdminCharts";

type OrderItem = {
  id: string;
  productId?: string | null;
  variantId?: string | null;
  name: string;
  manufacturer?: string | null;
  quantity: number;
  unitAmount: number;
  totalAmount: number;
  baseCostAmount: number;
  paymentFeeAmount: number;
  adjustedCostAmount: number;
  taxAmount: number;
  taxRateBasisPoints?: number | null;
  currency: string;
  imageUrl?: string | null;
  options?: Array<{ name: string; value: string }>;
};

type OrderRow = {
  id: string;
  createdAt: string;
  updatedAt: string;
  sourceStorefront: string | null;
  sourceHost: string | null;
  sourceOrigin: string | null;
  status: string;
  paymentStatus: string;
  paymentMethod: string | null;
  currency: string;
  amountSubtotal: number;
  amountTax: number;
  amountShipping: number;
  amountDiscount: number;
  amountTotal: number;
  amountRefunded: number;
  stripePaymentIntent: string | null;
  trackingCarrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  shippingName: string | null;
  shippingLine1: string | null;
  shippingLine2: string | null;
  shippingPostalCode: string | null;
  shippingCity: string | null;
  shippingCountry: string | null;
  confirmationEmailSentAt: string | null;
  shippingEmailSentAt: string | null;
  refundEmailSentAt: string | null;
  discountCode: string | null;
  customerEmail: string | null;
  user: { email: string | null; name: string | null };
  items: OrderItem[];
};

type WebhookFailure = {
  id: string;
  eventId: string;
  type: string;
  status: string;
  createdAt: string;
};

type Props = {
  activeStorefrontLabel: string;
  initialSearchQuery?: string;
  orders: OrderRow[];
  webhookFailures: WebhookFailure[];
};

const formatPrice = (amount: number, currency: string) =>
  new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount / 100);

const normalizeStatus = (value: string) => value.trim().toLowerCase();
const NON_RELEVANT_ORDER_STATUSES = new Set(["fulfilled", "refunded"]);
const PAID_PAYMENT_STATUSES = new Set([
  "paid",
  "succeeded",
  "refunded",
  "partially_refunded",
]);
const CLOSED_ORDER_STATUSES = new Set(["fulfilled", "refunded", "canceled", "cancelled", "failed"]);
const getOrderEmail = (order: OrderRow) => order.user?.email ?? order.customerEmail;
const formatDayLabel = (value: Date) =>
  new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
  }).format(value);
const formatDelta = (current: number, previous: number) => {
  if (previous <= 0) {
    if (current <= 0) return "0% vs prev 7d";
    return "+100% vs prev 7d";
  }
  const delta = ((current - previous) / previous) * 100;
  const rounded = Math.round(delta * 10) / 10;
  return `${rounded > 0 ? "+" : ""}${rounded}% vs prev 7d`;
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

const buildShippingLines = (order: OrderRow) => {
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
  order: Pick<OrderRow, "sourceStorefront" | "sourceHost" | "sourceOrigin">,
) => formatOrderSourceLabel(order.sourceStorefront, order.sourceHost, order.sourceOrigin);

const getOrderSourceDetail = (
  order: Pick<OrderRow, "sourceStorefront" | "sourceHost" | "sourceOrigin">,
) => {
  const label = getOrderSourceLabel(order);
  if (order.sourceHost && order.sourceHost !== label) {
    return `${label} · ${order.sourceHost}`;
  }
  if (order.sourceOrigin && order.sourceOrigin !== label) {
    return `${label} · ${order.sourceOrigin}`;
  }
  return label;
};

const formatTimelineDate = (value: string) =>
  new Date(value).toLocaleString("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
  });

const buildTimeline = (order: OrderRow) =>
  [
    { label: "Order created", at: order.createdAt },
    {
      label: "Confirmation email sent",
      at: order.confirmationEmailSentAt ?? undefined,
    },
    { label: "Shipping email sent", at: order.shippingEmailSentAt ?? undefined },
    { label: "Refund email sent", at: order.refundEmailSentAt ?? undefined },
    { label: "Last updated", at: order.updatedAt },
  ].filter((entry) => Boolean(entry.at)) as Array<{
    label: string;
    at: string;
  }>;

const getFulfillmentBadge = (status: string, paymentStatus: string) => {
  const normalizedStatus = normalizeStatus(status);
  const normalizedPayment = normalizeStatus(paymentStatus);

  if (normalizedStatus === "fulfilled") {
    return {
      label: "Fulfillment: fulfilled",
      className:
        "orders-status-chip orders-status-chip-fulfillment border-emerald-200 bg-emerald-50 text-emerald-800",
    };
  }
  if (
    ["canceled", "cancelled", "failed", "refunded"].includes(normalizedStatus)
  ) {
    return {
      label: "Fulfillment: closed",
      className:
        "orders-status-chip orders-status-chip-neutral border-stone-200 bg-stone-100 text-stone-700",
    };
  }
  if (normalizedPayment === "paid" || normalizedPayment === "succeeded") {
    return {
      label: "Fulfillment: ready",
      className:
        "orders-status-chip orders-status-chip-info border-sky-200 bg-sky-50 text-sky-800",
    };
  }
  return {
    label: "Fulfillment: not ready",
    className:
      "orders-status-chip orders-status-chip-warning border-amber-200 bg-amber-50 text-amber-800",
  };
};

const ORDER_BADGE_BASE =
  "inline-flex items-center rounded-full border px-3 py-1.5 text-[11px] font-medium leading-none whitespace-nowrap";

const getOrderStatusBadgeClass = (status: string) => {
  const normalizedStatus = normalizeStatus(status);
  if (normalizedStatus === "fulfilled") {
    return `${ORDER_BADGE_BASE} orders-status-chip orders-status-chip-success border-emerald-200 bg-emerald-50 text-emerald-800`;
  }
  if (["canceled", "cancelled", "failed", "refunded"].includes(normalizedStatus)) {
    return `${ORDER_BADGE_BASE} orders-status-chip orders-status-chip-neutral border-stone-200 bg-stone-100 text-stone-700`;
  }
  return `${ORDER_BADGE_BASE} orders-status-chip orders-status-chip-info border-sky-200 bg-sky-50 text-sky-800`;
};

const getPaymentBadgeClass = (paymentStatus: string) => {
  const normalizedPayment = normalizeStatus(paymentStatus);
  if (PAID_PAYMENT_STATUSES.has(normalizedPayment)) {
    return `${ORDER_BADGE_BASE} orders-status-chip orders-status-chip-paid border-amber-200 bg-amber-50 text-amber-800`;
  }
  if (["failed", "canceled", "cancelled"].includes(normalizedPayment)) {
    return `${ORDER_BADGE_BASE} orders-status-chip orders-status-chip-danger border-rose-200 bg-rose-50 text-rose-700`;
  }
  return `${ORDER_BADGE_BASE} orders-status-chip orders-status-chip-neutral border-stone-200 bg-stone-100 text-stone-700`;
};

export default function AdminOrdersClient({
  activeStorefrontLabel,
  initialSearchQuery = "",
  orders,
  webhookFailures,
}: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [statusDrafts, setStatusDrafts] = useState<Record<string, string>>({});
  const [trackingDrafts, setTrackingDrafts] = useState<
    Record<string, { carrier: string; number: string; url: string }>
  >({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [refundId, setRefundId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [shippingEmailSent, setShippingEmailSent] = useState<
    Record<string, boolean>
  >({});
  const [confirmationEmailSent, setConfirmationEmailSent] = useState<
    Record<string, boolean>
  >({});
  const [refundEmailSent, setRefundEmailSent] = useState<Record<string, boolean>>(
    {}
  );
  const [sendingEmail, setSendingEmail] = useState<{
    orderId: string;
    type: "confirmation" | "shipping" | "refund";
  } | null>(null);
  const [refundSelection, setRefundSelection] = useState<
    Record<string, Record<string, number>>
  >({});
  const [confirmRefund, setConfirmRefund] = useState<{
    orderId: string;
    mode: "full" | "items";
  } | null>(null);
  const [refundIncludeShipping, setRefundIncludeShipping] = useState(false);
  const [refundPassword, setRefundPassword] = useState("");
  const [refundPasswordError, setRefundPasswordError] = useState("");
  const [confirmShippingResend, setConfirmShippingResend] = useState<{
    orderId: string;
  } | null>(null);
  const [confirmEmailResend, setConfirmEmailResend] = useState<{
    orderId: string;
    type: "confirmation" | "refund";
  } | null>(null);
  const [hiddenOrderIds, setHiddenOrderIds] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState<{ orderId: string } | null>(
    null
  );
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleteConfirmationError, setDeleteConfirmationError] = useState("");
  const [deletingOrderId, setDeletingOrderId] = useState<string | null>(null);
  const [showRelevantOrders, setShowRelevantOrders] = useState(true);
  const [showArchivedOrders, setShowArchivedOrders] = useState(false);
  const [webhookFailureRows, setWebhookFailureRows] =
    useState<WebhookFailure[]>(webhookFailures);
  const [reprocessingEventId, setReprocessingEventId] = useState<string | null>(
    null
  );
  const [orderUpdatedAtById, setOrderUpdatedAtById] = useState<
    Record<string, string>
  >(() => Object.fromEntries(orders.map((order) => [order.id, order.updatedAt])));

  const visibleOrders = useMemo(
    () => orders.filter((order) => !hiddenOrderIds.includes(order.id)),
    [orders, hiddenOrderIds]
  );
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredOrders = useMemo(() => {
    if (!normalizedQuery) return visibleOrders;
    return visibleOrders.filter((order) => {
      const email = getOrderEmail(order)?.toLowerCase() ?? "";
      const name = order.user?.name?.toLowerCase() ?? "";
      const source = getOrderSourceDetail(order).toLowerCase();
      return (
        order.id.toLowerCase().includes(normalizedQuery) ||
        email.includes(normalizedQuery) ||
        name.includes(normalizedQuery) ||
        source.includes(normalizedQuery)
      );
    });
  }, [visibleOrders, normalizedQuery]);

  const sorted = useMemo(() => filteredOrders, [filteredOrders]);
  const customerSummary = useMemo(() => {
    if (!normalizedQuery) return null;
    const matching = visibleOrders.filter((order) => {
      const email = getOrderEmail(order)?.toLowerCase() ?? "";
      return email && email.includes(normalizedQuery);
    });
    if (!matching.length) return null;
    const total = matching.reduce((sum, order) => sum + order.amountTotal, 0);
    const firstMatch = matching[0];
    return {
      email: firstMatch ? getOrderEmail(firstMatch) : "Unknown",
      orders: matching.length,
      total,
      currency: firstMatch?.currency ?? "EUR",
    };
  }, [visibleOrders, normalizedQuery]);
  const relevantOrders = useMemo(
    () =>
      sorted.filter(
        (order) => !NON_RELEVANT_ORDER_STATUSES.has(normalizeStatus(order.status))
      ),
    [sorted]
  );
  const archivedOrders = useMemo(
    () =>
      sorted.filter((order) =>
        NON_RELEVANT_ORDER_STATUSES.has(normalizeStatus(order.status))
      ),
    [sorted]
  );
  const categorizedOrders = useMemo(
    () => [...relevantOrders, ...archivedOrders],
    [relevantOrders, archivedOrders]
  );
  const paidCount = useMemo(
    () =>
      filteredOrders.reduce((count, order) => {
        const payment = normalizeStatus(order.paymentStatus);
        return payment === "paid" || payment === "succeeded" ? count + 1 : count;
      }, 0),
    [filteredOrders]
  );
  const refundingCount = useMemo(
    () => filteredOrders.filter((order) => order.amountRefunded > 0).length,
    [filteredOrders]
  );
  const openActionCount = useMemo(
    () =>
      filteredOrders.filter((order) => {
        const status = normalizeStatus(order.status);
        return status !== "fulfilled" && status !== "refunded";
      }).length,
    [filteredOrders]
  );
  const statusMix = useMemo(
    () => [
      {
        label: "Open",
        value: openActionCount,
        colorClassName: "#22d3ee",
      },
      {
        label: "Paid",
        value: paidCount,
        colorClassName: "#818cf8",
      },
      {
        label: "Refunded",
        value: refundingCount,
        colorClassName: "#f59e0b",
      },
      {
        label: "Archived",
        value: archivedOrders.length,
        colorClassName: "#475569",
      },
    ],
    [archivedOrders.length, openActionCount, paidCount, refundingCount]
  );
  const dashboardCurrency = sorted[0]?.currency ?? "EUR";
  const paidRevenueCents = useMemo(
    () =>
      filteredOrders.reduce((sum, order) => {
        const payment = normalizeStatus(order.paymentStatus);
        return PAID_PAYMENT_STATUSES.has(payment) ? sum + order.amountTotal : sum;
      }, 0),
    [filteredOrders]
  );
  const averageOrderValueCents = useMemo(
    () => (paidCount > 0 ? Math.round(paidRevenueCents / paidCount) : 0),
    [paidCount, paidRevenueCents]
  );
  const financeSummary = useMemo(
    () =>
      buildFinanceRollup(
        filteredOrders.map((order) => ({
          ...order,
          createdAt: new Date(order.createdAt),
        })),
        dashboardCurrency,
      ),
    [dashboardCurrency, filteredOrders],
  );
  const vatSummary = useMemo(
    () =>
      buildVatSummary(
        filteredOrders.map((order) => ({
          ...order,
          createdAt: new Date(order.createdAt),
        })),
      ),
    [filteredOrders],
  );
  const readyToFulfillCount = useMemo(
    () =>
      filteredOrders.filter((order) => {
        const payment = normalizeStatus(order.paymentStatus);
        const status = normalizeStatus(order.status);
        return PAID_PAYMENT_STATUSES.has(payment) && !CLOSED_ORDER_STATUSES.has(status);
      }).length,
    [filteredOrders]
  );
  const trackingMissingCount = useMemo(
    () =>
      filteredOrders.filter((order) => {
        const status = normalizeStatus(order.status);
        return (
          (status === "fulfilled" || status === "shipped") &&
          !order.trackingNumber?.trim()
        );
      }).length,
    [filteredOrders]
  );
  const confirmationPendingCount = useMemo(
    () =>
      filteredOrders.filter(
        (order) =>
          !(
            confirmationEmailSent[order.id] || Boolean(order.confirmationEmailSentAt)
          )
      ).length,
    [confirmationEmailSent, filteredOrders]
  );
  const shippingPendingCount = useMemo(
    () =>
      filteredOrders.filter((order) => {
        const status = normalizeStatus(order.status);
        return (
          (status === "fulfilled" || status === "shipped") &&
          !(shippingEmailSent[order.id] || Boolean(order.shippingEmailSentAt))
        );
      }).length,
    [filteredOrders, shippingEmailSent]
  );
  const paymentMethodBars = useMemo<AdminChartPoint[]>(() => {
    const byMethod = new Map<string, number>();
    for (const order of filteredOrders) {
      const label = order.paymentMethod?.trim() || "unknown";
      byMethod.set(label, (byMethod.get(label) ?? 0) + 1);
    }
    return Array.from(byMethod.entries())
      .map(([label, count]) => ({ label, value: count }))
      .sort((left, right) => right.value - left.value)
      .slice(0, 6);
  }, [filteredOrders]);
  const websiteSourceBars = useMemo<AdminChartPoint[]>(() => {
    const bySource = new Map<string, number>();
    for (const order of filteredOrders) {
      const label = getOrderSourceLabel(order);
      bySource.set(label, (bySource.get(label) ?? 0) + 1);
    }

    return Array.from(bySource.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((left, right) => right.value - left.value)
      .slice(0, 6);
  }, [filteredOrders]);
  const queueBars = useMemo<AdminChartPoint[]>(
    () => [
      { label: "Open actions", value: openActionCount, secondaryValue: readyToFulfillCount },
      { label: "Tracking missing", value: trackingMissingCount },
      { label: "Confirmation pending", value: confirmationPendingCount },
      { label: "Shipping pending", value: shippingPendingCount },
      { label: "Webhook failures", value: webhookFailureRows.length },
    ],
    [
      confirmationPendingCount,
      openActionCount,
      readyToFulfillCount,
      shippingPendingCount,
      trackingMissingCount,
      webhookFailureRows.length,
    ]
  );
  const orderTrend = useMemo(() => {
    const days = 14;
    const start = new Date();
    start.setDate(start.getDate() - (days - 1));
    start.setHours(0, 0, 0, 0);
    const buckets = Array.from({ length: days }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return {
        key: date.toISOString().slice(0, 10),
        label: formatDayLabel(date),
        created: 0,
        paid: 0,
        fulfilled: 0,
        revenueCents: 0,
      };
    });
    const bucketMap = new Map(buckets.map((bucket) => [bucket.key, bucket]));
    for (const order of filteredOrders) {
      const key = new Date(order.createdAt).toISOString().slice(0, 10);
      const bucket = bucketMap.get(key);
      if (!bucket) continue;
      bucket.created += 1;
      if (PAID_PAYMENT_STATUSES.has(normalizeStatus(order.paymentStatus))) {
        bucket.paid += 1;
        bucket.revenueCents += order.amountTotal;
      }
      if (normalizeStatus(order.status) === "fulfilled") {
        bucket.fulfilled += 1;
      }
    }
    return buckets;
  }, [filteredOrders]);
  const trendLabels = useMemo(() => orderTrend.map((point) => point.label), [orderTrend]);
  const trendSeries = useMemo(
    () => [
      { label: "Created", color: "#38bdf8", values: orderTrend.map((point) => point.created) },
      { label: "Paid", color: "#818cf8", values: orderTrend.map((point) => point.paid) },
      { label: "Fulfilled", color: "#34d399", values: orderTrend.map((point) => point.fulfilled) },
    ],
    [orderTrend]
  );
  const revenueTrend = useMemo<AdminChartPoint[]>(
    () =>
      orderTrend.map((point) => ({
        label: point.label,
        value: point.revenueCents,
      })),
    [orderTrend]
  );
  const periodComparison = useMemo(() => {
    const recent = orderTrend.slice(-7);
    const previous = orderTrend.slice(0, Math.max(orderTrend.length - 7, 0));
    const recentOrders = recent.reduce((sum, point) => sum + point.created, 0);
    const previousOrders = previous.reduce((sum, point) => sum + point.created, 0);
    const recentRevenue = recent.reduce((sum, point) => sum + point.revenueCents, 0);
    const previousRevenue = previous.reduce((sum, point) => sum + point.revenueCents, 0);
    const recentPaid = recent.reduce((sum, point) => sum + point.paid, 0);
    const previousPaid = previous.reduce((sum, point) => sum + point.paid, 0);

    return {
      recentOrders,
      previousOrders,
      recentRevenue,
      previousRevenue,
      recentPaid,
      previousPaid,
      orderDeltaLabel: formatDelta(recentOrders, previousOrders),
      revenueDeltaLabel: formatDelta(recentRevenue, previousRevenue),
      paidDeltaLabel: formatDelta(recentPaid, previousPaid),
    };
  }, [orderTrend]);
  const refundPreview = useMemo(() => {
    if (!confirmRefund) return null;
    const order = visibleOrders.find((entry) => entry.id === confirmRefund.orderId);
    if (!order) return null;
    return {
      order,
      amount: getRefundPreviewAmount(
        order,
        confirmRefund.mode,
        refundSelection[order.id],
        refundIncludeShipping
      ),
      selectedItems:
        confirmRefund.mode === "items"
          ? Object.values(refundSelection[order.id] ?? {}).filter((qty) => qty > 0).length
          : order.items.length,
    };
  }, [confirmRefund, refundIncludeShipping, refundSelection, visibleOrders]);

  const isConfirmationEmailSent = (order: OrderRow) =>
    confirmationEmailSent[order.id] || Boolean(order.confirmationEmailSentAt);

  const isShippingEmailSent = (order: OrderRow) =>
    shippingEmailSent[order.id] || Boolean(order.shippingEmailSentAt);

  const isRefundEmailSent = (order: OrderRow) =>
    refundEmailSent[order.id] || Boolean(order.refundEmailSentAt);

  const updateOrder = async (orderId: string) => {
    setError("");
    setNotice("");
    setSavingId(orderId);
    const status = statusDrafts[orderId];
    const tracking = trackingDrafts[orderId];
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: status || undefined,
          trackingCarrier: tracking?.carrier || undefined,
          trackingNumber: tracking?.number || undefined,
          trackingUrl: tracking?.url || undefined,
          expectedUpdatedAt: orderUpdatedAtById[orderId],
        }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Update failed");
      } else {
        const data = (await res.json()) as { order?: { updatedAt?: string } };
        if (data.order?.updatedAt) {
          setOrderUpdatedAtById((prev) => ({
            ...prev,
            [orderId]: data.order?.updatedAt ?? prev[orderId],
          }));
        }
      }
    } catch {
      setError("Update failed");
    } finally {
      setSavingId(null);
    }
  };

  const saveTrackingDrafts = async (orderId: string) => {
    const tracking = trackingDrafts[orderId];
    if (!tracking) return true;
    setError("");
    setNotice("");
    setSavingId(orderId);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trackingCarrier: tracking.carrier || undefined,
          trackingNumber: tracking.number || undefined,
          trackingUrl: tracking.url || undefined,
          expectedUpdatedAt: orderUpdatedAtById[orderId],
        }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Update failed");
        return false;
      }
      const data = (await res.json()) as { order?: { updatedAt?: string } };
      if (data.order?.updatedAt) {
        setOrderUpdatedAtById((prev) => ({
          ...prev,
          [orderId]: data.order?.updatedAt ?? prev[orderId],
        }));
      }
      return true;
    } catch {
      setError("Update failed");
      return false;
    } finally {
      setSavingId(null);
    }
  };

  const refundOrder = async (
    orderId: string,
    adminPassword: string,
    includeShipping: boolean
  ) => {
    setError("");
    setNotice("");
    setRefundId(orderId);
    try {
      const current = visibleOrders.find((order) => order.id === orderId);
      if (current?.paymentStatus === "refunded") {
        setError("Order has already been refunded.");
        return;
      }
      const res = await fetch(`/api/admin/orders/${orderId}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminPassword, includeShipping }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Refund failed");
      }
    } catch {
      setError("Refund failed");
    } finally {
      setRefundId(null);
    }
  };

  const refundSelectedItems = async (
    orderId: string,
    adminPassword: string,
    includeShipping: boolean
  ) => {
    setError("");
    setNotice("");
    setRefundId(orderId);
    try {
      const selection = refundSelection[orderId];
      if (!selection) {
        setError("Select items to refund.");
        return;
      }
      const items = Object.entries(selection)
        .filter(([, qty]) => qty > 0)
        .map(([id, quantity]) => ({ id, quantity }));
      if (!items.length) {
        setError("Select items to refund.");
        return;
      }
      const res = await fetch(`/api/admin/orders/${orderId}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, adminPassword, includeShipping }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Refund failed");
      }
    } catch {
      setError("Refund failed");
    } finally {
      setRefundId(null);
    }
  };

  const confirmRefundAction = async () => {
    if (!confirmRefund) return;
    const adminPassword = refundPassword.trim();
    const includeShipping = refundIncludeShipping;
    if (!adminPassword) {
      setRefundPasswordError("Bitte Admin-Passwort eingeben.");
      return;
    }
    const { orderId, mode } = confirmRefund;
    setConfirmRefund(null);
    setRefundPassword("");
    setRefundPasswordError("");
    setRefundIncludeShipping(false);
    if (mode === "items") {
      await refundSelectedItems(orderId, adminPassword, includeShipping);
      return;
    }
    await refundOrder(orderId, adminPassword, includeShipping);
  };

  const sendEmail = async (
    orderId: string,
    type: "confirmation" | "shipping" | "refund",
    options?: { force?: boolean }
  ) => {
    setError("");
    setNotice("");
    setSendingEmail({ orderId, type });
    if (type === "shipping" && shippingEmailSent[orderId] && !options?.force) {
      setNotice("Shipping email already sent.");
      setSendingEmail(null);
      return;
    }
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Email failed");
        return;
      }
      if (type === "shipping") {
        setShippingEmailSent((prev) => ({ ...prev, [orderId]: true }));
        setNotice("Shipping email sent.");
        return;
      }
      if (type === "confirmation") {
        setConfirmationEmailSent((prev) => ({ ...prev, [orderId]: true }));
      }
      if (type === "refund") {
        setRefundEmailSent((prev) => ({ ...prev, [orderId]: true }));
      }
      setNotice("Email sent.");
    } catch {
      setError("Email failed");
    } finally {
      setSendingEmail(null);
    }
  };

  const requestShippingEmail = async (orderId: string) => {
    const order = visibleOrders.find((entry) => entry.id === orderId);
    if (order && isShippingEmailSent(order)) {
      setConfirmShippingResend({ orderId });
      return;
    }
    const saved = await saveTrackingDrafts(orderId);
    if (!saved) return;
    await sendEmail(orderId, "shipping");
  };

  const confirmShippingResendAction = async () => {
    if (!confirmShippingResend) return;
    const { orderId } = confirmShippingResend;
    setConfirmShippingResend(null);
    const saved = await saveTrackingDrafts(orderId);
    if (!saved) return;
    await sendEmail(orderId, "shipping", { force: true });
  };

  const requestEmail = async (
    orderId: string,
    type: "confirmation" | "refund"
  ) => {
    const order = visibleOrders.find((entry) => entry.id === orderId);
    const alreadySent =
      order &&
      (type === "confirmation"
        ? isConfirmationEmailSent(order)
        : isRefundEmailSent(order));
    if (alreadySent) {
      setConfirmEmailResend({ orderId, type });
      return;
    }
    await sendEmail(orderId, type);
  };

  const confirmEmailResendAction = async () => {
    if (!confirmEmailResend) return;
    const { orderId, type } = confirmEmailResend;
    setConfirmEmailResend(null);
    await sendEmail(orderId, type, { force: true });
  };

  const deleteOrder = async (orderId: string) => {
    setError("");
    setNotice("");
    setDeletingOrderId(orderId);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: "DELETE" }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Delete failed");
        return;
      }
      setHiddenOrderIds((prev) => [...prev, orderId]);
      if (openId === orderId) setOpenId(null);
      setNotice("Order deleted.");
    } catch {
      setError("Delete failed");
    } finally {
      setDeletingOrderId(null);
    }
  };

  const confirmDeleteAction = async () => {
    if (!confirmDelete) return;
    if (deleteConfirmation.trim() !== "DELETE") {
      setDeleteConfirmationError('Bitte exakt "DELETE" eingeben.');
      return;
    }
    const { orderId } = confirmDelete;
    setConfirmDelete(null);
    setDeleteConfirmation("");
    setDeleteConfirmationError("");
    await deleteOrder(orderId);
  };

  return (
    <div className="admin-legacy-page space-y-6">
      <div className="overflow-hidden rounded-[28px] border border-white/10 bg-[#060b14] text-white shadow-[0_30px_80px_rgba(5,10,20,0.45)]">
        <div className="relative border-b border-white/10 px-6 py-6 lg:px-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.22),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(129,140,248,0.24),_transparent_28%),linear-gradient(135deg,_rgba(8,15,26,0.98),_rgba(12,22,38,0.92))]" />
          <div className="relative flex flex-wrap items-start justify-between gap-6">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold tracking-[0.34em] text-cyan-200/65">
                ADMIN / ORDERS
              </p>
              <div className="mt-3 flex flex-wrap items-end gap-4">
                <h1 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
                  Orders command center
                </h1>
                <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-200">
                  Live ops view
                </span>
                <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-100">
                  {activeStorefrontLabel}
                </span>
              </div>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                Monitor inflow, payment quality, fulfillment pressure, refund exposure
                and VAT impact in one place. Existing actions stay intact, but the top
                layer now reads like an operations console instead of a plain order list.
              </p>
              <div className="mt-5 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 font-semibold text-slate-100">
                  {sorted.length} visible orders
                </span>
                <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 font-semibold text-emerald-200">
                  {formatPrice(financeSummary.netRevenueCents, dashboardCurrency)} net revenue
                </span>
                <span className="rounded-full border border-violet-400/20 bg-violet-400/10 px-3 py-1 font-semibold text-violet-200">
                  {formatPrice(financeSummary.contributionMarginCents, dashboardCurrency)} contribution
                </span>
                <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 font-semibold text-amber-200">
                  {formatPrice(vatSummary.estimatedLiabilityCents, dashboardCurrency)} VAT liability
                </span>
              </div>
            </div>
            <div className="relative flex w-full max-w-md flex-col gap-3">
              <div className="flex justify-end">
                <AdminThemeToggle />
              </div>
              <label className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 shadow-inner shadow-black/30">
                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                  Search scope
                </div>
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search by email or order ID"
                  className="mt-3 h-11 w-full rounded-xl border border-white/10 bg-[#050912] px-4 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-cyan-300/60"
                />
              </label>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                      Revenue pulse
                    </div>
                    <div className="mt-2 text-2xl font-semibold text-white">
                      {formatPrice(paidRevenueCents, dashboardCurrency)}
                    </div>
                    <div className="mt-1 text-xs font-medium text-emerald-300">
                      {periodComparison.revenueDeltaLabel}
                    </div>
                  </div>
                  <div className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-200">
                    paid revenue
                  </div>
                </div>
                <div className="mt-4">
                  <SparklineChart
                    data={revenueTrend}
                    className="border-none bg-transparent p-0"
                    strokeClassName="stroke-emerald-300"
                    fillClassName="fill-emerald-400/10"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid items-start gap-4 px-6 py-6 xl:grid-cols-2 lg:px-8">
          <div className="grid auto-rows-fr gap-4 md:grid-cols-2">
            <SummaryCard
              label="Visible orders"
              value={String(sorted.length)}
              detail="Current query scope"
              change={periodComparison.orderDeltaLabel}
              footnote={`${relevantOrders.length} active queue`}
            />
            <SummaryCard
              label="Net revenue"
              value={formatPrice(financeSummary.netRevenueCents, dashboardCurrency)}
              detail={`${financeSummary.paidOrderCount} paid orders`}
              change={periodComparison.revenueDeltaLabel}
              tone="emerald"
              footnote={`${formatPrice(averageOrderValueCents, dashboardCurrency)} avg basket`}
            />
            <SummaryCard
              label="Contribution margin"
              value={formatPrice(financeSummary.contributionMarginCents, dashboardCurrency)}
              detail={`${Math.round(financeSummary.contributionMarginRatio * 100)}% net margin`}
              change={formatPrice(financeSummary.paymentFeesCents, dashboardCurrency)}
              tone="violet"
              footnote={`${formatPrice(financeSummary.cogsCents, dashboardCurrency)} COGS tracked`}
            />
            <SummaryCard
              label="VAT liability"
              value={formatPrice(vatSummary.estimatedLiabilityCents, dashboardCurrency)}
              detail={`${Math.round(vatSummary.taxCoverageRate * 100)}% sales tax coverage`}
              change={vatSummary.status === "ready_for_handover" ? "Ready" : "Estimated"}
              tone="amber"
              footnote={`${vatSummary.ordersMissingTaxCount} orders missing VAT`}
            />
            <SummaryCard
              label="Action queue"
              value={String(openActionCount)}
              detail={`${trackingMissingCount} tracking gaps`}
              change={`${confirmationPendingCount} emails pending`}
              tone="amber"
              footnote={`${readyToFulfillCount} ready to fulfill`}
            />
          </div>
          <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5 h-full">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-emerald-300/75">
                  Status mix
                </p>
                <h2 className="mt-2 text-sm font-semibold text-white">
                  Query distribution
                </h2>
              </div>
              <div className="h-1 w-12 rounded-full bg-emerald-300/70" />
            </div>
            <div className="mt-4">
              <DonutChart
                data={statusMix}
                totalLabel="Orders"
                totalValue={String(sorted.length)}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-[24px] border border-black/10 bg-gradient-to-br from-[#07111d] via-[#0b1627] to-[#101b2d] p-5 text-white shadow-[0_24px_60px_rgba(10,16,30,0.2)]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-cyan-200/70">
                Throughput trend
              </p>
              <h2 className="mt-2 text-lg font-semibold text-white">
                Orders, paid and fulfilled over the last 14 days
              </h2>
              <p className="mt-2 text-sm text-slate-300">
                See whether intake is outrunning payments or fulfillment and catch queue buildup early.
              </p>
            </div>
            <div className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-200">
              {periodComparison.orderDeltaLabel}
            </div>
          </div>
          <div className="mt-5">
            <MultiSeriesTrendChart
              labels={trendLabels}
              series={trendSeries}
              className="border-none bg-transparent p-0"
            />
          </div>
        </div>

        <div className="grid gap-4">
          <div className="rounded-[24px] border border-black/10 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-stone-500">
                  Queue pressure
                </p>
                <h2 className="mt-2 text-base font-semibold text-stone-900">
                  Fulfillment and communication backlog
                </h2>
              </div>
              <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-700">
                {openActionCount} open
              </span>
            </div>
            <div className="mt-4">
              <HorizontalBarsChart
                data={queueBars}
                colorClassName="bg-gradient-to-r from-cyan-400 via-sky-400 to-indigo-400"
                valueFormatter={(value) => String(value)}
              />
            </div>
          </div>

          <div className="rounded-[24px] border border-black/10 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-stone-500">
                  Payment mix
                </p>
                <h2 className="mt-2 text-base font-semibold text-stone-900">
                  Method usage inside current query
                </h2>
              </div>
              <span className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-violet-700">
                {periodComparison.paidDeltaLabel}
              </span>
            </div>
            <div className="mt-4">
              <HorizontalBarsChart
                data={paymentMethodBars}
                colorClassName="bg-gradient-to-r from-violet-400 via-indigo-400 to-fuchsia-400"
                valueFormatter={(value) => `${value} orders`}
                />
              </div>
            </div>

          <div className="rounded-[24px] border border-black/10 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-stone-500">
                  Website source
                </p>
                <h2 className="mt-2 text-base font-semibold text-stone-900">
                  Which storefront the paid orders came from
                </h2>
              </div>
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700">
                {websiteSourceBars.length} source{websiteSourceBars.length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="mt-4">
              <HorizontalBarsChart
                data={websiteSourceBars}
                colorClassName="bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400"
                valueFormatter={(value) => `${value} orders`}
              />
            </div>
          </div>
        </div>
      </div>

      {customerSummary && (
        <div className="rounded-[22px] border border-sky-200/80 bg-gradient-to-r from-sky-50 via-cyan-50 to-white p-4 text-sm text-sky-900 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.25em] text-sky-700/70">
                Customer snapshot
              </div>
              <div className="mt-2 text-base font-semibold">
                {customerSummary.email}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
              <span className="rounded-full border border-sky-200 bg-white px-3 py-1 text-sky-700">
                {customerSummary.orders} orders
              </span>
              <span className="rounded-full border border-sky-200 bg-white px-3 py-1 text-sky-700">
                {formatPrice(customerSummary.total, customerSummary.currency)}
              </span>
            </div>
          </div>
        </div>
      )}
      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm">
          {error}
        </div>
      )}
      {notice && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 shadow-sm">
          {notice}
        </div>
      )}
      {webhookFailureRows.length > 0 && (
        <div className="rounded-[24px] border border-rose-200 bg-gradient-to-r from-rose-50 via-white to-rose-50 p-5 text-sm text-rose-800 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.25em] text-rose-700/70">
                Stripe webhook failures
              </div>
              <div className="mt-2 text-base font-semibold">
                {webhookFailureRows.length} failed event
                {webhookFailureRows.length === 1 ? "" : "s"}
              </div>
            </div>
            <div className="text-xs text-rose-700">
              Replays are safe; Stripe will retry automatically.
            </div>
          </div>
          <div className="mt-4 space-y-2 text-xs text-rose-800">
            {webhookFailureRows.map((event) => (
              <div
                key={event.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-rose-200 bg-white/80 px-4 py-3"
              >
                <div className="font-semibold">{event.type}</div>
                <div className="text-rose-700">{event.eventId}</div>
                <div className="text-rose-700">
                  {new Date(event.createdAt).toLocaleString("de-DE")}
                </div>
                <button
                  type="button"
                  disabled={reprocessingEventId === event.eventId}
                  onClick={async () => {
                    setError("");
                    setNotice("");
                    setReprocessingEventId(event.eventId);
                    try {
                      const res = await fetch(
                        "/api/admin/webhooks/stripe/reprocess",
                        {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ eventId: event.eventId }),
                        }
                      );
                      if (!res.ok) {
                        const data = (await res.json()) as { error?: string };
                        setError(data.error ?? "Webhook reprocess failed.");
                        return;
                      }
                      setWebhookFailureRows((prev) =>
                        prev.filter((row) => row.eventId !== event.eventId)
                      );
                      setNotice(`Webhook ${event.eventId} reprocessed.`);
                    } catch {
                      setError("Webhook reprocess failed.");
                    } finally {
                      setReprocessingEventId(null);
                    }
                  }}
                  className="h-9 rounded-xl border border-rose-300 bg-rose-100 px-3 text-[11px] font-semibold text-rose-800 hover:bg-rose-200 disabled:opacity-60"
                >
                  {reprocessingEventId === event.eventId
                    ? "Reprocessing..."
                    : "Reprocess"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-2">
          <button
            type="button"
            onClick={() => setShowRelevantOrders((prev) => !prev)}
            className="orders-queue-card orders-queue-card-active rounded-[22px] border border-cyan-200/80 bg-gradient-to-r from-cyan-50 via-white to-emerald-50 p-4 text-left shadow-sm transition hover:border-cyan-300"
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-700/70">
                  Action queue
                </div>
                <div className="mt-2 text-lg font-semibold text-stone-900">
                  Non-fulfilled ({relevantOrders.length})
                </div>
                <div className="mt-1 text-sm text-stone-600">
                  Ready to ship, awaiting updates or still in payment resolution.
                </div>
              </div>
              <span className="orders-queue-pill rounded-full border border-cyan-300 bg-white px-3 py-1 text-xs font-semibold text-cyan-800">
                {showRelevantOrders ? "Collapse" : "Expand"}
              </span>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setShowArchivedOrders((prev) => !prev)}
            className="orders-queue-card orders-queue-card-archived rounded-[22px] border border-stone-200 bg-gradient-to-r from-stone-100 via-white to-stone-50 p-4 text-left shadow-sm transition hover:border-stone-300"
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-500">
                  Archive stream
                </div>
                <div className="mt-2 text-lg font-semibold text-stone-900">
                  Fulfilled / Refunded ({archivedOrders.length})
                </div>
                <div className="mt-1 text-sm text-stone-600">
                  Closed orders that remain searchable without crowding the active queue.
                </div>
              </div>
              <span className="orders-queue-pill orders-queue-pill-muted rounded-full border border-stone-300 bg-white px-3 py-1 text-xs font-semibold text-stone-700">
                {showArchivedOrders ? "Collapse" : "Expand"}
              </span>
            </div>
          </button>
        </div>
        {categorizedOrders.map((order) => {
          const isOpen = openId === order.id;
          const normalizedStatus = normalizeStatus(order.status);
          const isArchived = NON_RELEVANT_ORDER_STATUSES.has(normalizedStatus);
          const archivedLabel =
            normalizedStatus === "refunded"
              ? "Refunded: no action needed"
              : "Fulfilled: no action needed";
          if ((isArchived && !showArchivedOrders) || (!isArchived && !showRelevantOrders)) {
            return null;
          }
          const tracking = trackingDrafts[order.id] ?? {
            carrier: order.trackingCarrier ?? "",
            number: order.trackingNumber ?? "",
            url: order.trackingUrl ?? "",
          };
          const status = statusDrafts[order.id] ?? order.status;
          const fulfillmentBadge = getFulfillmentBadge(
            order.status,
            order.paymentStatus
          );
          const shippingLines = buildShippingLines(order);
          const finance = buildOrderFinanceBreakdown({
            ...order,
            createdAt: new Date(order.createdAt),
          });
          const orderDate = new Date(order.createdAt).toLocaleDateString("de-DE");
          const updatedDate = new Date(order.updatedAt).toLocaleDateString("de-DE");
          const orderEmail = getOrderEmail(order) ?? "No email";
          const sourceLabel = getOrderSourceLabel(order);
          const fulfillmentLabel = fulfillmentBadge.label.replace("Fulfillment: ", "");
          const paymentDetail = order.paymentMethod
            ? order.stripePaymentIntent
              ? `${order.paymentMethod} · Stripe linked`
              : order.paymentMethod
            : order.stripePaymentIntent
              ? "Stripe linked"
              : "No payment method captured";
          const fulfillmentDetail = tracking.number
            ? [tracking.carrier, tracking.number].filter(Boolean).join(" · ")
            : isShippingEmailSent(order)
              ? "Shipping email sent"
              : "No tracking update yet";

          return (
            <div
              key={order.id}
              className={`orders-order-surface rounded-[24px] border p-5 shadow-sm transition ${
                isArchived
                  ? "orders-order-surface-archived border-stone-300 bg-gradient-to-br from-stone-100 via-white to-stone-100/80 text-stone-500 ring-1 ring-inset ring-stone-300/70"
                  : "border-black/10 bg-gradient-to-br from-white via-white to-cyan-50/40"
              }`}
            >
              {isArchived && (
                <div className="orders-archive-banner mb-4 flex items-center justify-between rounded-2xl border border-stone-300 bg-stone-200/80 px-4 py-3">
                  <span className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-700">
                    {archivedLabel}
                  </span>
                  <span className="orders-archive-badge rounded-full border border-stone-400 bg-stone-100 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-stone-700">
                    Archived
                  </span>
                </div>
              )}
              <button
                type="button"
                onClick={() => setOpenId(isOpen ? null : order.id)}
                className="grid w-full gap-6 text-left xl:grid-cols-[minmax(0,1.4fr)_280px]"
              >
                <div className="min-w-0 space-y-5">
                  <div className="flex flex-wrap items-center gap-2 border-b border-black/10 pb-4">
                    <span className="orders-meta-chip rounded-full border border-black/10 bg-black/[0.03] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-700">
                      Order {order.id.slice(0, 8).toUpperCase()}
                    </span>
                    <span className="orders-meta-chip rounded-full border border-black/10 bg-white px-3 py-1 text-[11px] font-medium text-stone-600">
                      {orderDate}
                    </span>
                    {isArchived ? (
                      <span className="orders-meta-chip rounded-full border border-stone-300 bg-stone-100 px-3 py-1 text-[11px] font-medium text-stone-700">
                        Archived
                      </span>
                    ) : null}
                  </div>
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(240px,0.95fr)]">
                    <div className="min-w-0">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-500">
                        Customer
                      </div>
                      <div className="mt-2 break-all text-lg font-semibold text-stone-950">
                        {orderEmail}
                      </div>
                      {shippingLines.length ? (
                        <div className="mt-2 text-sm text-stone-600">
                          {shippingLines[0]}
                          {shippingLines.length > 1
                            ? ` · ${shippingLines.slice(1).join(", ")}`
                            : ""}
                        </div>
                      ) : (
                        <div className="mt-2 text-sm text-stone-500">
                          No shipping address captured
                        </div>
                      )}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-black/10 bg-white/70 px-4 py-3">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-500">
                          Website
                        </div>
                        <div className="mt-2 text-sm font-semibold text-stone-900">
                          {sourceLabel}
                        </div>
                        <div className="mt-1 text-xs text-stone-500">
                          {order.sourceHost && order.sourceHost !== sourceLabel
                            ? order.sourceHost
                            : order.sourceOrigin ?? "No host captured"}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-black/10 bg-white/70 px-4 py-3">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-500">
                          Payment
                        </div>
                        <div className="mt-2 text-sm font-semibold text-stone-900">
                          {order.paymentStatus}
                        </div>
                        <div className="mt-1 text-xs text-stone-500">{paymentDetail}</div>
                      </div>
                    </div>
                  </div>
                  <div className="orders-status-panel grid gap-3 rounded-[22px] border border-black/10 bg-stone-50/80 p-4 md:grid-cols-3">
                    <OrderStateBlock
                      label="Order status"
                      value={order.status}
                      badgeClass={getOrderStatusBadgeClass(order.status)}
                      detail={`Updated ${updatedDate}`}
                    />
                    <OrderStateBlock
                      label="Payment"
                      value={order.paymentStatus}
                      badgeClass={getPaymentBadgeClass(order.paymentStatus)}
                      detail={paymentDetail}
                    />
                    <OrderStateBlock
                      label="Fulfillment"
                      value={fulfillmentLabel}
                      badgeClass={`${ORDER_BADGE_BASE} ${fulfillmentBadge.className}`}
                      detail={fulfillmentDetail}
                    />
                  </div>
                  {!isOpen && (
                    <div className="orders-overview-stats grid gap-x-6 gap-y-4 border-t border-black/10 pt-4 sm:grid-cols-2 xl:grid-cols-5">
                      <OrderOverviewStat
                        label="Items"
                        value={String(order.items.length)}
                        detail={
                          order.items.length === 1
                            ? "single line item"
                            : "line items in order"
                        }
                      />
                      <OrderOverviewStat
                        label="Website"
                        value={sourceLabel}
                        detail={order.sourceHost ?? "no host captured"}
                      />
                      <OrderOverviewStat
                        label="Refunded"
                        value={formatPrice(order.amountRefunded, order.currency)}
                        detail="already returned to customer"
                      />
                      <OrderOverviewStat
                        label="Net revenue"
                        value={formatPrice(finance.netRevenueCents, order.currency)}
                        detail="after VAT and refunds"
                      />
                      <OrderOverviewStat
                        label="Contribution"
                        value={formatPrice(finance.contributionMarginCents, order.currency)}
                        detail="after fees and COGS"
                        valueClassName={
                          finance.contributionMarginCents < 0
                            ? "text-rose-700"
                            : finance.contributionMarginCents > 0
                              ? "text-emerald-800"
                              : "text-stone-900"
                        }
                      />
                    </div>
                  )}
                </div>
                <div className="orders-total-panel flex min-w-[220px] flex-col justify-between rounded-[24px] border border-black/10 bg-[#08111d] px-5 py-5 text-left text-white">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                      Total value
                    </div>
                    <div className="mt-3 text-[clamp(2rem,3vw,2.5rem)] font-semibold leading-none text-white">
                      {formatPrice(order.amountTotal, order.currency)}
                    </div>
                    <div className="mt-3 text-sm text-slate-300">
                      {order.items.length} {order.items.length === 1 ? "item" : "items"} in
                      this order
                    </div>
                  </div>
                  <div className="mt-5 space-y-3 border-t border-white/10 pt-4 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-slate-400">Updated</span>
                      <span className="font-medium text-white">{updatedDate}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-slate-400">Net revenue</span>
                      <span className="font-medium text-white">
                        {formatPrice(finance.netRevenueCents, order.currency)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-slate-400">Refunded</span>
                      <span className="font-medium text-white">
                        {formatPrice(order.amountRefunded, order.currency)}
                      </span>
                    </div>
                  </div>
                  <div className="mt-5 inline-flex items-center justify-center rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-200">
                    {isOpen ? "Hide details" : "View details"}
                  </div>
                </div>
              </button>

              {isOpen && (
                <div className="mt-4 space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <OrderHealthCard
                      label="Payment"
                      value={order.paymentStatus}
                      detail={order.stripePaymentIntent ? "Stripe linked" : "No PI linked"}
                    />
                    <OrderHealthCard
                      label="Website"
                      value={getOrderSourceLabel(order)}
                      detail={order.sourceHost ?? "No host captured"}
                    />
                    <OrderHealthCard
                      label="Fulfillment"
                      value={fulfillmentBadge.label.replace("Fulfillment: ", "")}
                      detail={tracking.number ? "Tracking added" : "Tracking missing"}
                    />
                    <OrderHealthCard
                      label="Communication"
                      value={`${[
                        isConfirmationEmailSent(order),
                        isShippingEmailSent(order),
                        isRefundEmailSent(order),
                      ].filter(Boolean).length}/3`}
                      detail="Confirmation, shipping, refund"
                    />
                    <OrderHealthCard
                      label="Refund exposure"
                      value={formatPrice(order.amountRefunded, order.currency)}
                      detail={`Remaining ${formatPrice(
                        Math.max(order.amountTotal - order.amountRefunded, 0),
                        order.currency
                      )}`}
                    />
                  </div>

                  <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                    <div className="rounded-2xl border border-black/10 bg-white p-4">
                      <div className="flex items-center justify-between text-xs font-semibold text-stone-600">
                        <span>Financial breakdown</span>
                        <span className="rounded-full border border-cyan-200 bg-cyan-50 px-2 py-0.5 text-[10px] text-cyan-700">
                          {finance.recognized ? "Recognized" : "Pending payment"}
                        </span>
                      </div>
                      <div className="mt-3 space-y-1 text-sm text-stone-700">
                        <div className="flex items-center justify-between">
                          <span>Gross order</span>
                          <span>{formatPrice(finance.grossOrderCents, order.currency)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Refunded gross</span>
                          <span>{formatPrice(finance.refundedGrossCents, order.currency)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Output VAT</span>
                          <span>{formatPrice(finance.netOutputVatCents, order.currency)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Net revenue</span>
                          <span>{formatPrice(finance.netRevenueCents, order.currency)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>COGS</span>
                          <span>{formatPrice(finance.cogsCents, order.currency)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Payment fees</span>
                          <span>{formatPrice(finance.paymentFeesCents, order.currency)}</span>
                        </div>
                        <div className="mt-2 flex items-center justify-between rounded-lg bg-stone-50 px-2 py-1 font-semibold">
                          <span>Contribution margin</span>
                          <span>{formatPrice(finance.contributionMarginCents, order.currency)}</span>
                        </div>
                      </div>
                      <div className="mt-3 text-xs text-stone-500">
                        Refund VAT is estimated proportionally from refunded gross.
                      </div>
                    </div>

                    <div className="rounded-2xl border border-black/10 bg-white p-4">
                      <div className="flex items-center justify-between text-xs font-semibold text-stone-600">
                        <span>VAT snapshot</span>
                        <span className="rounded-full border border-black/10 bg-stone-50 px-2 py-0.5 text-[10px] text-stone-700">
                          Istversteuerung
                        </span>
                      </div>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <OrderHealthCard
                          label="VAT due"
                          value={formatPrice(finance.netOutputVatCents, order.currency)}
                          detail="recognized on paid orders"
                        />
                        <OrderHealthCard
                          label="Tax coverage"
                          value={finance.outputVatCents > 0 ? "Complete" : "Missing"}
                          detail={
                            finance.outputVatCents > 0
                              ? "order tax captured"
                              : "missing order VAT amount"
                          }
                        />
                        <OrderHealthCard
                          label="Shipping charged"
                          value={formatPrice(finance.shippingCollectedCents, order.currency)}
                          detail="customer-facing shipping line"
                        />
                        <OrderHealthCard
                          label="Margin rate"
                          value={`${Math.round(finance.contributionMarginRatio * 100)}%`}
                          detail="net revenue after costs"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-[1.15fr_1fr_0.85fr]">
                    <div className="rounded-2xl border border-black/10 bg-gradient-to-br from-white via-stone-50 to-emerald-50/60 p-5 shadow-sm">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-emerald-700/70">
                            Quick Actions
                          </p>
                          <h3 className="mt-2 text-sm font-semibold text-stone-900">
                            Status & confirmation
                          </h3>
                        </div>
                        <div className="h-1 w-12 rounded-full bg-emerald-400/70" />
                      </div>
                      <div className="mt-4 rounded-xl border border-emerald-100/70 bg-white/70 px-4 py-3 text-center">
                        <label className="text-xs font-semibold text-stone-600 text-center">
                          Status
                          <input
                            value={status}
                            onChange={(event) =>
                              setStatusDrafts((prev) => ({
                                ...prev,
                                [order.id]: event.target.value,
                              }))
                            }
                            className="mt-2 h-10 w-full max-w-[220px] rounded-md border border-black/10 bg-white px-3 text-center text-sm shadow-inner"
                          />
                          <span className="mt-2 block text-[11px] font-normal text-stone-500">
                            Tip: &quot;complete&quot; is the Stripe checkout
                            status. Use &quot;fulfilled&quot; once the order is
                            shipped.
                          </span>
                        </label>
                      </div>
                      <div className="mt-4 grid gap-2 sm:grid-cols-2">
                        <Link
                          href={`/admin/orders/${order.id}`}
                          className="inline-flex h-10 w-full items-center justify-center rounded-md border border-black/10 bg-white px-4 text-xs font-semibold text-stone-700 hover:border-black/20"
                        >
                          Open detail workspace
                        </Link>
                        <button
                          type="button"
                          onClick={() => updateOrder(order.id)}
                          className="h-10 w-full rounded-md bg-[#2f3e36] px-4 text-xs font-semibold text-white hover:bg-[#24312b]"
                          disabled={savingId === order.id}
                        >
                          {savingId === order.id ? "Saving..." : "Save changes"}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setStatusDrafts((prev) => ({
                              ...prev,
                              [order.id]: "fulfilled",
                            }))
                          }
                          className="h-10 w-full rounded-md border border-emerald-200 px-3 text-xs font-semibold text-emerald-800 hover:border-emerald-300"
                        >
                          Mark fulfilled
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setStatusDrafts((prev) => ({
                              ...prev,
                              [order.id]: "canceled",
                            }))
                          }
                          className="h-10 w-full rounded-md border border-amber-200 px-3 text-xs font-semibold text-amber-800 hover:border-amber-300"
                        >
                          Mark canceled
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDeleteConfirmation("");
                            setDeleteConfirmationError("");
                            setConfirmDelete({ orderId: order.id });
                          }}
                          className="h-10 w-full rounded-md border border-red-200 bg-red-50 px-3 text-xs font-semibold text-red-700 hover:border-red-300"
                          disabled={deletingOrderId === order.id}
                        >
                          {deletingOrderId === order.id
                            ? "Deleting..."
                            : "Delete order"}
                        </button>
                        <button
                          type="button"
                          onClick={() => requestEmail(order.id, "confirmation")}
                          className="h-10 w-full rounded-md border border-black/10 px-3 text-xs font-semibold text-stone-700 hover:border-black/20"
                          disabled={
                            sendingEmail?.orderId === order.id &&
                            sendingEmail?.type === "confirmation"
                          }
                        >
                          {sendingEmail?.orderId === order.id &&
                          sendingEmail?.type === "confirmation"
                            ? "Sending..."
                            : isConfirmationEmailSent(order)
                            ? "Resend confirmation"
                            : "Send confirmation"}
                        </button>
                        <a
                          href={`/api/orders/${order.id}/invoice`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex h-10 w-full items-center justify-center rounded-md border border-sky-200 bg-sky-50 px-3 text-xs font-semibold text-sky-800 hover:border-sky-300"
                        >
                          Download invoice
                        </a>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-black/10 bg-white p-4">
                      <div className="text-xs font-semibold text-stone-600">
                        Shipping information
                      </div>
                      <div className="mt-3 space-y-3 text-sm text-stone-700">
                        {shippingLines.length > 0 ? (
                          <div className="rounded-xl border border-black/10 bg-stone-50 px-3 py-2">
                            {shippingLines.map((line, index) => (
                              <div key={`${line}-${index}`}>{line}</div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-xs text-stone-500">
                            No shipping address yet.
                          </div>
                        )}
                        <div className="grid gap-2 sm:grid-cols-2">
                          <label className="text-xs font-semibold text-stone-600">
                            Tracking carrier
                            <input
                              value={tracking.carrier}
                              onChange={(event) =>
                                setTrackingDrafts((prev) => ({
                                  ...prev,
                                  [order.id]: {
                                    ...tracking,
                                    carrier: event.target.value,
                                  },
                                }))
                              }
                              className="mt-1 h-10 w-full rounded-md border border-black/15 bg-white px-3 text-sm"
                            />
                          </label>
                          <label className="text-xs font-semibold text-stone-600">
                            Tracking number
                            <input
                              value={tracking.number}
                              onChange={(event) =>
                                setTrackingDrafts((prev) => ({
                                  ...prev,
                                  [order.id]: {
                                    ...tracking,
                                    number: event.target.value,
                                  },
                                }))
                              }
                              className="mt-1 h-10 w-full rounded-md border border-black/15 bg-white px-3 text-sm"
                            />
                          </label>
                          <label className="text-xs font-semibold text-stone-600 sm:col-span-2">
                            Tracking URL
                            <input
                              value={tracking.url}
                              onChange={(event) =>
                                setTrackingDrafts((prev) => ({
                                  ...prev,
                                  [order.id]: {
                                    ...tracking,
                                    url: event.target.value,
                                  },
                                }))
                              }
                              className="mt-1 h-10 w-full rounded-md border border-black/15 bg-white px-3 text-sm"
                            />
                          </label>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => requestShippingEmail(order.id)}
                            className="h-9 rounded-md border border-sky-200 px-3 text-xs font-semibold text-sky-700 hover:border-sky-300"
                            disabled={
                              sendingEmail?.orderId === order.id &&
                              sendingEmail?.type === "shipping"
                            }
                          >
                            {sendingEmail?.orderId === order.id &&
                            sendingEmail?.type === "shipping"
                              ? "Sending..."
                              : isShippingEmailSent(order)
                              ? "Resend shipping"
                              : "Send shipping"}
                          </button>
                          {isShippingEmailSent(order) && (
                            <span className="text-[11px] text-stone-500">
                              Already sent. Resending will notify the customer
                              again.
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-black/10 bg-white p-4">
                      <div className="flex items-center justify-between text-xs font-semibold text-stone-600">
                        <span>Totals</span>
                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] text-emerald-700">
                          {order.currency}
                        </span>
                      </div>
                      <div className="mt-3 space-y-1 text-sm text-stone-700">
                        <div className="flex items-center justify-between">
                          <span>Subtotal</span>
                          <span>
                            {formatPrice(order.amountSubtotal, order.currency)}
                          </span>
                        </div>
                        {order.amountDiscount > 0 && (
                          <div className="flex items-center justify-between">
                            <span>
                              Discount
                              {order.discountCode
                                ? ` (${order.discountCode})`
                                : ""}
                            </span>
                            <span>
                              -
                              {formatPrice(
                                order.amountDiscount,
                                order.currency
                              )}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center justify-between">
                          <span>Shipping</span>
                          <span>
                            {formatPrice(order.amountShipping, order.currency)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Tax</span>
                          <span>
                            {formatPrice(order.amountTax, order.currency)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Refunded</span>
                          <span>
                            {formatPrice(order.amountRefunded, order.currency)}
                          </span>
                        </div>
                        <div className="mt-2 flex items-center justify-between rounded-lg bg-stone-50 px-2 py-1 font-semibold">
                          <span>Total</span>
                          <span>
                            {formatPrice(order.amountTotal, order.currency)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-black/10 bg-white p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-700/70">
                          Timeline
                        </p>
                        <h3 className="mt-2 text-sm font-semibold text-stone-900">
                          Order activity
                        </h3>
                      </div>
                      <div className="h-1 w-10 rounded-full bg-emerald-400/70" />
                    </div>
                    <ol className="mt-4 space-y-3">
                      {buildTimeline(order).map((entry, index) => (
                        <li key={`${order.id}-${index}`} className="flex gap-3">
                          <span className="mt-1 h-2.5 w-2.5 rounded-full bg-emerald-500" />
                          <div>
                            <div className="text-sm font-semibold text-stone-800">
                              {entry.label}
                            </div>
                            <div className="text-xs text-stone-500">
                              {formatTimelineDate(entry.at)}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ol>
                  </div>

                  <div>
                    <div className="text-xs font-semibold text-stone-600 mb-2">
                      Items
                    </div>
                    <div className="space-y-2">
                      {order.items.map((item) => {
                        const itemName = formatOrderItemName(
                          item.name,
                          item.manufacturer
                        );
                        const productHref = item.productId
                          ? `/admin/catalog/${item.productId}`
                          : null;
                        const selection = refundSelection[order.id] ?? {};
                        const selectedQty = selection[item.id] ?? 0;
                        const isSelected = selectedQty > 0;
                        const itemContribution =
                          item.totalAmount -
                          Math.max(item.baseCostAmount, 0) -
                          Math.max(
                            item.paymentFeeAmount,
                            item.adjustedCostAmount - item.baseCostAmount,
                          );
                        const itemImage = item.imageUrl ? (
                          <Image
                            src={item.imageUrl}
                            alt={itemName}
                            className={`h-10 w-10 rounded-lg border border-black/10 object-cover ${
                              productHref
                                ? "transition hover:border-emerald-300"
                                : ""
                            }`}
                            width={40}
                            height={40}
                            sizes="40px"
                          />
                        ) : null;
                        return (
                          <div
                            key={item.id}
                            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
                          >
                            <div className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(event) =>
                                  setRefundSelection((prev) => ({
                                    ...prev,
                                    [order.id]: {
                                      ...selection,
                                      [item.id]: event.target.checked ? 1 : 0,
                                    },
                                  }))
                                }
                              />
                              {itemImage ? (
                                productHref ? (
                                  <Link href={productHref} className="block">
                                    {itemImage}
                                  </Link>
                                ) : (
                                  itemImage
                                )
                              ) : (
                                <div className="h-10 w-10 rounded-lg border border-black/10 bg-stone-100" />
                              )}
                              <div>
                                {productHref ? (
                                  <Link
                                    href={productHref}
                                    className="font-semibold text-stone-900 underline-offset-2 hover:text-emerald-700 hover:underline"
                                  >
                                    {itemName}
                                  </Link>
                                ) : (
                                  <div className="font-semibold">{itemName}</div>
                                )}
                                {item.options && item.options.length > 0 && (
                                  <div className="text-[11px] text-stone-500">
                                    {formatItemOptions(item.options)}
                                  </div>
                                )}
                                <div className="text-xs text-stone-500">
                                  Qty {item.quantity} · Cost {formatPrice(item.baseCostAmount, item.currency)} · Margin {formatPrice(itemContribution, item.currency)}
                                </div>
                              </div>
                            </div>
                            <div className="ml-auto flex items-center gap-3">
                              {item.quantity > 1 && (
                                <input
                                  type="number"
                                  min={0}
                                  max={item.quantity}
                                  value={selectedQty}
                                  onChange={(event) =>
                                    setRefundSelection((prev) => ({
                                      ...prev,
                                      [order.id]: {
                                        ...selection,
                                        [item.id]: Number(event.target.value),
                                      },
                                    }))
                                  }
                                  className="h-7 w-12 rounded-md border border-black/10 px-0 text-[11px] text-center"
                                />
                              )}
                              <div className="w-20 text-right text-sm font-semibold">
                                {formatPrice(item.totalAmount, item.currency)}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-4 rounded-xl border border-rose-100 bg-rose-50/60 px-3 py-3">
                      <div className="flex flex-wrap items-center justify-center gap-3">
                        <p className="text-xs text-stone-600">
                          Set a quantity per item to refund.
                        </p>
                      <button
                        type="button"
                        onClick={() => {
                          setRefundPassword("");
                          setRefundPasswordError("");
                          setRefundIncludeShipping(false);
                          setConfirmRefund({ orderId: order.id, mode: "items" });
                        }}
                        className="h-9 rounded-md border border-red-200 bg-red-50 px-3 text-xs font-semibold text-red-700"
                        disabled={refundId === order.id}
                      >
                        {refundId === order.id
                          ? "Refunding..."
                          : "Refund selected items"}
                      </button>
                      <button
                        type="button"
                        onClick={() => requestEmail(order.id, "refund")}
                        className="h-9 rounded-md border border-rose-200 px-3 text-xs font-semibold text-rose-700 hover:border-rose-300"
                        disabled={
                          sendingEmail?.orderId === order.id &&
                          sendingEmail?.type === "refund"
                        }
                      >
                        {sendingEmail?.orderId === order.id &&
                        sendingEmail?.type === "refund"
                          ? "Sending..."
                          : isRefundEmailSent(order)
                          ? "Resend refund"
                          : "Send refund"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRefundPassword("");
                          setRefundPasswordError("");
                          setRefundIncludeShipping(true);
                          setConfirmRefund({ orderId: order.id, mode: "full" });
                        }}
                        className="h-9 rounded-md border border-red-200 bg-red-50 px-3 text-xs font-semibold text-red-700"
                        disabled={refundId === order.id}
                      >
                        {refundId === order.id ? "Refunding..." : "Full refund"}
                      </button>
                    </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            onClick={() => setConfirmDelete(null)}
            aria-label="Close dialog"
          />
          <div className="relative w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-stone-900">
              Bestellung wirklich löschen?
            </h3>
            <p className="mt-2 text-sm text-stone-600">
              Dieser Vorgang ist endgültig. Tippe{" "}
              <span className="font-semibold">DELETE</span> zur Bestätigung.
            </p>
            <input
              type="text"
              value={deleteConfirmation}
              onChange={(event) => {
                setDeleteConfirmation(event.target.value);
                if (deleteConfirmationError) setDeleteConfirmationError("");
              }}
              className="mt-4 h-10 w-full rounded-md border border-black/10 px-3 text-sm outline-none focus:border-black/30"
              placeholder="DELETE"
            />
            {deleteConfirmationError && (
              <p className="mt-2 text-xs text-red-600">
                {deleteConfirmationError}
              </p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="h-10 rounded-md border border-black/10 px-4 text-sm font-semibold text-stone-700"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={confirmDeleteAction}
                className="h-10 rounded-md bg-red-600 px-4 text-sm font-semibold text-white"
              >
                Löschen
              </button>
            </div>
          </div>
        </div>
      )}
      {confirmRefund && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            onClick={() => setConfirmRefund(null)}
            aria-label="Close dialog"
          />
          <div className="relative w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-stone-900">
              Rueckerstattung bestaetigen?
            </h3>
            <p className="mt-2 text-sm text-stone-600">
              Diese Rueckerstattung kann nicht rueckgaengig gemacht werden.
            </p>
            {refundPreview && (
              <div className="mt-4 rounded-xl border border-black/10 bg-stone-50 px-4 py-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-500">
                  Preview
                </div>
                <div className="mt-2 text-lg font-semibold text-stone-900">
                  {formatPrice(refundPreview.amount, refundPreview.order.currency)}
                </div>
                <div className="mt-1 text-xs text-stone-500">
                  {confirmRefund?.mode === "items"
                    ? `${refundPreview.selectedItems} item line(s) selected`
                    : "Full-order refund preview"}
                </div>
              </div>
            )}
            <label className="mt-4 flex items-center gap-2 text-sm text-stone-700">
              <input
                type="checkbox"
                checked={refundIncludeShipping}
                onChange={(event) =>
                  setRefundIncludeShipping(event.target.checked)
                }
              />
              Versand in Rueckerstattung einbeziehen
            </label>
            <input
              type="password"
              value={refundPassword}
              onChange={(event) => {
                setRefundPassword(event.target.value);
                if (refundPasswordError) setRefundPasswordError("");
              }}
              className="mt-4 h-10 w-full rounded-md border border-black/10 px-3 text-sm outline-none focus:border-black/30"
              placeholder="Admin-Passwort"
            />
            {refundPasswordError && (
              <p className="mt-2 text-xs text-red-600">{refundPasswordError}</p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmRefund(null)}
                className="h-10 rounded-md border border-black/10 px-4 text-sm font-semibold text-stone-700"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={confirmRefundAction}
                className="h-10 rounded-md bg-red-600 px-4 text-sm font-semibold text-white"
              >
                Rueckerstatten
              </button>
            </div>
          </div>
        </div>
      )}
      {confirmShippingResend && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            onClick={() => setConfirmShippingResend(null)}
            aria-label="Close dialog"
          />
          <div className="relative w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-stone-900">
              Resend shipping email?
            </h3>
            <p className="mt-2 text-sm text-stone-600">
              This order already has a shipping email sent. Resend it anyway?
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmShippingResend(null)}
                className="h-10 rounded-md border border-black/10 px-4 text-sm font-semibold text-stone-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmShippingResendAction}
                className="h-10 rounded-md bg-sky-600 px-4 text-sm font-semibold text-white"
              >
                Resend
              </button>
            </div>
          </div>
        </div>
      )}
      {confirmEmailResend && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            onClick={() => setConfirmEmailResend(null)}
            aria-label="Close dialog"
          />
          <div className="relative w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-stone-900">
              Resend {confirmEmailResend.type} email?
            </h3>
            <p className="mt-2 text-sm text-stone-600">
              This order already has a {confirmEmailResend.type} email sent.
              Resend it anyway?
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmEmailResend(null)}
                className="h-10 rounded-md border border-black/10 px-4 text-sm font-semibold text-stone-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmEmailResendAction}
                className="h-10 rounded-md bg-stone-900 px-4 text-sm font-semibold text-white"
              >
                Resend
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  detail,
  change,
  footnote,
  tone = "slate",
}: {
  label: string;
  value: string;
  detail: string;
  change?: string;
  footnote?: string;
  tone?: "slate" | "emerald" | "violet" | "amber";
}) {
  const toneClasses =
    tone === "emerald"
      ? "orders-kpi-card-emerald border-emerald-200/70 bg-gradient-to-br from-emerald-50 via-white to-emerald-100/70"
      : tone === "violet"
        ? "orders-kpi-card-violet border-violet-200/70 bg-gradient-to-br from-violet-50 via-white to-indigo-50"
        : tone === "amber"
          ? "orders-kpi-card-amber border-amber-200/70 bg-gradient-to-br from-amber-50 via-white to-orange-50"
          : "orders-kpi-card-slate border-black/10 bg-gradient-to-br from-white via-white to-slate-50";
  const accentClasses =
    tone === "emerald"
      ? "orders-kpi-badge-emerald border-emerald-200 bg-emerald-100/80 text-emerald-700"
      : tone === "violet"
        ? "orders-kpi-badge-violet border-violet-200 bg-violet-100/80 text-violet-700"
        : tone === "amber"
          ? "orders-kpi-badge-amber border-amber-200 bg-amber-100/80 text-amber-700"
          : "orders-kpi-badge-slate border-slate-200 bg-slate-100 text-slate-700";
  return (
    <div className={`orders-kpi-card rounded-[22px] border p-5 shadow-sm ${toneClasses}`}>
      <div className="flex items-start justify-between gap-3">
        <p className="max-w-[14ch] text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-500">
          {label}
        </p>
        {change ? (
          <span
            className={`orders-kpi-badge rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${accentClasses}`}
          >
            {change}
          </span>
        ) : null}
      </div>
      <div className="mt-6">
        <p className="max-w-full text-[clamp(2.1rem,2.8vw,3rem)] font-semibold leading-none tracking-tight text-stone-900">
          {value}
        </p>
      </div>
      <div className="mt-5 space-y-2">
        <p className="max-w-[26ch] text-sm leading-5 text-stone-600">{detail}</p>
        {footnote ? (
          <div className="text-xs font-medium uppercase tracking-[0.18em] text-stone-500">
            {footnote}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function OrderStateBlock({
  label,
  value,
  detail,
  badgeClass,
}: {
  label: string;
  value: string;
  detail: string;
  badgeClass: string;
}) {
  return (
    <div className="orders-state-block rounded-2xl border border-black/10 bg-white/80 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">
        {label}
      </p>
      <div className="mt-2">
        <span className={badgeClass}>{value}</span>
      </div>
      <p className="mt-3 text-xs text-stone-500">{detail}</p>
    </div>
  );
}

function OrderOverviewStat({
  label,
  value,
  detail,
  valueClassName = "text-stone-900",
}: {
  label: string;
  value: ReactNode;
  detail?: string;
  valueClassName?: string;
}) {
  return (
    <div className="orders-overview-stat space-y-1 xl:border-l xl:border-black/10 xl:pl-6 first:xl:border-l-0 first:xl:pl-0">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">
        {label}
      </p>
      <p className={`text-base font-semibold ${valueClassName}`}>{value}</p>
      {detail ? <p className="text-xs text-stone-500">{detail}</p> : null}
    </div>
  );
}

function OrderHealthCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-[22px] border border-black/10 bg-white p-4 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-500">
        {label}
      </p>
      <p className="mt-3 text-sm font-semibold text-stone-900">{value}</p>
      <p className="mt-2 text-xs text-stone-500">{detail}</p>
    </div>
  );
}
