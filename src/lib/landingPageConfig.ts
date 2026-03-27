import "server-only";

import { Prisma, type Storefront } from "@prisma/client";
import type { Product } from "@/data/types";
import { getProductsByIds } from "@/lib/catalog";
import { prisma } from "@/lib/prisma";

export const LANDING_PAGE_SECTION_DEFINITIONS = [
  {
    key: "hero",
    title: "Hero recommendations",
    description: "Top cards inside the homepage hero area.",
    maxItems: 3,
  },
  {
    key: "tent-deals",
    title: "Growbox deals",
    description: "Products shown in the deals block under the analyzer promo.",
    maxItems: 4,
  },
  {
    key: "bestsellers",
    title: "Bestsellers",
    description: "Products shown in the bestseller grid near the bottom of the homepage.",
    maxItems: 8,
  },
] as const;

export type LandingPageSectionKey =
  (typeof LANDING_PAGE_SECTION_DEFINITIONS)[number]["key"];

export type LandingPageAdminProduct = {
  id: string;
  title: string;
  handle: string;
  manufacturer: string | null;
  status: string;
  storefronts: string[];
  imageUrl: string | null;
};

export type LandingPageAdminSection = {
  key: LandingPageSectionKey;
  title: string;
  description: string;
  maxItems: number;
  isManual: boolean;
  draftIsManual: boolean;
  updatedAt: string | null;
  lastPublishedAt: string | null;
  scheduledPublishAt: string | null;
  products: LandingPageAdminProduct[];
  draftProducts: LandingPageAdminProduct[];
};

type LandingPageSectionRow = {
  key: LandingPageSectionKey;
  isManual: boolean;
  productIds: string[];
  draftIsManual: boolean;
  draftProductIds: string[];
  scheduledPublishAt: Date | null;
};

const HERO_PRODUCT_HANDLES = [
  "diamondbox-sl-60",
  "lux-helios-pro-300-watt-2-8",
  "ac-infinity-controller-69-pro",
] as const;

const DEFAULT_STOREFRONT: Storefront = "MAIN";

const NON_HEADSHOP_WHERE = {
  status: "ACTIVE" as const,
  categories: {
    none: {
      OR: [
        { category: { handle: "headshop" } },
        { category: { parent: { is: { handle: "headshop" } } } },
      ],
    },
  },
};

const SECTION_KEYS = LANDING_PAGE_SECTION_DEFINITIONS.map((section) => section.key);

const isMissingLandingPageSectionTableError = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  error.code === "P2021" &&
  String(error.meta?.table ?? "").includes("LandingPageSection");

export const getLandingPageSectionDefinition = (key: string) =>
  LANDING_PAGE_SECTION_DEFINITIONS.find((section) => section.key === key) ?? null;

const getStoredSections = async (storefront: Storefront = DEFAULT_STOREFRONT) => {
  let rows: Array<{
    key: string;
    isManual: boolean;
    productIds: string[];
    draftIsManual: boolean;
    draftProductIds: string[];
    scheduledPublishAt: Date | null;
    lastPublishedAt: Date | null;
    updatedAt: Date;
  }> = [];
  try {
    rows = await prisma.landingPageSection.findMany({
      where: {
        storefront,
        key: { in: [...SECTION_KEYS] },
      },
    });
  } catch (error) {
    if (!isMissingLandingPageSectionTableError(error)) {
      throw error;
    }
  }

  const sections = new Map<
    LandingPageSectionKey,
    LandingPageSectionRow & { updatedAt: string }
  >();
  rows.forEach((row) => {
    const key = row.key as LandingPageSectionKey;
    sections.set(key, {
      key,
      isManual: row.isManual,
      productIds: row.productIds,
      draftIsManual: row.draftIsManual,
      draftProductIds: row.draftProductIds,
      scheduledPublishAt: row.scheduledPublishAt,
      updatedAt: row.updatedAt.toISOString(),
    });
  });

  return sections;
};

const getDefaultSectionProductIds = async () => {
  const [bestSellerRows, tentProductRows, heroRows] = await Promise.all([
    prisma.product.findMany({
      where: NON_HEADSHOP_WHERE,
      orderBy: [
        { bestsellerScore: { sort: "desc", nulls: "last" } },
        { updatedAt: "desc" },
      ],
      select: { id: true },
      take: 16,
    }),
    prisma.product.findMany({
      where: {
        AND: [
          NON_HEADSHOP_WHERE,
          {
            categories: {
              some: {
                OR: [
                  { category: { handle: "zelte" } },
                  { category: { parent: { is: { handle: "zelte" } } } },
                ],
              },
            },
          },
        ],
      },
      select: { id: true },
      take: 40,
    }),
    prisma.product.findMany({
      where: {
        ...NON_HEADSHOP_WHERE,
        handle: { in: [...HERO_PRODUCT_HANDLES] },
      },
      select: { id: true, handle: true },
      take: HERO_PRODUCT_HANDLES.length,
    }),
  ]);

  const allIds = Array.from(
    new Set([
      ...bestSellerRows.map((row) => row.id),
      ...tentProductRows.map((row) => row.id),
      ...heroRows.map((row) => row.id),
    ]),
  );
  const products = await getProductsByIds(allIds);
  const productsById = new Map(products.map((product) => [product.id, product]));
  const productsByHandle = new Map(products.map((product) => [product.handle, product]));

  const bestSellers = bestSellerRows
    .map((row) => productsById.get(row.id))
    .filter((product): product is Product => Boolean(product))
    .filter((product) => product.availableForSale)
    .slice(0, 8)
    .map((product) => product.id);

  const tentDeals = tentProductRows
    .map((row) => productsById.get(row.id))
    .filter((product): product is Product => Boolean(product))
    .filter((product) => product.availableForSale)
    .filter((product) => Number(product.priceRange?.minVariantPrice?.amount ?? 0) <= 120)
    .sort(
      (left, right) =>
        Number(left.priceRange?.minVariantPrice?.amount ?? Number.POSITIVE_INFINITY) -
        Number(right.priceRange?.minVariantPrice?.amount ?? Number.POSITIVE_INFINITY),
    )
    .slice(0, 4)
    .map((product) => product.id);

  const hero = HERO_PRODUCT_HANDLES.map((handle) => productsByHandle.get(handle) ?? null)
    .filter((product): product is Product => Boolean(product && product.availableForSale))
    .slice(0, 3)
    .map((product) => product.id);

  return {
    hero,
    "tent-deals": tentDeals,
    bestsellers: bestSellers,
  } satisfies Record<LandingPageSectionKey, string[]>;
};

const resolveSectionProductIds = (
  key: LandingPageSectionKey,
  storedSections: Map<
    LandingPageSectionKey,
    LandingPageSectionRow & {
      draftIsManual: boolean;
      draftProductIds: string[];
      scheduledPublishAt: Date | null;
      updatedAt: string;
    }
  >,
  defaults: Record<LandingPageSectionKey, string[]>,
  options?: { previewDraft?: boolean },
) => {
  const stored = storedSections.get(key);
  if (options?.previewDraft && stored?.draftIsManual && stored.draftProductIds.length > 0) {
    return stored.draftProductIds;
  }
  if (
    stored?.scheduledPublishAt &&
    stored.scheduledPublishAt <= new Date() &&
    stored.draftIsManual &&
    stored.draftProductIds.length > 0
  ) {
    return stored.draftProductIds;
  }
  if (stored?.isManual && stored.productIds.length > 0) {
    return stored.productIds;
  }
  return defaults[key];
};

export async function resolveLandingPageProductSections(
  storefront: Storefront = DEFAULT_STOREFRONT,
  options?: { previewDraft?: boolean },
) {
  const [storedSections, defaults] = await Promise.all([
    getStoredSections(storefront),
    getDefaultSectionProductIds(),
  ]);

  const heroIds = resolveSectionProductIds("hero", storedSections, defaults, options);
  const tentDealIds = resolveSectionProductIds("tent-deals", storedSections, defaults, options);
  const bestsellerIds = resolveSectionProductIds("bestsellers", storedSections, defaults, options);
  const allIds = Array.from(new Set([...heroIds, ...tentDealIds, ...bestsellerIds]));
  const products = await getProductsByIds(allIds);
  const productsById = new Map(products.map((product) => [product.id, product]));

  return {
    heroProducts: heroIds
      .map((id) => productsById.get(id))
      .filter((product): product is Product => Boolean(product))
      .filter((product) => product.availableForSale)
      .slice(0, getLandingPageSectionDefinition("hero")?.maxItems ?? 3),
    tentProducts: tentDealIds
      .map((id) => productsById.get(id))
      .filter((product): product is Product => Boolean(product))
      .filter((product) => product.availableForSale)
      .slice(0, getLandingPageSectionDefinition("tent-deals")?.maxItems ?? 4),
    bestSellerProducts: bestsellerIds
      .map((id) => productsById.get(id))
      .filter((product): product is Product => Boolean(product))
      .filter((product) => product.availableForSale)
      .slice(0, getLandingPageSectionDefinition("bestsellers")?.maxItems ?? 8),
  };
}

export async function loadLandingPageAdminSections(
  storefront: Storefront = DEFAULT_STOREFRONT,
): Promise<LandingPageAdminSection[]> {
  let storedSections: Array<{
    key: string;
    isManual: boolean;
    productIds: string[];
    draftIsManual: boolean;
    draftProductIds: string[];
    scheduledPublishAt: Date | null;
    lastPublishedAt: Date | null;
    updatedAt: Date;
  }> = [];
  try {
    storedSections = await prisma.landingPageSection.findMany({
      where: {
        storefront,
        key: { in: [...SECTION_KEYS] },
      },
    });
  } catch (error) {
    if (!isMissingLandingPageSectionTableError(error)) {
      throw error;
    }
  }
  const allConfiguredIds = Array.from(
    new Set(
      storedSections.flatMap((section) => [...section.productIds, ...section.draftProductIds]),
    ),
  );

  const products: LandingPageAdminProduct[] = allConfiguredIds.length
    ? (
        await prisma.product.findMany({
          where: { id: { in: allConfiguredIds } },
          select: {
            id: true,
            title: true,
            handle: true,
            manufacturer: true,
            status: true,
            storefronts: true,
            images: {
              take: 1,
              orderBy: { position: "asc" },
              select: { url: true },
            },
          },
        })
      ).map((product) => ({
        id: product.id,
        title: product.title,
        handle: product.handle,
        manufacturer: product.manufacturer,
        status: product.status,
        storefronts: product.storefronts,
        imageUrl: product.images[0]?.url ?? null,
      }))
    : [];
  const productsById = new Map(products.map((product) => [product.id, product]));
  const storedByKey = new Map(
    storedSections.map((section) => [section.key as LandingPageSectionKey, section]),
  );

  return LANDING_PAGE_SECTION_DEFINITIONS.map((definition) => {
    const stored = storedByKey.get(definition.key);
    return {
      ...definition,
      isManual: stored?.isManual ?? false,
      draftIsManual: stored?.draftIsManual ?? stored?.isManual ?? false,
      updatedAt: stored?.updatedAt.toISOString() ?? null,
      lastPublishedAt: stored?.lastPublishedAt?.toISOString() ?? null,
      scheduledPublishAt: stored?.scheduledPublishAt?.toISOString() ?? null,
      products: (stored?.productIds ?? [])
        .map((id) => productsById.get(id))
        .filter((product): product is LandingPageAdminProduct => Boolean(product)),
      draftProducts: (stored?.draftProductIds ?? stored?.productIds ?? [])
        .map((id) => productsById.get(id))
        .filter((product): product is LandingPageAdminProduct => Boolean(product)),
    };
  });
}
