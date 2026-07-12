"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useMemo, useState, useTransition } from "react";
import {
  AdminKpiStrip,
  AdminPage,
  AdminPageHeader,
  AdminSplitView,
  AdminStat,
} from "@/components/admin/ui";

type ComplianceBlocker = {
  type: string;
  field: string;
  reason: string;
  match?: string;
};

type ComplianceProduct = {
  id: string;
  title: string;
  handle: string;
  status: string;
  storefronts: string[];
  complianceStatus: string;
  complianceOwnerEmail: string | null;
  complianceReviewedAt: string | null;
  complianceFeedEligible: boolean;
  complianceAdsEligible: boolean;
  complianceAgeGateRequired: boolean;
  complianceNotes: string | null;
  complianceManualBlockers: string[];
  updatedAt: string;
  mainCategory: { name: string; handle: string } | null;
  blockerCount: number;
  blockers: ComplianceBlocker[];
};

type ComplianceFilters = {
  q: string;
  storefront: string;
  status: string;
  blockerType: string;
  feedEligibility: string;
  adsEligibility: string;
  category: string;
  page: number;
};

type AdminComplianceClientProps = {
  products: ComplianceProduct[];
  filters: ComplianceFilters;
  hasNextPage: boolean;
};

const statuses = ["", "DRAFT_REVIEW", "APPROVED", "NEEDS_CHANGES", "BLOCKED"];
const blockerTypes = [
  "",
  "MEDICAL_CLAIM",
  "ILLEGAL_USE_IMPLICATION",
  "RESTRICTED_CATEGORY",
  "MISSING_CERTIFICATION",
  "REGION_RESTRICTION",
  "AD_POLICY",
  "FEED_POLICY",
  "AGE_GATE_REQUIRED",
  "MANUAL",
];

const statusClassName = (status: string) => {
  if (status === "APPROVED") return "border-[var(--adm-success)] bg-[var(--adm-primary-soft)] text-[var(--adm-success)]";
  if (status === "BLOCKED") return "border-[var(--adm-error)] bg-[#fae7e3] text-[var(--adm-error)]";
  if (status === "NEEDS_CHANGES") return "border-[#e2a136] bg-[#fff4dd] text-[#81560e]";
  return "border-sky-400/20 bg-sky-400/10 text-sky-200";
};

export default function AdminComplianceClient({
  products,
  filters,
  hasNextPage,
}: AdminComplianceClientProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const [activeProduct, setActiveProduct] = useState<ComplianceProduct | null>(
    products[0] ?? null,
  );
  const [isPending, startTransition] = useTransition();

  const selectedProducts = useMemo(
    () => products.filter((product) => selected.includes(product.id)),
    [products, selected],
  );

  const runAction = async (
    action: string,
    productIds: string[],
    extra: Record<string, unknown> = {},
  ) => {
    if (productIds.length === 0) return;
    setNotice("Applying compliance action...");
    const bulk = productIds.length > 1;
    const response = await fetch(
      bulk
        ? "/api/admin/compliance/products/bulk"
        : `/api/admin/compliance/products/${productIds[0]}`,
      {
        method: bulk ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ids: productIds, ...extra }),
      },
    );
    const data = (await response.json().catch(() => ({}))) as {
      error?: string;
      succeeded?: number;
    };
    if (!response.ok) {
      setNotice(data.error ?? "Compliance action failed.");
      return;
    }
    setNotice(
      bulk
        ? `Applied action to ${data.succeeded ?? productIds.length} products.`
        : "Compliance action applied.",
    );
    setSelected([]);
    startTransition(() => router.refresh());
  };

  const promptNote = (fallback: string) =>
    window.prompt("Audit note / review reason", fallback)?.trim() ?? "";

  return (
    <AdminPage layout="master-detail">
      <section className="overflow-hidden rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] shadow-[var(--adm-shadow)]">
        <AdminPageHeader
          eyebrow="Admin / Catalog / Compliance"
          title="Governed compliance queue"
          description="Review blockers, assign ownership, and audit feed or ads eligibility."
          className="rounded-none border-0 border-b"
        >
          <AdminKpiStrip>
            <AdminStat label="Queued" value={products.length} />
            <AdminStat label="Blocked" value={products.filter((product) => product.blockerCount > 0).length} deltaTone="error" />
            <AdminStat label="Unowned" value={products.filter((product) => !product.complianceOwnerEmail).length} deltaTone="warning" />
          </AdminKpiStrip>
        </AdminPageHeader>

        <form className="grid gap-3 border-b border-[var(--adm-border)] bg-[var(--adm-surface)] p-4 sm:grid-cols-2 lg:grid-cols-7">
          <FilterInput name="q" label="Search" defaultValue={filters.q} />
          <FilterSelect name="storefront" label="Storefront" defaultValue={filters.storefront}>
            <option value="">All</option>
            <option value="MAIN">Main</option>
            <option value="GROW">GrowVault</option>
          </FilterSelect>
          <FilterSelect name="status" label="Status" defaultValue={filters.status}>
            {statuses.map((status) => (
              <option key={status} value={status}>
                {status || "All"}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect name="blockerType" label="Blocker" defaultValue={filters.blockerType}>
            {blockerTypes.map((type) => (
              <option key={type} value={type}>
                {type || "All"}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect
            name="feedEligibility"
            label="Feed"
            defaultValue={filters.feedEligibility}
          >
            <option value="">All</option>
            <option value="eligible">Eligible</option>
            <option value="blocked">Blocked</option>
          </FilterSelect>
          <FilterSelect name="adsEligibility" label="Ads" defaultValue={filters.adsEligibility}>
            <option value="">All</option>
            <option value="eligible">Eligible</option>
            <option value="blocked">Blocked</option>
          </FilterSelect>
          <div className="flex items-end gap-2">
            <FilterInput name="category" label="Category" defaultValue={filters.category} />
            <button
              type="submit"
              className="h-8 rounded-xl border border-[var(--adm-primary)] bg-[var(--adm-primary-soft)] px-4 text-sm font-semibold text-[var(--adm-primary)] transition hover:bg-[var(--adm-primary)]/15"
            >
              Apply
            </button>
          </div>
        </form>

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--adm-border)] px-4 py-3 text-sm">
          <div className="text-[var(--adm-text-muted)]">
            {selected.length ? `${selected.length} selected` : "Select rows for bulk review"}
          </div>
          <div className="flex flex-wrap gap-2">
            <BulkButton
              disabled={!selected.length || isPending}
              onClick={() => void runAction("assign_owner", selected, { note: "Bulk assigned" })}
            >
              Assign to me
            </BulkButton>
            <BulkButton
              disabled={!selected.length || isPending}
              onClick={() => {
                const note = promptNote("Bulk approval");
                if (note) void runAction("approve", selected, { note });
              }}
            >
              Approve
            </BulkButton>
            <BulkButton
              disabled={!selected.length || isPending}
              onClick={() => {
                const note = promptNote("Needs changes");
                if (note) void runAction("request_changes", selected, { note });
              }}
            >
              Request changes
            </BulkButton>
          </div>
        </div>

        {notice ? (
          <div className="border-b border-[var(--adm-primary)] bg-[var(--adm-primary-soft)] px-4 py-3 text-sm font-medium text-[var(--adm-primary)]">
            {notice}
          </div>
        ) : null}

        <AdminSplitView className="min-h-[520px] gap-0">
          <div className="min-w-0 divide-y divide-[var(--adm-border)]">
            {products.map((product) => {
              const checked = selected.includes(product.id);
              const active = activeProduct?.id === product.id;
              return (
                <div
                  key={product.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setActiveProduct(product)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setActiveProduct(product);
                    }
                  }}
                  className={`grid w-full min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-3 px-4 py-4 text-left transition md:grid-cols-[auto_minmax(0,1.35fr)_0.75fr_0.75fr_0.75fr] ${
                    active ? "bg-[var(--adm-surface-2)]" : "hover:bg-[var(--adm-surface-2)]"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onClick={(event) => event.stopPropagation()}
                    onChange={(event) => {
                      setSelected((current) =>
                        event.target.checked
                          ? [...current, product.id]
                          : current.filter((id) => id !== product.id),
                      );
                    }}
                    className="mt-1 h-4 w-4 rounded border-[var(--adm-border-strong)] bg-[var(--adm-surface)]"
                    aria-label={`Select ${product.title}`}
                  />
                  <div className="min-w-0">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <Link
                        href={`/admin/catalog/${product.id}`}
                        onClick={(event) => event.stopPropagation()}
                        className="truncate text-sm font-semibold text-[var(--adm-text)] hover:text-[var(--adm-primary)]"
                      >
                        {product.title}
                      </Link>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusClassName(product.complianceStatus)}`}
                      >
                        {product.complianceStatus.replace("_", " ")}
                      </span>
                    </div>
                    <div className="mt-1 truncate text-xs text-[var(--adm-text-faint)]">
                      {product.handle} · {product.mainCategory?.handle ?? "uncategorized"}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {product.blockers.slice(0, 3).map((blocker) => (
                        <span
                          key={`${product.id}-${blocker.type}-${blocker.field}-${blocker.match ?? blocker.reason}`}
                          className="rounded-full border border-rose-400/15 bg-[#fae7e3] px-2 py-0.5 text-[10px] font-semibold text-[var(--adm-error)]"
                        >
                          {blocker.type}
                        </span>
                      ))}
                      {product.blockerCount === 0 ? (
                        <span className="rounded-full border border-emerald-400/15 bg-[var(--adm-primary-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--adm-success)]">
                          No blockers
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <QueueCell label="Owner" value={product.complianceOwnerEmail ?? "Unassigned"} />
                  <QueueCell
                    label="Surface"
                    value={`Feed ${product.complianceFeedEligible ? "on" : "off"} · Ads ${
                      product.complianceAdsEligible ? "on" : "off"
                    }`}
                  />
                  <QueueCell
                    label="Updated"
                    value={new Date(product.updatedAt).toLocaleDateString()}
                  />
                </div>
              );
            })}
            {products.length === 0 ? (
              <div className="px-4 py-16 text-center text-sm text-[var(--adm-text-faint)]">
                No products match this compliance queue view.
              </div>
            ) : null}
          </div>

          <aside className="border-t border-[var(--adm-border)] bg-[var(--adm-surface-2)] p-4 lg:border-l lg:border-t-0">
            {activeProduct ? (
              <DetailPanel
                product={activeProduct}
                selectedCount={selectedProducts.length}
                onAction={(action, extra) => void runAction(action, [activeProduct.id], extra)}
              />
            ) : (
              <div className="rounded-xl border border-dashed border-[var(--adm-border)] p-6 text-sm text-[var(--adm-text-faint)]">
                Select a product to review blockers and actions.
              </div>
            )}
          </aside>
        </AdminSplitView>
      </section>

      <div className="flex items-center justify-between gap-3 text-sm text-[var(--adm-text-faint)]">
        <Link href="/admin/catalog" className="font-semibold text-[var(--adm-primary)] hover:text-[var(--adm-primary)]">
          Back to catalog
        </Link>
        {hasNextPage ? (
          <Link
            href={`/admin/compliance?page=${filters.page + 1}`}
            className="rounded-xl border border-[var(--adm-border)] px-3 py-2 font-semibold text-[var(--adm-text)] hover:bg-[var(--adm-surface-2)]"
          >
            Next page
          </Link>
        ) : null}
      </div>
    </AdminPage>
  );
}

function FilterInput({
  name,
  label,
  defaultValue,
}: {
  name: string;
  label: string;
  defaultValue: string;
}) {
  return (
    <label className="min-w-0 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--adm-text-faint)]">
      {label}
      <input
        name={name}
        defaultValue={defaultValue}
        className="mt-2 h-8 w-full rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface-2)] px-3 text-sm normal-case tracking-normal text-[var(--adm-text)] outline-none focus:border-cyan-400/40"
      />
    </label>
  );
}

function FilterSelect({
  name,
  label,
  defaultValue,
  children,
}: {
  name: string;
  label: string;
  defaultValue: string;
  children: ReactNode;
}) {
  return (
    <label className="min-w-0 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--adm-text-faint)]">
      {label}
      <select
        name={name}
        defaultValue={defaultValue}
        className="mt-2 h-8 w-full rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] px-3 text-sm normal-case tracking-normal text-[var(--adm-text)] outline-none focus:border-cyan-400/40"
      >
        {children}
      </select>
    </label>
  );
}

function BulkButton({
  disabled,
  onClick,
  children,
}: {
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] px-3 py-2 text-xs font-semibold text-[var(--adm-text)] transition hover:bg-[var(--adm-surface-2)] disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function QueueCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="hidden min-w-0 text-xs md:block">
      <div className="font-semibold uppercase tracking-[0.14em] text-[var(--adm-text-faint)]">{label}</div>
      <div className="mt-1 truncate text-[var(--adm-text-muted)]">{value}</div>
    </div>
  );
}

function DetailPanel({
  product,
  selectedCount,
  onAction,
}: {
  product: ComplianceProduct;
  selectedCount: number;
  onAction: (action: string, extra?: Record<string, unknown>) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--adm-text-faint)]">
          Detail drawer
        </div>
        <h2 className="mt-2 text-lg font-semibold text-[var(--adm-text)]">{product.title}</h2>
        <p className="mt-1 break-all text-xs text-[var(--adm-text-faint)]">{product.handle}</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <AdminStat label="Blockers" value={product.blockerCount} deltaTone="error" />
        <AdminStat
          label="Selected"
          value={selectedCount}
          deltaTone={selectedCount ? "success" : "neutral"}
        />
      </div>

      <div className="rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface-2)] p-3">
        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--adm-text-faint)]">
          Blockers
        </div>
        <div className="mt-3 space-y-2">
          {product.blockers.length ? (
            product.blockers.map((blocker) => (
              <div key={`${blocker.type}-${blocker.field}-${blocker.match ?? blocker.reason}`}>
                <div className="text-xs font-semibold text-[var(--adm-error)]">{blocker.type}</div>
                <div className="mt-1 text-xs leading-5 text-[var(--adm-text-muted)]">
                  {blocker.match ?? blocker.reason}
                </div>
              </div>
            ))
          ) : (
            <div className="text-sm text-[var(--adm-text-faint)]">No automated blockers.</div>
          )}
        </div>
      </div>

      <div className="grid gap-2">
        <button
          type="button"
          onClick={() => {
            const note = window.prompt("Approval note", "Reviewed and approved")?.trim();
            if (note) onAction("approve", { note });
          }}
          className="rounded-xl border border-[var(--adm-success)] bg-[var(--adm-primary-soft)] px-3 py-2 text-sm font-semibold text-[var(--adm-success)]"
        >
          Approve
        </button>
        <button
          type="button"
          onClick={() => {
            const note = window.prompt("Change request", "Needs product data changes")?.trim();
            if (note) onAction("request_changes", { note });
          }}
          className="rounded-xl border border-[#e2a136] bg-[#fff4dd] px-3 py-2 text-sm font-semibold text-[#81560e]"
        >
          Request changes
        </button>
        <button
          type="button"
          onClick={() => {
            const blocker = window.prompt("Manual blocker", "Manual policy review required")?.trim();
            if (blocker) onAction("add_manual_blocker", { blocker, note: blocker });
          }}
          className="rounded-xl border border-[var(--adm-error)] bg-[#fae7e3] px-3 py-2 text-sm font-semibold text-[var(--adm-error)]"
        >
          Add manual blocker
        </button>
        <button
          type="button"
          onClick={() => onAction("assign_owner", { note: "Assigned from compliance drawer" })}
          className="rounded-xl border border-[var(--adm-primary)] bg-[var(--adm-primary-soft)] px-3 py-2 text-sm font-semibold text-[var(--adm-primary)]"
        >
          Assign to me
        </button>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() =>
              onAction("set_feed_eligibility", {
                eligible: !product.complianceFeedEligible,
                note: "Feed eligibility toggled",
              })
            }
            className="rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] px-3 py-2 text-xs font-semibold text-[var(--adm-text)]"
          >
            Toggle feed
          </button>
          <button
            type="button"
            onClick={() =>
              onAction("set_ads_eligibility", {
                eligible: !product.complianceAdsEligible,
                note: "Ads eligibility toggled",
              })
            }
            className="rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] px-3 py-2 text-xs font-semibold text-[var(--adm-text)]"
          >
            Toggle ads
          </button>
        </div>
      </div>

      {product.complianceNotes ? (
        <div className="max-h-40 overflow-auto whitespace-pre-wrap rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface-2)] p-3 text-xs leading-5 text-[var(--adm-text-muted)]">
          {product.complianceNotes}
        </div>
      ) : null}
    </div>
  );
}
