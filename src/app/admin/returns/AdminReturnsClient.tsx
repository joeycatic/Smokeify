"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { DonutChart } from "@/components/admin/AdminCharts";
import {
  AdminButton,
  AdminDialog,
  AdminEmptyState,
  AdminField,
  AdminInput,
  AdminNotice,
} from "@/components/admin/AdminWorkspace";
import { calculateReturnRequestAmountCents } from "@/lib/adminReturns";

type ReturnRequestRow = {
  id: string;
  orderId: string;
  userId: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  requestedResolution: "REFUND" | "STORE_CREDIT" | "EXCHANGE";
  exchangePreference: string | null;
  reason: string;
  adminNote: string | null;
  storeCreditAmount: number;
  exchangeApprovedAt: string | null;
  createdAt: string;
  updatedAt: string;
  user: { email: string | null; name: string | null } | null;
  order: {
    id: string;
    amountTotal: number;
    currency: string;
    status: string;
    customerEmail: string | null;
    shippingName: string | null;
  };
  exchangeOrder: { id: string; orderNumber: number; status: string } | null;
  items: Array<{
    id: string;
    quantity: number;
    orderItemId: string;
    orderItemName: string;
    unitAmount: number;
  }>;
};

type Props = {
  requests: ReturnRequestRow[];
};

const formatPrice = (amount: number, currency: string) =>
  new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount / 100);

const normalizeStatus = (value: string) => value.trim().toUpperCase();

const RETURN_BADGE_BASE =
  "inline-flex items-center rounded-full border px-3 py-1.5 text-[11px] font-medium leading-none whitespace-nowrap";

const getReturnBadgeClass = (status: ReturnRequestRow["status"]) => {
  if (status === "APPROVED") {
    return `${RETURN_BADGE_BASE} orders-status-chip orders-status-chip-success border-emerald-400/20 bg-emerald-400/10 text-emerald-200`;
  }
  if (status === "REJECTED") {
    return `${RETURN_BADGE_BASE} orders-status-chip orders-status-chip-danger border-rose-400/20 bg-rose-400/10 text-rose-200`;
  }
  return `${RETURN_BADGE_BASE} orders-status-chip orders-status-chip-warning border-amber-400/20 bg-amber-400/10 text-amber-200`;
};

const getOrderBadgeClass = (status: string) => {
  const normalizedStatus = normalizeStatus(status);
  if (normalizedStatus === "FULFILLED") {
    return `${RETURN_BADGE_BASE} orders-status-chip orders-status-chip-success border-emerald-400/20 bg-emerald-400/10 text-emerald-200`;
  }
  if (normalizedStatus === "REFUNDED") {
    return `${RETURN_BADGE_BASE} orders-status-chip orders-status-chip-neutral border-white/10 bg-white/[0.04] text-slate-300`;
  }
  return `${RETURN_BADGE_BASE} orders-status-chip orders-status-chip-info border-cyan-400/20 bg-cyan-400/10 text-cyan-200`;
};

const RESOLUTION_LABELS: Record<ReturnRequestRow["requestedResolution"], string> = {
  REFUND: "Refund",
  STORE_CREDIT: "Store credit",
  EXCHANGE: "Exchange",
};

export default function AdminReturnsClient({ requests }: Props) {
  const [requestRows, setRequestRows] = useState(requests);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [approvalTargetId, setApprovalTargetId] = useState<string | null>(null);
  const [approvalPassword, setApprovalPassword] = useState("");
  const [approvalError, setApprovalError] = useState("");

  useEffect(() => {
    setRequestRows(requests);
  }, [requests]);

  const filteredRequests = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return requestRows;
    return requestRows.filter((req) => {
      const email = (req.user?.email ?? req.order.customerEmail ?? "").toLowerCase();
      return (
        req.order.id.toLowerCase().includes(query) ||
        req.id.toLowerCase().includes(query) ||
        email.includes(query) ||
        req.reason.toLowerCase().includes(query) ||
        req.requestedResolution.toLowerCase().includes(query)
      );
    });
  }, [requestRows, searchQuery]);

  const pendingCount = useMemo(
    () => filteredRequests.filter((req) => req.status === "PENDING").length,
    [filteredRequests]
  );
  const approvedCount = useMemo(
    () => filteredRequests.filter((req) => req.status === "APPROVED").length,
    [filteredRequests]
  );
  const rejectedCount = useMemo(
    () => filteredRequests.filter((req) => req.status === "REJECTED").length,
    [filteredRequests]
  );
  const returnValueCents = useMemo(
    () =>
      filteredRequests.reduce(
        (sum, req) =>
          sum +
          calculateReturnRequestAmountCents(
            req.items.map((item) => ({
              quantity: item.quantity,
              unitAmount: item.unitAmount,
            }))
          ),
        0
      ),
    [filteredRequests]
  );
  const averageReturnValueCents = useMemo(
    () =>
      filteredRequests.length > 0
        ? Math.round(returnValueCents / filteredRequests.length)
        : 0,
    [filteredRequests.length, returnValueCents]
  );
  const reviewBacklogCount = useMemo(
    () =>
      filteredRequests.filter(
        (req) => req.status === "PENDING" && !(noteDrafts[req.id] ?? req.adminNote ?? "").trim()
      ).length,
    [filteredRequests, noteDrafts]
  );
  const statusMix = useMemo(
    () => [
      { label: "Pending", value: pendingCount, colorClassName: "#f59e0b" },
      { label: "Approved", value: approvedCount, colorClassName: "#34d399" },
      { label: "Rejected", value: rejectedCount, colorClassName: "#fb7185" },
    ],
    [approvedCount, pendingCount, rejectedCount]
  );
  const approvalTarget =
    approvalTargetId ? requestRows.find((req) => req.id === approvalTargetId) ?? null : null;

  const updateStatus = async (
    requestId: string,
    status: "APPROVED" | "REJECTED",
    adminPassword?: string
  ) => {
    setError("");
    setNotice("");
    setSavingId(requestId);
    try {
      const res = await fetch(`/api/admin/returns/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          adminNote: noteDrafts[requestId],
          adminPassword,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        request?: Partial<ReturnRequestRow> & { id: string };
      };
      if (!res.ok || !data.request) {
        if (status === "APPROVED") {
          setApprovalError(data.error ?? "Update failed");
        } else {
          setError(data.error ?? "Update failed");
        }
        return;
      }

      setRequestRows((current) =>
        current.map((req) => (req.id === requestId ? { ...req, ...data.request } : req))
      );
      setNotice(
        status === "APPROVED"
          ? "Return request approved and resolution applied."
          : "Return request rejected."
      );
      setApprovalTargetId(null);
      setApprovalPassword("");
      setApprovalError("");
    } catch {
      if (status === "APPROVED") {
        setApprovalError("Update failed");
      } else {
        setError("Update failed");
      }
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="admin-legacy-page space-y-6">
      <div className="overflow-hidden rounded-[28px] border border-white/10 bg-[#060b14] text-white shadow-[0_30px_80px_rgba(5,10,20,0.45)]">
        <div className="relative border-b border-white/10 px-6 py-6 lg:px-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.18),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(251,191,36,0.16),_transparent_28%),linear-gradient(135deg,_rgba(8,15,26,0.98),_rgba(12,22,38,0.92))]" />
          <div className="relative flex flex-wrap items-start justify-between gap-6">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold tracking-[0.34em] text-cyan-200/65">
                ADMIN / RETURNS
              </p>
              <div className="mt-3 flex flex-wrap items-end gap-4">
                <h1 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
                  Returns review center
                </h1>
                <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-200">
                  Resolution queue
                </span>
              </div>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                Review itemized return requests, apply the requested resolution path, and keep
                notes attached to the case instead of resolving everything as a generic status flip.
              </p>
              <div className="mt-5 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 font-semibold text-slate-100">
                  {filteredRequests.length} visible requests
                </span>
                <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 font-semibold text-amber-200">
                  {pendingCount} pending
                </span>
                <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 font-semibold text-emerald-200">
                  {approvedCount} approved
                </span>
                <span className="rounded-full border border-rose-400/20 bg-rose-400/10 px-3 py-1 font-semibold text-rose-200">
                  {rejectedCount} rejected
                </span>
              </div>
            </div>
            <div className="relative flex w-full max-w-md flex-col gap-3">
              <label className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 shadow-inner shadow-black/30">
                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                  Search scope
                </div>
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search by order, email, reason or resolution"
                  className="mt-3 h-11 w-full rounded-xl border border-white/10 bg-[#050912] px-4 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-cyan-300/60"
                />
              </label>
            </div>
          </div>
        </div>

        <div className="grid items-start gap-4 px-6 py-6 xl:grid-cols-2 lg:px-8">
          <div className="grid auto-rows-fr gap-4 md:grid-cols-2">
            <SummaryCard
              label="Visible requests"
              value={String(filteredRequests.length)}
              detail="Current review scope"
              change={`${reviewBacklogCount} without note`}
              footnote={`${pendingCount} pending decisions`}
            />
            <SummaryCard
              label="Return value"
              value={formatPrice(returnValueCents, filteredRequests[0]?.order.currency ?? "EUR")}
              detail="Itemized exposure based on selected return quantities"
              change={`${approvedCount} approved`}
              footnote={`${rejectedCount} rejected`}
              tone="emerald"
            />
            <SummaryCard
              label="Average return"
              value={formatPrice(
                averageReturnValueCents,
                filteredRequests[0]?.order.currency ?? "EUR"
              )}
              detail="Average value across visible return requests"
              change={`${filteredRequests.length} requests`}
              footnote="Per visible request"
              tone="violet"
            />
            <SummaryCard
              label="Action queue"
              value={String(pendingCount)}
              detail="Requests awaiting admin decision"
              change={`${reviewBacklogCount} no note`}
              footnote={`${approvedCount + rejectedCount} resolved`}
              tone="amber"
            />
          </div>

          <div className="h-full rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-emerald-300/75">
                  Status mix
                </p>
                <h2 className="mt-2 text-sm font-semibold text-white">
                  Returns by resolution stage
                </h2>
              </div>
              <div className="h-1 w-12 rounded-full bg-emerald-300/70" />
            </div>
            <div className="mt-4">
              <DonutChart
                data={statusMix}
                totalLabel="Returns"
                totalValue={String(filteredRequests.length)}
              />
            </div>
          </div>
        </div>
      </div>

      {error ? (
        <AdminNotice tone="error">{error}</AdminNotice>
      ) : null}
      {notice ? (
        <AdminNotice tone="success">{notice}</AdminNotice>
      ) : null}

      {filteredRequests.length === 0 ? (
        <AdminEmptyState copy="No return requests match the current scope." />
      ) : (
        <div className="space-y-4">
          {filteredRequests.map((req) => {
            const requestValueCents = calculateReturnRequestAmountCents(
              req.items.map((item) => ({
                quantity: item.quantity,
                unitAmount: item.unitAmount,
              }))
            );

            return (
              <div
                key={req.id}
                className="orders-order-surface rounded-[24px] border border-white/10 bg-[linear-gradient(145deg,rgba(11,15,22,0.98),rgba(8,12,18,0.96))] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.28)] transition"
              >
                <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_240px]">
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="orders-meta-chip rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-200">
                        Return {req.order.id.slice(0, 8).toUpperCase()}
                      </span>
                      <span className="orders-meta-chip rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[11px] font-medium text-slate-400">
                        {new Date(req.createdAt).toLocaleDateString("de-DE")}
                      </span>
                    </div>

                    <div className="text-sm font-semibold text-slate-100">
                      {req.user?.email ?? req.order.customerEmail ?? "No email"}
                    </div>

                    <div className="orders-status-row flex flex-wrap gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-[11px]">
                      <span className={getOrderBadgeClass(req.order.status)}>
                        Order: {req.order.status}
                      </span>
                      <span className={getReturnBadgeClass(req.status)}>
                        Return: {req.status}
                      </span>
                      <span
                        className={`${RETURN_BADGE_BASE} orders-status-chip orders-status-chip-info border-cyan-400/20 bg-cyan-400/10 text-cyan-200`}
                      >
                        Resolution: {RESOLUTION_LABELS[req.requestedResolution]}
                      </span>
                      <span
                        className={`${RETURN_BADGE_BASE} orders-status-chip orders-status-chip-info border-white/10 bg-white/[0.04] text-slate-300`}
                      >
                        Updated: {new Date(req.updatedAt).toLocaleDateString("de-DE")}
                      </span>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <Tile
                        label="Request value"
                        value={formatPrice(requestValueCents, req.order.currency)}
                      />
                      <Tile
                        label="Order total"
                        value={formatPrice(req.order.amountTotal, req.order.currency)}
                      />
                      <Tile
                        label="Admin note"
                        value={(noteDrafts[req.id] ?? req.adminNote ?? "").trim() ? "Present" : "Missing"}
                      />
                      <Tile
                        label="Store credit"
                        value={
                          req.storeCreditAmount > 0
                            ? formatPrice(req.storeCreditAmount, req.order.currency)
                            : req.status === "APPROVED" &&
                                req.requestedResolution === "STORE_CREDIT"
                              ? formatPrice(requestValueCents, req.order.currency)
                              : "None"
                        }
                      />
                      <Tile
                        label="Exchange order"
                        value={
                          req.exchangeOrder
                            ? `#${req.exchangeOrder.orderNumber}`
                            : req.requestedResolution === "EXCHANGE" && req.status === "APPROVED"
                              ? "Creating"
                              : "None"
                        }
                      />
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 shadow-sm">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                        Customer reason
                      </div>
                      <div className="mt-3 text-sm leading-6 text-slate-300">{req.reason}</div>
                      {req.exchangePreference ? (
                        <div className="mt-3 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-3 py-3 text-sm text-cyan-100">
                          Exchange preference: {req.exchangePreference}
                        </div>
                      ) : null}
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 shadow-sm">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                        Returned items
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-300">
                        {req.items.map((item) => (
                          <span
                            key={item.id}
                            className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1"
                          >
                            {item.orderItemName} x{item.quantity}
                          </span>
                        ))}
                      </div>
                    </div>

                    {req.exchangeOrder ? (
                      <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-4 text-sm text-cyan-50 shadow-sm">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-200/75">
                              Replacement order
                            </div>
                            <div className="mt-2 font-semibold">
                              Exchange order #{req.exchangeOrder.orderNumber}
                            </div>
                            <div className="mt-1 text-xs text-cyan-100/75">
                              Status: {req.exchangeOrder.status}
                              {req.exchangeApprovedAt
                                ? ` · approved ${new Date(req.exchangeApprovedAt).toLocaleString("de-DE")}`
                                : ""}
                            </div>
                          </div>
                          <Link
                            href={`/admin/orders/${req.exchangeOrder.id}`}
                            className="inline-flex h-10 items-center justify-center rounded-xl border border-cyan-300/30 bg-cyan-300/15 px-4 text-xs font-semibold text-cyan-50 transition hover:bg-cyan-300/25"
                          >
                            Open exchange order
                          </Link>
                        </div>
                      </div>
                    ) : null}

                    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                      <AdminField label="Admin note">
                        <AdminInput
                          value={noteDrafts[req.id] ?? req.adminNote ?? ""}
                          onChange={(event) =>
                            setNoteDrafts((prev) => ({
                              ...prev,
                              [req.id]: event.target.value,
                            }))
                          }
                          placeholder="Attach a review note before applying a resolution"
                        />
                      </AdminField>
                      <div className="flex flex-wrap gap-2">
                        <AdminButton
                          tone="secondary"
                          onClick={() => {
                            setApprovalTargetId(req.id);
                            setApprovalPassword("");
                            setApprovalError("");
                          }}
                          className="h-11 border border-emerald-400/20 bg-emerald-400/10 text-emerald-200 hover:bg-emerald-400/15"
                          disabled={savingId === req.id || req.status !== "PENDING"}
                        >
                          {savingId === req.id ? "Saving..." : "Approve"}
                        </AdminButton>
                        <AdminButton
                          tone="secondary"
                          onClick={() => void updateStatus(req.id, "REJECTED")}
                          className="h-11 border border-amber-400/20 bg-amber-400/10 text-amber-200 hover:bg-amber-400/15"
                          disabled={savingId === req.id || req.status !== "PENDING"}
                        >
                          {savingId === req.id ? "Saving..." : "Reject"}
                        </AdminButton>
                      </div>
                    </div>
                  </div>

                  <div className="orders-total-panel flex min-w-[180px] flex-col items-start rounded-[22px] border border-white/10 bg-black/20 px-4 py-4 text-left text-white xl:items-end xl:text-right">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                      Resolution
                    </div>
                    <div className="mt-2 text-xl font-semibold text-white">
                      {RESOLUTION_LABELS[req.requestedResolution]}
                    </div>
                    <div className="mt-1 text-xs text-slate-400">
                      Order {req.order.id.slice(0, 8).toUpperCase()}
                    </div>
                    <div className="mt-4 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-200">
                      {req.status}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AdminDialog
        open={Boolean(approvalTarget)}
        title="Approve return request"
        description="This will apply the requested resolution path for the selected returned items."
        onClose={() => {
          setApprovalTargetId(null);
          setApprovalPassword("");
          setApprovalError("");
        }}
        footer={
          <>
            <AdminButton
              tone="secondary"
              onClick={() => {
                setApprovalTargetId(null);
                setApprovalPassword("");
                setApprovalError("");
              }}
            >
              Cancel
            </AdminButton>
            <AdminButton
              tone="secondary"
              onClick={() =>
                approvalTarget
                  ? void updateStatus(approvalTarget.id, "APPROVED", approvalPassword)
                  : undefined
              }
              className="border border-emerald-400/20 bg-emerald-400/90 text-slate-950 hover:bg-emerald-300"
            >
              Approve and apply
            </AdminButton>
          </>
        }
      >
        {approvalTarget ? (
          <>
            <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-slate-400">Requested resolution</span>
                <span className="text-sm font-semibold text-white">
                  {RESOLUTION_LABELS[approvalTarget.requestedResolution]}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-slate-400">Return value</span>
                <span className="text-sm font-semibold text-white">
                  {formatPrice(
                    calculateReturnRequestAmountCents(
                      approvalTarget.items.map((item) => ({
                        quantity: item.quantity,
                        unitAmount: item.unitAmount,
                      }))
                    ),
                    approvalTarget.order.currency
                  )}
                </span>
              </div>
            </div>
            <AdminField label="Admin password">
              <AdminInput
                type="password"
                value={approvalPassword}
                onChange={(event) => {
                  setApprovalPassword(event.target.value);
                  if (approvalError) setApprovalError("");
                }}
                placeholder="Admin password"
              />
            </AdminField>
            {approvalError ? (
              <p className="mt-2 text-xs text-red-300">{approvalError}</p>
            ) : null}
          </>
        ) : null}
      </AdminDialog>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="orders-summary-tile rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
        {label}
      </div>
      <div className="mt-2 text-base font-semibold text-slate-100">{value}</div>
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
      ? "orders-kpi-card-emerald border-emerald-400/20 bg-[linear-gradient(145deg,rgba(6,78,59,0.22),rgba(10,14,20,0.96))]"
      : tone === "violet"
        ? "orders-kpi-card-violet border-violet-400/20 bg-[linear-gradient(145deg,rgba(76,29,149,0.2),rgba(10,14,20,0.96))]"
        : tone === "amber"
          ? "orders-kpi-card-amber border-amber-400/20 bg-[linear-gradient(145deg,rgba(146,64,14,0.22),rgba(10,14,20,0.96))]"
          : "orders-kpi-card-slate border-white/10 bg-[linear-gradient(145deg,rgba(15,23,42,0.92),rgba(10,14,20,0.96))]";
  const accentClasses =
    tone === "emerald"
      ? "orders-kpi-badge-emerald border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
      : tone === "violet"
        ? "orders-kpi-badge-violet border-violet-400/20 bg-violet-400/10 text-violet-200"
        : tone === "amber"
          ? "orders-kpi-badge-amber border-amber-400/20 bg-amber-400/10 text-amber-200"
          : "orders-kpi-badge-slate border-white/10 bg-white/[0.04] text-slate-300";

  return (
    <div className={`orders-kpi-card rounded-[22px] border p-5 shadow-[0_18px_50px_rgba(0,0,0,0.2)] ${toneClasses}`}>
      <div className="flex items-start justify-between gap-3">
        <p className="max-w-[14ch] text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
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
        <p className="max-w-full text-[clamp(2.1rem,2.8vw,3rem)] font-semibold leading-none tracking-tight text-white">
          {value}
        </p>
      </div>
      <div className="mt-5 space-y-2">
        <p className="max-w-[26ch] text-sm leading-5 text-slate-400">{detail}</p>
        {footnote ? (
          <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
            {footnote}
          </div>
        ) : null}
      </div>
    </div>
  );
}
