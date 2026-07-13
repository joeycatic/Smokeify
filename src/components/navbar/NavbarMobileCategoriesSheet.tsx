"use client";

import type { MutableRefObject } from "react";
import Link from "next/link";
import {
  FireIcon,
  Squares2X2Icon,
} from "@heroicons/react/24/outline";
import { GrowvaultIcon } from "@/components/icons/GrowvaultIcon";
import LanguageSwitch from "@/components/LanguageSwitch";
import { getCategoryIconName } from "@/components/navbar/categoryIcons";
import type { Language } from "@/lib/language";

type Category = {
  id: string;
  name: string;
  handle: string;
  parentId: string | null;
  href: string;
  itemCount: number;
  totalItemCount: number;
};

type Props = {
  open: boolean;
  mobileProductsRef: MutableRefObject<HTMLDivElement | null>;
  categoriesStatus: "idle" | "loading" | "error";
  rootCategories: Category[];
  onClose: () => void;
  onOpenAllProducts: () => void;
  onOpenRootCategory: (category: Category) => void;
  language: Language;
};

export default function NavbarMobileCategoriesSheet({
  open,
  mobileProductsRef,
  categoriesStatus,
  rootCategories,
  onClose,
  onOpenAllProducts,
  onOpenRootCategory,
  language,
}: Props) {
  if (!open) return null;

  const copy =
    language === "en"
      ? {
          closeProducts: "Close products",
          products: "Products",
          headline: "Smokeify Products",
          close: "Close",
          assortment: "Catalog",
          allProducts: "All products",
          loading: "Loading categories...",
          loadError: "Could not load categories.",
          noCategories: "No categories found.",
          mainCategory: "Main category",
          sections: "Sections",
          productsSuffix: "products",
          active: "Active",
          viewAll: "View all",
          noSubcategories: "There are currently no subcategories in this section.",
        }
      : {
          closeProducts: "Produkte schließen",
          products: "Produkte",
          headline: "Smokeify Produkte",
          close: "Schließen",
          assortment: "Sortiment",
          allProducts: "Alle Produkte",
          loading: "Kategorien werden geladen...",
          loadError: "Kategorien konnten nicht geladen werden.",
          noCategories: "Keine Kategorien gefunden.",
          mainCategory: "Hauptkategorie",
          sections: "Bereiche",
          productsSuffix: "Produkte",
          active: "Aktiv",
          viewAll: "Alle ansehen",
          noSubcategories:
            "Für diesen Bereich gibt es aktuell keine Unterkategorien.",
        };

  return (
    <div className="fixed inset-0 z-50 sm:hidden">
      <button
        type="button"
        aria-label={copy.closeProducts}
        onClick={onClose}
        className="webshop-overlay-fade absolute inset-0 bg-[color:var(--gv-text)]/45 backdrop-blur-[3px]"
      />
      <div ref={mobileProductsRef} className="absolute inset-0 p-3">
        <div
          className="pretty-scrollbar webshop-mobile-sheet-in mx-auto max-h-[calc(100dvh-1.5rem)] max-w-md touch-pan-y overflow-y-auto overscroll-contain rounded-[26px] border border-[color:var(--gv-border)] bg-[color:var(--gv-dark)] text-[color:var(--gv-text)] shadow-[var(--gv-shadow-lg)]"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          <div className="border-b border-[color:var(--gv-border)] bg-[linear-gradient(135deg,var(--gv-lime-glow),transparent_42%),var(--gv-dark)] px-4 pb-3 pt-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <span className="gv-chip">{copy.products}</span>
                <h2 className="mt-2 font-[family:var(--font-syne)] text-[1.75rem] font-bold tracking-[-0.07em] text-[color:var(--gv-text)]">
                  {copy.headline}
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--gv-border)] bg-[color:var(--gv-surface)] text-lg text-[color:var(--gv-text)]"
                aria-label={copy.close}
              >
                ×
              </button>
            </div>
            <div className="mt-2.5 space-y-2">
              <div className="rounded-[16px] border border-[color:var(--gv-border)] bg-[color:var(--gv-surface)]/72 p-1.5">
                <LanguageSwitch language={language} compact />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Link
                  href="/products"
                  onClick={onOpenAllProducts}
                  className="group inline-flex min-h-[82px] w-full touch-pan-y items-center justify-between gap-2 rounded-[16px] border border-transparent bg-[linear-gradient(135deg,var(--gv-lime),var(--gv-lime-dim))] px-3 py-2.5 text-[color:var(--gv-forest)] shadow-[0_14px_28px_var(--gv-lime-glow)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_20px_34px_var(--gv-lime-glow)]"
                >
                  <span className="min-w-0 text-left">
                    <span className="block text-[9px] font-semibold uppercase tracking-[0.18em] text-[color:var(--gv-forest)]/70">
                      {copy.assortment}
                    </span>
                    <span className="mt-1 block text-[1rem] font-semibold leading-tight">
                      {copy.allProducts}
                    </span>
                  </span>
                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl border border-[color:var(--gv-forest)]/12 bg-[color:var(--gv-forest)]/8 transition-transform group-hover:translate-x-0.5">
                    <Squares2X2Icon className="h-3.5 w-3.5" />
                  </span>
                </Link>
                <Link
                  href="/bestseller"
                  onClick={onClose}
                  className="group inline-flex min-h-[82px] w-full touch-pan-y items-center justify-between gap-2 rounded-[16px] border border-[color:var(--gv-lime)]/24 bg-[linear-gradient(135deg,var(--gv-lime-glow),transparent_55%),color-mix(in_srgb,var(--gv-surface)_90%,transparent)] px-3 py-2.5 text-[color:var(--gv-text)] shadow-[var(--gv-shadow)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[color:var(--gv-lime)]/42 hover:bg-[color:var(--gv-lime)]/10 hover:shadow-[var(--gv-shadow-lg)]"
                >
                  <span className="min-w-0 text-left">
                    <span className="block text-[1rem] font-semibold leading-tight">
                      Bestseller
                    </span>
                  </span>
                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl border border-[color:var(--gv-lime)]/18 bg-[color:var(--gv-dark)] text-[color:var(--gv-lime)] transition-all group-hover:translate-x-0.5 group-hover:border-[color:var(--gv-lime)]/34">
                    <FireIcon className="h-3.5 w-3.5" />
                  </span>
                </Link>
              </div>
            </div>
          </div>

          <div className="px-4 py-3 pb-5">
            {categoriesStatus === "loading" ? (
              <div className="gv-glass rounded-[24px] px-4 py-4 text-sm text-[color:var(--gv-text-muted)]">
                {copy.loading}
              </div>
            ) : null}

            {categoriesStatus === "error" ? (
              <div className="rounded-[24px] border border-[color:var(--gv-error)]/30 bg-[color:var(--gv-error)]/10 px-4 py-4 text-sm text-[color:var(--gv-error)]">
                {copy.loadError}
              </div>
            ) : null}

            {categoriesStatus === "idle" ? (
              <div className="space-y-4">
                <section className="space-y-2.5">
                  <p className="font-[family:var(--font-jetbrains-mono)] text-xs uppercase tracking-[0.2em] text-[color:var(--gv-text-muted)]">
                    {copy.sections}
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {rootCategories.map((category) => {
                      const categoryIconName = getCategoryIconName(category.name);
                      return (
                        <button
                          key={category.id}
                          type="button"
                          onClick={() => onOpenRootCategory(category)}
                          className="group gv-glass flex min-h-[158px] touch-pan-y flex-col justify-between rounded-[22px] border px-3.5 py-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-[color:var(--gv-lime)]/40 hover:bg-[color:var(--gv-lime)]/10 hover:shadow-[0_22px_38px_rgba(0,0,0,0.22)]"
                        >
                          <span className="grid h-12 w-12 place-items-center rounded-[18px] border border-[color:var(--gv-lime)]/18 bg-[color:var(--gv-surface)] text-[color:var(--gv-lime)] transition-all duration-200 group-hover:scale-105 group-hover:border-[color:var(--gv-lime)]/34 group-hover:bg-[color:var(--gv-lime)]/10">
                            <GrowvaultIcon name={categoryIconName} size={22} />
                          </span>
                          <span className="mt-4 block text-[1rem] font-semibold leading-snug text-[color:var(--gv-text)]">
                            {category.name}
                          </span>
                          <span className="mt-2.5 inline-flex w-fit rounded-full border border-[color:var(--gv-border)] bg-[color:var(--gv-dark)] px-2.5 py-1 text-xs font-semibold text-[color:var(--gv-text-muted)] transition-colors duration-200 group-hover:border-[color:var(--gv-lime)]/20 group-hover:text-[color:var(--gv-lime)]">
                            {category.totalItemCount} {copy.productsSuffix}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
