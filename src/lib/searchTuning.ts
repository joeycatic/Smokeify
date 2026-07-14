import { unstable_cache } from "next/cache";
import type { ProductSearchSynonymMap } from "@/lib/productSearch";
import { normalizeProductSearchText } from "@/lib/productSearch";
import { prisma } from "@/lib/prisma";

const dedupeTerms = (values: string[]) => Array.from(new Set(values));

async function searchTuningTableExists(tableName: string) {
  if (!process.env.DATABASE_URL) return false;

  try {
    const rows = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT to_regclass(${`public."${tableName}"`}) IS NOT NULL AS "exists"
    `;
    return rows[0]?.exists === true;
  } catch {
    return false;
  }
}

export const getCachedMainSearchSynonymMap = unstable_cache(
  async (): Promise<ProductSearchSynonymMap> => {
    if (!(await searchTuningTableExists("SearchSynonymGroup"))) {
      return {};
    }

    const groups = await prisma.searchSynonymGroup
      .findMany({
        where: {
          isActive: true,
          OR: [{ storefronts: { has: "MAIN" } }, { storefronts: { isEmpty: true } }],
        },
        select: { terms: true },
        orderBy: { updatedAt: "desc" },
      })
      .catch(() => []);

    const map: ProductSearchSynonymMap = {};
    for (const group of groups) {
      const normalizedTerms = dedupeTerms(
        group.terms.map((term) => normalizeProductSearchText(term)).filter(Boolean),
      );
      for (const term of normalizedTerms) {
        map[term] = dedupeTerms(
          normalizedTerms.filter((candidate) => candidate !== term).concat(map[term] ?? []),
        );
      }
    }
    return map;
  },
  ["main-search-synonyms"],
  { revalidate: 300 },
);
export const getCachedMainSearchBoostRules = unstable_cache(
  async () => {
    if (!(await searchTuningTableExists("SearchBoostRule"))) {
      return [];
    }

    const rules = await prisma.searchBoostRule
      .findMany({
        where: {
          isActive: true,
          OR: [{ storefronts: { has: "MAIN" } }, { storefronts: { isEmpty: true } }],
        },
        select: {
          query: true,
          productId: true,
          boostScore: true,
        },
        orderBy: [{ boostScore: "desc" }, { updatedAt: "desc" }],
      })
      .catch(() => []);

    return rules.map((rule) => ({
      query: normalizeProductSearchText(rule.query),
      productId: rule.productId,
      boostScore: rule.boostScore,
    }));
  },
  ["main-search-boosts"],
  { revalidate: 300 },
);
