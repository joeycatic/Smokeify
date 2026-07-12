import LoadingSpinner from "@/components/LoadingSpinner";

// Shown while admin pages authenticate the session and load data.
export default function AdminLoading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)]">
      <div className="flex items-center gap-3 text-[var(--adm-text-muted)]">
        <LoadingSpinner size="lg" />
        <span className="text-sm font-semibold">Loading admin workspace…</span>
      </div>
    </div>
  );
}
