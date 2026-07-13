"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Star } from "lucide-react";
import LoadingSpinner from "@/components/LoadingSpinner";
import { FractionalStars } from "@/components/ui/StarRating";

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
  const hasReviews = reviewSummary.count > 0;

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
    <div className="gv-panel rounded-[32px] p-6 sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[color:var(--gv-lime)]/18 bg-[color:var(--gv-lime)]/10 text-[color:var(--gv-lime)]">
              <Star className="h-5 w-5 fill-current" />
            </div>
            <div>
              <p className="font-[family:var(--font-syne)] text-2xl font-bold tracking-[-0.05em] text-[color:var(--gv-text)] sm:text-3xl">
                Bewertungen
              </p>
              <p className="mt-1 text-sm text-[color:var(--gv-text-muted)]">
                Echte Rückmeldungen aus der Smokeify-Community.
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-[color:var(--gv-text-muted)]">
            <div className="flex items-center gap-2">
              <RatingStars rating={reviewSummary.average} />
              {hasReviews ? (
                <span className="font-medium text-[color:var(--gv-text)]">
                  {reviewSummary.average.toFixed(1)}
                </span>
              ) : (
                <span className="text-[color:var(--gv-text-muted)]">
                  Bewertung folgt
                </span>
              )}
            </div>
            <span className="rounded-full border border-[color:var(--gv-border)] bg-[color:var(--gv-surface)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--gv-text-muted)]">
              {hasReviews
                ? `${reviewSummary.count} Bewertung${reviewSummary.count === 1 ? "" : "en"}`
                : "Produktdaten geprüft"}
            </span>
          </div>
        </div>
      </div>

      {reviewError && (
        <p className="mt-4 rounded-[18px] border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {reviewError}
        </p>
      )}
      {reviewNotice && (
        <p className="mt-4 rounded-[18px] border border-[color:var(--gv-lime)]/18 bg-[color:var(--gv-lime)]/10 px-4 py-3 text-sm text-[color:var(--gv-text)]">
          {reviewNotice}
        </p>
      )}

      <div className="mt-6 space-y-4">
        {reviewLoading ? (
          <div className="gv-glass flex items-center gap-3 rounded-[24px] px-4 py-4 text-sm text-[color:var(--gv-text-muted)]">
            <LoadingSpinner size="sm" />
            <span>Bewertungen werden geladen...</span>
          </div>
        ) : reviews.length === 0 ? (
          <div className="gv-glass rounded-[24px] px-4 py-4 text-sm text-[color:var(--gv-text-muted)]">
            Noch keine öffentlichen Bewertungen. Nutze die Produktdaten, Eignungshinweise
            und den direkten Gast-Checkout für deine Entscheidung.
          </div>
        ) : (
          reviews.map((review) => (
            <div
              key={review.id}
              className="gv-glass rounded-[24px] px-5 py-4 text-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <RatingStars rating={review.rating} />
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--gv-text-muted)]">
                    {review.userName ?? "Anonym"}
                  </span>
                </div>
                <span className="text-xs text-[color:var(--gv-text-muted)]">
                  {new Date(review.createdAt).toLocaleDateString("de-DE")}
                </span>
              </div>
              {review.body && (
                <p className="mt-3 text-sm leading-7 text-[color:var(--gv-text-muted)]">
                  {review.body}
                </p>
              )}
            </div>
          ))
        )}
      </div>

      <div className="mt-7 gv-glass rounded-[28px] p-5 sm:p-6">
        <p className="font-[family:var(--font-jetbrains-mono)] text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--gv-lime)]">
          Bewertung schreiben
        </p>
        <div className="mt-5 grid gap-4">
          <label className="block text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--gv-text-muted)]">
            Name (optional)
            <input
              value={guestName}
              onChange={(event) => setGuestName(event.target.value)}
              placeholder="Dein Name"
              maxLength={64}
              className="gv-input mt-2 h-12 w-full rounded-[18px] px-4 text-sm outline-none focus:border-[color:var(--gv-lime)]/40 focus:ring-2 focus:ring-[color:var(--gv-lime)]/10"
            />
          </label>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--gv-text-muted)]">
              Sterne
            </label>
            <div
              className="mt-3 flex flex-wrap items-center gap-3"
              onMouseLeave={() => setHoverRating(0)}
            >
              <div className="flex items-center gap-1.5 rounded-full border border-[color:var(--gv-border)] bg-[color:var(--gv-surface)] px-3 py-2">
                {[1, 2, 3, 4, 5].map((value) => {
                  const active = (hoverRating || reviewRating) >= value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setReviewRating(value)}
                      onMouseEnter={() => setHoverRating(value)}
                      aria-label={`${value} Stern${value !== 1 ? "e" : ""}`}
                      className="rounded-full p-1 transition-transform duration-100 hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--gv-lime)]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--gv-forest)]"
                    >
                      <Star
                        className={`h-8 w-8 transition-colors duration-100 ${
                          active
                            ? "text-[color:var(--gv-lime)]"
                            : "text-[color:var(--gv-border)]"
                        }`}
                        fill="currentColor"
                        strokeWidth={1.75}
                        aria-hidden="true"
                      />
                    </button>
                  );
                })}
              </div>
              <span className="rounded-full border border-[color:var(--gv-lime)]/18 bg-[color:var(--gv-lime)]/10 px-3 py-1.5 text-sm font-semibold text-[color:var(--gv-lime)]">
                {
                  ["", "Schlecht", "Naja", "Okay", "Gut", "Ausgezeichnet"][
                    hoverRating || reviewRating
                  ]
                }
              </span>
            </div>
          </div>
          <label className="block text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--gv-text-muted)]">
            Bewertung
            <textarea
              value={reviewBody}
              onChange={(event) => setReviewBody(event.target.value)}
              placeholder="Was hat dir gefallen?"
              rows={5}
              className="gv-input mt-2 w-full rounded-[18px] px-4 py-3 text-sm outline-none focus:border-[color:var(--gv-lime)]/40 focus:ring-2 focus:ring-[color:var(--gv-lime)]/10"
            />
          </label>
          <button
            type="button"
            onClick={submitReview}
            disabled={reviewSubmitting}
            className="inline-flex h-12 items-center justify-center rounded-full bg-[color:var(--gv-lime)] px-5 text-sm font-semibold text-[color:var(--gv-forest)] shadow-[0_16px_34px_var(--gv-lime-glow)] transition hover:-translate-y-0.5 hover:bg-[color:var(--gv-lime-dim)] disabled:opacity-60"
          >
            {reviewSubmitting
              ? "Speichern..."
              : userReview
                ? "Bewertung aktualisieren"
                : "Bewertung senden"}
          </button>
        </div>
      </div>
    </div>
  );
}
function RatingStars({ rating }: { rating: number }) {
  return (
    <span role="img" aria-label={`${rating.toFixed(1)} von 5 Sternen`}>
      <FractionalStars
        rating={rating}
        className="gap-1"
        starClassName="h-4 w-4"
        filledClassName="text-[color:var(--gv-lime)]"
        emptyClassName="text-[color:var(--gv-border)]"
      />
    </span>
  );
}
