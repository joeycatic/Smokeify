import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

const CURRENCY_CODE = "EUR";
const MAX_DB_CANDIDATES = 60;
const MAX_RESULTS = 8;
const MAX_TOKENS = 4;
const MAX_TERMS = 8;
const MAX_FUZZY_TERMS = 3;

const toAmount = (cents: number) => (cents / 100).toFixed(2);

const SEARCH_SYNONYMS: Record<string, string[]> = {
  aktivkohle: ["carbon", "kohle"],
  filter: ["filters", "filtration"],
  bong: ["wasserpfeife", "waterpipe"],
  grinder: ["muehle", "muhle"],
  vaporizer: ["vape", "verdampfer"],
  growbox: ["grow", "zelt", "box"],
  duenger: ["duenger", "dunger", "fertilizer", "naehrstoff", "nahrung"],
  luefter: ["lufter", "fan", "abluft"],
};

const normalizeSearch = (value: string) =>
  value
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/\s+/g, " ")
    .trim();

const tokenize = (value: string) =>
  normalizeSearch(value)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);

const toDeleteDistanceOne = (token: string) => {
  if (token.length < 4) return [];
  const variants: string[] = [];
  for (let i = 0; i < token.length; i += 1) {
    variants.push(token.slice(0, i) + token.slice(i + 1));
  }
  return variants;
};

const buildSearchTerms = (query: string) => {
  const tokens = tokenize(query).slice(0, MAX_TOKENS);
  const terms = new Set<string>(tokens);
  const fuzzyBaseToken = [...tokens]
    .sort((a, b) => b.length - a.length)[0];

  for (const token of tokens) {
    const synonyms = SEARCH_SYNONYMS[token] ?? [];
    for (const synonym of synonyms) {
      terms.add(normalizeSearch(synonym));
    }
    if (token === fuzzyBaseToken) {
      for (const fuzzy of toDeleteDistanceOne(token).slice(0, MAX_FUZZY_TERMS)) {
        terms.add(fuzzy);
      }
    }
  }

  const normalizedQuery = normalizeSearch(query);
  if (normalizedQuery) terms.add(normalizedQuery);

  return Array.from(terms).filter((term) => term.length >= 2).slice(0, MAX_TERMS);
};

const getRelevanceScore = (
  input: { title: string; handle: string; manufacturer: string | null; tags: string[] },
  rawQuery: string,
  terms: string[]
) => {
  const title = normalizeSearch(input.title);
  const handle = normalizeSearch(input.handle);
  const manufacturer = normalizeSearch(input.manufacturer ?? "");
  const tags = input.tags.map((tag) => normalizeSearch(tag));
  const query = normalizeSearch(rawQuery);

  let score = 0;
  if (title === query) score += 150;
  if (handle === query) score += 140;
  if (title.startsWith(query)) score += 90;
  if (handle.startsWith(query)) score += 85;
  if (manufacturer.startsWith(query)) score += 60;

  for (const term of terms) {
    if (title.includes(term)) score += 22;
    if (handle.includes(term)) score += 20;
    if (manufacturer.includes(term)) score += 12;
    if (tags.some((tag) => tag.includes(term))) score += 10;
  }

  return score;
};

export async function GET(request: Request) {
  const ip = getClientIp(request.headers);
  const ipLimit = await checkRateLimit({
    key: `search:ip:${ip}`,
    limit: 120,
    windowMs: 60 * 1000,
  });
  if (!ipLimit.allowed) {
    return NextResponse.json({ results: [] }, { status: 429 });
  }
  const { searchParams } = new URL(request.url);
  const rawQuery = searchParams.get("q") ?? "";
  const query = rawQuery.trim();
  if (!query) {
    return NextResponse.json({ results: [] });
  }
  const terms = buildSearchTerms(query);
  const queryForDb = normalizeSearch(query);
  const rawQueryForDb = query;

  const products = await prisma.product.findMany({
    where: {
      status: "ACTIVE",
      OR: [
        { title: { contains: rawQueryForDb, mode: "insensitive" } },
        { handle: { contains: rawQueryForDb, mode: "insensitive" } },
        { manufacturer: { contains: rawQueryForDb, mode: "insensitive" } },
        { title: { contains: queryForDb, mode: "insensitive" } },
        { handle: { contains: queryForDb, mode: "insensitive" } },
        { manufacturer: { contains: queryForDb, mode: "insensitive" } },
        ...terms.flatMap((term) => [
          { title: { contains: term, mode: "insensitive" as const } },
          { handle: { contains: term, mode: "insensitive" as const } },
          { manufacturer: { contains: term, mode: "insensitive" as const } },
          { tags: { has: term } },
        ]),
      ],
    },
    orderBy: { updatedAt: "desc" },
    take: MAX_DB_CANDIDATES,
    include: {
      images: { orderBy: { position: "asc" }, take: 1 },
      variants: { orderBy: { position: "asc" }, select: { priceCents: true } },
    },
  });

  const ranked = products
    .map((product) => {
      const score = getRelevanceScore(
        {
          title: product.title,
          handle: product.handle,
          manufacturer: product.manufacturer ?? null,
          tags: product.tags ?? [],
        },
        query,
        terms
      );
      return { product, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RESULTS);

  const results = ranked.map(({ product }) => {
    const prices = product.variants.map((variant) => variant.priceCents);
    const minPrice =
      prices.length > 0 ? Math.min(...prices) : null;
    const image = product.images[0] ?? null;
    return {
      id: product.id,
      title: product.title,
      handle: product.handle,
      imageUrl: image?.url ?? null,
      imageAlt: image?.altText ?? product.title,
      price: minPrice !== null
        ? { amount: toAmount(minPrice), currencyCode: CURRENCY_CODE }
        : null,
    };
  });

  return NextResponse.json({ results });
}
