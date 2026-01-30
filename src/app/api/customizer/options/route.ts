import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const CURRENCY_MULTIPLIER = 100;

const getMinPriceCents = (prices: number[]) => {
  if (!prices.length) return 0;
  return prices.reduce((min, value) => (value < min ? value : min), prices[0]);
};

const getAvailability = (quantityOnHand: number | null, reserved: number | null) => {
  const onHand = quantityOnHand ?? 0;
  const held = reserved ?? 0;
  return Math.max(0, onHand - held);
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const categoryHandle = searchParams.get("category");

  if (!categoryHandle) {
    return NextResponse.json(
      { error: "Missing category handle." },
      { status: 400 },
    );
  }

  const products = await prisma.product.findMany({
    where: {
      status: "ACTIVE",
      categories: {
        some: { category: { handle: { equals: categoryHandle, mode: "insensitive" } } },
      },
    },
    orderBy: { updatedAt: "desc" },
    include: {
      images: { orderBy: { position: "asc" } },
      categories: { include: { category: { select: { handle: true, name: true } } } },
      variants: {
        select: { id: true, priceCents: true, inventory: true },
        orderBy: { position: "asc" },
      },
    },
  });

  const options = products.map((product) => {
    const available = product.variants.some((variant) => {
      const inventory = variant.inventory;
      return getAvailability(inventory?.quantityOnHand ?? 0, inventory?.reserved ?? 0) > 0;
    });
    const availableVariants = product.variants.filter((variant) => {
      const inventory = variant.inventory;
      return getAvailability(inventory?.quantityOnHand ?? 0, inventory?.reserved ?? 0) > 0;
    });
    const cheapestAvailable = availableVariants.reduce((min, variant) => {
      if (!min || variant.priceCents < min.priceCents) return variant;
      return min;
    }, null as (typeof product.variants)[number] | null);
    const cheapestOverall = product.variants.reduce((min, variant) => {
      if (!min || variant.priceCents < min.priceCents) return variant;
      return min;
    }, null as (typeof product.variants)[number] | null);
    const variantForCart = cheapestAvailable ?? cheapestOverall;
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

  return NextResponse.json({ options });
}
