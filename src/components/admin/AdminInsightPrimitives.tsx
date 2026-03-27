import Link from "next/link";
import type { ReactNode } from "react";
import {
  ADMIN_TIME_RANGE_OPTIONS,
  buildAdminSearchHref,
  type AdminTimeRangeDays,
} from "@/lib/adminTimeRange";

export function AdminPanel({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.22)]">
      <div className="mb-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">
          {eyebrow}
        </p>
        <h2 className="mt-2 text-lg font-semibold text-white">{title}</h2>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">{description}</p>
      </div>
      {children}
    </section>
  );
}

export function AdminMetricCard({
  label,
  value,
  detail,
  footnote,
  detailBadgeClassName = "orders-kpi-badge-slate",
  tone = "slate",
}: {
  label: string;
  value: string;
  detail?: string;
  footnote?: string;
  detailBadgeClassName?: string;
  tone?: "slate" | "emerald" | "violet" | "amber";
}) {
  const toneClassName =
    tone === "emerald"
      ? "orders-kpi-card-emerald"
      : tone === "violet"
        ? "orders-kpi-card-violet"
        : tone === "amber"
          ? "orders-kpi-card-amber"
          : "orders-kpi-card-slate";
  return (
    <div
      className={`orders-kpi-card rounded-[22px] border border-white/10 bg-white/[0.04] p-5 ${toneClassName}`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="max-w-[14ch] text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
          {label}
        </p>
        {detail ? (
          <span
            className={`orders-kpi-badge rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${detailBadgeClassName}`}
          >
            {detail}
          </span>
        ) : null}
      </div>
      <div className="mt-5 text-3xl font-semibold text-white">{value}</div>
      {footnote ? <p className="mt-2 text-sm text-slate-400">{footnote}</p> : null}
    </div>
  );
}

export function AdminCompactMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="orders-summary-tile rounded-2xl border border-white/10 bg-white/[0.04] p-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
        {label}
      </p>
      <div className="mt-2 text-lg font-semibold text-white">{value}</div>
    </div>
  );
}

export function AdminDeltaRow({
  label,
  value,
  delta,
  deltaToneClassName = "text-cyan-300",
}: {
  label: string;
  value: string;
  delta: string;
  deltaToneClassName?: string;
}) {
  return (
    <div className="orders-summary-tile flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3">
      <div>
        <div className="text-sm font-semibold text-slate-100">{label}</div>
        <div className="text-xs text-slate-500">vs previous comparable window</div>
      </div>
      <div className="text-right">
        <div className="text-sm font-semibold text-white">{value}</div>
        <div className={`text-xs font-medium ${deltaToneClassName}`}>{delta}</div>
      </div>
    </div>
  );
}

export function AdminEmptyState({ copy }: { copy: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-6 text-sm text-slate-500">
      {copy}
    </div>
  );
}

export function AdminTimeRangeTabs({
  pathname,
  activeDays,
  extraParams,
  className = "",
}: {
  pathname: string;
  activeDays: AdminTimeRangeDays;
  extraParams?: Record<string, string | undefined>;
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap gap-2 text-xs font-semibold ${className}`}>
      {ADMIN_TIME_RANGE_OPTIONS.map((option) => {
        const active = option.value === activeDays;
        return (
          <Link
            key={option.value}
            href={buildAdminSearchHref(pathname, {
              ...extraParams,
              days: String(option.value),
            })}
            className={`rounded-full border px-3 py-2 transition ${
              active
                ? "border-cyan-400/20 bg-cyan-400/10 text-cyan-200"
                : "border-white/10 bg-white/[0.05] text-slate-200 hover:border-white/20 hover:bg-white/[0.08]"
            }`}
          >
            {option.label}
          </Link>
        );
      })}
    </div>
  );
}
