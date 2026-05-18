// Skeleton for the product detail page while the server component fetches data.
export default function ProductLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 animate-pulse">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Image skeleton */}
        <div className="aspect-square rounded-xl bg-stone-200" />

        {/* Info skeleton */}
        <div className="flex flex-col gap-4 py-2">
          {/* Breadcrumb */}
          <div className="h-4 w-40 rounded bg-stone-200" />
          {/* Title */}
          <div className="h-8 w-3/4 rounded bg-stone-200" />
          <div className="h-6 w-1/2 rounded bg-stone-200" />
          {/* Price */}
          <div className="h-9 w-32 rounded bg-stone-200" />
          {/* Variant selector */}
          <div className="flex gap-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 w-20 rounded bg-stone-200" />
            ))}
          </div>
          {/* Add to cart */}
          <div className="h-12 w-full rounded-lg bg-stone-200" />
          {/* Description lines */}
          <div className="mt-4 space-y-2">
            <div className="h-4 w-full rounded bg-stone-200" />
            <div className="h-4 w-5/6 rounded bg-stone-200" />
            <div className="h-4 w-4/6 rounded bg-stone-200" />
          </div>
        </div>
      </div>
    </div>
  );
}
