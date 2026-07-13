"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  FireIcon,
} from "@heroicons/react/24/outline";
import { GrowvaultIcon } from "@/components/icons/GrowvaultIcon";
import { getCategoryIconName } from "@/components/navbar/categoryIcons";
import LoadingSpinner from "@/components/LoadingSpinner";
import type { NavbarCategory } from "@/lib/navbarCategories";

type Props = {
  categories: NavbarCategory[];
  categoriesStatus: "idle" | "loading" | "error";
  childCountById: Map<string, number>;
  isMobile: boolean;
  pathname: string | null;
  categoryNavTarget: string | null;
  activeCategoryId: string | null;
  bestsellerLabel: string;
  errorLabel: string;
  emptyLabel: string;
  onBestsellerClick: () => void;
  onCategoryClick: (category: NavbarCategory) => void;
  registerTriggerRef: (id: string, node: HTMLButtonElement | null) => void;
};

export default function NavbarCategoryBar({
  categories,
  categoriesStatus,
  childCountById,
  isMobile,
  pathname,
  categoryNavTarget,
  activeCategoryId,
  bestsellerLabel,
  errorLabel,
  emptyLabel,
  onBestsellerClick,
  onCategoryClick,
  registerTriggerRef,
}: Props) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  const updateEdges = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    setEdges({
      left: el.scrollLeft > 4,
      right: el.scrollLeft < maxScroll - 4,
    });
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateEdges();
    el.addEventListener("scroll", updateEdges, { passive: true });
    const observer = new ResizeObserver(updateEdges);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", updateEdges);
      observer.disconnect();
    };
  }, [updateEdges, categories.length, categoriesStatus]);

  const scrollByStep = (direction: 1 | -1) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({
      left: direction * Math.max(el.clientWidth * 0.7, 220),
      behavior: "smooth",
    });
  };

  const bestsellerActive =
    pathname === "/bestseller" || categoryNavTarget === "/bestseller";

  return (
    <div className="relative flex items-center">
      {/* Left scroll affordance */}
      <div
        className={`pointer-events-none absolute inset-y-0 left-0 z-20 flex items-center pl-1 transition-opacity duration-200 ${
          edges.left ? "opacity-100" : "opacity-0"
        }`}
      >
        <span
          aria-hidden="true"
          className="absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-[color:var(--gv-dark)] via-[color:var(--gv-dark)]/85 to-transparent"
        />
        <button
          type="button"
          onClick={() => scrollByStep(-1)}
          tabIndex={edges.left ? 0 : -1}
          aria-hidden={!edges.left}
          aria-label="Kategorien zurückscrollen"
          className={`relative grid h-8 w-8 place-items-center rounded-full border border-[color:var(--gv-border)] bg-[color:var(--gv-surface)] text-[color:var(--gv-text)] shadow-[var(--gv-shadow)] transition-colors duration-200 hover:border-[color:var(--gv-lime)]/40 hover:text-[color:var(--gv-lime)] ${
            edges.left ? "pointer-events-auto" : "pointer-events-none"
          }`}
        >
          <ChevronLeftIcon className="h-4 w-4" />
        </button>
      </div>

      <div
        ref={scrollRef}
        className="no-scrollbar flex w-full items-center gap-1.5 overflow-x-auto scroll-smooth py-2"
      >
        <Link
          href="/bestseller"
          onClick={onBestsellerClick}
          className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-[color:var(--gv-lime)] px-4 py-2 text-xs font-bold uppercase tracking-[0.06em] text-[color:var(--gv-forest)] shadow-[0_8px_20px_var(--gv-lime-glow)] transition-all duration-200 hover:brightness-105 ${
            bestsellerActive
              ? "ring-2 ring-inset ring-[color:var(--gv-forest)]/30"
              : ""
          }`}
        >
          <FireIcon className="h-4 w-4" />
          <span>{bestsellerLabel}</span>
          {categoryNavTarget === "/bestseller" && (
            <LoadingSpinner
              size="sm"
              className="h-3 w-3 border-2 border-[color:var(--gv-forest)]/30 border-t-[color:var(--gv-forest)]"
            />
          )}
        </Link>

        <span
          aria-hidden="true"
          className="mx-1 h-6 w-px shrink-0 bg-[color:var(--gv-border)]"
        />

        {categoriesStatus === "error" && (
          <span className="shrink-0 px-2 text-xs text-[color:var(--gv-error)]">
            {errorLabel}
          </span>
        )}
        {categoriesStatus === "idle" && categories.length === 0 && (
          <span className="shrink-0 px-2 text-xs text-[color:var(--gv-text-muted)]">
            {emptyLabel}
          </span>
        )}
        {categoriesStatus === "idle" &&
          categories.map((category) => {
            const hasChildren = (childCountById.get(category.id) ?? 0) > 0;
            const chipActive =
              activeCategoryId === category.id || pathname === category.href;
            const supportsPopup = !isMobile && hasChildren;
            return (
              <button
                key={category.id}
                type="button"
                ref={(node) => registerTriggerRef(category.id, node)}
                onClick={() => onCategoryClick(category)}
                aria-expanded={supportsPopup ? chipActive : undefined}
                aria-haspopup={supportsPopup || undefined}
                className={`group inline-flex shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-full px-3.5 py-2 text-xs font-bold uppercase tracking-[0.06em] transition-colors duration-200 ${
                  chipActive
                    ? "bg-[color:var(--gv-lime)] text-[color:var(--gv-forest)]"
                    : "text-[color:var(--gv-text-muted)] hover:bg-[color:var(--gv-lime)]/10 hover:text-[color:var(--gv-text)]"
                }`}
              >
                <GrowvaultIcon
                  name={getCategoryIconName(category.name)}
                  size={17}
                  className={
                    chipActive
                      ? "text-[color:var(--gv-forest)]"
                      : "text-[color:var(--gv-lime)]"
                  }
                />
                <span>{category.name}</span>
                {categoryNavTarget === category.href && (
                  <LoadingSpinner
                    size="sm"
                    className="h-3 w-3 border-2 border-[color:var(--gv-border)] border-t-[color:var(--gv-lime)]"
                  />
                )}
              </button>
            );
          })}
      </div>

      {/* Right scroll affordance */}
      <div
        className={`pointer-events-none absolute inset-y-0 right-0 z-20 flex items-center pr-1 transition-opacity duration-200 ${
          edges.right ? "opacity-100" : "opacity-0"
        }`}
      >
        <span
          aria-hidden="true"
          className="absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-[color:var(--gv-dark)] via-[color:var(--gv-dark)]/85 to-transparent"
        />
        <button
          type="button"
          onClick={() => scrollByStep(1)}
          tabIndex={edges.right ? 0 : -1}
          aria-hidden={!edges.right}
          aria-label="Weitere Kategorien anzeigen"
          className={`relative grid h-8 w-8 place-items-center rounded-full border border-[color:var(--gv-border)] bg-[color:var(--gv-surface)] text-[color:var(--gv-text)] shadow-[var(--gv-shadow)] transition-colors duration-200 hover:border-[color:var(--gv-lime)]/40 hover:text-[color:var(--gv-lime)] ${
            edges.right ? "pointer-events-auto" : "pointer-events-none"
          }`}
        >
          <ChevronRightIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
