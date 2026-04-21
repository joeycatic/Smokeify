"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  AdminButton,
  AdminField,
  AdminInput,
  AdminMetricCard,
  AdminNotice,
  AdminPageIntro,
  AdminPanel,
  AdminSelect,
} from "@/components/admin/AdminWorkspace";
import { buildAdminSearchHref } from "@/lib/adminTimeRange";
import type { getAdminReportSnapshot } from "@/lib/adminReports";
import { formatOrderSourceLabel } from "@/lib/orderSource";

type Snapshot = Awaited<ReturnType<typeof getAdminReportSnapshot>>;
type SavedReport = Snapshot["savedReports"][number];

const REPORT_DELIVERY_WEEKDAYS = [
  { value: "0", label: "Sunday" },
  { value: "1", label: "Monday" },
  { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" },
  { value: "4", label: "Thursday" },
  { value: "5", label: "Friday" },
  { value: "6", label: "Saturday" },
] as const;

const formatMoney = (amountCents: number, currency = "EUR") =>
  new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amountCents / 100);

const formatDelta = (value: number) =>
  `${value > 0 ? "+" : ""}${Math.round(value * 100)}%`;

const formatDeliverySummary = (report: SavedReport) => {
  if (
    !report.deliveryEnabled ||
    !report.deliveryEmail ||
    !report.deliveryFrequency ||
    report.deliveryHour === null
  ) {
    return "No scheduled delivery";
  }

  const prefix =
    report.deliveryFrequency === "DAILY"
      ? "Daily"
      : REPORT_DELIVERY_WEEKDAYS.find(
          (entry) => entry.value === String(report.deliveryWeekday ?? 1)
        )?.label ?? "Monday";
  return `${prefix} at ${String(report.deliveryHour).padStart(2, "0")}:00 UTC`;
};

export default function AdminReportsClient({ initialSnapshot }: { initialSnapshot: Snapshot }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [saveName, setSaveName] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [scheduleDialog, setScheduleDialog] = useState<{
    id: string;
    name: string;
    deliveryEmail: string;
    deliveryFrequency: "DAILY" | "WEEKLY";
    deliveryWeekday: string;
    deliveryHour: string;
  } | null>(null);
  const filters = initialSnapshot.filters;
  const currentLanguage = searchParams?.get("lang") === "de" ? "de" : "en";
  const currentStorefrontScope = searchParams?.get("storefront")?.trim().toUpperCase() ?? "";

  const exportHref = useMemo(
    () =>
      buildAdminSearchHref("/api/admin/reports/export", {
        reportType: filters.reportType,
        days: String(filters.days),
        sourceStorefront: filters.sourceStorefront,
        paymentState: filters.paymentState,
      }),
    [filters.days, filters.paymentState, filters.reportType, filters.sourceStorefront],
  );

  const updateFilter = (key: string, value: string) => {
    startTransition(() => {
      router.push(
        buildAdminSearchHref(pathname, {
          ...Object.fromEntries(
            Object.entries({
              lang: currentLanguage,
              storefront: currentStorefrontScope || undefined,
              reportType: filters.reportType,
              days: String(filters.days),
              sourceStorefront: filters.sourceStorefront,
              paymentState: filters.paymentState,
            }).filter(([, entry]) => Boolean(entry)),
          ),
          [key]: value,
        }),
      );
    });
  };

  const saveReport = async () => {
    if (!saveName.trim()) {
      setError("Give the report a name before saving it.");
      setNotice("");
      return;
    }

    setError("");
    setNotice("");
    const response = await fetch("/api/admin/reports/saved", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: saveName.trim(),
        ...filters,
      }),
    });
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      setError(data.error ?? "Failed to save report.");
      return;
    }
    setSaveName("");
    setNotice("Saved report preset.");
    router.refresh();
  };

  const deleteReport = async (id: string) => {
    setError("");
    setNotice("");
    const response = await fetch(`/api/admin/reports/saved/${id}`, {
      method: "DELETE",
    });
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      setError(data.error ?? "Failed to delete report.");
      return;
    }
    setNotice("Deleted saved report.");
    router.refresh();
  };

  const openScheduleDialog = (report: SavedReport) => {
    setScheduleDialog({
      id: report.id,
      name: report.name,
      deliveryEmail: report.deliveryEmail ?? report.createdByEmail ?? "",
      deliveryFrequency: report.deliveryFrequency ?? "WEEKLY",
      deliveryWeekday: String(report.deliveryWeekday ?? 1),
      deliveryHour: String(report.deliveryHour ?? 8),
    });
    setError("");
    setNotice("");
  };

  const saveSchedule = async () => {
    if (!scheduleDialog) return;

    setError("");
    setNotice("");
    const response = await fetch(`/api/admin/reports/saved/${scheduleDialog.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deliveryEnabled: true,
        deliveryEmail: scheduleDialog.deliveryEmail,
        deliveryFrequency: scheduleDialog.deliveryFrequency,
        deliveryWeekday:
          scheduleDialog.deliveryFrequency === "WEEKLY"
            ? Number(scheduleDialog.deliveryWeekday)
            : null,
        deliveryHour: Number(scheduleDialog.deliveryHour),
      }),
    });
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      setError(data.error ?? "Failed to save schedule.");
      return;
    }
    setScheduleDialog(null);
    setNotice("Scheduled delivery saved.");
    router.refresh();
  };

  const disableSchedule = async (report: SavedReport) => {
    setError("");
    setNotice("");
    const response = await fetch(`/api/admin/reports/saved/${report.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deliveryEnabled: false }),
    });
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      setError(data.error ?? "Failed to disable schedule.");
      return;
    }
    setNotice("Scheduled delivery disabled.");
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <AdminPageIntro
        eyebrow="Admin / Reports"
        title="Saved reports and exports"
        description="Central reporting workspace for reusable admin views. Filter the commercial window, compare it against the previous period, save it as a preset, and export the current order slice."
        actions={
          <>
            <Link
              href={exportHref}
              className="inline-flex h-10 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-400/15"
            >
              Export CSV
            </Link>
            <AdminButton tone="secondary" onClick={() => router.refresh()}>
              Refresh
            </AdminButton>
          </>
        }
        metrics={
          <div className="grid gap-3 md:grid-cols-5">
            <AdminMetricCard
              label="Revenue"
              value={formatMoney(initialSnapshot.summary.revenue.current, initialSnapshot.currency)}
              detail={formatDelta(initialSnapshot.summary.revenue.deltaRatio)}
            />
            <AdminMetricCard
              label="Orders"
              value={String(initialSnapshot.summary.orders.current)}
              detail={formatDelta(initialSnapshot.summary.orders.deltaRatio)}
            />
            <AdminMetricCard
              label="AOV"
              value={formatMoney(
                initialSnapshot.summary.averageOrderValue.current,
                initialSnapshot.currency,
              )}
              detail={formatDelta(initialSnapshot.summary.averageOrderValue.deltaRatio)}
            />
            <AdminMetricCard
              label="Customers"
              value={String(initialSnapshot.summary.customers.current)}
              detail={formatDelta(initialSnapshot.summary.customers.deltaRatio)}
            />
            <AdminMetricCard
              label="Contribution"
              value={formatMoney(
                initialSnapshot.finance.contributionMarginCents,
                initialSnapshot.currency,
              )}
              detail={`${Math.round(initialSnapshot.finance.contributionMarginRatio * 100)}%`}
            />
          </div>
        }
      />

      {notice ? <AdminNotice tone="success">{notice}</AdminNotice> : null}
      {error ? <AdminNotice tone="error">{error}</AdminNotice> : null}

      <AdminPanel
        eyebrow="Filters"
        title="Current report"
        description="Change the reporting slice here, then save it as a reusable preset for the team."
      >
        <div className="grid gap-3 lg:grid-cols-5">
          <AdminField label="View">
            <AdminSelect
              value={filters.reportType}
              onChange={(event) => updateFilter("reportType", event.target.value)}
              disabled={isPending}
            >
              <option value="overview">Overview</option>
              <option value="orders">Orders</option>
              <option value="products">Products</option>
              <option value="customers">Customers</option>
            </AdminSelect>
          </AdminField>
          <AdminField label="Timespan">
            <AdminSelect
              value={String(filters.days)}
              onChange={(event) => updateFilter("days", event.target.value)}
              disabled={isPending}
            >
              <option value="30">30d</option>
              <option value="90">3mo</option>
              <option value="365">1y</option>
            </AdminSelect>
          </AdminField>
          <AdminField label="Website">
            <AdminSelect
              value={filters.sourceStorefront}
              onChange={(event) => updateFilter("sourceStorefront", event.target.value)}
              disabled={isPending}
            >
              <option value="ALL">All websites</option>
              <option value="MAIN">Smokeify</option>
              <option value="GROW">GrowVault</option>
            </AdminSelect>
          </AdminField>
          <AdminField label="Payment State">
            <AdminSelect
              value={filters.paymentState}
              onChange={(event) => updateFilter("paymentState", event.target.value)}
              disabled={isPending}
            >
              <option value="all">All states</option>
              <option value="paid">Paid only</option>
              <option value="pending">Pending only</option>
              <option value="refunded">Refunded only</option>
            </AdminSelect>
          </AdminField>
          <AdminField label="Save Preset">
            <div className="flex flex-col gap-2 sm:flex-row">
              <AdminInput
                value={saveName}
                onChange={(event) => setSaveName(event.target.value)}
                placeholder="Quarterly GrowVault"
              />
              <AdminButton disabled={isPending} onClick={saveReport}>
                Save
              </AdminButton>
            </div>
          </AdminField>
        </div>
      </AdminPanel>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <AdminPanel
          eyebrow="Presets"
          title="Saved reports"
          description="One click reload for the views you come back to often."
        >
          <div className="space-y-3">
            {initialSnapshot.savedReports.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-8 text-sm text-slate-500">
                No saved reports yet.
              </div>
            ) : (
              initialSnapshot.savedReports.map((report) => (
                <div
                  key={report.id}
                  className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="text-sm font-semibold text-white">{report.name}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {report.reportType} · {report.days}d · {report.sourceStorefront} · {report.paymentState}
                    </div>
                    <div className="mt-1 text-xs text-cyan-200/80">
                      {formatDeliverySummary(report)}
                      {report.deliveryEmail ? ` · ${report.deliveryEmail}` : ""}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Link
                      href={buildAdminSearchHref("/admin/reports", {
                        lang: currentLanguage,
                        reportType: report.reportType,
                        days: String(report.days),
                        sourceStorefront: report.sourceStorefront,
                        paymentState: report.paymentState,
                      })}
                      className="inline-flex h-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-slate-100 transition hover:bg-white/[0.08]"
                    >
                      Open
                    </Link>
                    <AdminButton tone="secondary" onClick={() => openScheduleDialog(report)}>
                      Schedule
                    </AdminButton>
                    {report.deliveryEnabled ? (
                      <AdminButton tone="danger" onClick={() => void disableSchedule(report)}>
                        Disable
                      </AdminButton>
                    ) : null}
                    <AdminButton tone="danger" onClick={() => void deleteReport(report.id)}>
                      Delete
                    </AdminButton>
                  </div>
                </div>
              ))
            )}
          </div>
        </AdminPanel>

        <AdminPanel
          eyebrow="Sources"
          title="Website source mix"
          description="Fast view of where the selected revenue slice is actually coming from."
        >
          <div className="space-y-3">
            {initialSnapshot.topSources.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-8 text-sm text-slate-500">
                No source data for the current filters.
              </div>
            ) : (
              initialSnapshot.topSources.map((source) => (
                <div
                  key={source.label}
                  className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-white">{source.label}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {source.orders} order(s)
                      </div>
                    </div>
                    <div className="text-sm font-semibold text-cyan-300">
                      {formatMoney(source.revenueCents, initialSnapshot.currency)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </AdminPanel>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <AdminPanel
          eyebrow="Products"
          title="Top products in current slice"
          description="Highest order-item revenue based on the current filters."
        >
          <div className="space-y-3">
            {initialSnapshot.topProducts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-8 text-sm text-slate-500">
                No product sales in the current filters.
              </div>
            ) : (
              initialSnapshot.topProducts.map((product) => (
                <div
                  key={`${product.productId}-${product.title}`}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3"
                >
                  <div>
                    <div className="text-sm font-semibold text-white">{product.title}</div>
                    <div className="mt-1 text-xs text-slate-500">{product.units} units</div>
                  </div>
                  <div className="text-sm font-semibold text-cyan-300">
                    {formatMoney(product.revenueCents, initialSnapshot.currency)}
                  </div>
                </div>
              ))
            )}
          </div>
        </AdminPanel>

        <AdminPanel
          eyebrow="Customers"
          title="Top customers in current slice"
          description="Most valuable customers for the current report filters."
        >
          <div className="space-y-3">
            {initialSnapshot.topCustomers.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-8 text-sm text-slate-500">
                No customer revenue in the current filters.
              </div>
            ) : (
              initialSnapshot.topCustomers.map((customer) => (
                <div
                  key={customer.email}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3"
                >
                  <div>
                    <div className="text-sm font-semibold text-white">{customer.email}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {customer.orders} order(s) · last order{" "}
                      {new Date(customer.lastOrderAt).toLocaleDateString("de-DE")}
                    </div>
                  </div>
                  <div className="text-sm font-semibold text-cyan-300">
                    {formatMoney(customer.revenueCents, initialSnapshot.currency)}
                  </div>
                </div>
              ))
            )}
          </div>
        </AdminPanel>
      </div>

      <AdminPanel
        eyebrow="Orders"
        title="Recent orders in current slice"
        description="The export uses this same filter set, so what you inspect here matches the CSV output."
      >
        <div className="space-y-3">
          {initialSnapshot.recentOrders.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-8 text-sm text-slate-500">
              No orders found for the current filters.
            </div>
          ) : (
            initialSnapshot.recentOrders.map((order) => (
              <div
                key={order.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3"
              >
                <div>
                  <div className="text-sm font-semibold text-white">
                    Order #{order.orderNumber}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {order.customerEmail ?? "Unknown"} ·{" "}
                    {new Date(order.createdAt).toLocaleString("de-DE")} ·{" "}
                    {formatOrderSourceLabel(
                      order.sourceStorefront,
                      order.sourceHost,
                      order.sourceOrigin,
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-cyan-300">
                    {formatMoney(order.amountTotal, order.currency)}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {order.paymentStatus}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </AdminPanel>

      {scheduleDialog ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center px-3 py-3 sm:items-center sm:px-4">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/70"
            aria-label="Close schedule dialog"
            onClick={() => setScheduleDialog(null)}
          />
          <div className="relative max-h-[calc(100dvh-1.5rem)] w-full max-w-lg overflow-y-auto rounded-[24px] border border-white/10 bg-[#0b1220] p-4 shadow-[0_30px_80px_rgba(0,0,0,0.45)] sm:rounded-[28px] sm:p-6">
            <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-300/80">
              Scheduled delivery
            </div>
            <h3 className="mt-2 text-xl font-semibold text-white">{scheduleDialog.name}</h3>
            <p className="mt-2 text-sm text-slate-400">
              Deliver this saved report by email on a fixed UTC schedule.
            </p>

            <div className="mt-5 grid gap-4">
              <AdminField label="Recipient email">
                <AdminInput
                  type="email"
                  value={scheduleDialog.deliveryEmail}
                  onChange={(event) =>
                    setScheduleDialog((current) =>
                      current
                        ? { ...current, deliveryEmail: event.target.value }
                        : current
                    )
                  }
                  placeholder="ops@smokeify.com"
                />
              </AdminField>
              <div className="grid gap-4 md:grid-cols-3">
                <AdminField label="Frequency">
                  <AdminSelect
                    value={scheduleDialog.deliveryFrequency}
                    onChange={(event) =>
                      setScheduleDialog((current) =>
                        current
                          ? {
                              ...current,
                              deliveryFrequency: event.target.value as "DAILY" | "WEEKLY",
                            }
                          : current
                      )
                    }
                  >
                    <option value="DAILY">Daily</option>
                    <option value="WEEKLY">Weekly</option>
                  </AdminSelect>
                </AdminField>
                <AdminField label="Weekday">
                  <AdminSelect
                    value={scheduleDialog.deliveryWeekday}
                    onChange={(event) =>
                      setScheduleDialog((current) =>
                        current
                          ? { ...current, deliveryWeekday: event.target.value }
                          : current
                      )
                    }
                    disabled={scheduleDialog.deliveryFrequency !== "WEEKLY"}
                  >
                    {REPORT_DELIVERY_WEEKDAYS.map((weekday) => (
                      <option key={weekday.value} value={weekday.value}>
                        {weekday.label}
                      </option>
                    ))}
                  </AdminSelect>
                </AdminField>
                <AdminField label="Hour (UTC)">
                  <AdminSelect
                    value={scheduleDialog.deliveryHour}
                    onChange={(event) =>
                      setScheduleDialog((current) =>
                        current
                          ? { ...current, deliveryHour: event.target.value }
                          : current
                      )
                    }
                  >
                    {Array.from({ length: 24 }, (_, index) => (
                      <option key={index} value={String(index)}>
                        {String(index).padStart(2, "0")}:00
                      </option>
                    ))}
                  </AdminSelect>
                </AdminField>
              </div>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <AdminButton tone="secondary" onClick={() => setScheduleDialog(null)}>
                Cancel
              </AdminButton>
              <AdminButton onClick={() => void saveSchedule()}>Save schedule</AdminButton>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
