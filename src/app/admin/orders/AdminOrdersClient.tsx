"use client";

import { useMemo, useState } from "react";

type OrderItem = {
  id: string;
  name: string;
  quantity: number;
  unitAmount: number;
  totalAmount: number;
  currency: string;
  imageUrl?: string | null;
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
  discountCode: string | null;
  user: { email: string | null; name: string | null };
  items: OrderItem[];
};

type Props = {
  orders: OrderRow[];
};

const formatPrice = (amount: number, currency: string) =>
  new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount / 100);

export default function AdminOrdersClient({ orders }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
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
  const [refundSelection, setRefundSelection] = useState<
    Record<string, Record<string, number>>
  >({});
  const [confirmRefund, setConfirmRefund] = useState<{
    orderId: string;
    mode: "full" | "items";
  } | null>(null);

  const sorted = useMemo(() => orders, [orders]);

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

  const refundOrder = async (orderId: string) => {
    setError("");
    setNotice("");
    setRefundId(orderId);
    try {
      const current = orders.find((order) => order.id === orderId);
      if (current?.paymentStatus === "refunded") {
        setError("Order has already been refunded.");
        return;
      }
      const res = await fetch(`/api/admin/orders/${orderId}/refund`, {
        method: "POST",
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

  const refundSelectedItems = async (orderId: string) => {
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
        body: JSON.stringify({ items }),
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
    const { orderId, mode } = confirmRefund;
    setConfirmRefund(null);
    if (mode === "items") {
      await refundSelectedItems(orderId);
      return;
    }
    await refundOrder(orderId);
  };

  const sendEmail = async (
    orderId: string,
    type: "confirmation" | "shipping" | "refund"
  ) => {
    setError("");
    setNotice("");
    if (type === "shipping" && shippingEmailSent[orderId]) {
      setNotice("Shipping email already sent.");
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
      setNotice("Email sent.");
    } catch {
      setError("Email failed");
    }
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
            </div>
          </div>
        </div>
      </div>

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

      <div className="space-y-4">
        {sorted.map((order) => {
          const isOpen = openId === order.id;
          const tracking = trackingDrafts[order.id] ?? {
            carrier: order.trackingCarrier ?? "",
            number: order.trackingNumber ?? "",
            url: order.trackingUrl ?? "",
          };
          const status = statusDrafts[order.id] ?? order.status;

          return (
            <div
              key={order.id}
              className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm"
            >
              <button
                type="button"
                onClick={() => setOpenId(isOpen ? null : order.id)}
                className="flex w-full flex-wrap items-center justify-between gap-3 text-left"
              >
                <div>
                  <div className="text-sm font-semibold text-stone-900">
                    Order {order.id.slice(0, 8).toUpperCase()}
                  </div>
                  <div className="text-xs text-stone-500">
                    {new Date(order.createdAt).toLocaleDateString("de-DE")} ·{" "}
                    {order.user?.email ?? "No email"}
                  </div>
                  {!isOpen && (
                    <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-emerald-800">
                        Status: {order.status}
                      </span>
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-amber-800">
                        Payment: {order.paymentStatus}
                      </span>
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
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-xl border border-black/10 bg-stone-50 p-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="text-xs font-semibold text-stone-600">
                          Status
                          <input
                            value={status}
                            onChange={(event) =>
                              setStatusDrafts((prev) => ({
                                ...prev,
                                [order.id]: event.target.value,
                              }))
                            }
                            className="mt-1 h-10 w-full rounded-md border border-black/15 bg-white px-3 text-sm"
                          />
                        </label>
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
                        <label className="text-xs font-semibold text-stone-600">
                          Tracking URL
                          <input
                            value={tracking.url}
                            onChange={(event) =>
                              setTrackingDrafts((prev) => ({
                                ...prev,
                                [order.id]: { ...tracking, url: event.target.value },
                              }))
                            }
                            className="mt-1 h-10 w-full rounded-md border border-black/15 bg-white px-3 text-sm"
                          />
                        </label>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => updateOrder(order.id)}
                          className="h-10 rounded-md bg-[#2f3e36] px-4 text-xs font-semibold text-white hover:bg-[#24312b]"
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
                          className="h-10 rounded-md border border-emerald-200 px-3 text-xs font-semibold text-emerald-800 hover:border-emerald-300"
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
                          className="h-10 rounded-md border border-amber-200 px-3 text-xs font-semibold text-amber-800 hover:border-amber-300"
                        >
                          Mark canceled
                        </button>
                        <button
                          type="button"
                          onClick={() => sendEmail(order.id, "confirmation")}
                          className="h-10 rounded-md border border-black/10 px-3 text-xs font-semibold text-stone-700 hover:border-black/20"
                        >
                          Send confirmation
                        </button>
                        <button
                          type="button"
                          onClick={() => sendEmail(order.id, "shipping")}
                          className="h-10 rounded-md border border-sky-200 px-3 text-xs font-semibold text-sky-700 hover:border-sky-300"
                        >
                          Send shipping
                        </button>
                        <button
                          type="button"
                          onClick={() => sendEmail(order.id, "refund")}
                          className="h-10 rounded-md border border-rose-200 px-3 text-xs font-semibold text-rose-700 hover:border-rose-300"
                        >
                          Send refund
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setConfirmRefund({ orderId: order.id, mode: "full" })
                          }
                          className="h-10 rounded-md border border-red-200 bg-red-50 px-3 text-xs font-semibold text-red-700"
                          disabled={refundId === order.id}
                        >
                          {refundId === order.id ? "Refunding..." : "Refund"}
                        </button>
                      </div>
                    </div>
                    <div className="rounded-xl border border-black/10 bg-white p-4">
                      <div className="text-xs font-semibold text-stone-600">
                        Totals
                      </div>
                      <div className="mt-2 space-y-1 text-sm text-stone-700">
                        <div className="flex items-center justify-between">
                          <span>Subtotal</span>
                          <span>{formatPrice(order.amountSubtotal, order.currency)}</span>
                        </div>
                        {order.amountDiscount > 0 && (
                          <div className="flex items-center justify-between">
                            <span>
                              Discount
                              {order.discountCode ? ` (${order.discountCode})` : ""}
                            </span>
                            <span>
                              -{formatPrice(order.amountDiscount, order.currency)}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center justify-between">
                          <span>Shipping</span>
                          <span>{formatPrice(order.amountShipping, order.currency)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Tax</span>
                          <span>{formatPrice(order.amountTax, order.currency)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Refunded</span>
                          <span>
                            {formatPrice(order.amountRefunded, order.currency)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between font-semibold">
                          <span>Total</span>
                          <span>{formatPrice(order.amountTotal, order.currency)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="text-xs font-semibold text-stone-600 mb-2">
                      Items
                    </div>
                    <div className="space-y-2">
                      {order.items.map((item) => {
                        const selection = refundSelection[order.id] ?? {};
                        const selectedQty = selection[item.id] ?? 0;
                        const isSelected = selectedQty > 0;
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
                              {item.imageUrl ? (
                                <img
                                  src={item.imageUrl}
                                  alt={item.name}
                                  className="h-10 w-10 rounded-lg border border-black/10 object-cover"
                                />
                              ) : (
                                <div className="h-10 w-10 rounded-lg border border-black/10 bg-stone-100" />
                              )}
                              <div>
                                <div className="font-semibold">{item.name}</div>
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
                    <div className="mt-3 flex flex-wrap items-center justify-center gap-3">
                      <p className="text-xs text-stone-500">
                        Set a quantity per item to refund.
                      </p>
                      <button
                        type="button"
                        onClick={() =>
                          setConfirmRefund({ orderId: order.id, mode: "items" })
                        }
                        className="h-9 rounded-md border border-red-200 bg-red-50 px-3 text-xs font-semibold text-red-700"
                        disabled={refundId === order.id}
                      >
                        {refundId === order.id
                          ? "Refunding..."
                          : "Refund selected items"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
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
    </div>
  );
}
