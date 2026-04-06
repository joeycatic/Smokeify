import "server-only";

import fs from "node:fs/promises";
import path from "node:path";
import { Prisma, type PrismaClient } from "@prisma/client";
import { extractCompetitorPagePricingFromHtml } from "../../scripts/shared/extractCompetitorPagePrice.mjs";

const BLOOMTECH_HOST = "bloomtech.de";
const BLOOMTECH_NAME = "bloomtech";
const DEFAULT_PUBLIC_SOURCE_LABEL = "Bloomtech public guest price";
const DEFAULT_MARKET_SOURCE_LABEL = "Market report";
const DEFAULT_PUBLIC_RELIABILITY = 0.85;
const DEFAULT_MARKET_REPORT_PATH = "scripts/market/shops-price-report.json";

type PricingVariantScope = {
  id: string;
  productId: string;
  title: string;
  sku: string | null;
  pricingProfile: unknown | null;
  product: {
    id: string;
    handle: string;
    title: string;
    sellerUrl: string | null;
    sellerName: string | null;
    supplier: string | null;
  };
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const isBloomtechProduct = (variant: PricingVariantScope) => {
  const sellerUrl = variant.product.sellerUrl?.toLowerCase() ?? "";
  const sellerName = variant.product.sellerName?.toLowerCase() ?? "";
  const supplier = variant.product.supplier?.toLowerCase() ?? "";
  return (
    sellerUrl.includes(BLOOMTECH_HOST) ||
    sellerName.includes(BLOOMTECH_NAME) ||
    supplier.includes(BLOOMTECH_NAME)
  );
};

const buildProfileCreateData = (variantId: string) => ({
  variantId,
  productSegment: "CORE" as const,
  autoRepriceEnabled: true,
});

const fetchGuestHtml = async (url: string) => {
  const response = await fetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (compatible; SmokeifyPricingAutomation/1.0; +https://smokeify.local)",
      "accept-language": "de-DE,de;q=0.9,en;q=0.8",
    },
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.text();
};

const toReportReliability = (
  sampledShops: number,
  totalShops: number,
  blockedShops: number
) => {
  const coverageBase =
    totalShops > 0 ? sampledShops / totalShops : sampledShops > 0 ? 1 : 0;
  const blockedPenalty =
    totalShops > 0 ? blockedShops / totalShops : blockedShops > 0 ? 0.25 : 0;
  return Number(
    clamp(coverageBase + 0.25 - blockedPenalty * 0.5, 0.35, 0.95).toFixed(2)
  );
};

export async function refreshBloomtechPublicCompetitorData(
  db: PrismaClient,
  variants: PricingVariantScope[],
  now = new Date()
) {
  const scopedProducts = new Map<string, PricingVariantScope[]>();
  for (const variant of variants) {
    if (!isBloomtechProduct(variant) || !variant.product.sellerUrl) continue;
    const existing = scopedProducts.get(variant.productId) ?? [];
    existing.push(variant);
    scopedProducts.set(variant.productId, existing);
  }

  let productsRefreshed = 0;
  let variantsUpdated = 0;
  let skipped = 0;

  for (const productVariants of scopedProducts.values()) {
    const product = productVariants[0]?.product;
    if (!product?.sellerUrl) {
      skipped += productVariants.length;
      continue;
    }

    try {
      const html = await fetchGuestHtml(product.sellerUrl);
      const pricing = extractCompetitorPagePricingFromHtml(html);
      if (pricing.priceCents === null) {
        skipped += productVariants.length;
        continue;
      }

      productsRefreshed += 1;
      const profilePatch = {
        competitorMinPriceCents: pricing.priceCents,
        competitorAveragePriceCents: pricing.priceCents,
        competitorHighPriceCents: pricing.priceCents,
        publicCompareAtCents: pricing.compareAtCents,
        competitorObservedAt: now,
        competitorSourceLabel: DEFAULT_PUBLIC_SOURCE_LABEL,
        competitorSourceCount: 1,
        competitorReliabilityScore: DEFAULT_PUBLIC_RELIABILITY,
      } satisfies Prisma.VariantPricingProfileUncheckedUpdateInput;
      await db.$transaction(
        productVariants.map((variant) =>
          db.variantPricingProfile.upsert({
            where: { variantId: variant.id },
            update: profilePatch,
            create: {
              ...buildProfileCreateData(variant.id),
              ...profilePatch,
            },
          })
        )
      );
      variantsUpdated += productVariants.length;
    } catch {
      skipped += productVariants.length;
    }
  }

  return {
    productsRefreshed,
    variantsUpdated,
    skipped,
  };
}

export async function importMarketReportCompetitorData(
  db: PrismaClient,
  variants: PricingVariantScope[],
  reportPath = DEFAULT_MARKET_REPORT_PATH
) {
  const resolvedPath = path.isAbsolute(reportPath)
    ? reportPath
    : path.resolve(process.cwd(), reportPath);
  const raw = await fs.readFile(resolvedPath, "utf8");
  const parsed = JSON.parse(raw) as {
    generatedAt?: string;
    provider?: string;
    results?: Array<{
      handle?: string;
      status?: string;
      lowest?: number;
      average?: number;
      highest?: number;
      sampledShops?: number;
      totalShops?: number;
      blockedShops?: number;
    }>;
  };

  const reportDate = parsed.generatedAt ? new Date(parsed.generatedAt) : new Date();
  const sourceLabel = parsed.provider
    ? `${DEFAULT_MARKET_SOURCE_LABEL}: ${parsed.provider}`
    : DEFAULT_MARKET_SOURCE_LABEL;
  const reportByHandle = new Map(
    (parsed.results ?? [])
      .filter(
        (item) =>
          item.status === "ok" &&
          typeof item.handle === "string" &&
          typeof item.average === "number"
      )
      .map((item) => [item.handle!, item])
  );

  let variantsUpdated = 0;
  let skipped = 0;

  for (const variant of variants) {
    const reportRow = reportByHandle.get(variant.product.handle);
    if (!reportRow) {
      skipped += 1;
      continue;
    }

    const reliability = toReportReliability(
      reportRow.sampledShops ?? 0,
      reportRow.totalShops ?? reportRow.sampledShops ?? 0,
      reportRow.blockedShops ?? 0
    );
    const averageCents =
      typeof reportRow.average === "number"
        ? Math.round(reportRow.average * 100)
        : null;
    if (averageCents === null) {
      skipped += 1;
      continue;
    }
    const profilePatch = {
      competitorMinPriceCents:
        typeof reportRow.lowest === "number"
          ? Math.round(reportRow.lowest * 100)
          : null,
      competitorAveragePriceCents: averageCents,
      competitorHighPriceCents:
        typeof reportRow.highest === "number"
          ? Math.round(reportRow.highest * 100)
          : null,
      competitorObservedAt: reportDate,
      competitorSourceLabel: sourceLabel,
      competitorSourceCount: reportRow.sampledShops ?? null,
      competitorReliabilityScore: reliability,
    } satisfies Prisma.VariantPricingProfileUncheckedUpdateInput;

    await db.variantPricingProfile.upsert({
      where: { variantId: variant.id },
      update: profilePatch,
      create: {
        ...buildProfileCreateData(variant.id),
        ...profilePatch,
      },
    });
    variantsUpdated += 1;
  }

  return {
    reportPath: resolvedPath,
    variantsUpdated,
    skipped,
  };
}

export { DEFAULT_MARKET_REPORT_PATH };
