"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { StarIcon } from "@heroicons/react/24/solid";
import LoadingSpinner from "@/components/LoadingSpinner";

type Review = {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  createdAt: string;
  userName?: string | null;
};

export default function ProductReviews({ productId }: { productId: string }) {
  const { status } = useSession();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewSummary, setReviewSummary] = useState({ average: 0, count: 0 });
  const [reviewLoading, setReviewLoading] = useState(true);
  const [reviewError, setReviewError] = useState("");
  const [reviewNotice, setReviewNotice] = useState("");
  const [userReview, setUserReview] = useState<Review | null>(null);
  const [canReview, setCanReview] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewTitle, setReviewTitle] = useState("");
  const [reviewBody, setReviewBody] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  const loadReviews = async () => {
    setReviewLoading(true);
    setReviewError("");
    try {
      const res = await fetch(`/api/products/${productId}/reviews`);
      if (!res.ok) {
        setReviewError("Bewertungen konnten nicht geladen werden.");
        return;
      }
      const data = (await res.json()) as {
        reviews?: Review[];
        summary?: { average: number; count: number };
        userReview?: Review | null;
        canReview?: boolean;
      };
      setReviews(data.reviews ?? []);
      setReviewSummary({
        average: data.summary?.average ?? 0,
        count: data.summary?.count ?? 0,
      });
      setUserReview(data.userReview ?? null);
      setCanReview(Boolean(data.canReview));
      if (data.userReview) {
        setReviewRating(data.userReview.rating);
        setReviewTitle(data.userReview.title ?? "");
        setReviewBody(data.userReview.body ?? "");
      }
    } catch {
      setReviewError("Bewertungen konnten nicht geladen werden.");
    } finally {
      setReviewLoading(false);
    }
  };

  useEffect(() => {
    void loadReviews();
  }, [productId]);

  const submitReview = async () => {
    setReviewError("");
    setReviewNotice("");
    if (!reviewBody.trim() || reviewBody.trim().length < 10) {
      setReviewError("Bitte mindestens 10 Zeichen eingeben.");
      return;
    }
    setReviewSubmitting(true);
    try {
      const res = await fetch(`/api/products/${productId}/reviews`, {
        method: userReview ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating: reviewRating,
          title: reviewTitle.trim() || undefined,
          body: reviewBody.trim(),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setReviewError(data.error ?? "Bewertung konnte nicht gespeichert werden.");
        return;
      }
      setReviewNotice(
        userReview ? "Bewertung aktualisiert." : "Bewertung gespeichert."
      );
      await loadReviews();
    } catch {
      setReviewError("Bewertung konnte nicht gespeichert werden.");
    } finally {
      setReviewSubmitting(false);
    }
  };

  return (
    <div className="rounded-[28px] border border-black/10 bg-white/85 p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <StarIcon className="h-6 w-6 text-emerald-700" />
            <p className="text-lg font-semibold text-emerald-900 sm:text-xl">
              Bewertungen
            </p>
          </div>
          <div className="mt-2 flex items-center gap-2 text-sm text-black/60">
            <RatingStars rating={reviewSummary.average} />
            <span>
              {reviewSummary.count} Bewertungen · {reviewSummary.average.toFixed(1)}
            </span>
          </div>
        </div>
      </div>

      {reviewError && (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
          {reviewError}
        </p>
      )}
      {reviewNotice && (
        <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          {reviewNotice}
        </p>
      )}

      <div className="mt-5 space-y-3">
        {reviewLoading ? (
          <div className="flex items-center gap-2 text-sm text-black/60">
            <LoadingSpinner size="sm" />
            <span>Bewertungen werden geladen...</span>
          </div>
        ) : reviews.length === 0 ? (
          <p className="text-sm text-black/60">Noch keine Bewertungen.</p>
        ) : (
          reviews.map((review) => (
            <div
              key={review.id}
              className="rounded-xl border border-black/10 bg-white px-4 py-3 text-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <RatingStars rating={review.rating} />
                  <span className="text-xs text-black/50">
                    {review.userName ?? "Anonymous"}
                  </span>
                </div>
                <span className="text-xs text-black/50">
                  {new Date(review.createdAt).toLocaleDateString("de-DE")}
                </span>
              </div>
              {review.title && (
                <p className="mt-2 font-semibold text-black">
                  {review.title}
                </p>
              )}
              {review.body && <p className="mt-1 text-black/70">{review.body}</p>}
            </div>
          ))
        )}
      </div>

      <div className="mt-6 rounded-xl border border-black/10 bg-white/70 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-black/50">
          Bewertung schreiben
        </p>
        {status !== "authenticated" ? (
          <p className="mt-3 text-sm text-black/60">
            Bitte{" "}
            <Link href="/auth/signin" className="underline">
              anmelden
            </Link>{" "}
            um eine Bewertung zu schreiben.
          </p>
        ) : !canReview ? (
          <p className="mt-3 text-sm text-black/60">
            Bewertungen sind nur nach einem Kauf moeglich.
          </p>
        ) : (
          <div className="mt-4 grid gap-3">
            <div>
              <label className="block text-xs font-semibold text-black/60">
                Bewertung
              </label>
              <div className="mt-2 flex gap-2">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setReviewRating(value)}
                    className={`rounded-md border px-2 py-1 ${
                      reviewRating >= value
                        ? "border-emerald-300 bg-emerald-50"
                        : "border-black/10 bg-white"
                    }`}
                    aria-label={`Rating ${value}`}
                  >
                    <StarGlyph filled={reviewRating >= value} />
                  </button>
                ))}
              </div>
            </div>
            <label className="block text-xs font-semibold text-black/60">
              Titel (optional)
              <input
                value={reviewTitle}
                onChange={(event) => setReviewTitle(event.target.value)}
                placeholder="Kurz und hilfreich"
                className="mt-1 h-10 w-full rounded-lg border border-black/15 bg-white px-3 text-sm"
              />
            </label>
            <label className="block text-xs font-semibold text-black/60">
              Bewertung
              <textarea
                value={reviewBody}
                onChange={(event) => setReviewBody(event.target.value)}
                placeholder="Was hat dir gefallen?"
                rows={4}
                className="mt-1 w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-sm"
              />
            </label>
            <button
              type="button"
              onClick={submitReview}
              disabled={reviewSubmitting}
              className="h-10 rounded-lg bg-[#2f3e36] px-4 text-xs font-semibold text-white hover:bg-[#24312b] disabled:opacity-60"
            >
              {reviewSubmitting
                ? "Speichern..."
                : userReview
                  ? "Bewertung aktualisieren"
                  : "Bewertung senden"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function StarGlyph({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`h-4 w-4 ${filled ? "text-amber-500" : "text-stone-300"}`}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 3.5l2.9 5.9 6.5.9-4.7 4.5 1.1 6.4-5.8-3.1-5.8 3.1 1.1-6.4-4.7-4.5 6.5-.9L12 3.5z" />
    </svg>
  );
}

function RatingStars({ rating }: { rating: number }) {
  const rounded = Math.round(rating);
  return (
    <span className="inline-flex items-center gap-1">
      {[0, 1, 2, 3, 4].map((idx) => (
        <StarGlyph key={idx} filled={idx < rounded} />
      ))}
    </span>
  );
}
