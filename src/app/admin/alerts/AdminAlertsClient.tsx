"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AdminEmptyState,
  AdminInput,
  AdminMetricCard,
  AdminPanel,
  AdminSelect,
} from "@/components/admin/AdminWorkspace";
import type { AdminAlertAssignee, AdminAlertQueueItem } from "@/lib/adminAlerts";

type Props = {
  initialAlerts: AdminAlertQueueItem[];
  assignees: AdminAlertAssignee[];
};

const PRIORITY_LABELS = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
} as const;

const PRIORITY_STYLES = {
  critical: "border-rose-400/20 bg-rose-400/10 text-rose-200",
  high: "border-amber-400/20 bg-amber-400/10 text-amber-200",
  medium: "border-cyan-400/20 bg-cyan-400/10 text-cyan-200",
} as const;

const STATUS_STYLES = {
  open: "border-rose-400/20 bg-rose-400/10 text-rose-200",
  acknowledged: "border-amber-400/20 bg-amber-400/10 text-amber-200",
  snoozed: "border-sky-400/20 bg-sky-400/10 text-sky-200",
  resolved: "border-emerald-400/20 bg-emerald-400/10 text-emerald-200",
} as const;

const formatDateTime = (value: string | null) => {
  if (!value) return "—";
  return new Date(value).toLocaleString("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

export default function AdminAlertsClient({ initialAlerts, assignees }: Props) {
  const [alerts, setAlerts] = useState(initialAlerts);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<
    Record<string, { assigneeUserId: string; snoozedUntil: string; resolutionNote: string }>
  >(() =>
    Object.fromEntries(
      initialAlerts.map((alert) => [
        alert.id,
        {
          assigneeUserId: alert.assigneeUserId ?? "",
          snoozedUntil: "",
          resolutionNote: alert.resolutionNote ?? "",
        },
      ]),
    ),
  );

  const counts = useMemo(
    () => ({
      total: alerts.length,
      critical: alerts.filter((alert) => alert.priority === "critical").length,
      active: alerts.filter((alert) => alert.signalActive).length,
      unresolved: alerts.filter((alert) => alert.status !== "resolved").length,
    }),
    [alerts],
  );

  const mutateAlert = async (
    alertId: string,
    body: {
      action: "assign" | "acknowledge" | "resolve" | "snooze" | "reopen";
      assigneeUserId?: string | null;
      snoozedUntil?: string | null;
      resolutionNote?: string | null;
    },
  ) => {
    setError("");
    setSavingId(alertId);
    try {
      const response = await fetch(`/api/admin/alerts/${alertId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        alert?: AdminAlertQueueItem;
      };
      if (!response.ok || !data.alert) {
        setError(data.error ?? "Failed to update alert.");
        return;
      }
      setAlerts((current) => current.map((alert) => (alert.id === alertId ? data.alert! : alert)));
      setDrafts((current) => ({
        ...current,
        [alertId]: {
          assigneeUserId: data.alert?.assigneeUserId ?? "",
          snoozedUntil: "",
          resolutionNote: data.alert?.resolutionNote ?? "",
        },
      }));
    } catch {
      setError("Failed to update alert.");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[#140909] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.32)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(248,113,113,0.18),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(251,191,36,0.12),_transparent_28%),linear-gradient(135deg,_rgba(20,9,9,0.98),_rgba(28,12,12,0.94))]" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-rose-200/70">
              Control Layer / Alerts
            </p>
            <h1 className="mt-3 text-3xl font-semibold text-white">
              Managed operational queue for payments, stock, tax and support
            </h1>
            <p className="mt-3 max-w-3xl text-sm text-slate-300">
              Alert state now survives recalculation. Assign, acknowledge, snooze, resolve, and
              reopen work directly from this queue.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-semibold">
            <Link
              href="/admin/orders"
              className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-2 text-slate-200 transition hover:border-white/20 hover:bg-white/[0.08]"
            >
              Orders
            </Link>
            <Link
              href="/admin/returns"
              className="rounded-full border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-rose-200 transition hover:border-rose-300/30 hover:bg-rose-400/15"
            >
              Returns
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AdminMetricCard label="Alerts" value={String(counts.total)} detail="tracked" footnote="persisted operational records" />
        <AdminMetricCard label="Critical" value={String(counts.critical)} detail="priority" footnote="highest urgency" tone="amber" detailBadgeClassName="orders-kpi-badge-amber" />
        <AdminMetricCard label="Active signal" value={String(counts.active)} detail="live" footnote="currently firing conditions" tone="violet" detailBadgeClassName="orders-kpi-badge-violet" />
        <AdminMetricCard label="Unresolved" value={String(counts.unresolved)} detail="queue" footnote="not yet resolved" tone="emerald" detailBadgeClassName="orders-kpi-badge-emerald" />
      </section>

      {error ? (
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      <AdminPanel
        eyebrow="Alert Queue"
        title="Assigned signals"
        description="Repeated live conditions dedupe into a single operational record. State changes are audited."
      >
        {alerts.length === 0 ? (
          <AdminEmptyState copy="No alert conditions are currently active or persisted." />
        ) : (
          <div className="space-y-4">
            {alerts.map((alert) => {
              const draft = drafts[alert.id] ?? {
                assigneeUserId: "",
                snoozedUntil: "",
                resolutionNote: "",
              };
              const isSaving = savingId === alert.id;
              return (
                <div
                  key={alert.id}
                  className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-white">{alert.title}</p>
                        <span
                          className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${PRIORITY_STYLES[alert.priority]}`}
                        >
                          {PRIORITY_LABELS[alert.priority]}
                        </span>
                        <span
                          className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${STATUS_STYLES[alert.status]}`}
                        >
                          {alert.status}
                        </span>
                        <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] font-semibold text-slate-300">
                          {alert.category}
                        </span>
                      </div>
                      <p className="mt-2 max-w-3xl text-sm text-slate-400">{alert.detail}</p>
                      <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-500">
                        <span>Last seen {formatDateTime(alert.lastSeenAt)}</span>
                        <span>Repeats {alert.repeatCount}</span>
                        <span>Assignee {alert.assigneeEmail ?? "Unassigned"}</span>
                        <span>{alert.signalActive ? "Signal active" : `Cleared ${formatDateTime(alert.signalClearedAt)}`}</span>
                      </div>
                    </div>
                    <Link
                      href={alert.href}
                      className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-white/20 hover:bg-white/[0.08]"
                    >
                      {alert.actionLabel ?? "Open"}
                    </Link>
                  </div>

                  <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,220px)_minmax(0,220px)_minmax(0,1fr)]">
                    <AdminSelect
                      value={draft.assigneeUserId}
                      onChange={(event) =>
                        setDrafts((current) => ({
                          ...current,
                          [alert.id]: { ...draft, assigneeUserId: event.target.value },
                        }))
                      }
                    >
                      <option value="">Unassigned</option>
                      {assignees.map((assignee) => (
                        <option key={assignee.id} value={assignee.id}>
                          {assignee.name ?? assignee.email ?? assignee.id}
                        </option>
                      ))}
                    </AdminSelect>

                    <AdminInput
                      type="datetime-local"
                      value={draft.snoozedUntil}
                      onChange={(event) =>
                        setDrafts((current) => ({
                          ...current,
                          [alert.id]: { ...draft, snoozedUntil: event.target.value },
                        }))
                      }
                    />

                    <AdminInput
                      type="text"
                      value={draft.resolutionNote}
                      onChange={(event) =>
                        setDrafts((current) => ({
                          ...current,
                          [alert.id]: { ...draft, resolutionNote: event.target.value },
                        }))
                      }
                      placeholder="Resolution note"
                    />
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                    <button type="button" onClick={() => mutateAlert(alert.id, { action: "assign", assigneeUserId: draft.assigneeUserId || null })} disabled={isSaving} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-slate-100">
                      {isSaving ? "Saving..." : "Assign"}
                    </button>
                    <button type="button" onClick={() => mutateAlert(alert.id, { action: "acknowledge" })} disabled={isSaving} className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-amber-100">
                      Acknowledge
                    </button>
                    <button type="button" onClick={() => mutateAlert(alert.id, { action: "snooze", snoozedUntil: draft.snoozedUntil ? new Date(draft.snoozedUntil).toISOString() : null })} disabled={isSaving} className="rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-2 text-sky-100">
                      Snooze
                    </button>
                    <button type="button" onClick={() => mutateAlert(alert.id, { action: "resolve", resolutionNote: draft.resolutionNote })} disabled={isSaving} className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-emerald-100">
                      Resolve
                    </button>
                    <button type="button" onClick={() => mutateAlert(alert.id, { action: "reopen" })} disabled={isSaving} className="rounded-full border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-rose-100">
                      Reopen
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </AdminPanel>
    </div>
  );
}
