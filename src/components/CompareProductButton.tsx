"use client";

import { ArrowsRightLeftIcon } from "@heroicons/react/24/outline";
import { MAX_COMPARE_ITEMS, useProductCompare } from "@/hooks/useProductCompare";

type CompareProductButtonProps = {
  productId: string;
  label?: string;
  compact?: boolean;
  className?: string;
};

export default function CompareProductButton({
  productId,
  label = "Vergleichen",
  compact = false,
  className,
}: CompareProductButtonProps) {
  const { ids, isCompared, toggle } = useProductCompare();
  const active = isCompared(productId);
  const disabled = !active && ids.length >= MAX_COMPARE_ITEMS;

  return (
    <button
      type="button"
      onClick={() => toggle(productId)}
      disabled={disabled}
      aria-pressed={active}
      title={
        disabled
          ? `Maximal ${MAX_COMPARE_ITEMS} Produkte vergleichen`
          : active
            ? "Aus Vergleich entfernen"
            : "Zum Vergleich hinzufügen"
      }
      className={
        className ??
        `inline-flex items-center justify-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--smk-accent)]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-black disabled:cursor-not-allowed disabled:opacity-50 ${
          active
            ? "border-[var(--smk-accent)] bg-[rgba(241,198,132,0.16)] text-[var(--smk-text)]"
            : "border-[var(--smk-border)] bg-[rgba(255,255,255,0.04)] text-[var(--smk-text-muted)] hover:border-[var(--smk-border-strong)] hover:text-[var(--smk-text)]"
        }`
      }
    >
      <ArrowsRightLeftIcon className={compact ? "h-4 w-4" : "h-4.5 w-4.5"} />
      {compact ? null : <span>{active ? "Im Vergleich" : label}</span>}
    </button>
  );
}
