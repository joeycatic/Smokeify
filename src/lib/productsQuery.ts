import { Prisma } from "@prisma/client";
import { unstable_cache } from "next/cache";
import type { Product } from "@/data/types";
import { getProductsByIds } from "@/lib/catalog";
import { prisma } from "@/lib/prisma";
import {
  buildProductSearchTermGroups,
  normalizeProductSearchText,
  type ProductSearchSynonymMap,
} from "@/lib/productSearch";
import {
  getCachedMainSearchBoostRules,
  getCachedMainSearchSynonymMap,
} from "@/lib/searchTuning";

const MAIN_STOREFRONT_SQL = Prisma.sql`ARRAY['MAIN']::"Storefront"[]`;

export type SortMode = "featured" | "price_asc" | "price_desc" | "name_asc";

export type ProductsQueryParams = {
  categoryParam?: string;
  manufacturerParam?: string;
  categories?: string[];
  manufacturers?: string[];
  priceMin?: number;
  priceMax?: number;
  searchQuery?: string;
  sortBy?: SortMode;
  offset?: number;
  limit?: number;
};

export type ProductsQueryResult = {
  products: Product[];
  total: number;
  priceMinBound: number;
  priceMaxBound: number;
  availableCategories: Array<[string, string]>;
  availableManufacturers: string[];
  allCategoryTitles: Array<[string, string]>;
};

type CategoryMeta = {
  categoryHierarchy: {
    parents: Array<[string, string]>;
    childrenByParent: Array<[string, Array<[string, string]>]>;
  };
  allCategoryTitles: Array<[string, string]>;
};

const getCachedCategoryMeta = unstable_cache(
  async (): Promise<CategoryMeta> => {
    const categories = await prisma.category.findMany({
      where: { storefronts: { has: "MAIN" } },
      select: {
        id: true,
        name: true,
        handle: true,
        parentId: true,
        parent: {
          select: {
            id: true,
            name: true,
            handle: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    const parents = new Map<string, string>();
    const childrenByParent = new Map<string, Map<string, string>>();
    const allCategoryTitles = new Map<string, string>();

    categories.forEach((category) => {
      allCategoryTitles.set(category.handle, category.name);
      if (!category.parentId) {
        parents.set(category.handle, category.name);
        return;
      }
      if (!category.parent) return;
      parents.set(category.parent.handle, category.parent.name);
      const bucket =
        childrenByParent.get(category.parent.handle) ?? new Map<string, string>();
      bucket.set(category.handle, category.name);
      childrenByParent.set(category.parent.handle, bucket);
    });

    return {
      categoryHierarchy: {
        parents: Array.from(parents.entries()),
        childrenByParent: Array.from(childrenByParent.entries()).map(
          ([parentHandle, children]) => [parentHandle, Array.from(children.entries())],
        ),
      },
      allCategoryTitles: Array.from(allCategoryTitles.entries()),
    };
  },
  ["products-query-categories"],
  { revalidate: 60 },
);

const escapeLike = (value: string) =>
  value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");

const buildCategoryWhereSql = (categories: string[]) => {
  if (categories.length === 0) return Prisma.empty;
  return Prisma.sql`
    AND (
      EXISTS (
        SELECT 1
        FROM "ProductCategory" pc
        JOIN "Category" c ON c.id = pc."categoryId"
        LEFT JOIN "Category" cp ON cp.id = c."parentId"
        WHERE pc."productId" = p.id
          AND c.storefronts @> ${MAIN_STOREFRONT_SQL}
          AND (cp.id IS NULL OR cp.storefronts @> ${MAIN_STOREFRONT_SQL})
          AND (c.handle IN (${Prisma.join(categories)}) OR cp.handle IN (${Prisma.join(categories)}))
      )
      OR EXISTS (
        SELECT 1
        FROM "Category" mc
        LEFT JOIN "Category" mcp ON mcp.id = mc."parentId"
        WHERE mc.id = p."mainCategoryId"
          AND mc.storefronts @> ${MAIN_STOREFRONT_SQL}
          AND (mcp.id IS NULL OR mcp.storefronts @> ${MAIN_STOREFRONT_SQL})
          AND (mc.handle IN (${Prisma.join(categories)}) OR mcp.handle IN (${Prisma.join(categories)}))
      )
    )
  `;
};

const buildManufacturerWhereSql = (manufacturers: string[]) => {
  if (manufacturers.length === 0) return Prisma.empty;
  const conditions = manufacturers.map((value) => {
    const normalized = `%${escapeLike(value)}%`;
    return Prisma.sql`COALESCE(p.manufacturer, '') ILIKE ${normalized} ESCAPE '\\'`;
  });
  const [firstCondition, ...restConditions] = conditions;
  const combinedConditions = restConditions.reduce(
    (sql, condition) => Prisma.sql`${sql} OR ${condition}`,
    firstCondition
  );
  return Prisma.sql`AND (${combinedConditions})`;
};

const joinSearchConditions = (
  conditions: Prisma.Sql[],
  operator: "AND" | "OR",
) => {
  const [first, ...rest] = conditions;
  if (!first) return Prisma.sql`FALSE`;
  return rest.reduce(
    (combined, condition) =>
      operator === "AND"
        ? Prisma.sql`${combined} AND ${condition}`
        : Prisma.sql`${combined} OR ${condition}`,
    first,
  );
};

const buildSearchTermMatchSql = (term: string) => {
  const pattern = `%${escapeLike(term)}%`;
  return Prisma.sql`
    (
      p.title ILIKE ${pattern} ESCAPE '\\'
      OR p.handle ILIKE ${pattern} ESCAPE '\\'
      OR COALESCE(p.manufacturer, '') ILIKE ${pattern} ESCAPE '\\'
      OR COALESCE(p."shortDescription", '') ILIKE ${pattern} ESCAPE '\\'
      OR COALESCE(p.description, '') ILIKE ${pattern} ESCAPE '\\'
      OR COALESCE(p."technicalDetails", '') ILIKE ${pattern} ESCAPE '\\'
      OR COALESCE(p."growboxSize", '') ILIKE ${pattern} ESCAPE '\\'
      OR COALESCE(p."lightSize", '') ILIKE ${pattern} ESCAPE '\\'
      OR COALESCE(p."productGroup", '') ILIKE ${pattern} ESCAPE '\\'
      OR array_to_string(p.tags, ' ') ILIKE ${pattern} ESCAPE '\\'
      OR EXISTS (
        SELECT 1
        FROM "ProductCollection" pcl
        JOIN "Collection" cl ON cl.id = pcl."collectionId"
        WHERE pcl."productId" = p.id
          AND (
            cl.name ILIKE ${pattern} ESCAPE '\\'
            OR cl.handle ILIKE ${pattern} ESCAPE '\\'
          )
      )
      OR EXISTS (
        SELECT 1
        FROM "ProductCategory" pc
        JOIN "Category" c ON c.id = pc."categoryId"
        LEFT JOIN "Category" cp ON cp.id = c."parentId"
        WHERE pc."productId" = p.id
          AND c.storefronts @> ${MAIN_STOREFRONT_SQL}
          AND (cp.id IS NULL OR cp.storefronts @> ${MAIN_STOREFRONT_SQL})
          AND (
            c.name ILIKE ${pattern} ESCAPE '\\'
            OR c.handle ILIKE ${pattern} ESCAPE '\\'
            OR COALESCE(cp.name, '') ILIKE ${pattern} ESCAPE '\\'
            OR COALESCE(cp.handle, '') ILIKE ${pattern} ESCAPE '\\'
          )
      )
      OR EXISTS (
        SELECT 1
        FROM "Category" mc
        LEFT JOIN "Category" mcp ON mcp.id = mc."parentId"
        WHERE mc.id = p."mainCategoryId"
          AND mc.storefronts @> ${MAIN_STOREFRONT_SQL}
          AND (mcp.id IS NULL OR mcp.storefronts @> ${MAIN_STOREFRONT_SQL})
          AND (
            mc.name ILIKE ${pattern} ESCAPE '\\'
            OR mc.handle ILIKE ${pattern} ESCAPE '\\'
            OR COALESCE(mcp.name, '') ILIKE ${pattern} ESCAPE '\\'
            OR COALESCE(mcp.handle, '') ILIKE ${pattern} ESCAPE '\\'
          )
      )
      OR EXISTS (
        SELECT 1
        FROM "Variant" sv
        WHERE sv."productId" = p.id
          AND (
            sv.title ILIKE ${pattern} ESCAPE '\\'
            OR COALESCE(sv.sku, '') ILIKE ${pattern} ESCAPE '\\'
          )
      )
    )
  `;
};

const buildSearchWhereSql = (
  searchQuery: string,
  synonyms?: ProductSearchSynonymMap,
) => {
  const termGroups = buildProductSearchTermGroups(searchQuery, { synonyms });
  if (termGroups.length === 0) return Prisma.empty;
  const groupConditions = termGroups.map((group) =>
    Prisma.sql`(${joinSearchConditions(group.map(buildSearchTermMatchSql), "OR")})`,
  );
  return Prisma.sql`AND ${joinSearchConditions(groupConditions, "AND")}`;
};

const buildSearchScoreSql = (
  searchQuery: string,
  synonyms?: ProductSearchSynonymMap,
) => {
  const normalizedQuery = searchQuery.trim();
  const termGroups = buildProductSearchTermGroups(searchQuery, { synonyms });
  if (!normalizedQuery || termGroups.length === 0) return Prisma.sql`0`;

  const phrasePattern = `%${escapeLike(normalizedQuery)}%`;
  const phraseScore = Prisma.sql`
    CASE
      WHEN LOWER(p.title) = LOWER(${normalizedQuery}) THEN 240
      WHEN p.title ILIKE ${phrasePattern} ESCAPE '\\' THEN 180
      WHEN p.handle ILIKE ${phrasePattern} ESCAPE '\\' THEN 160
      WHEN COALESCE(p.manufacturer, '') ILIKE ${phrasePattern} ESCAPE '\\' THEN 120
      ELSE 0
    END
  `;

  return termGroups.reduce((score, group) => {
    const titleConditions = group.map((term) => {
      const pattern = `%${escapeLike(term)}%`;
      return Prisma.sql`p.title ILIKE ${pattern} ESCAPE '\\'`;
    });
    const handleConditions = group.map((term) => {
      const pattern = `%${escapeLike(term)}%`;
      return Prisma.sql`p.handle ILIKE ${pattern} ESCAPE '\\'`;
    });
    const manufacturerConditions = group.map((term) => {
      const pattern = `%${escapeLike(term)}%`;
      return Prisma.sql`COALESCE(p.manufacturer, '') ILIKE ${pattern} ESCAPE '\\'`;
    });
    const dimensionConditions = group.flatMap((term) => {
      const pattern = `%${escapeLike(term)}%`;
      return [
        Prisma.sql`COALESCE(p."growboxSize", '') ILIKE ${pattern} ESCAPE '\\'`,
        Prisma.sql`COALESCE(p."lightSize", '') ILIKE ${pattern} ESCAPE '\\'`,
      ];
    });

    return Prisma.sql`${score} + CASE
      WHEN ${joinSearchConditions(titleConditions, "OR")} THEN 80
      WHEN ${joinSearchConditions(handleConditions, "OR")} THEN 70
      WHEN ${joinSearchConditions(manufacturerConditions, "OR")} THEN 55
      WHEN ${joinSearchConditions(dimensionConditions, "OR")} THEN 45
      ELSE 20
    END`;
  }, phraseScore);
};

const buildSearchBoostSql = (
  searchQuery: string,
  boostRules: Awaited<ReturnType<typeof getCachedMainSearchBoostRules>>,
) => {
  const normalizedQuery = normalizeProductSearchText(searchQuery);
  const matchingRules = boostRules.filter((rule) => rule.query === normalizedQuery);
  return matchingRules.reduce(
    (score, rule) =>
      Prisma.sql`${score} + CASE WHEN p.id = ${rule.productId} THEN ${rule.boostScore} ELSE 0 END`,
    Prisma.sql`0`,
  );
};

const buildOrderBySql = (sortBy: SortMode, hasSearchQuery: boolean) => {
  if (sortBy === "price_asc") {
    return Prisma.sql`
      ORDER BY available_for_sale DESC, min_price_cents ASC, title ASC, id ASC
    `;
  }
  if (sortBy === "price_desc") {
    return Prisma.sql`
      ORDER BY available_for_sale DESC, min_price_cents DESC, title ASC, id ASC
    `;
  }
  if (sortBy === "name_asc") {
    return Prisma.sql`
      ORDER BY available_for_sale DESC, title ASC, id ASC
    `;
  }
  if (hasSearchQuery) {
    return Prisma.sql`
      ORDER BY available_for_sale DESC, search_boost DESC, search_score DESC, "bestsellerScore" DESC NULLS LAST, "updatedAt" DESC, id ASC
    `;
  }
  return Prisma.sql`
    ORDER BY available_for_sale DESC, "bestsellerScore" DESC NULLS LAST, "updatedAt" DESC, id ASC
  `;
};

const getPriceBoundsCached = unstable_cache(
  async () => {
    const row = await prisma.$queryRaw<Array<{ max_price_cents: number | null }>>`
      SELECT MAX(min_price_cents)::int AS max_price_cents
      FROM (
        SELECT MIN(v."priceCents") AS min_price_cents
        FROM "Product" p
        JOIN "Variant" v ON v."productId" = p.id
        WHERE p.status = 'ACTIVE'
          AND p.storefronts @> ${MAIN_STOREFRONT_SQL}
        GROUP BY p.id
      ) price_bounds
    `;
    const maxPriceCents = row[0]?.max_price_cents ?? 0;
    const maxPrice = maxPriceCents / 100;
    return {
      priceMinBound: 0,
      priceMaxBound: Math.max(10, Math.ceil(maxPrice / 10) * 10),
    };
  },
  ["products-query-price-bounds"],
  { revalidate: 30 },
);

export async function queryProducts(
  params: ProductsQueryParams,
): Promise<ProductsQueryResult> {
  const {
    categoryParam = "",
    manufacturerParam = "",
    categories = [],
    manufacturers = [],
    priceMin,
    priceMax,
    searchQuery = "",
    sortBy = "featured",
    offset = 0,
    limit = 24,
  } = params;

  const hasSearchQuery = searchQuery.trim().length > 0;
  const [categoryMeta, priceBounds, synonyms, boostRules] = await Promise.all([
    getCachedCategoryMeta(),
    getPriceBoundsCached(),
    hasSearchQuery ? getCachedMainSearchSynonymMap() : Promise.resolve({}),
    hasSearchQuery ? getCachedMainSearchBoostRules() : Promise.resolve([]),
  ]);
  const categoryParents = new Map(categoryMeta.categoryHierarchy.parents);
  const childrenByParent = new Map(
    categoryMeta.categoryHierarchy.childrenByParent.map(([parentHandle, children]) => [
      parentHandle,
      new Map(children),
    ]),
  );
  const allCategoryTitles = new Map(categoryMeta.allCategoryTitles);
  const safePriceMin =
    Number.isFinite(priceMin) && typeof priceMin === "number"
      ? priceMin
      : priceBounds.priceMinBound;
  const safePriceMax =
    Number.isFinite(priceMax) && typeof priceMax === "number"
      ? priceMax
      : priceBounds.priceMaxBound;

  const mergedManufacturers = Array.from(
    new Set(
      [...manufacturers, ...manufacturerParam.split(",")]
        .map((value) => value.trim())
        .filter(Boolean)
    )
  );

  const normalizedCategoryParam = categoryParam.trim();
  const mergedCategories = Array.from(
    new Set(
      (categories.length ? categories : normalizedCategoryParam ? [normalizedCategoryParam] : [])
        .map((value) => value.trim())
        .filter(Boolean)
    )
  );

  const categoryWhereSql = buildCategoryWhereSql(mergedCategories);
  const manufacturerWhereSql = buildManufacturerWhereSql(mergedManufacturers);
  const searchWhereSql = buildSearchWhereSql(searchQuery, synonyms);
  const searchScoreSql = buildSearchScoreSql(searchQuery, synonyms);
  const searchBoostSql = buildSearchBoostSql(searchQuery, boostRules);
  const minPriceCents = Math.max(0, Math.round(safePriceMin * 100));
  const maxPriceCents = Math.max(minPriceCents, Math.round(safePriceMax * 100));
  const orderBySql = buildOrderBySql(sortBy, hasSearchQuery);

  const filteredRowsSql = Prisma.sql`
    WITH filtered_products AS (
      SELECT
        p.id,
        p.title,
        p."bestsellerScore",
        p."updatedAt",
        price_bounds.min_price_cents,
        ${searchScoreSql} AS search_score,
        ${searchBoostSql} AS search_boost,
        EXISTS (
          SELECT 1
          FROM "Variant" v2
          LEFT JOIN "VariantInventory" vi ON vi."variantId" = v2.id
          WHERE v2."productId" = p.id
            AND COALESCE(vi."quantityOnHand", 0) - COALESCE(vi.reserved, 0) > 0
        ) AS available_for_sale
      FROM "Product" p
      JOIN LATERAL (
        SELECT MIN(v."priceCents")::int AS min_price_cents
        FROM "Variant" v
        WHERE v."productId" = p.id
      ) price_bounds ON true
      WHERE p.status = 'ACTIVE'
        AND p.storefronts @> ${MAIN_STOREFRONT_SQL}
        AND price_bounds.min_price_cents IS NOT NULL
        AND price_bounds.min_price_cents >= ${minPriceCents}
        AND price_bounds.min_price_cents <= ${maxPriceCents}
        ${categoryWhereSql}
        ${manufacturerWhereSql}
        ${searchWhereSql}
    )
  `;

  const [countRow, pageRows] = await Promise.all([
    prisma.$queryRaw<Array<{ total: bigint | number }>>`
      ${filteredRowsSql}
      SELECT COUNT(*) AS total
      FROM filtered_products
    `,
    prisma.$queryRaw<Array<{ id: string }>>`
      ${filteredRowsSql}
      SELECT id
      FROM filtered_products
      ${orderBySql}
      OFFSET ${offset}
      LIMIT ${limit}
    `,
  ]);
  const pagedIds = pageRows.map((row) => row.id);
  const products = pagedIds.length ? await getProductsByIds(pagedIds) : [];
  const total = Number(countRow[0]?.total ?? 0);

  const activeCategory = normalizedCategoryParam;
  const availableCategories = (() => {
    const children = activeCategory && childrenByParent.get(activeCategory);
    if (children && children.size > 0) {
      return Array.from(children.entries()).sort((a, b) =>
        a[1].localeCompare(b[1]),
      );
    }
    return Array.from(categoryParents.entries()).sort((a, b) =>
      a[1].localeCompare(b[1]),
    );
  })();

  const availableManufacturersRows =
    await prisma.$queryRaw<Array<{ manufacturer: string | null }>>`
      SELECT DISTINCT p.manufacturer
      FROM "Product" p
      WHERE p.status = 'ACTIVE'
        AND p.storefronts @> ${MAIN_STOREFRONT_SQL}
        AND COALESCE(TRIM(p.manufacturer), '') <> ''
        ${buildCategoryWhereSql(mergedCategories)}
      ORDER BY p.manufacturer ASC
    `;
  const availableManufacturers = availableManufacturersRows
    .map((row) => row.manufacturer?.trim() ?? "")
    .filter(Boolean);

  return {
    products,
    total,
    priceMinBound: priceBounds.priceMinBound,
    priceMaxBound: priceBounds.priceMaxBound,
    availableCategories,
    availableManufacturers,
    allCategoryTitles: Array.from(allCategoryTitles.entries()),
  };
}
