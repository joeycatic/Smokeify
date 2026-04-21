"use client";

import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

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
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="admin-lift rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
      {detail ? <p className="mt-2 text-xs text-slate-500">{detail}</p> : null}
    </div>
  );
}

export function AdminNotice({
  tone,
  children,
}: {
  tone: "success" | "error" | "info";
  children: ReactNode;
}) {
  const toneClass =
    tone === "success"
      ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
      : tone === "error"
      ? "border-red-400/20 bg-red-400/10 text-red-200"
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
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-[24px] border border-dashed border-white/10 bg-white/[0.02] px-5 py-10 text-center">
      <div className="text-sm font-semibold text-slate-200">{title}</div>
      <div className="mt-2 text-sm text-slate-500">{description}</div>
    </div>
  );
}
