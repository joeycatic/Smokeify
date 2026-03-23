"use client";

import { useMemo, useState } from "react";
import AdminThemeToggle from "@/components/admin/AdminThemeToggle";
import { DonutChart } from "@/components/admin/AdminCharts";

type ReturnRequestRow = {
  id: string;
  orderId: string;
  userId: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  reason: string;
  adminNote: string | null;
  createdAt: string;
  updatedAt: string;
  user: { email: string | null; name: string | null };
  order: { id: string; amountTotal: number; currency: string; status: string };
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
    return `${RETURN_BADGE_BASE} orders-status-chip orders-status-chip-success border-emerald-200 bg-emerald-50 text-emerald-800`;
  }
  if (status === "REJECTED") {
    return `${RETURN_BADGE_BASE} orders-status-chip orders-status-chip-danger border-rose-200 bg-rose-50 text-rose-700`;
  }
  return `${RETURN_BADGE_BASE} orders-status-chip orders-status-chip-warning border-amber-200 bg-amber-50 text-amber-800`;
};

const getOrderBadgeClass = (status: string) => {
  const normalizedStatus = normalizeStatus(status);
  if (normalizedStatus === "FULFILLED") {
    return `${RETURN_BADGE_BASE} orders-status-chip orders-status-chip-success border-emerald-200 bg-emerald-50 text-emerald-800`;
  }
  if (normalizedStatus === "REFUNDED") {
    return `${RETURN_BADGE_BASE} orders-status-chip orders-status-chip-neutral border-stone-200 bg-stone-100 text-stone-700`;
  }
  return `${RETURN_BADGE_BASE} orders-status-chip orders-status-chip-info border-sky-200 bg-sky-50 text-sky-800`;
};

export default function AdminReturnsClient({ requests }: Props) {
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const filteredRequests = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return requests;
    return requests.filter((req) => {
      const email = req.user?.email?.toLowerCase() ?? "";
      return (
        req.order.id.toLowerCase().includes(query) ||
        req.id.toLowerCase().includes(query) ||
        email.includes(query) ||
        req.reason.toLowerCase().includes(query)
      );
    });
  }, [requests, searchQuery]);

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
    () => filteredRequests.reduce((sum, req) => sum + req.order.amountTotal, 0),
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

  const updateStatus = async (id: string, status: "APPROVED" | "REJECTED") => {
    setError("");
    setNotice("");
    setSavingId(id);
    try {
      const res = await fetch(`/api/admin/returns/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          adminNote: noteDrafts[id],
        }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Update failed");
      } else {
        setNotice("Return request updated.");
      }
    } catch {
      setError("Update failed");
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
                Review pending returns, track approval pressure and keep refund decisions
                structured. The workflow stays simple, but the surface now matches the
                rest of the redesigned admin.
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
                  placeholder="Search by order, email or reason"
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
              detail="Potential refund exposure"
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
              detail="Average order value in return queue"
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

          <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5 h-full">
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

      {filteredRequests.length === 0 ? (
        <div className="rounded-[24px] border border-black/10 bg-white p-8 text-sm text-stone-600 shadow-sm">
          No return requests match the current scope.
        </div>
      ) : (
        <div className="space-y-4">
          {filteredRequests.map((req) => (
            <div
              key={req.id}
              className="orders-order-surface rounded-[24px] border border-black/10 bg-gradient-to-br from-white via-white to-cyan-50/40 p-5 shadow-sm transition"
            >
              <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_240px]">
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="orders-meta-chip rounded-full border border-black/10 bg-black/[0.03] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-700">
                      Return {req.order.id.slice(0, 8).toUpperCase()}
                    </span>
                    <span className="orders-meta-chip rounded-full border border-black/10 bg-white px-3 py-1 text-[11px] font-medium text-stone-600">
                      {new Date(req.createdAt).toLocaleDateString("de-DE")}
                    </span>
                  </div>

                  <div className="text-sm font-semibold text-stone-900">
                    {req.user?.email ?? "No email"}
                  </div>

                  <div className="orders-status-row flex flex-wrap gap-2 rounded-2xl border border-black/10 bg-white/70 p-3 text-[11px]">
                    <span className={getOrderBadgeClass(req.order.status)}>
                      Order: {req.order.status}
                    </span>
                    <span className={getReturnBadgeClass(req.status)}>
                      Return: {req.status}
                    </span>
                    <span className={`${RETURN_BADGE_BASE} orders-status-chip orders-status-chip-info border-sky-200 bg-sky-50 text-sky-800`}>
                      Updated: {new Date(req.updatedAt).toLocaleDateString("de-DE")}
                    </span>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="orders-summary-tile rounded-2xl border border-black/10 bg-white/80 px-4 py-3">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-500">
                        Reason
                      </div>
                      <div className="mt-2 line-clamp-2 text-sm font-medium text-stone-900">
                        {req.reason}
                      </div>
                    </div>
                    <div className="orders-summary-tile rounded-2xl border border-black/10 bg-white/80 px-4 py-3">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-500">
                        Return value
                      </div>
                      <div className="mt-2 text-base font-semibold text-stone-900">
                        {formatPrice(req.order.amountTotal, req.order.currency)}
                      </div>
                    </div>
                    <div className="orders-summary-tile rounded-2xl border border-black/10 bg-white/80 px-4 py-3">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-500">
                        Admin note
                      </div>
                      <div className="mt-2 text-base font-semibold text-stone-900">
                        {(noteDrafts[req.id] ?? req.adminNote ?? "").trim() ? "Present" : "Missing"}
                      </div>
                    </div>
                    <div className="orders-summary-tile rounded-2xl border border-black/10 bg-white/80 px-4 py-3">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-500">
                        Resolution
                      </div>
                      <div className="mt-2 text-base font-semibold text-stone-900">
                        {req.status === "PENDING" ? "Needs review" : req.status}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-black/10 bg-white/80 p-4 shadow-sm">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-500">
                      Customer reason
                    </div>
                    <div className="mt-3 text-sm leading-6 text-stone-700">
                      {req.reason}
                    </div>
                  </div>

                  <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                    <label className="text-xs font-semibold text-stone-600">
                      Admin note
                      <input
                        value={noteDrafts[req.id] ?? req.adminNote ?? ""}
                        onChange={(event) =>
                          setNoteDrafts((prev) => ({
                            ...prev,
                            [req.id]: event.target.value,
                          }))
                        }
                        className="mt-2 h-11 w-full rounded-xl border border-black/15 bg-white px-3 text-sm"
                      />
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => updateStatus(req.id, "APPROVED")}
                        className="h-11 rounded-xl border border-emerald-200 px-4 text-xs font-semibold text-emerald-800 hover:border-emerald-300"
                        disabled={savingId === req.id}
                      >
                        {savingId === req.id ? "Saving..." : "Approve"}
                      </button>
                      <button
                        type="button"
                        onClick={() => updateStatus(req.id, "REJECTED")}
                        className="h-11 rounded-xl border border-amber-200 px-4 text-xs font-semibold text-amber-800 hover:border-amber-300"
                        disabled={savingId === req.id}
                      >
                        {savingId === req.id ? "Saving..." : "Reject"}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="orders-total-panel flex min-w-[180px] flex-col items-start rounded-[22px] border border-black/10 bg-[#08111d] px-4 py-4 text-left text-white xl:items-end xl:text-right">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                    Request value
                  </div>
                  <div className="mt-2 text-xl font-semibold text-white">
                    {formatPrice(req.order.amountTotal, req.order.currency)}
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
          ))}
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
