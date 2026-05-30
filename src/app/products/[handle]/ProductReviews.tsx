"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { StarIcon } from "@heroicons/react/24/solid";
import LoadingSpinner from "@/components/LoadingSpinner";

type Review = {
  id: string;
  rating: number;
  body: string | null;
  createdAt: string;
  userName?: string | null;
};

export default function ProductReviews({ productId }: { productId: string }) {
  const { data: session, status } = useSession();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewSummary, setReviewSummary] = useState({ average: 0, count: 0 });
  const [reviewLoading, setReviewLoading] = useState(true);
  const [reviewError, setReviewError] = useState("");
  const [reviewNotice, setReviewNotice] = useState("");
  const [userReview, setUserReview] = useState<Review | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [guestName, setGuestName] = useState("");
  const [reviewBody, setReviewBody] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  const loadReviews = useCallback(async () => {
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
      };
      setReviews(data.reviews ?? []);
      setReviewSummary({
        average: data.summary?.average ?? 0,
        count: data.summary?.count ?? 0,
      });
      setUserReview(data.userReview ?? null);
      if (data.userReview) {
        setReviewRating(data.userReview.rating);
        setReviewBody(data.userReview.body ?? "");
      }
    } catch {
      setReviewError("Bewertungen konnten nicht geladen werden.");
    } finally {
      setReviewLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    void loadReviews();
  }, [loadReviews]);

  useEffect(() => {
    if (status === "authenticated" && session?.user?.name && !guestName) {
      setGuestName(session.user.name);
    }
  }, [guestName, status, session?.user?.name]);

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
          body: reviewBody.trim(),
          name: guestName.trim() || undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        incentive?: { code: string; percentOff: number };
      };
      if (!res.ok) {
        setReviewError(
          data.error ?? "Bewertung konnte nicht gespeichert werden.",
        );
        return;
      }
      setReviewNotice(
        userReview ? "Bewertung aktualisiert." : "Bewertung gespeichert.",
      );
      if (data.incentive?.code) {
        setReviewNotice(
          `Bewertung gespeichert. Danke! Dein Gutschein: ${data.incentive.code} (${data.incentive.percentOff}% Rabatt, einmalig).`
        );
      }
      await loadReviews();
    } catch {
      setReviewError("Bewertung konnte nicht gespeichert werden.");
    } finally {
      setReviewSubmitting(false);
    }
  };

  return (
    <section className="smk-panel rounded-[32px] p-6 text-[var(--smk-text)] shadow-[0_24px_70px_rgba(0,0,0,0.26)] sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <StarIcon className="h-6 w-6 text-[var(--smk-accent)]" />
            <p className="text-2xl font-semibold tracking-[-0.04em] text-[var(--smk-text)] sm:text-3xl">
              Bewertungen
            </p>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-[var(--smk-text-muted)]">
            <RatingStars rating={reviewSummary.average} />
            <span>
              {reviewSummary.count} Bewertungen ·{" "}
              {reviewSummary.average.toFixed(1)}
            </span>
          </div>
        </div>
      </div>

      {reviewError && (
        <p className="mt-4 rounded-2xl border border-red-500/24 bg-red-500/10 px-4 py-3 text-xs text-red-100">
          {reviewError}
        </p>
      )}
      {reviewNotice && (
        <p className="mt-4 rounded-2xl border border-emerald-400/24 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-100">
          {reviewNotice}
        </p>
      )}

      <div className="mt-6 space-y-3">
        {reviewLoading ? (
          <div className="flex items-center gap-2 rounded-[24px] border border-[var(--smk-border)] bg-[rgba(255,255,255,0.03)] px-4 py-4 text-sm text-[var(--smk-text-muted)]">
            <LoadingSpinner size="sm" />
            <span>Bewertungen werden geladen...</span>
          </div>
        ) : reviews.length === 0 ? (
          <p className="rounded-[24px] border border-[var(--smk-border)] bg-[rgba(255,255,255,0.03)] px-4 py-4 text-sm text-[var(--smk-text-muted)]">
            Noch keine Bewertungen.
          </p>
        ) : (
          reviews.map((review) => (
            <div
              key={review.id}
              className="rounded-[24px] border border-[var(--smk-border)] bg-[rgba(255,255,255,0.03)] px-4 py-4 text-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <RatingStars rating={review.rating} />
                  <span className="text-xs uppercase tracking-[0.16em] text-[var(--smk-text-muted)]">
                    {review.userName ?? "Anonym"}
                  </span>
                </div>
                <span className="text-xs uppercase tracking-[0.16em] text-[var(--smk-text-muted)]">
                  {new Date(review.createdAt).toLocaleDateString("de-DE")}
                </span>
              </div>
              {review.body && (
                <p className="mt-3 leading-7 text-[var(--smk-text-muted)]">
                  {review.body}
                </p>
              )}
            </div>
          ))
        )}
      </div>

      <div className="smk-surface mt-6 rounded-[28px] p-5 sm:p-6">
        <p className="smk-kicker">
          Bewertung schreiben
        </p>
        <div className="mt-4 grid gap-4">
          <label className="block text-xs font-semibold text-[var(--smk-text-muted)]">
            Name (optional)
            <input
              value={guestName}
              onChange={(event) => setGuestName(event.target.value)}
              placeholder="Dein Name"
              maxLength={64}
              className="smk-input mt-2 h-11 w-full rounded-2xl px-4 text-sm"
            />
          </label>
          <div>
            <label className="block text-xs font-semibold text-[var(--smk-text-muted)]">
              Sterne
            </label>
            <div
              className="mt-3 flex flex-wrap items-center gap-2"
              onMouseLeave={() => setHoverRating(0)}
            >
              {[1, 2, 3, 4, 5].map((value) => {
                const active = (hoverRating || reviewRating) >= value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setReviewRating(value)}
                    onMouseEnter={() => setHoverRating(value)}
                    aria-label={`${value} Stern${value !== 1 ? "e" : ""}`}
                    className="rounded-2xl border border-[var(--smk-border)] bg-[rgba(255,255,255,0.03)] p-1.5 transition hover:-translate-y-0.5 hover:border-[var(--smk-accent)]/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--smk-accent)]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className={`h-9 w-9 transition-colors duration-100 ${
                        active ? "text-[var(--smk-accent)]" : "text-[var(--smk-border-strong)]"
                      }`}
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path d="M12 3.5l2.9 5.9 6.5.9-4.7 4.5 1.1 6.4-5.8-3.1-5.8 3.1 1.1-6.4-4.7-4.5 6.5-.9L12 3.5z" />
                    </svg>
                  </button>
                );
              })}
              <span className="ml-1 text-sm font-semibold text-[var(--smk-text)]">
                {["", "Schlecht", "Naja", "Okay", "Gut", "Ausgezeichnet"][hoverRating || reviewRating]}
              </span>
            </div>
          </div>
          <label className="block text-xs font-semibold text-[var(--smk-text-muted)]">
            Bewertung
            <textarea
              value={reviewBody}
              onChange={(event) => setReviewBody(event.target.value)}
              placeholder="Was hat dir gefallen?"
              rows={4}
              className="smk-input mt-2 w-full rounded-[22px] px-4 py-3 text-sm"
            />
          </label>
          <button
            type="button"
            onClick={submitReview}
            disabled={reviewSubmitting}
            className="smk-button-primary h-11 rounded-full px-5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
          >
            {reviewSubmitting
              ? "Speichern..."
              : userReview
                ? "Bewertung aktualisieren"
                : "Bewertung senden"}
          </button>
        </div>
      </div>
    </section>
  );
}

function StarGlyph({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`h-4 w-4 ${filled ? "text-[var(--smk-accent)]" : "text-[var(--smk-border-strong)]"}`}
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
