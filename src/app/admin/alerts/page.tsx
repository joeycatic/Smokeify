import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import {
  AdminEmptyState,
  AdminMetricCard,
  AdminPanel,
} from "@/components/admin/AdminInsightPrimitives";
import { getAlertsPageData } from "@/lib/adminAddonData";
import { authOptions } from "@/lib/auth";

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

export default async function AdminAlertsPage() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") notFound();

  const { alerts } = await getAlertsPageData();
  const criticalCount = alerts.filter((alert) => alert.priority === "critical").length;
  const highCount = alerts.filter((alert) => alert.priority === "high").length;
  const mediumCount = alerts.filter((alert) => alert.priority === "medium").length;

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
              Operational inbox for finance, conversion, stock and payment signals
            </h1>
            <p className="mt-3 max-w-3xl text-sm text-slate-300">
              This page centralizes the add-on signals that should become the rule-based alert
              system. It does not replace the underlying modules where the work gets resolved.
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
        <AdminMetricCard
          label="Open Alerts"
          value={String(alerts.length)}
          detail="current"
          detailBadgeClassName="orders-kpi-badge-slate"
          footnote="generated from live admin and commerce signals"
        />
        <AdminMetricCard
          label="Critical"
          value={String(criticalCount)}
          detail="payments"
          detailBadgeClassName="orders-kpi-badge-amber"
          footnote="highest urgency"
          tone="amber"
        />
        <AdminMetricCard
          label="High"
          value={String(highCount)}
          detail="requires action"
          detailBadgeClassName="orders-kpi-badge-violet"
          footnote="watch today"
          tone="violet"
        />
        <AdminMetricCard
          label="Medium"
          value={String(mediumCount)}
          detail="monitor"
          detailBadgeClassName="orders-kpi-badge-emerald"
          footnote="secondary review"
          tone="emerald"
        />
      </section>

      <AdminPanel
        eyebrow="Alert Queue"
        title="Current signals"
        description="First-pass rule output. Later phases can add assignees, acknowledge states and snooze behavior on top of this route."
      >
        {alerts.length === 0 ? (
          <AdminEmptyState copy="No alert conditions are currently active." />
        ) : (
          <div className="space-y-3">
            {alerts.map((alert) => (
              <div
                key={`${alert.category}-${alert.title}`}
                className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-white">{alert.title}</p>
                      <span
                        className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${PRIORITY_STYLES[alert.priority]}`}
                      >
                        {PRIORITY_LABELS[alert.priority]}
                      </span>
                      <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] font-semibold text-slate-300">
                        {alert.category}
                      </span>
                    </div>
                    <p className="mt-2 max-w-3xl text-sm text-slate-400">{alert.detail}</p>
                  </div>
                  <Link
                    href={alert.href}
                    className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-white/20 hover:bg-white/[0.08]"
                  >
                    {alert.actionLabel}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </AdminPanel>

      <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <AdminPanel
          eyebrow="Model"
          title="How to read this page"
          description="The purpose is prioritization. The underlying resolution should still happen inside orders, returns, catalog, finance or VAT."
        >
          <div className="space-y-3 text-sm text-slate-300">
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3">
              Critical alerts should remain visible until the underlying issue is cleared.
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3">
              High alerts represent operational risk that can materially affect revenue, tax
              readiness or order integrity.
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3">
              Medium alerts are control signals for merchandising, support and data completeness.
            </div>
          </div>
        </AdminPanel>

        <AdminPanel
          eyebrow="Next Phase"
          title="What the full alert system still needs"
          description="This route is the inbox surface. The workflow layer can be added later without changing its place in the admin shell."
        >
          <div className="space-y-3 text-sm text-slate-300">
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3">
              Rule ownership, task states, acknowledge and snooze behavior.
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3">
              Daily digests, recurring issue grouping and audit trail for resolutions.
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3">
              Inline alert badges inside products, orders, returns and finance modules.
            </div>
          </div>
        </AdminPanel>
      </section>
    </div>
  );
}
