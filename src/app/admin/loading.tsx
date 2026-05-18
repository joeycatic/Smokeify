import LoadingSpinner from "@/components/LoadingSpinner";

// Shown while admin pages authenticate the session and load data.
export default function AdminLoading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center rounded-[28px] border border-white/10 bg-white/[0.03]">
      <div className="flex items-center gap-3 text-slate-300">
        <LoadingSpinner size="lg" />
        <span className="text-sm font-semibold">Loading admin workspace…</span>
      </div>
    </div>
  );
}
