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
import {
  AdminButton as AdminButtonPrimitive,
  AdminCard,
  AdminDrawer as AdminDrawerPrimitive,
  AdminEmptyState as AdminEmptyStatePrimitive,
  AdminInput as AdminInputPrimitive,
  AdminModal,
  AdminPageHeader,
  AdminSelect as AdminSelectPrimitive,
  AdminTable,
  AdminToolbar as AdminToolbarPrimitive,
} from "@/components/admin/ui";

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
    <AdminPageHeader eyebrow={eyebrow} title={title} description={description} actions={actions}>
      {metrics}
    </AdminPageHeader>
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
    <AdminCard title={title} description={description} actions={actions} className={className}>
      {eyebrow ? (
        <p className="mb-2 -mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--adm-text-faint)]">
          {eyebrow}
        </p>
      ) : null}
      {children}
    </AdminCard>
  );
}

export function AdminSurface({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] shadow-[var(--adm-shadow)] ${className}`}>
      {children}
    </section>
  );
}

export function AdminToolbar({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <AdminToolbarPrimitive className={`sticky top-[5.25rem] z-10 ${className}`}>
      {children}
    </AdminToolbarPrimitive>
  );
}

export function AdminTableShell({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <AdminTable className={className}>
      {children}
    </AdminTable>
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
      className={`admin-lift orders-kpi-card rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] p-3 ${toneClassName}`}
    >
      <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <p className="max-w-[14ch] break-words text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--adm-text-faint)]">
          {label}
        </p>
        {detail ? (
          <span
            className={`orders-kpi-badge max-w-full rounded-xl border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] whitespace-normal break-words sm:rounded-full sm:tracking-[0.18em] ${detailBadgeClassName}`}
          >
            {detail}
          </span>
        ) : null}
      </div>
      <p className="mt-3 font-mono text-xl font-semibold tabular-nums text-[var(--adm-text)]">{value}</p>
      {footnote ? <p className="mt-1 text-[13px] text-[var(--adm-text-muted)]">{footnote}</p> : null}
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
    <div className="orders-summary-tile rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--adm-text-faint)]">
        {label}
      </p>
      <div className="mt-1.5 font-mono text-base font-semibold tabular-nums text-[var(--adm-text)]">{value}</div>
    </div>
  );
}

export function AdminDeltaRow({
  label,
  value,
  delta,
  deltaToneClassName = "text-[var(--adm-primary)]",
}: {
  label: string;
  value: string;
  delta: string;
  deltaToneClassName?: string;
}) {
  return (
    <div className="orders-summary-tile flex items-center justify-between gap-3 rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] px-3 py-2.5">
      <div className="min-w-0">
        <div className="text-[13px] font-semibold text-[var(--adm-text)]">{label}</div>
        <div className="text-xs text-[var(--adm-text-faint)]">vs previous comparable window</div>
      </div>
      <div className="shrink-0 text-right">
        <div className="font-mono text-[13px] font-semibold tabular-nums text-[var(--adm-text)]">{value}</div>
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
      ? "border-[var(--adm-primary)]/20 bg-[var(--adm-primary-soft)] text-[var(--adm-success)]"
      : tone === "error"
        ? "border-[#c0432c44] bg-[#fae7e3] text-[var(--adm-error)]"
        : tone === "warning"
          ? "border-[#e2a13655] bg-[#fff4dd] text-[#81560e]"
          : "border-[#2f669044] bg-[var(--adm-info-soft)] text-[var(--adm-info)]";
  return <div className={`rounded-xl border px-3.5 py-3 text-sm ${toneClass}`}>{children}</div>;
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
    <label className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--adm-text-faint)]">
      {label}
      {optional ? <span className="ml-2 font-normal normal-case text-[var(--adm-text-muted)]">{optional}</span> : null}
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

export function AdminInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <AdminInputPrimitive {...props} />;
}

export function AdminSelect(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <AdminSelectPrimitive {...props} />;
}

export function AdminTextarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full rounded-[10px] border border-[var(--adm-border-strong)] bg-[var(--adm-surface)] px-2.5 py-2 text-[13px] text-[var(--adm-text)] outline-none placeholder:text-[var(--adm-text-faint)] focus:border-[var(--adm-primary)] focus:ring-2 focus:ring-[var(--adm-primary-soft)] ${
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
  return (
    <AdminButtonPrimitive
      {...props}
      variant={tone === "primary" ? "primary" : tone === "danger" ? "danger" : "secondary"}
      className={`w-full sm:w-auto ${className}`}
    >
      {children}
    </AdminButtonPrimitive>
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
      className={`inline-flex h-8 w-8 items-center justify-center rounded-[10px] border border-[var(--adm-border-strong)] bg-[var(--adm-surface)] text-[var(--adm-text-muted)] transition hover:bg-[var(--adm-surface-2)] hover:text-[var(--adm-text)] disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
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
  return <AdminModal open={open} title={title} description={description} onClose={onClose} footer={footer}>{children}</AdminModal>;
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
  return <AdminDrawerPrimitive open={open} title={title} description={description} onClose={onClose} className={widthClassName}>{children}</AdminDrawerPrimitive>;
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
      <AdminEmptyStatePrimitive title={copy} />
    );
  }

  return (
    <AdminEmptyStatePrimitive title={title} description={description} />
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
    <div className={`admin-scroll-x -mx-1 flex gap-1.5 px-1 text-xs font-semibold sm:mx-0 sm:flex-wrap sm:gap-2 sm:px-0 ${className}`}>
      {ADMIN_TIME_RANGE_OPTIONS.map((option) => {
        const active = option.value === activeDays;
        return (
          <Link
            key={option.value}
            href={buildAdminSearchHref(pathname, {
              ...extraParams,
              days: String(option.value),
            })}
            className={`inline-flex h-8 shrink-0 items-center rounded-[10px] border px-2.5 text-[13px] transition ${
              active
                ? "border-transparent bg-[var(--adm-primary-soft)] text-[var(--adm-primary)]"
                : "border-[var(--adm-border)] bg-[var(--adm-surface)] text-[var(--adm-text-muted)] hover:bg-[var(--adm-surface-2)]"
            }`}
          >
            {option.label}
          </Link>
        );
      })}
    </div>
  );
}
