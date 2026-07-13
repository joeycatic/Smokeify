import LoadingSpinner from "@/components/LoadingSpinner";

export default function Loading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6 py-16 text-center" role="status" aria-live="polite">
      <div className="gv-panel flex items-center gap-3 rounded-[22px] px-5 py-4 text-[color:var(--gv-text-muted)]">
        <LoadingSpinner size="lg" />
        <span className="text-sm font-semibold">Wird geladen...</span>
      </div>
    </div>
  );
}
