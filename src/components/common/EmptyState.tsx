import Link from "next/link";
import type { ReactNode } from "react";

type EmptyStateAction = {
  label: string;
  href?: string;
  onClick?: () => void;
  tone?: "primary" | "secondary";
};

export default function EmptyState({
  eyebrow,
  title,
  description,
  icon,
  actions = [],
  className = "",
}: {
  eyebrow?: string;
  title: string;
  description: string;
  icon?: ReactNode;
  actions?: EmptyStateAction[];
  className?: string;
}) {
  return (
    <div
      className={`rounded-[30px] border border-[color:var(--gv-border)] bg-[linear-gradient(135deg,rgba(31,95,63,0.08),transparent_42%),var(--gv-dark)] px-6 py-8 text-center shadow-[var(--gv-shadow)] ${className}`}
    >
      {icon ? (
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-3xl border border-[color:var(--smk-accent-2)]/20 bg-[color:var(--smk-accent-2)]/10 text-[color:var(--smk-accent-2)]">
          {icon}
        </div>
      ) : null}
      {eyebrow ? (
        <p className="font-[family:var(--font-manrope)] text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--smk-accent-2)]">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="mt-2 font-[family:var(--font-fraunces)] text-3xl font-bold tracking-[-0.05em] text-[color:var(--smk-text)]">
        {title}
      </h2>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-[color:var(--smk-text-muted)]">
        {description}
      </p>
      {actions.length > 0 ? (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {actions.map((action) => {
            const className =
              action.tone === "primary"
                ? "inline-flex items-center rounded-full bg-[color:var(--smk-accent-2)] px-5 py-2.5 text-sm font-semibold text-[color:var(--smk-bg)]"
                : "inline-flex items-center rounded-full border border-[color:var(--smk-border)] bg-[color:var(--smk-bg-soft)] px-5 py-2.5 text-sm font-semibold text-[color:var(--smk-text)] hover:border-[color:var(--smk-accent-2)]/35";

            if (action.href) {
              return (
                <Link key={action.label} href={action.href} className={className}>
                  {action.label}
                </Link>
              );
            }

            return (
              <button key={action.label} type="button" onClick={action.onClick} className={className}>
                {action.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

