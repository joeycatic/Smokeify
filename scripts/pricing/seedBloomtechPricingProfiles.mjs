import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEFAULT_SUPPLIER_NAME = "Bloomtech";
const DEFAULT_SUPPLIER_URL = "https://bloomtech.de";
const DEFAULT_PRODUCT_SEGMENT = "CORE";
const DEFAULT_PAYMENT_FEE_PERCENT_BPS = 150;
const DEFAULT_PAYMENT_FIXED_FEE_CENTS = 25;
const DEFAULT_RETURN_RISK_BUFFER_BPS = 300;
const DEFAULT_TARGET_MARGIN_BPS = 2500;
const DEFAULT_COMPETITOR_RELIABILITY = 0.65;
const DEFAULT_COMPETITOR_SOURCE_LABEL = "Bloomtech public guest price";

const parseArgs = () => {
  const args = process.argv.slice(2);
  const getValue = (flag) => {
    const index = args.indexOf(flag);
    if (index === -1) return null;
    return args[index + 1] ?? null;
  };

  return {
    apply: args.includes("--apply"),
    limit: getValue("--limit"),
    overwrite: args.includes("--overwrite"),
    scrapeGuestPrice: args.includes("--scrape-guest-price"),
  };
};

const parseInteger = (value, label, fallback = null) => {
  if (value === null || typeof value === "undefined" || value === "") {
    return fallback;
  }
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid integer for ${label}: ${value}`);
  }
  return parsed;
};

const parseFloatNumber = (value, label, fallback = null) => {
  if (value === null || typeof value === "undefined" || value === "") {
    return fallback;
  }
  const parsed = Number.parseFloat(String(value).replace(",", "."));
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid number for ${label}: ${value}`);
  }
  return parsed;
};

const normalizeBoolean = (value, fallback) => {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return fallback;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on", "enabled"].includes(normalized)) return true;
  if (["0", "false", "no", "off", "disabled"].includes(normalized)) return false;
  return fallback;
};

const normalizeSegment = (value) => {
  const normalized = String(value ?? DEFAULT_PRODUCT_SEGMENT)
    .trim()
    .toUpperCase();
  if (!["TRAFFIC_DRIVER", "CORE", "PREMIUM", "CLEARANCE"].includes(normalized)) {
    throw new Error(`Invalid pricing segment: ${value}`);
  }
  return normalized;
};

const resolveSupplier = async () => {
  const supplierId = process.env.BLOOMTECH_SUPPLIER_ID ?? null;
  const supplierName = process.env.BLOOMTECH_SUPPLIER_NAME ?? DEFAULT_SUPPLIER_NAME;

  if (supplierId) {
    const supplier = await prisma.supplier.findUnique({
      where: { id: supplierId },
      select: { id: true, name: true },
    });
    if (!supplier) {
      throw new Error(`Supplier not found for id=${supplierId}`);
    }
    return supplier;
  }

  const supplier = await prisma.supplier.findUnique({
    where: { name: supplierName },
    select: { id: true, name: true },
  });

  return supplier;
};

const buildBloomtechFilter = ({ supplierId, sellerName, sellerHost }) => ({
  OR: [
    ...(supplierId ? [{ supplierId }] : []),
    { supplier: { equals: sellerName, mode: "insensitive" } },
    { sellerName: { equals: sellerName, mode: "insensitive" } },
    { sellerUrl: { contains: sellerHost, mode: "insensitive" } },
  ],
});

const resolveRequiredTemplate = () => {
  const template = {
    supplierShippingCostCents: parseInteger(
      process.env.PRICING_PROFILE_SUPPLIER_SHIPPING_CENTS,
      "PRICING_PROFILE_SUPPLIER_SHIPPING_CENTS"
    ),
    inboundShippingCostCents: parseInteger(
      process.env.PRICING_PROFILE_INBOUND_SHIPPING_CENTS,
      "PRICING_PROFILE_INBOUND_SHIPPING_CENTS"
    ),
    packagingCostCents: parseInteger(
      process.env.PRICING_PROFILE_PACKAGING_CENTS,
      "PRICING_PROFILE_PACKAGING_CENTS"
    ),
    handlingCostCents: parseInteger(
      process.env.PRICING_PROFILE_HANDLING_CENTS,
      "PRICING_PROFILE_HANDLING_CENTS"
    ),
    paymentFeePercentBasisPoints: parseInteger(
      process.env.PRICING_PROFILE_PAYMENT_FEE_PERCENT_BPS,
      "PRICING_PROFILE_PAYMENT_FEE_PERCENT_BPS",
      DEFAULT_PAYMENT_FEE_PERCENT_BPS
    ),
    paymentFixedFeeCents: parseInteger(
      process.env.PRICING_PROFILE_PAYMENT_FIXED_FEE_CENTS,
      "PRICING_PROFILE_PAYMENT_FIXED_FEE_CENTS",
      DEFAULT_PAYMENT_FIXED_FEE_CENTS
    ),
    returnRiskBufferBasisPoints: parseInteger(
      process.env.PRICING_PROFILE_RETURN_BUFFER_BPS,
      "PRICING_PROFILE_RETURN_BUFFER_BPS",
      DEFAULT_RETURN_RISK_BUFFER_BPS
    ),
    targetMarginBasisPoints: parseInteger(
      process.env.PRICING_PROFILE_TARGET_MARGIN_BPS,
      "PRICING_PROFILE_TARGET_MARGIN_BPS",
      DEFAULT_TARGET_MARGIN_BPS
    ),
    productSegment: normalizeSegment(process.env.PRICING_PROFILE_SEGMENT),
    autoRepriceEnabled: normalizeBoolean(
      process.env.PRICING_PROFILE_AUTO_REPRICE_ENABLED,
      true
    ),
  };

  const missingRequired = [
    "supplierShippingCostCents",
    "inboundShippingCostCents",
    "packagingCostCents",
    "handlingCostCents",
  ].filter((key) => typeof template[key] !== "number");

  if (missingRequired.length > 0) {
    throw new Error(
      `Missing required pricing profile defaults: ${missingRequired.join(", ")}. ` +
        "Set PRICING_PROFILE_SUPPLIER_SHIPPING_CENTS, PRICING_PROFILE_INBOUND_SHIPPING_CENTS, " +
        "PRICING_PROFILE_PACKAGING_CENTS, and PRICING_PROFILE_HANDLING_CENTS."
    );
  }

  return template;
};

// Pricing competitor data must come from the public Bloomtech storefront view.
// This request intentionally carries no auth headers, no cookies, and no login state.
const fetchGuestHtml = async (url) => {
  const response = await fetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (compatible; SmokeifyPricingProfileSeed/1.0; +https://smokeify.local)",
      "accept-language": "de-DE,de;q=0.9,en;q=0.8",
    },
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.text();
};

const extractGuestGrossPriceCents = (html) => {
  const match = html.match(
    /<meta[^>]*itemprop=["']price["'][^>]*content=["']([^"']+)["'][^>]*>/i
  );
  if (!match) return null;

  const basePrice = Number.parseFloat(match[1].replace(",", "."));
  if (!Number.isFinite(basePrice)) return null;

  // Bloomtech public product pages expose the guest-facing gross price in markup.
  return Math.round(basePrice * 100);
};

const buildUpdateData = ({
  existingProfile,
  template,
  overwrite,
  competitorSnapshot,
}) => {
  const nextData = {};

  const assign = (key, value) => {
    if (overwrite || existingProfile?.[key] === null || typeof existingProfile?.[key] === "undefined") {
      nextData[key] = value;
    }
  };

  assign("supplierShippingCostCents", template.supplierShippingCostCents);
  assign("inboundShippingCostCents", template.inboundShippingCostCents);
  assign("packagingCostCents", template.packagingCostCents);
  assign("handlingCostCents", template.handlingCostCents);
  assign("paymentFeePercentBasisPoints", template.paymentFeePercentBasisPoints);
  assign("paymentFixedFeeCents", template.paymentFixedFeeCents);
  assign("returnRiskBufferBasisPoints", template.returnRiskBufferBasisPoints);
  assign("targetMarginBasisPoints", template.targetMarginBasisPoints);
  assign("productSegment", template.productSegment);
  assign("autoRepriceEnabled", template.autoRepriceEnabled);

  if (competitorSnapshot) {
    assign("competitorMinPriceCents", competitorSnapshot.priceCents);
    assign("competitorAveragePriceCents", competitorSnapshot.priceCents);
    assign("competitorObservedAt", competitorSnapshot.observedAt);
    assign("competitorSourceLabel", competitorSnapshot.sourceLabel);
    assign("competitorSourceCount", 1);
    assign(
      "competitorReliabilityScore",
      competitorSnapshot.reliabilityScore
    );
  }

  return nextData;
};

const run = async () => {
  const { apply, limit, overwrite, scrapeGuestPrice } = parseArgs();
  const allowWrite = process.env.PRICING_PROFILE_SEED_ALLOW_WRITE === "1";
  const limitValue = parseInteger(limit, "--limit", 0);
  const sellerName = process.env.BLOOMTECH_SELLER_NAME ?? DEFAULT_SUPPLIER_NAME;
  const sellerUrl = process.env.BLOOMTECH_SELLER_URL ?? DEFAULT_SUPPLIER_URL;
  const sellerHost = new URL(sellerUrl).hostname.toLowerCase();
  const supplier = await resolveSupplier();
  const template = resolveRequiredTemplate();
  const competitorReliabilityScore = parseFloatNumber(
    process.env.PRICING_PROFILE_COMPETITOR_RELIABILITY,
    "PRICING_PROFILE_COMPETITOR_RELIABILITY",
    DEFAULT_COMPETITOR_RELIABILITY
  );
  const competitorSourceLabel =
    process.env.PRICING_PROFILE_COMPETITOR_SOURCE_LABEL ??
    DEFAULT_COMPETITOR_SOURCE_LABEL;

  if (!apply || !allowWrite) {
    console.log(
      "[pricing-profile-seed] Dry run only. Set PRICING_PROFILE_SEED_ALLOW_WRITE=1 and pass --apply to write."
    );
  }
  if (scrapeGuestPrice) {
    console.log(
      "[pricing-profile-seed] Competitor sync uses Bloomtech public guest pages only. No login or cookie state is used."
    );
  }

  const products = await prisma.product.findMany({
    where: buildBloomtechFilter({
      supplierId: supplier?.id ?? null,
      sellerName,
      sellerHost,
    }),
    orderBy: { handle: "asc" },
    take: limitValue > 0 ? limitValue : undefined,
    select: {
      id: true,
      title: true,
      handle: true,
      sellerUrl: true,
      variants: {
        orderBy: { position: "asc" },
        select: {
          id: true,
          title: true,
          sku: true,
          pricingProfile: true,
        },
      },
    },
  });

  const summary = {
    products: products.length,
    variants: 0,
    changedVariants: 0,
    createdProfiles: 0,
    updatedProfiles: 0,
    unchangedVariants: 0,
    competitorSynced: 0,
    competitorSkipped: 0,
  };

  for (const product of products) {
    let competitorSnapshot = null;

    if (scrapeGuestPrice) {
      if (!product.sellerUrl) {
        summary.competitorSkipped += product.variants.length;
      } else {
        try {
          const html = await fetchGuestHtml(product.sellerUrl);
          const guestPriceCents = extractGuestGrossPriceCents(html);
          if (guestPriceCents !== null) {
            competitorSnapshot = {
              priceCents: guestPriceCents,
              observedAt: new Date(),
              sourceLabel: competitorSourceLabel,
              reliabilityScore: competitorReliabilityScore,
            };
          } else {
            summary.competitorSkipped += product.variants.length;
          }
        } catch (error) {
          console.warn(
            `[pricing-profile-seed] competitor skip handle=${product.handle} reason=${error instanceof Error ? error.message : "unknown"}`
          );
          summary.competitorSkipped += product.variants.length;
        }
      }
    }

    for (const variant of product.variants) {
      summary.variants += 1;
      const updateData = buildUpdateData({
        existingProfile: variant.pricingProfile,
        template,
        overwrite,
        competitorSnapshot,
      });

      const changedKeys = Object.keys(updateData);
      if (changedKeys.length === 0) {
        summary.unchangedVariants += 1;
        continue;
      }

      summary.changedVariants += 1;
      if (competitorSnapshot) {
        summary.competitorSynced += 1;
      }

      const kind = variant.pricingProfile ? "update" : "create";
      if (variant.pricingProfile) {
        summary.updatedProfiles += 1;
      } else {
        summary.createdProfiles += 1;
      }
      const previewDetails = changedKeys
        .map((key) => `${key}=${updateData[key] instanceof Date ? updateData[key].toISOString() : updateData[key]}`)
        .join(" ");

      console.log(
        `[pricing-profile-seed] ${kind} handle=${product.handle} variant="${variant.title}" sku=${variant.sku ?? "-"} ${previewDetails}`
      );

      if (!apply || !allowWrite) {
        continue;
      }

      await prisma.variantPricingProfile.upsert({
        where: { variantId: variant.id },
        update: updateData,
        create: {
          variantId: variant.id,
          ...template,
          ...(competitorSnapshot
            ? {
                competitorMinPriceCents: competitorSnapshot.priceCents,
                competitorAveragePriceCents: competitorSnapshot.priceCents,
                competitorObservedAt: competitorSnapshot.observedAt,
                competitorSourceLabel: competitorSnapshot.sourceLabel,
                competitorSourceCount: 1,
                competitorReliabilityScore: competitorSnapshot.reliabilityScore,
              }
            : {}),
        },
      });

    }
  }

  console.log(
    `[pricing-profile-seed] summary products=${summary.products} variants=${summary.variants} changed=${summary.changedVariants} created=${summary.createdProfiles} updated=${summary.updatedProfiles} unchanged=${summary.unchangedVariants} competitorSynced=${summary.competitorSynced} competitorSkipped=${summary.competitorSkipped}`
  );
};

run()
  .catch((error) => {
    console.error("[pricing-profile-seed] Failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
