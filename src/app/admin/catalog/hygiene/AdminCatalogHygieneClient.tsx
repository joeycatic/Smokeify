"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  AdminField,
  AdminInput,
  AdminMetricCard,
  AdminPageIntro,
  AdminPanel,
  AdminSelect,
} from "@/components/admin/AdminWorkspace";
import { buildAdminSearchHref } from "@/lib/adminTimeRange";
import type { listCatalogHygieneIssues } from "@/lib/adminCatalogHygiene";

type Data = Awaited<ReturnType<typeof listCatalogHygieneIssues>>;

const ISSUE_LABELS: Record<string, string> = {
  missing_image: "Missing image",
  missing_technical_details: "Missing technical details",
  missing_seller_url: "Missing seller URL",
  missing_variant_cost: "Missing variant cost",
  compliance_blocked: "Compliance blocked",
};

export default function AdminCatalogHygieneClient({
  initialData,
}: {
  initialData: Data;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { filters } = initialData;

  const updateFilter = (key: string, value: string) => {
    const next = {
      q: filters.q || undefined,
      issueType: filters.issueType || undefined,
      storefront: filters.storefront || undefined,
      status: filters.status || undefined,
      supplierPresence: filters.supplierPresence || undefined,
      page: "1",
      [key]: value || undefined,
    };
    router.push(buildAdminSearchHref(pathname, next));
  };

  return (
    <div className="space-y-6">
      <AdminPageIntro
        eyebrow="Admin / Catalog / Hygiene"
        title="Catalog hygiene queue"
        description="Computed catalog issues that need human fixes. This queue stays read-only in v1 and links directly into the real editing surfaces."
        actions={
          <Link
            href="/admin/catalog"
            className="inline-flex h-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] px-4 text-sm font-semibold text-slate-100 transition hover:bg-white/[0.05]"
          >
            Open catalog
          </Link>
        }
        metrics={
          <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
            <AdminMetricCard label="Flagged products" value={String(initialData.totalRows)} detail="current filter set" />
            <AdminMetricCard label="Missing images" value={String(initialData.counts.missing_image)} />
            <AdminMetricCard label="Missing details" value={String(initialData.counts.missing_technical_details)} />
            <AdminMetricCard label="Missing seller URL" value={String(initialData.counts.missing_seller_url)} />
            <AdminMetricCard label="Missing costs" value={String(initialData.counts.missing_variant_cost)} />
            <AdminMetricCard label="Compliance blocked" value={String(initialData.counts.compliance_blocked)} detail="queue link available" />
          </div>
        }
      />

      <AdminPanel
        eyebrow="Filters"
        title="Issue filters"
        description="Use this queue to isolate specific hygiene tasks before jumping into the product or compliance workspaces."
      >
        <div className="grid gap-3 lg:grid-cols-5">
          <AdminField label="Search">
            <AdminInput
              defaultValue={filters.q}
              placeholder="Search title, handle, manufacturer, supplier"
              onBlur={(event) => updateFilter("q", event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  updateFilter("q", (event.target as HTMLInputElement).value);
                }
              }}
            />
          </AdminField>
          <AdminField label="Issue type">
            <AdminSelect
              value={filters.issueType}
              onChange={(event) => updateFilter("issueType", event.target.value)}
            >
              <option value="">All issues</option>
              {Object.entries(ISSUE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </AdminSelect>
          </AdminField>
          <AdminField label="Storefront">
            <AdminSelect
              value={filters.storefront}
              onChange={(event) => updateFilter("storefront", event.target.value)}
            >
              <option value="">All storefronts</option>
              <option value="MAIN">Smokeify</option>
              <option value="GROW">GrowVault</option>
            </AdminSelect>
          </AdminField>
          <AdminField label="Product status">
            <AdminSelect
              value={filters.status}
              onChange={(event) => updateFilter("status", event.target.value)}
            >
              <option value="">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="DRAFT">Draft</option>
              <option value="ARCHIVED">Archived</option>
            </AdminSelect>
          </AdminField>
          <AdminField label="Supplier presence">
            <AdminSelect
              value={filters.supplierPresence}
              onChange={(event) => updateFilter("supplierPresence", event.target.value)}
            >
              <option value="">All products</option>
              <option value="WITH_SUPPLIER">Supplier-linked</option>
              <option value="WITHOUT_SUPPLIER">Without supplier</option>
            </AdminSelect>
          </AdminField>
        </div>
      </AdminPanel>

      <AdminPanel
        eyebrow="Queue"
        title="Products needing cleanup"
        description="Each row groups all hygiene issues currently detected for a product."
      >
        <div className="space-y-3">
          {initialData.rows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-8 text-sm text-slate-500">
              No products match the current hygiene filters.
            </div>
          ) : (
            initialData.rows.map((row) => (
              <div
                key={row.productId}
                className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-4"
              >
                <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white">{row.title}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      /products/{row.handle} · {row.status} · {row.storefronts.join(" + ")}
                      {row.supplier ? ` · ${row.supplier}` : ""}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {row.issues.map((issue) => (
                        <span
                          key={`${row.productId}-${issue.type}`}
                          className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                            issue.type === "compliance_blocked"
                              ? "border-amber-400/20 bg-amber-400/10 text-amber-200"
                              : "border-cyan-400/20 bg-cyan-400/10 text-cyan-200"
                          }`}
                          title={issue.detail}
                        >
                          {issue.label}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/admin/catalog/${row.productId}`}
                      className="inline-flex h-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] px-4 text-sm font-semibold text-slate-100 transition hover:bg-white/[0.05]"
                    >
                      Open product
                    </Link>
                    {row.issues.some((issue) => issue.type === "compliance_blocked") ? (
                      <Link
                        href={`/admin/compliance?q=${encodeURIComponent(row.title)}`}
                        className="inline-flex h-10 items-center justify-center rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 text-sm font-semibold text-amber-200 transition hover:bg-amber-400/15"
                      >
                        Open compliance
                      </Link>
                    ) : null}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="mt-5 flex items-center justify-between gap-3">
          <div className="text-sm text-slate-400">Page {filters.page}</div>
          <div className="flex gap-2">
            {filters.page > 1 ? (
              <Link
                href={buildAdminSearchHref(pathname, {
                  q: filters.q || undefined,
                  issueType: filters.issueType || undefined,
                  storefront: filters.storefront || undefined,
                  status: filters.status || undefined,
                  supplierPresence: filters.supplierPresence || undefined,
                  page: String(filters.page - 1),
                })}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] px-4 text-sm font-semibold text-slate-100 transition hover:bg-white/[0.05]"
              >
                Previous
              </Link>
            ) : (
              <span />
            )}
            {initialData.hasNextPage ? (
              <Link
                href={buildAdminSearchHref(pathname, {
                  q: filters.q || undefined,
                  issueType: filters.issueType || undefined,
                  storefront: filters.storefront || undefined,
                  status: filters.status || undefined,
                  supplierPresence: filters.supplierPresence || undefined,
                  page: String(filters.page + 1),
                })}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] px-4 text-sm font-semibold text-slate-100 transition hover:bg-white/[0.05]"
              >
                Next
              </Link>
            ) : null}
          </div>
        </div>
      </AdminPanel>
    </div>
  );
}
