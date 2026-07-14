type PageLoadingShellProps = {
  chip?: string;
  title?: string;
  subtitle?: string;
  cardCount?: number;
};

export function PageLoadingShell({
  chip = "Smokeify",
  title = "Inhalte werden vorbereitet",
  subtitle = "Produkte, Inhalte und Empfehlungen werden gerade geladen.",
  cardCount = 4,
}: PageLoadingShellProps) {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 text-[color:var(--smk-text)] sm:px-6 lg:px-8">
      <section className="smk-panel rounded-[36px] px-6 py-8 sm:px-8 sm:py-10">
        <div className="space-y-4">
          <span className="smk-chip">{chip}</span>
          <div className="h-10 w-full max-w-xl animate-pulse rounded-2xl bg-[color:var(--smk-panel)]/85" />
          <div className="h-5 w-full max-w-3xl animate-pulse rounded-xl bg-[color:var(--smk-panel)]/60" />
          <div className="h-5 w-full max-w-2xl animate-pulse rounded-xl bg-[color:var(--smk-panel)]/45" />
          <div className="sr-only">
            <p>{title}</p>
            <p>{subtitle}</p>
          </div>
        </div>
      </section>
      <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: cardCount }).map((_, index) => (
          <ProductCardSkeleton key={`page-skeleton-${index}`} />
        ))}
      </div>
    </div>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="smk-surface overflow-hidden rounded-[28px] p-4">
      <div className="h-48 animate-pulse rounded-[22px] bg-[color:var(--smk-panel)]/75" />
      <div className="mt-4 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="h-3 w-24 animate-pulse rounded-full bg-[color:var(--smk-panel)]/55" />
          <div className="h-5 w-full animate-pulse rounded-xl bg-[color:var(--smk-panel)]/75" />
          <div className="h-5 w-5/6 animate-pulse rounded-xl bg-[color:var(--smk-panel)]/55" />
        </div>
        <div className="h-11 w-11 animate-pulse rounded-2xl bg-[color:var(--smk-panel)]/70" />
      </div>
      <div className="mt-4 space-y-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={`product-skeleton-row-${index}`}
            className="h-12 animate-pulse rounded-[18px] bg-[color:var(--smk-panel)]/65"
          />
        ))}
      </div>
      <div className="mt-4 flex flex-col gap-3">
        <div className="h-11 animate-pulse rounded-2xl bg-[color:var(--smk-panel)]/75" />
        <div className="h-11 animate-pulse rounded-2xl bg-[color:var(--smk-panel)]/55" />
      </div>
    </div>
  );
}

export function WishlistListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="mt-8 space-y-4">
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={`wishlist-skeleton-${index}`}
          className="smk-surface flex flex-col gap-4 rounded-[24px] p-4 sm:flex-row"
        >
          <div className="h-40 w-full animate-pulse rounded-[20px] bg-[color:var(--smk-panel)]/70 sm:h-40 sm:w-64" />
          <div className="flex flex-1 flex-col gap-4">
            <div className="space-y-3">
              <div className="h-3 w-24 animate-pulse rounded-full bg-[color:var(--smk-panel)]/55" />
              <div className="h-6 w-full max-w-md animate-pulse rounded-xl bg-[color:var(--smk-panel)]/75" />
              <div className="h-4 w-32 animate-pulse rounded-xl bg-[color:var(--smk-panel)]/55" />
              <div className="h-4 w-full max-w-xl animate-pulse rounded-xl bg-[color:var(--smk-panel)]/45" />
              <div className="h-4 w-2/3 animate-pulse rounded-xl bg-[color:var(--smk-panel)]/35" />
            </div>
            <div className="mt-auto flex flex-wrap gap-3">
              <div className="h-11 w-11 animate-pulse rounded-2xl bg-[color:var(--smk-panel)]/65" />
              <div className="h-11 flex-1 animate-pulse rounded-full bg-[color:var(--smk-panel)]/75" />
              <div className="h-11 w-11 animate-pulse rounded-2xl bg-[color:var(--smk-panel)]/55" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function CartDrawerSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={`cart-drawer-skeleton-${index}`}
          className="flex items-center gap-3 rounded-[22px] border border-[color:var(--smk-border)] bg-[#111411] px-3 py-3"
        >
          <div className="h-12 w-12 animate-pulse rounded-2xl bg-[color:var(--smk-panel)]/70" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-3 w-20 animate-pulse rounded-full bg-[color:var(--smk-panel)]/45" />
            <div className="h-4 w-full max-w-[12rem] animate-pulse rounded-xl bg-[color:var(--smk-panel)]/75" />
            <div className="h-3 w-24 animate-pulse rounded-full bg-[color:var(--smk-panel)]/45" />
          </div>
          <div className="h-4 w-14 animate-pulse rounded-full bg-[color:var(--smk-panel)]/55" />
        </div>
      ))}
      <div className="rounded-[24px] border border-[color:var(--smk-border)] bg-[color:var(--smk-panel)] p-4">
        <div className="h-10 animate-pulse rounded-[18px] bg-[color:var(--smk-bg-soft)]/70" />
        <div className="mt-3 h-16 animate-pulse rounded-[18px] bg-[color:var(--smk-bg-soft)]/55" />
        <div className="mt-3 h-12 animate-pulse rounded-full bg-[color:var(--smk-accent-2)]/25" />
      </div>
    </div>
  );
}

export function SearchResultsSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-1.5" aria-hidden="true">
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={`search-skeleton-${index}`}
          className="flex items-center gap-3 rounded-[20px] border border-[color:var(--gv-border)] bg-[color:var(--gv-surface)]/48 px-2.5 py-2.5"
        >
          <div className="h-14 w-14 animate-pulse rounded-[16px] bg-[color:var(--gv-surface)]" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-3 w-24 animate-pulse rounded-full bg-[color:var(--gv-surface)]" />
            <div className="h-4 w-full max-w-[18rem] animate-pulse rounded bg-[color:var(--gv-surface)]" />
            <div className="h-3 w-28 animate-pulse rounded-full bg-[color:var(--gv-surface)]/70" />
          </div>
          <div className="h-4 w-4 animate-pulse rounded-full bg-[color:var(--gv-surface)]" />
        </div>
      ))}
    </div>
  );
}
