export const PRICE_META_TAG_REGEX =
  /<meta[^>]*itemprop=["']price["'][^>]*content=["']([^"']+)["'][^>]*>/i;

const EXTRA_PRICE_PATTERNS = [
  /<meta[^>]*(?:property|name)=["']product:price:amount["'][^>]*content=["']([^"']+)["'][^>]*>/gi,
  /"compare_at_price"\s*:\s*"([^"]+)"/gi,
  /"compareAtPrice"\s*:\s*"([^"]+)"/gi,
  /"listPrice"\s*:\s*"([^"]+)"/gi,
  /"regularPrice"\s*:\s*"([^"]+)"/gi,
  /"originalPrice"\s*:\s*"([^"]+)"/gi,
  /"highPrice"\s*:\s*"([^"]+)"/gi,
  /"priceBefore"\s*:\s*"([^"]+)"/gi,
  /"offerPrice"\s*:\s*"([^"]+)"/gi,
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
  const currentPriceCents = parsePriceToCents(html.match(PRICE_META_TAG_REGEX)?.[1] ?? "");
  if (currentPriceCents === null) {
    return {
      priceCents: null,
      compareAtCents: null,
    };
  }

  const allPublicPriceCandidates = collectPrices(html, [PRICE_META_TAG_REGEX, ...EXTRA_PRICE_PATTERNS]);
  const compareAtCandidates = allPublicPriceCandidates.filter(
    (candidate) => candidate > currentPriceCents
  );

  return {
    priceCents: currentPriceCents,
    compareAtCents:
      compareAtCandidates.length > 0 ? Math.max(...compareAtCandidates) : null,
  };
};

export const extractCompetitorPagePriceCentsFromHtml = (html) => {
  return extractCompetitorPagePricingFromHtml(html).priceCents;
};
