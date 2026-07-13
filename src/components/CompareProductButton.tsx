"use client";

import { ArrowsRightLeftIcon } from "@heroicons/react/24/outline";
import { useProductCompare } from "@/hooks/useProductCompare";

export default function CompareProductButton({
  productId,
  compact = false,
}: {
  productId: string;
  compact?: boolean;
}) {
  const { ids, toggle, isCompared, maxProducts } = useProductCompare();
  const active = isCompared(productId);
  const disabled = !active && ids.length >= maxProducts;

  return (
    <button
      type="button"
      onClick={() => toggle(productId)}
      disabled={disabled}
      aria-pressed={active}
      aria-label={active ? "Aus Vergleich entfernen" : "Zum Vergleich hinzufügen"}
      title={disabled ? `Maximal ${maxProducts} Produkte` : undefined}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border px-3 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-45 ${
        active
          ? "border-[color:var(--gv-lime)]/35 bg-[color:var(--gv-lime)]/12 text-[color:var(--gv-lime)]"
          : "border-[color:var(--gv-border)] bg-[color:var(--gv-dark)] text-[color:var(--gv-text-muted)] hover:border-[color:var(--gv-lime)]/30 hover:text-[color:var(--gv-lime)]"
      }`}
    >
      <ArrowsRightLeftIcon className="h-4 w-4" />
      {compact ? null : active ? "Im Vergleich" : "Vergleichen"}
    </button>
  );
}
