"use client";

import type { MutableRefObject } from "react";
import Link from "next/link";
import {
  ArchiveBoxIcon,
  ArrowPathIcon,
  ArrowsRightLeftIcon,
  BeakerIcon,
  BoltIcon,
  CloudIcon,
  CubeIcon,
  DocumentTextIcon,
  FireIcon,
  FunnelIcon,
  LightBulbIcon,
  RectangleStackIcon,
  ScaleIcon,
  Squares2X2Icon,
  SparklesIcon,
  SunIcon,
  TrashIcon,
  WrenchScrewdriverIcon,
} from "@heroicons/react/24/outline";

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

const getCategoryIcon = (name: string) => {
  const value = name.toLowerCase();
  if (value.includes("aschenbecher") || value.includes("ashtray"))
    return TrashIcon;
  if (value.includes("aufbewahrung") || value.includes("storage"))
    return ArchiveBoxIcon;
  if (value.includes("feuerzeug") || value.includes("lighter"))
    return FireIcon;
  if (value.includes("papers") || value.includes("papier"))
    return DocumentTextIcon;
  if (value.includes("rolling tray") || value.includes("tray"))
    return RectangleStackIcon;
  if (value.includes("waage") || value.includes("waagen") || value.includes("scale"))
    return ScaleIcon;
  if (value.includes("duenger") || value.includes("dünger")) return BeakerIcon;
  if (value.includes("substrat") || value.includes("erde")) return BeakerIcon;
  if (value.includes("filter")) return FunnelIcon;
  if (value.includes("growbox") || value.includes("zelt")) return CubeIcon;
  if (value.includes("heat") || value.includes("heiz")) return FireIcon;
  if (value.includes("licht")) return SunIcon;
  if (value.includes("led") || value.includes("lampe")) return LightBulbIcon;
  if (value.includes("luft") || value.includes("luefter") || value.includes("lüfter"))
    return CloudIcon;
  if (value.includes("bewaesser") || value.includes("bewässer") || value.includes("wasser"))
    return CloudIcon;
  if (value.includes("entfeucht") || value.includes("befeucht"))
    return CloudIcon;
  if (value.includes("schlauch") || value.includes("kanal") || value.includes("duct"))
    return ArrowsRightLeftIcon;
  if (value.includes("ventilator") || value.includes("rohrventilator"))
    return ArrowPathIcon;
  if (value.includes("set") || value.includes("bundle"))
    return Squares2X2Icon;
  if (value.includes("anzucht") || value.includes("samen") || value.includes("seed"))
    return SparklesIcon;
  if (value.includes("zubehoer") || value.includes("zubehör") || value.includes("tool"))
    return WrenchScrewdriverIcon;
  return BoltIcon;
};

export default function NavbarMobileCategoriesOverlay({
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
        className="absolute inset-0 bg-black/68 backdrop-blur-[2px]"
      />
      <div
        ref={mobileProductsRef}
        className="absolute inset-0 bg-[#090b0b]/82 p-4 shadow-2xl"
      >
        <div className="mx-auto flex h-full max-w-md flex-col gap-3 rounded-[30px] border border-white/10 bg-[#101312]/96 px-4 py-5 text-stone-100 shadow-2xl shadow-black/35 backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-white/10 px-1 pb-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-stone-400">
                Kategorien
              </p>
              <p className="mt-1 text-xl font-semibold text-white">
                {activeParentName}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-3xl text-stone-200 transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#101312]"
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
              className="h-11 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm text-stone-100 shadow-sm outline-none transition placeholder:text-stone-500 focus:border-white/20 focus:bg-white/[0.06] focus:ring-2 focus:ring-white/10"
            />
          </div>
          <div className="flex items-center justify-between text-xs font-semibold text-stone-300">
            <div className="flex flex-1 items-center gap-2">
              {hasCategoryStack && (
                <button
                  type="button"
                  onClick={onBack}
                  className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-sm font-semibold text-stone-100 transition hover:border-white/20 hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#101312]"
                >
                  ← Zurück
                </button>
              )}
              <Link
                href="/products"
                onClick={onViewAllProducts}
                className={`rounded-full border border-white/10 bg-white/[0.06] px-4 py-1.5 text-sm font-semibold text-stone-100 shadow-sm transition hover:border-white/20 hover:bg-white/[0.1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#101312] ${
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
                <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-2 text-sm text-stone-400">
                  Laedt Kategorien...
                </div>
              )}
              {categoriesStatus === "error" && (
                <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                  Kategorien konnten nicht geladen werden.
                </div>
              )}
              {categoriesStatus === "idle" && filteredCategories.length === 0 && (
                <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-2 text-sm text-stone-400">
                  Keine Kategorien gefunden.
                </div>
              )}
              {categoriesStatus === "idle" && hasCategoryStack && (
                <button
                  type="button"
                  onClick={onViewParentCategory}
                  className="flex w-full items-center justify-between rounded-[24px] border border-white/12 bg-white/[0.06] px-4 py-3 text-left text-base font-semibold text-white shadow-sm transition hover:border-white/20 hover:bg-white/[0.1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#101312]"
                >
                  <span>Alle {activeParentName}</span>
                  <span className="text-sm text-stone-400">→</span>
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
                      className="flex w-full items-center justify-between rounded-[24px] border border-white/8 bg-white/[0.03] px-4 py-3 text-left text-base font-semibold text-stone-100 shadow-sm transition hover:border-white/14 hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#101312]"
                    >
                      <span className="flex items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-stone-300 shadow-sm">
                          <CategoryIcon className="h-5 w-5" />
                        </span>
                        <span>{category.name}</span>
                      </span>
                      <span className="flex items-center gap-2 text-sm text-stone-400">
                        <span className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-0.5 text-xs font-semibold text-stone-200">
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
