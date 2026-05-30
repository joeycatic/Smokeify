import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  buildGrowProductWhere,
  filterGrowCategoryHandles,
  filterGrowProducts,
} from "@/lib/growStorefront";

const CURRENCY_MULTIPLIER = 100;

export const CUSTOMIZER_CATEGORY_HANDLES = [
  "zelte",
  "licht",
  "luft",
  "bewaesserung",
  "anzucht",
] as const;

export type CustomizerCategoryHandle =
  (typeof CUSTOMIZER_CATEGORY_HANDLES)[number];

export type CustomizerOption = {
  id: string;
  label: string;
  price: number;
  imageUrl?: string | null;
  imageAlt?: string | null;
  outOfStock?: boolean;
  lowStock?: boolean;
  note?: string;
  size?: string;
  diameterMm?: number;
  diametersMm?: number[];
  variantId?: string;
  isSet?: boolean;
};

export const customizerProductSelect = {
  id: true,
  title: true,
  storefronts: true,
  growboxSize: true,
  lightSize: true,
  airSystemDiameterMm: true,
  growboxConnectionDiameterMm: true,
  mainCategory: {
    select: {
      handle: true,
      storefronts: true,
      parent: { select: { handle: true, storefronts: true } },
    },
  },
  images: { orderBy: { position: "asc" as const } },
  categories: {
    include: {
      category: {
        select: {
          handle: true,
          name: true,
          storefronts: true,
          parent: { select: { handle: true, storefronts: true } },
        },
      },
    },
  },
  variants: {
    select: { id: true, priceCents: true, lowStockThreshold: true, inventory: true },
    orderBy: { position: "asc" as const },
  },
} satisfies Prisma.ProductSelect;

export type CustomizerProduct = Prisma.ProductGetPayload<{
  select: typeof customizerProductSelect;
}>;

const getAvailability = (
  quantityOnHand: number | null | undefined,
  reserved: number | null | undefined,
) => {
  const onHand = quantityOnHand ?? 0;
  const held = reserved ?? 0;
  return Math.max(0, onHand - held);
};

const normalizeHandle = (value?: string | null) =>
  value?.trim().toLowerCase() ?? "";

export function buildCustomizerOptions(products: CustomizerProduct[]) {
  return products.map<CustomizerOption>((product) => {
    const availableVariants = product.variants.filter((variant) => {
      const inventory = variant.inventory;
      return (
        getAvailability(
          inventory?.quantityOnHand ?? 0,
          inventory?.reserved ?? 0,
        ) > 0
      );
    });
    const available = availableVariants.length > 0;
    const cheapestAvailable = availableVariants.reduce((min, variant) => {
      if (!min || variant.priceCents < min.priceCents) return variant;
      return min;
    }, null as (typeof product.variants)[number] | null);
    const cheapestOverall = product.variants.reduce((min, variant) => {
      if (!min || variant.priceCents < min.priceCents) return variant;
      return min;
    }, null as (typeof product.variants)[number] | null);
    const variantForCart = cheapestAvailable ?? cheapestOverall;
    const lowStock = product.variants.some((variant) => {
      const availability = getAvailability(
        variant.inventory?.quantityOnHand ?? 0,
        variant.inventory?.reserved ?? 0,
      );
      return availability > 0 && availability <= (variant.lowStockThreshold ?? 0);
    });
    const priceSource = cheapestAvailable ?? cheapestOverall;
    const primaryImage = product.images[0] ?? null;
    const categoryTokens = product.categories.flatMap((entry) => {
      const handle = entry.category.handle?.toLowerCase() ?? "";
      const name = entry.category.name?.toLowerCase() ?? "";
      return [handle, name];
    });
    const isSet = categoryTokens.some((token) => token.includes("set"));

    return {
      id: product.id,
      label: product.title,
      price: (priceSource?.priceCents ?? 0) / CURRENCY_MULTIPLIER,
      imageUrl: primaryImage?.url ?? null,
      imageAlt: primaryImage?.altText ?? product.title,
      outOfStock: !available,
      lowStock,
      variantId: variantForCart?.id ?? undefined,
      isSet,
      size: product.growboxSize ?? product.lightSize ?? undefined,
      diameterMm: product.airSystemDiameterMm ?? undefined,
      diametersMm:
        product.growboxConnectionDiameterMm.length > 0
          ? product.growboxConnectionDiameterMm
          : undefined,
    };
  });
}

function collectProductCategoryHandles(product: CustomizerProduct) {
  const handles = new Set<string>();
  const addHandle = (value?: string | null) => {
    const normalized = normalizeHandle(value);
    if (normalized) handles.add(normalized);
  };

  addHandle(product.mainCategory?.handle);
  addHandle(product.mainCategory?.parent?.handle);

  product.categories.forEach((entry) => {
    addHandle(entry.category.handle);
    addHandle(entry.category.parent?.handle);
  });

  return handles;
}

export async function getCustomizerOptionsByCategory(
  requestedHandles: readonly string[],
) {
  const normalizedRequested = requestedHandles
    .map((handle) => normalizeHandle(handle))
    .filter(Boolean);

  const record = Object.fromEntries(
    normalizedRequested.map((handle) => [handle, [] as CustomizerOption[]]),
  ) as Record<string, CustomizerOption[]>;

  if (normalizedRequested.length === 0) {
    return record;
  }

  const safeHandles = filterGrowCategoryHandles(normalizedRequested);
  if (safeHandles.length === 0) {
    return record;
  }

  const products = await prisma.product.findMany({
    where: buildGrowProductWhere({
      OR: [
        { mainCategory: { is: { handle: { in: safeHandles } } } },
        {
          categories: {
            some: {
              category: {
                handle: { in: safeHandles },
              },
            },
          },
        },
      ],
    }),
    orderBy: { updatedAt: "desc" },
    select: customizerProductSelect,
  });

  const safeProducts = filterGrowProducts(products);
  const options = buildCustomizerOptions(safeProducts);

  options.forEach((option, index) => {
    const handles = collectProductCategoryHandles(safeProducts[index]);
    handles.forEach((handle) => {
      if (record[handle]) {
        record[handle].push(option);
      }
    });
  });

  return record;
}

