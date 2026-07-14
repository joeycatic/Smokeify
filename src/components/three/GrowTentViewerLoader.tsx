"use client";

import dynamic from "next/dynamic";
import type { GrowTentViewerProductProps } from "@/components/three/growTentViewerTypes";

const GrowTentViewer = dynamic(
  () => import("@/components/three/GrowTentViewer"),
  {
    ssr: false,
    loading: () => (
      <div className="h-[420px] animate-pulse rounded-[28px] border border-[color:var(--gv-border)] bg-[color:var(--gv-surface)] sm:h-[520px]" />
    ),
  },
);

export default function GrowTentViewerLoader({
  products,
  compact,
}: {
  products: GrowTentViewerProductProps;
  compact?: boolean;
}) {
  return <GrowTentViewer products={products} compact={compact} />;
}
