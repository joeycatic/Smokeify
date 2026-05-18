export const PRICE_META_TAG_REGEX =
  /<meta[^>]*itemprop=["']price["'][^>]*content=["']([^"']+)["'][^>]*>/i;
const PRICE_META_TAG_REGEX_GLOBAL =
  /<meta[^>]*itemprop=["']price["'][^>]*content=["']([^"']+)["'][^>]*>/gi;

const EXPLICIT_COMPARE_AT_PATTERNS = [
  /"compare_at_price"\s*:\s*"([^"]+)"/gi,
  /"compareAtPrice"\s*:\s*"([^"]+)"/gi,
  /"listPrice"\s*:\s*"([^"]+)"/gi,
  /"regularPrice"\s*:\s*"([^"]+)"/gi,
  /"originalPrice"\s*:\s*"([^"]+)"/gi,
  /"priceBefore"\s*:\s*"([^"]+)"/gi,
  /<span[^>]*class=["'][^"']*(?:old-price|price-old|was-price|price-compare|compare-price)[^"']*["'][^>]*>\s*(?:€\s*)?([0-9][0-9.,]*)/gi,
  /<del[^>]*>\s*(?:€\s*)?([0-9][0-9.,]*)/gi,
  /(?:UVP|Statt|Listenpreis|Originalpreis|Regul(?:aer|är)er Preis)[^0-9€]{0,40}(?:€\s*)?([0-9][0-9.,]*)/gi,
];

const parsePriceToCents = (rawValue) => {
  if (typeof rawValue !== "string") return null;

  const cleaned = rawValue.replace(/[^0-9,.-]/g, "").trim();
  if (!cleaned) return null;

  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  let normalized = cleaned;

  if (lastComma !== -1 && lastDot !== -1) {
    normalized =
      lastComma > lastDot
        ? cleaned.replace(/\./g, "").replace(",", ".")
        : cleaned.replace(/,/g, "");
  } else if (lastComma !== -1) {
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  } else if ((cleaned.match(/\./g) ?? []).length > 1) {
    const parts = cleaned.split(".");
    normalized = `${parts.slice(0, -1).join("")}.${parts.at(-1)}`;
  }

  const price = Number.parseFloat(normalized);
  if (!Number.isFinite(price)) return null;

  return Math.round(price * 100);
};

const collectPrices = (html, patterns) => {
  const results = [];

  for (const pattern of patterns) {
    const globalPattern = new RegExp(
      pattern.source,
      pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`
    );

    for (const match of html.matchAll(globalPattern)) {
      const cents = parsePriceToCents(match[1]);
      if (cents !== null) {
        results.push(cents);
      }
    }
  }

  return results;
};

export const extractCompetitorPagePricingFromHtml = (html) => {
  PRICE_META_TAG_REGEX_GLOBAL.lastIndex = 0;
  const currentPriceMatch = PRICE_META_TAG_REGEX_GLOBAL.exec(html);
  const currentPriceCents = parsePriceToCents(currentPriceMatch?.[1] ?? "");
  if (currentPriceCents === null) {
    return {
      priceCents: null,
      compareAtCents: null,
    };
  }

  const priceContextStart = Math.max(0, (currentPriceMatch?.index ?? 0) - 1500);
  const priceContextEnd = Math.min(
    html.length,
    (currentPriceMatch?.index ?? 0) + 4000
  );
  const priceContextHtml = html.slice(priceContextStart, priceContextEnd);
  const explicitCompareAtCandidates = collectPrices(
    priceContextHtml,
    EXPLICIT_COMPARE_AT_PATTERNS
  ).filter((candidate) => candidate > currentPriceCents);

  return {
    priceCents: currentPriceCents,
    compareAtCents:
      explicitCompareAtCandidates.length > 0
        ? Math.max(...explicitCompareAtCandidates)
        : null,
  };
};

export const extractCompetitorPagePriceCentsFromHtml = (html) => {
  return extractCompetitorPagePricingFromHtml(html).priceCents;
};
