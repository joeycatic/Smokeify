export type ProductRow = {
  id: string;
  title: string;
  handle: string;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  createdAt?: string;
  updatedAt: string;
  sellerName?: string | null;
  sellerUrl?: string | null;
  supplierId?: string | null;
  supplierName?: string | null;
  availableInventory: number;
  categoryIds: string[];
  collectionIds: string[];
  _count: { variants: number; images: number };
  outOfStock: boolean;
  mainCategory?: { id: string; name: string; handle: string } | null;
};

export type CategoryRow = {
  id: string;
  name: string;
  handle: string;
  description: string | null;
  parentId?: string | null;
};

export type SupplierRow = {
  id: string;
  name: string;
  leadTimeDays: number | null;
};

export type QuickFilters = {
  supplierId: string;
  categoryId: string;
  collectionId: string;
};

export type SortKey = "title" | "status" | "variants" | "category" | "updatedAt";

export type FilterPreset = {
  name: string;
  query: string;
  sortKey: SortKey;
  sortDirection: "asc" | "desc";
  supplierId: string;
  categoryId: string;
  collectionId: string;
};

export type CatalogClientProps = {
  initialProducts: ProductRow[];
  initialQuery: string;
  initialSortKey: SortKey;
  initialSortDirection: "asc" | "desc";
  totalCount: number;
  currentPage: number;
  totalPages: number;
  pageSize: number;
  initialCategories: CategoryRow[];
  initialCollections: CategoryRow[];
  initialSuppliers: SupplierRow[];
  initialFilters: QuickFilters;
};

export const STATUS_OPTIONS: ProductRow["status"][] = [
  "DRAFT",
  "ACTIVE",
  "ARCHIVED",
];

export const FILTER_PRESET_STORAGE_KEY =
  "smokeify-admin-catalog-filter-presets-v1";

export const slugifyHandle = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

export const formatDate = (value: string) =>
  new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

export const sortRowsByName = (rows: CategoryRow[]) =>
  [...rows].sort((left, right) => left.name.localeCompare(right.name, "de"));

export const getSortLabel = (sortKey: SortKey) => {
  switch (sortKey) {
    case "title":
      return "Title";
    case "status":
      return "Status";
    case "variants":
      return "Variants";
    case "category":
      return "Category";
    default:
      return "Updated";
  }
};

export const getStatusTone = (status: ProductRow["status"]) => {
  switch (status) {
    case "ACTIVE":
      return "border-cyan-400/20 bg-cyan-400/10 text-cyan-200";
    case "ARCHIVED":
      return "border-white/10 bg-white/[0.05] text-slate-300";
    default:
      return "border-amber-400/20 bg-amber-400/10 text-amber-200";
  }
};

export const getInventoryTone = (product: ProductRow) => {
  if (product.outOfStock) {
    return "border-red-400/20 bg-red-400/10 text-red-200";
  }
  if (product.availableInventory <= Math.max(2, product._count.variants)) {
    return "border-amber-400/20 bg-amber-400/10 text-amber-200";
  }
  return "border-emerald-400/20 bg-emerald-400/10 text-emerald-200";
};
