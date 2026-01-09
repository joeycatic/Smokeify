import "server-only";

import { prisma } from "@/lib/prisma";
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
  manufacturer: string | null;
  tags: string[];
  variants: Array<{
    id: string;
    title: string;
    priceCents: number;
    position: number;
    inventory: { quantityOnHand: number; reserved: number } | null;
  }>;
  images: Array<{ url: string; altText: string | null; position: number }>;
  categories: Array<{ category: { id: string; name: string; handle: string } }>;
  collections: Array<{ collection: { id: string; name: string; handle: string } }>;
}): Product => {
  const sortedImages = [...product.images].sort((a, b) => a.position - b.position);
  const featuredImage = sortedImages[0] ?? null;
  const variants = [...product.variants].sort((a, b) => a.position - b.position);
  const minPriceCents = variants.reduce(
    (min, variant) => Math.min(min, variant.priceCents),
    variants.length ? variants[0].priceCents : 0
  );
  const defaultVariantId = variants[0]?.id ?? null;
  const availableForSale = variants.some((variant) => {
    const available = getAvailability(
      variant.inventory?.quantityOnHand ?? 0,
      variant.inventory?.reserved ?? 0
    );
    return available > 0;
  });

  return {
    id: product.id,
    handle: product.handle,
    title: product.title,
    description: product.description,
    manufacturer: product.manufacturer,
    tags: product.tags ?? [],
    availableForSale,
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
  };
};

export async function getProducts(limit = 50): Promise<Product[]> {
  const products = await prisma.product.findMany({
    where: { status: "ACTIVE" },
    orderBy: { updatedAt: "desc" },
    take: limit,
    include: {
      images: { orderBy: { position: "asc" } },
      variants: {
        orderBy: { position: "asc" },
        include: { inventory: true },
      },
      categories: { include: { category: true } },
      collections: { include: { collection: true } },
    },
  });

  return products.map(mapProduct);
}

export async function getProductByHandle(handle: string) {
  const product = await prisma.product.findUnique({
    where: { handle },
    include: {
      images: { orderBy: { position: "asc" } },
      variants: {
        orderBy: { position: "asc" },
        include: { inventory: true, options: true },
      },
    },
  });

  if (!product) return null;

  const images = product.images.map((image) => ({
    url: image.url,
    altText: image.altText,
  }));

  const variants = product.variants.map((variant) => {
    const available = getAvailability(
      variant.inventory?.quantityOnHand ?? 0,
      variant.inventory?.reserved ?? 0
    );
    return {
      id: variant.id,
      title: variant.title,
      availableForSale: available > 0,
      price: {
        amount: toAmount(variant.priceCents),
        currencyCode: CURRENCY_CODE,
      },
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
    manufacturer: product.manufacturer,
    images,
    variants,
    options,
  };
}

export async function getProductsByIds(ids: string[]): Promise<Product[]> {
  if (!ids.length) return [];
  const products = await prisma.product.findMany({
    where: { id: { in: ids }, status: "ACTIVE" },
    include: {
      images: { orderBy: { position: "asc" } },
      variants: {
        orderBy: { position: "asc" },
        include: { inventory: true },
      },
      categories: { include: { category: true } },
      collections: { include: { collection: true } },
    },
  });

  const mapped = products.map(mapProduct);
  const order = new Map(ids.map((id, index) => [id, index]));
  return mapped.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}
