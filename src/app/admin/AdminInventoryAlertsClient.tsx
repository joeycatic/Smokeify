"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type InventoryRow = {
  id: string;
  title: string;
  productId: string;
  productTitle: string;
  available: number;
  onHand: number;
  reserved: number;
  threshold: number;
  coverDays?: number | null;
  updatedAt: string;
};

type Props = {
  variants: InventoryRow[];
  totalCount: number;
  outOfStockCount: number;
  currentPage: number;
  totalPages: number;
  pageSize: number;
  initialQuery: string;
};

export default function AdminInventoryAlertsClient({
  variants,
  totalCount,
  outOfStockCount,
  currentPage,
  totalPages,
  pageSize,
  initialQuery,
}: Props) {
  const [query, setQuery] = useState(initialQuery);
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchParamsString = searchParams?.toString() ?? "";

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    const trimmed = query.trim();
    const current = new URLSearchParams(searchParamsString).get("inv_q") ?? "";
    if (trimmed === current) return;
    const handle = setTimeout(() => {
      const params = new URLSearchParams(searchParamsString);
      if (trimmed) {
        params.set("inv_q", trimmed);
        params.set("inv_page", "1");
      } else {
        params.delete("inv_q");
        params.delete("inv_page");
      }
      const queryString = params.toString();
      router.replace(queryString ? `/admin?${queryString}` : "/admin", {
        scroll: false,
      });
    }, 300);
    return () => clearTimeout(handle);
  }, [query, router, searchParamsString]);

  const buildPageHref = (page: number) => {
    const params = new URLSearchParams(searchParamsString);
    const trimmed = query.trim();
    if (trimmed) {
      params.set("inv_q", trimmed);
    } else {
      params.delete("inv_q");
    }
    if (page > 1) {
      params.set("inv_page", String(page));
    } else {
      params.delete("inv_page");
    }
    const queryString = params.toString();
    return queryString ? `/admin?${queryString}` : "/admin";
  };

  return (
    <section className="admin-reveal space-y-5 rounded-[28px] border border-white/10 bg-[#090d12]/90 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.24)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">
            Inventory
          </p>
          <h2 className="mt-2 text-lg font-semibold text-white">Low-stock alerts</h2>
          <p className="mt-1 text-sm text-slate-400">
            Variants at or below threshold, with direct jump links into product editing.
          </p>
        </div>
        <div className="grid min-w-[16rem] gap-2 sm:grid-cols-2">
          <StatChip label="Low stock" value={String(totalCount)} tone="amber" />
          <StatChip label="Out of stock" value={String(outOfStockCount)} tone="red" />
          <StatChip label="Visible rows" value={String(variants.length)} tone="neutral" />
          <StatChip label="Page size" value={String(pageSize)} tone="neutral" />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex min-w-[16rem] flex-1 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-300">
          <svg viewBox="0 0 24 24" className="h-4 w-4 text-slate-500" aria-hidden="true">
            <path
              d="M11 4a7 7 0 015.25 11.7l3.53 3.53a1 1 0 01-1.41 1.41l-3.53-3.53A7 7 0 1111 4z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search product or variant"
            className="w-full bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500"
          />
        </label>
        <div className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-slate-400">
          Page {currentPage} / {totalPages}
        </div>
      </div>

      {variants.length === 0 ? (
        <div className="rounded-[24px] border border-white/10 bg-white/[0.02] px-4 py-10 text-center text-sm text-slate-500">
          No low-stock variants for this query.
        </div>
      ) : (
        <div className="overflow-hidden rounded-[24px] border border-white/10 bg-[#070a0f]">
          <div className="grid grid-cols-[1.8fr_100px_100px_120px_120px] gap-3 border-b border-white/10 bg-white/[0.03] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
            <div>Variant</div>
            <div>Available</div>
            <div>Threshold</div>
            <div>Cover</div>
            <div>Updated</div>
          </div>
          <div className="divide-y divide-white/5">
            {variants.map((variant) => (
              <div
                key={variant.id}
                className="grid grid-cols-[1.8fr_100px_100px_120px_120px] gap-3 px-4 py-3 text-sm text-slate-300 transition hover:bg-white/[0.03]"
              >
                <div>
                  <Link
                    href={`/admin/catalog/${variant.productId}`}
                    className="font-semibold text-slate-100 underline-offset-4 hover:text-cyan-300 hover:underline"
                  >
                    {variant.productTitle}
                  </Link>
                  <div className="text-xs text-slate-500">{variant.title}</div>
                </div>
                <div>
                  <span
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                      variant.available === 0
                        ? "border-red-400/20 bg-red-400/10 text-red-200"
                        : "border-amber-400/20 bg-amber-400/10 text-amber-200"
                    }`}
                  >
                    {variant.available}
                  </span>
                </div>
                <div className="text-slate-400">{variant.threshold}</div>
                <div className="text-slate-400">
                  {typeof variant.coverDays === "number"
                    ? `${Math.round(variant.coverDays)}d`
                    : "No sales"}
                </div>
                <div className="text-slate-500">
                  {new Date(variant.updatedAt).toLocaleDateString("de-DE")}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
        <div>
          Showing <span className="font-semibold text-slate-100">{variants.length}</span> of{" "}
          <span className="font-semibold text-slate-100">{totalCount}</span>
        </div>
        <div className="flex items-center gap-2">
          <PagerLink href={buildPageHref(Math.max(1, currentPage - 1))} disabled={currentPage <= 1}>
            Prev
          </PagerLink>
          <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-2">
            {currentPage} / {totalPages}
          </span>
          <PagerLink
            href={buildPageHref(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage >= totalPages}
          >
            Next
          </PagerLink>
        </div>
      </div>
    </section>
  );
}

function StatChip({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "amber" | "red" | "neutral";
}) {
  const toneClass =
    tone === "amber"
      ? "border-amber-400/20 bg-amber-400/10 text-amber-200"
      : tone === "red"
      ? "border-red-400/20 bg-red-400/10 text-red-200"
      : "border-white/10 bg-white/[0.03] text-slate-200";

  return (
    <div className={`rounded-2xl border px-3 py-2 ${toneClass}`}>
      <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold">{value}</div>
    </div>
  );
}

function PagerLink({
  href,
  disabled,
  children,
}: {
  href: string;
  disabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-disabled={disabled}
      scroll={false}
      tabIndex={disabled ? -1 : 0}
      onClick={(event) => {
        if (disabled) {
          event.preventDefault();
        }
      }}
      className={`inline-flex h-10 items-center justify-center rounded-xl border px-4 font-semibold transition ${
        disabled
          ? "cursor-not-allowed border-white/5 bg-white/[0.02] text-slate-600"
          : "border-white/10 bg-white/[0.03] text-slate-200 hover:border-cyan-400/30 hover:bg-cyan-400/10 hover:text-cyan-200"
      }`}
    >
      {children}
    </Link>
  );
}
