"use client";

import Link from "next/link";
import { startTransition, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminEmptyState } from "@/components/admin/AdminWorkspace";

type ReviewStatus = "APPROVED" | "PENDING" | "REJECTED";

export type AdminReviewListItem = {
  id: string;
  status: ReviewStatus;
  rating: number;
  title: string | null;
  body: string | null;
  guestName: string | null;
  createdAt: string;
  updatedAt: string;
  userName: string | null;
  userEmail: string | null;
  productId: string;
  productTitle: string;
  productHandle: string;
};

type Props = {
  initialReviews: AdminReviewListItem[];
};

const STATUS_STYLES: Record<ReviewStatus, string> = {
  APPROVED: "border-[var(--adm-success)] bg-[var(--adm-primary-soft)] text-[var(--adm-success)]",
  PENDING: "border-[#e2a136] bg-[#fff4dd] text-[#81560e]",
  REJECTED: "border-[var(--adm-error)] bg-[#fae7e3] text-[var(--adm-error)]",
};

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
  });

function RatingStars({ rating }: { rating: number }) {
  return (
    <div aria-label={`${rating} out of 5 stars`} className="flex items-center gap-1 text-sm">
      {Array.from({ length: 5 }, (_, index) => {
        const filled = index < rating;
        return (
          <span key={index} className={filled ? "text-[#81560e]" : "text-[var(--adm-text-muted)]"}>
            ★
          </span>
        );
      })}
    </div>
  );
}

export default function AdminReviewsClient({ initialReviews }: Props) {
  const router = useRouter();
  const [reviews, setReviews] = useState(initialReviews);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    setReviews(initialReviews);
  }, [initialReviews]);

  const updateStatus = async (reviewId: string, status: ReviewStatus) => {
    setError("");
    setSavingId(reviewId);

    try {
      const response = await fetch(`/api/admin/reviews/${reviewId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        review?: { id: string; status: ReviewStatus; updatedAt: string };
      };

      if (!response.ok || !data.review) {
        setError(data.error ?? "Failed to update review.");
        return;
      }

      setReviews((current) =>
        current.map((review) =>
          review.id === reviewId
            ? {
                ...review,
                status: data.review!.status,
                updatedAt: data.review!.updatedAt,
              }
            : review,
        ),
      );

      startTransition(() => {
        router.refresh();
      });
    } catch {
      setError("Failed to update review.");
    } finally {
      setSavingId(null);
    }
  };

  if (reviews.length === 0) {
    return <AdminEmptyState copy="No reviews matched the current filters." />;
  }

  return (
    <div className="space-y-4">
      {error ? (
        <div className="rounded-xl border border-rose-500/20 bg-[#fae7e3] px-4 py-3 text-sm text-[var(--adm-error)]">
          {error}
        </div>
      ) : null}

      {reviews.map((review) => {
        const reviewerLabel =
          review.guestName?.trim() ||
          review.userName?.trim() ||
          review.userEmail?.trim() ||
          "Guest reviewer";
        const isSaving = savingId === review.id;

        return (
          <article
            key={review.id}
            className="rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.22)]"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${STATUS_STYLES[review.status]}`}
                  >
                    {review.status}
                  </span>
                  <span className="rounded-full border border-[var(--adm-border)] bg-[var(--adm-surface-2)] px-2.5 py-1 text-[11px] font-semibold text-[var(--adm-text-muted)]">
                    {reviewerLabel}
                  </span>
                  <span className="rounded-full border border-[var(--adm-border)] bg-[var(--adm-surface-2)] px-2.5 py-1 text-[11px] font-semibold text-[var(--adm-text-muted)]">
                    {formatDateTime(review.createdAt)}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <Link
                    href={`/admin/catalog/${review.productId}`}
                    className="text-base font-semibold text-[var(--adm-text)] transition hover:text-[var(--adm-primary)]"
                  >
                    {review.productTitle}
                  </Link>
                  <Link
                    href={`/products/${review.productHandle}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-[var(--adm-primary)] transition hover:text-[var(--adm-primary)]"
                  >
                    Open storefront
                  </Link>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-[var(--adm-text-muted)]">
                  <RatingStars rating={review.rating} />
                  <span>{review.rating}/5</span>
                  <span className="text-[var(--adm-text-faint)]">
                    Last updated {formatDateTime(review.updatedAt)}
                  </span>
                </div>

                {review.title ? (
                  <h3 className="mt-4 text-base font-semibold text-[var(--adm-text)]">{review.title}</h3>
                ) : null}

                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--adm-text-muted)]">
                  {review.body?.trim() || "No review body provided."}
                </p>

                {review.userEmail ? (
                  <p className="mt-3 text-xs text-[var(--adm-text-faint)]">Account: {review.userEmail}</p>
                ) : null}
              </div>

              <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:max-w-[18rem] sm:justify-end">
                {(["PENDING", "APPROVED", "REJECTED"] as ReviewStatus[]).map((status) => {
                  const active = review.status === status;
                  return (
                    <button
                      key={status}
                      type="button"
                      onClick={() => updateStatus(review.id, status)}
                      disabled={isSaving || active}
                      className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${
                        active
                          ? STATUS_STYLES[status]
                          : "border-[var(--adm-border)] bg-[var(--adm-surface-2)] text-[var(--adm-text)] hover:border-[var(--adm-border-strong)] hover:bg-[var(--adm-surface-2)]"
                      } disabled:cursor-not-allowed disabled:opacity-70`}
                    >
                      {isSaving && !active ? "Saving..." : status}
                    </button>
                  );
                })}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
