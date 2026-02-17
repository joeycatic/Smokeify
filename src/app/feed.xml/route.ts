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
  "filter",
  "grinder",
  "hash-bowl",
  "papers",
  "pipes",
  "rolling-tray",
  "tubes",
  "vaporizer",
  "waagen",
]);

const escapeXml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const stripHtml = (value: string) => value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

const FEED_DESCRIPTION_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bbongs?\b/gi, "Wasserpfeife"],
  [/\bjoints?\b/gi, "Drehpapier"],
  [/\bweed\b/gi, "Kraeuter"],
  [/\bcannabis\b/gi, "Kraeuter"],
  [/\bmarijuana\b/gi, "Kraeuter"],
  [/\bgras\b/gi, "Kraeuter"],
  [/\bkiffen\b/gi, "Nutzung"],
  [/\bgrinders?\b/gi, "Kraeutermuehle"],
  [/\bstash\s*box\b/gi, "Aufbewahrungsbox"],
];

const COMPLIANCE_NOTE =
  " Fuer Erwachsene ab 18 Jahren. Ausschliesslich fuer legale Zwecke.";

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

const sanitizeDescriptionForGoogleFeed = (raw: string) => {
  let normalized = stripHtml(raw);
  for (const [pattern, replacement] of FEED_DESCRIPTION_REPLACEMENTS) {
    normalized = normalized.replace(pattern, replacement);
  }
  normalized = dedupeRepeatedSentences(normalized);
  normalized = normalized.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return `Hochwertiges Zubehoer fuer den vorgesehenen Einsatzzweck.${COMPLIANCE_NOTE}`;
  }
  if (/fuer erwachsene ab 18 jahren/i.test(normalized)) return normalized;
  return `${normalized}${COMPLIANCE_NOTE}`;
};

type GoogleFeedCategoryMapping = {
  googleProductCategory: string | null;
  productType: string | null;
};

const DEFAULT_GOOGLE_PRODUCT_CATEGORY = "Home & Garden > Lawn & Garden > Gardening";
const DEFAULT_PRODUCT_TYPE = "Grow Equipment > General";

const GOOGLE_FEED_PRODUCT_OVERRIDES: Record<string, GoogleFeedCategoryMapping> = {
  "ac-infinity-aktivkohlefilter-150mm": {
    googleProductCategory: "Home & Garden > Lawn & Garden > Gardening",
    productType: "Grow Equipment > Air Filtration > Carbon Filters",
  },
  "ac-infinity-aktivkohlefilter-100mm": {
    googleProductCategory: "Home & Garden > Lawn & Garden > Gardening",
    productType: "Grow Equipment > Air Filtration > Carbon Filters",
  },
  "ac-infinity-aktivkohlefilter-200mm": {
    googleProductCategory: "Home & Garden > Lawn & Garden > Gardening",
    productType: "Grow Equipment > Air Filtration > Carbon Filters",
  },
  "secret-jardin-growbox--for-twenty-100-komplettset-": {
    googleProductCategory: "Home & Garden > Lawn & Garden > Gardening",
    productType: "Grow Equipment > Indoor Gardening > Grow Tents",
  },
  "wasserfilterhalter-9mm-autopot": {
    googleProductCategory: "Home & Garden > Lawn & Garden",
    productType: "Grow Equipment > Irrigation > Water Filters & Osmosis",
  },
  "ersatzmembrane-f-r-mega-und-power-grow-150-gdp-gro": {
    googleProductCategory: "Home & Garden > Lawn & Garden",
    productType: "Grow Equipment > Irrigation > Water Filters & Osmosis",
  },
  "wasserfilter-2x-16mm-gib": {
    googleProductCategory: "Home & Garden > Lawn & Garden",
    productType: "Grow Equipment > Irrigation > Water Filters & Osmosis",
  },
  "ersatzfilter-set-f-r-power-und-mega-grow-growmax-w": {
    googleProductCategory: "Home & Garden > Lawn & Garden",
    productType: "Grow Equipment > Irrigation > Water Filters & Osmosis",
  },
  "ersatzfilter-set-f-r-mega-grow-growmax-water": {
    googleProductCategory: "Home & Garden > Lawn & Garden",
    productType: "Grow Equipment > Irrigation > Water Filters & Osmosis",
  },
  "tankadapter-mit-klickanschluss-und-filter-9mm-auto": {
    googleProductCategory: "Home & Garden > Lawn & Garden",
    productType: "Grow Equipment > Irrigation > Water Filters & Osmosis",
  },
  "tankadapter-mit-klickanschluss-und-filter-16mm-aut": {
    googleProductCategory: "Home & Garden > Lawn & Garden",
    productType: "Grow Equipment > Irrigation > Water Filters & Osmosis",
  },
};

const toDescriptiveProductType = (categoryPath: string) => {
  const cleaned = categoryPath
    .replace(/\s*>\s*/g, " > ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return DEFAULT_PRODUCT_TYPE;
  return `Grow Equipment > ${cleaned}`;
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
      productType: "Grow Equipment > Consumables > Filter Supplies",
    };
  }

  if (
    hasHandle("pipes", "pipe", "bongs", "bong") ||
    /\b(wasserpfeife|glaspfeife|pipe|pfeife)\b/i.test(haystack)
  ) {
    return {
      googleProductCategory: "Home & Garden > Smoking Accessories",
      productType: "Grow Equipment > Glassware > Pipes & Water Pipes",
    };
  }

  if (hasHandle("grinder") || /\b(grinder|kraeutermuehle|krautermuhle)\b/i.test(haystack)) {
    return {
      googleProductCategory:
        "Home & Garden > Kitchen & Dining > Kitchen Tools & Utensils",
      productType: "Grow Equipment > Preparation Tools > Herb Grinders",
    };
  }

  if (
    hasHandle("aufbewahrung", "stash-box", "stash") ||
    /\b(aufbewahrung|stash box|storage)\b/i.test(haystack)
  ) {
    return {
      googleProductCategory:
        "Home & Garden > Household Supplies > Storage & Organization",
      productType: "Grow Equipment > Storage & Organization",
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
  const base = `${productHandle}-${variantId.slice(0, 8)}`;
  return base.length > 50 ? base.slice(0, 50) : base;
};

const isGoogleFeedExcluded = (product: {
  mainCategory: { handle: string; parent: { handle: string } | null } | null;
  categories: Array<{ category: { handle: string; parent: { handle: string } | null } }>;
}) => {
  if (
    product.mainCategory &&
    (GOOGLE_FEED_EXCLUDED_CATEGORY_HANDLES.has(product.mainCategory.handle) ||
      (product.mainCategory.parent &&
        GOOGLE_FEED_EXCLUDED_CATEGORY_HANDLES.has(product.mainCategory.parent.handle)))
  ) {
    return true;
  }

  return product.categories.some(({ category }) => {
    if (GOOGLE_FEED_EXCLUDED_CATEGORY_HANDLES.has(category.handle)) return true;
    return Boolean(
      category.parent &&
        GOOGLE_FEED_EXCLUDED_CATEGORY_HANDLES.has(category.parent.handle)
    );
  });
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
  const products = allProducts.filter((product) => !isGoogleFeedExcluded(product));
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
      const brandRaw = product.manufacturer ?? product.sellerName ?? "";
      const brand = escapeXml(brandRaw || "Smokeify");
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
        const price = escapeXml(formatPrice(variant.priceCents / 100));
        const sku = variant.sku?.trim() ?? "";
        const itemId = buildItemId(product.handle, variant.id);
        const hasMpn = Boolean(sku);
        const identifierExists = hasMpn ? "yes" : "no";

        return [
          "<item>",
          `<g:id>${escapeXml(itemId)}</g:id>`,
          `<g:item_group_id>${escapeXml(product.id)}</g:item_group_id>`,
          `<title>${escapeXml(variantTitle)}</title>`,
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
    `<title>Smokeify Product Feed</title>` +
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
