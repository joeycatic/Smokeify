import { StarIcon as StarOutlineIcon } from "@heroicons/react/24/outline";
import { StarIcon as StarSolidIcon } from "@heroicons/react/24/solid";

type Props = {
  average: number;
  count?: number;
  className?: string;
};

type FractionalStarsProps = {
  rating: number;
  className?: string;
  starClassName?: string;
  filledClassName?: string;
  emptyClassName?: string;
};

const clampRating = (rating: number) =>
  Number.isFinite(rating) ? Math.max(0, Math.min(5, rating)) : 0;

export const getStarFillPercentages = (rating: number) => {
  const normalizedRating = clampRating(rating);
  return Array.from({ length: 5 }, (_, index) =>
    Math.round(Math.max(0, Math.min(1, normalizedRating - index)) * 100),
  );
};

export function FractionalStars({
  rating,
  className = "gap-0.5",
  starClassName = "h-3.5 w-3.5",
  filledClassName = "text-amber-500",
  emptyClassName = "text-amber-500",
}: FractionalStarsProps) {
  return (
    <span className={`inline-flex items-center ${className}`} aria-hidden="true">
      {getStarFillPercentages(rating).map((fillPercentage, index) => (
        <span
          key={index}
          className={`relative block shrink-0 ${starClassName}`}
          data-star-fill={fillPercentage}
        >
          <StarOutlineIcon
            className={`absolute inset-0 h-full w-full ${emptyClassName}`}
          />
          {fillPercentage > 0 ? (
            <StarSolidIcon
              className={`absolute inset-0 h-full w-full ${filledClassName}`}
              style={{ clipPath: `inset(0 ${100 - fillPercentage}% 0 0)` }}
            />
          ) : null}
        </span>
      ))}
    </span>
  );
}
export default function StarRating({ average, count, className }: Props) {
  if (count !== undefined && count <= 0) return null;
  const normalizedAverage = clampRating(average);

  return (
    <div
      className={`flex items-center gap-1.5 text-xs font-medium text-[color:var(--gv-text-muted)] ${
        className ?? "mt-1"
      }`}
      aria-label={
        count !== undefined
          ? `${normalizedAverage.toFixed(1)} von 5 Sternen bei ${count} Bewertungen`
          : `${normalizedAverage.toFixed(1)} von 5 Sternen`
      }
    >
      <FractionalStars rating={normalizedAverage} />
      {count !== undefined ? (
        <span className="text-[color:var(--gv-text)]/80">
          {normalizedAverage.toFixed(1)} ({count})
        </span>
      ) : null}
    </div>
  );
}
