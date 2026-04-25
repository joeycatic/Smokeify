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
  publishedRevisionId: string | null;
  scheduledRevisionId: string | null;
  products: LandingPageAdminProduct[];
  draftProducts: LandingPageAdminProduct[];
  revisions: Array<{
    id: string;
    isManual: boolean;
    productIds: string[];
    createdAt: string;
    createdByEmail: string | null;
  }>;
};

type LandingPageSectionRow = {
  key: LandingPageSectionKey;
  isManual: boolean;
  productIds: string[];
  draftIsManual: boolean;
  draftProductIds: string[];
  scheduledPublishAt: Date | null;
  publishedRevisionId: string | null;
  scheduledRevisionId: string | null;
  publishedRevision: { isManual: boolean; productIds: string[] } | null;
  scheduledRevision: { isManual: boolean; productIds: string[] } | null;
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

type LandingPageSchemaMode = "full" | "legacy" | "missing";

let landingPageSchemaModePromise: Promise<LandingPageSchemaMode> | null = null;

const isMissingLandingPageSectionTableError = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  error.code === "P2021" &&
  String(error.meta?.table ?? "").includes("LandingPageSection");

const isMissingLandingPageRevisionTableError = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  error.code === "P2021" &&
  String(error.meta?.table ?? "").includes("LandingPageSectionRevision");

const isMissingLandingPageRevisionColumnError = (error: unknown) => {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2022") {
    return false;
  }

  const missingColumn = String(error.meta?.column ?? "");
  return (
    missingColumn.includes("LandingPageSection.publishedRevisionId") ||
    missingColumn.includes("LandingPageSection.scheduledRevisionId")
  );
};

const isLegacyLandingPageRevisionSchemaError = (error: unknown) =>
  isMissingLandingPageRevisionTableError(error) ||
  isMissingLandingPageRevisionColumnError(error);

export async function getLandingPageSchemaMode(): Promise<LandingPageSchemaMode> {
  if (!landingPageSchemaModePromise) {
    landingPageSchemaModePromise = (async () => {
      try {
        const [sectionTableRows, publishedColumnRows, scheduledColumnRows, revisionTableRows] =
          await prisma.$transaction([
            prisma.$queryRaw<Array<{ exists: boolean }>>`
              SELECT EXISTS (
                SELECT 1
                FROM information_schema.tables
                WHERE table_schema = current_schema()
                  AND table_name = 'LandingPageSection'
              ) AS "exists"
            `,
            prisma.$queryRaw<Array<{ exists: boolean }>>`
              SELECT EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_schema = current_schema()
                  AND table_name = 'LandingPageSection'
                  AND column_name = 'publishedRevisionId'
              ) AS "exists"
            `,
            prisma.$queryRaw<Array<{ exists: boolean }>>`
              SELECT EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_schema = current_schema()
                  AND table_name = 'LandingPageSection'
                  AND column_name = 'scheduledRevisionId'
              ) AS "exists"
            `,
            prisma.$queryRaw<Array<{ exists: boolean }>>`
              SELECT EXISTS (
                SELECT 1
                FROM information_schema.tables
                WHERE table_schema = current_schema()
                  AND table_name = 'LandingPageSectionRevision'
              ) AS "exists"
            `,
          ]);

        const hasSectionTable = sectionTableRows[0]?.exists === true;
        if (!hasSectionTable) {
          return "missing";
        }

        const hasPublishedRevisionId = publishedColumnRows[0]?.exists === true;
        const hasScheduledRevisionId = scheduledColumnRows[0]?.exists === true;
        const hasRevisionTable = revisionTableRows[0]?.exists === true;

        return hasPublishedRevisionId && hasScheduledRevisionId && hasRevisionTable
          ? "full"
          : "legacy";
      } catch {
        return "full";
      }
    })();
  }

  return landingPageSchemaModePromise;
}

export const getLandingPageSectionDefinition = (key: string) =>
  LANDING_PAGE_SECTION_DEFINITIONS.find((section) => section.key === key) ?? null;

const getStoredSections = async (storefront: Storefront = DEFAULT_STOREFRONT) => {
  const schemaMode = await getLandingPageSchemaMode();
  let rows: Array<{
    key: string;
    isManual: boolean;
    productIds: string[];
    draftIsManual: boolean;
    draftProductIds: string[];
    scheduledPublishAt: Date | null;
    updatedAt: Date;
    publishedRevisionId: string | null;
    scheduledRevisionId: string | null;
    publishedRevision: { isManual: boolean; productIds: string[] } | null;
    scheduledRevision: { isManual: boolean; productIds: string[] } | null;
  }> = [];
  if (schemaMode === "missing") {
    rows = [];
  } else if (schemaMode === "legacy") {
    const legacyRows = await prisma.landingPageSection.findMany({
      where: {
        storefront,
        key: { in: [...SECTION_KEYS] },
      },
      select: {
        key: true,
        isManual: true,
        productIds: true,
        draftIsManual: true,
        draftProductIds: true,
        scheduledPublishAt: true,
        updatedAt: true,
      },
    });

    rows = legacyRows.map((row) => ({
      ...row,
      publishedRevisionId: null,
      scheduledRevisionId: null,
      publishedRevision: null,
      scheduledRevision: null,
    }));
  } else {
    try {
      rows = await prisma.landingPageSection.findMany({
        where: {
          storefront,
          key: { in: [...SECTION_KEYS] },
        },
        include: {
          publishedRevision: {
            select: {
              isManual: true,
              productIds: true,
            },
          },
          scheduledRevision: {
            select: {
              isManual: true,
              productIds: true,
            },
          },
        },
      });
    } catch (error) {
      if (isMissingLandingPageSectionTableError(error)) {
        rows = [];
      } else if (isLegacyLandingPageRevisionSchemaError(error)) {
        const legacyRows = await prisma.landingPageSection.findMany({
          where: {
            storefront,
            key: { in: [...SECTION_KEYS] },
          },
          select: {
            key: true,
            isManual: true,
            productIds: true,
            draftIsManual: true,
            draftProductIds: true,
            scheduledPublishAt: true,
            updatedAt: true,
          },
        });

        rows = legacyRows.map((row) => ({
          ...row,
          publishedRevisionId: null,
          scheduledRevisionId: null,
          publishedRevision: null,
          scheduledRevision: null,
        }));
      } else {
        throw error;
      }
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
      publishedRevisionId: row.publishedRevisionId,
      scheduledRevisionId: row.scheduledRevisionId,
      publishedRevision: row.publishedRevision,
      scheduledRevision: row.scheduledRevision,
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
  if (stored?.scheduledPublishAt && stored.scheduledPublishAt <= new Date()) {
    if (stored.scheduledRevision?.isManual && stored.scheduledRevision.productIds.length > 0) {
      return stored.scheduledRevision.productIds;
    }
    return defaults[key];
  }
  if (stored?.publishedRevision) {
    if (stored.publishedRevision.isManual && stored.publishedRevision.productIds.length > 0) {
      return stored.publishedRevision.productIds;
    }
    return defaults[key];
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
  const schemaMode = await getLandingPageSchemaMode();
  let storedSections: Array<{
    key: string;
    isManual: boolean;
    productIds: string[];
    draftIsManual: boolean;
    draftProductIds: string[];
    scheduledPublishAt: Date | null;
    lastPublishedAt: Date | null;
    updatedAt: Date;
    publishedRevisionId: string | null;
    scheduledRevisionId: string | null;
    publishedRevision: {
      isManual: boolean;
      productIds: string[];
    } | null;
    scheduledRevision: {
      isManual: boolean;
      productIds: string[];
    } | null;
    revisions: Array<{
      id: string;
      isManual: boolean;
      productIds: string[];
      createdAt: Date;
      createdByEmail: string | null;
    }>;
  }> = [];
  if (schemaMode === "missing") {
    storedSections = [];
  } else if (schemaMode === "legacy") {
    const legacySections = await prisma.landingPageSection.findMany({
      where: {
        storefront,
        key: { in: [...SECTION_KEYS] },
      },
      select: {
        key: true,
        isManual: true,
        productIds: true,
        draftIsManual: true,
        draftProductIds: true,
        scheduledPublishAt: true,
        lastPublishedAt: true,
        updatedAt: true,
      },
    });

    storedSections = legacySections.map((section) => ({
      ...section,
      publishedRevisionId: null,
      scheduledRevisionId: null,
      publishedRevision: null,
      scheduledRevision: null,
      revisions: [],
    }));
  } else {
    try {
      storedSections = await prisma.landingPageSection.findMany({
        where: {
          storefront,
          key: { in: [...SECTION_KEYS] },
        },
        include: {
          publishedRevision: {
            select: {
              isManual: true,
              productIds: true,
            },
          },
          scheduledRevision: {
            select: {
              isManual: true,
              productIds: true,
            },
          },
          revisions: {
            orderBy: { createdAt: "desc" },
            take: 8,
            select: {
              id: true,
              isManual: true,
              productIds: true,
              createdAt: true,
              createdByEmail: true,
            },
          },
        },
      });
    } catch (error) {
      if (isMissingLandingPageSectionTableError(error)) {
        storedSections = [];
      } else if (isLegacyLandingPageRevisionSchemaError(error)) {
        const legacySections = await prisma.landingPageSection.findMany({
          where: {
            storefront,
            key: { in: [...SECTION_KEYS] },
          },
          select: {
            key: true,
            isManual: true,
            productIds: true,
            draftIsManual: true,
            draftProductIds: true,
            scheduledPublishAt: true,
            lastPublishedAt: true,
            updatedAt: true,
          },
        });

        storedSections = legacySections.map((section) => ({
          ...section,
          publishedRevisionId: null,
          scheduledRevisionId: null,
          publishedRevision: null,
          scheduledRevision: null,
          revisions: [],
        }));
      } else {
        throw error;
      }
    }
  }
  const allConfiguredIds = Array.from(
    new Set(
      storedSections.flatMap((section) => [...section.productIds, ...section.draftProductIds]),
    ),
  );
  const revisionProductIds = Array.from(
    new Set(storedSections.flatMap((section) => section.revisions.flatMap((revision) => revision.productIds))),
  );
  const effectiveLiveIds = Array.from(
    new Set(
      storedSections.flatMap((section) =>
        section.publishedRevision?.productIds ?? section.productIds,
      ),
    ),
  );

  const allReferencedIds = Array.from(
    new Set([...allConfiguredIds, ...revisionProductIds, ...effectiveLiveIds]),
  );

  const products: LandingPageAdminProduct[] = allReferencedIds.length
    ? (
        await prisma.product.findMany({
          where: { id: { in: allReferencedIds } },
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
    const liveProductIds = stored?.publishedRevision?.productIds ?? stored?.productIds ?? [];
    return {
      ...definition,
      isManual: stored?.isManual ?? false,
      draftIsManual: stored?.draftIsManual ?? stored?.isManual ?? false,
      updatedAt: stored?.updatedAt.toISOString() ?? null,
      lastPublishedAt: stored?.lastPublishedAt?.toISOString() ?? null,
      scheduledPublishAt: stored?.scheduledPublishAt?.toISOString() ?? null,
      publishedRevisionId: stored?.publishedRevisionId ?? null,
      scheduledRevisionId: stored?.scheduledRevisionId ?? null,
      products: liveProductIds
        .map((id) => productsById.get(id))
        .filter((product): product is LandingPageAdminProduct => Boolean(product)),
      draftProducts: (stored?.draftProductIds ?? stored?.productIds ?? [])
        .map((id) => productsById.get(id))
        .filter((product): product is LandingPageAdminProduct => Boolean(product)),
      revisions: (stored?.revisions ?? []).map((revision) => ({
        id: revision.id,
        isManual: revision.isManual,
        productIds: revision.productIds,
        createdAt: revision.createdAt.toISOString(),
        createdByEmail: revision.createdByEmail,
      })),
    };
  });
}
