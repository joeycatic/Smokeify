import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminScope } from "@/lib/adminCatalog";
import {
  ADMIN_AUDIT_PAGE_SIZE,
  buildAdminAuditWhere,
  parseAdminAuditFilters,
} from "@/lib/adminAudit";
import { AdminPage, AdminPageHeader } from "@/components/admin/ui";

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
    <AdminPage layout="queue" className="admin-console-page">
      <AdminPageHeader
        eyebrow="Admin / Audit"
        title="Audit event log"
        description="Filter admin actions by actor, action, target, or metadata and expand events for investigation."
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={exportHref}
              className="inline-flex items-center rounded-full border border-[var(--adm-primary)] bg-[var(--adm-primary-soft)] px-3 py-1 text-xs font-semibold text-[var(--adm-primary)]"
            >
              Export CSV
            </Link>
            <div className="inline-flex items-center rounded-full border border-[var(--adm-border)] bg-[var(--adm-surface-2)] px-3 py-1 text-xs font-semibold text-[var(--adm-text-muted)]">
              {totalCount} matching events
            </div>
          </div>
        }
      />

      <form
        action="/admin/audit"
        method="GET"
        className="rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.22)]"
      >
        <div className="grid gap-4 lg:grid-cols-4">
          <label className="block text-xs font-semibold uppercase tracking-[0.22em] text-[var(--adm-text-faint)]">
            Search
            <input
              name="q"
              defaultValue={filters.q}
              placeholder="summary, target id, actor"
              className="mt-2 h-9 w-full rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] px-4 text-sm text-[var(--adm-text)] outline-none placeholder:text-[var(--adm-text-faint)]"
            />
          </label>
          <label className="block text-xs font-semibold uppercase tracking-[0.22em] text-[var(--adm-text-faint)]">
            Action
            <input
              name="action"
              defaultValue={filters.action}
              placeholder="order.refund"
              className="mt-2 h-9 w-full rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] px-4 text-sm text-[var(--adm-text)] outline-none placeholder:text-[var(--adm-text-faint)]"
            />
          </label>
          <label className="block text-xs font-semibold uppercase tracking-[0.22em] text-[var(--adm-text-faint)]">
            Actor
            <input
              name="actor"
              defaultValue={filters.actor}
              placeholder="admin@smokeify.de"
              className="mt-2 h-9 w-full rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] px-4 text-sm text-[var(--adm-text)] outline-none placeholder:text-[var(--adm-text-faint)]"
            />
          </label>
          <label className="block text-xs font-semibold uppercase tracking-[0.22em] text-[var(--adm-text-faint)]">
            Target
            <input
              name="target"
              defaultValue={filters.target}
              placeholder="user:abc123"
              className="mt-2 h-9 w-full rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] px-4 text-sm text-[var(--adm-text)] outline-none placeholder:text-[var(--adm-text-faint)]"
            />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-[var(--adm-text-faint)]">
            Target accepts either a raw search term or an exact `type:id` deep link.
          </div>
          <div className="flex gap-2">
            <Link
              href="/admin/audit"
              className="inline-flex h-8 items-center justify-center rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] px-4 text-sm font-semibold text-[var(--adm-text-muted)]"
            >
              Clear
            </Link>
            <button
              type="submit"
              className="inline-flex h-8 items-center justify-center rounded-xl bg-cyan-500 px-4 text-sm font-semibold text-white"
            >
              Apply filters
            </button>
          </div>
        </div>
      </form>

      {logs.length === 0 ? (
        <div className="rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] p-6 text-sm text-[var(--adm-text-faint)]">
          No audit entries match the current filters.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] shadow-[0_18px_50px_rgba(0,0,0,0.22)]">
          <div className="grid grid-cols-1 gap-3 border-b border-[var(--adm-border)] bg-[var(--adm-surface)] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--adm-text-faint)] sm:grid-cols-[1.1fr_1fr_1fr_1.4fr]">
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
                  className="grid grid-cols-1 gap-3 px-4 py-3 text-sm text-[var(--adm-text-muted)] sm:grid-cols-[1.1fr_1fr_1fr_1.4fr]"
                >
                  <div>
                    <div className="font-semibold text-[var(--adm-text)]">{entry.action}</div>
                    {entry.summary ? (
                      <div className="mt-1 text-xs text-[var(--adm-text-faint)]">{entry.summary}</div>
                    ) : null}
                  </div>
                  <div className="text-xs text-[var(--adm-text-muted)]">
                    {entry.actorEmail ?? entry.actorId ?? "System"}
                  </div>
                  <div className="space-y-2">
                    <div className="text-xs text-[var(--adm-primary)]">{targetLabel}</div>
                    {entry.targetType && entry.targetId ? (
                      <Link
                        href={buildAuditHref(
                          {
                            ...baseFilters,
                            target: `${entry.targetType}:${entry.targetId}`,
                          },
                          1
                        )}
                        className="inline-flex rounded-full border border-[var(--adm-border)] bg-[var(--adm-surface)] px-2.5 py-1 text-[11px] font-semibold text-[var(--adm-text-muted)]"
                      >
                        Focus target
                      </Link>
                    ) : null}
                  </div>
                  <div className="text-xs text-[var(--adm-text-faint)]">
                    {new Date(entry.createdAt).toLocaleString("de-DE")}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--adm-text-muted)]">
        <div>
          Page <span className="font-semibold text-[var(--adm-text)]">{currentPage}</span> of{" "}
          <span className="font-semibold text-[var(--adm-text)]">{totalPages}</span>
        </div>
        <div className="flex items-center gap-2">
          <PagerLink
            href={buildAuditHref(baseFilters, Math.max(1, currentPage - 1))}
            disabled={currentPage <= 1}
          >
            Prev
          </PagerLink>
          <span className="rounded-full border border-[var(--adm-border)] bg-[var(--adm-surface)] px-3 py-2">
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
    </AdminPage>
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
  const className = `inline-flex h-8 items-center justify-center rounded-xl border px-4 font-semibold transition ${
    disabled
      ? "cursor-not-allowed border-[var(--adm-border)] bg-[var(--adm-surface)] text-[var(--adm-text-faint)]"
      : "border-[var(--adm-border)] bg-[var(--adm-surface)] text-[var(--adm-text)] hover:border-[var(--adm-primary)] hover:bg-[var(--adm-primary-soft)] hover:text-[var(--adm-primary)]"
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
