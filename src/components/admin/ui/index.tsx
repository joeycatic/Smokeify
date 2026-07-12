"use client";

import { MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/24/outline";
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from "react";

const cx = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");

export function AdminPage({
  layout = "standard",
  children,
  className,
}: {
  layout?: "standard" | "dashboard" | "queue" | "master-detail" | "editor" | "console";
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("admin-page", `admin-page--${layout}`, className)}>
      {children}
    </div>
  );
}

export function AdminKpiStrip({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("admin-kpi-strip", className)}>{children}</div>;
}

export function AdminPrimaryGrid({
  children,
  rail = "narrow",
  className,
}: {
  children: ReactNode;
  rail?: "narrow" | "balanced" | "wide";
  className?: string;
}) {
  return <div className={cx("admin-primary-grid", `admin-primary-grid--${rail}`, className)}>{children}</div>;
}

export function AdminSplitView({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("admin-split-view", className)}>{children}</div>;
}

export function AdminDetailRail({ children, className }: { children: ReactNode; className?: string }) {
  return <aside className={cx("admin-detail-rail", className)}>{children}</aside>;
}

export function AdminActionBar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("admin-action-bar", className)}>{children}</div>;
}

export function AdminSectionNav({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <nav aria-label={label} className={cx("admin-section-nav admin-scroll-x", className)}>
      {children}
    </nav>
  );
}

export function AdminFormGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("admin-form-grid", className)}>{children}</div>;
}

export function AdminCard({
  title,
  description,
  actions,
  children,
  className,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cx(
        "admin-card rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] p-3 shadow-[var(--adm-shadow)] sm:p-4",
        className,
      )}
    >
      {title || description || actions ? (
        <header className="mb-3 flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            {title ? <h2 className="text-sm font-semibold text-[var(--adm-text)]">{title}</h2> : null}
            {description ? (
              <p className="mt-1 max-w-3xl text-[13px] leading-5 text-[var(--adm-text-muted)]">
                {description}
              </p>
            ) : null}
          </div>
          {actions ? <div className="admin-panel-actions flex flex-wrap gap-2">{actions}</div> : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}

export function AdminStat({
  label,
  value,
  delta,
  deltaTone = "neutral",
  sparkline,
  className,
}: {
  label: string;
  value: ReactNode;
  delta?: ReactNode;
  deltaTone?: "success" | "warning" | "error" | "neutral";
  sparkline?: ReactNode;
  className?: string;
}) {
  const deltaClass = {
    success: "text-[var(--adm-success)]",
    warning: "text-[#93620f]",
    error: "text-[var(--adm-error)]",
    neutral: "text-[var(--adm-text-muted)]",
  }[deltaTone];

  return (
    <article
      className={cx(
        "rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] p-3",
        className,
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--adm-text-faint)]">
        {label}
      </p>
      <div className="mt-2 flex min-w-0 items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="font-mono text-xl font-semibold tabular-nums text-[var(--adm-text)]">{value}</div>
          {delta ? <div className={cx("mt-1 text-xs font-medium", deltaClass)}>{delta}</div> : null}
        </div>
        {sparkline ? <div className="min-w-0 shrink-0">{sparkline}</div> : null}
      </div>
    </article>
  );
}

export function AdminBadge({
  variant = "neutral",
  children,
  className,
}: {
  variant?: "success" | "warning" | "error" | "info" | "neutral" | "accent";
  children: ReactNode;
  className?: string;
}) {
  const variants = {
    success: "border-[color-mix(in_srgb,var(--adm-success)_24%,transparent)] bg-[var(--adm-primary-soft)] text-[var(--adm-success)]",
    warning: "border-[#e2a13655] bg-[#fff4dd] text-[#81560e]",
    error: "border-[#c0432c44] bg-[#fae7e3] text-[var(--adm-error)]",
    info: "border-[#2f669044] bg-[var(--adm-info-soft)] text-[var(--adm-info)]",
    neutral: "border-[var(--adm-border)] bg-[var(--adm-surface-2)] text-[var(--adm-text-muted)]",
    accent: "border-[#bd5b2b44] bg-[var(--adm-accent-soft)] text-[var(--adm-accent)]",
  }[variant];

  return (
    <span
      className={cx(
        "inline-flex min-h-5 items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold leading-4",
        variants,
        className,
      )}
    >
      {children}
    </span>
  );
}

export function AdminButton({
  variant = "secondary",
  children,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) {
  const variants = {
    primary: "border-transparent bg-[var(--adm-primary)] text-white hover:bg-[var(--adm-primary-dim)]",
    secondary:
      "border-[var(--adm-border-strong)] bg-[var(--adm-surface)] text-[var(--adm-text)] hover:bg-[var(--adm-surface-2)]",
    ghost:
      "border-transparent bg-transparent text-[var(--adm-text-muted)] hover:bg-[var(--adm-surface-2)] hover:text-[var(--adm-text)]",
    danger: "border-[#c0432c44] bg-[#fae7e3] text-[var(--adm-error)] hover:bg-[#f5d5cf]",
  }[variant];

  return (
    <button
      {...props}
      className={cx(
        "inline-flex h-8 min-w-0 items-center justify-center gap-1.5 rounded-[10px] border px-3 text-[13px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        variants,
        className,
      )}
    >
      {children}
    </button>
  );
}

export function AdminInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cx(
        "h-8 w-full min-w-0 rounded-[10px] border border-[var(--adm-border-strong)] bg-[var(--adm-surface)] px-2.5 text-[13px] text-[var(--adm-text)] outline-none placeholder:text-[var(--adm-text-faint)] focus:border-[var(--adm-primary)] focus:ring-2 focus:ring-[var(--adm-primary-soft)]",
        className,
      )}
    />
  );
}

export function AdminSelect({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cx(
        "admin-select h-8 w-full min-w-0 rounded-[10px] border border-[var(--adm-border-strong)] bg-[var(--adm-surface)] px-2.5 text-[13px] text-[var(--adm-text)] outline-none focus:border-[var(--adm-primary)] focus:ring-2 focus:ring-[var(--adm-primary-soft)]",
        className,
      )}
    />
  );
}

export function AdminSearchField({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={cx("relative block min-w-0", className)}>
      <span className="sr-only">{props["aria-label"] ?? props.placeholder ?? "Search"}</span>
      <MagnifyingGlassIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--adm-text-faint)]" />
      <AdminInput {...props} className="pl-8" />
    </label>
  );
}

export function AdminToolbar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cx(
        "admin-toolbar flex min-w-0 flex-col gap-2 rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] p-2 sm:flex-row sm:flex-wrap sm:items-center",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function AdminTable({
  children,
  empty,
  emptyTitle = "No data available",
  loading,
  className,
}: {
  children: ReactNode;
  empty?: boolean;
  emptyTitle?: string;
  loading?: boolean;
  className?: string;
}) {
  if (loading) return <AdminSkeleton rows={5} />;
  if (empty) return <AdminEmptyState title={emptyTitle} />;

  return (
    <div
      className={cx(
        "admin-data-grid-scroll overflow-hidden rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function AdminPageHeader({
  eyebrow,
  title,
  description,
  actions,
  children,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cx(
        "admin-page-header rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] p-3 sm:p-4",
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          {eyebrow ? (
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--adm-text-faint)]">
              {eyebrow}
            </p>
          ) : null}
          <h1 className={cx("text-lg font-semibold leading-6 text-[var(--adm-text)]", eyebrow && "mt-1")}>
            {title}
          </h1>
          {description ? (
            <p className="mt-1 max-w-4xl text-[13px] leading-5 text-[var(--adm-text-muted)]">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? <div className="admin-panel-actions flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      {children ? <div className="mt-3">{children}</div> : null}
    </header>
  );
}

export function AdminEmptyState({
  title = "No data available",
  description,
  action,
  className,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "rounded-xl border border-dashed border-[var(--adm-border-strong)] bg-[var(--adm-surface-2)] px-4 py-7 text-center",
        className,
      )}
    >
      <p className="text-[13px] font-semibold text-[var(--adm-text)]">{title}</p>
      {description ? <p className="mt-1 text-xs text-[var(--adm-text-muted)]">{description}</p> : null}
      {action ? <div className="mt-3 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function AdminSkeleton({ rows = 3, className }: { rows?: number; className?: string }) {
  return (
    <div className={cx("space-y-2 rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] p-3", className)}>
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={index}
          className="h-8 animate-pulse rounded-[10px] bg-[var(--adm-surface-2)] motion-reduce:animate-none"
        />
      ))}
    </div>
  );
}

function AdminOverlay({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-2 sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-[#16241a]/30"
        onClick={onClose}
        aria-label="Close overlay"
      />
      {children}
    </div>
  );
}

export function AdminModal({
  open,
  title,
  description,
  onClose,
  children,
  footer,
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  if (!open) return null;

  return (
    <AdminOverlay onClose={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-modal-title"
        className="relative max-h-[calc(100dvh-1rem)] w-full max-w-lg overflow-y-auto rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] p-4 text-[var(--adm-text)] shadow-[var(--adm-shadow-lg)]"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="admin-modal-title" className="text-sm font-semibold">{title}</h2>
            {description ? <p className="mt-1 text-[13px] text-[var(--adm-text-muted)]">{description}</p> : null}
          </div>
          <AdminButton variant="ghost" className="h-8 w-8 shrink-0 px-0" onClick={onClose} aria-label="Close dialog">
            <XMarkIcon className="h-4 w-4" />
          </AdminButton>
        </div>
        <div className="mt-4">{children}</div>
        {footer ? <div className="mt-4 flex flex-wrap justify-end gap-2">{footer}</div> : null}
      </section>
    </AdminOverlay>
  );
}

export function AdminDrawer({
  open,
  title,
  description,
  onClose,
  children,
  className,
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end sm:items-stretch">
      <button type="button" className="absolute inset-0 bg-[#16241a]/30" onClick={onClose} aria-label="Close drawer" />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-drawer-title"
        className={cx(
          "filter-drawer-in relative max-h-[calc(100dvh-0.5rem)] w-full max-w-xl overflow-y-auto rounded-t-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-[var(--adm-text)] shadow-[var(--adm-shadow-lg)] sm:h-full sm:max-h-none sm:rounded-none sm:border-y-0 sm:border-r-0",
          className,
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="admin-drawer-title" className="text-sm font-semibold">{title}</h2>
            {description ? <p className="mt-1 text-[13px] text-[var(--adm-text-muted)]">{description}</p> : null}
          </div>
          <AdminButton variant="ghost" className="h-8 w-8 shrink-0 px-0" onClick={onClose} aria-label="Close drawer">
            <XMarkIcon className="h-4 w-4" />
          </AdminButton>
        </div>
        <div className="mt-4">{children}</div>
      </section>
    </div>
  );
}
