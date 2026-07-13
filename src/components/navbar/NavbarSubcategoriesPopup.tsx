"use client";

import { createPortal } from "react-dom";
import type { MutableRefObject } from "react";
import { ArrowRightIcon } from "@heroicons/react/24/outline";
import { GrowvaultIcon } from "@/components/icons/GrowvaultIcon";
import { getCategoryIconName } from "@/components/navbar/categoryIcons";
import type { DropdownPopupStyle } from "@/hooks/useDropdownPopupPosition";

type Category = {
  id: string;
  name: string;
  href: string;
  totalItemCount: number;
};

type Props = {
  category: Category;
  categories: Category[];
  copy: {
    subcategories: string;
    viewAll: string;
  };
  onNavigate: (category: Category) => void;
  popupRef: MutableRefObject<HTMLDivElement | null>;
  popupStyle: DropdownPopupStyle;
};

export default function NavbarSubcategoriesPopup({
  category,
  categories,
  copy,
  onNavigate,
  popupRef,
  popupStyle,
}: Props) {
  return createPortal(
    <div
      ref={popupRef}
      className="webshop-dropdown-in fixed z-[1002] overflow-hidden rounded-[20px] border border-[color:var(--gv-border)] bg-[color:var(--gv-dark)] p-2 text-[color:var(--gv-text)] shadow-[0_24px_60px_rgba(20,26,22,0.16)]"
      style={{
        top: popupStyle.top,
        left: popupStyle.left,
        width: popupStyle.width,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-1.5 py-1">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-[color:var(--gv-lime)]/20 bg-[color:var(--gv-surface)] text-[color:var(--gv-lime)]">
            <GrowvaultIcon name={getCategoryIconName(category.name)} size={16} />
          </span>
          <div className="min-w-0">
            <p className="font-[family:var(--font-jetbrains-mono)] text-[9px] font-semibold uppercase tracking-[0.2em] text-[color:var(--gv-lime)]">
              {copy.subcategories}
            </p>
            <p className="truncate text-sm font-bold tracking-[-0.02em] text-[color:var(--gv-text)]">
              {category.name}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onNavigate(category)}
          className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[color:var(--gv-lime)] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.05em] text-[color:var(--gv-forest)] transition-all duration-200 hover:brightness-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--gv-lime)]"
          aria-label={`${copy.viewAll} ${category.name}`}
        >
          {copy.viewAll}
          <ArrowRightIcon className="h-3 w-3" aria-hidden="true" />
        </button>
      </div>

      <div
        className="mx-1.5 my-1 h-px bg-[color:var(--gv-border)]"
        aria-hidden="true"
      />

      {/* Subcategory list */}
      <div className="no-scrollbar grid max-h-[60vh] gap-0.5 overflow-y-auto py-0.5">
        {categories.map((child) => (
          <button
            key={child.id}
            type="button"
            onClick={() => onNavigate(child)}
            className="group flex items-center gap-2.5 rounded-[14px] px-2.5 py-2 text-left transition-colors duration-150 hover:bg-[color:var(--gv-lime)]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--gv-lime)]"
            aria-label={`${child.name}, ${child.totalItemCount} Produkte`}
          >
            <GrowvaultIcon
              name={getCategoryIconName(child.name)}
              size={16}
              className="shrink-0 text-[color:var(--gv-lime)]"
            />
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[color:var(--gv-text)]">
              {child.name}
            </span>
            <span className="shrink-0 text-xs font-semibold tabular-nums text-[color:var(--gv-text-muted)]">
              {child.totalItemCount}
            </span>
            <ArrowRightIcon
              className="h-3.5 w-3.5 shrink-0 text-[color:var(--gv-text-muted)] opacity-0 transition-all duration-150 group-hover:translate-x-0.5 group-hover:text-[color:var(--gv-lime)] group-hover:opacity-100"
              aria-hidden="true"
            />
          </button>
        ))}
      </div>
    </div>,
    document.body,
  );
}
