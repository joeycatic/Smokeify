"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import AdminThemeToggle from "@/components/admin/AdminThemeToggle";

type OrderItem = {
  id: string;
  productId?: string | null;
  variantId?: string | null;
  name: string;
  manufacturer?: string | null;
  quantity: number;
  unitAmount: number;
  totalAmount: number;
  currency: string;
  imageUrl?: string | null;
  options?: Array<{ name: string; value: string }>;
};

type OrderRow = {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: string;
  paymentStatus: string;
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
const getOrderEmail = (order: OrderRow) => order.user?.email ?? order.customerEmail;
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
      className: "border-emerald-200 bg-emerald-50 text-emerald-800",
    };
  }
  if (
    ["canceled", "cancelled", "failed", "refunded"].includes(normalizedStatus)
  ) {
    return {
      label: "Fulfillment: closed",
      className: "border-stone-200 bg-stone-100 text-stone-700",
    };
  }
  if (normalizedPayment === "paid" || normalizedPayment === "succeeded") {
    return {
      label: "Fulfillment: ready",
      className: "border-sky-200 bg-sky-50 text-sky-800",
    };
  }
  return {
    label: "Fulfillment: not ready",
    className: "border-amber-200 bg-amber-50 text-amber-800",
  };
};

export default function AdminOrdersClient({ orders, webhookFailures }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
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
      return (
        order.id.toLowerCase().includes(normalizedQuery) ||
        email.includes(normalizedQuery) ||
        name.includes(normalizedQuery)
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
  const fulfilledCount = useMemo(
    () =>
      filteredOrders.reduce((count, order) => {
        const normalizedStatus = normalizeStatus(order.status);
        return normalizedStatus === "fulfilled" ||
          normalizedStatus === "refunded"
          ? count + 1
          : count;
      }, 0),
    [filteredOrders]
  );

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
        }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Update failed");
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
        }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Update failed");
        return false;
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
    <div className="space-y-8">
      <div className="rounded-2xl bg-[#2f3e36] p-6 text-white shadow-lg shadow-emerald-900/20">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-[0.3em] text-white/70">
              ADMIN / ORDERS
            </p>
            <h1 className="mt-2 text-3xl font-semibold">Orders</h1>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-white/80">
              <span className="rounded-full bg-white/10 px-3 py-1 font-semibold text-white">
                {sorted.length} orders
              </span>
              <span className="rounded-full bg-white/10 px-3 py-1 font-semibold text-white">
                {fulfilledCount} fulfilled
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <AdminThemeToggle />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search by email or order ID"
              className="h-10 w-64 rounded-md border border-white/20 bg-white/10 px-3 text-xs text-white placeholder:text-white/70 outline-none focus:border-white/60"
            />
          </div>
        </div>
      </div>

      {customerSummary && (
        <div className="rounded-2xl border border-sky-200/70 bg-sky-50/60 p-4 text-sm text-sky-900 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.25em] text-sky-700/70">
                Customer snapshot
              </div>
              <div className="mt-2 text-sm font-semibold">
                {customerSummary.email}
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold">
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
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
      {notice && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
          {notice}
        </div>
      )}
      {webhookFailures.length > 0 && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50/60 p-4 text-sm text-rose-800 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.25em] text-rose-700/70">
                Stripe webhook failures
              </div>
              <div className="mt-2 text-sm font-semibold">
                {webhookFailures.length} failed event
                {webhookFailures.length === 1 ? "" : "s"}
              </div>
            </div>
            <div className="text-xs text-rose-700">
              Replays are safe; Stripe will retry automatically.
            </div>
          </div>
          <div className="mt-3 space-y-2 text-xs text-rose-800">
            {webhookFailures.map((event) => (
              <div
                key={event.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-rose-200 bg-white/70 px-3 py-2"
              >
                <div className="font-semibold">{event.type}</div>
                <div className="text-rose-700">{event.eventId}</div>
                <div className="text-rose-700">
                  {new Date(event.createdAt).toLocaleString("de-DE")}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-4">
        {sorted.map((order) => {
          const isOpen = openId === order.id;
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

          return (
            <div
              key={order.id}
              className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm"
            >
              <button
                type="button"
                onClick={() => setOpenId(isOpen ? null : order.id)}
                className="flex w-full flex-col gap-3 text-left sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="text-sm font-semibold text-stone-900">
                    Order {order.id.slice(0, 8).toUpperCase()}
                  </div>
                  <div className="text-xs text-stone-500">
                    {new Date(order.createdAt).toLocaleDateString("de-DE")} ·{" "}
                    {getOrderEmail(order) ?? "No email"}
                  </div>
                  {!isOpen && (
                    <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-emerald-800">
                        Status: {order.status}
                      </span>
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-amber-800">
                        Payment: {order.paymentStatus}
                      </span>
                      <span
                        className={`rounded-full border px-2 py-1 ${fulfillmentBadge.className}`}
                      >
                        {fulfillmentBadge.label}
                      </span>
                      {isShippingEmailSent(order) && (
                        <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-1 text-sky-800">
                          Shipping email: sent
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-emerald-900">
                    {formatPrice(order.amountTotal, order.currency)}
                  </div>
                  <div className="text-xs text-stone-500">
                    {order.items.length} items
                  </div>
                </div>
              </button>

              {isOpen && (
                <div className="mt-4 space-y-4">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-emerald-800">
                      Status: {order.status}
                    </span>
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-amber-800">
                      Payment: {order.paymentStatus}
                    </span>
                    <span
                      className={`rounded-full border px-2 py-1 ${fulfillmentBadge.className}`}
                    >
                      {fulfillmentBadge.label}
                    </span>
                    {isShippingEmailSent(order) && (
                      <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-1 text-sky-800">
                        Shipping email: sent
                      </span>
                    )}
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
                        const itemImage = item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt={itemName}
                            className={`h-10 w-10 rounded-lg border border-black/10 object-cover ${
                              productHref
                                ? "transition hover:border-emerald-300"
                                : ""
                            }`}
                            loading="lazy"
                            decoding="async"
                            width={40}
                            height={40}
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
                                  Qty {item.quantity}
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

