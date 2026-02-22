import LoadingSpinner from "@/components/LoadingSpinner";

// Shown while admin pages authenticate the session and load data.
export default function AdminLoading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="flex items-center gap-3 text-stone-500">
        <LoadingSpinner size="lg" />
        <span className="text-sm font-semibold">Lade Admin-Daten…</span>
      </div>
    </div>
  );
}
