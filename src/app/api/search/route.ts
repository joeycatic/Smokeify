import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { attachServerTiming, getNow } from "@/lib/perf";
import {
  buildProductSearchTermGroups,
  getProductSearchScore,
} from "@/lib/productSearch";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { buildStorefrontProductWhere } from "@/lib/storefronts";

const CURRENCY_CODE = "EUR";
const MAIN_STOREFRONT = "MAIN" as const;
const MAX_RESULTS = 8;
const MAX_DB_CANDIDATES = 40;

const toAmount = (cents: number) => (cents / 100).toFixed(2);

const getAvailability = (quantityOnHand: number | null, reserved: number | null) => {
  const onHand = quantityOnHand ?? 0;
  const held = reserved ?? 0;
  return Math.max(0, onHand - held);
};

const buildTermConditions = (term: string): Prisma.ProductWhereInput[] => [
  { title: { contains: term, mode: "insensitive" } },
  { handle: { contains: term, mode: "insensitive" } },
  { manufacturer: { contains: term, mode: "insensitive" } },
  { shortDescription: { contains: term, mode: "insensitive" } },
  { description: { contains: term, mode: "insensitive" } },
  { technicalDetails: { contains: term, mode: "insensitive" } },
  { growboxSize: { contains: term, mode: "insensitive" } },
  { lightSize: { contains: term, mode: "insensitive" } },
  { productGroup: { contains: term, mode: "insensitive" } },
  { tags: { has: term } },
  {
    mainCategory: {
      is: {
        storefronts: { has: MAIN_STOREFRONT },
        OR: [
          { name: { contains: term, mode: "insensitive" } },
          { handle: { contains: term, mode: "insensitive" } },
          {
            parent: {
              is: {
                storefronts: { has: MAIN_STOREFRONT },
                OR: [
                  { name: { contains: term, mode: "insensitive" } },
                  { handle: { contains: term, mode: "insensitive" } },
                ],
              },
            },
          },
        ],
      },
    },
  },
  {
    categories: {
      some: {
        category: {
          storefronts: { has: MAIN_STOREFRONT },
          OR: [
            { name: { contains: term, mode: "insensitive" } },
            { handle: { contains: term, mode: "insensitive" } },
            {
              parent: {
                is: {
                  storefronts: { has: MAIN_STOREFRONT },
                  OR: [
                    { name: { contains: term, mode: "insensitive" } },
                    { handle: { contains: term, mode: "insensitive" } },
                  ],
                },
              },
            },
          ],
        },
      },
    },
  },
  {
    collections: {
      some: {
        collection: {
          OR: [
            { name: { contains: term, mode: "insensitive" } },
            { handle: { contains: term, mode: "insensitive" } },
          ],
        },
      },
    },
  },
  {
    variants: {
      some: {
        OR: [
          { title: { contains: term, mode: "insensitive" } },
          { sku: { contains: term, mode: "insensitive" } },
        ],
      },
    },
  },
];

export async function GET(request: Request) {
  const startedAt = getNow();
  const ip = getClientIp(request.headers);
  const ipLimit = await checkRateLimit({
    key: `search:ip:${ip}`,
    limit: 120,
    windowMs: 60 * 1000,
  });
  if (!ipLimit.allowed) {
    return attachServerTiming(
      NextResponse.json({ results: [] }, { status: 429 }),
      [{ name: "search", durationMs: getNow() - startedAt, description: "navbar-search" }],
    );
  }

  const { searchParams } = new URL(request.url);
  const rawQuery = searchParams.get("q") ?? "";
  const query = rawQuery.trim();
  if (!query || query.length > 200) {
    return attachServerTiming(NextResponse.json({ results: [] }), [
      { name: "search", durationMs: getNow() - startedAt, description: "navbar-search" },
    ]);
  }

  const termGroups = buildProductSearchTermGroups(query);
  if (termGroups.length === 0) {
    return attachServerTiming(NextResponse.json({ results: [] }), [
      { name: "search", durationMs: getNow() - startedAt, description: "navbar-search" },
    ]);
  }

  const searchCandidates = await prisma.product.findMany({
    where: buildStorefrontProductWhere(MAIN_STOREFRONT, {
      AND: termGroups.map((group) => ({
        OR: group.flatMap((term) => buildTermConditions(term)),
      })),
    }),
    orderBy: [
      { bestsellerScore: { sort: "desc", nulls: "last" } },
      { updatedAt: "desc" },
    ],
    take: MAX_DB_CANDIDATES,
    include: {
      images: { orderBy: { position: "asc" }, take: 1 },
      variants: {
        orderBy: { position: "asc" },
        include: { inventory: true },
      },
      mainCategory: {
        include: {
          parent: true,
        },
      },
      categories: {
        include: {
          category: {
            include: {
              parent: true,
            },
          },
        },
      },
      collections: {
        include: {
          collection: true,
        },
      },
    },
  });

  const ranked = searchCandidates
    .map((candidate) => {
      const score = getProductSearchScore(
        {
          title: candidate.title,
          handle: candidate.handle,
          manufacturer: candidate.manufacturer,
          shortDescription: candidate.shortDescription ?? "",
          description: candidate.description ?? "",
          technicalDetails: candidate.technicalDetails ?? "",
          tags: candidate.tags,
          categories: [
            candidate.mainCategory?.name ?? "",
            candidate.mainCategory?.handle ?? "",
            candidate.mainCategory?.parent?.name ?? "",
            candidate.mainCategory?.parent?.handle ?? "",
            ...candidate.categories.flatMap((entry) => [
              entry.category.name,
              entry.category.handle,
              entry.category.parent?.name ?? "",
              entry.category.parent?.handle ?? "",
            ]),
          ],
          collections: candidate.collections.flatMap((entry) => [
            entry.collection.name,
            entry.collection.handle,
          ]),
          variantTitles: candidate.variants.map((variant) => variant.title),
          variantSkus: candidate.variants.map((variant) => variant.sku ?? ""),
          extra: [
            candidate.growboxSize ?? "",
            candidate.lightSize ?? "",
            candidate.productGroup ?? "",
          ],
        },
        query,
      );
      const availableForSale = candidate.variants.some(
        (variant) =>
          getAvailability(
            variant.inventory?.quantityOnHand ?? 0,
            variant.inventory?.reserved ?? 0,
          ) > 0,
      );

      return { product: candidate, score, availableForSale };
    })
    .filter((entry) => entry.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return (
        Number(right.availableForSale) - Number(left.availableForSale) ||
        left.product.title.localeCompare(right.product.title)
      );
    })
    .slice(0, MAX_RESULTS);

  const results = ranked.map(({ product }) => {
    const prices = product.variants.map((variant) => variant.priceCents);
    const minPrice = prices.length > 0 ? Math.min(...prices) : null;
    const image = product.images[0] ?? null;

    return {
      id: product.id,
      defaultVariantId: product.variants[0]?.id ?? null,
      title: product.title,
      handle: product.handle,
      imageUrl: image?.url ?? null,
      imageAlt: image?.altText ?? product.title,
      price:
        minPrice !== null
          ? { amount: toAmount(minPrice), currencyCode: CURRENCY_CODE }
          : null,
    };
  });

  return attachServerTiming(NextResponse.json({ results }), [
    { name: "search", durationMs: getNow() - startedAt, description: "navbar-search" },
  ]);
}
