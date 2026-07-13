import type { ReactNode } from "react";

export type BadgeTone = "emerald" | "neutral" | "clay" | "sky" | "brand";

const TONE_STYLES: Record<BadgeTone, string> = {
  emerald: "bg-[color:var(--gv-brand-soft)] text-[color:var(--gv-lime-dim)]",
  brand: "bg-[color:var(--gv-lime)] text-white",
  neutral: "bg-[color:var(--gv-surface)] text-[color:var(--gv-text-muted)]",
  clay: "bg-[color:var(--gv-clay)] text-white",
  sky: "bg-[color:var(--gv-sky)] text-white",
};

type Props = {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
  title?: string;
};

export default function Badge({ tone = "neutral", children, className, title }: Props) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wide ${TONE_STYLES[tone]} ${className ?? ""}`}
      title={title}
    >
      {children}
    </span>
  );
}
