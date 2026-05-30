import type { Prisma } from "@prisma/client";
import type { SeoPageConfig } from "@/lib/seoPages";

export const GROW_ALLOWED_CATEGORY_HANDLES = [
  "anzucht",
  "autopot",
  "bewaesserung",
  "duenger",
  "hydroponik",
  "licht",
  "luft",
  "luftentfeuchter",
  "messen",
  "ph-regulatoren",
  "rohrventilatoren",
  "sets",
  "substrate",
  "substrate-und-zubehoer",
  "ventilatoren",
  "wasserfilter-und-osmose",
  "zelte",
] as const;

export const GROW_RESTRICTED_CATEGORY_HANDLES = [
  "headshop",
  "aschenbecher",
  "aufbewahrung",
  "bongs",
  "feuerzeuge",
  "filter",
  "grinder",
  "kraeuterschale",
  "hash-bowl",
  "papers",
  "pipes",
  "rolling-tray",
  "tubes",
  "vaporizer",
  "waagen",
  "seeds",
] as const;

const RESTRICTED_TEXT_PATTERNS = [
  /\bheadshop\b/i,
  /\bbong/i,
  /\bfeuerzeug/i,
  /\bpipe\b/i,
  /\bgrinder/i,
  /\bpapers?\b/i,
  /\brolling\b/i,
  /\bjoint/i,
  /\bseeds?\b/i,
  /\bvape/i,
  /\bvaporizer/i,
  /\btobacco\b/i,
  /\bwaage/i,
  /\bsmok/i,
  /\bhash\b/i,
  /\bstash\b/i,
];

const allowedCategorySet = new Set(
  GROW_ALLOWED_CATEGORY_HANDLES.map((value) => value.toLowerCase()),
);
const restrictedCategorySet = new Set(
  GROW_RESTRICTED_CATEGORY_HANDLES.map((value) => value.toLowerCase()),
);

const normalize = (value?: string | null) => value?.trim().toLowerCase() ?? "";
const GROW_STOREFRONT = "MAIN" as const;
const GROW_SETS_SUFFIX = "-sets";

export const includesGrowStorefront = (storefronts?: readonly string[] | null) =>
  Array.isArray(storefronts) && storefronts.includes(GROW_STOREFRONT);

type CategoryReference = {
  handle?: string | null;
  storefronts?: string[] | null;
  parent?: { handle?: string | null; storefronts?: string[] | null } | null;
};

type ProductReference = {
  handle?: string;
  title?: string;
  description?: string | null;
  shortDescription?: string | null;
  manufacturer?: string | null;
  tags?: string[];
  storefronts?: string[] | null;
  mainCategory?: CategoryReference | null;
  categories?: Array<
    | CategoryReference
    | {
        category: CategoryReference;
      }
  >;
};

const getGrowSetParentHandle = (handle?: string | null) => {
  const normalized = normalize(handle);
  if (!normalized.endsWith(GROW_SETS_SUFFIX)) return null;

  const parentHandle = normalized.slice(0, -GROW_SETS_SUFFIX.length).trim();
  if (!parentHandle || !allowedCategorySet.has(parentHandle)) return null;

  return parentHandle;
};

export const isGrowChildSetCategoryHandle = (handle?: string | null) =>
  getGrowSetParentHandle(handle) !== null;

export const isGrowStorefrontCategoryHandle = (handle?: string | null) =>
  isGrowCategoryHandle(handle) || isGrowChildSetCategoryHandle(handle);

export const isGrowStorefrontCategory = (
  category?: CategoryReference | null,
) => {
  if (!category) return false;

  const handle = normalize(category.handle);
  if (includesGrowStorefront(category.storefronts)) {
    return true;
  }

  return (
    isGrowChildSetCategoryHandle(handle) &&
    includesGrowStorefront(category.parent?.storefronts)
  );
};

const collectCategoryHandles = (value: ProductReference | CategoryReference) => {
  const handles = new Set<string>();
  const addCategory = (category?: CategoryReference | null) => {
    if (!category) return;
    if (!isGrowStorefrontCategory(category)) return;

    const handle = normalize(category.handle);
    const parentHandle = includesGrowStorefront(category.parent?.storefronts)
      ? normalize(category.parent?.handle)
      : getGrowSetParentHandle(handle) ?? "";

    if (handle) handles.add(handle);
    if (parentHandle) handles.add(parentHandle);
  };

  if ("mainCategory" in value || "categories" in value) {
    addCategory(value.mainCategory);
    value.categories?.forEach((entry) => {
      if ("category" in entry) {
        addCategory(entry.category);
        return;
      }

      addCategory(entry);
    });
    return handles;
  }

  addCategory(value);
  return handles;
};

export const isRestrictedCategoryHandle = (handle?: string | null) =>
  restrictedCategorySet.has(normalize(handle));

export const isGrowCategoryHandle = (handle?: string | null) =>
  allowedCategorySet.has(normalize(handle));

export const hasRestrictedCatalogSignals = (product: ProductReference) => {
  const haystack = [
    product.handle ?? "",
    product.title ?? "",
    product.shortDescription ?? "",
    product.manufacturer ?? "",
  ]
    .join(" ")
    .toLowerCase();

  return RESTRICTED_TEXT_PATTERNS.some((pattern) => pattern.test(haystack));
};

export const hasRestrictedStorefrontQuery = (value?: string | null) => {
  const haystack = normalize(value).replace(/-/g, " ");
  if (!haystack) return false;

  if (RESTRICTED_TEXT_PATTERNS.some((pattern) => pattern.test(haystack))) {
    return true;
  }

  return Array.from(restrictedCategorySet).some((handle) =>
    haystack.includes(handle.replace(/-/g, " ")),
  );
};

export const isGrowProductAllowed = (product: ProductReference) => {
  if (!includesGrowStorefront(product.storefronts)) return false;
  const categories = [
    ...(product.mainCategory ? [product.mainCategory] : []),
    ...((product.categories ?? []).map((entry) =>
      "category" in entry ? entry.category : entry,
    )),
  ];
  const hasAllowedCategory = collectCategoryHandles(product).size > 0;
  const hasRestrictedCategory = categories.some((category) => {
    const handle = normalize(category.handle);
    const parentHandle = normalize(category.parent?.handle);
    return restrictedCategorySet.has(handle) || restrictedCategorySet.has(parentHandle);
  });

  if (!hasAllowedCategory || hasRestrictedCategory) return false;
  if (hasRestrictedCatalogSignals(product)) return false;
  return true;
};

const relationStorefrontFilter = (): Prisma.CategoryWhereInput => ({
  OR: [
    {
      storefronts: { has: GROW_STOREFRONT },
    },
    {
      AND: [
        { handle: { endsWith: GROW_SETS_SUFFIX } },
        {
          parent: {
            is: {
              storefronts: { has: GROW_STOREFRONT },
            },
          },
        },
      ],
    },
  ],
});

const restrictedRelationFilter = (): Prisma.CategoryWhereInput => ({
  OR: [
    { handle: { in: [...GROW_RESTRICTED_CATEGORY_HANDLES] } },
    {
      parent: {
        is: {
          handle: { in: [...GROW_RESTRICTED_CATEGORY_HANDLES] },
        },
      },
    },
  ],
});

export const buildGrowProductWhere = (
  extra: Prisma.ProductWhereInput = {},
  options?: { allowInactive?: boolean },
): Prisma.ProductWhereInput => {
  const andClauses: Prisma.ProductWhereInput[] = [];

  if (!options?.allowInactive) {
    andClauses.push({ status: "ACTIVE" });
  }

  andClauses.push(extra);
  andClauses.push({ storefronts: { has: GROW_STOREFRONT } });
  andClauses.push({
    OR: [
      { mainCategory: { is: relationStorefrontFilter() } },
      {
        categories: {
          some: { category: relationStorefrontFilter() },
        },
      },
    ],
  });
  andClauses.push({
    NOT: {
      OR: [
        { mainCategory: { is: restrictedRelationFilter() } },
        {
          categories: {
            some: {
              category: restrictedRelationFilter(),
            },
          },
        },
      ],
    },
  });
  return { AND: andClauses };
};

export const filterGrowProducts = <T extends ProductReference>(products: T[]) =>
  products.filter((product) => isGrowProductAllowed(product));

export const filterGrowCategoryHandles = (handles: string[]) =>
  handles
    .map((handle) => normalize(handle))
    .filter((handle) => isGrowStorefrontCategoryHandle(handle));

export const isGrowSeoPage = (page: SeoPageConfig) => {
  if (
    isRestrictedCategoryHandle(page.categoryHandle) ||
    isRestrictedCategoryHandle(page.parentHandle) ||
    page.slugParts.some((part) => isRestrictedCategoryHandle(part))
  ) {
    return false;
  }

  if (
    page.categoryHandle &&
    !isGrowCategoryHandle(page.categoryHandle) &&
    !isGrowCategoryHandle(page.parentHandle)
  ) {
    return false;
  }

  return true;
};

export const filterGrowSeoPages = (pages: SeoPageConfig[]) =>
  pages.filter((page) => isGrowSeoPage(page));

