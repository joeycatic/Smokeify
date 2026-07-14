import "server-only";

import type { GrowTentViewerProductProps } from "@/components/three/growTentViewerTypes";
import { prisma } from "@/lib/prisma";
import { buildStorefrontProductWhere } from "@/lib/storefronts";

const CATEGORY_BY_SLOT = {
  tent: "zelte",
  light: "licht",
  exhaustFan: "rohrventilatoren",
  carbonFilter: "luft-aktivkohlefilter",
  circulationFan: "ventilatoren",
  substrate: "duenger",
} as const;

const CATEGORY_HANDLES = Object.values(CATEGORY_BY_SLOT);

function formatPrice(priceCents: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(priceCents / 100);
}

export async function getGrowTentHotspotProducts(): Promise<GrowTentViewerProductProps> {
  const rows = await prisma.product.findMany({
    where: buildStorefrontProductWhere("MAIN", {
      categories: {
        some: {
          category: {
            handle: { in: [...CATEGORY_HANDLES] },
            storefronts: { has: "MAIN" },
          },
        },
      },
      variants: {
        some: {
          inventory: { quantityOnHand: { gt: 0 } },
        },
      },
    }),
    orderBy: [
      { bestsellerScore: { sort: "desc", nulls: "last" } },
      { createdAt: "desc" },
      { title: "asc" },
    ],
    select: {
      title: true,
      handle: true,
      manufacturer: true,
      categories: {
        select: { category: { select: { handle: true } } },
      },
      variants: {
        orderBy: { position: "asc" },
        select: {
          priceCents: true,
          inventory: {
            select: { quantityOnHand: true, reserved: true },
          },
        },
      },
    },
  });

  const toHotspotProduct = (categoryHandle: string) => {
    const product = rows.find(
      (candidate) =>
        candidate.categories.some(
          ({ category }) => category.handle === categoryHandle,
        ) &&
        candidate.variants.some(
          (variant) =>
            (variant.inventory?.quantityOnHand ?? 0) -
              (variant.inventory?.reserved ?? 0) >
            0,
        ),
    );
    if (!product) return null;

    const minimumPrice = Math.min(
      ...product.variants.map((variant) => variant.priceCents),
    );
    return {
      title: product.title,
      priceLabel: formatPrice(minimumPrice),
      manufacturer: product.manufacturer,
      href: `/products/${product.handle}`,
    };
  };

  return {
    tent: toHotspotProduct(CATEGORY_BY_SLOT.tent),
    light: toHotspotProduct(CATEGORY_BY_SLOT.light),
    exhaustFan: toHotspotProduct(CATEGORY_BY_SLOT.exhaustFan),
    carbonFilter: toHotspotProduct(CATEGORY_BY_SLOT.carbonFilter),
    circulationFan: toHotspotProduct(CATEGORY_BY_SLOT.circulationFan),
    substrate: toHotspotProduct(CATEGORY_BY_SLOT.substrate),
  };
}
