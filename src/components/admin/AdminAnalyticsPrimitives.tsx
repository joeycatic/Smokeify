"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type SortDirection = "asc" | "desc";

export type AdminRankingTableColumn<Row> = {
  key: string;
  label: string;
  align?: "left" | "right";
  widthClassName?: string;
  render: (row: Row) => React.ReactNode;
  sortValue?: (row: Row) => number | string;
};

export function AdminStickyToolbar({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <section className="sticky top-[5.75rem] z-10 rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] p-2 shadow-[var(--adm-shadow)]">
      <div>{children}</div>
    </section>
  );
}

export function AdminScopeChip({
  active = false,
  children,
  href,
}: {
  active?: boolean;
  children: React.ReactNode;
  href: string;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center rounded-lg border px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition ${
        active
          ? "border-transparent bg-[var(--adm-primary-soft)] text-[var(--adm-primary)]"
          : "border-[var(--adm-border)] bg-[var(--adm-surface-2)] text-[var(--adm-text)] hover:border-[var(--adm-border-strong)] hover:bg-[var(--adm-surface-2)]"
      }`}
    >
      {children}
    </Link>
  );
}

export function AdminDetailPanel({
  eyebrow,
  title,
  description,
  metrics,
  links,
}: {
  eyebrow: string;
  title: string;
  description: string;
  metrics?: Array<{ label: string; value: string }>;
  links?: Array<{ label: string; href: string; tone?: "default" | "accent" }>;
}) {
  return (
    <aside className="overflow-hidden rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] p-3 shadow-[var(--adm-shadow)]">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--adm-text-faint)]">
          {eyebrow}
        </p>
        <h3 className="mt-1.5 text-base font-semibold text-[var(--adm-text)]">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-[var(--adm-text-muted)]">{description}</p>
        {metrics?.length ? (
          <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
            {metrics.map((metric) => (
              <div
                key={metric.label}
                className="rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] px-3 py-2.5"
              >
                <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--adm-text-faint)]">
                  {metric.label}
                </div>
                <div className="mt-2 text-sm font-semibold text-[var(--adm-text)]">{metric.value}</div>
              </div>
            ))}
          </div>
        ) : null}
        {links?.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-lg border px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition ${
                  link.tone === "accent"
                    ? "border-[var(--adm-primary)] bg-[var(--adm-primary-soft)] text-[var(--adm-primary)] hover:bg-[var(--adm-primary-soft)]"
                    : "border-[var(--adm-border)] bg-[var(--adm-surface-2)] text-[var(--adm-text)] hover:border-[var(--adm-border-strong)] hover:bg-[var(--adm-surface-2)]"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>
        ) : null}
      </div>
    </aside>
  );
}

export function AdminRankingTable<Row extends { id: string }>({
  rows,
  columns,
  emptyCopy,
  selectedRowId,
  onSelectRow,
  initialSortKey,
  initialDirection = "desc",
}: {
  rows: Row[];
  columns: AdminRankingTableColumn<Row>[];
  emptyCopy: string;
  selectedRowId?: string | null;
  onSelectRow?: (row: Row) => void;
  initialSortKey?: string;
  initialDirection?: SortDirection;
}) {
  const defaultSortKey = initialSortKey ?? columns.find((column) => column.sortValue)?.key ?? columns[0]?.key;
  const [sortKey, setSortKey] = useState(defaultSortKey);
  const [sortDirection, setSortDirection] = useState<SortDirection>(initialDirection);

  const sortedRows = useMemo(() => {
    const activeColumn = columns.find((column) => column.key === sortKey);
    if (!activeColumn?.sortValue) return rows;
    const nextRows = [...rows].sort((left, right) => {
      const leftValue = activeColumn.sortValue?.(left);
      const rightValue = activeColumn.sortValue?.(right);
      if (typeof leftValue === "number" && typeof rightValue === "number") {
        return leftValue - rightValue;
      }
      return String(leftValue).localeCompare(String(rightValue), "en", {
        numeric: true,
        sensitivity: "base",
      });
    });
    return sortDirection === "asc" ? nextRows : nextRows.reverse();
  }, [columns, rows, sortDirection, sortKey]);

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--adm-border)] bg-[var(--adm-surface)] px-4 py-6 text-sm text-[var(--adm-text-faint)]">
        {emptyCopy}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)]">
      <div className="admin-scroll-x">
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="border-b border-[var(--adm-border)] bg-[var(--adm-surface)]">
              {columns.map((column) => {
                const sortable = Boolean(column.sortValue);
                const active = sortKey === column.key;
                return (
                  <th
                    key={column.key}
                    className={`px-3 py-2.5 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--adm-text-faint)] ${column.align === "right" ? "text-right" : "text-left"} ${column.widthClassName ?? ""}`}
                  >
                    {sortable ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (active) {
                            setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
                            return;
                          }
                          setSortKey(column.key);
                          setSortDirection("desc");
                        }}
                        className={`inline-flex items-center gap-2 transition ${
                          active ? "text-[var(--adm-text)]" : "hover:text-[var(--adm-text-muted)]"
                        }`}
                      >
                        <span>{column.label}</span>
                        <span className="text-[10px]">
                          {active ? (sortDirection === "asc" ? "↑" : "↓") : "↕"}
                        </span>
                      </button>
                    ) : (
                      column.label
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row) => {
              const active = selectedRowId === row.id;
              return (
                <tr
                  key={row.id}
                  className={`border-b border-[var(--adm-border)] transition last:border-b-0 ${
                    active ? "bg-[var(--adm-primary)]/8" : "hover:bg-[var(--adm-surface)]"
                  }`}
                >
                  {columns.map((column, index) => (
                    <td
                      key={column.key}
                      className={`px-3 py-2.5 text-sm ${column.align === "right" ? "text-right" : "text-left"}`}
                    >
                      {index === 0 && onSelectRow ? (
                        <button
                          type="button"
                          onClick={() => onSelectRow(row)}
                          className="block w-full text-left text-[var(--adm-text)]"
                        >
                          {column.render(row)}
                        </button>
                      ) : (
                        <div className={column.align === "right" ? "text-[var(--adm-text)]" : "text-[var(--adm-text)]"}>
                          {column.render(row)}
                        </div>
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
