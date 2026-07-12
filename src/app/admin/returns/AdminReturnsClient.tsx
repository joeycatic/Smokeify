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
import { AdminPage, AdminPageHeader } from "@/components/admin/ui";

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
    return `${RETURN_BADGE_BASE} orders-status-chip orders-status-chip-success border-[var(--adm-success)] bg-[var(--adm-primary-soft)] text-[var(--adm-success)]`;
  }
  if (status === "REJECTED") {
    return `${RETURN_BADGE_BASE} orders-status-chip orders-status-chip-danger border-[var(--adm-error)] bg-[#fae7e3] text-[var(--adm-error)]`;
  }
  return `${RETURN_BADGE_BASE} orders-status-chip orders-status-chip-warning border-[#e2a136] bg-[#fff4dd] text-[#81560e]`;
};

const getOrderBadgeClass = (status: string) => {
  const normalizedStatus = normalizeStatus(status);
  if (normalizedStatus === "FULFILLED") {
    return `${RETURN_BADGE_BASE} orders-status-chip orders-status-chip-success border-[var(--adm-success)] bg-[var(--adm-primary-soft)] text-[var(--adm-success)]`;
  }
  if (normalizedStatus === "REFUNDED") {
    return `${RETURN_BADGE_BASE} orders-status-chip orders-status-chip-neutral border-[var(--adm-border)] bg-[var(--adm-surface-2)] text-[var(--adm-text-muted)]`;
  }
  return `${RETURN_BADGE_BASE} orders-status-chip orders-status-chip-info border-[var(--adm-primary)] bg-[var(--adm-primary-soft)] text-[var(--adm-primary)]`;
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
      { label: "Pending", value: pendingCount, colorClassName: "#e2a136" },
      { label: "Approved", value: approvedCount, colorClassName: "#5f8b72" },
      { label: "Rejected", value: rejectedCount, colorClassName: "#c0432c" },
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
    <AdminPage layout="queue" className="admin-console-page">
      <AdminPageHeader
        eyebrow="Admin / Returns"
        title="Returns review center"
        description="Review itemized requests, apply the requested resolution, and keep operator notes attached to each case."
        actions={
          <AdminInput
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search order, email, reason, resolution"
            className="w-full sm:w-80"
          />
        }
      />
      <div className="overflow-hidden rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] text-[var(--adm-text)]">
        <div className="hidden">
          <div className="absolute inset-0 bg-[var(--adm-surface)]" />
          <div className="relative flex flex-wrap items-start justify-between gap-6">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold tracking-[0.34em] text-[var(--adm-primary)]/65">
                ADMIN / RETURNS
              </p>
              <div className="mt-3 flex flex-wrap items-end gap-4">
                <h1 className="text-3xl font-semibold tracking-tight text-[var(--adm-text)] md:text-4xl">
                  Returns review center
                </h1>
                <span className="rounded-full border border-[#e2a136] bg-[#fff4dd] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#81560e]">
                  Resolution queue
                </span>
              </div>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--adm-text-muted)]">
                Review itemized return requests, apply the requested resolution path, and keep
                notes attached to the case instead of resolving everything as a generic status flip.
              </p>
              <div className="mt-5 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full border border-[var(--adm-border)] bg-[var(--adm-surface-2)] px-3 py-1 font-semibold text-[var(--adm-text)]">
                  {filteredRequests.length} visible requests
                </span>
                <span className="rounded-full border border-[#e2a136] bg-[#fff4dd] px-3 py-1 font-semibold text-[#81560e]">
                  {pendingCount} pending
                </span>
                <span className="rounded-full border border-[var(--adm-success)] bg-[var(--adm-primary-soft)] px-3 py-1 font-semibold text-[var(--adm-success)]">
                  {approvedCount} approved
                </span>
                <span className="rounded-full border border-[var(--adm-error)] bg-[#fae7e3] px-3 py-1 font-semibold text-[var(--adm-error)]">
                  {rejectedCount} rejected
                </span>
              </div>
            </div>
            <div className="relative flex w-full max-w-md flex-col gap-3">
              <label className="rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface-2)] p-3 shadow-inner shadow-black/30">
                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--adm-text-muted)]">
                  Search scope
                </div>
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search by order, email, reason or resolution"
                  className="mt-3 h-9 w-full rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] px-4 text-sm text-[var(--adm-text)] placeholder:text-[var(--adm-text-faint)] outline-none transition focus:border-cyan-300/60"
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

          <div className="h-full rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface-2)] p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[var(--adm-success)]/75">
                  Status mix
                </p>
                <h2 className="mt-2 text-sm font-semibold text-[var(--adm-text)]">
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
                className="orders-order-surface rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.28)] transition"
              >
                <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_240px]">
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="orders-meta-chip rounded-full border border-[var(--adm-border)] bg-[var(--adm-surface-2)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--adm-text)]">
                        Return {req.order.id.slice(0, 8).toUpperCase()}
                      </span>
                      <span className="orders-meta-chip rounded-full border border-[var(--adm-border)] bg-[var(--adm-surface-2)] px-3 py-1 text-[11px] font-medium text-[var(--adm-text-muted)]">
                        {new Date(req.createdAt).toLocaleDateString("de-DE")}
                      </span>
                    </div>

                    <div className="text-sm font-semibold text-[var(--adm-text)]">
                      {req.user?.email ?? req.order.customerEmail ?? "No email"}
                    </div>

                    <div className="orders-status-row flex flex-wrap gap-2 rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] p-3 text-[11px]">
                      <span className={getOrderBadgeClass(req.order.status)}>
                        Order: {req.order.status}
                      </span>
                      <span className={getReturnBadgeClass(req.status)}>
                        Return: {req.status}
                      </span>
                      <span
                        className={`${RETURN_BADGE_BASE} orders-status-chip orders-status-chip-info border-[var(--adm-primary)] bg-[var(--adm-primary-soft)] text-[var(--adm-primary)]`}
                      >
                        Resolution: {RESOLUTION_LABELS[req.requestedResolution]}
                      </span>
                      <span
                        className={`${RETURN_BADGE_BASE} orders-status-chip orders-status-chip-info border-[var(--adm-border)] bg-[var(--adm-surface-2)] text-[var(--adm-text-muted)]`}
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

                    <div className="rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] p-4 shadow-sm">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--adm-text-faint)]">
                        Customer reason
                      </div>
                      <div className="mt-3 text-sm leading-6 text-[var(--adm-text-muted)]">{req.reason}</div>
                      {req.exchangePreference ? (
                        <div className="mt-3 rounded-xl border border-[var(--adm-primary)] bg-[var(--adm-primary-soft)] px-3 py-3 text-sm text-[var(--adm-primary)]">
                          Exchange preference: {req.exchangePreference}
                        </div>
                      ) : null}
                    </div>

                    <div className="rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] p-4 shadow-sm">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--adm-text-faint)]">
                        Returned items
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--adm-text-muted)]">
                        {req.items.map((item) => (
                          <span
                            key={item.id}
                            className="rounded-full border border-[var(--adm-border)] bg-[var(--adm-surface-2)] px-3 py-1"
                          >
                            {item.orderItemName} x{item.quantity}
                          </span>
                        ))}
                      </div>
                    </div>

                    {req.exchangeOrder ? (
                      <div className="rounded-xl border border-[var(--adm-primary)] bg-[var(--adm-primary-soft)] px-4 py-4 text-sm text-cyan-50 shadow-sm">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--adm-primary)]/75">
                              Replacement order
                            </div>
                            <div className="mt-2 font-semibold">
                              Exchange order #{req.exchangeOrder.orderNumber}
                            </div>
                            <div className="mt-1 text-xs text-[var(--adm-primary)]/75">
                              Status: {req.exchangeOrder.status}
                              {req.exchangeApprovedAt
                                ? ` · approved ${new Date(req.exchangeApprovedAt).toLocaleString("de-DE")}`
                                : ""}
                            </div>
                          </div>
                          <Link
                            href={`/admin/orders/${req.exchangeOrder.id}`}
                            className="inline-flex h-8 items-center justify-center rounded-xl border border-[var(--adm-primary)] bg-cyan-300/15 px-4 text-xs font-semibold text-cyan-50 transition hover:bg-[var(--adm-primary-dim)]/25"
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
                          className="h-9 border border-[var(--adm-success)] bg-[var(--adm-primary-soft)] text-[var(--adm-success)] hover:bg-emerald-400/15"
                          disabled={savingId === req.id || req.status !== "PENDING"}
                        >
                          {savingId === req.id ? "Saving..." : "Approve"}
                        </AdminButton>
                        <AdminButton
                          tone="secondary"
                          onClick={() => void updateStatus(req.id, "REJECTED")}
                          className="h-9 border border-[#e2a136] bg-[#fff4dd] text-[#81560e] hover:bg-amber-400/15"
                          disabled={savingId === req.id || req.status !== "PENDING"}
                        >
                          {savingId === req.id ? "Saving..." : "Reject"}
                        </AdminButton>
                      </div>
                    </div>
                  </div>

                  <div className="orders-total-panel flex min-w-[180px] flex-col items-start rounded-[22px] border border-[var(--adm-border)] bg-[var(--adm-surface-2)] px-4 py-4 text-left text-[var(--adm-text)] xl:items-end xl:text-right">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--adm-text-muted)]">
                      Resolution
                    </div>
                    <div className="mt-2 text-xl font-semibold text-[var(--adm-text)]">
                      {RESOLUTION_LABELS[req.requestedResolution]}
                    </div>
                    <div className="mt-1 text-xs text-[var(--adm-text-muted)]">
                      Order {req.order.id.slice(0, 8).toUpperCase()}
                    </div>
                    <div className="mt-4 rounded-full border border-[var(--adm-primary)] bg-[var(--adm-primary-soft)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--adm-primary)]">
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
              className="border border-[var(--adm-success)] bg-emerald-400/90 text-white hover:bg-emerald-300"
            >
              Approve and apply
            </AdminButton>
          </>
        }
      >
        {approvalTarget ? (
          <>
            <div className="space-y-3 rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-[var(--adm-text-muted)]">Requested resolution</span>
                <span className="text-sm font-semibold text-[var(--adm-text)]">
                  {RESOLUTION_LABELS[approvalTarget.requestedResolution]}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-[var(--adm-text-muted)]">Return value</span>
                <span className="text-sm font-semibold text-[var(--adm-text)]">
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
              <p className="mt-2 text-xs text-[var(--adm-error)]">{approvalError}</p>
            ) : null}
          </>
        ) : null}
      </AdminDialog>
    </AdminPage>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="orders-summary-tile rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--adm-text-faint)]">
        {label}
      </div>
      <div className="mt-2 text-base font-semibold text-[var(--adm-text)]">{value}</div>
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
      ? "orders-kpi-card-emerald border-[var(--adm-success)] bg-[var(--adm-surface)]"
      : tone === "violet"
        ? "orders-kpi-card-violet border-violet-400/20 bg-[var(--adm-surface)]"
        : tone === "amber"
          ? "orders-kpi-card-amber border-[#e2a136] bg-[var(--adm-surface)]"
          : "orders-kpi-card-slate border-[var(--adm-border)] bg-[var(--adm-surface)]";
  const accentClasses =
    tone === "emerald"
      ? "orders-kpi-badge-emerald border-[var(--adm-success)] bg-[var(--adm-primary-soft)] text-[var(--adm-success)]"
      : tone === "violet"
        ? "orders-kpi-badge-violet border-violet-400/20 bg-violet-400/10 text-violet-200"
        : tone === "amber"
          ? "orders-kpi-badge-amber border-[#e2a136] bg-[#fff4dd] text-[#81560e]"
          : "orders-kpi-badge-slate border-[var(--adm-border)] bg-[var(--adm-surface-2)] text-[var(--adm-text-muted)]";

  return (
    <div className={`orders-kpi-card rounded-xl border p-3 ${toneClasses}`}>
      <div className="flex items-start justify-between gap-3">
        <p className="max-w-[14ch] text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--adm-text-faint)]">
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
      <div className="mt-3">
        <p className="max-w-full font-mono text-xl font-semibold leading-none tabular-nums text-[var(--adm-text)]">
          {value}
        </p>
      </div>
      <div className="mt-2 space-y-1">
        <p className="max-w-[26ch] text-xs leading-4 text-[var(--adm-text-muted)]">{detail}</p>
        {footnote ? (
          <div className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--adm-text-faint)]">
            {footnote}
          </div>
        ) : null}
      </div>
    </div>
  );
}
