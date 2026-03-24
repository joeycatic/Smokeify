import type { Prisma, Storefront } from "@prisma/client";

export const STOREFRONTS = ["MAIN", "GROW"] as const;
export type StorefrontCode = (typeof STOREFRONTS)[number];

export const STOREFRONT_LABELS: Record<StorefrontCode, string> = {
  MAIN: "Smokeify",
  GROW: "GrowVault",
};

export const STOREFRONT_OPTION_ROWS = STOREFRONTS.map((code) => ({
  value: code,
  label: STOREFRONT_LABELS[code],
}));

export const STOREFRONT_ASSIGNMENT_OPTIONS = [
  { value: "MAIN", label: "Smokeify only", storefronts: ["MAIN"] as StorefrontCode[] },
  { value: "GROW", label: "GrowVault only", storefronts: ["GROW"] as StorefrontCode[] },
  {
    value: "MAIN,GROW",
    label: "Smokeify + GrowVault",
    storefronts: ["MAIN", "GROW"] as StorefrontCode[],
  },
] as const;

const storefrontSet = new Set<string>(STOREFRONTS);

export const parseStorefront = (value?: string | null): StorefrontCode | null => {
  const normalized = value?.trim().toUpperCase();
  return normalized && storefrontSet.has(normalized)
    ? (normalized as StorefrontCode)
    : null;
};

export const parseStorefronts = (
  value: unknown,
  fallback: StorefrontCode[] = ["MAIN"],
): StorefrontCode[] => {
  if (!Array.isArray(value)) return fallback;

  const normalized = Array.from(
    new Set(
      value
        .map((entry) => (typeof entry === "string" ? parseStorefront(entry) : null))
        .filter((entry): entry is StorefrontCode => entry !== null),
    ),
  );

  return normalized.length > 0 ? normalized : fallback;
};

export const getStorefrontAssignmentValue = (storefronts: readonly string[]) => {
  const normalized = STOREFRONT_ASSIGNMENT_OPTIONS.find((option) => {
    if (option.storefronts.length !== storefronts.length) return false;
    return option.storefronts.every((entry) => storefronts.includes(entry));
  });
  return normalized?.value ?? "MAIN";
};

export const parseStorefrontAssignmentValue = (value: string): StorefrontCode[] => {
  const match = STOREFRONT_ASSIGNMENT_OPTIONS.find((option) => option.value === value);
  return match ? [...match.storefronts] : ["MAIN"];
};

export const storefrontsToPrisma = (storefronts: StorefrontCode[]): Storefront[] =>
  storefronts as Storefront[];

export const storefrontsInclude = (
  storefronts: Array<string | null | undefined>,
  storefront: StorefrontCode,
) => storefronts.some((entry) => entry === storefront);

export const buildStorefrontProductWhere = (
  storefront: StorefrontCode,
  extra: Prisma.ProductWhereInput = {},
  options?: { allowInactive?: boolean },
): Prisma.ProductWhereInput => {
  const andClauses: Prisma.ProductWhereInput[] = [
    extra,
    { storefronts: { has: storefront } },
  ];

  if (!options?.allowInactive) {
    andClauses.unshift({ status: "ACTIVE" });
  }

  return { AND: andClauses };
};

export const buildStorefrontCategoryWhere = (
  storefront: StorefrontCode,
  extra: Prisma.CategoryWhereInput = {},
): Prisma.CategoryWhereInput => ({
  AND: [extra, { storefronts: { has: storefront } }],
});

export const buildStorefrontCollectionWhere = (
  storefront: StorefrontCode,
  extra: Prisma.CollectionWhereInput = {},
): Prisma.CollectionWhereInput => {
  if (storefront === "MAIN") {
    return extra;
  }

  return extra;
};
