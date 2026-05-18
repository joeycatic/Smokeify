import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminScope } from "@/lib/adminCatalog";
import {
  ADMIN_AUDIT_PAGE_SIZE,
  buildAdminAuditWhere,
  parseAdminAuditFilters,
} from "@/lib/adminAudit";

function buildAuditHref(
  filters: Record<string, string>,
  page?: number
) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) {
      params.set(key, value);
    }
  }
  if (page && page > 1) {
    params.set("page", String(page));
  }
  const query = params.toString();
  return query ? `/admin/audit?${query}` : "/admin/audit";
}

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!(await requireAdminScope("audit.read"))) notFound();

  const resolvedSearchParams = await searchParams;
  const filters = parseAdminAuditFilters(resolvedSearchParams);
  const where = buildAdminAuditWhere(filters);

  const [totalCount, logs] = await prisma.$transaction([
    prisma.adminAuditLog.count({ where }),
    prisma.adminAuditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: ADMIN_AUDIT_PAGE_SIZE,
      skip: (filters.page - 1) * ADMIN_AUDIT_PAGE_SIZE,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / ADMIN_AUDIT_PAGE_SIZE));
  const currentPage = Math.min(filters.page, totalPages);
  const baseFilters = {
    q: filters.q,
    action: filters.action,
    actor: filters.actor,
    target: filters.target,
  };
  const exportHref = `/api/admin/audit/export${buildAuditHref(baseFilters).replace(
    "/admin/audit",
    ""
  )}`;

  return (
    <div className="admin-legacy-page space-y-6">
      <section className="overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(135deg,rgba(18,22,29,0.98),rgba(8,12,18,0.98))] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.35)]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-slate-500">
              Admin / Audit
            </p>
            <h1 className="mt-3 text-3xl font-semibold text-white">Audit log</h1>
            <p className="mt-3 max-w-3xl text-sm text-slate-400">
              Search admin actions by actor, action, or target. Deep links from user and
              order views now land inside a real investigation surface instead of a flat
              latest-events list.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={exportHref}
              className="inline-flex items-center rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-200"
            >
              Export CSV
            </Link>
            <div className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-slate-300">
              {totalCount} matching events
            </div>
          </div>
        </div>
      </section>

      <form
        action="/admin/audit"
        method="GET"
        className="rounded-[28px] border border-white/10 bg-[#090d12] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.22)]"
      >
        <div className="grid gap-4 lg:grid-cols-4">
          <label className="block text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
            Search
            <input
              name="q"
              defaultValue={filters.q}
              placeholder="summary, target id, actor"
              className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 text-sm text-white outline-none placeholder:text-slate-500"
            />
          </label>
          <label className="block text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
            Action
            <input
              name="action"
              defaultValue={filters.action}
              placeholder="order.refund"
              className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 text-sm text-white outline-none placeholder:text-slate-500"
            />
          </label>
          <label className="block text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
            Actor
            <input
              name="actor"
              defaultValue={filters.actor}
              placeholder="admin@smokeify.de"
              className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 text-sm text-white outline-none placeholder:text-slate-500"
            />
          </label>
          <label className="block text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
            Target
            <input
              name="target"
              defaultValue={filters.target}
              placeholder="user:abc123"
              className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 text-sm text-white outline-none placeholder:text-slate-500"
            />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            Target accepts either a raw search term or an exact `type:id` deep link.
          </div>
          <div className="flex gap-2">
            <Link
              href="/admin/audit"
              className="inline-flex h-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] px-4 text-sm font-semibold text-slate-300"
            >
              Clear
            </Link>
            <button
              type="submit"
              className="inline-flex h-10 items-center justify-center rounded-xl bg-cyan-500 px-4 text-sm font-semibold text-slate-950"
            >
              Apply filters
            </button>
          </div>
        </div>
      </form>

      {logs.length === 0 ? (
        <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6 text-sm text-slate-500">
          No audit entries match the current filters.
        </div>
      ) : (
        <div className="overflow-hidden rounded-[28px] border border-white/10 bg-[#090d12] shadow-[0_18px_50px_rgba(0,0,0,0.22)]">
          <div className="grid grid-cols-1 gap-3 border-b border-white/10 bg-white/[0.03] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500 sm:grid-cols-[1.1fr_1fr_1fr_1.4fr]">
            <div>Action</div>
            <div>Actor</div>
            <div>Target</div>
            <div>Time</div>
          </div>
          <div className="divide-y divide-white/5">
            {logs.map((entry) => {
              const targetLabel =
                entry.targetType && entry.targetId ? `${entry.targetType}:${entry.targetId}` : "—";
              return (
                <div
                  key={entry.id}
                  className="grid grid-cols-1 gap-3 px-4 py-3 text-sm text-slate-300 sm:grid-cols-[1.1fr_1fr_1fr_1.4fr]"
                >
                  <div>
                    <div className="font-semibold text-slate-100">{entry.action}</div>
                    {entry.summary ? (
                      <div className="mt-1 text-xs text-slate-500">{entry.summary}</div>
                    ) : null}
                  </div>
                  <div className="text-xs text-slate-400">
                    {entry.actorEmail ?? entry.actorId ?? "System"}
                  </div>
                  <div className="space-y-2">
                    <div className="text-xs text-cyan-300">{targetLabel}</div>
                    {entry.targetType && entry.targetId ? (
                      <Link
                        href={buildAuditHref(
                          {
                            ...baseFilters,
                            target: `${entry.targetType}:${entry.targetId}`,
                          },
                          1
                        )}
                        className="inline-flex rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] font-semibold text-slate-300"
                      >
                        Focus target
                      </Link>
                    ) : null}
                  </div>
                  <div className="text-xs text-slate-500">
                    {new Date(entry.createdAt).toLocaleString("de-DE")}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
        <div>
          Page <span className="font-semibold text-slate-100">{currentPage}</span> of{" "}
          <span className="font-semibold text-slate-100">{totalPages}</span>
        </div>
        <div className="flex items-center gap-2">
          <PagerLink
            href={buildAuditHref(baseFilters, Math.max(1, currentPage - 1))}
            disabled={currentPage <= 1}
          >
            Prev
          </PagerLink>
          <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-2">
            {currentPage} / {totalPages}
          </span>
          <PagerLink
            href={buildAuditHref(baseFilters, Math.min(totalPages, currentPage + 1))}
            disabled={currentPage >= totalPages}
          >
            Next
          </PagerLink>
        </div>
      </div>
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
  const className = `inline-flex h-10 items-center justify-center rounded-xl border px-4 font-semibold transition ${
    disabled
      ? "cursor-not-allowed border-white/5 bg-white/[0.02] text-slate-600"
      : "border-white/10 bg-white/[0.03] text-slate-200 hover:border-cyan-400/30 hover:bg-cyan-400/10 hover:text-cyan-200"
  }`;

  if (disabled) {
    return (
      <span
        aria-disabled="true"
        className={className}
      >
        {children}
      </span>
    );
  }

  return (
    <Link
      href={href}
      className={className}
    >
      {children}
    </Link>
  );
}
