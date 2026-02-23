import "server-only";

import { prisma } from "@/lib/prisma";
import { unstable_cache } from "next/cache";
import type { Product } from "@/data/types";

const CURRENCY_CODE = "EUR";

const toAmount = (cents: number) => (cents / 100).toFixed(2);

const getAvailability = (quantityOnHand: number | null, reserved: number | null) => {
  const onHand = quantityOnHand ?? 0;
  const held = reserved ?? 0;
  return Math.max(0, onHand - held);
};

const mapProduct = (product: {
  id: string;
  title: string;
  handle: string;
  description: string | null;
  shortDescription: string | null;
  manufacturer: string | null;
  growboxSize: string | null;
  tags: string[];
  variants: Array<{
    id: string;
    title: string;
    priceCents: number;
    compareAtCents: number | null;
    position: number;
    lowStockThreshold: number;
    inventory: { quantityOnHand: number; reserved: number } | null;
  }>;
  images: Array<{ url: string; altText: string | null; position: number }>;
  categories: Array<{
    category: {
      id: string;
      name: string;
      handle: string;
      parentId: string | null;
      parent?: { id: string; name: string; handle: string } | null;
    };
  }>;
  collections: Array<{ collection: { id: string; name: string; handle: string } }>;
  reviews: Array<{ rating: number }>;
}): Product => {
  const sortedImages = [...product.images].sort((a, b) => a.position - b.position);
  const featuredImage = sortedImages[0] ?? null;
  const variants = [...product.variants].sort((a, b) => a.position - b.position);
  const minPriceVariant = variants.reduce((min, variant) => {
    if (!min) return variant;
    return variant.priceCents < min.priceCents ? variant : min;
  }, variants[0] ?? null);
  const defaultVariant = variants[0] ?? null;
  const minPriceCents = minPriceVariant?.priceCents ?? 0;
  const compareAtCents =
    minPriceVariant?.compareAtCents && minPriceVariant.compareAtCents > minPriceCents
      ? minPriceVariant.compareAtCents
      : null;
  const defaultVariantId = variants[0]?.id ?? null;
  const availableForSale = variants.some((variant) => {
    const available = getAvailability(
      variant.inventory?.quantityOnHand ?? 0,
      variant.inventory?.reserved ?? 0
    );
    return available > 0;
  });
  const defaultVariantAvailableQuantity = defaultVariant
    ? getAvailability(
        defaultVariant.inventory?.quantityOnHand ?? 0,
        defaultVariant.inventory?.reserved ?? 0
      )
    : 0;
  const defaultVariantLowStockThreshold = defaultVariant?.lowStockThreshold ?? 0;
  const lowStock = variants.some((variant) => {
    const available = getAvailability(
      variant.inventory?.quantityOnHand ?? 0,
      variant.inventory?.reserved ?? 0
    );
    return available > 0 && available <= variant.lowStockThreshold;
  });
  const reviewCount = product.reviews.length;
  const reviewAverage =
    reviewCount > 0
      ? product.reviews.reduce((sum, review) => sum + review.rating, 0) /
        reviewCount
      : 0;

  return {
    id: product.id,
    handle: product.handle,
    title: product.title,
    description: product.description,
    shortDescription: product.shortDescription,
    manufacturer: product.manufacturer,
    growboxSize: product.growboxSize ?? null,
    tags: product.tags ?? [],
    availableForSale,
    lowStock,
    defaultVariantAvailableQuantity,
    defaultVariantLowStockThreshold,
    defaultVariantId,
    featuredImage: featuredImage
      ? { url: featuredImage.url, altText: featuredImage.altText }
      : null,
    images: sortedImages.map((image) => ({
      url: image.url,
      altText: image.altText,
    })),
    categories: product.categories.map((entry) => ({
      id: entry.category.id,
      handle: entry.category.handle,
      title: entry.category.name,
      parentId: entry.category.parentId ?? null,
      parent: entry.category.parent
        ? {
            id: entry.category.parent.id,
            handle: entry.category.parent.handle,
            title: entry.category.parent.name,
          }
        : null,
    })),
    collections: product.collections.map((entry) => ({
      id: entry.collection.id,
      handle: entry.collection.handle,
      title: entry.collection.name,
    })),
    priceRange: {
      minVariantPrice: {
        amount: toAmount(minPriceCents),
        currencyCode: CURRENCY_CODE,
      },
    },
    compareAtPrice: compareAtCents
      ? { amount: toAmount(compareAtCents), currencyCode: CURRENCY_CODE }
      : null,
    reviewSummary: {
      average: reviewAverage,
      count: reviewCount,
    },
  };
};

const getProductsCached = unstable_cache(
  async (limit: number): Promise<Product[]> => {
    const products = await prisma.product.findMany({
      where: { status: "ACTIVE" },
      orderBy: [
        { bestsellerScore: { sort: "desc", nulls: "last" } },
        { updatedAt: "desc" },
      ],
      take: limit,
      include: {
        images: { orderBy: { position: "asc" } },
        variants: {
          orderBy: { position: "asc" },
          include: { inventory: true },
        },
        categories: { include: { category: { include: { parent: true } } } },
        collections: { include: { collection: true } },
        reviews: {
          where: { status: "APPROVED" },
          select: { rating: true },
        },
      },
    });

    return products.map(mapProduct);
  },
  ["catalog-products"],
  { revalidate: 30 },
);

export async function getProducts(limit = 50): Promise<Product[]> {
  return getProductsCached(limit);
}

const getProductHandlesCached = unstable_cache(
  async (): Promise<string[]> => {
    const handles: string[] = [];
    const batchSize = 500;
    let cursorId: string | null = null;

    while (true) {
      const products: Array<{ id: string; handle: string }> =
        await prisma.product.findMany({
        where: { status: "ACTIVE" },
        orderBy: { id: "asc" },
        take: batchSize,
        ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
        select: { id: true, handle: true },
        });

      if (!products.length) break;

      handles.push(...products.map((product) => product.handle));
      cursorId = products[products.length - 1]?.id ?? null;
    }

    return handles;
  },
  ["catalog-product-handles"],
  { revalidate: 300 },
);

export async function getProductHandlesForSitemap(): Promise<string[]> {
  return getProductHandlesCached();
}

const getProductByHandleCached = unstable_cache(
  async (handle: string) => _fetchProductByHandle(handle),
  ["catalog-product-by-handle"],
  { revalidate: 60 }
);

export async function getProductByHandle(handle: string) {
  return getProductByHandleCached(handle);
}

async function _fetchProductByHandle(handle: string) {
  const product = await prisma.product.findUnique({
    where: { handle },
    include: {
      images: { orderBy: { position: "asc" } },
      variants: {
        orderBy: { position: "asc" },
        include: { inventory: true, options: true },
      },
      categories: { include: { category: { include: { parent: true } } } },
    },
  });

  if (!product) return null;

  const images = product.images.map((image) => ({
    url: image.url,
    altText: image.altText,
    position: image.position,
  }));

  const variants = product.variants.map((variant) => {
    const available = getAvailability(
      variant.inventory?.quantityOnHand ?? 0,
      variant.inventory?.reserved ?? 0
    );
    const lowStock =
      available > 0 && available <= (variant.lowStockThreshold ?? 0);
    const compareAtCents =
      variant.compareAtCents && variant.compareAtCents > variant.priceCents
        ? variant.compareAtCents
        : null;
    return {
      id: variant.id,
      title: variant.title,
      options: variant.options.map((option) => ({
        name: option.name,
        value: option.value,
        imagePosition: option.imagePosition ?? null,
      })),
      availableForSale: available > 0,
      availableQuantity: available,
      lowStockThreshold: variant.lowStockThreshold ?? 0,
      lowStock,
      price: {
        amount: toAmount(variant.priceCents),
        currencyCode: CURRENCY_CODE,
      },
      compareAt: compareAtCents
        ? { amount: toAmount(compareAtCents), currencyCode: CURRENCY_CODE }
        : null,
    };
  });

  const optionsMap = new Map<string, Set<string>>();
  product.variants.forEach((variant) => {
    variant.options.forEach((option) => {
      const set = optionsMap.get(option.name) ?? new Set<string>();
      set.add(option.value);
      optionsMap.set(option.name, set);
    });
  });

  const options = Array.from(optionsMap.entries()).map(([name, values]) => ({
    name,
    values: Array.from(values),
  }));

  return {
    id: product.id,
    handle: product.handle,
    title: product.title,
    description: product.description ?? "",
    technicalDetails: product.technicalDetails ?? null,
    shortDescription: product.shortDescription ?? null,
    manufacturer: product.manufacturer,
    growboxSize: product.growboxSize ?? null,
    productGroup: product.productGroup ?? null,
    categories: product.categories.map((entry) => ({
      id: entry.category.id,
      handle: entry.category.handle,
      title: entry.category.name,
      parentId: entry.category.parentId ?? null,
      parent: entry.category.parent
        ? {
            id: entry.category.parent.id,
            handle: entry.category.parent.handle,
            title: entry.category.parent.name,
          }
        : null,
    })),
    images,
    variants,
    options,
  };
}

const _fetchProductsByIds = async (ids: string[]): Promise<Product[]> => {
  const products = await prisma.product.findMany({
    where: { id: { in: ids }, status: "ACTIVE" },
    include: {
      images: { orderBy: { position: "asc" } },
      variants: {
        orderBy: { position: "asc" },
        include: { inventory: true },
      },
      categories: { include: { category: { include: { parent: true } } } },
      collections: { include: { collection: true } },
      reviews: {
        where: { status: "APPROVED" },
        select: { rating: true },
      },
    },
  });
  const mapped = products.map(mapProduct);
  const order = new Map(ids.map((id, index) => [id, index]));
  return mapped.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
};

export async function getProductsByIds(ids: string[]): Promise<Product[]> {
  if (!ids.length) return [];
  // Stable cache key: sort IDs so order doesn't produce different cache entries.
  const sortedIds = [...ids].sort();
  const cached = unstable_cache(
    () => _fetchProductsByIds(sortedIds),
    ["catalog-products-by-ids", sortedIds.join(",")],
    { revalidate: 30 }
  );
  const results = await cached();
  // Re-sort to match the original caller-supplied order.
  const order = new Map(ids.map((id, index) => [id, index]));
  return results.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}

export async function getProductsByIdsAllowInactive(
  ids: string[]
): Promise<Product[]> {
  if (!ids.length) return [];
  const products = await prisma.product.findMany({
    where: { id: { in: ids } },
    include: {
      images: { orderBy: { position: "asc" } },
      variants: {
        orderBy: { position: "asc" },
        include: { inventory: true },
      },
      categories: { include: { category: { include: { parent: true } } } },
      collections: { include: { collection: true } },
      reviews: {
        where: { status: "APPROVED" },
        select: { rating: true },
      },
    },
  });

  const mapped = products.map(mapProduct);
  const order = new Map(ids.map((id, index) => [id, index]));
  return mapped.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}
