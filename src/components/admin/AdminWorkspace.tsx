"use client";

import Link from "next/link";
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import {
  ADMIN_TIME_RANGE_OPTIONS,
  buildAdminSearchHref,
  type AdminTimeRangeDays,
} from "@/lib/adminTimeRange";

export function AdminPageIntro({
  eyebrow,
  title,
  description,
  actions,
  metrics,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
  metrics?: ReactNode;
}) {
  return (
    <section className="admin-reveal max-w-full overflow-hidden rounded-[24px] border border-white/10 bg-[linear-gradient(135deg,rgba(18,22,29,0.98),rgba(8,12,18,0.98))] p-4 shadow-[0_30px_80px_rgba(0,0,0,0.35)] sm:rounded-[32px] sm:p-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-slate-500">
            {eyebrow}
          </p>
          <h1 className="mt-3 text-2xl font-semibold text-white sm:text-3xl">{title}</h1>
          <p className="mt-3 max-w-3xl text-sm text-slate-400">{description}</p>
        </div>
        {actions ? (
          <div className="admin-panel-actions flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
            {actions}
          </div>
        ) : null}
      </div>
      {metrics ? <div className="mt-6">{metrics}</div> : null}
    </section>
  );
}

export function AdminPanel({
  eyebrow,
  title,
  description,
  actions,
  className = "",
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={`admin-reveal rounded-[24px] border border-white/10 bg-[#090d12]/90 p-4 shadow-[0_18px_50px_rgba(0,0,0,0.24)] sm:rounded-[28px] sm:p-5 ${className}`}
    >
      <div className="mb-4 flex flex-col items-start justify-between gap-3 sm:flex-row">
        <div className="min-w-0">
          {eyebrow ? (
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">
              {eyebrow}
            </p>
          ) : null}
          <h2 className="mt-2 text-lg font-semibold text-white">{title}</h2>
          {description ? <p className="mt-1 text-sm text-slate-400">{description}</p> : null}
        </div>
        {actions ? (
          <div className="admin-panel-actions flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
            {actions}
          </div>
        ) : null}
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
      className={`admin-lift orders-kpi-card rounded-2xl border border-white/10 bg-white/[0.04] p-4 ${toneClassName}`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="max-w-[14ch] break-words text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 sm:tracking-[0.22em]">
          {label}
        </p>
        {detail ? (
          <span
            className={`orders-kpi-badge shrink-0 rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] sm:tracking-[0.18em] ${detailBadgeClassName}`}
          >
            {detail}
          </span>
        ) : null}
      </div>
      <p className="mt-5 text-2xl font-semibold text-white sm:text-3xl">{value}</p>
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
      <div className="min-w-0">
        <div className="text-sm font-semibold text-slate-100">{label}</div>
        <div className="text-xs text-slate-500">vs previous comparable window</div>
      </div>
      <div className="shrink-0 text-right">
        <div className="text-sm font-semibold text-white">{value}</div>
        <div className={`text-xs font-medium ${deltaToneClassName}`}>{delta}</div>
      </div>
    </div>
  );
}

export function AdminNotice({
  tone,
  children,
}: {
  tone: "success" | "error" | "info" | "warning";
  children: ReactNode;
}) {
  const toneClass =
    tone === "success"
      ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
      : tone === "error"
        ? "border-red-400/20 bg-red-400/10 text-red-200"
        : tone === "warning"
          ? "border-amber-400/20 bg-amber-400/10 text-amber-200"
          : "border-cyan-400/20 bg-cyan-400/10 text-cyan-200";
  return <div className={`rounded-2xl border px-4 py-3 text-sm ${toneClass}`}>{children}</div>;
}

export function AdminField({
  label,
  optional,
  children,
}: {
  label: string;
  optional?: string;
  children: ReactNode;
}) {
  return (
    <label className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
      {label}
      {optional ? <span className="ml-2 font-normal normal-case text-slate-400">{optional}</span> : null}
      <div className="mt-2">{children}</div>
    </label>
  );
}

export function AdminInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`h-11 w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-cyan-400/30 focus:bg-white/[0.05] ${
        props.className ?? ""
      }`}
    />
  );
}

export function AdminSelect(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`admin-select h-11 w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 text-sm text-slate-100 outline-none focus:border-cyan-400/30 focus:bg-white/[0.05] ${
        props.className ?? ""
      }`}
    />
  );
}

export function AdminTextarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-cyan-400/30 focus:bg-white/[0.05] ${
        props.className ?? ""
      }`}
    />
  );
}

export function AdminButton({
  tone = "primary",
  children,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: "primary" | "secondary" | "danger";
}) {
  const toneClass =
    tone === "primary"
      ? "bg-cyan-400 text-slate-950 hover:bg-cyan-300"
      : tone === "danger"
      ? "border border-red-400/20 bg-red-400/10 text-red-200 hover:bg-red-400/15"
      : "border border-white/10 bg-white/[0.03] text-slate-200 hover:border-white/15 hover:bg-white/[0.05]";

  return (
    <button
      {...props}
      className={`inline-flex h-10 w-full items-center justify-center rounded-xl px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto ${toneClass} ${className}`}
    >
      {children}
    </button>
  );
}

export function AdminIconButton({
  children,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-slate-300 transition hover:border-white/15 hover:bg-white/[0.05] hover:text-white disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      {children}
    </button>
  );
}

export function AdminDialog({
  open,
  title,
  description,
  children,
  onClose,
  footer,
}: {
  open: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center px-3 py-3 sm:items-center sm:px-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
        aria-label="Close dialog"
      />
      <div className="relative max-h-[calc(100dvh-1rem)] w-full max-w-lg overflow-y-auto rounded-[24px] border border-white/10 bg-[#090d12] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_30px_80px_rgba(0,0,0,0.45)] sm:max-h-[calc(100dvh-1.5rem)] sm:rounded-[28px] sm:p-6">
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        {description ? <p className="mt-2 text-sm text-slate-400">{description}</p> : null}
        <div className="mt-5">{children}</div>
        {footer ? <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:justify-end">{footer}</div> : null}
      </div>
    </div>
  );
}

export function AdminDrawer({
  open,
  title,
  description,
  onClose,
  children,
  widthClassName = "w-full max-w-xl",
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  widthClassName?: string;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end sm:items-stretch">
      <button
        type="button"
        className="absolute inset-0 bg-black/55"
        onClick={onClose}
        aria-label="Close drawer"
      />
      <div
        className={`filter-drawer-in relative max-h-[calc(100dvh-0.5rem)] w-full ${widthClassName} max-w-full overflow-y-auto rounded-t-[24px] border border-white/10 bg-[#090d12] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[-30px_0_80px_rgba(0,0,0,0.45)] sm:h-full sm:max-h-none sm:rounded-none sm:border-y-0 sm:border-r-0 sm:border-l sm:p-6`}
      >
        <div className="mb-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">
            Workspace Panel
          </p>
          <h3 className="mt-2 text-xl font-semibold text-white">{title}</h3>
          {description ? <p className="mt-2 text-sm text-slate-400">{description}</p> : null}
        </div>
        {children}
      </div>
    </div>
  );
}

export function AdminEmptyState({
  copy,
  title,
  description,
}: {
  copy?: string;
  title?: string;
  description?: string;
}) {
  if (copy) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-6 text-sm text-slate-500">
        {copy}
      </div>
    );
  }

  return (
    <div className="rounded-[24px] border border-dashed border-white/10 bg-white/[0.02] px-5 py-10 text-center">
      <div className="text-sm font-semibold text-slate-200">{title ?? "No data available"}</div>
      <div className="mt-2 text-sm text-slate-500">{description ?? "Nothing is available yet."}</div>
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
    <div className={`admin-scroll-x -mx-1 flex gap-2 px-1 text-xs font-semibold sm:mx-0 sm:flex-wrap sm:px-0 ${className}`}>
      {ADMIN_TIME_RANGE_OPTIONS.map((option) => {
        const active = option.value === activeDays;
        return (
          <Link
            key={option.value}
            href={buildAdminSearchHref(pathname, {
              ...extraParams,
              days: String(option.value),
            })}
            className={`shrink-0 rounded-full border px-3 py-2 transition sm:shrink ${
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
