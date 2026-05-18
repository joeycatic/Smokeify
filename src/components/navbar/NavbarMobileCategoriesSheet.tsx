"use client";

import type { MutableRefObject } from "react";
import Link from "next/link";
import { getCategoryIcon } from "@/components/navbar/categoryIcons";

type Category = {
  id: string;
  name: string;
  handle: string;
  parentId: string | null;
  itemCount: number;
  totalItemCount: number;
};

type Props = {
  open: boolean;
  mobileProductsRef: MutableRefObject<HTMLDivElement | null>;
  activeParentName: string;
  categoryQuery: string;
  hasCategoryStack: boolean;
  categoriesStatus: "idle" | "loading" | "error";
  filteredCategories: Category[];
  childCountByCategoryId: Map<string, number>;
  onClose: () => void;
  onCategoryQueryChange: (value: string) => void;
  onBack: () => void;
  onViewAllProducts: () => void;
  onViewParentCategory: () => void;
  onSelectCategory: (category: Category, isLeaf: boolean) => void;
};

export default function NavbarMobileCategoriesSheet({
  open,
  mobileProductsRef,
  activeParentName,
  categoryQuery,
  hasCategoryStack,
  categoriesStatus,
  filteredCategories,
  childCountByCategoryId,
  onClose,
  onCategoryQueryChange,
  onBack,
  onViewAllProducts,
  onViewParentCategory,
  onSelectCategory,
}: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 sm:hidden">
      <button
        type="button"
        aria-label="Produkte schliessen"
        onClick={onClose}
        className="webshop-overlay-fade absolute inset-0 bg-black/68 backdrop-blur-[2px]"
      />
      <div
        ref={mobileProductsRef}
        className="absolute inset-0 bg-black/65 p-4 shadow-2xl backdrop-blur-sm"
      >
        <div className="webshop-mobile-sheet-in mx-auto flex h-full max-w-md flex-col gap-3 rounded-[30px] border border-[var(--smk-border)] bg-[linear-gradient(180deg,rgba(27,23,20,0.98),rgba(14,14,13,0.99))] px-4 py-5 text-[var(--smk-text)] shadow-2xl shadow-black/40 backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-[var(--smk-border)] px-1 pb-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[var(--smk-text-dim)]">
                Kategorien
              </p>
              <p className="mt-1 text-xl font-semibold text-[var(--smk-text)]">
                {activeParentName}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--smk-border)] bg-[rgba(255,255,255,0.05)] text-3xl text-[var(--smk-text)] transition hover:border-[var(--smk-border-strong)] hover:bg-[rgba(255,255,255,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--smk-accent)]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
              aria-label="Schliessen"
            >
              ×
            </button>
          </div>
          <div className="relative">
            <input
              type="search"
              value={categoryQuery}
              onChange={(event) => onCategoryQueryChange(event.target.value)}
              placeholder="Kategorien suchen ..."
              className="smk-input h-11 w-full rounded-2xl px-4 text-sm placeholder:text-[var(--smk-text-dim)]"
            />
          </div>
          <div className="flex items-center justify-between text-xs font-semibold text-[var(--smk-text-dim)]">
            <div className="flex flex-1 items-center gap-2">
              {hasCategoryStack && (
                <button
                  type="button"
                  onClick={onBack}
                  className="rounded-full border border-[var(--smk-border)] bg-[rgba(255,255,255,0.05)] px-4 py-1.5 text-sm font-semibold text-[var(--smk-text)] transition hover:border-[var(--smk-border-strong)] hover:bg-[rgba(255,255,255,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--smk-accent)]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                >
                  ← Zurück
                </button>
              )}
              <Link
                href="/products"
                onClick={onViewAllProducts}
                className={`rounded-full border border-[var(--smk-border)] bg-[rgba(255,255,255,0.05)] px-4 py-1.5 text-sm font-semibold text-[var(--smk-text)] shadow-sm transition hover:border-[var(--smk-border-strong)] hover:bg-[rgba(255,255,255,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--smk-accent)]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-black ${
                  hasCategoryStack ? "ml-auto" : ""
                }`}
              >
                Alle Produkte anzeigen
              </Link>
            </div>
            <span aria-hidden="true" />
          </div>
          <div className="no-scrollbar flex-1 overflow-y-auto pb-4">
            <div className="space-y-3">
              {categoriesStatus === "loading" && (
                <div className="rounded-2xl border border-[var(--smk-border)] bg-[rgba(255,255,255,0.03)] px-3 py-2 text-sm text-[var(--smk-text-muted)]">
                  Laedt Kategorien...
                </div>
              )}
              {categoriesStatus === "error" && (
                <div className="rounded-2xl border border-[var(--smk-error)]/30 bg-[rgba(120,30,30,0.18)] px-3 py-2 text-sm text-[var(--smk-error)]">
                  Kategorien konnten nicht geladen werden.
                </div>
              )}
              {categoriesStatus === "idle" && filteredCategories.length === 0 && (
                <div className="rounded-2xl border border-[var(--smk-border)] bg-[rgba(255,255,255,0.03)] px-3 py-2 text-sm text-[var(--smk-text-muted)]">
                  Keine Kategorien gefunden.
                </div>
              )}
              {categoriesStatus === "idle" && hasCategoryStack && (
                <button
                  type="button"
                  onClick={onViewParentCategory}
                  className="flex w-full items-center justify-between rounded-[24px] border border-[var(--smk-border)] bg-[rgba(255,255,255,0.05)] px-4 py-3 text-left text-base font-semibold text-[var(--smk-text)] shadow-sm transition hover:border-[var(--smk-border-strong)] hover:bg-[rgba(255,255,255,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--smk-accent)]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                >
                  <span>Alle {activeParentName}</span>
                  <span className="text-sm text-[var(--smk-text-dim)]">→</span>
                </button>
              )}
              {categoriesStatus === "idle" &&
                filteredCategories.map((category) => {
                  const CategoryIcon = getCategoryIcon(category.name);
                  const childCount = childCountByCategoryId.get(category.id) ?? 0;
                  const isLeaf = childCount === 0;
                  return (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => onSelectCategory(category, isLeaf)}
                      className="flex w-full items-center justify-between rounded-[24px] border border-[var(--smk-border)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-left text-base font-semibold text-[var(--smk-text)] shadow-sm transition hover:border-[var(--smk-border-strong)] hover:bg-[rgba(255,255,255,0.07)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--smk-accent)]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                    >
                      <span className="flex items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--smk-border)] bg-[rgba(255,255,255,0.05)] text-[var(--smk-accent)] shadow-sm">
                          <CategoryIcon className="h-5 w-5" />
                        </span>
                        <span>{category.name}</span>
                      </span>
                      <span className="flex items-center gap-2 text-sm text-[var(--smk-text-dim)]">
                        <span className="rounded-full border border-[var(--smk-border)] bg-[rgba(255,255,255,0.05)] px-2.5 py-0.5 text-xs font-semibold text-[var(--smk-text-muted)]">
                          {category.totalItemCount}
                        </span>
                        {!isLeaf && "›"}
                      </span>
                    </button>
                  );
                })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
