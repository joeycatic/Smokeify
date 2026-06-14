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
    <section className="sticky top-3 z-20 rounded-2xl border border-white/10 bg-[#07101b]/88 p-3 shadow-[0_16px_42px_rgba(0,0,0,0.26)] backdrop-blur-xl">
      <div className="absolute inset-0 rounded-2xl bg-[linear-gradient(135deg,rgba(255,255,255,0.05),transparent_35%),radial-gradient(circle_at_top_left,rgba(34,211,238,0.08),transparent_26%)]" />
      <div className="relative">{children}</div>
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
          ? "border-cyan-300/30 bg-cyan-300/14 text-cyan-100 shadow-[0_0_28px_rgba(34,211,238,0.08)]"
          : "border-white/10 bg-white/[0.04] text-slate-200 hover:border-white/20 hover:bg-white/[0.07]"
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
    <aside className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0b1320]/92 p-3.5 shadow-[0_14px_36px_rgba(0,0,0,0.2)]">
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.05),transparent_42%),radial-gradient(circle_at_top_right,rgba(129,140,248,0.1),transparent_24%)]" />
      <div className="relative">
        <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">
          {eyebrow}
        </p>
        <h3 className="mt-1.5 text-base font-semibold text-white">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-slate-400">{description}</p>
        {metrics?.length ? (
          <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
            {metrics.map((metric) => (
              <div
                key={metric.label}
                className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5"
              >
                <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                  {metric.label}
                </div>
                <div className="mt-2 text-sm font-semibold text-white">{metric.value}</div>
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
                    ? "border-cyan-300/25 bg-cyan-300/12 text-cyan-100 hover:border-cyan-300/35 hover:bg-cyan-300/18"
                    : "border-white/10 bg-white/[0.04] text-slate-200 hover:border-white/20 hover:bg-white/[0.07]"
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
      <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-6 text-sm text-slate-500">
        {emptyCopy}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#09111d]/90">
      <div className="admin-scroll-x">
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="border-b border-white/10 bg-white/[0.03]">
              {columns.map((column) => {
                const sortable = Boolean(column.sortValue);
                const active = sortKey === column.key;
                return (
                  <th
                    key={column.key}
                    className={`px-3 py-2.5 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 ${column.align === "right" ? "text-right" : "text-left"} ${column.widthClassName ?? ""}`}
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
                          active ? "text-slate-200" : "hover:text-slate-300"
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
                  className={`border-b border-white/6 transition last:border-b-0 ${
                    active ? "bg-cyan-400/8" : "hover:bg-white/[0.03]"
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
                          className="block w-full text-left text-slate-100"
                        >
                          {column.render(row)}
                        </button>
                      ) : (
                        <div className={column.align === "right" ? "text-slate-200" : "text-slate-100"}>
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
