import Link from "next/link";
import { notFound } from "next/navigation";
import type { Prisma, ReviewStatus } from "@prisma/client";
import { AdminMetricCard, AdminPanel } from "@/components/admin/AdminWorkspace";
import { AdminKpiStrip, AdminPage, AdminPageHeader } from "@/components/admin/ui";
import { requireAdminScope } from "@/lib/adminCatalog";
import { prisma } from "@/lib/prisma";
import { parseStorefront } from "@/lib/storefronts";
import AdminReviewsClient, { type AdminReviewListItem } from "./AdminReviewsClient";

const PAGE_SIZE = 20;
const REVIEW_STATUSES = ["APPROVED", "PENDING", "REJECTED"] as const;

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const getParam = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] ?? "" : value ?? "";

const isReviewStatus = (value: string): value is ReviewStatus =>
  REVIEW_STATUSES.includes(value as ReviewStatus);

export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams?: Promise<{
    page?: string | string[];
    q?: string | string[];
    status?: string | string[];
    lang?: string | string[];
    storefront?: string | string[];
  }>;
}) {
  if (!(await requireAdminScope("catalog.write"))) notFound();

  const resolvedSearchParams = await searchParams;
  const query = getParam(resolvedSearchParams?.q).trim();
  const rawStatus = getParam(resolvedSearchParams?.status).trim().toUpperCase();
  const language = getParam(resolvedSearchParams?.lang).trim();
  const storefront = parseStorefront(getParam(resolvedSearchParams?.storefront));
  const requestedPage = Number(getParam(resolvedSearchParams?.page) || "1");
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const statusFilter = isReviewStatus(rawStatus) ? rawStatus : "ALL";
  const storefrontWhere: Prisma.ReviewWhereInput = storefront
    ? { product: { is: { storefronts: { has: storefront } } } }
    : {};

  const queryWhere: Prisma.ReviewWhereInput = query
    ? {
        OR: [
          { title: { contains: query, mode: "insensitive" } },
          { body: { contains: query, mode: "insensitive" } },
          { guestName: { contains: query, mode: "insensitive" } },
          { product: { is: { title: { contains: query, mode: "insensitive" } } } },
          { product: { is: { handle: { contains: query, mode: "insensitive" } } } },
          { user: { is: { email: { contains: query, mode: "insensitive" } } } },
          { user: { is: { name: { contains: query, mode: "insensitive" } } } },
        ],
      }
    : {};

  const where: Prisma.ReviewWhereInput = {
    ...queryWhere,
    ...storefrontWhere,
    ...(statusFilter !== "ALL" ? { status: statusFilter } : {}),
  };

  const [totalReviews, pendingReviews, approvedReviews, rejectedReviews, filteredCount] =
    await Promise.all([
      prisma.review.count({ where: storefrontWhere }),
      prisma.review.count({ where: { ...storefrontWhere, status: "PENDING" } }),
      prisma.review.count({ where: { ...storefrontWhere, status: "APPROVED" } }),
      prisma.review.count({ where: { ...storefrontWhere, status: "REJECTED" } }),
      prisma.review.count({ where }),
    ]);

  const totalPages = Math.max(1, Math.ceil(filteredCount / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const reviews = await prisma.review.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: PAGE_SIZE,
    skip: (currentPage - 1) * PAGE_SIZE,
    include: {
      product: {
        select: {
          id: true,
          title: true,
          handle: true,
        },
      },
      user: {
        select: {
          name: true,
          email: true,
        },
      },
    },
  });

  const pageReviews: AdminReviewListItem[] = reviews.map((review) => ({
    id: review.id,
    status: review.status,
    rating: review.rating,
    title: review.title,
    body: review.body,
    guestName: review.guestName,
    createdAt: review.createdAt.toISOString(),
    updatedAt: review.updatedAt.toISOString(),
    userName: review.user?.name ?? null,
    userEmail: review.user?.email ?? null,
    productId: review.product.id,
    productTitle: review.product.title,
    productHandle: review.product.handle,
  }));

  const buildHref = (nextPage: number) => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (statusFilter !== "ALL") params.set("status", statusFilter);
    if (language) params.set("lang", language);
    if (storefront) params.set("storefront", storefront);
    if (nextPage > 1) params.set("page", String(nextPage));
    const search = params.toString();
    return search ? `/admin/reviews?${search}` : "/admin/reviews";
  };

  const buildClearHref = () => {
    const params = new URLSearchParams();
    if (language) params.set("lang", language);
    if (storefront) params.set("storefront", storefront);
    const search = params.toString();
    return search ? `/admin/reviews?${search}` : "/admin/reviews";
  };

  return (
    <AdminPage layout="queue">
      <AdminPageHeader
        eyebrow="Commerce / Reviews"
        title="Review moderation queue"
        description="Review feedback, open related products, and change visibility from one queue."
      >
        <form className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_220px_auto_auto]">
          {language ? <input type="hidden" name="lang" value={language} /> : null}
          {storefront ? <input type="hidden" name="storefront" value={storefront} /> : null}
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Search product, reviewer, email, or review text"
            className="h-9 rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] px-4 text-sm text-[var(--adm-text)] placeholder:text-[var(--adm-text-faint)]"
          />
          <select
            name="status"
            defaultValue={statusFilter}
            className="h-9 rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] px-4 text-sm text-[var(--adm-text)]"
          >
            <option value="ALL">All statuses</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>
          <button
            type="submit"
            className="rounded-xl border border-[var(--adm-primary)] bg-[var(--adm-primary-soft)] px-4 py-3 text-sm font-semibold text-[var(--adm-primary)] transition hover:border-[var(--adm-primary)] hover:bg-[var(--adm-primary)]/15"
          >
            Apply filters
          </button>
          <Link
            href={buildClearHref()}
            className="rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface-2)] px-4 py-3 text-center text-sm font-semibold text-[var(--adm-text)] transition hover:border-[var(--adm-border-strong)] hover:bg-[var(--adm-surface-2)]"
          >
            Clear
          </Link>
        </form>
      </AdminPageHeader>

      <AdminKpiStrip>
        <AdminMetricCard
          label="All Reviews"
          value={String(totalReviews)}
          detail="lifetime"
          footnote="full review table size"
        />
        <AdminMetricCard
          label="Pending"
          value={String(pendingReviews)}
          detail="backlog"
          footnote="awaiting admin decision"
          tone="amber"
          detailBadgeClassName="orders-kpi-badge-amber"
        />
        <AdminMetricCard
          label="Approved"
          value={String(approvedReviews)}
          detail="live"
          footnote="currently visible on product pages"
          tone="emerald"
          detailBadgeClassName="orders-kpi-badge-emerald"
        />
        <AdminMetricCard
          label="Rejected"
          value={String(rejectedReviews)}
          detail="hidden"
          footnote="kept for traceability"
          tone="violet"
          detailBadgeClassName="orders-kpi-badge-violet"
        />
      </AdminKpiStrip>

      <AdminPanel
        eyebrow="Review Queue"
        title="Moderation workspace"
        description={`${filteredCount} review${filteredCount === 1 ? "" : "s"} matched the current filters.`}
      >
        <AdminReviewsClient initialReviews={pageReviews} />

        {filteredCount > 0 ? (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--adm-border)] pt-4 text-sm text-[var(--adm-text-muted)]">
            <span>
              Page {currentPage} of {totalPages}
            </span>
            <div className="flex gap-2">
              <Link
                href={buildHref(Math.max(1, currentPage - 1))}
                aria-disabled={currentPage <= 1}
                className={`rounded-full border px-3 py-2 font-semibold transition ${
                  currentPage <= 1
                    ? "pointer-events-none border-[var(--adm-border)] bg-[var(--adm-surface)] text-[var(--adm-text-faint)]"
                    : "border-[var(--adm-border)] bg-[var(--adm-surface-2)] text-[var(--adm-text)] hover:border-[var(--adm-border-strong)] hover:bg-[var(--adm-surface-2)]"
                }`}
              >
                Previous
              </Link>
              <Link
                href={buildHref(Math.min(totalPages, currentPage + 1))}
                aria-disabled={currentPage >= totalPages}
                className={`rounded-full border px-3 py-2 font-semibold transition ${
                  currentPage >= totalPages
                    ? "pointer-events-none border-[var(--adm-border)] bg-[var(--adm-surface)] text-[var(--adm-text-faint)]"
                    : "border-[var(--adm-border)] bg-[var(--adm-surface-2)] text-[var(--adm-text)] hover:border-[var(--adm-border-strong)] hover:bg-[var(--adm-surface-2)]"
                }`}
              >
                Next
              </Link>
            </div>
          </div>
        ) : null}
      </AdminPanel>
    </AdminPage>
  );
}
