import LoadingSpinner from "@/components/LoadingSpinner";

export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-16 text-center">
      <div className="flex items-center gap-3 text-stone-600">
        <LoadingSpinner size="lg" />
        <span className="text-sm font-semibold">Wird geladen...</span>
      </div>
    </div>
  );
}
