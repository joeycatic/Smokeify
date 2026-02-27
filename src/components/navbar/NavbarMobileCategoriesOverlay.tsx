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
        className="absolute inset-0 bg-black/50"
      />
      <div
        ref={mobileProductsRef}
        className="absolute inset-0 bg-stone-100 p-5 shadow-2xl"
      >
        <div className="mx-auto flex h-full max-w-md flex-col gap-3 rounded-[28px] border border-emerald-200 bg-white px-4 py-5 text-emerald-950 shadow-xl">
          <div className="flex items-center justify-between border-b border-emerald-100 px-1 pb-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-600/80">
                Kategorien
              </p>
              <p className="mt-1 text-xl font-semibold text-emerald-950">
                {activeParentName}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-full text-3xl text-emerald-800 hover:bg-emerald-100 hover:text-emerald-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
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
              className="h-11 w-full rounded-xl border border-emerald-200 bg-white px-4 text-sm text-emerald-950 shadow-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/40"
            />
          </div>
          <div className="flex items-center justify-between text-xs font-semibold text-emerald-700">
            <div className="flex flex-1 items-center gap-2">
              {hasCategoryStack && (
                <button
                  type="button"
                  onClick={onBack}
                  className="rounded-full border border-emerald-200 px-4 py-1.5 text-sm font-semibold text-emerald-900 hover:border-emerald-300 hover:text-emerald-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                >
                  ← Zurück
                </button>
              )}
              <Link
                href="/products"
                onClick={onViewAllProducts}
                className={`rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-sm font-semibold text-emerald-900 shadow-sm hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-white ${
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
                <div className="px-2 py-2 text-sm text-stone-500">
                  Laedt Kategorien...
                </div>
              )}
              {categoriesStatus === "error" && (
                <div className="px-2 py-2 text-sm text-rose-600">
                  Kategorien konnten nicht geladen werden.
                </div>
              )}
              {categoriesStatus === "idle" && filteredCategories.length === 0 && (
                <div className="px-2 py-2 text-sm text-stone-500">
                  Keine Kategorien gefunden.
                </div>
              )}
              {categoriesStatus === "idle" && hasCategoryStack && (
                <button
                  type="button"
                  onClick={onViewParentCategory}
                  className="flex w-full items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-left text-base font-semibold text-emerald-950 shadow-sm hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                >
                  <span>Alle {activeParentName}</span>
                  <span className="text-sm text-emerald-600">→</span>
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
                      className="flex w-full items-center justify-between rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-left text-base font-semibold text-emerald-950 shadow-sm hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                    >
                      <span className="flex items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 shadow-sm">
                          <CategoryIcon className="h-5 w-5" />
                        </span>
                        <span>{category.name}</span>
                      </span>
                      <span className="flex items-center gap-2 text-sm text-emerald-600">
                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800">
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
