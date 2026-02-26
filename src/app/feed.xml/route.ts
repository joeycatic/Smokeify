import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const DEFAULT_SITE_URL = "https://www.smokeify.de";

const resolveFeedSiteUrl = () => {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!raw) return DEFAULT_SITE_URL;
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase();
    const isLocalHost =
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "::1" ||
      host.endsWith(".local");
    return isLocalHost ? DEFAULT_SITE_URL : `${url.protocol}//${url.host}`;
  } catch {
    return DEFAULT_SITE_URL;
  }
};

const SITE_URL = resolveFeedSiteUrl();

const GOOGLE_FEED_EXCLUDED_CATEGORY_HANDLES = new Set([
  "headshop",
  "aschenbecher",
  "aufbewahrung",
  "bongs",
  "feuerzeuge",
  "grinder",
  "kraeuterschale",
  "papers",
  "pipes",
  "rolling-tray",
  "tubes",
  "vaporizer",
  "waagen",
]);

const GOOGLE_FEED_FORCE_INCLUDE_HANDLES = new Set<string>();
const GOOGLE_FEED_FORCE_INCLUDE_CATEGORY_HANDLES = new Set([
  "licht",
  "abwasser",
]);
const GOOGLE_FEED_SAFE_CATEGORY_HANDLES = new Set([
  "licht",
  "abwasser",
  "growbox",
  "belueftung",
  "lueftung",
  "abluft",
  "bewaesserung",
  "hydroponik",
  "substrat",
  "duenger",
  "naehrstoffe",
  "ventilator",
  "aktivkohlefilter",
  "zeitschaltuhr",
]);
const GOOGLE_FEED_SAFE_TERMS = [
  "indoor-gartenbau",
  "indoor gaertnerei",
  "indoor gardening",
  "pflanzenzucht",
  "heimgarten",
  "growbox",
  "beleuchtung",
  "lueftung",
  "abluft",
  "abwasser",
  "bewaesserung",
  "hydroponik",
  "substrat",
  "naehrstoff",
  "duenger",
  "ventilator",
  "filter",
];

const HEADSHOP_SIGNAL_TERMS = [
  "headshop",
  "bong",
  "bongs",
  "pipe",
  "pipes",
  "grinder",
  "grinders",
  "papers",
  "rolling-tray",
  "vaporizer",
  "tubes",
  "kraeuterschale",
  "hash-bowl",
  "stash",
];

const GOOGLE_FEED_BLOCKED_TERMS = [
  "papers",
  "paper",
  "rolling",
  "joint",
  "rauchen",
  "smoking",
  "bong",
  "pipe",
  "grinder",
  "vape",
  "vaporizer",
  "stash",
];

const GOOGLE_FEED_BLOCKED_TITLE_PATTERNS: RegExp[] = [
  /papers?/i,
  /\braw\b/i,
  /bong/i,
  /\bpipe\b/i,
  /grinder/i,
  /vape/i,
  /\bsmoke\b/i,
  /joint/i,
  /biobizz/i,
  /topmax/i,
  /fishmix/i,
  /root juice/i,
  /calmag/i,
  /alg-a-mic/i,
  /acti vera/i,
  /bio heaven/i,
  /bio-bloom/i,
  /microbes/i,
  /rezin/i,
  /vbx/i,
  /alfa boost/i,
];

const FEED_KEYWORD_REPLACEMENTS: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /\bheadshop\b/gi, replacement: "Indoor-Gaertnerei" },
  { pattern: /\bsmok(?:e|ing)\b/gi, replacement: "Heimgarten" },
  { pattern: /\brauch(?:en|er|zubehoer|zubehör)?\b/gi, replacement: "Pflanzenzucht" },
  { pattern: /\bjoint(?:s)?\b/gi, replacement: "Pflanzenzucht" },
  { pattern: /\bbong(?:s)?\b/gi, replacement: "Indoor-Gaertnerei" },
  { pattern: /\bpipe(?:s)?\b/gi, replacement: "Indoor-Gaertnerei" },
  { pattern: /\bvape(?:r|s|n|d)?\b/gi, replacement: "Heimgarten" },
  { pattern: /\bvaporizer\b/gi, replacement: "Indoor-Gaertnerei" },
];

type GoogleFeedExclusionCheck = {
  excluded: boolean;
  forceIncluded: boolean;
  matchedCategoryHandles: string[];
  matchedSignalTerms: string[];
  matchedBlockedTerms: string[];
  reasons: string[];
};

const escapeXml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const stripHtml = (value: string) => value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

const sanitizeFeedKeywordHygiene = (value: string) => {
  let sanitized = value;
  for (const entry of FEED_KEYWORD_REPLACEMENTS) {
    sanitized = sanitized.replace(entry.pattern, entry.replacement);
  }
  return sanitized.replace(/\s+/g, " ").trim();
};

const GENERIC_BRAND_VALUES = new Set([
  "smokeify",
  "bloomtech",
  "b2b headshop",
  "indoor-gartenbau shop",
  "indoor gartenbau shop",
  "growshop",
]);

const normalizeBrandName = (value: string | null | undefined) => {
  if (!value) return "";
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  const lower = normalized.toLowerCase();
  if (GENERIC_BRAND_VALUES.has(lower)) return "";
  if (lower.replace(/[\s-]/g, "").includes("growshop")) return "";
  return normalized;
};

const inferBrandFromTitle = (title: string) => {
  const cleaned = title.replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  const knownPrefixes = [
    "AC Infinity",
    "Secret Jardin",
    "G-Tools",
    "BioBizz",
    "Advanced Nutrients",
    "Athena",
    "Canna",
    "Plagron",
  ];
  const lower = cleaned.toLowerCase();
  for (const brand of knownPrefixes) {
    if (lower.startsWith(brand.toLowerCase())) return brand;
  }
  const firstToken = cleaned.split(/[^\p{L}\p{N}\-]+/u).find(Boolean) ?? "";
  return normalizeBrandName(firstToken);
};

const resolveFeedBrand = (product: {
  manufacturer: string | null;
  title: string;
}) => {
  const fromManufacturer = normalizeBrandName(product.manufacturer);
  if (fromManufacturer) return fromManufacturer;
  const fromTitle = inferBrandFromTitle(product.title);
  if (fromTitle) return fromTitle;
  return "Unknown";
};

const normalizeGtin = (value: string) => {
  const digits = value.replace(/\D/g, "");
  if (![8, 12, 13, 14].includes(digits.length)) return "";
  return digits;
};

const extractGtinFromTechnicalDetails = (technicalDetails: string | null) => {
  if (!technicalDetails) return "";
  const match = technicalDetails.match(
    /(?:^|;\s*)(?:GTIN|EAN|EAN-13)\s*:\s*([0-9][0-9\s-]{6,20})/i
  );
  if (!match) return "";
  return normalizeGtin(match[1] ?? "");
};

const dedupeRepeatedSentences = (value: string) => {
  const sentences = value
    .split(/(?<=[.!?])\s+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const sentence of sentences) {
    const key = sentence.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(sentence);
  }
  return unique.join(" ").trim();
};

const isFeedVariantAllowed = (title: string) =>
  !GOOGLE_FEED_BLOCKED_TITLE_PATTERNS.some((pattern) => pattern.test(title));

const sanitizeDescriptionForGoogleFeed = (raw: string) => {
  const normalized = sanitizeFeedKeywordHygiene(
    dedupeRepeatedSentences(stripHtml(raw)).replace(/\s+/g, " ").trim()
  );
  if (!normalized) return "Hochwertiges Zubehoer fuer den Indoor-Gartenbau.";
  return normalized.length > 5000 ? normalized.slice(0, 5000) : normalized;
};

type GoogleFeedCategoryMapping = {
  googleProductCategory: string | null;
  productType: string | null;
};

const DEFAULT_GOOGLE_PRODUCT_CATEGORY = "Home & Garden > Lawn & Garden > Gardening";
const DEFAULT_PRODUCT_TYPE = "Indoor-Gartenbau > Allgemein";

const GOOGLE_FEED_PRODUCT_OVERRIDES: Record<string, GoogleFeedCategoryMapping> = {
  "ac-infinity-aktivkohlefilter-150mm": {
    googleProductCategory: "Home & Garden > Lawn & Garden > Gardening",
    productType: "Indoor-Gartenbau > Gartentechnik > Lufttechnik > Aktivkohlefilter",
  },
  "ac-infinity-aktivkohlefilter-100mm": {
    googleProductCategory: "Home & Garden > Lawn & Garden > Gardening",
    productType: "Indoor-Gartenbau > Gartentechnik > Lufttechnik > Aktivkohlefilter",
  },
  "ac-infinity-aktivkohlefilter-200mm": {
    googleProductCategory: "Home & Garden > Lawn & Garden > Gardening",
    productType: "Indoor-Gartenbau > Gartentechnik > Lufttechnik > Aktivkohlefilter",
  },
  "secret-jardin-growbox--for-twenty-100-komplettset-": {
    googleProductCategory: "Home & Garden > Lawn & Garden > Gardening",
    productType: "Indoor-Gartenbau > Pflanzenzucht > Zuchtzelte",
  },
  "wasserfilterhalter-9mm-autopot": {
    googleProductCategory: "Home & Garden > Lawn & Garden",
    productType: "Indoor-Gartenbau > Gartentechnik > Bewaesserung > Wasserfilter & Osmose",
  },
  "ersatzmembrane-f-r-mega-und-power-grow-150-gdp-gro": {
    googleProductCategory: "Home & Garden > Lawn & Garden",
    productType: "Indoor-Gartenbau > Gartentechnik > Bewaesserung > Wasserfilter & Osmose",
  },
  "wasserfilter-2x-16mm-gib": {
    googleProductCategory: "Home & Garden > Lawn & Garden",
    productType: "Indoor-Gartenbau > Gartentechnik > Bewaesserung > Wasserfilter & Osmose",
  },
  "ersatzfilter-set-f-r-power-und-mega-grow-growmax-w": {
    googleProductCategory: "Home & Garden > Lawn & Garden",
    productType: "Indoor-Gartenbau > Gartentechnik > Bewaesserung > Wasserfilter & Osmose",
  },
  "ersatzfilter-set-f-r-mega-grow-growmax-water": {
    googleProductCategory: "Home & Garden > Lawn & Garden",
    productType: "Indoor-Gartenbau > Gartentechnik > Bewaesserung > Wasserfilter & Osmose",
  },
  "tankadapter-mit-klickanschluss-und-filter-9mm-auto": {
    googleProductCategory: "Home & Garden > Lawn & Garden",
    productType: "Indoor-Gartenbau > Gartentechnik > Bewaesserung > Wasserfilter & Osmose",
  },
  "tankadapter-mit-klickanschluss-und-filter-16mm-aut": {
    googleProductCategory: "Home & Garden > Lawn & Garden",
    productType: "Indoor-Gartenbau > Gartentechnik > Bewaesserung > Wasserfilter & Osmose",
  },
};

const toDescriptiveProductType = (categoryPath: string) => {
  const cleaned = categoryPath
    .replace(/\s*>\s*/g, " > ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return DEFAULT_PRODUCT_TYPE;
  return `Indoor-Gartenbau > ${cleaned}`;
};

const inferGoogleFeedCategoryMapping = (input: {
  handle: string;
  title: string;
  description: string | null;
  shortDescription: string | null;
  handles: string[];
  categoryPath: string;
}): GoogleFeedCategoryMapping => {
  const productOverride = GOOGLE_FEED_PRODUCT_OVERRIDES[input.handle.toLowerCase()];
  if (productOverride) {
    return productOverride;
  }

  const haystack = [
    input.title,
    input.description ?? "",
    input.shortDescription ?? "",
    input.categoryPath,
    input.handles.join(" "),
  ]
    .join(" ")
    .toLowerCase();

  const handleSet = new Set(input.handles.map((handle) => handle.toLowerCase()));
  const hasHandle = (...handles: string[]) => handles.some((h) => handleSet.has(h));

  if (
    hasHandle("papers", "paper", "filter") ||
    /\b(papers?|drehpapier|filter)\b/i.test(haystack)
  ) {
    return {
      googleProductCategory: "Home & Garden > Household Supplies",
      productType: "Indoor-Gartenbau > Gartentechnik > Verbrauchsmaterial > Filter",
    };
  }

  if (
    hasHandle("pipes", "pipe", "bongs", "bong") ||
    /\b(wasserpfeife|glaspfeife|pipe|pfeife)\b/i.test(haystack)
  ) {
    return {
      googleProductCategory: "Home & Garden > Smoking Accessories",
      productType: "Indoor-Gartenbau > Gartentechnik > Glaszubehoer > Pfeifen",
    };
  }

  if (hasHandle("grinder") || /\b(grinder|kraeutermuehle|krautermuhle)\b/i.test(haystack)) {
    return {
      googleProductCategory:
        "Home & Garden > Kitchen & Dining > Kitchen Tools & Utensils",
      productType: "Indoor-Gartenbau > Pflanzenzucht > Vorbereitung > Muehlen",
    };
  }

  if (
    hasHandle("aufbewahrung", "stash-box", "stash") ||
    /\b(aufbewahrung|stash box|storage)\b/i.test(haystack)
  ) {
    return {
      googleProductCategory:
        "Home & Garden > Household Supplies > Storage & Organization",
      productType: "Indoor-Gartenbau > Gartentechnik > Lagerung & Organisation",
    };
  }

  return {
    googleProductCategory: DEFAULT_GOOGLE_PRODUCT_CATEGORY,
    productType: toDescriptiveProductType(input.categoryPath),
  };
};

const formatPrice = (value: number, currency = "EUR") =>
  `${value.toFixed(2)} ${currency}`;

const resolveProductUrl = (handle: string) =>
  `${SITE_URL}/products/${handle}`;

const GOOGLE_SUPPORTED_IMAGE_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".bmp",
  ".tif",
  ".tiff",
]);

const getImageExtension = (rawUrl: string) => {
  const candidate = rawUrl.startsWith("http")
    ? rawUrl
    : `${SITE_URL}${rawUrl.startsWith("/") ? "" : "/"}${rawUrl}`;
  try {
    const parsed = new URL(candidate);
    const pathname = parsed.pathname.toLowerCase();
    const dotIndex = pathname.lastIndexOf(".");
    return dotIndex >= 0 ? pathname.slice(dotIndex) : "";
  } catch {
    return "";
  }
};

const isGoogleSupportedImageUrl = (rawUrl: string) => {
  const ext = getImageExtension(rawUrl);
  if (!ext) return true;
  return GOOGLE_SUPPORTED_IMAGE_EXTENSIONS.has(ext);
};

const resolveImageUrl = (urlInput: string) => {
  const url = urlInput ?? "";
  if (!url) return "";
  if (url.startsWith("http")) {
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.toLowerCase();
      if (host === "localhost" || host === "127.0.0.1" || host === "::1") {
        return `${SITE_URL}${parsed.pathname}${parsed.search}`;
      }
    } catch {
      return "";
    }
    return url;
  }
  return `${SITE_URL}${url.startsWith("/") ? "" : "/"}${url}`;
};

const buildItemId = (productHandle: string, variantId: string) => {
  const base = `variant-${variantId.slice(0, 12)}`;
  return base.length > 50 ? base.slice(0, 50) : base;
};

const getGoogleFeedExclusionCheck = (product: {
  handle: string;
  title: string;
  description: string | null;
  shortDescription: string | null;
  tags: string[];
  mainCategory: { handle: string; parent: { handle: string } | null } | null;
  categories: Array<{ category: { handle: string; parent: { handle: string } | null } }>;
}): GoogleFeedExclusionCheck => {
  const normalizedHandle = product.handle.toLowerCase();
  if (GOOGLE_FEED_FORCE_INCLUDE_HANDLES.has(normalizedHandle)) {
    return {
      excluded: false,
      forceIncluded: true,
      matchedCategoryHandles: [],
      matchedSignalTerms: [],
      matchedBlockedTerms: [],
      reasons: ["force_include"],
    };
  }

  const categoryHandles = [
    product.mainCategory?.handle ?? "",
    product.mainCategory?.parent?.handle ?? "",
    ...product.categories.map(({ category }) => category.handle),
    ...product.categories.map(({ category }) => category.parent?.handle ?? ""),
  ]
    .map((entry) => entry.toLowerCase())
    .filter(Boolean);

  const matchedForceIncludeCategoryHandles = categoryHandles.filter((handle) =>
    GOOGLE_FEED_FORCE_INCLUDE_CATEGORY_HANDLES.has(handle)
  );
  if (matchedForceIncludeCategoryHandles.length > 0) {
    return {
      excluded: false,
      forceIncluded: true,
      matchedCategoryHandles: Array.from(
        new Set(matchedForceIncludeCategoryHandles)
      ),
      matchedSignalTerms: [],
      matchedBlockedTerms: [],
      reasons: ["force_include_category"],
    };
  }

  const matchedCategoryHandles = categoryHandles.filter((handle) =>
    GOOGLE_FEED_EXCLUDED_CATEGORY_HANDLES.has(handle)
  );

  const headshopSignalHaystack = [
    product.handle,
    product.title,
    product.description ?? "",
    product.shortDescription ?? "",
    ...(product.tags ?? []),
  ]
    .join(" ")
    .toLowerCase();

  const matchedSignalTerms = HEADSHOP_SIGNAL_TERMS.filter((term) =>
    headshopSignalHaystack.includes(term)
  );

  const haystack = [
    product.handle,
    product.title,
    product.description ?? "",
    product.shortDescription ?? "",
    ...(product.tags ?? []),
    ...categoryHandles,
  ]
    .join(" ")
    .toLowerCase();

  const matchedBlockedTerms = GOOGLE_FEED_BLOCKED_TERMS.filter((term) =>
    haystack.includes(term)
  );

  const reasons: string[] = [];
  if (matchedCategoryHandles.length > 0) reasons.push("category_match");
  if (matchedSignalTerms.length > 0) reasons.push("term_match");
  if (matchedBlockedTerms.length > 0) reasons.push("blocked_term_match");

  return {
    excluded: reasons.length > 0,
    forceIncluded: false,
    matchedCategoryHandles: Array.from(new Set(matchedCategoryHandles)),
    matchedSignalTerms: Array.from(new Set(matchedSignalTerms)),
    matchedBlockedTerms: Array.from(new Set(matchedBlockedTerms)),
    reasons,
  };
};

const isGoogleFeedSafeCandidate = (product: {
  title: string;
  description: string | null;
  shortDescription: string | null;
  tags: string[];
  mainCategory: { handle: string; parent: { handle: string } | null } | null;
  categories: Array<{ category: { handle: string; parent: { handle: string } | null } }>;
}) => {
  if (!isFeedVariantAllowed(product.title)) return false;

  const categoryHandles = [
    product.mainCategory?.handle ?? "",
    product.mainCategory?.parent?.handle ?? "",
    ...product.categories.map(({ category }) => category.handle),
    ...product.categories.map(({ category }) => category.parent?.handle ?? ""),
  ]
    .map((entry) => entry.toLowerCase())
    .filter(Boolean);

  const hasSafeCategory = categoryHandles.some((handle) =>
    GOOGLE_FEED_SAFE_CATEGORY_HANDLES.has(handle)
  );
  if (hasSafeCategory) return true;

  const haystack = [
    product.title,
    product.description ?? "",
    product.shortDescription ?? "",
    ...(product.tags ?? []),
    ...categoryHandles,
  ]
    .join(" ")
    .toLowerCase();

  return GOOGLE_FEED_SAFE_TERMS.some((term) => haystack.includes(term));
};

export async function GET() {
  const allProducts = await prisma.product.findMany({
    where: { status: "ACTIVE" },
    orderBy: { updatedAt: "desc" },
    include: {
      mainCategory: {
        include: { parent: true },
      },
      images: { orderBy: { position: "asc" } },
      variants: {
        orderBy: { position: "asc" },
        include: { inventory: true, options: true },
      },
      categories: {
        orderBy: { position: "asc" },
        include: { category: { include: { parent: true } } },
      },
    },
  });
  const products = allProducts.filter((product) => {
    const exclusionCheck = getGoogleFeedExclusionCheck(product);
    if (exclusionCheck.forceIncluded) return true;
    if (exclusionCheck.excluded) return false;
    return isGoogleFeedSafeCandidate(product);
  });
  const now = new Date().toUTCString();

  const items = products
    .flatMap((product) => {
      const baseTitle = product.title;
      const description = escapeXml(
        sanitizeDescriptionForGoogleFeed(
          product.description ?? product.shortDescription ?? ""
        )
      );
      const link = escapeXml(resolveProductUrl(product.handle));
      const supportedImages = product.images
        .map((img) => img.url)
        .filter((url) => isGoogleSupportedImageUrl(url));
      if (supportedImages.length === 0) {
        return [];
      }
      const image = escapeXml(resolveImageUrl(supportedImages[0] ?? ""));
      const brand = escapeXml(resolveFeedBrand(product));
      const condition = "new";
      const primaryCategory = product.categories[0]?.category;
      const categoryPath = primaryCategory
        ? primaryCategory.parent
          ? `${primaryCategory.parent.name} > ${primaryCategory.name}`
          : primaryCategory.name
        : "";
      const categoryHandles = [
        product.mainCategory?.handle ?? "",
        product.mainCategory?.parent?.handle ?? "",
        ...product.categories.map(({ category }) => category.handle),
        ...product.categories.map(({ category }) => category.parent?.handle ?? ""),
      ].filter(Boolean);
      const categoryMapping = inferGoogleFeedCategoryMapping({
        handle: product.handle,
        title: product.title,
        description: product.description,
        shortDescription: product.shortDescription,
        handles: categoryHandles,
        categoryPath,
      });
      const productType = categoryMapping.productType
        ? escapeXml(categoryMapping.productType)
        : "";
      const googleProductCategory = categoryMapping.googleProductCategory
        ? escapeXml(categoryMapping.googleProductCategory)
        : "";
      const additionalImages = supportedImages
        .slice(1, 10)
        .map((img) => escapeXml(resolveImageUrl(img)))
        .filter(Boolean);

      return product.variants.map((variant) => {
        const available =
          (variant.inventory?.quantityOnHand ?? 0) -
          (variant.inventory?.reserved ?? 0);
        const isInStock = available > 0;
        const isPreorder = !isInStock && Boolean(product.leadTimeDays);
        const availability = isPreorder
          ? "preorder"
          : isInStock
            ? "in_stock"
            : "out_of_stock";
        const availabilityDate =
          isPreorder && product.leadTimeDays
            ? new Date(
                Date.now() + product.leadTimeDays * 24 * 60 * 60 * 1000
              ).toISOString()
            : null;
        const variantTitle =
          variant.title && !/default/i.test(variant.title)
            ? `${baseTitle} - ${variant.title}`
            : baseTitle;
        if (!isFeedVariantAllowed(variantTitle)) {
          return "";
        }
        const feedTitle = sanitizeFeedKeywordHygiene(variantTitle);
        const price = escapeXml(formatPrice(variant.priceCents / 100));
        const sku = variant.sku?.trim() ?? "";
        const gtin = extractGtinFromTechnicalDetails(product.technicalDetails);
        const itemId = buildItemId(product.handle, variant.id);
        const hasGtin = Boolean(gtin);
        const hasMpn = Boolean(sku);
        const identifierExists = hasMpn || hasGtin ? "yes" : "no";

        return [
          "<item>",
          `<g:id>${escapeXml(itemId)}</g:id>`,
          `<g:item_group_id>${escapeXml(product.id)}</g:item_group_id>`,
          `<title>${escapeXml(feedTitle)}</title>`,
          `<description>${description}</description>`,
          `<link>${link}</link>`,
          image ? `<g:image_link>${image}</g:image_link>` : "",
          ...additionalImages.map(
            (url) => `<g:additional_image_link>${url}</g:additional_image_link>`
          ),
          `<g:availability>${escapeXml(availability)}</g:availability>`,
          availabilityDate
            ? `<g:availability_date>${escapeXml(availabilityDate)}</g:availability_date>`
            : "",
          `<g:price>${price}</g:price>`,
          `<g:brand>${brand}</g:brand>`,
          hasGtin ? `<g:gtin>${escapeXml(gtin)}</g:gtin>` : "",
          hasMpn ? `<g:mpn>${escapeXml(sku)}</g:mpn>` : "",
          googleProductCategory
            ? `<g:google_product_category>${googleProductCategory}</g:google_product_category>`
            : "",
          productType ? `<g:product_type>${productType}</g:product_type>` : "",
          product.weightGrams
            ? `<g:shipping_weight>${escapeXml(
                (product.weightGrams / 1000).toFixed(2)
              )} kg</g:shipping_weight>`
            : "",
          `<g:condition>${escapeXml(condition)}</g:condition>`,
          `<g:identifier_exists>${identifierExists}</g:identifier_exists>`,
          "</item>",
        ]
          .filter(Boolean)
          .join("");
      });
    })
    .join("");

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">` +
    `<channel>` +
    `<title>Indoor-Gartenbau Produktfeed</title>` +
    `<link>${escapeXml(SITE_URL)}</link>` +
    `<description>Google Merchant Center Feed</description>` +
    `<lastBuildDate>${now}</lastBuildDate>` +
    items +
    `</channel>` +
    `</rss>`;

  const cacheControl =
    process.env.NODE_ENV === "development"
      ? "no-store"
      : "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400";

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": cacheControl,
    },
  });
}
