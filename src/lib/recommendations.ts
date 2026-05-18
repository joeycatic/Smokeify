import type { RecommendationRule, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  RecommendationRuleTargetCode,
  RecommendationRuleTriggerCode,
} from "@/lib/recommendationConfig";
import { buildStorefrontProductWhere, type StorefrontCode } from "@/lib/storefronts";

const DEFAULT_LIMIT = 12;
const MANUAL_OVERRIDE_SCORE = 10_000;
const RULE_SCORE_BASE = 5_000;
const CATEGORY_FALLBACK_SCORE = 1_000;
const BESTSELLER_FALLBACK_SCORE = 100;

type RecommendationProductRecord = {
  id: string;
  title: string;
  handle: string;
  status: string;
  tags: string[];
  productGroup: string | null;
  bestsellerScore: number | null;
  updatedAt: Date;
  images: Array<{ url: string; altText: string | null }>;
  variants: Array<{
    id: string;
    title: string;
    position: number;
    priceCents: number;
    inventory: { quantityOnHand: number; reserved: number } | null;
  }>;
};

type SourceProductContext = {
  id: string;
  title: string;
  handle: string;
  status: string;
  tags: string[];
  productGroup: string | null;
  categories: Array<{ id: string; handle: string; name: string }>;
  storefronts: string[];
};

type RecommendationReason =
  | {
      sourceType: "manual_override";
      label: string;
      detail: string;
      sortOrder: number;
    }
  | {
      sourceType: "rule";
      label: string;
      detail: string;
      ruleId: string;
      priority: number;
    }
  | {
      sourceType: "category_fallback";
      label: string;
      detail: string;
    }
  | {
      sourceType: "bestseller_fallback";
      label: string;
      detail: string;
    };

export type RecommendationResult = {
  id: string;
  title: string;
  handle: string;
  imageUrl: string | null;
  imageAlt: string | null;
  price: { amount: string; currencyCode: string } | null;
  variantId: string | null;
  availableForSale: boolean;
  reasons: RecommendationReason[];
  score: number;
};

export type RecommendationDebugRule = {
  id: string;
  name: string;
  triggerType: RecommendationRuleTriggerCode;
  triggerValue: string;
  targetType: RecommendationRuleTargetCode;
  targetValue: string;
  priority: number;
  matched: boolean;
};

export type RecommendationEngineResult = {
  product: {
    id: string;
    title: string;
    handle: string;
    tags: string[];
    productGroup: string | null;
    categories: Array<{ id: string; handle: string; name: string }>;
  };
  recommendations: RecommendationResult[];
  matchedRules: RecommendationDebugRule[];
};

const recommendationProductSelect = {
  id: true,
  title: true,
  handle: true,
  status: true,
  tags: true,
  productGroup: true,
  bestsellerScore: true,
  updatedAt: true,
  images: {
    orderBy: { position: "asc" },
    take: 1,
    select: { url: true, altText: true },
  },
  variants: {
    orderBy: { position: "asc" },
    select: {
      id: true,
      title: true,
      position: true,
      priceCents: true,
      inventory: { select: { quantityOnHand: true, reserved: true } },
    },
  },
} satisfies Prisma.ProductSelect;

const normalizeValue = (value: string | null | undefined) =>
  (value ?? "").trim().toLowerCase();

const toAmount = (cents: number) => (cents / 100).toFixed(2);

const availableQuantityForVariant = (variant: RecommendationProductRecord["variants"][number]) =>
  Math.max(0, (variant.inventory?.quantityOnHand ?? 0) - (variant.inventory?.reserved ?? 0));

const findFirstSellableVariant = (product: RecommendationProductRecord) =>
  product.variants.find((variant) => availableQuantityForVariant(variant) > 0) ?? null;

const productHasAvailability = (product: RecommendationProductRecord) =>
  product.variants.some((variant) => availableQuantityForVariant(variant) > 0);

const mapRecommendationProduct = (
  product: RecommendationProductRecord,
  reasons: RecommendationReason[],
  score: number,
): RecommendationResult => {
  const sellableVariant = findFirstSellableVariant(product);
  const priceVariant = sellableVariant ?? product.variants[0] ?? null;
  return {
    id: product.id,
    title: product.title,
    handle: product.handle,
    imageUrl: product.images[0]?.url ?? null,
    imageAlt: product.images[0]?.altText ?? product.title,
    price: priceVariant
      ? {
          amount: toAmount(priceVariant.priceCents),
          currencyCode: "EUR",
        }
      : null,
    variantId: sellableVariant?.id ?? null,
    availableForSale: Boolean(sellableVariant),
    reasons,
    score,
  };
};

const sourceProductSelect = {
  id: true,
  title: true,
  handle: true,
  status: true,
  tags: true,
  productGroup: true,
  storefronts: true,
  categories: {
    select: {
      category: {
        select: {
          id: true,
          handle: true,
          name: true,
        },
      },
    },
  },
} satisfies Prisma.ProductSelect;

const ruleMatchesSourceProduct = (
  rule: RecommendationRule,
  sourceProduct: SourceProductContext,
) => {
  if (!rule.isActive) return false;

  if (rule.triggerType === "CATEGORY") {
    const target = normalizeValue(rule.triggerValue);
    return sourceProduct.categories.some(
      (category) =>
        category.id === rule.triggerValue || normalizeValue(category.handle) === target,
    );
  }

  if (rule.triggerType === "TAG") {
    const target = normalizeValue(rule.triggerValue);
    return sourceProduct.tags.some((tag) => normalizeValue(tag) === target);
  }

  return normalizeValue(sourceProduct.productGroup) === normalizeValue(rule.triggerValue);
};

const buildRuleTargetWhere = (
  storefront: StorefrontCode,
  rule: RecommendationRule,
  sourceProductId: string,
  excludedIds: string[],
) => {
  const extra: Prisma.ProductWhereInput = {
    id: { notIn: [sourceProductId, ...excludedIds] },
  };

  if (rule.targetType === "CATEGORY") {
    const categoryHandle = normalizeValue(rule.targetValue);
    return buildStorefrontProductWhere(storefront, {
      AND: [
        extra,
        {
          categories: {
            some: {
              OR: [
                { categoryId: rule.targetValue },
                { category: { handle: categoryHandle } },
              ],
            },
          },
        },
      ],
    });
  }

  if (rule.targetType === "TAG") {
    return buildStorefrontProductWhere(storefront, {
      AND: [extra, { tags: { has: rule.targetValue } }],
    });
  }

  return buildStorefrontProductWhere(storefront, {
    AND: [extra, { productGroup: rule.targetValue }],
  });
};

const candidateOrderBy: Prisma.ProductOrderByWithRelationInput[] = [
  { bestsellerScore: { sort: "desc", nulls: "last" } },
  { updatedAt: "desc" },
];

export async function getProductRecommendations({
  productId,
  storefront = "MAIN",
  limit = DEFAULT_LIMIT,
}: {
  productId: string;
  storefront?: StorefrontCode;
  limit?: number;
}): Promise<RecommendationEngineResult | null> {
  const safeLimit = Math.max(1, Math.min(limit, 24));

  const [productRecord, activeRules, manualOverrides] = await Promise.all([
    prisma.product.findUnique({
      where: { id: productId },
      select: sourceProductSelect,
    }),
    prisma.recommendationRule.findMany({
      where: { isActive: true },
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    }),
    prisma.productCrossSell.findMany({
      where: {
        productId,
        crossSell: {
          is: buildStorefrontProductWhere(storefront),
        },
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      include: {
        crossSell: {
          select: recommendationProductSelect,
        },
      },
    }),
  ]);

  if (!productRecord) return null;
  if (productRecord.status !== "ACTIVE") return null;
  if (!productRecord.storefronts.includes(storefront)) return null;

  const sourceProduct: SourceProductContext = {
    id: productRecord.id,
    title: productRecord.title,
    handle: productRecord.handle,
    status: productRecord.status,
    tags: productRecord.tags ?? [],
    productGroup: productRecord.productGroup ?? null,
    storefronts: productRecord.storefronts,
    categories: productRecord.categories.map((entry) => entry.category),
  };

  const matchedRules = activeRules.map((rule) => ({
    id: rule.id,
    name: rule.name,
    triggerType: rule.triggerType as RecommendationRuleTriggerCode,
    triggerValue: rule.triggerValue,
    targetType: rule.targetType as RecommendationRuleTargetCode,
    targetValue: rule.targetValue,
    priority: rule.priority,
    matched: ruleMatchesSourceProduct(rule, sourceProduct),
  }));

  const resultMap = new Map<
    string,
    {
      product: RecommendationProductRecord;
      reasons: RecommendationReason[];
      score: number;
    }
  >();

  const pushCandidate = ({
    product,
    reason,
    score,
  }: {
    product: RecommendationProductRecord;
    reason: RecommendationReason;
    score: number;
  }) => {
    if (product.id === sourceProduct.id) return;
    if (product.status !== "ACTIVE") return;
    if (!productHasAvailability(product)) return;

    const existing = resultMap.get(product.id);
    if (!existing) {
      resultMap.set(product.id, {
        product,
        reasons: [reason],
        score,
      });
      return;
    }

    const reasonAlreadyExists = existing.reasons.some((entry) => JSON.stringify(entry) === JSON.stringify(reason));
    existing.score = Math.max(existing.score, score);
    if (!reasonAlreadyExists) {
      existing.reasons.push(reason);
    }
  };

  manualOverrides.forEach((row) => {
    pushCandidate({
      product: row.crossSell,
      score: MANUAL_OVERRIDE_SCORE - row.sortOrder,
      reason: {
        sourceType: "manual_override",
        label: "Manual override",
        detail: `Legacy cross-sell override with sort order ${row.sortOrder + 1}.`,
        sortOrder: row.sortOrder,
      },
    });
  });

  const effectiveRules = matchedRules.filter((rule) => rule.matched);
  for (const matchedRule of effectiveRules) {
    const rule = activeRules.find((entry) => entry.id === matchedRule.id);
    if (!rule) continue;
    const candidates = await prisma.product.findMany({
      where: buildRuleTargetWhere(
        storefront,
        rule,
        sourceProduct.id,
        Array.from(resultMap.keys()),
      ),
      orderBy: candidateOrderBy,
      take: Math.min(rule.maxProducts ?? safeLimit, Math.max(safeLimit * 2, 6)),
      select: recommendationProductSelect,
    });

    candidates.slice(0, rule.maxProducts ?? candidates.length).forEach((candidate) => {
      pushCandidate({
        product: candidate,
        score: RULE_SCORE_BASE + rule.priority,
        reason: {
          sourceType: "rule",
          label: rule.name,
          detail: `${rule.triggerType} "${rule.triggerValue}" -> ${rule.targetType} "${rule.targetValue}"`,
          ruleId: rule.id,
          priority: rule.priority,
        },
      });
    });
  }

  if (resultMap.size < safeLimit && sourceProduct.categories.length > 0) {
    const fallbackCandidates = await prisma.product.findMany({
      where: buildStorefrontProductWhere(storefront, {
        AND: [
          {
            id: {
              notIn: [sourceProduct.id, ...Array.from(resultMap.keys())],
            },
          },
          {
            categories: {
              some: {
                categoryId: { in: sourceProduct.categories.map((category) => category.id) },
              },
            },
          },
        ],
      }),
      orderBy: candidateOrderBy,
      take: Math.max(safeLimit, 12),
      select: recommendationProductSelect,
    });

    fallbackCandidates.forEach((candidate) => {
      pushCandidate({
        product: candidate,
        score: CATEGORY_FALLBACK_SCORE,
        reason: {
          sourceType: "category_fallback",
          label: "Shared category fallback",
          detail: "No higher-priority match filled this slot, so a same-category product was used.",
        },
      });
    });
  }

  if (resultMap.size < safeLimit) {
    const bestsellerFallback = await prisma.product.findMany({
      where: buildStorefrontProductWhere(storefront, {
        id: { notIn: [sourceProduct.id, ...Array.from(resultMap.keys())] },
      }),
      orderBy: candidateOrderBy,
      take: Math.max(safeLimit, 12),
      select: recommendationProductSelect,
    });

    bestsellerFallback.forEach((candidate) => {
      pushCandidate({
        product: candidate,
        score: BESTSELLER_FALLBACK_SCORE,
        reason: {
          sourceType: "bestseller_fallback",
          label: "Catalog fallback",
          detail: "Catalog bestseller fallback preserved for backward compatibility.",
        },
      });
    });
  }

  const recommendations = Array.from(resultMap.values())
    .sort((left, right) => {
      if (left.score !== right.score) return right.score - left.score;
      const leftBestSeller = left.product.bestsellerScore ?? Number.NEGATIVE_INFINITY;
      const rightBestSeller = right.product.bestsellerScore ?? Number.NEGATIVE_INFINITY;
      if (leftBestSeller !== rightBestSeller) return rightBestSeller - leftBestSeller;
      return right.product.updatedAt.getTime() - left.product.updatedAt.getTime();
    })
    .slice(0, safeLimit)
    .map((entry) => mapRecommendationProduct(entry.product, entry.reasons, entry.score));

  return {
    product: {
      id: sourceProduct.id,
      title: sourceProduct.title,
      handle: sourceProduct.handle,
      tags: sourceProduct.tags,
      productGroup: sourceProduct.productGroup,
      categories: sourceProduct.categories,
    },
    recommendations,
    matchedRules,
  };
}
