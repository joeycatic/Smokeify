import type { Prisma, Storefront } from "@prisma/client";

export const STOREFRONTS = ["MAIN", "GROW"] as const;
export type StorefrontCode = (typeof STOREFRONTS)[number];
export type AdminStorefrontScope = StorefrontCode | "ALL";

export type StorefrontConfig = {
  code: StorefrontCode;
  label: string;
  adminPath: string;
  knownHosts: string[];
  publicOriginEnvKeys: string[];
  hostEnvKeys: string[];
};

export const STOREFRONT_CONFIGS: Record<StorefrontCode, StorefrontConfig> = {
  MAIN: {
    code: "MAIN",
    label: "Smokeify",
    adminPath: "/admin/smokeify",
    knownHosts: ["smokeify.de", "www.smokeify.de"],
    publicOriginEnvKeys: ["NEXT_PUBLIC_APP_URL", "NEXTAUTH_URL"],
    hostEnvKeys: ["MAIN_STOREFRONT_HOSTS"],
  },
  GROW: {
    code: "GROW",
    label: "GrowVault",
    adminPath: "/admin/growvault",
    knownHosts: ["growvault.de", "www.growvault.de"],
    publicOriginEnvKeys: ["NEXT_PUBLIC_GROW_APP_URL"],
    hostEnvKeys: ["GROW_STOREFRONT_HOSTS"],
  },
};

export const getStorefrontConfig = (storefront: StorefrontCode) =>
  STOREFRONT_CONFIGS[storefront];

export const getStorefrontConfigs = () => STOREFRONTS.map(getStorefrontConfig);

export const STOREFRONT_LABELS: Record<StorefrontCode, string> = Object.fromEntries(
  STOREFRONTS.map((code) => [code, STOREFRONT_CONFIGS[code].label]),
) as Record<StorefrontCode, string>;

export const ADMIN_STOREFRONT_SCOPE_LABELS: Record<AdminStorefrontScope, string> = {
  ALL: "All storefronts",
  MAIN: STOREFRONT_LABELS.MAIN,
  GROW: STOREFRONT_LABELS.GROW,
};

const ADMIN_STOREFRONT_SCOPE_ROUTE_PREFIXES = [
  "/admin/analytics",
  "/admin/catalog",
  "/admin/customers",
  "/admin/email-testing",
  "/admin/finance",
  "/admin/landing-page",
  "/admin/mcc",
  "/admin/orders",
  "/admin/reports",
  "/admin/reviews",
  "/admin/attribution",
] as const;

const ADMIN_CONCRETE_STOREFRONT_SCOPE_ROUTE_PREFIXES = [
  "/admin/email-testing",
  "/admin/landing-page",
] as const;

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

export const parseAdminStorefrontScope = (
  value?: string | string[] | null,
): AdminStorefrontScope => {
  const normalized = Array.isArray(value) ? value[0] : value;
  if (normalized?.trim().toUpperCase() === "ALL") {
    return "ALL";
  }
  return parseStorefront(normalized) ?? "ALL";
};

export const adminPathSupportsStorefrontScope = (pathname: string) =>
  ADMIN_STOREFRONT_SCOPE_ROUTE_PREFIXES.some((prefix) => pathname.startsWith(prefix));

export const adminPathSupportsAllStorefrontScope = (pathname: string) =>
  adminPathSupportsStorefrontScope(pathname) &&
  !ADMIN_CONCRETE_STOREFRONT_SCOPE_ROUTE_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix),
  );

export const storefrontFromAdminPath = (pathname: string): StorefrontCode | null =>
  getStorefrontConfigs().find(
    (storefront) =>
      pathname === storefront.adminPath || pathname.startsWith(`${storefront.adminPath}/`),
  )?.code ?? null;

export const storefrontScopeToStorefront = (
  storefrontScope: AdminStorefrontScope,
): StorefrontCode | null => (storefrontScope === "ALL" ? null : storefrontScope);

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

export const getDefaultStorefrontAssignmentValue = (
  storefront?: StorefrontCode | null,
) => storefront ?? "MAIN,GROW";

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
