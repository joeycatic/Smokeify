import Link from "next/link";
import { notFound } from "next/navigation";
import type { Prisma, ReviewStatus } from "@prisma/client";
import { AdminMetricCard, AdminPanel } from "@/components/admin/AdminInsightPrimitives";
import { requireAdmin } from "@/lib/adminCatalog";
import { prisma } from "@/lib/prisma";
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
  if (!(await requireAdmin())) notFound();

  const resolvedSearchParams = await searchParams;
  const query = getParam(resolvedSearchParams?.q).trim();
  const rawStatus = getParam(resolvedSearchParams?.status).trim().toUpperCase();
  const language = getParam(resolvedSearchParams?.lang).trim();
  const storefront = getParam(resolvedSearchParams?.storefront).trim();
  const requestedPage = Number(getParam(resolvedSearchParams?.page) || "1");
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const statusFilter = isReviewStatus(rawStatus) ? rawStatus : "ALL";

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
    ...(statusFilter !== "ALL" ? { status: statusFilter } : {}),
  };

  const [totalReviews, pendingReviews, approvedReviews, rejectedReviews, filteredCount] =
    await Promise.all([
      prisma.review.count(),
      prisma.review.count({ where: { status: "PENDING" } }),
      prisma.review.count({ where: { status: "APPROVED" } }),
      prisma.review.count({ where: { status: "REJECTED" } }),
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
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(135deg,rgba(18,22,29,0.98),rgba(8,12,18,0.98))] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.35)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-slate-500">
          Commerce / Reviews
        </p>
        <h1 className="mt-3 text-3xl font-semibold text-white">
          Product review oversight and moderation
        </h1>
        <p className="mt-3 max-w-3xl text-sm text-slate-400">
          Review customer feedback, jump directly into the related product, and
          change review visibility without leaving the admin workspace.
        </p>

        <form className="mt-6 grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_auto_auto]">
          {language ? <input type="hidden" name="lang" value={language} /> : null}
          {storefront ? <input type="hidden" name="storefront" value={storefront} /> : null}
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Search product, reviewer, email, or review text"
            className="h-11 rounded-2xl border border-white/10 bg-[#0b1016] px-4 text-sm text-slate-100 placeholder:text-slate-500"
          />
          <select
            name="status"
            defaultValue={statusFilter}
            className="h-11 rounded-2xl border border-white/10 bg-[#0b1016] px-4 text-sm text-slate-100"
          >
            <option value="ALL">All statuses</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>
          <button
            type="submit"
            className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-sm font-semibold text-cyan-200 transition hover:border-cyan-300/30 hover:bg-cyan-400/15"
          >
            Apply filters
          </button>
          <Link
            href={buildClearHref()}
            className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-center text-sm font-semibold text-slate-200 transition hover:border-white/20 hover:bg-white/[0.08]"
          >
            Clear
          </Link>
        </form>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
      </section>

      <AdminPanel
        eyebrow="Review Queue"
        title="Moderation workspace"
        description={`${filteredCount} review${filteredCount === 1 ? "" : "s"} matched the current filters.`}
      >
        <AdminReviewsClient initialReviews={pageReviews} />

        {filteredCount > 0 ? (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4 text-sm text-slate-400">
            <span>
              Page {currentPage} of {totalPages}
            </span>
            <div className="flex gap-2">
              <Link
                href={buildHref(Math.max(1, currentPage - 1))}
                aria-disabled={currentPage <= 1}
                className={`rounded-full border px-3 py-2 font-semibold transition ${
                  currentPage <= 1
                    ? "pointer-events-none border-white/5 bg-white/[0.02] text-slate-600"
                    : "border-white/10 bg-white/[0.04] text-slate-200 hover:border-white/20 hover:bg-white/[0.08]"
                }`}
              >
                Previous
              </Link>
              <Link
                href={buildHref(Math.min(totalPages, currentPage + 1))}
                aria-disabled={currentPage >= totalPages}
                className={`rounded-full border px-3 py-2 font-semibold transition ${
                  currentPage >= totalPages
                    ? "pointer-events-none border-white/5 bg-white/[0.02] text-slate-600"
                    : "border-white/10 bg-white/[0.04] text-slate-200 hover:border-white/20 hover:bg-white/[0.08]"
                }`}
              >
                Next
              </Link>
            </div>
          </div>
        ) : null}
      </AdminPanel>
    </div>
  );
}
