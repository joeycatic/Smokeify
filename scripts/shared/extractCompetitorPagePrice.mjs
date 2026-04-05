export const PRICE_META_TAG_REGEX =
  /<meta[^>]*itemprop=["']price["'][^>]*content=["']([^"']+)["'][^>]*>/i;

export const extractCompetitorPagePriceCentsFromHtml = (html) => {
  const match = html.match(PRICE_META_TAG_REGEX);
  if (!match) return null;

  const rawPrice = Number.parseFloat(match[1].replace(",", "."));
  if (!Number.isFinite(rawPrice)) return null;

  return Math.round(rawPrice * 100);
};
