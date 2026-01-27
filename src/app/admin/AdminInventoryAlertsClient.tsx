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
    <div className="rounded-2xl border border-amber-200/70 bg-white/90 p-6 shadow-[0_18px_40px_rgba(251,191,36,0.14)]">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold" style={{ color: "#2f3e36" }}>
            Inventory alerts
          </h2>
          <p className="text-sm text-stone-600">
            Variants at or below their low-stock threshold.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-amber-800">
          <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1">
            {totalCount} low stock
          </span>
          <span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-rose-700">
            {outOfStockCount} out
          </span>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search inventory..."
          className="h-10 w-full max-w-xs rounded-md border border-black/15 bg-white px-3 text-sm outline-none focus:border-black/30"
        />
        <div className="text-xs text-stone-500">
          Showing{" "}
          <span className="font-semibold text-stone-700">{variants.length}</span>{" "}
          of{" "}
          <span className="font-semibold text-stone-700">{totalCount}</span>
        </div>
      </div>
      {variants.length === 0 ? (
        <p className="mt-4 text-sm text-stone-500">
          No low-stock variants found.
        </p>
      ) : (
        <div className="mt-4 overflow-hidden rounded-xl border border-amber-200/70 bg-white">
          <div className="grid grid-cols-1 gap-3 border-b border-amber-200/60 bg-amber-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-amber-800 sm:grid-cols-[2fr_1fr_1fr_1fr]">
            <div>Variant</div>
            <div>Available</div>
            <div>Threshold</div>
            <div>Updated</div>
          </div>
          <div className="divide-y divide-black/10">
            {variants.map((variant) => (
              <div
                key={variant.id}
                className="grid grid-cols-1 gap-3 px-4 py-3 text-sm text-stone-700 sm:grid-cols-[2fr_1fr_1fr_1fr]"
              >
                <div>
                  <Link
                    href={`/admin/catalog/${variant.productId}`}
                    className="font-semibold text-stone-800 hover:text-stone-900"
                  >
                    {variant.productTitle}
                  </Link>
                  <div className="text-xs text-stone-500">{variant.title}</div>
                </div>
                <div className="font-semibold text-amber-800">
                  {variant.available}
                </div>
                <div>{variant.threshold}</div>
                <div className="text-xs text-stone-500">
                  {new Date(variant.updatedAt).toLocaleDateString("de-DE")}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-stone-500">
        <div>
          Page{" "}
          <span className="font-semibold text-stone-700">{currentPage}</span> of{" "}
          <span className="font-semibold text-stone-700">{totalPages}</span>
        </div>
        <div className="flex items-center gap-1">
          <Link
            href={buildPageHref(Math.max(1, currentPage - 1))}
            aria-disabled={currentPage <= 1}
            scroll={false}
            className={`inline-flex h-9 items-center justify-center rounded-md border px-3 text-xs font-semibold transition ${
              currentPage <= 1
                ? "cursor-not-allowed border-stone-200 bg-stone-100 text-stone-300"
                : "border-amber-200 bg-amber-50 text-amber-900 hover:border-amber-300 hover:bg-amber-100"
            }`}
            tabIndex={currentPage <= 1 ? -1 : 0}
            onClick={(event) => {
              if (currentPage <= 1) {
                event.preventDefault();
              }
            }}
          >
            Prev
          </Link>
          <span className="flex h-9 min-w-[5rem] items-center justify-center gap-0.5 text-center text-stone-500">
            <span>Page</span>
            <span className="font-semibold text-stone-700">{currentPage}</span>
            <span>of</span>
            <span className="font-semibold text-stone-700">{totalPages}</span>
          </span>
          <Link
            href={buildPageHref(Math.min(totalPages, currentPage + 1))}
            aria-disabled={currentPage >= totalPages}
            scroll={false}
            className={`inline-flex h-9 items-center justify-center rounded-md border px-3 text-xs font-semibold transition ${
              currentPage >= totalPages
                ? "cursor-not-allowed border-stone-200 bg-stone-100 text-stone-300"
                : "border-amber-200 bg-amber-50 text-amber-900 hover:border-amber-300 hover:bg-amber-100"
            }`}
            tabIndex={currentPage >= totalPages ? -1 : 0}
            onClick={(event) => {
              if (currentPage >= totalPages) {
                event.preventDefault();
              }
            }}
          >
            Next
          </Link>
        </div>
      </div>
      <p className="mt-2 text-[11px] text-stone-400">
        Page size: {pageSize}
      </p>
    </div>
  );
}
