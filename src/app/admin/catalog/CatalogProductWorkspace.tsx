"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowTopRightOnSquareIcon,
  DocumentDuplicateIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import {
  AdminButton,
  AdminEmptyState,
  AdminField,
  AdminIconButton,
  AdminInput,
  AdminNotice,
  AdminPanel,
  AdminSelect,
} from "@/components/admin/AdminWorkspace";
import {
  CategoryRow,
  FilterPreset,
  ProductRow,
  SortKey,
  SupplierRow,
  STATUS_OPTIONS,
  formatStorefrontLabel,
  formatDate,
  formatPercent,
  getInventoryTone,
  getProductRowTone,
  getSortLabel,
  getStorefrontBadgeTone,
  getStatusDotTone,
  getStatusTone,
  getTrendTone,
} from "./catalogShared";
import { STOREFRONT_LABELS, STOREFRONT_OPTION_ROWS } from "@/lib/storefronts";

type ToolbarProps = {
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  storefrontFilter: string;
  onStorefrontFilterChange: (value: string) => void;
  supplierFilter: string;
  onSupplierFilterChange: (value: string) => void;
  categoryFilter: string;
  onCategoryFilterChange: (value: string) => void;
  collectionFilter: string;
  onCollectionFilterChange: (value: string) => void;
  sortKey: SortKey;
  sortDirection: "asc" | "desc";
  onSortKeyChange: (value: SortKey) => void;
  onSortDirectionToggle: () => void;
  suppliers: SupplierRow[];
  categories: CategoryRow[];
  collections: CategoryRow[];
  presetName: string;
  onPresetNameChange: (value: string) => void;
  onSavePreset: () => void;
  filterPresets: FilterPreset[];
  onApplyPreset: (preset: FilterPreset) => void;
  onRemovePreset: (name: string) => void;
  onResetView: () => void;
  onOpenCategoryDrawer: () => void;
  activeFilterLabels: string[];
};

export function CatalogToolbar({
  searchTerm,
  onSearchTermChange,
  storefrontFilter,
  onStorefrontFilterChange,
  supplierFilter,
  onSupplierFilterChange,
  categoryFilter,
  onCategoryFilterChange,
  collectionFilter,
  onCollectionFilterChange,
  sortKey,
  sortDirection,
  onSortKeyChange,
  onSortDirectionToggle,
  suppliers,
  categories,
  collections,
  presetName,
  onPresetNameChange,
  onSavePreset,
  filterPresets,
  onApplyPreset,
  onRemovePreset,
  onResetView,
  onOpenCategoryDrawer,
  activeFilterLabels,
}: ToolbarProps) {
  return (
    <div className="space-y-4 rounded-[24px] border border-white/10 bg-[#0b1016] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
            Find products
          </p>
          <p className="mt-2 text-sm text-slate-300">
            Search, filter, and save views without leaving the index.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AdminButton type="button" tone="secondary" onClick={onResetView}>
            Reset view
          </AdminButton>
          <AdminButton type="button" tone="secondary" onClick={onOpenCategoryDrawer}>
            Taxonomy
          </AdminButton>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.8fr)_repeat(5,minmax(0,1fr))]">
        <AdminField label="Search">
          <AdminInput
            type="search"
            value={searchTerm}
            onChange={(event) => onSearchTermChange(event.target.value)}
            placeholder="Search title or handle"
          />
        </AdminField>
        <AdminField label="Storefront">
          <AdminSelect
            value={storefrontFilter}
            onChange={(event) => onStorefrontFilterChange(event.target.value)}
          >
            <option value="">All storefronts</option>
            {STOREFRONT_OPTION_ROWS.map((storefront) => (
              <option key={storefront.value} value={storefront.value}>
                {STOREFRONT_LABELS[storefront.value]}
              </option>
            ))}
          </AdminSelect>
        </AdminField>
        <AdminField label="Supplier">
          <AdminSelect
            value={supplierFilter}
            onChange={(event) => onSupplierFilterChange(event.target.value)}
          >
            <option value="">All suppliers</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </AdminSelect>
        </AdminField>
        <AdminField label="Category">
          <AdminSelect
            value={categoryFilter}
            onChange={(event) => onCategoryFilterChange(event.target.value)}
          >
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </AdminSelect>
        </AdminField>
        <AdminField label="Collection">
          <AdminSelect
            value={collectionFilter}
            onChange={(event) => onCollectionFilterChange(event.target.value)}
          >
            <option value="">All collections</option>
            {collections.map((collection) => (
              <option key={collection.id} value={collection.id}>
                {collection.name}
              </option>
            ))}
          </AdminSelect>
        </AdminField>
        <AdminField label="Sort">
          <div className="flex gap-2">
            <AdminSelect
              value={sortKey}
              onChange={(event) => onSortKeyChange(event.target.value as SortKey)}
            >
              <option value="updatedAt">Updated</option>
              <option value="title">Title</option>
              <option value="status">Status</option>
              <option value="variants">Variants</option>
              <option value="category">Category</option>
            </AdminSelect>
            <AdminButton
              type="button"
              tone="secondary"
              className="min-w-[88px]"
              onClick={onSortDirectionToggle}
            >
              {sortDirection === "asc" ? "Asc" : "Desc"}
            </AdminButton>
          </div>
        </AdminField>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="rounded-2xl border border-white/10 bg-[#0c1118] p-4">
          <div className="flex flex-wrap items-center gap-2">
            {activeFilterLabels.length ? (
              activeFilterLabels.map((label) => (
                <span
                  key={label}
                  className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-200"
                >
                  {label}
                </span>
              ))
            ) : (
              <span className="rounded-full border border-dashed border-white/10 px-3 py-1 text-xs text-slate-500">
                No quick filters applied
              </span>
            )}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {filterPresets.length === 0 ? (
              <span className="rounded-full border border-dashed border-white/10 px-3 py-2 text-xs text-slate-500">
                No saved views yet
              </span>
            ) : (
              filterPresets.map((preset) => (
                <div
                  key={preset.name}
                  className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2 py-1"
                >
                  <button
                    type="button"
                    onClick={() => onApplyPreset(preset)}
                    className="rounded-full px-2 py-1 text-xs font-semibold text-slate-200 transition hover:bg-white/[0.07]"
                  >
                    {preset.name}
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemovePreset(preset.name)}
                    className="rounded-full px-2 py-1 text-xs text-slate-500 transition hover:bg-red-400/10 hover:text-red-200"
                    aria-label={`Delete preset ${preset.name}`}
                  >
                    x
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-[#0c1118] p-4">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
            <AdminField label="Save current view" optional="Stored in this browser">
              <AdminInput
                value={presetName}
                onChange={(event) => onPresetNameChange(event.target.value)}
                placeholder="Preset name"
              />
            </AdminField>
            <div className="flex items-end">
              <AdminButton type="button" className="w-full sm:w-auto" onClick={onSavePreset}>
                Save view
              </AdminButton>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between gap-3 text-xs text-slate-500">
            <span>
              Sorting by <span className="text-slate-200">{getSortLabel(sortKey)}</span> in{" "}
              <span className="text-slate-200">{sortDirection}</span> order
            </span>
            <span>{filterPresets.length}/8 presets used</span>
          </div>
        </div>
      </div>
    </div>
  );
}

type TableProps = {
  products: ProductRow[];
  totalCount: number;
  currentPage: number;
  totalPages: number;
  selectedIds: string[];
  sortKey: SortKey;
  sortDirection: "asc" | "desc";
  controls?: ReactNode;
  statusCounts: { active: number; draft: number; archived: number };
  inventoryCounts: { outOfStock: number; low: number; healthy: number };
  onToggleSelected: (id: string) => void;
  onToggleSelectAll: () => void;
  onSort: (key: SortKey) => void;
  buildPageHref: (page: number) => string;
  onDuplicate: (id: string) => void;
  onPrepareDelete: (id: string, label: string) => void;
  duplicatingId: string | null;
  deletingId: string | null;
  searchTerm: string;
};

export function CatalogTablePanel({
  products,
  totalCount,
  currentPage,
  totalPages,
  selectedIds,
  sortKey,
  sortDirection,
  controls,
  statusCounts,
  inventoryCounts,
  onToggleSelected,
  onToggleSelectAll,
  onSort,
  buildPageHref,
  onDuplicate,
  onPrepareDelete,
  duplicatingId,
  deletingId,
  searchTerm,
}: TableProps) {
  return (
    <AdminPanel
      eyebrow="Products"
      title="Product index"
      description="A cleaner, more readable list with stronger color cues for state, stock, and action priority."
      actions={
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span>
            Showing <span className="text-slate-200">{products.length}</span> of{" "}
            <span className="text-slate-200">{totalCount}</span>
          </span>
          <span className="rounded-full border border-white/10 px-3 py-1">
            Page {currentPage} / {totalPages}
          </span>
        </div>
      }
    >
      {controls ? <div className="mb-5">{controls}</div> : null}

      <div className="mb-5 grid gap-3 xl:grid-cols-4">
        <MetricBar
          label="Active products"
          value={statusCounts.active}
          total={products.length}
          colorClass="bg-cyan-400"
        />
        <MetricBar
          label="Draft products"
          value={statusCounts.draft}
          total={products.length}
          colorClass="bg-amber-400"
        />
        <MetricBar
          label="Stock pressure"
          value={inventoryCounts.outOfStock + inventoryCounts.low}
          total={products.length}
          colorClass="bg-red-400"
        />
        <MetricBar
          label="Archived"
          value={statusCounts.archived}
          total={products.length}
          colorClass="bg-violet-400"
        />
      </div>

      <div className="space-y-3 md:hidden">
        {products.map((product) => (
          <CatalogMobileCard
            key={product.id}
            product={product}
            selected={selectedIds.includes(product.id)}
            onToggleSelected={() => onToggleSelected(product.id)}
            onDuplicate={() => onDuplicate(product.id)}
            onPrepareDelete={() => onPrepareDelete(product.id, product.title)}
            duplicating={duplicatingId === product.id}
            deleting={deletingId === product.id}
          />
        ))}
        {products.length === 0 ? (
          <AdminEmptyState
            title={searchTerm.trim() ? "No matching products" : "No products yet"}
            description={
              searchTerm.trim()
                ? "Try a different query or clear one of the active quick filters."
                : "Create the first product or broaden the current catalog filters."
            }
          />
        ) : null}
      </div>

      <div className="hidden overflow-x-auto rounded-[26px] border border-white/10 bg-[#05080d] md:block">
        <table className="min-w-full text-left text-sm">
          <thead className="sticky top-0 z-10 bg-[#0a1017]/95 text-[11px] uppercase tracking-[0.22em] text-slate-500 backdrop-blur">
            <tr>
              <th className="px-4 py-4">
                <input
                  type="checkbox"
                  checked={selectedIds.length === products.length && products.length > 0}
                  onChange={onToggleSelectAll}
                  aria-label="Select all products on this page"
                />
              </th>
              {(["title", "status", "category", "updatedAt"] as const).map((column) => (
                <th key={column} className="px-4 py-4">
                  <button
                    type="button"
                    onClick={() => onSort(column)}
                    className={`inline-flex items-center gap-2 transition ${
                      sortKey === column
                        ? "text-cyan-200"
                        : "text-slate-500 hover:text-slate-300"
                    }`}
                  >
                    <span>{getSortLabel(column)}</span>
                    <span className="text-[10px]">
                      {sortKey === column ? (sortDirection === "asc" ? "↑" : "↓") : "↕"}
                    </span>
                  </button>
                </th>
              ))}
              <th className="px-4 py-4">Performance</th>
              <th className="px-4 py-4">Margin</th>
              <th className="px-4 py-4">Availability</th>
              <th className="px-4 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr
                key={product.id}
                className={`relative border-t border-white/6 transition before:absolute before:inset-y-3 before:left-0 before:w-1 before:rounded-r-full before:content-[''] ${
                  selectedIds.includes(product.id)
                    ? "bg-cyan-400/[0.07]"
                    : "bg-transparent"
                } ${getProductRowTone(product)}`}
              >
                <td className="px-4 py-4">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(product.id)}
                    onChange={() => onToggleSelected(product.id)}
                    aria-label={`Select ${product.title}`}
                  />
                </td>
                <td className="px-4 py-4">
                  <div className="flex min-w-[320px] items-start gap-4">
                    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-[#0b1016]">
                      {product.imageUrl ? (
                        <Image
                          src={product.imageUrl}
                          alt={product.imageAlt || product.title}
                          fill
                          sizes="64px"
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                          No image
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/admin/catalog/${product.id}`}
                        className="inline-flex items-center gap-2 font-semibold text-slate-100 transition hover:text-cyan-200"
                      >
                        <span
                          className={`h-2.5 w-2.5 rounded-full ${getStatusDotTone(product.status)}`}
                          aria-hidden="true"
                        />
                        <span className="truncate">{product.title}</span>
                      </Link>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span>/{product.handle}</span>
                        <span className="text-slate-700">•</span>
                        <span>{product._count.variants} variants</span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                        {product.insights ? (
                          <span
                            className={`rounded-full border px-2.5 py-1 font-semibold ${getTrendTone(
                              product.insights.trendDirection,
                            )}`}
                          >
                            {product.insights.trendDirection === "trending"
                              ? "Trending"
                              : product.insights.trendDirection === "cooling"
                                ? "Cooling"
                                : "Steady"}
                          </span>
                        ) : null}
                        {product.insights &&
                        product.insights.views30d >= 20 &&
                        product.insights.conversionRate30d < 0.02 ? (
                          <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-2.5 py-1 font-semibold text-amber-200">
                            Weak CVR
                          </span>
                        ) : null}
                        {product.insights &&
                        product.insights.returnRate30d >= 0.15 &&
                        product.insights.purchases30d >= 5 ? (
                          <span className="rounded-full border border-rose-400/20 bg-rose-400/10 px-2.5 py-1 font-semibold text-rose-200">
                            Return pressure
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                        {product.storefronts.map((storefront) => (
                          <span
                            key={`${product.id}-${storefront}`}
                            className={`rounded-full border px-2 py-1 font-semibold ${getStorefrontBadgeTone(
                              storefront,
                            )}`}
                          >
                            {formatStorefrontLabel(storefront)}
                          </span>
                        ))}
                        {product.supplierName ? (
                          <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-1">
                            {product.supplierName}
                          </span>
                        ) : null}
                        {product.sellerName ? (
                          <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-1">
                            Seller: {product.sellerName}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <span
                    className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getStatusTone(
                      product.status,
                    )}`}
                  >
                    {product.status}
                  </span>
                </td>
                <td className="px-4 py-4 text-slate-300">
                  <div className="flex min-w-[150px] flex-col gap-2">
                    <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] text-slate-300">
                      {product.mainCategory?.name ?? "Unassigned"}
                    </span>
                    <span className="text-xs text-slate-500">
                      {product._count.variants} variants
                    </span>
                  </div>
                </td>
                <td className="px-4 py-4 text-slate-300">
                  {product.insights ? (
                    <div className="min-w-[180px] space-y-1.5">
                      <div className="flex items-center justify-between gap-3 text-xs">
                        <span className="text-slate-500">Views / orders</span>
                        <span className="font-medium text-slate-100">
                          {product.insights.views30d} / {product.insights.purchases30d}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3 text-xs">
                        <span className="text-slate-500">CVR</span>
                        <span className="font-medium text-slate-100">
                          {formatPercent(product.insights.conversionRate30d, 1)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3 text-xs">
                        <span className="text-slate-500">Add to cart</span>
                        <span className="font-medium text-slate-100">
                          {formatPercent(product.insights.addToCartRate30d, 1)}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-500">No product demand data yet</span>
                  )}
                </td>
                <td className="px-4 py-4 text-slate-300">
                  {product.insights ? (
                    <div className="min-w-[160px] space-y-1.5">
                      <div className="text-sm font-semibold text-slate-100">
                        {new Intl.NumberFormat("de-DE", {
                          style: "currency",
                          currency: "EUR",
                        }).format(product.insights.revenue30dCents / 100)}
                      </div>
                      <div className="text-xs text-slate-500">
                        Margin{" "}
                        <span className="font-medium text-slate-300">
                          {formatPercent(product.insights.marginRate30d, 1)}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500">
                        Returns{" "}
                        <span className="font-medium text-slate-300">
                          {formatPercent(product.insights.returnRate30d, 1)}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-500">No sales data yet</span>
                  )}
                </td>
                <td className="px-4 py-4">
                  <div className="min-w-[150px] space-y-2">
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getInventoryTone(
                        product,
                      )}`}
                    >
                      {product.availableInventory} available
                    </span>
                    <div className="text-xs text-slate-500">
                      {typeof product.insights?.stockCoverDays === "number"
                        ? `${Math.round(product.insights.stockCoverDays)} days cover`
                        : "No velocity baseline yet"}
                    </div>
                    {typeof product.insights?.stockCoverDays === "number" &&
                    product.insights.stockCoverDays < 14 ? (
                      <div className="text-[11px] font-semibold text-amber-200">
                        Replenish soon
                      </div>
                    ) : null}
                  </div>
                </td>
                <td className="px-4 py-4 text-xs text-slate-400">
                  {formatDate(product.updatedAt)}
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center justify-end gap-2">
                    <Link
                      href={`/admin/catalog/${product.id}`}
                      className="inline-flex h-10 items-center gap-2 rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-3 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-400/15"
                    >
                      <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                      Open
                    </Link>
                    <AdminIconButton
                      type="button"
                      onClick={() => onDuplicate(product.id)}
                      disabled={duplicatingId === product.id}
                      aria-label={`Duplicate ${product.title}`}
                      title="Duplicate product"
                    >
                      {duplicatingId === product.id ? (
                        <span className="text-xs font-semibold">...</span>
                      ) : (
                        <DocumentDuplicateIcon className="h-4 w-4" />
                      )}
                    </AdminIconButton>
                    <AdminIconButton
                      type="button"
                      className="border-red-400/20 bg-red-400/10 text-red-200 hover:bg-red-400/15 hover:text-red-100"
                      onClick={() => onPrepareDelete(product.id, product.title)}
                      disabled={deletingId === product.id}
                      aria-label={`Delete ${product.title}`}
                      title="Delete product"
                    >
                      {deletingId === product.id ? (
                        <span className="text-xs font-semibold">...</span>
                      ) : (
                        <TrashIcon className="h-4 w-4" />
                      )}
                    </AdminIconButton>
                  </div>
                </td>
              </tr>
            ))}
            {products.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-12">
                  <AdminEmptyState
                    title={searchTerm.trim() ? "No matching products" : "No products yet"}
                    description={
                      searchTerm.trim()
                        ? "Try a different query or clear one of the active quick filters."
                        : "Create the first product or broaden the current catalog filters."
                    }
                  />
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
        <div>
          Showing <span className="text-slate-100">{products.length}</span> rows on this page out of{" "}
          <span className="text-slate-100">{totalCount}</span> total products
        </div>
        <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-start">
          <PaginationLink
            href={buildPageHref(Math.max(1, currentPage - 1))}
            disabled={currentPage <= 1}
          >
            Prev
          </PaginationLink>
          <span className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-xs uppercase tracking-[0.2em] text-slate-500">
            Page {currentPage} / {totalPages}
          </span>
          <PaginationLink
            href={buildPageHref(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage >= totalPages}
          >
            Next
          </PaginationLink>
        </div>
      </div>
    </AdminPanel>
  );
}

type BulkTrayProps = {
  selectedIds: string[];
  bulkOpen: boolean;
  onBulkOpenToggle: () => void;
  onClearSelection: () => void;
  onApply: () => void;
  bulkSaving: boolean;
  bulkStatus: ProductRow["status"] | "";
  onBulkStatusChange: (value: ProductRow["status"] | "") => void;
  bulkPriceDirection: "increase" | "decrease";
  onBulkPriceDirectionChange: (value: "increase" | "decrease") => void;
  bulkPriceMode: "percent" | "fixed";
  onBulkPriceModeChange: (value: "percent" | "fixed") => void;
  bulkPriceValue: string;
  onBulkPriceValueChange: (value: string) => void;
  bulkLowStock: string;
  onBulkLowStockChange: (value: string) => void;
  bulkSupplierId: string;
  onBulkSupplierIdChange: (value: string) => void;
  bulkStorefronts: string;
  onBulkStorefrontsChange: (value: string) => void;
  suppliers: SupplierRow[];
  bulkCategoryAction: "add" | "remove";
  onBulkCategoryActionChange: (value: "add" | "remove") => void;
  bulkCategoryId: string;
  onBulkCategoryIdChange: (value: string) => void;
  categories: CategoryRow[];
  bulkProductGroup: string;
  onBulkProductGroupChange: (value: string) => void;
  bulkProductGroupClear: boolean;
  onBulkProductGroupClearChange: (checked: boolean) => void;
  bulkTagAdd: string;
  onBulkTagAddChange: (value: string) => void;
  bulkTagRemove: string;
  onBulkTagRemoveChange: (value: string) => void;
};

export function CatalogBulkTray({
  selectedIds,
  bulkOpen,
  onBulkOpenToggle,
  onClearSelection,
  onApply,
  bulkSaving,
  bulkStatus,
  onBulkStatusChange,
  bulkPriceDirection,
  onBulkPriceDirectionChange,
  bulkPriceMode,
  onBulkPriceModeChange,
  bulkPriceValue,
  onBulkPriceValueChange,
  bulkLowStock,
  onBulkLowStockChange,
  bulkSupplierId,
  onBulkSupplierIdChange,
  bulkStorefronts,
  onBulkStorefrontsChange,
  suppliers,
  bulkCategoryAction,
  onBulkCategoryActionChange,
  bulkCategoryId,
  onBulkCategoryIdChange,
  categories,
  bulkProductGroup,
  onBulkProductGroupChange,
  bulkProductGroupClear,
  onBulkProductGroupClearChange,
  bulkTagAdd,
  onBulkTagAddChange,
  bulkTagRemove,
  onBulkTagRemoveChange,
}: BulkTrayProps) {
  if (!selectedIds.length) return null;

  return (
    <div className="fixed inset-x-0 bottom-3 z-40 px-3 sm:bottom-6 sm:px-4">
      <div className="mx-auto w-full max-w-6xl overflow-hidden rounded-[24px] border border-white/10 bg-[#06090d]/95 shadow-[0_30px_80px_rgba(0,0,0,0.45)] backdrop-blur sm:rounded-[28px]">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
              Sticky Selection Bar
            </p>
            <div className="mt-1 text-sm text-slate-200">
              {selectedIds.length} products staged for bulk updates
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <AdminButton type="button" tone="secondary" onClick={onClearSelection}>
              Clear selection
            </AdminButton>
            <AdminButton type="button" tone="secondary" onClick={onBulkOpenToggle}>
              {bulkOpen ? "Hide controls" : "Show controls"}
            </AdminButton>
            <AdminButton type="button" onClick={onApply} disabled={bulkSaving}>
              {bulkSaving ? "Applying..." : "Apply bulk changes"}
            </AdminButton>
          </div>
        </div>

        {bulkOpen ? (
          <div className="max-h-[min(70dvh,38rem)] overflow-y-auto border-t border-white/10 px-4 py-4 sm:px-5 sm:py-5">
            <div className="grid gap-4 xl:grid-cols-4">
              <AdminField label="Status">
                <AdminSelect
                  value={bulkStatus}
                  onChange={(event) =>
                    onBulkStatusChange(event.target.value as ProductRow["status"] | "")
                  }
                >
                  <option value="">No change</option>
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </AdminSelect>
              </AdminField>
              <AdminField label="Price direction">
                <div className="grid grid-cols-3 gap-2">
                  <AdminSelect
                    value={bulkPriceDirection}
                    onChange={(event) =>
                      onBulkPriceDirectionChange(
                        event.target.value as "increase" | "decrease",
                      )
                    }
                  >
                    <option value="increase">Increase</option>
                    <option value="decrease">Decrease</option>
                  </AdminSelect>
                  <AdminSelect
                    value={bulkPriceMode}
                    onChange={(event) =>
                      onBulkPriceModeChange(event.target.value as "percent" | "fixed")
                    }
                  >
                    <option value="percent">Percent</option>
                    <option value="fixed">Fixed</option>
                  </AdminSelect>
                  <AdminInput
                    type="number"
                    min="0"
                    step="0.01"
                    value={bulkPriceValue}
                    onChange={(event) => onBulkPriceValueChange(event.target.value)}
                    placeholder="Value"
                  />
                </div>
              </AdminField>
              <AdminField label="Low stock threshold">
                <AdminInput
                  type="number"
                  min="0"
                  value={bulkLowStock}
                  onChange={(event) => onBulkLowStockChange(event.target.value)}
                  placeholder="Optional threshold"
                />
              </AdminField>
              <AdminField label="Supplier">
                <AdminSelect
                  value={bulkSupplierId}
                  onChange={(event) => onBulkSupplierIdChange(event.target.value)}
                >
                  <option value="">No change</option>
                  <option value="__clear__">Clear supplier</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </option>
                  ))}
                </AdminSelect>
              </AdminField>
              <AdminField label="Storefront visibility">
                <AdminSelect
                  value={bulkStorefronts}
                  onChange={(event) => onBulkStorefrontsChange(event.target.value)}
                >
                  <option value="">No change</option>
                  <option value="MAIN">Smokeify only</option>
                  <option value="GROW">GrowVault only</option>
                  <option value="MAIN,GROW">Smokeify + GrowVault</option>
                </AdminSelect>
              </AdminField>
              <AdminField label="Category change">
                <div className="grid grid-cols-[140px_minmax(0,1fr)] gap-2">
                  <AdminSelect
                    value={bulkCategoryAction}
                    onChange={(event) =>
                      onBulkCategoryActionChange(event.target.value as "add" | "remove")
                    }
                  >
                    <option value="add">Add</option>
                    <option value="remove">Remove</option>
                  </AdminSelect>
                  <AdminSelect
                    value={bulkCategoryId}
                    onChange={(event) => onBulkCategoryIdChange(event.target.value)}
                  >
                    <option value="">No change</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </AdminSelect>
                </div>
              </AdminField>
              <AdminField label="Product group">
                <AdminInput
                  value={bulkProductGroup}
                  onChange={(event) => onBulkProductGroupChange(event.target.value)}
                  placeholder="Optional group"
                  disabled={bulkProductGroupClear}
                />
                <label className="mt-2 inline-flex items-center gap-2 text-xs text-slate-500">
                  <input
                    type="checkbox"
                    checked={bulkProductGroupClear}
                    onChange={(event) => onBulkProductGroupClearChange(event.target.checked)}
                  />
                  Clear product group
                </label>
              </AdminField>
              <AdminField label="Add tags">
                <AdminInput
                  value={bulkTagAdd}
                  onChange={(event) => onBulkTagAddChange(event.target.value)}
                  placeholder="tag-one, tag-two"
                />
              </AdminField>
              <AdminField label="Remove tags">
                <AdminInput
                  value={bulkTagRemove}
                  onChange={(event) => onBulkTagRemoveChange(event.target.value)}
                  placeholder="tag-one, tag-two"
                />
              </AdminField>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function CatalogErrorNotice({ error }: { error: string }) {
  return error ? <AdminNotice tone="error">{error}</AdminNotice> : null;
}

function CatalogMobileCard({
  product,
  selected,
  onToggleSelected,
  onDuplicate,
  onPrepareDelete,
  duplicating,
  deleting,
}: {
  product: ProductRow;
  selected: boolean;
  onToggleSelected: () => void;
  onDuplicate: () => void;
  onPrepareDelete: () => void;
  duplicating: boolean;
  deleting: boolean;
}) {
  const revenueLabel = product.insights
    ? new Intl.NumberFormat("de-DE", {
        style: "currency",
        currency: "EUR",
      }).format(product.insights.revenue30dCents / 100)
    : "No sales data";

  return (
    <div
      className={`rounded-[24px] border border-white/10 bg-[#05080d] p-4 ${
        selected ? "ring-1 ring-cyan-400/40" : ""
      }`}
    >
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelected}
          aria-label={`Select ${product.title}`}
          className="mt-1"
        />
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-[#0b1016]">
          {product.imageUrl ? (
            <Image
              src={product.imageUrl}
              alt={product.imageAlt || product.title}
              fill
              sizes="64px"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
              No image
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <Link
              href={`/admin/catalog/${product.id}`}
              className="min-w-0 flex-1 font-semibold text-slate-100 transition hover:text-cyan-200"
            >
              <span className="flex items-center gap-2">
                <span
                  className={`h-2.5 w-2.5 shrink-0 rounded-full ${getStatusDotTone(product.status)}`}
                  aria-hidden="true"
                />
                <span className="truncate">{product.title}</span>
              </span>
            </Link>
            <span
              className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getStatusTone(
                product.status,
              )}`}
            >
              {product.status}
            </span>
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span>/{product.handle}</span>
            <span className="text-slate-700">•</span>
            <span>{product._count.variants} variants</span>
            <span className="text-slate-700">•</span>
            <span>{formatDate(product.updatedAt)}</span>
          </div>

          <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
            {product.storefronts.map((storefront) => (
              <span
                key={`${product.id}-${storefront}`}
                className={`rounded-full border px-2 py-1 font-semibold ${getStorefrontBadgeTone(
                  storefront,
                )}`}
              >
                {formatStorefrontLabel(storefront)}
              </span>
            ))}
            {product.supplierName ? (
              <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-1 text-slate-300">
                {product.supplierName}
              </span>
            ) : null}
            {product.insights ? (
              <span
                className={`rounded-full border px-2 py-1 font-semibold ${getTrendTone(
                  product.insights.trendDirection,
                )}`}
              >
                {product.insights.trendDirection === "trending"
                  ? "Trending"
                  : product.insights.trendDirection === "cooling"
                    ? "Cooling"
                    : "Steady"}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <MobileStat
          label="Category"
          value={product.mainCategory?.name ?? "Unassigned"}
        />
        <MobileStat
          label="Availability"
          value={`${product.availableInventory} available`}
          detail={
            typeof product.insights?.stockCoverDays === "number"
              ? `${Math.round(product.insights.stockCoverDays)} days cover`
              : "No velocity baseline yet"
          }
        />
        <MobileStat
          label="30d Revenue"
          value={revenueLabel}
          detail={
            product.insights
              ? `Margin ${formatPercent(product.insights.marginRate30d, 1)}`
              : undefined
          }
        />
        <MobileStat
          label="Performance"
          value={
            product.insights
              ? `${product.insights.views30d} views / ${product.insights.purchases30d} orders`
              : "No demand data yet"
          }
          detail={
            product.insights
              ? `CVR ${formatPercent(product.insights.conversionRate30d, 1)}`
              : undefined
          }
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href={`/admin/catalog/${product.id}`}
          className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-3 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-400/15"
        >
          <ArrowTopRightOnSquareIcon className="h-4 w-4" />
          Open
        </Link>
        <AdminIconButton
          type="button"
          onClick={onDuplicate}
          disabled={duplicating}
          aria-label={`Duplicate ${product.title}`}
          title="Duplicate product"
        >
          {duplicating ? (
            <span className="text-xs font-semibold">...</span>
          ) : (
            <DocumentDuplicateIcon className="h-4 w-4" />
          )}
        </AdminIconButton>
        <AdminIconButton
          type="button"
          className="border-red-400/20 bg-red-400/10 text-red-200 hover:bg-red-400/15 hover:text-red-100"
          onClick={onPrepareDelete}
          disabled={deleting}
          aria-label={`Delete ${product.title}`}
          title="Delete product"
        >
          {deleting ? (
            <span className="text-xs font-semibold">...</span>
          ) : (
            <TrashIcon className="h-4 w-4" />
          )}
        </AdminIconButton>
      </div>
    </div>
  );
}

function MetricBar({
  label,
  value,
  total,
  colorClass,
}: {
  label: string;
  value: number;
  total: number;
  colorClass: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0b1016] p-4">
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.05]">
        <div
          className={`h-full rounded-full transition-[width] ${colorClass}`}
          style={{ width: `${total ? (value / total) * 100 : 0}%` }}
        />
      </div>
    </div>
  );
}

function MobileStat({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0b1016] px-3 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
        {label}
      </div>
      <div className="mt-2 text-sm font-semibold text-slate-100">{value}</div>
      {detail ? <div className="mt-1 text-xs text-slate-500">{detail}</div> : null}
    </div>
  );
}

function PaginationLink({
  href,
  disabled,
  children,
}: {
  href: string;
  disabled: boolean;
  children: string;
}) {
  return (
    <Link
      href={href}
      aria-disabled={disabled}
      scroll={false}
      className={`inline-flex h-10 items-center justify-center rounded-xl border px-4 text-sm font-semibold transition ${
        disabled
          ? "cursor-not-allowed border-white/10 bg-white/[0.03] text-slate-600"
          : "border-white/10 bg-white/[0.03] text-slate-200 hover:border-white/20 hover:bg-white/[0.05]"
      }`}
      tabIndex={disabled ? -1 : 0}
    >
      {children}
    </Link>
  );
}
