import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

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
  const ip = getClientIp(request.headers);
  const ipLimit = await checkRateLimit({
    key: `customizer:ip:${ip}`,
    limit: 120,
    windowMs: 60 * 1000,
  });
  if (!ipLimit.allowed) {
    return NextResponse.json({ options: [] }, { status: 429 });
  }
  const { searchParams } = new URL(request.url);
  const categoryHandle = searchParams.get("category");
  const categoriesParam = searchParams.get("categories");

  const buildOptions = (
    products: Array<{
      id: string;
      title: string;
      images: Array<{ url: string; altText: string | null }>;
      categories: Array<{ category: { handle: string | null; name: string | null } }>;
      variants: Array<{ id: string; priceCents: number; inventory: { quantityOnHand: number | null; reserved: number | null } | null }>;
      growboxSize: string | null;
      lightSize: string | null;
      airSystemDiameterMm: number | null;
      growboxConnectionDiameterMm: number[];
    }>,
  ) =>
    products.map((product) => {
      const available = product.variants.some((variant) => {
        const inventory = variant.inventory;
        return (
          getAvailability(
            inventory?.quantityOnHand ?? 0,
            inventory?.reserved ?? 0,
          ) > 0
        );
      });
      const availableVariants = product.variants.filter((variant) => {
        const inventory = variant.inventory;
        return (
          getAvailability(
            inventory?.quantityOnHand ?? 0,
            inventory?.reserved ?? 0,
          ) > 0
        );
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

  if (categoriesParam) {
    const handles = categoriesParam
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);
    if (handles.length === 0) {
      return NextResponse.json(
        { error: "Missing category handles." },
        { status: 400 },
      );
    }

    const products = await prisma.product.findMany({
      where: {
        status: "ACTIVE",
        categories: {
          some: {
            category: {
              handle: {
                in: handles,
                mode: "insensitive",
              },
            },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      include: {
        images: { orderBy: { position: "asc" } },
        categories: {
          include: { category: { select: { handle: true, name: true } } },
        },
        variants: {
          select: { id: true, priceCents: true, inventory: true },
          orderBy: { position: "asc" },
        },
      },
    });

    const options = buildOptions(products);
    const optionsByCategory: Record<string, typeof options> = {};
    handles.forEach((handle) => {
      optionsByCategory[handle] = [];
    });

    options.forEach((option, index) => {
      const product = products[index];
      const productHandles = product.categories
        .map((entry) => entry.category.handle?.toLowerCase() ?? "")
        .filter(Boolean);
      productHandles.forEach((handle) => {
        if (optionsByCategory[handle]) {
          optionsByCategory[handle].push(option);
        }
      });
    });

    return NextResponse.json(
      { optionsByCategory },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      },
    );
  }

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

  const options = buildOptions(products);

  return NextResponse.json(
    { options },
    {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    },
  );
}
